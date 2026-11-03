const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

const root = path.resolve(__dirname, "../src");
const clone = (x) => JSON.parse(JSON.stringify(x));
const key = (x) => `${x?.PK}|${x?.SK}`;
const WEBHOOK_SECRET = "test-rc-webhook-secret";

function harness(options = {}) {
  const rows = new Map(),
    calls = [];
  const names = [
    "GetItemCommand",
    "PutItemCommand",
    "UpdateItemCommand",
    "TransactWriteItemsCommand",
    "QueryCommand",
    "ScanCommand",
  ];
  const commands = Object.fromEntries(
    names.map((n) => [
      n,
      class {
        constructor(i) {
          this.name = n;
          this.input = i;
        }
      },
    ]),
  );

  function allowed(input, old) {
    const c = input.ConditionExpression,
      v = input.ExpressionAttributeValues || {};
    if (!c) return true;
    if (c === "attribute_not_exists(PK)") return !old;
    if (c.startsWith("credits >="))
      return old?.credits >= (v[":cost"] ?? v[":required"]) && old?.frozen !== true;
    if (c.includes("eventTime <")) return !old?.eventTime || old.eventTime < v[":time"];
    if (c.includes("attribute_not_exists(eventTime)") || c.includes("OR eventTime < :time"))
      return !old?.eventTime || old.eventTime < v[":time"];
    if (c === "attribute_exists(PK) AND (attribute_not_exists(eventTime) OR eventTime < :time)")
      return !!old && (!old?.eventTime || old.eventTime < v[":time"]);
    return true;
  }

  function apply(input) {
    const k = key(input.Item || input.Key),
      old = rows.get(k);
    if (input.Item) {
      rows.set(k, clone(input.Item));
      return;
    }
    const next = { ...input.Key, ...old };
    const values = input.ExpressionAttributeValues || {};
    const attrNames = input.ExpressionAttributeNames || {};
    if (input.UpdateExpression.startsWith("ADD ")) {
      const [, field, value] = input.UpdateExpression.split(" ");
      next[field] = (next[field] || 0) + values[value];
    } else {
      for (const assignment of input.UpdateExpression.slice(4).split(",")) {
        const [field, value] = assignment.trim().split(" = ");
        next[attrNames[field] || field] = values[value];
      }
    }
    rows.set(k, clone(next));
  }

  const external = {
    "@aws-sdk/client-dynamodb": {
      DynamoDBClient: class {
        send(command) {
          calls.push(clone(command.input));
          const k = key(command.input.Item || command.input.Key);
          const old = rows.get(k);
          if (command.name === "ScanCommand") {
            const sk = command.input.ExpressionAttributeValues?.[":sk"]?.S;
            const items = [...rows.values()].filter((r) => !sk || r.SK === sk).map((r) => clone(r));
            return Promise.resolve({ Items: items });
          }
          if (command.name === "GetItemCommand")
            return Promise.resolve({ Item: old ? clone(old) : undefined });
          if (command.name === "TransactWriteItemsCommand") {
            const ops = (command.input.TransactItems || [])
              .map((t) => t.Put || t.Update || t.ConditionCheck)
              .filter(Boolean);
            const checks = ops.map((o) => allowed(o, rows.get(key(o.Item || o.Key))));
            if (checks.some((x) => !x))
              throw Object.assign(new Error("condition"), {
                name: "TransactionCanceledException",
                CancellationReasons: checks.map((ok) => ({
                  Code: ok ? "None" : "ConditionalCheckFailed",
                })),
              });
            ops.filter((o) => o.Item || o.UpdateExpression).forEach(apply);
            return Promise.resolve({});
          }
          if (!allowed(command.input, old))
            throw Object.assign(new Error("condition"), {
              name: "ConditionalCheckFailedException",
            });
          apply(command.input);
          return Promise.resolve({});
        }
      },
      ...commands,
    },
    "@aws-sdk/util-dynamodb": { marshall: (x) => x, unmarshall: (x) => x },
    "node:crypto": require("node:crypto"),
    jose: {
      createRemoteJWKSet: () => () => ({}),
      jwtVerify: async () => ({ payload: {}, protectedHeader: {} }),
    },
  };

  const cache = new Map();
  function load(file) {
    const filename = path.resolve(root, file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = transformSync(readFileSync(filename, "utf8"), {
      loader: "ts",
      format: "cjs",
      target: "node22",
      supported: { "dynamic-import": false },
    }).code;
    vm.runInNewContext(
      code,
      {
        module,
        exports: module.exports,
        Buffer,
        URL,
        console,
        AbortSignal,
        crypto: require("node:crypto").webcrypto,
        process: {
          env: {
            BILLING_ENABLED: "true",
            AWS_REGION: "eu-central-1",
            COGNITO_USER_POOL_ID: "eu-central-1_test",
            COGNITO_CLIENT_ID: "test-client",
            DYNAMODB_TABLE: "data",
            RC_SECRET_API_KEY: "sk_test_reconcile_valid",
            RC_WEBHOOK_AUTH_SECRET: WEBHOOK_SECRET,
            RC_BILLING_CHECKOUT_URL: "https://billing.revenuecat.com/checkout",
            RC_EXPLORER_PRODUCT_ID: "prode1930276ca",
            RC_PRO_PRODUCT_ID: "prod99e16b0cb7",
            RC_PACK_STARTER_PRODUCT_ID: "mapsbridge_pack_starter",
            APP_ORIGIN: "https://mapsbridge.com",
            ...options.env,
          },
        },
        fetch:
          options.fetch ||
          (async () => ({
            ok: !options.authFailure,
            json: async () => ({
              UserAttributes: [
                { Name: "sub", Value: "user-a" },
                { Name: "email_verified", Value: "true" },
                { Name: "email", Value: "user-a@example.com" },
              ],
            }),
          })),
        require(spec) {
          if (spec.startsWith(".")) return load(path.resolve(path.dirname(filename), spec + ".ts"));
          if (external[spec]) return external[spec];
          throw new Error("Unexpected dependency: " + spec);
        },
      },
      { filename },
    );
    return module.exports;
  }
  return { load, rows, calls };
}

const token = () =>
  [
    "header",
    Buffer.from(
      JSON.stringify({
        sub: "user-a",
        iss: "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_test",
        client_id: "test-client",
        token_use: "access",
        exp: Math.floor(Date.now() / 1000) + 300,
      }),
    ).toString("base64url"),
    "signature",
  ].join(".");

function webhookEvent(type, overrides = {}) {
  return {
    rawPath: "/revenuecat/webhook",
    requestContext: { http: { method: "POST", path: "/revenuecat/webhook" } },
    headers: { authorization: `Bearer ${WEBHOOK_SECRET}` },
    body: JSON.stringify({
      api_version: "1.0",
      event: {
        id: "evt-test-1",
        type,
        app_user_id: "user-a",
        product_id: "prode1930276ca",
        event_timestamp_ms: Date.now(),
        expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
        transaction_id: "txn-test-1",
        store: "APP_STORE",
        environment: "SANDBOX",
        ...overrides,
      },
    }),
  };
}

test("rejects webhook with missing auth header", async () => {
  const { load } = harness();
  const { handler } = load("revenuecat/index.ts");
  const event = webhookEvent("INITIAL_PURCHASE");
  event.headers.authorization = "";
  const res = await handler(event);
  assert.equal(res.statusCode, 401);
});

test("rejects webhook with wrong auth secret", async () => {
  const { load } = harness();
  const { handler } = load("revenuecat/index.ts");
  const event = webhookEvent("INITIAL_PURCHASE");
  event.headers.authorization = "Bearer wrong-secret";
  const res = await handler(event);
  assert.equal(res.statusCode, 401);
});

test("INITIAL_PURCHASE grants credits and sets subscription", async () => {
  const { load, rows } = harness();
  const { handler } = load("revenuecat/index.ts");
  const res = await handler(webhookEvent("INITIAL_PURCHASE"));
  assert.equal(res.statusCode, 200);
  const sub = rows.get("USER#user-a|SUBSCRIPTION");
  assert.equal(sub?.tier, "pro");
  assert.equal(sub?.status, "active");
  // Credits granted
  const credits = rows.get("USER#user-a|CREDITS");
  assert.ok(credits?.credits > 0, "credits should be granted");
});

test("RENEWAL grants another month of credits", async () => {
  const { load, rows } = harness();
  rows.set("USER#user-a|CREDITS", {
    PK: "USER#user-a",
    SK: "CREDITS",
    credits: 100,
    welcomeGift: null,
  });
  rows.set("USER#user-a|SUBSCRIPTION", {
    PK: "USER#user-a",
    SK: "SUBSCRIPTION",
    tier: "pro",
    status: "active",
    eventTime: 1,
  });
  const { handler } = load("revenuecat/index.ts");
  const res = await handler(webhookEvent("RENEWAL", { transaction_id: "txn-renewal" }));
  assert.equal(res.statusCode, 200);
  const credits = rows.get("USER#user-a|CREDITS");
  assert.ok(credits?.credits > 100, "renewal should add more credits");
});

test("CANCELLATION sets status to cancelled", async () => {
  const { load, rows } = harness();
  rows.set("USER#user-a|SUBSCRIPTION", {
    PK: "USER#user-a",
    SK: "SUBSCRIPTION",
    tier: "pro",
    status: "active",
    eventTime: 1,
  });
  const { handler } = load("revenuecat/index.ts");
  const res = await handler(webhookEvent("CANCELLATION"));
  assert.equal(res.statusCode, 200);
  const sub = rows.get("USER#user-a|SUBSCRIPTION");
  assert.equal(sub?.status, "cancelled");
});

test("EXPIRATION downgrades to free", async () => {
  const { load, rows } = harness();
  rows.set("USER#user-a|SUBSCRIPTION", {
    PK: "USER#user-a",
    SK: "SUBSCRIPTION",
    tier: "pro",
    status: "active",
    eventTime: 1,
  });
  const { handler } = load("revenuecat/index.ts");
  const res = await handler(webhookEvent("EXPIRATION"));
  assert.equal(res.statusCode, 200);
  const sub = rows.get("USER#user-a|SUBSCRIPTION");
  assert.equal(sub?.tier, "free");
  assert.equal(sub?.status, "expired");
});

test("REFUND freezes user credits", async () => {
  const { load, rows } = harness();
  rows.set("USER#user-a|CREDITS", {
    PK: "USER#user-a",
    SK: "CREDITS",
    credits: 100,
    frozen: false,
  });
  const { handler } = load("revenuecat/index.ts");
  const res = await handler(webhookEvent("REFUND"));
  assert.equal(res.statusCode, 200);
  const credits = rows.get("USER#user-a|CREDITS");
  assert.equal(credits?.frozen, true);
});

test("GET /revenuecat/plans returns catalog", async () => {
  const { load } = harness();
  const { handler } = load("revenuecat/index.ts");
  const res = await handler({
    rawPath: "/revenuecat/plans",
    requestContext: { http: { method: "GET", path: "/revenuecat/plans" } },
    headers: {},
  });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.ok(Array.isArray(body.products));
  assert.ok(body.products.length > 0);
});

test("GET /revenuecat/wallet requires auth", async () => {
  const { load } = harness();
  const { handler } = load("revenuecat/index.ts");
  const res = await handler({
    rawPath: "/revenuecat/wallet",
    requestContext: { http: { method: "GET", path: "/revenuecat/wallet" } },
    headers: {},
  });
  assert.equal(res.statusCode, 401);
});

test("GET /revenuecat/wallet returns wallet for authenticated user", async () => {
  const { load, rows } = harness();
  rows.set("USER#user-a|CREDITS", {
    PK: "USER#user-a",
    SK: "CREDITS",
    credits: 42,
    welcomeGift: null,
  });
  const { handler } = load("revenuecat/index.ts");
  const res = await handler({
    rawPath: "/revenuecat/wallet",
    requestContext: { http: { method: "GET", path: "/revenuecat/wallet" } },
    headers: { authorization: "Bearer " + token() },
  });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.credits, 42);
});

test("pro-yearly subscription purchase works", async () => {
  const { load, rows } = harness();
  const { handler } = load("revenuecat/index.ts");
  const res = await handler(
    webhookEvent("INITIAL_PURCHASE", {
      product_id: "prod99e16b0cb7",
      transaction_id: "txn-pro",
    }),
  );
  assert.equal(res.statusCode, 200);
  const sub = rows.get("USER#user-a|SUBSCRIPTION");
  assert.equal(sub?.tier, "pro-yearly");
  const credits = rows.get("USER#user-a|CREDITS");
  assert.ok(credits?.credits >= 5500, "pro-yearly tier should grant 5500 credits");
});

test("unknown product_id is silently ignored", async () => {
  const { load, rows } = harness();
  const { handler } = load("revenuecat/index.ts");
  const res = await handler(webhookEvent("INITIAL_PURCHASE", { product_id: "unknown_product" }));
  assert.equal(res.statusCode, 200);
  assert.ok(
    !rows.get("USER#user-a|SUBSCRIPTION"),
    "no subscription row created for unknown product",
  );
});

test("idempotency: aynı event 3 kez → kredi tek kez, ikinci+ çağrı duplicate döner", async () => {
  const { load, rows } = harness();
  const { handler } = load("revenuecat/index.ts");
  const ev = webhookEvent("INITIAL_PURCHASE");
  const r1 = await handler(ev);
  assert.equal(r1.statusCode, 200);
  const creditsAfter1 = rows.get("USER#user-a|CREDITS")?.credits;
  assert.ok(creditsAfter1 > 0, "ilk çağrıda kredi eklenir");
  // Aynı event.id ile 2. ve 3. kez
  const r2 = await handler(webhookEvent("INITIAL_PURCHASE"));
  const r3 = await handler(webhookEvent("INITIAL_PURCHASE"));
  assert.equal(r2.statusCode, 200);
  assert.equal(r3.statusCode, 200);
  assert.equal(JSON.parse(r2.body).duplicate, true, "2. çağrı duplicate");
  assert.equal(JSON.parse(r3.body).duplicate, true, "3. çağrı duplicate");
  // Kredi ARTMADI (çift harcama/çift kredi yok)
  assert.equal(
    rows.get("USER#user-a|CREDITS")?.credits,
    creditsAfter1,
    "tekrar eden event kredi eklemez",
  );
  // Tek idempotency guard kaydı
  assert.ok(rows.get("BILLING#RC_EVENT#evt-test-1|PROCESSED"), "event işlendi olarak kaydedilir");
});
test("constant-time secret: yanlış uzunlukta secret de 401 (timingSafeEqual length guard)", async () => {
  const { load } = harness();
  const { handler } = load("revenuecat/index.ts");
  const event = webhookEvent("INITIAL_PURCHASE");
  event.headers.authorization = "Bearer x";
  const res = await handler(event);
  assert.equal(res.statusCode, 401);
});

test("TRANSFER etkilenen kullanıcıları reconcile'a işaretler, 200 döner", async () => {
  const { load, rows } = harness();
  const { handler } = load("revenuecat/index.ts");
  // Önce bir abonelik kaydı oluştur ki attribute_exists(PK) koşulu geçsin
  await handler(webhookEvent("INITIAL_PURCHASE", { app_user_id: "user-a" }));
  const res = await handler(
    webhookEvent("TRANSFER", {
      id: "evt-transfer-1",
      app_user_id: "user-a",
      transferred_to: ["user-a"],
      transferred_from: ["user-b"],
    }),
  );
  assert.equal(res.statusCode, 200);
  assert.equal(rows.get("USER#user-a|SUBSCRIPTION")?.needsReconcile, true);
});
test("hasEntitlement: pro/agency true, free/explorer false, expired false", async () => {
  const { load, rows } = harness();
  const store = load("billing/store.ts");
  // pro, gelecekte biten → true
  rows.set("USER#p|SUBSCRIPTION", {
    PK: "USER#p",
    SK: "SUBSCRIPTION",
    tier: "pro",
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 864e5).toISOString(),
  });
  assert.equal(await store.hasEntitlement("p", "pro"), true);
  // agency → pro'yu kapsar → true
  rows.set("USER#ag|SUBSCRIPTION", {
    PK: "USER#ag",
    SK: "SUBSCRIPTION",
    tier: "agency",
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 864e5).toISOString(),
  });
  assert.equal(await store.hasEntitlement("ag", "pro"), true);
  // explorer → pro değil → false
  rows.set("USER#ex|SUBSCRIPTION", {
    PK: "USER#ex",
    SK: "SUBSCRIPTION",
    tier: "explorer",
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 864e5).toISOString(),
  });
  assert.equal(await store.hasEntitlement("ex", "pro"), false);
  // süresi geçmiş pro → false (expiry okuma anında)
  rows.set("USER#old|SUBSCRIPTION", {
    PK: "USER#old",
    SK: "SUBSCRIPTION",
    tier: "pro",
    status: "active",
    currentPeriodEnd: new Date(Date.now() - 1000).toISOString(),
  });
  assert.equal(await store.hasEntitlement("old", "pro"), false);
  // kaydı olmayan → false
  assert.equal(await store.hasEntitlement("nobody", "pro"), false);
});

test("reconcile: needsReconcile işaretli kullanıcıyı RC'den doğrular ve düzeltir", async () => {
  const subscriberResponse = {
    ok: true,
    json: async () => ({
      subscriber: {
        entitlements: {
          pro: { expires_date: new Date(Date.now() + 30 * 864e5).toISOString() },
        },
      },
    }),
  };
  const { load, rows } = harness({ fetch: async () => subscriberResponse });
  // needsReconcile işaretli, tier free görünüyor ama RC'de pro aktif (drift)
  rows.set("USER#user-x|SUBSCRIPTION", {
    PK: "USER#user-x",
    SK: "SUBSCRIPTION",
    tier: "free",
    status: "active",
    needsReconcile: true,
  });
  // reconcile edilmemeli: eski, işaretsiz kullanıcı
  rows.set("USER#user-old|SUBSCRIPTION", {
    PK: "USER#user-old",
    SK: "SUBSCRIPTION",
    tier: "free",
    status: "active",
    eventTime: Math.floor((Date.now() - 10 * 864e5) / 1000),
  });
  const { handler } = load("billing/reconcile.ts");
  const result = await handler({}, { getRemainingTimeInMillis: () => 60000 });
  // user-x kontrol edildi ve pro'ya düzeltildi
  assert.ok(result.checked >= 1, "en az bir kullanıcı kontrol edildi");
  assert.equal(rows.get("USER#user-x|SUBSCRIPTION")?.tier, "pro", "drift pro'ya düzeltildi");
});
