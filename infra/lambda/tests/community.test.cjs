// Topluluk gönderileri (Increment 1.13, M3). esbuild + vm harness (revenuecat kalıbı): bellek
// içi DynamoDB (koşullu Put/Delete/ADD, Query, BatchGet, TransactWrite) + Cognito GetUser stub.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

const root = path.resolve(__dirname, "../src");
const clone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const MEDIA = "https://media.mapsbridge.test";

function harness(options = {}) {
  const rows = new Map();
  const calls = [];
  const s = (v) => (v && typeof v === "object" && "S" in v ? v.S : v);
  const key = (k) => `${s(k.PK)}|${s(k.SK)}`;
  const condOk = (cond, old) => {
    if (!cond) return true;
    if (cond === "attribute_not_exists(PK)") return !old;
    if (cond === "attribute_exists(PK)") return !!old;
    throw new Error("unsupported condition " + cond);
  };
  const fail = (name) => Object.assign(new Error("cond"), { name });
  function applyOp(op) {
    if (op.Put) rows.set(key(op.Put.Item), clone(op.Put.Item));
    else if (op.Delete) rows.delete(key(op.Delete.Key));
    else if (op.Update) {
      const k = key(op.Update.Key);
      const row = rows.get(k) || { ...op.Update.Key };
      const field = op.Update.ExpressionAttributeNames["#c"];
      row[field] = (row[field] || 0) + op.Update.ExpressionAttributeValues[":d"];
      rows.set(k, row);
    }
  }
  const cmd = (n) =>
    class {
      constructor(input) {
        this.name = n;
        this.input = input;
      }
    };
  const names = [
    "GetItemCommand",
    "PutItemCommand",
    "QueryCommand",
    "BatchGetItemCommand",
    "TransactWriteItemsCommand",
    "UpdateItemCommand",
    "DeleteItemCommand",
  ];
  const external = {
    "@aws-sdk/client-dynamodb": {
      ...Object.fromEntries(names.map((n) => [n, cmd(n)])),
      DynamoDBClient: class {
        async send(c) {
          calls.push({ name: c.name, input: clone(c.input) });
          const i = c.input;
          if (c.name === "GetItemCommand") return { Item: clone(rows.get(key(i.Key))) };
          if (c.name === "PutItemCommand") {
            if (!condOk(i.ConditionExpression, rows.get(key(i.Item))))
              throw fail("ConditionalCheckFailedException");
            rows.set(key(i.Item), clone(i.Item));
            return {};
          }
          if (c.name === "QueryCommand") {
            const pk = i.ExpressionAttributeValues[":pk"];
            let items = [...rows.values()].filter((r) => r.PK === pk);
            items.sort((a, b) => (a.SK < b.SK ? -1 : 1));
            if (i.ScanIndexForward === false) items.reverse();
            if (i.ExclusiveStartKey) {
              const at = items.findIndex((r) => r.SK === i.ExclusiveStartKey.SK);
              items = items.slice(at + 1);
            }
            const page = items.slice(0, i.Limit);
            const more = items.length > i.Limit;
            return {
              Items: clone(page),
              LastEvaluatedKey: more ? { PK: pk, SK: page.at(-1).SK } : undefined,
            };
          }
          if (c.name === "BatchGetItemCommand") {
            const [table, req] = Object.entries(i.RequestItems)[0];
            return {
              Responses: {
                [table]: req.Keys.map((k) => rows.get(key(k)))
                  .filter(Boolean)
                  .map(clone),
              },
            };
          }
          if (c.name === "TransactWriteItemsCommand") {
            const ok = i.TransactItems.every((op) => {
              const o = op.Put || op.Delete || op.Update;
              return condOk(o.ConditionExpression, rows.get(key(o.Item || o.Key)));
            });
            if (!ok) throw fail("TransactionCanceledException");
            i.TransactItems.forEach(applyOp);
            return {};
          }
          throw new Error("unexpected " + c.name);
        }
      },
    },
    "@aws-sdk/util-dynamodb": {
      marshall: (x) => JSON.parse(JSON.stringify(x)),
      unmarshall: (x) => x,
    },
    jose: {
      createRemoteJWKSet: () => () => ({}),
      jwtVerify: async () => ({ payload: {}, protectedHeader: {} }),
    },
  };
  const env = {
    AWS_REGION: "eu-central-1",
    COGNITO_USER_POOL_ID: "eu-central-1_test",
    COGNITO_CLIENT_ID: "test-client",
    DYNAMODB_TABLE: "data",
    MEDIA_PUBLIC_BASE_URL: MEDIA,
    ...options.env,
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
        AbortSignal,
        console: { ...console, error() {}, warn() {} },
        crypto: require("node:crypto").webcrypto,
        process: { env },
        // Cognito GetUser: AccessToken yükündeki sub/email'i döndürür.
        fetch: async (_url, init) => {
          const token = JSON.parse(init.body).AccessToken;
          const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
          return {
            ok: true,
            json: async () => ({
              UserAttributes: [
                { Name: "sub", Value: claims.sub },
                { Name: "email", Value: `${claims.sub}@example.com` },
                { Name: "email_verified", Value: "true" },
              ],
            }),
          };
        },
        require(spec) {
          if (spec.startsWith(".")) {
            const base = path.resolve(path.dirname(filename), spec);
            return load(base.endsWith(".ts") ? base : base + ".ts");
          }
          if (external[spec]) return external[spec];
          if (spec.startsWith("node:")) return require(spec);
          throw new Error("Unexpected dependency: " + spec);
        },
      },
      { filename },
    );
    return module.exports;
  }
  return { handler: load("community/handler.ts").handler, rows, calls };
}

const tokenFor = (sub) =>
  [
    "h",
    Buffer.from(
      JSON.stringify({
        sub,
        iss: "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_test",
        client_id: "test-client",
        token_use: "access",
        exp: Math.floor(Date.now() / 1000) + 300,
      }),
    ).toString("base64url"),
    "s",
  ].join(".");
const req = (method, p, { sub, body, query } = {}) => ({
  rawPath: p,
  requestContext: { http: { method, path: p, sourceIp: "203.0.113.1" }, requestId: "r" },
  headers: sub ? { authorization: `Bearer ${tokenFor(sub)}` } : {},
  queryStringParameters: query,
  body: body === undefined ? undefined : JSON.stringify(body),
});
const json = (res) => JSON.parse(res.body);

test("oluştur → akışta görünür; yazar kimliği sunucuda (istemci adı/kimliği değil)", async () => {
  const h = harness();
  h.rows.set("OWNER#alice|PUBLIC_PROFILE", {
    PK: "OWNER#alice",
    SK: "PUBLIC_PROFILE",
    username: "alice_k",
  });
  const res = await h.handler(
    req("POST", "/community/posts", {
      sub: "alice",
      body: {
        content: "Kapadokya'da gün doğumu #balon",
        category: "Doğa",
        hashtags: ["#balon", "geçersiz"],
        authorUsername: "bob",
        displayName: "Alice K.",
        image: `${MEDIA}/traveler-photos/a.jpg`,
      },
    }),
  );
  assert.equal(res.statusCode, 201);
  const post = json(res).post;
  assert.equal(post.authorUsername, "alice_k", "rezerve kullanıcı adı");
  assert.equal(post.authorDisplayName, "Alice K.");
  assert.deepEqual(post.hashtags, ["#balon"]);
  assert.equal("authorSub" in post, false, "sub dışarı verilmez");
  const feed = json(await h.handler(req("GET", "/community/posts")));
  assert.equal(feed.posts.length, 1);
  assert.equal(feed.posts[0].id, post.id);
  assert.equal(feed.posts[0].image, `${MEDIA}/traveler-photos/a.jpg`);
  const mine = json(
    await h.handler(req("GET", "/community/posts", { query: { author: "alice_k" } })),
  );
  assert.equal(mine.posts.length, 1);
  const tx = h.calls.find((c) => c.name === "TransactWriteItemsCommand").input.TransactItems;
  assert.deepEqual(
    tx.map((o) => o.Put.Item.PK),
    [`POST#${post.id}`, "FEED#GLOBAL", "AUTHOR#alice_k"],
  );
  assert.ok(tx.every((o) => o.Put.ConditionExpression === "attribute_not_exists(PK)"));
  assert.ok(!h.calls.some((c) => JSON.stringify(c.input).includes("GSI1")), "GSI kullanılmaz");
});

test("misafir POST 401; başkasının gönderisini düzenleme/silme 403", async () => {
  const h = harness();
  assert.equal(
    (await h.handler(req("POST", "/community/posts", { body: { content: "x" } }))).statusCode,
    401,
  );
  const { post } = json(
    await h.handler(req("POST", "/community/posts", { sub: "alice", body: { content: "Roma" } })),
  );
  const del = await h.handler(req("DELETE", `/community/posts/${post.id}`, { sub: "mallory" }));
  assert.equal(del.statusCode, 403);
  const put = await h.handler(
    req("PUT", `/community/posts/${post.id}`, { sub: "mallory", body: { content: "hack" } }),
  );
  assert.equal(put.statusCode, 403);
  assert.ok(h.rows.get(`POST#${post.id}|META`), "silinmedi");
  const own = await h.handler(req("DELETE", `/community/posts/${post.id}`, { sub: "alice" }));
  assert.equal(own.statusCode, 200);
  assert.equal(h.rows.get(`POST#${post.id}|META`), undefined);
  assert.equal(json(await h.handler(req("GET", "/community/posts"))).posts.length, 0);
});

test("çift beğeni tek sayım; geri alma idempotent; likedByMe izleyiciye göre", async () => {
  const h = harness();
  const { post } = json(
    await h.handler(req("POST", "/community/posts", { sub: "alice", body: { content: "Lizbon" } })),
  );
  const like = (sub, on) =>
    h.handler(req("POST", `/community/posts/${post.id}/like`, { sub, body: { on } }));
  assert.equal(json(await like("bob", true)).count, 1);
  const again = json(await like("bob", true));
  assert.deepEqual([again.changed, again.count], [false, 1], "ikinci beğeni sayılmaz");
  assert.equal(json(await like("carol", true)).count, 2);
  assert.equal(json(await like("bob", false)).count, 1);
  assert.equal(json(await like("bob", false)).count, 1, "çift geri alma tek sayım");
  const asCarol = json(await h.handler(req("GET", "/community/posts", { sub: "carol" })));
  assert.equal(asCarol.posts[0].likedByMe, true);
  const asGuest = json(await h.handler(req("GET", "/community/posts")));
  assert.equal(asGuest.posts[0].likedByMe, false);
  const save = json(
    await h.handler(
      req("POST", `/community/posts/${post.id}/bookmark`, { sub: "bob", body: { on: true } }),
    ),
  );
  assert.equal(save.count, 1);
  assert.equal(
    (await h.handler(req("POST", `/community/posts/${post.id}/like`, { sub: "bob", body: {} })))
      .statusCode,
    400,
  );
});

test("PII maskelenir (I5); HTML etiketi atılır", async () => {
  const h = harness();
  const { post } = json(
    await h.handler(
      req("POST", "/community/posts", {
        sub: "alice",
        body: { content: "<b>Yaz</b> bana ali.veli@example.com 4111 1111 1111 1111" },
      }),
    ),
  );
  assert.doesNotMatch(post.content, /ali\.veli@example\.com/);
  assert.doesNotMatch(post.content, /4111 1111 1111 1111/);
  assert.doesNotMatch(post.content, /<b>/);
  assert.match(post.content, /MASKEYLEND/);
});

test("yabancı görsel URL'i 400; medya tabanı yoksa hiçbir görsel kabul edilmez", async () => {
  const h = harness();
  for (const image of [
    "https://evil.example/a.jpg",
    `http://media.mapsbridge.test/a.jpg`,
    "data:image/png;base64,AA",
  ]) {
    const res = await h.handler(
      req("POST", "/community/posts", { sub: "alice", body: { content: "x", image } }),
    );
    assert.equal(res.statusCode, 400, image);
  }
  const noBase = harness({ env: { MEDIA_PUBLIC_BASE_URL: "" } });
  const res = await noBase.handler(
    req("POST", "/community/posts", {
      sub: "alice",
      body: { content: "x", image: `${MEDIA}/a.jpg` },
    }),
  );
  assert.equal(res.statusCode, 400);
});

test("sayfalama imleci: 20'lik sayfa + cursor ile devam; bozuk imleç yok sayılır", async () => {
  const h = harness();
  for (let i = 0; i < 23; i++)
    await h.handler(req("POST", "/community/posts", { sub: "alice", body: { content: `#${i}` } }));
  const first = json(await h.handler(req("GET", "/community/posts")));
  assert.equal(first.posts.length, 20);
  assert.ok(first.cursor);
  const second = json(
    await h.handler(req("GET", "/community/posts", { query: { cursor: first.cursor } })),
  );
  assert.equal(second.posts.length, 3);
  const ids = new Set([...first.posts, ...second.posts].map((p) => p.id));
  assert.equal(ids.size, 23);
  const bad = await h.handler(req("GET", "/community/posts", { query: { cursor: "%%%" } }));
  assert.equal(bad.statusCode, 200);
});
