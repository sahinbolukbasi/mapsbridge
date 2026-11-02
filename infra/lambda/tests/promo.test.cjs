// Promosyon kodu — kredi atomikliği testi (danger-zone). Kendi minimal DynamoDB
// mock'u ile TransactWriteItems'ın ConditionExpression semantiğini simüle eder:
// attribute_not_exists (tek-kullanım kilidi), redeemedCount < :max (limit),
// expiresAt > :now (süre), active = :yes. Amaç: double-redeem ve limit aşımının
// DynamoDB seviyesinde imkansız olduğunu kanıtlamak.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

function harness() {
  const rows = new Map();
  const key = (k) => `${k.PK}|${k.SK}`;
  const marshall = (x) => x;
  const unmarshall = (x) => (x ? JSON.parse(JSON.stringify(x)) : x);

  // ConditionExpression değerlendirici (promo.ts'in kullandığı koşulları kapsar).
  function condOk(expr, item, values) {
    if (!expr) return true;
    for (const part of expr.split(" AND ")) {
      const p = part.trim();
      if (p === "attribute_not_exists(PK)") {
        if (item) return false;
      } else if (p === "attribute_exists(PK)") {
        if (!item) return false;
      } else if (p === "active = :yes") {
        if (!item || item.active !== values[":yes"]) return false;
      } else if (p === "redeemedCount < :max") {
        if (!item || !(item.redeemedCount < values[":max"])) return false;
      } else if (p === "expiresAt > :now") {
        if (!item || !(item.expiresAt > values[":now"])) return false;
      } else {
        throw new Error("Test mock: bilinmeyen koşul: " + p);
      }
    }
    return true;
  }
  function applyUpdate(existing, input) {
    const row = existing ? { ...existing } : { ...input.Key };
    const ue = input.UpdateExpression;
    const v = input.ExpressionAttributeValues || {};
    if (ue.startsWith("ADD ")) {
      const [, field, token] = ue.split(/\s+/);
      row[field] = (row[field] || 0) + v[token];
    } else if (ue.startsWith("SET ")) {
      const [field, token] = ue.slice(4).split(" = ");
      row[field.trim()] = v[token.trim()];
    }
    return row;
  }

  const client = {
    async send(command) {
      const n = command.name;
      const i = command.input;
      if (n === "GetItemCommand") {
        const r = rows.get(key(i.Key));
        return { Item: r ? { ...r } : undefined };
      }
      if (n === "PutItemCommand") {
        const existing = rows.get(key(i.Item));
        if (!condOk(i.ConditionExpression, existing, i.ExpressionAttributeValues || {})) {
          throw Object.assign(new Error("cond"), { name: "ConditionalCheckFailedException" });
        }
        rows.set(key(i.Item), { ...i.Item });
        return {};
      }
      if (n === "QueryCommand") {
        const pk = i.ExpressionAttributeValues[":pk"];
        const items = [...rows.values()].filter((r) => r.GSI1PK === pk);
        return { Items: items };
      }
      if (n === "TransactWriteItemsCommand") {
        const ops = i.TransactItems;
        // Önce TÜM koşulları mevcut duruma karşı değerlendir (atomik: biri bile
        // başarısızsa hiçbiri uygulanmaz).
        for (const op of ops) {
          const w = op.Put || op.Update;
          const existing = rows.get(key(w.Item || w.Key));
          if (!condOk(w.ConditionExpression, existing, w.ExpressionAttributeValues || {})) {
            throw Object.assign(new Error("tx cancel"), { name: "TransactionCanceledException" });
          }
        }
        for (const op of ops) {
          if (op.Put) rows.set(key(op.Put.Item), { ...op.Put.Item });
          else if (op.Update) {
            const k = key(op.Update.Key);
            rows.set(k, applyUpdate(rows.get(k), op.Update));
          }
        }
        return {};
      }
      throw new Error("Test mock: bilinmeyen komut " + n);
    },
  };

  const cache = new Map();
  function load(file) {
    const filename = path.resolve(__dirname, "../src", file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = transformSync(readFileSync(filename, "utf8"), {
      loader: "ts",
      format: "cjs",
    }).code;
    const externals = {
      "@aws-sdk/client-dynamodb": {
        GetItemCommand: class {
          constructor(input) {
            this.name = "GetItemCommand";
            this.input = input;
          }
        },
        PutItemCommand: class {
          constructor(input) {
            this.name = "PutItemCommand";
            this.input = input;
          }
        },
        QueryCommand: class {
          constructor(input) {
            this.name = "QueryCommand";
            this.input = input;
          }
        },
        TransactWriteItemsCommand: class {
          constructor(input) {
            this.name = "TransactWriteItemsCommand";
            this.input = input;
          }
        },
      },
      "@aws-sdk/util-dynamodb": { marshall, unmarshall },
      "../shared/dynamo": { getDynamoClient: () => client },
    };
    vm.runInNewContext(code, {
      module,
      exports: module.exports,
      process: { env: { DYNAMODB_TABLE: "test-data" } },
      console,
      require(spec) {
        if (externals[spec]) return externals[spec];
        if (spec.startsWith(".")) {
          const abs = path.resolve(path.dirname(filename), spec);
          const rel = path.relative(path.resolve(__dirname, "../src"), abs) + ".ts";
          return load(rel);
        }
        return require(spec);
      },
    });
    return module.exports;
  }
  return { load, rows };
}

test("promo: oluştur + başarılı redeem kredi ekler", async () => {
  const h = harness();
  const promo = h.load("billing/promo.ts");
  await promo.createPromoCode({ code: "WELCOME10", credits: 10, maxRedemptions: 2, createdBy: "admin" });
  const r = await promo.redeemPromoCode("userA", "welcome10"); // küçük harf de kabul
  assert.equal(r.credits, 10);
  assert.equal(h.rows.get("USER#userA|CREDITS").credits, 10);
  assert.equal(h.rows.get("BILLING#PROMO#WELCOME10|META").redeemedCount, 1);
});

test("promo: aynı kullanıcı aynı kodu İKİNCİ kez kullanamaz (double-redeem reddi)", async () => {
  const h = harness();
  const promo = h.load("billing/promo.ts");
  await promo.createPromoCode({ code: "ONCE", credits: 5, maxRedemptions: 100, createdBy: "admin" });
  await promo.redeemPromoCode("userA", "ONCE");
  await assert.rejects(() => promo.redeemPromoCode("userA", "ONCE"), /zaten kullandınız/);
  // Bakiye tek artış, sayaç tek artış — çift harcama YOK.
  assert.equal(h.rows.get("USER#userA|CREDITS").credits, 5);
  assert.equal(h.rows.get("BILLING#PROMO#ONCE|META").redeemedCount, 1);
});

test("promo: kullanım limiti aşılamaz", async () => {
  const h = harness();
  const promo = h.load("billing/promo.ts");
  await promo.createPromoCode({ code: "LIMIT1", credits: 3, maxRedemptions: 1, createdBy: "admin" });
  await promo.redeemPromoCode("userA", "LIMIT1");
  await assert.rejects(() => promo.redeemPromoCode("userB", "LIMIT1"), /limiti dolmuş/);
  assert.equal(h.rows.get("BILLING#PROMO#LIMIT1|META").redeemedCount, 1);
  assert.equal(h.rows.get("USER#userB|CREDITS"), undefined);
});

test("promo: süresi dolmuş kod reddedilir", async () => {
  const h = harness();
  const promo = h.load("billing/promo.ts");
  await promo.createPromoCode({
    code: "EXPIRED",
    credits: 5,
    maxRedemptions: 0,
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    createdBy: "admin",
  });
  await assert.rejects(() => promo.redeemPromoCode("userA", "EXPIRED"), /süresi dolmuş/);
});

test("promo: olmayan/pasif kod reddedilir, sınırsız (0) limit çalışır", async () => {
  const h = harness();
  const promo = h.load("billing/promo.ts");
  await assert.rejects(() => promo.redeemPromoCode("userA", "NOPE"), /bulunamadı/);
  await promo.createPromoCode({ code: "UNLIM", credits: 2, maxRedemptions: 0, createdBy: "admin" });
  await promo.redeemPromoCode("userA", "UNLIM");
  await promo.redeemPromoCode("userB", "UNLIM");
  assert.equal(h.rows.get("BILLING#PROMO#UNLIM|META").redeemedCount, 2);
});
