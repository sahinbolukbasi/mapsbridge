// Faz 5 / görev 20 — CONTEXT_TOO_LARGE kurtarma yolu (belirsiz 503 yok).
// (1) error-classifier: mesaj-temelli bağlam hatası tespiti + net kod/mesaj.
// (2) supervisor kaynak sözleşmesi: bağlam aşımında 1 kez agresif budama (keepTurns=2)
//     → yine aşarsa contextTooLargeResponse (CONTEXT_TOO_LARGE + kurtarma), 503 değil.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");

function classifier() {
  return loadTs(path.resolve(__dirname, "../app/lib/ai/error-classifier.ts"));
}
const SUPERVISOR_SRC = fs.readFileSync(
  path.resolve(__dirname, "../app/lib/ai/supervisor.ts"),
  "utf8",
);
const HANDLER_SRC = fs.readFileSync(
  path.resolve(__dirname, "../../../infra/lambda/src/ai/index.ts"),
  "utf8",
);

// ── error-classifier: mesaj-temelli tespit + kurtarma mesajı ──────────────────

test("mesajda 'too long' / 'maximum context length' → CONTEXT_TOO_LARGE", () => {
  const { isContextSizeError, classifyAIError } = classifier();
  assert.equal(isContextSizeError({ message: "input is too long for this model" }), true);
  assert.equal(isContextSizeError({ message: "maximum context length exceeded" }), true);
  assert.equal(classifyAIError({ message: "context budget exceeded" }).code, "CONTEXT_TOO_LARGE");
});

test("CONTEXT_TOO_LARGE tekrar-edilemez ve kurtarma yolu içeren mesaj taşır", () => {
  const { classifyAIError } = classifier();
  const c = classifyAIError({ name: "ValidationException" });
  assert.equal(c.code, "CONTEXT_TOO_LARGE");
  assert.equal(c.retriable, false, "tekrar denemek işe yaramaz");
  assert.match(c.message, /yeni bir seyahat|özetle/i, "kurtarma yolu önerilmeli");
});

test("alakasız hata CONTEXT_TOO_LARGE'a eşlenmez (yanlış pozitif yok)", () => {
  const { isContextSizeError } = classifier();
  assert.equal(isContextSizeError({ message: "network reset" }), false);
  assert.equal(isContextSizeError(null), false);
  assert.equal(isContextSizeError({ name: "ThrottlingException" }), false);
});

// ── supervisor kaynak sözleşmesi (drift guard) ───────────────────────────────

test("drift guard: supervisor bağlam aşımında 1 kez agresif budar (keepTurns=2)", () => {
  assert.ok(
    SUPERVISOR_SRC.includes("generate(undefined, 2)"),
    "ikinci deneme keepTurns=2 ile olmalı",
  );
  // Budama yalnızca süre bütçesi varken (started < 18500) denenir.
  assert.ok(SUPERVISOR_SRC.includes("Date.now() - started < 18500"));
});

test("drift guard: ikinci deneme de aşarsa contextTooLargeResponse döner (503 değil)", () => {
  assert.ok(SUPERVISOR_SRC.includes("contextTooLargeResponse()"));
  assert.ok(
    SUPERVISOR_SRC.includes('errorCode: "CONTEXT_TOO_LARGE"'),
    "yanıt net CONTEXT_TOO_LARGE kodu taşımalı",
  );
});

test("drift guard: contextTooLargeResponse kullanıcıya kurtarma yolu sunar + mevcut rotayı korur", () => {
  // "yeni bir seyahat başlat" + önceki rota korunur (plan silinmez).
  assert.ok(/yeni bir seyahat başlat/i.test(SUPERVISOR_SRC));
  assert.ok(SUPERVISOR_SRC.includes("previous?.route ? { route: previous.route }"));
});

test("drift guard: handler bağlam hatasını 413 + CONTEXT_TOO_LARGE'a eşler (belirsiz 503 değil)", () => {
  // buffered yol: isContextSizeError → reply(413, {code:"CONTEXT_TOO_LARGE"}).
  assert.ok(HANDLER_SRC.includes("isContextSizeError(err)"));
  assert.ok(/reply\(413[\s\S]{0,120}CONTEXT_TOO_LARGE/.test(HANDLER_SRC));
});
