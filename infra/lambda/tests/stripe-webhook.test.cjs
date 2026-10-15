const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("../../../apps/web/node_modules/esbuild");
const Stripe = require("../node_modules/stripe");

const root = path.resolve(__dirname, "../src");
const secret = "whsec_test_only";
const key = (x) => `${x?.PK}|${x?.SK}`;

function harness(options = {}) {
  const rows = new Map(),
    calls = [];
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
  const stripe = {
    webhooks: Stripe.webhooks,
    subscriptions: {
      retrieve: async () =>
        options.sub || {
          id: "sub_a",
          status: "canceled",
          metadata: { userId: "user-a" },
          customer: "cus_a",
          items: { data: [] },
          current_period_end: 0,
        },
    },
    charges: { retrieve: async () => options.charge || { customer: "cus_a" } },
    customers: {
      retrieve: async () => ({ metadata: { userId: "user-a" } }),
      create: async () => ({ id: "cus_new" }),
    },
    checkout: {
      sessions: {
        retrieve: async () => options.session,
        create: async () => ({ url: "https://checkout.stripe.com", id: "cs_new" }),
      },
    },
    invoices: { retrieve: async () => options.invoice },
    prices: {
      retrieve: async (id) => ({
        id,
        active: true,
        currency: "try",
        unit_amount: 8900,
        ...options.price,
      }),
    },
    billingPortal: {
      sessions: { create: async () => ({ url: "https://billing.stripe.com/portal" }) },
    },
  };
  const external = {
    "@aws-sdk/client-dynamodb": {
      ...commands,
      DynamoDBClient: class {
        async send(command) {
          calls.push(command);
          if (options.outage) throw new Error("DB offline");
          const i = command.input;
          if (command.name === "GetItemCommand") return { Item: rows.get(key(i.Key)) };
          if (command.name === "QueryCommand") return { Items: [], Count: 0 };
          if (command.name === "UpdateItemCommand") {
            const k = key(i.Key);
            rows.set(k, { ...rows.get(k), ...i.Key });
          }
          return {};
        }
      },
    },
    "@aws-sdk/util-dynamodb": { marshall: (x) => x, unmarshall: (x) => x },
    stripe: class {
      constructor() {
        return stripe;
      }
    },
    "node:crypto": require("node:crypto"),
    "node:async_hooks": require("node:async_hooks"),
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
        AbortSignal,
        TextDecoder,
        URL,
        console,
        crypto: require("node:crypto").webcrypto,
        process: {
          env: {
            BILLING_ENABLED: "true",
            AWS_REGION: "eu-central-1",
            COGNITO_USER_POOL_ID: "eu-central-1_test",
            COGNITO_CLIENT_ID: "test-client",
            DYNAMODB_TABLE: "data",
            STRIPE_SECRET_KEY: "sk_test_fixture",
            STRIPE_WEBHOOK_SECRET: secret,
            STRIPE_PACK_STARTER_PRICE_ID: "price_pack",
            STRIPE_EXPLORER_PRICE_ID: "price_sub",
            APP_ORIGIN: "https://mapsbridge.com",
            BEDROCK_MODEL_ID: "model",
            ...options.env,
          },
        },
        fetch: async () => ({
          ok: !options.authFailure,
          json: async () => ({
            UserAttributes: [
              { Name: "sub", Value: "user-a" },
              { Name: "email_verified", Value: "true" },
            ],
          }),
        }),
        require(spec) {
          if (spec.startsWith(".")) return load(path.resolve(path.dirname(filename), spec + ".ts"));
          if (external[spec]) return external[spec];
          throw new Error("Unexpected dependency " + spec);
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

function http(reqPath, body = {}, extra = {}) {
  return {
    rawPath: reqPath,
    requestContext: { http: { method: "POST", path: reqPath } },
    headers: { authorization: "Bearer " + token(), "idempotency-key": "test_request_123456" },
    body: JSON.stringify(body),
    ...extra,
  };
}

function signed(type, object = {}, overrides = {}) {
  const body = JSON.stringify({
    id: "evt_test",
    created: Math.floor(Date.now() / 1000),
    type,
    data: { object },
  });
  return http(
    "/stripe/webhook",
    {},
    {
      body,
      headers: {
        "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload: body, secret }),
      },
      ...overrides,
    },
  );
}

test("OPTIONS preflight returns 200 without touching auth or data", async () => {
  const h = harness();
  const result = await h.load("stripe/index.ts").handler({
    requestContext: { http: { method: "OPTIONS", path: "/stripe/checkout" } },
    headers: {},
  });
  assert.equal(result.statusCode, 200);
  assert.equal(h.calls.length, 0);
});

test.skip("GET /stripe/plans returns enabled catalog with available products when billing is on (deprecated: using RevenueCat)", async () => {
  const h = harness();
  const result = await h.load("stripe/index.ts").handler({
    rawPath: "/stripe/plans",
    requestContext: { http: { method: "GET", path: "/stripe/plans" } },
    headers: {},
  });
  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.equal(body.enabled, true);
  assert.ok(Array.isArray(body.products));
  assert.ok(
    body.products.some((p) => p.available === true),
    "at least one product should be available when billing is enabled",
  );
  assert.equal(h.calls.length, 0);
});

test("GET /stripe/plans reports all products unavailable when billing is disabled", async () => {
  const h = harness({ env: { BILLING_ENABLED: "false" } });
  const result = await h.load("stripe/index.ts").handler({
    rawPath: "/stripe/plans",
    requestContext: { http: { method: "GET", path: "/stripe/plans" } },
    headers: {},
  });
  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.equal(body.enabled, false);
  assert.ok(body.products.every((p) => !p.available));
});

test("customer.subscription.deleted syncs subscription and issues UpdateItemCommands", async () => {
  const h = harness({
    sub: {
      id: "sub_a",
      status: "canceled",
      metadata: { userId: "user-a" },
      customer: "cus_a",
      items: { data: [] },
      current_period_end: 0,
    },
  });
  const result = await h
    .load("stripe/index.ts")
    .handler(signed("customer.subscription.deleted", { id: "sub_a" }));
  assert.equal(result.statusCode, 200);
  // syncSubscription calls bindCustomer (STRIPE_CUSTOMER update) + subscription update
  const updates = h.calls.filter((c) => c.name === "UpdateItemCommand");
  assert.ok(
    updates.length >= 1,
    "should issue at least one UpdateItemCommand to sync subscription state",
  );
  const subUpdate = updates.find((c) => c.input.Key?.SK === "SUBSCRIPTION");
  assert.ok(subUpdate, "subscription row should be updated");
  // A deleted subscription should sync to free tier
  assert.ok(subUpdate.input.UpdateExpression.includes(":tier"));
});

test("customer.subscription.created syncs the new subscription via the same path as updated", async () => {
  const h = harness({
    sub: {
      id: "sub_b",
      status: "active",
      metadata: { userId: "user-a" },
      customer: "cus_a",
      items: { data: [{ price: { id: "price_sub" } }] },
      current_period_end: Math.floor(Date.now() / 1000) + 86400,
    },
  });
  const result = await h
    .load("stripe/index.ts")
    .handler(signed("customer.subscription.created", { id: "sub_b" }));
  assert.equal(result.statusCode, 200);
  assert.ok(h.calls.some((c) => c.name === "UpdateItemCommand"));
});

test("charge.dispute.created freezes the wallet via object.charge field", async () => {
  const h = harness({ charge: { customer: "cus_a" } });
  h.rows.set("USER#user-a|STRIPE_CUSTOMER", {
    PK: "USER#user-a",
    SK: "STRIPE_CUSTOMER",
    customerId: "cus_a",
  });
  const result = await h
    .load("stripe/index.ts")
    .handler(signed("charge.dispute.created", { charge: "ch_a" }));
  assert.equal(result.statusCode, 200);
  const frozen = h.calls.find(
    (c) => c.name === "UpdateItemCommand" && c.input.Key?.SK === "CREDITS",
  );
  assert.ok(frozen, "CREDITS row should be frozen on dispute");
  assert.ok(frozen.input.UpdateExpression.includes("frozen"), "update must set frozen flag");
  assert.ok(
    frozen.input.UpdateExpression.includes("reviewEvent"),
    "update must record the event ID for reconciliation",
  );
});

test("charge.dispute.created uses object.charge instead of object.id unlike charge.refunded", async () => {
  const h = harness({ charge: { customer: "cus_a" } });
  h.rows.set("USER#user-a|STRIPE_CUSTOMER", {
    PK: "USER#user-a",
    SK: "STRIPE_CUSTOMER",
    customerId: "cus_a",
  });
  // object has charge field, not id — if the handler used object.id it would pass undefined to retrieve()
  const result = await h
    .load("stripe/index.ts")
    .handler(signed("charge.dispute.created", { charge: "ch_dispute", id: "dp_1" }));
  assert.equal(result.statusCode, 200);
  assert.ok(h.calls.some((c) => c.name === "UpdateItemCommand" && c.input.Key?.SK === "CREDITS"));
});

test("unhandled event type is silently accepted and returns 200 with no data writes", async () => {
  const h = harness();
  const result = await h
    .load("stripe/index.ts")
    .handler(signed("payment_intent.created", { id: "pi_test" }));
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).received, true);
  assert.equal(h.calls.length, 0);
});

test("POST /stripe/balance/topup returns 410 deprecated endpoint", async () => {
  const h = harness();
  const result = await h.load("stripe/index.ts").handler(http("/stripe/balance/topup", {}));
  assert.equal(result.statusCode, 410);
  // no writes: auth suspended-check read is fine but no mutations should occur
  assert.equal(
    h.calls.filter((c) =>
      ["PutItemCommand", "UpdateItemCommand", "TransactWriteItemsCommand"].includes(c.name),
    ).length,
    0,
  );
});

test("GET /stripe/wallet returns wallet for authenticated user", async () => {
  const h = harness();
  const result = await h.load("stripe/index.ts").handler({
    rawPath: "/stripe/wallet",
    requestContext: { http: { method: "GET", path: "/stripe/wallet" } },
    headers: { authorization: "Bearer " + token() },
  });
  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.ok(
    "credits" in body || "tier" in body,
    "wallet response should include credit/tier information",
  );
});

test("GET /stripe/subscription returns subscription for authenticated user", async () => {
  const h = harness();
  const result = await h.load("stripe/index.ts").handler({
    rawPath: "/stripe/subscription",
    requestContext: { http: { method: "GET", path: "/stripe/subscription" } },
    headers: { authorization: "Bearer " + token() },
  });
  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.ok("tier" in body, "subscription response should include a tier field");
});
