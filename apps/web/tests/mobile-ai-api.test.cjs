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
      AbortController,
      setTimeout,
      clearTimeout,
      require: () => ({ storage: { getItem: async () => null } }),
      fetch: async (url, init) => {
        calls.push({ url, body: JSON.parse(init.body), signal: init.signal });
        if (response instanceof Error) throw response;
        return {
          ok: response.status === 200,
          status: response.status,
          json: async () => response.body,
        };
      },
    },
  );
  return { api: module.exports.aiService, calls, mod: module.exports };
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
test("4.1: mobil API varsayılanı canlı host; ölü eski host repoda yok, app.config extra.apiBaseUrl eşit", async () => {
  const h = harness({ status: 200, body: { responseMode: "clarify", orchestratorSummary: "?" } });
  const live = "https://pwi1j8mq0j.execute-api.eu-central-1.amazonaws.com";
  assert.equal(h.mod.API_BASE, live);
  await h.api.ask("Roma");
  assert.ok(h.calls[0].url.startsWith(live), h.calls[0].url);
  const cfg = fs.readFileSync(path.resolve(__dirname, "../../mobile/app.config.ts"), "utf8");
  assert.match(
    cfg,
    /apiBaseUrl:\s*process\.env\.EXPO_PUBLIC_API_BASE_URL \|\|\s*"https:\/\/pwi1j8mq0j/,
  );
  const web = fs.readFileSync(path.resolve(__dirname, "../app/lib/api-client.ts"), "utf8");
  assert.match(web, /pwi1j8mq0j/);
  assert.doesNotMatch(web + cfg, new RegExp(["0duy", "2hfjd2"].join("")), "ölü eski host");
});
test("4.4: AI isteği 40 sn zaman aşımı sinyali taşır; ağ hatası AI_UNREACHABLE olur", async () => {
  const h = harness({ status: 200, body: { responseMode: "clarify", orchestratorSummary: "?" } });
  await h.api.ask("Roma");
  assert.ok(h.calls[0].signal, "AbortSignal gönderilir");
  assert.equal(h.mod.AI_TIMEOUT_MS, 40000);
  const web = fs.readFileSync(path.resolve(__dirname, "../app/lib/ai/chat.ts"), "utf8");
  assert.match(web, /AI_CHAT_TIMEOUT_MS = 40000/);
  await assert.rejects(
    () => harness(new Error("network")).api.ask("Roma"),
    (err) => err.code === "AI_UNREACHABLE" && err.status === 0,
  );
});
