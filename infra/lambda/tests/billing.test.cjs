const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");
const Stripe = require("../node_modules/stripe");
const secret = "whsec_test_only";
const root = path.resolve(__dirname, "../src");
const clone = (x) => JSON.parse(JSON.stringify(x));
const key = (x) => `${x.PK}|${x.SK}`;
function harness(options = {}) {
  const rows = new Map(),
    calls = [],
    providerCalls = [];
  const names = [
    "GetItemCommand",
    "PutItemCommand",
    "UpdateItemCommand",
    "TransactWriteItemsCommand",
    "QueryCommand",
  ];
  const commands = Object.fromEntries(
    names.map((name) => [
      name,
      class {
        constructor(input) {
          this.name = name;
          this.input = input;
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
    if (c.includes("requests <")) return !old?.requests || old.requests < v[":limit"];
    if (c === "#version = :version") return old?.version === v[":version"];
    if (c === "#state = :reserved AND cost = :zero")
      return old?.state === v[":reserved"] && old?.cost === 0;
    if (c === "#state = :reserved") return old?.state === v[":reserved"];
    if (c.includes("customerId =")) return !old?.customerId || old.customerId === v[":id"];
    if (c.includes("eventTime <")) return !old?.eventTime || old.eventTime < v[":time"];
    throw new Error("Unimplemented DB condition " + c);
  }
  function apply(input) {
    const k = key(input.Item || input.Key),
      old = rows.get(k);
    if (input.Item) {
      rows.set(k, clone(input.Item));
      return;
    }
    const next = { ...input.Key, ...old },
      values = input.ExpressionAttributeValues || {},
      names = input.ExpressionAttributeNames || {};
    if (input.UpdateExpression.startsWith("ADD ")) {
      const [, field, value] = input.UpdateExpression.split(" ");
      next[field] = (next[field] || 0) + values[value];
    } else
      for (const assignment of input.UpdateExpression.slice(4).split(",")) {
        const [field, value] = assignment.trim().split(" = ");
        next[names[field] || field] = values[value];
      }
    rows.set(k, clone(next));
  }
  const stripe = {
    prices: {
      retrieve: async (id) => ({
        id,
        active: true,
        currency: "try",
        unit_amount: 8900,
        ...options.price,
      }),
    },
    customers: {
      create: async () => ({ id: "cus_a" }),
      retrieve: async () => ({ metadata: { userId: "user-a" } }),
    },
    checkout: {
      sessions: {
        create: async (data, opts) => {
          providerCalls.push({ data, opts });
          return { url: "https://checkout.stripe.com/c/pay", id: "cs_new" };
        },
        retrieve: async () => options.session,
      },
    },
    billingPortal: {
      sessions: {
        create: async (data) => {
          providerCalls.push({ data });
          return { url: "https://billing.stripe.com/p/session" };
        },
      },
    },
    subscriptions: { retrieve: async () => options.sub },
    invoices: { retrieve: async () => options.invoice },
    charges: { retrieve: async () => options.charge },
    webhooks: Stripe.webhooks,
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
          if (command.name === "QueryCommand") return { Items: [], Count: options.routeCount || 0 };
          const ops =
            command.name === "TransactWriteItemsCommand"
              ? i.TransactItems.map((o) => o.Put || o.Update || o.ConditionCheck)
              : [i];
          const checks = ops.map((o) => allowed(o, rows.get(key(o.Item || o.Key))));
          if (checks.some((x) => !x))
            throw Object.assign(new Error("condition"), {
              name:
                command.name === "TransactWriteItemsCommand"
                  ? "TransactionCanceledException"
                  : "ConditionalCheckFailedException",
              CancellationReasons: checks.map((ok) => ({
                Code: ok ? "None" : "ConditionalCheckFailed",
              })),
            });
          if (options.failTransaction && command.name === "TransactWriteItemsCommand")
            throw new Error("Simulated transaction failure");
          ops.filter((o) => o.Item || o.UpdateExpression).forEach(apply);
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
    if (filename.endsWith("/app/lib/ai/supervisor.ts"))
      return {
        runMultiAgentSupervisor: async (payload, beforePaid) => {
          if (options.mode !== "clarify") await beforePaid?.(options.mode === "chat" ? 1 : 5);
          providerCalls.push({ model: true, payload });
          if (options.aiFailure) throw new Error("Model timeout");
          return {
            provider: "aws_bedrock",
            orchestratorSummary: "Trip ready",
            responseMode: options.mode || "route",
            preferenceUpdates: options.preferences || {},
            ...(options.mode === "clarify" || options.mode === "chat"
              ? {}
              : { route: { title: "Trip" } }),
            ...(options.conversationState ? { conversationState: options.conversationState } : {}),
          };
        },
      };
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
            STRIPE_PRO_PRICE_ID: "price_pro",
            STRIPE_AGENCY_PRICE_ID: "price_agency",
            STRIPE_PACK_POPULAR_PRICE_ID: "price_pop",
            STRIPE_PACK_MASTER_PRICE_ID: "price_master",
            STRIPE_PACK_PRO_PRICE_ID: "price_pro_pack",
            RC_SECRET_API_KEY: "sk_test_rc",
            RC_WEBHOOK_AUTH_SECRET: "webhook_secret",
            APP_ORIGIN: "https://mapsbridge.com",
            BEDROCK_MODEL_ID: "model",
            BILLING_ENABLED: "true",
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
  return { load, rows, calls, providerCalls };
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
function http(path, body = {}, extra = {}) {
  return {
    rawPath: path,
    requestContext: { http: { method: "POST", path } },
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
const session = {
  id: "cs_paid",
  mode: "payment",
  payment_status: "paid",
  client_reference_id: "user-a",
  metadata: { userId: "user-a", productId: "pack-starter" },
  customer: "cus_a",
  currency: "try",
  amount_total: 8900,
  line_items: { data: [{ quantity: 1, price: { id: "price_pack" } }] },
};

test("webhook rejects missing, forged, modified and stale signatures without writes", async () => {
  for (const change of [
    { headers: {} },
    { headers: { "stripe-signature": "t=0,v1=bad" } },
    { body: "{}" },
  ]) {
    const h = harness({ session });
    assert.equal(
      (await h.load("stripe/index.ts").handler(signed("checkout.session.completed", {}, change)))
        .statusCode,
      400,
    );
    assert.equal(h.calls.length, 0);
  }
  const e = signed("checkout.session.completed");
  e.headers["stripe-signature"] = Stripe.webhooks.generateTestHeaderString({
    payload: e.body,
    secret,
    timestamp: 1,
  });
  const h = harness();
  assert.equal((await h.load("stripe/index.ts").handler(e)).statusCode, 400);
  assert.equal(h.calls.length, 0);
});
test.skip("valid raw and base64 Stripe webhook grants once across different event deliveries (deprecated: using RevenueCat)", async () => {
  const h = harness({ session }),
    handler = h.load("stripe/index.ts").handler,
    e = signed("checkout.session.completed", { id: session.id });
  assert.equal((await handler(e)).statusCode, 200);
  assert.equal(
    (await handler({ ...e, body: Buffer.from(e.body).toString("base64"), isBase64Encoded: true }))
      .statusCode,
    200,
  );
  assert.equal(
    (await handler(signed("checkout.session.async_payment_succeeded", { id: session.id })))
      .statusCode,
    200,
  );
  assert.equal(h.rows.get("USER#user-a|CREDITS").credits, 50);
  assert.equal([...h.rows.keys()].filter((k) => k.endsWith("|RECEIPT")).length, 1);
});
test("unpaid and mismatched checkout never grant credits", async () => {
  for (const change of [
    { payment_status: "unpaid" },
    { amount_total: 1 },
    { currency: "usd" },
    { metadata: { userId: "attacker", productId: "pack-starter" } },
    { line_items: { data: [{ quantity: 2, price: { id: "price_pack" } }] } },
  ]) {
    const h = harness({ session: { ...session, ...change } });
    await h
      .load("stripe/index.ts")
      .handler(signed("checkout.session.completed", { id: "cs_paid" }));
    assert.equal(h.rows.has("USER#user-a|CREDITS"), false);
  }
});
test("failed atomic payment transaction cannot leave a receipt without credits", async () => {
  const h = harness({ session, failTransaction: true });
  assert.equal(
    (
      await h
        .load("stripe/index.ts")
        .handler(signed("checkout.session.completed", { id: "cs_paid" }))
    ).statusCode,
    503,
  );
  assert.equal(
    [...h.rows.keys()].some((k) => k.endsWith("|RECEIPT")),
    false,
  );
  assert.equal(h.rows.has("USER#user-a|CREDITS"), false);
});
test("unsigned old queue messages are retried instead of creating entitlement", async () => {
  const h = harness();
  const result = await h.load("stripe/index.ts").handler({
    Records: [{ messageId: "old", body: JSON.stringify({ type: "payment_intent.succeeded" }) }],
  });
  assert.equal(result.batchItemFailures[0].itemIdentifier, "old");
  assert.equal(h.calls.length, 0);
});
test.skip("checkout accepts only configured product and server origin; ignores user/amount/card data (deprecated: using RevenueCat)", async () => {
  const h = harness();
  const handler = h.load("stripe/index.ts").handler;
  assert.equal(
    (await handler(http("/stripe/checkout", { priceId: "price_attacker" }))).statusCode,
    400,
  );
  assert.equal(
    (
      await handler(
        http("/stripe/checkout", {
          mode: "credit_pack",
          targetId: "pack-starter",
          amount: 1,
          userId: "user-b",
          successUrl: "https://attacker.invalid",
          cardNumber: "secret",
        }),
      )
    ).statusCode,
    201,
  );
  const call = h.providerCalls[0];
  assert.equal(call.data.client_reference_id, "user-a");
  assert.equal(call.data.line_items[0].price, "price_pack");
  assert.equal(
    call.data.success_url,
    "https://mapsbridge.com/odeme/?success=true&session_id={CHECKOUT_SESSION_ID}",
  );
  assert.equal(JSON.stringify(call).includes("secret"), false);
  assert.equal(call.opts.idempotencyKey, "user-a:test_request_123456");
});
test("misconfigured price, yearly cycle, missing idempotency and placeholder key fail closed", async () => {
  for (const [opts, body, headers] of [
    [{ price: { unit_amount: 1 } }, { mode: "credit_pack", targetId: "pack-starter" }],
    [{}, { mode: "credit_pack", targetId: "pack-starter", cycle: "yearly" }],
    [{}, { mode: "credit_pack", targetId: "pack-starter" }, { authorization: "Bearer " + token() }],
    [
      { env: { STRIPE_SECRET_KEY: "sk_test_placeholder" } },
      { mode: "credit_pack", targetId: "pack-starter" },
    ],
  ]) {
    const h = harness(opts),
      result = await h
        .load("stripe/index.ts")
        .handler(http("/stripe/checkout", body, headers ? { headers } : {}));
    assert.ok(result.statusCode >= 400);
    assert.equal(h.providerCalls.length, 0);
  }
});
test("one remaining AI allowance under concurrency permits only one reservation", async () => {
  const h = harness(),
    service = h.load("billing/store.ts");
  await service.initializeTrial("user-a");
  h.rows.set("USER#user-a|CREDITS", { PK: "USER#user-a", SK: "CREDITS", credits: 5 });
  const results = await Promise.allSettled([
    service.reserveAI("user-a", "request_123456789_a", "a"),
    service.reserveAI("user-a", "request_123456789_b", "b"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(h.rows.get("USER#user-a|CREDITS").credits, 0);
});
test("retry cannot spend twice; refund is atomic and only once", async () => {
  const h = harness(),
    s = h.load("billing/store.ts");
  await s.initializeTrial("user-a");
  const r = await s.reserveAI("user-a", "request_123456789_a", "a");
  await assert.rejects(s.reserveAI("user-a", r.requestId, "different"), (e) => e.status === 409);
  await s.finishAI(r, false);
  await s.finishAI(r, false);
  assert.equal(h.rows.get("USER#user-a|CREDITS").credits, 100);
  await assert.rejects(s.reserveAI("user-a", r.requestId, "a"), (e) => e.status === 409);
  await s.initializeTrial("user-a");
  assert.equal(h.rows.get("USER#user-a|CREDITS").credits, 100);
});
test("completed usage cannot be refunded by a late failure", async () => {
  const h = harness(),
    s = h.load("billing/store.ts");
  await s.initializeTrial("user-a");
  const r = await s.reserveAI("user-a", "request_123456789_a", "a");
  await s.finishAI(r, true);
  await assert.rejects(s.finishAI(r, false));
  assert.equal(h.rows.get("USER#user-a|CREDITS").credits, 95);
});
test("global limit blocks other users atomically without debiting them", async () => {
  const h = harness({ env: { AI_DAILY_REQUEST_LIMIT: "1" } }),
    s = h.load("billing/store.ts");
  await s.initializeTrial("user-a");
  await s.initializeTrial("user-b");
  await s.reserveAI("user-a", "request_123456789_a", "a");
  await assert.rejects(s.reserveAI("user-b", "request_123456789_b", "b"), (e) => e.status === 429);
  assert.equal(h.rows.get("USER#user-b|CREDITS").credits, 100);
});
test("wallet isolation and expired entitlement ignore fabricated client tier", async () => {
  const h = harness(),
    s = h.load("billing/store.ts");
  h.rows.set("USER#user-a|CREDITS", { credits: 25 });
  h.rows.set("USER#user-a|SUBSCRIPTION", {
    tier: "agency",
    status: "active",
    currentPeriodEnd: "2000-01-01",
  });
  assert.equal((await s.wallet("user-a")).tier, "free");
  assert.equal((await s.wallet("user-b")).credits, 0);
});
test("missing table, disabled AI and DB outage never allow usage", async () => {
  for (const options of [
    { env: { DYNAMODB_TABLE: "" } },
    { env: { AI_DAILY_REQUEST_LIMIT: "0" } },
    { outage: true },
  ]) {
    const h = harness(options);
    await assert.rejects(
      h.load("billing/store.ts").reserveAI("user-a", "request_123456789_a", "a"),
    );
    assert.equal(h.rows.size, 0);
  }
});
test("refund/dispute freezes subsequent spending until reviewed", async () => {
  const h = harness({ charge: { customer: "cus_a" } }),
    s = h.load("billing/store.ts");
  await s.initializeTrial("user-a");
  h.rows.set("USER#user-a|STRIPE_CUSTOMER", { customerId: "cus_a" });
  assert.equal(
    (await h.load("stripe/index.ts").handler(signed("charge.refunded", { id: "ch_a" }))).statusCode,
    200,
  );
  await assert.rejects(
    s.reserveAI("user-a", "request_123456789_a", "a"),
    (e) => e.status === 403 && e.code === "WALLET_FROZEN",
  );
  assert.equal((await s.wallet("user-a")).frozen, true);
});

test("canonical AI endpoint requires verified email and charges server cost, ignoring client tier/action", async () => {
  const h = harness(),
    handler = h.load("../../../apps/web/server/ai-handler.ts").handler;
  const request = http("/ai/route-planner", {
    prompt: "Istanbul trip",
    requestId: "request_123456789_a",
    tier: "agency",
    action: "ai_chat",
    userEmail: "attacker",
  });
  const result = await handler(request);
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).billing.cost, 5);
  assert.equal(h.rows.get("USER#user-a|CREDITS").credits, 95);
  const replay = await handler(request);
  assert.equal(replay.statusCode, 200);
  assert.equal(JSON.parse(replay.body).replayed, true);
  assert.equal(h.providerCalls.filter((x) => x.model).length, 1);
  assert.equal(h.rows.get("USER#user-a|CREDITS").credits, 95);
});
test("AI provider failure refunds credits once but consumes daily attempt", async () => {
  const h = harness({ aiFailure: true }),
    handler = h.load("../../../apps/web/server/ai-handler.ts").handler;
  const e = http("/ai/route-planner", { prompt: "Trip", requestId: "request_123456789_a" });
  assert.equal((await handler(e)).statusCode, 503);
  assert.equal(h.rows.get("USER#user-a|CREDITS").credits, 100);
  assert.equal((await handler(e)).statusCode, 409);
  assert.equal(h.rows.get("USER#user-a|CREDITS").credits, 100);
  assert.equal(h.rows.get("SYSTEM#AI|" + new Date().toISOString().slice(0, 10)).requests, 1);
});
test.skip("paid recurring invoice grants once and subscription events do not refill credits (deprecated: using RevenueCat)", async () => {
  const sub = {
    id: "sub_a",
    metadata: { userId: "user-a" },
    customer: "cus_a",
    status: "active",
    current_period_end: Math.floor(Date.now() / 1000) + 86400,
    items: { data: [{ price: { id: "price_sub" } }] },
  };
  const invoice = {
    id: "in_a",
    paid: true,
    status: "paid",
    subscription: "sub_a",
    customer: "cus_a",
    billing_reason: "subscription_cycle",
    currency: "try",
    amount_paid: 19900,
    lines: {
      data: [{ type: "subscription", proration: false, quantity: 1, price: { id: "price_sub" } }],
    },
  };
  const h = harness({ sub, invoice }),
    handler = h.load("stripe/index.ts").handler;
  assert.equal(
    (await handler(signed("customer.subscription.updated", { id: "sub_a" }))).statusCode,
    200,
  );
  assert.equal(h.rows.has("USER#user-a|CREDITS"), false);
  assert.equal((await handler(signed("invoice.paid", { id: "in_a" }))).statusCode, 200);
  assert.equal((await handler(signed("invoice.paid", { id: "in_a" }))).statusCode, 200);
  assert.equal(h.rows.get("USER#user-a|CREDITS").credits, 100);
});

test("AI preferences persist on the verified account and reach the next request", async () => {
  const h = harness({
      mode: "chat",
      preferences: { pace: "Sakin", interests: ["tarih"], email: "discard-me" },
    }),
    handler = h.load("../../../apps/web/server/ai-handler.ts").handler;
  h.rows.set("USER#user-a|AI_PREFERENCES", {
    PK: "USER#user-a",
    SK: "AI_PREFERENCES",
    budget: "Ekonomik",
  });
  const e = http("/ai/route-planner", {
    prompt: "Tarihi severim",
    requestId: "memory_request_12345",
    userEmail: "other-user",
    preferences: { budget: "Esnek" },
  });
  assert.equal((await handler(e)).statusCode, 200);
  assert.equal(h.providerCalls[0].payload.preferences.budget, "Ekonomik");
  const saved = h.rows.get("USER#user-a|AI_PREFERENCES");
  assert.equal(saved.pace, "Sakin");
  assert.equal(saved.budget, "Ekonomik");
  assert.equal(saved.email, undefined);
  assert.equal(
    (
      await handler(
        http("/ai/route-planner", { prompt: "Roma", requestId: "memory_request_67890" }),
      )
    ).statusCode,
    200,
  );
  assert.equal(h.providerCalls[1].payload.preferences.pace, "Sakin");
});
test("forgetting preferences is free and ignores a client supplied account", async () => {
  const h = harness(),
    handler = h.load("../../../apps/web/server/ai-handler.ts").handler;
  h.rows.set("USER#other|AI_PREFERENCES", { pace: "Sakin" });
  h.rows.set("USER#user-a|AI_PREFERENCES", { pace: "Yoğun" });
  assert.equal(
    (await handler(http("/ai/route-planner", { action: "forgetPreferences", userEmail: "other" })))
      .statusCode,
    200,
  );
  assert.equal(h.rows.get("USER#user-a|AI_PREFERENCES").pace, undefined);
  assert.equal(h.rows.get("USER#other|AI_PREFERENCES").pace, "Sakin");
  assert.equal(h.providerCalls.length, 0);
});
test("reusing a completed ID with a changed prompt cannot replay another answer", async () => {
  const h = harness(),
    handler = h.load("../../../apps/web/server/ai-handler.ts").handler;
  const body = { prompt: "Istanbul", requestId: "replay_request_12345" };
  assert.equal((await handler(http("/ai/route-planner", body))).statusCode, 200);
  assert.equal(
    (await handler(http("/ai/route-planner", { ...body, prompt: "Roma" }))).statusCode,
    409,
  );
  assert.equal(h.providerCalls.length, 1);
});

test("clarification is free, chat costs one and route costs five regardless of client cost", async () => {
  for (const [mode, cost] of [
    ["clarify", 0],
    ["chat", 1],
    ["route", 5],
  ]) {
    const h = harness({ mode });
    const handler = h.load("../../../apps/web/server/ai-handler.ts").handler;
    const event = http("/ai/route-planner", {
      prompt: "Birlikte planlayalım",
      requestId: "new_pricing_123456",
      cost: 0,
    });
    const first = await handler(event);
    assert.equal(first.statusCode, 200);
    assert.equal(JSON.parse(first.body).cost, cost);
    assert.equal(h.rows.get("USER#user-a|CREDITS").credits, 100 - cost);
    const again = await handler(event);
    assert.equal(JSON.parse(again.body).replayed, true);
    assert.equal(h.rows.get("USER#user-a|CREDITS").credits, 100 - cost);
  }
});
test("insufficient settlement credit cannot commit answer or conversation", async () => {
  const h = harness(),
    s = h.load("billing/store.ts");
  h.rows.set("USER#user-a|CREDITS", { PK: "USER#user-a", SK: "CREDITS", credits: 1 });
  const r = await s.reserveAI("user-a", "settlement_123456", "a", 0);
  await assert.rejects(
    s.finishAI(r, true, {
      response: {},
      finalCost: 5,
      conversation: { id: "conversation_123456", expectedVersion: 0, value: { version: 1 } },
    }),
    (e) => e.code === "INSUFFICIENT_CREDITS",
  );
  assert.equal(h.rows.has("USER#user-a|AI_CHAT#conversation_123456"), false);
  await s.finishAI(r, false);
  assert.equal(h.rows.get("USER#user-a|CREDITS").credits, 1);
});
test("concurrent conversation update is atomic with credits and answer", async () => {
  const h = harness(),
    s = h.load("billing/store.ts");
  h.rows.set("USER#user-a|CREDITS", { PK: "USER#user-a", SK: "CREDITS", credits: 10 });
  const r = await s.reserveAI("user-a", "versioned_1234567", "a", 0);
  await s.authorizeAI(r, 1);
  h.rows.set("USER#user-a|AI_CHAT#conversation_123456", {
    PK: "USER#user-a",
    SK: "AI_CHAT#conversation_123456",
    version: 2,
  });
  await assert.rejects(
    s.finishAI(r, true, {
      response: {},
      finalCost: 1,
      conversation: { id: "conversation_123456", expectedVersion: 1, value: { version: 2 } },
    }),
    (e) => e.code === "CONVERSATION_CHANGED",
  );
  assert.equal(h.rows.get("USER#user-a|CREDITS").credits, 9);
});
test("zero-credit account can clarify but cannot pay for a completed route", async () => {
  const h = harness(),
    s = h.load("billing/store.ts");
  h.rows.set("USER#user-a|CREDITS", { PK: "USER#user-a", SK: "CREDITS", credits: 0 });
  const r = await s.reserveAI("user-a", "free_clarify_123456", "a", 0);
  await s.finishAI(r, true, { response: {}, finalCost: 0 });
  assert.equal(h.rows.get("USER#user-a|CREDITS").credits, 0);
});

test("insufficient credit blocks paid provider before generation", async () => {
  const h = harness();
  h.rows.set("USER#user-a|CREDITS", { PK: "USER#user-a", SK: "CREDITS", credits: 0 });
  const result = await h
    .load("../../../apps/web/server/ai-handler.ts")
    .handler(
      http("/ai/route-planner", { prompt: "Paris 3 gün", requestId: "no_credit_123456789" }),
    );
  assert.equal(result.statusCode, 402);
  assert.equal(h.providerCalls.filter((x) => x.model).length, 0);
  assert.equal(h.rows.get("USER#user-a|CREDITS").credits, 0);
});
test("welcome gift is 100 credits once and preserves existing balances", async () => {
  const h = harness(),
    s = h.load("billing/store.ts");
  await s.initializeTrial("new");
  await s.initializeTrial("new");
  assert.equal((await s.wallet("new")).credits, 100);
  assert.equal((await s.wallet("new")).welcomeGift.credits, 100);
  h.rows.set("USER#old|CREDITS", { credits: 87 });
  await s.initializeTrial("old");
  assert.equal((await s.wallet("old")).credits, 87);
});
test("closed billing cannot initiate payment and catalog reports unavailable", async () => {
  const h = harness({ env: { BILLING_ENABLED: "false" } }),
    handler = h.load("stripe/index.ts").handler;
  assert.equal(
    (await handler(http("/stripe/checkout", { mode: "credit_pack", targetId: "pack-starter" })))
      .statusCode,
    503,
  );
  const response = await handler(
    http("/stripe/plans", {}, { requestContext: { http: { method: "GET" } }, headers: {} }),
  );
  assert.equal(
    JSON.parse(response.body).products.every((p) => !p.available),
    true,
  );
  assert.equal(h.providerCalls.length, 0);
});
test.skip("checkout status cannot reveal another user payment (deprecated: using RevenueCat)", async () => {
  const h = harness({ session: { client_reference_id: "user-b", metadata: { userId: "user-b" } } });
  const r = await h.load("stripe/index.ts").handler(
    http(
      "/stripe/session",
      {},
      {
        requestContext: { http: { method: "GET" } },
        queryStringParameters: { session_id: "cs_test_123456789" },
      },
    ),
  );
  assert.equal(r.statusCode, 404);
});
test("concurrent paid authorizations cannot overspend", async () => {
  const h = harness(),
    s = h.load("billing/store.ts");
  await s.initializeTrial("user-a");
  // Restrict to 5 credits so only one 5-credit authorization can succeed
  h.rows.set("USER#user-a|CREDITS", { PK: "USER#user-a", SK: "CREDITS", credits: 5 });
  const a = await s.reserveAI("user-a", "authorize_request_a", "a", 0),
    b = await s.reserveAI("user-a", "authorize_request_b", "b", 0);
  const results = await Promise.allSettled([s.authorizeAI(a, 5), s.authorizeAI(b, 5)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await s.wallet("user-a")).credits, 0);
});
test("refund uses durable receipt even when caller lost updated cost", async () => {
  const h = harness(),
    s = h.load("billing/store.ts");
  await s.initializeTrial("user-a");
  const r = await s.reserveAI("user-a", "durable_refund_123", "a", 0);
  await s.authorizeAI(r, 5);
  await s.finishAI({ ...r, cost: 0 }, false);
  await s.finishAI({ ...r, cost: 0 }, false);
  assert.equal((await s.wallet("user-a")).credits, 100);
});

test("AI rejects unsigned JWT, plaintext email and arbitrary sessions when identity validation fails", async () => {
  const forged = [
    "header",
    Buffer.from(JSON.stringify({ sub: "user-a", email: "victim@example.com" })).toString(
      "base64url",
    ),
    "unsigned",
  ].join(".");
  for (const value of [forged, "victim@example.com", "arbitrary-session-token", token()]) {
    const h = harness({ authFailure: true });
    const result = await h
      .load("../../../apps/web/server/ai-handler.ts")
      .handler(
        http(
          "/ai/route-planner",
          { prompt: "Roma", requestId: "auth_reject_123456" },
          { headers: { authorization: "Bearer " + value } },
        ),
      );
    assert.equal(result.statusCode, 401);
    assert.equal(h.calls.length, 0);
    assert.equal(h.providerCalls.length, 0);
  }
});
test("idempotency binds location and manifesto as well as prompt", async () => {
  for (const change of [
    { userLocation: { lat: 40, lng: 29 } },
    { tripManifestoMarkdown: "Changed itinerary" },
  ]) {
    const h = harness(),
      handler = h.load("../../../apps/web/server/ai-handler.ts").handler;
    const body = { prompt: "Roma 3 gün", requestId: "context_bound_123456" };
    assert.equal((await handler(http("/ai/route-planner", body))).statusCode, 200);
    assert.equal(
      (await handler(http("/ai/route-planner", { ...body, ...change }))).statusCode,
      409,
    );
    assert.equal(h.providerCalls.filter((c) => c.model).length, 1);
  }
});
test("memory opt-in atomically commits outbox with answer and credit", async () => {
  const h = harness({
    mode: "chat",
    preferences: { pace: "Sakin" },
    env: {
      AI_MEMORY_TABLE: "memory",
      AGENTCORE_MEMORY_ID: "travel-1234567890",
      MEMORY_WRITE_ENABLED: "true",
    },
  });
  h.rows.set("USER#user-a|SETTINGS", {
    PK: "USER#user-a",
    SK: "SETTINGS",
    enabled: true,
    version: 1,
    generation: "generation-a",
    changedAt: new Date().toISOString(),
  });
  const result = await h.load("../../../apps/web/server/ai-handler.ts").handler(
    http("/ai/route-planner", {
      prompt: "Genelde sakin gezerim",
      requestId: "memory_write_123456",
    }),
  );
  assert.equal(result.statusCode, 200);
  const commit = h.calls.find(
    (c) =>
      c.name === "TransactWriteItemsCommand" &&
      c.input.TransactItems.some((o) => o.Put?.Item.SK === "OUTBOX#memory_write_123456"),
  );
  assert.ok(commit);
  assert.ok(commit.input.TransactItems.some((o) => o.ConditionCheck));
  const job = h.rows.get("USER#user-a|OUTBOX#memory_write_123456");
  assert.equal(job.generation, "generation-a");
  assert.equal(job.payload.includes("Genelde sakin gezerim"), false);
});
test("memory remains off without explicit opt-in and rejects invalid coordinates", async () => {
  const h = harness({
    mode: "chat",
    preferences: { pace: "Sakin" },
    env: {
      AI_MEMORY_TABLE: "memory",
      AGENTCORE_MEMORY_ID: "travel-1234567890",
      MEMORY_WRITE_ENABLED: "true",
    },
  });
  const handler = h.load("../../../apps/web/server/ai-handler.ts").handler;
  assert.equal(
    (
      await handler(
        http("/ai/route-planner", {
          prompt: "Genelde sakin gezerim",
          requestId: "memory_off_123456",
        }),
      )
    ).statusCode,
    200,
  );
  assert.equal(
    [...h.rows.keys()].some((k) => k.includes("OUTBOX#")),
    false,
  );
  assert.equal(h.rows.has("USER#user-a|AI_PREFERENCES"), false);
  assert.equal(
    (
      await handler(
        http("/ai/route-planner", {
          prompt: "Roma",
          requestId: "bad_location_123456",
          userLocation: { lat: 999, lng: 12 },
        }),
      )
    ).statusCode,
    400,
  );
});

test("admin AI kill switch prevents model execution and credit reservation", async () => {
  const h = harness();
  h.rows.set("SYSTEM#AI_CONTROL|META", {
    PK: "SYSTEM#AI_CONTROL",
    SK: "META",
    enabled: false,
    defaultModel: "model",
    disabledModels: [],
    version: 1,
  });
  const response = await h
    .load("../../../apps/web/server/ai-handler.ts")
    .handler(
      http("/ai/route-planner", { prompt: "Roma gezisi planla", requestId: "ai_disabled_123456" }),
    );
  assert.equal(response.statusCode, 503);
  assert.equal(h.providerCalls.filter((call) => call.model).length, 0);
  assert.equal(h.rows.has("USER#user-a|AI#ai_disabled_123456"), false);
  assert.ok(
    h.rows.has("SYSTEM#AI_RUNTIME|META"),
    "disabled runtime can still publish its catalog so administrators can re-enable it",
  );
});

test("AI request telemetry records failures without conversation content", async () => {
  const h = harness({ aiFailure: true });
  const response = await h
    .load("../../../apps/web/server/ai-handler.ts")
    .handler(
      http("/ai/route-planner", { prompt: "Roma gezisi planla", requestId: "ai_failed_12345678" }),
    );
  assert.equal(response.statusCode, 503);
  const operations = [...h.rows.values()].filter((row) => row.PK === "AI#OPERATIONS");
  assert.equal(operations.length, 1);
  assert.equal(operations[0].status, "failed");
  assert.equal(operations[0].errorCode, "AI_RESULT_UNCONFIRMED");
  assert.equal(JSON.stringify(operations).includes("Roma"), false);
  assert.equal(JSON.stringify(operations).includes("user-a"), false);
});

test("training requires per-turn consent and feature flag; replay neither duplicates nor changes consent", async () => {
  for (const [enabled, consent] of [
    ["false", true],
    ["true", false],
    ["true", undefined],
    ["true", true],
  ]) {
    const h = harness({ mode: "chat", env: { AI_TRAINING_COLLECTION_ENABLED: enabled } });
    const handler = h.load("../../../apps/web/server/ai-handler.ts").handler;
    const body = {
      prompt: "Roma için user@example.com adresime öneri",
      requestId: "training_turn_123456",
      trainingConsent: consent,
    };
    const first = await handler(http("/ai/route-planner", body));
    assert.equal(first.statusCode, 200);
    const jobs = [...h.rows.values()].filter((r) => r.PK === "AI#TRAINING_PENDING");
    assert.equal(jobs.length, enabled === "true" && consent === true ? 1 : 0);
    if (jobs.length) {
      assert.equal(jobs[0].record.reviewed, false);
      assert.equal(jobs[0].record.containsPersonalData, true);
      assert.equal(JSON.stringify(jobs).includes("user@example.com"), false);
      assert.equal(JSON.stringify(jobs).includes("user-a"), false);
      const transaction = h.calls.find((c) =>
        c.input.TransactItems?.some((o) => o.Put?.Item.PK === "AI#TRAINING_PENDING"),
      );
      assert.ok(
        transaction.input.TransactItems.some((o) => o.Update?.Key.SK === "AI#training_turn_123456"),
      );
    }
    assert.equal((await handler(http("/ai/route-planner", body))).statusCode, 200);
    assert.equal(
      [...h.rows.values()].filter((r) => r.PK === "AI#TRAINING_PENDING").length,
      jobs.length,
    );
    assert.equal(
      (await handler(http("/ai/route-planner", { ...body, trainingConsent: consent !== true })))
        .statusCode,
      409,
    );
  }
});
test("invalid training consent is rejected; unsuccessful model results are never collected", async () => {
  const h = harness({ aiFailure: true, env: { AI_TRAINING_COLLECTION_ENABLED: "true" } });
  const handler = h.load("../../../apps/web/server/ai-handler.ts").handler;
  const body = { prompt: "Roma planı", requestId: "training_fail_123456", trainingConsent: true };
  assert.equal(
    (await handler(http("/ai/route-planner", { ...body, trainingConsent: "true" }))).statusCode,
    400,
  );
  assert.equal((await handler(http("/ai/route-planner", body))).statusCode, 503);
  assert.equal(
    [...h.rows.values()].some((r) => r.PK === "AI#TRAINING_PENDING"),
    false,
  );
});
