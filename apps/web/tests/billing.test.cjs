const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");
function harness(options = {}) {
  let owner = "token-a";
  const calls = [],
    map = new Map([
      ["mapsbridge.wallet", JSON.stringify({ credits: 999999, subscriptionTier: "agency" })],
    ]);
  const cache = new Map();
  function load(file) {
    const filename = path.resolve("app/lib/billing", file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    vm.runInNewContext(
      transformSync(readFileSync(filename, "utf8"), { loader: "ts", format: "cjs" }).code,
      {
        module,
        exports: module.exports,
        URL,
        crypto: require("node:crypto").webcrypto,
        process: { env: {} },
        localStorage: { getItem: (k) => map.get(k) || null, setItem: (k, v) => map.set(k, v) },
        CustomEvent: class {
          constructor(type, init) {
            this.type = type;
            this.detail = init.detail;
          }
        },
        window: { dispatchEvent() {}, location: { href: "" } },
        require(spec) {
          if (spec === "../cognito")
            return { getStoredSession: () => (owner ? { token: owner } : null) };
          if (spec === "../api-client")
            return {
              apiFetch: async (endpoint, opts) => {
                calls.push({ endpoint, opts });
                if (options.error) throw new Error("Service unavailable");
                return options.fetch
                  ? options.fetch(endpoint, opts)
                  : { credits: 20, tier: "explorer" };
              },
            };
          if (spec === "@mapsbridge/contracts") {
            const contractsPath = require.resolve("@mapsbridge/contracts");
            if (cache.has(contractsPath)) return cache.get(contractsPath).exports;
            const cmod = { exports: {} };
            cache.set(contractsPath, cmod);
            const { transformSync: ts2 } = require("esbuild");
            const cdir = path.dirname(contractsPath);
            vm.runInNewContext(
              ts2(require("fs").readFileSync(contractsPath, "utf8"), {
                loader: "ts",
                format: "cjs",
              }).code,
              {
                module: cmod,
                exports: cmod.exports,
                require(s) {
                  if (s.startsWith(".")) {
                    const abs = path.resolve(cdir, s.endsWith(".json") ? s : s + ".ts");
                    if (cache.has(abs)) return cache.get(abs).exports;
                    const m = { exports: {} };
                    cache.set(abs, m);
                    vm.runInNewContext(
                      ts2(require("fs").readFileSync(abs, "utf8"), { loader: "ts", format: "cjs" })
                        .code,
                      { module: m, exports: m.exports, require: () => ({}) },
                    );
                    return m.exports;
                  }
                  return {};
                },
              },
            );
            return cmod.exports;
          }
          if (spec.startsWith(".")) return load(path.resolve(path.dirname(filename), spec + ".ts"));
          throw new Error(spec);
        },
      },
    );
    return module.exports;
  }
  return { load, calls, map, setOwner: (value) => (owner = value) };
}
test("local wallet cannot grant credits, plan or fake transaction history", () => {
  const h = harness(),
    s = h.load("billing-service.ts").billingService;
  assert.equal(s.getWallet().credits, 0);
  assert.equal(s.getWallet().subscriptionTier, "free");
  assert.equal(s.getTransactions().length, 0);
  assert.throws(() => s.addCredits(1000, "forged"));
  assert.throws(() => s.saveWallet({ credits: 999 }));
  assert.equal(s.deductCredits(-100, "forged"), false);
  assert.equal(s.consumeActionCredits("ai_chat").success, false);
});
test("wallet loads from authenticated service and clears on account switch", async () => {
  const h = harness(),
    s = h.load("billing-service.ts").billingService;
  await s.refreshWallet();
  assert.equal(s.getWallet().credits, 20);
  h.setOwner("token-b");
  assert.equal(s.getWallet().credits, 0);
  assert.equal(s.getWallet().subscriptionTier, "free");
});
test("late account A wallet response cannot populate account B", async () => {
  let resolve;
  const h = harness({ fetch: () => new Promise((r) => (resolve = r)) }),
    s = h.load("billing-service.ts").billingService;
  const pending = s.refreshWallet();
  h.setOwner("token-b");
  resolve({ credits: 123, tier: "pro" });
  await pending;
  assert.equal(s.getWallet().credits, 0);
});
test("payment failure never falls back to simulated success or local grant", async () => {
  const h = harness({ error: true }),
    s = h.load("billing-service.ts").billingService;
  const result = await s.processCheckout({ mode: "credit_pack", targetId: "pack-starter" });
  assert.equal(result.success, false);
  assert.equal(s.getWallet().credits, 0);
});
test("checkout sends no card fields and requires a real Stripe redirect", async () => {
  const h = harness({ fetch: async () => ({ url: "https://checkout.stripe.com/c/pay" }) }),
    s = h.load("billing-service.ts").billingService;
  const result = await s.processCheckout({
    mode: "credit_pack",
    targetId: "pack-starter",
    cardNumber: "do-not-send",
    cardCvc: "123",
  });
  assert.equal(result.success, true);
  assert.equal(result.creditsAdded, undefined);
  assert.equal(result.stripeRedirectUrl, "https://checkout.stripe.com/c/pay");
  const body = JSON.parse(h.calls[0].opts.body);
  assert.equal(body.cardNumber, undefined);
  assert.equal(body.cardCvc, undefined);
  assert.ok(h.calls[0].opts.headers["idempotency-key"]);
  assert.equal(h.calls[0].endpoint, "/stripe/checkout");
});
test("unexpected redirect and unsupported payout/guide sale are not reported as success", async () => {
  const h = harness({ fetch: async () => ({ url: "https://attacker.invalid" }) }),
    s = h.load("billing-service.ts").billingService;
  assert.equal((await s.processCheckout({ mode: "subscription", targetId: "pro" })).success, false);
  assert.equal((await s.requestPayout(1000, "iban", "name")).success, false);
  assert.equal(s.buyMarketplaceRoute("id").success, false);
});
