const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const vm = require("node:vm");
const { readFileSync } = require("node:fs");
const { transformSync } = require("esbuild");

const root = path.resolve(__dirname, "../src");

function harness(options = {}) {
  const rows = new Map();
  const calls = [];
  const names = [
    "GetItemCommand",
    "PutItemCommand",
    "UpdateItemCommand",
    "TransactWriteItemsCommand",
    "QueryCommand",
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

  const key = (x) => `${x?.PK}|${x?.SK}`;

  const external = {
    "@aws-sdk/client-dynamodb": {
      ...commands,
      DynamoDBClient: class {
        async send(command) {
          calls.push(command);
          if (options.outage) throw new Error("DB offline");
          const i = command.input;
          if (command.name === "GetItemCommand") {
            return { Item: rows.get(key(i.Key)) };
          }
          if (command.name === "PutItemCommand") {
            const k = key(i.Item);
            if (i.ConditionExpression?.includes("attribute_not_exists") && rows.has(k)) {
              const err = new Error("ConditionalCheckFailedException");
              err.name = "ConditionalCheckFailedException";
              throw err;
            }
            rows.set(k, i.Item);
            return {};
          }
          if (command.name === "UpdateItemCommand") {
            const k = key(i.Key);
            const values = {};
            if (i.ExpressionAttributeValues) {
              for (const [key, val] of Object.entries(i.ExpressionAttributeValues)) {
                values[key.replace(/^:/, "")] = val;
              }
            }
            rows.set(k, { ...rows.get(k), ...i.Key, ...values });
            return {};
          }
          if (command.name === "TransactWriteItemsCommand") {
            for (const item of i.TransactItems) {
              if (item.Put) {
                const k = key(item.Put.Item);
                if (item.Put.ConditionExpression?.includes("attribute_not_exists") && rows.has(k)) {
                  const err = new Error("TransactionCanceledException");
                  err.name = "TransactionCanceledException";
                  throw err;
                }
                rows.set(k, item.Put.Item);
              }
              if (item.Update) {
                const k = key(item.Update.Key);
                const prev = rows.get(k) || { credits: 0 };
                const add = item.Update.ExpressionAttributeValues?.[":credits"] || 0;
                rows.set(k, { ...prev, credits: (prev.credits || 0) + add });
              }
            }
            return {};
          }
          return {};
        }
      },
    },
    "@aws-sdk/util-dynamodb": {
      marshall: (x) => x,
      unmarshall: (x) => x,
    },
    "@polar-sh/sdk/2026-10": {
      createPolar: () => ({
        checkouts: {
          create: async (params) => ({
            id: "polar_chk_123",
            url: "https://polar.sh/checkout/polar_chk_123",
          }),
        },
        customerSessions: {
          create: async (params) => ({
            id: "polar_cs_123",
            customer_portal_url: "https://polar.sh/portal/polar_cs_123",
          }),
        },
      }),
      webhooks: {
        validateEvent: async (body, headers, secret) => {
          if (secret !== "test_webhook_secret") {
            const err = new Error("Invalid signature");
            err.name = "PolarWebhookVerificationError";
            throw err;
          }
          return JSON.parse(body);
        },
      },
    },
    jose: {
      createRemoteJWKSet: () => () => ({}),
      jwtVerify: async () => ({ payload: { sub: "test-user-id", email: "user@example.com" }, protectedHeader: {} }),
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
    }).code;

    vm.runInNewContext(
      code,
      {
        module,
        exports: module.exports,
        Buffer,
        URL,
        console,
        setTimeout,
        clearTimeout,
        process: {
          env: {
            AWS_REGION: "eu-central-1",
            COGNITO_USER_POOL_ID: "eu-central-1_test",
            COGNITO_CLIENT_ID: "client_test",
            DYNAMODB_TABLE: "mapsbridge-dev",
            POLAR_ACCESS_TOKEN: "test_access_token",
            POLAR_WEBHOOK_SECRET: "test_webhook_secret",
            BILLING_ENABLED: "true",
            ENVIRONMENT: "dev",
            APP_ORIGIN: "https://mapsbridge.com",
            ...options.env,
          },
        },
        require: (spec) => {
          if (spec.includes("shared/auth") || spec === "../shared/auth") {
            return {
              verifiedUserId: async (token) => (token === "valid-token" ? "test-user-id" : null),
              getVerifiedUser: async (token) =>
                token === "valid-token"
                  ? { sub: "test-user-id", email: "user@example.com", emailVerified: true, isAdmin: false }
                  : null,
            };
          }
          if (external[spec]) return external[spec];
          if (spec.startsWith(".")) {
            const resolved = path.resolve(path.dirname(filename), spec);
            return load(resolved.endsWith(".ts") ? resolved : resolved + ".ts");
          }
          return require(spec);
        },
      },
      { filename },
    );
    return module.exports;
  }

  return { load, rows, calls };
}

test("Polar GET /polar/plans returns product catalog with welcomeCredits", async () => {
  const h = harness();
  const { handler } = h.load("polar/index.ts");

  const res = await handler({
    rawPath: "/polar/plans",
    requestContext: { http: { method: "GET", path: "/polar/plans", sourceIp: "127.0.0.1" }, requestId: "r1" },
  });

  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.equal(data.welcomeCredits, 100);
  assert.ok(Array.isArray(data.products));
  assert.ok(data.products.some((p) => p.id === "pro"));
  assert.ok(data.products.some((p) => p.id === "pack-100"));
});

test("Polar POST /polar/checkout requires auth and returns hosted session URL", async () => {
  const h = harness();
  const { handler } = h.load("polar/index.ts");

  // Without auth
  const unauth = await handler({
    rawPath: "/polar/checkout",
    requestContext: { http: { method: "POST", path: "/polar/checkout", sourceIp: "127.0.0.1" }, requestId: "r1" },
  });
  assert.equal(unauth.statusCode, 401);

  // With auth
  const authRes = await handler({
    rawPath: "/polar/checkout",
    headers: { authorization: "Bearer valid-token" },
    body: JSON.stringify({ targetId: "pro", mode: "subscription" }),
    requestContext: { http: { method: "POST", path: "/polar/checkout", sourceIp: "127.0.0.1" }, requestId: "r2" },
  });
  assert.equal(authRes.statusCode, 201);
  const data = JSON.parse(authRes.body);
  assert.ok(data.url.startsWith("https://polar.sh/checkout/"));
  assert.equal(data.checkoutId, "polar_chk_123");
});

test("Polar Webhook handles order.created and grants credit pack idempotently", async () => {
  const h = harness();
  const { handler } = h.load("polar/index.ts");

  const orderPayload = {
    type: "order.created",
    id: "evt_order_1",
    data: {
      id: "ord_123",
      product_id: "polar_prod_pack_100",
      total_amount: 24900,
      currency: "try",
      metadata: { userId: "test-user-id", targetId: "pack-100", mode: "credit_pack" },
    },
  };

  const event = {
    rawPath: "/polar/webhook",
    requestContext: { http: { method: "POST", path: "/polar/webhook", sourceIp: "127.0.0.1" }, requestId: "r3" },
    body: JSON.stringify(orderPayload),
  };

  const res = await handler(event);
  assert.equal(res.statusCode, 200);

  // Wallet must have 100 credits
  const userRow = h.rows.get("USER#test-user-id|CREDITS");
  assert.equal(userRow?.credits, 100);

  // Receipt must exist
  const receipt = h.rows.get("BILLING#POLAR_ORDER_ord_123|RECEIPT");
  assert.equal(receipt?.credits, 100);

  // Duplicate webhook delivery returns 200 duplicate without double grant
  const dupRes = await handler(event);
  assert.equal(dupRes.statusCode, 200);
  const dupData = JSON.parse(dupRes.body);
  assert.equal(dupData.duplicate, true);
  assert.equal(h.rows.get("USER#test-user-id|CREDITS")?.credits, 100);
});

test("Polar Webhook updates subscription tier on subscription.created and revokes on subscription.revoked", async () => {
  const h = harness();
  const { handler } = h.load("polar/index.ts");

  const subPayload = {
    type: "subscription.created",
    id: "evt_sub_1",
    data: {
      id: "sub_123",
      product_id: "polar_prod_pro",
      status: "active",
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
      metadata: { userId: "test-user-id", targetId: "pro" },
    },
  };

  const res = await handler({
    rawPath: "/polar/webhook",
    requestContext: { http: { method: "POST", path: "/polar/webhook", sourceIp: "127.0.0.1" }, requestId: "r4" },
    body: JSON.stringify(subPayload),
  });
  assert.equal(res.statusCode, 200);

  const subRow = h.rows.get("USER#test-user-id|SUBSCRIPTION");
  assert.equal(subRow?.tier, "pro");
  assert.equal(subRow?.status, "active");

  // Revoke subscription
  const revokePayload = {
    type: "subscription.revoked",
    id: "evt_sub_rev",
    data: {
      id: "sub_123",
      customer_metadata: { userId: "test-user-id" },
    },
  };

  const revokeRes = await handler({
    rawPath: "/polar/webhook",
    requestContext: { http: { method: "POST", path: "/polar/webhook", sourceIp: "127.0.0.1" }, requestId: "r5" },
    body: JSON.stringify(revokePayload),
  });
  assert.equal(revokeRes.statusCode, 200);

  const updatedSub = h.rows.get("USER#test-user-id|SUBSCRIPTION");
  assert.equal(updatedSub?.tier, "free");
  assert.equal(updatedSub?.status, "revoked");
});

test("Polar POST /polar/portal returns customer session portal URL", async () => {
  const h = harness();
  const { handler } = h.load("polar/index.ts");

  const res = await handler({
    rawPath: "/polar/portal",
    headers: { authorization: "Bearer valid-token" },
    requestContext: { http: { method: "POST", path: "/polar/portal", sourceIp: "127.0.0.1" }, requestId: "r6" },
  });

  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.ok(data.url.startsWith("https://polar.sh/portal/"));
});
