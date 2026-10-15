const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { transformSync } = require("esbuild");
function harness(response) {
  const module = { exports: {} },
    calls = [];
  vm.runInNewContext(
    transformSync(
      fs.readFileSync(path.resolve(__dirname, "../../mobile/src/services/api.ts"), "utf8"),
      { loader: "ts", format: "cjs" },
    ).code,
    {
      module,
      exports: module.exports,
      console,
      crypto: require("node:crypto").webcrypto,
      require: () => ({ storage: { getItem: async () => null } }),
      fetch: async (url, init) => {
        calls.push({ url, body: JSON.parse(init.body) });
        if (response instanceof Error) throw response;
        return {
          ok: response.status === 200,
          status: response.status,
          json: async () => response.body,
        };
      },
    },
  );
  return { api: module.exports.aiService, calls };
}
test("mobile forwards the exact user request, consent and stable retry ID to the shared backend", async () => {
  const h = harness({
    status: 200,
    body: {
      responseMode: "clarify",
      orchestratorSummary: "Kaç gün?",
      clarification: { quickOptions: [{ label: "İki gün", prompt: "İki gün" }] },
    },
  });
  const context = {
    requestId: "stable_request_id",
    conversationId: "conversation_1234",
    trainingConsent: true,
  };
  const result = await h.api.ask("Roma için rota", context);
  await h.api.ask("Roma için rota", context);
  assert.equal(h.calls[0].body.prompt, "Roma için rota");
  assert.equal(h.calls[0].body.trainingConsent, true);
  assert.equal(h.calls[0].body.requestId, h.calls[1].body.requestId);
  assert.equal(result.isRoutePlan, false);
  assert.equal(result.clarification.quickOptions[0].prompt, "İki gün");
});
test("provider failure, insufficient credit and invalid coordinates never become a synthetic route", async () => {
  for (const response of [
    new Error("network"),
    { status: 402, body: { error: "Kredi yetersiz" } },
    {
      status: 200,
      body: { responseMode: "route", route: { stops: [{ name: "invalid", lat: 999, lng: 12 }] } },
    },
  ]) {
    await assert.rejects(() => harness(response).api.ask("Tokyo rota"));
  }
});
test("mobile retains zero coordinates, day and suggested duration from the verified route", async () => {
  const h = harness({
    status: 200,
    body: {
      responseMode: "route",
      orchestratorSummary: "Rota hazır",
      route: {
        estimatedDays: 2,
        stops: [
          {
            id: "verified",
            name: "Equator",
            lat: 0,
            lng: 0,
            day: 2,
            timeSlot: "morning",
            suggestedDuration: "45 dakika",
          },
        ],
      },
    },
  });
  const response = await h.api.ask("Rota");
  assert.equal(response.stops[0].lat, 0);
  assert.equal(response.stops[0].day, 2);
  assert.equal(response.stops[0].duration, "45 dakika");
});
