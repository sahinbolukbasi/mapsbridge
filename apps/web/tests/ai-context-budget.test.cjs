const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

// TS modülünü (yalnızca göreli, tip-dışı importlu) yükleyen hafif yardımcı.
function loadTs(relative) {
  const file = path.resolve(__dirname, "../app/lib/ai", relative);
  const cache = new Map();
  function load(filepath) {
    if (cache.has(filepath)) return cache.get(filepath).exports;
    const mod = { exports: {} };
    cache.set(filepath, mod);
    const code = transformSync(readFileSync(filepath, "utf8"), {
      loader: "ts",
      format: "cjs",
    }).code;
    vm.runInNewContext(code, {
      module: mod,
      exports: mod.exports,
      TextEncoder,
      require(spec) {
        if (spec.startsWith("."))
          return load(path.resolve(path.dirname(filepath), spec.endsWith(".ts") ? spec : spec + ".ts"));
        return {}; // tip-dışı npm/stub
      },
    });
    return mod.exports;
  }
  return load(file);
}

// ─────────────────────────── error-classifier ───────────────────────────

test("ValidationException bağlam-boyutu hatası olarak CONTEXT_TOO_LARGE'a eşlenir", () => {
  const { classifyAIError, isContextSizeError } = loadTs("error-classifier.ts");
  const classified = classifyAIError({ name: "ValidationException" });
  assert.equal(classified.code, "CONTEXT_TOO_LARGE");
  assert.equal(classified.retriable, false);
  assert.match(classified.message, /bağlam sınırını aştı/);
  assert.equal(isContextSizeError({ name: "ValidationException" }), true);
});

test("ContextBudgetError (code=CONTEXT_TOO_LARGE) bağlam hatası sayılır", () => {
  const { classifyAIError, isContextSizeError } = loadTs("error-classifier.ts");
  assert.equal(isContextSizeError({ code: "CONTEXT_TOO_LARGE" }), true);
  assert.equal(classifyAIError({ code: "CONTEXT_TOO_LARGE" }).code, "CONTEXT_TOO_LARGE");
});

test("mesaj ipuçlarından bağlam-boyutu hatası tespit edilir", () => {
  const { isContextSizeError } = loadTs("error-classifier.ts");
  assert.equal(isContextSizeError({ message: "input is too long for requested model" }), true);
  assert.equal(isContextSizeError({ message: "maximum context length exceeded" }), true);
  assert.equal(isContextSizeError({ message: "exceeds context budget" }), true);
  assert.equal(isContextSizeError({ name: "ThrottlingException" }), false);
  assert.equal(isContextSizeError(null), false);
});

test("throttling tekrar-edilebilir; timeout AI_TIMEOUT", () => {
  const { classifyAIError } = loadTs("error-classifier.ts");
  const throttle = classifyAIError({ name: "ThrottlingException" });
  assert.equal(throttle.code, "THROTTLED");
  assert.equal(throttle.retriable, true);
  const timeout = classifyAIError({ name: "ModelTimeoutException" });
  assert.equal(timeout.code, "AI_TIMEOUT");
  assert.equal(timeout.retriable, true);
  const abort = classifyAIError({ name: "AbortError" });
  assert.equal(abort.code, "AI_TIMEOUT");
});

test("faturalandırma kodları kendi kodlarını korur, sınır zayıflatılmaz", () => {
  const { classifyAIError } = loadTs("error-classifier.ts");
  const credit = classifyAIError({ code: "INSUFFICIENT_CREDITS" });
  assert.equal(credit.code, "INSUFFICIENT_CREDITS");
  assert.equal(credit.retriable, false);
  const daily = classifyAIError({ code: "USER_DAILY_LIMIT" });
  assert.equal(daily.code, "USER_DAILY_LIMIT");
  assert.equal(daily.retriable, false);
  assert.match(daily.message, /sınırına ulaştınız/);
  const service = classifyAIError({ code: "SERVICE_DAILY_LIMIT" });
  assert.equal(service.retriable, true);
  const frozen = classifyAIError({ code: "WALLET_FROZEN" });
  assert.equal(frozen.code, "WALLET_FROZEN");
});

test("bilinmeyen hata MODEL_INVOCATION_FAILED'e düşer", () => {
  const { classifyAIError, classifyBedrockErrorName } = loadTs("error-classifier.ts");
  assert.equal(classifyAIError({ name: "SomethingElse" }).code, "MODEL_INVOCATION_FAILED");
  assert.equal(classifyBedrockErrorName(undefined), "MODEL_INVOCATION_FAILED");
  assert.equal(classifyBedrockErrorName("ValidationException"), "CONTEXT_TOO_LARGE");
});

// ─────────────────────────── token-budget ───────────────────────────

const turn = (role, content) => ({ role, content });

test("estimateTokens bayt/4 muhafazakâr tahmini döndürür", () => {
  const { estimateTokens } = loadTs("token-budget.ts");
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("abcde"), 2);
});

test("budgetHistory kısa geçmişi olduğu gibi tutar, özet yok", () => {
  const { budgetHistory } = loadTs("token-budget.ts");
  const history = [turn("user", "merhaba"), turn("assistant", "selam")];
  const r = budgetHistory(history, 7000, 6);
  assert.equal(r.rollingSummary, "");
  assert.equal(r.droppedTurns, 0);
  assert.equal(r.messages.length, 2);
});

test("budgetHistory eski turları tek yuvarlanan özete indirger, son N turu korur", () => {
  const { budgetHistory } = loadTs("token-budget.ts");
  const history = Array.from({ length: 20 }, (_, i) =>
    turn(i % 2 ? "assistant" : "user", `mesaj ${i}. Devam cümlesi.`),
  );
  const r = budgetHistory(history, 7000, 6);
  assert.ok(r.rollingSummary.startsWith("Önceki konuşmanın özeti:"));
  // Özet (1) + son 6 ham tur = 7 mesaj
  assert.equal(r.messages.length, 7);
  assert.equal(r.messages[0].content, r.rollingSummary);
  // Son ham tur korunmuş olmalı
  assert.equal(r.messages.at(-1).content, "mesaj 19. Devam cümlesi.");
});

test("budgetHistory özet daima korunur, çok sıkı bütçede bile son turlar kırpılır", () => {
  const { budgetHistory, estimateTokens } = loadTs("token-budget.ts");
  const history = Array.from({ length: 20 }, (_, i) =>
    turn(i % 2 ? "assistant" : "user", "x".repeat(400)),
  );
  const r = budgetHistory(history, 60, 6);
  // İlk mesaj özet olmalı ve korunmalı
  assert.ok(r.messages.length >= 1);
  assert.ok(r.messages[0].content.startsWith("Önceki konuşmanın özeti:"));
  // Özet tek başına bütçeyi aşsa bile korunur (deterministik sınır)
  assert.ok(estimateTokens(r.messages[0].content) <= 60 + 400);
});

test("budgetHistory boş/geçersiz girdiyi güvenle işler", () => {
  const { budgetHistory } = loadTs("token-budget.ts");
  assert.equal(budgetHistory([], 7000, 6).messages.length, 0);
  assert.equal(budgetHistory(undefined, 7000, 6).messages.length, 0);
  const dirty = [turn("user", "  "), turn("bogus", "x"), turn("assistant", "ok")];
  const r = budgetHistory(dirty, 7000, 6);
  assert.equal(r.messages.length, 1);
  assert.equal(r.messages[0].content, "ok");
});

test("summarizeTurn ilk cümleyi 120 karakterle sınırlar ve rolü etiketler", () => {
  const { summarizeTurn } = loadTs("token-budget.ts");
  assert.equal(summarizeTurn(turn("user", "Roma gezmek istiyorum. İkinci cümle.")), "Kullanıcı: Roma gezmek istiyorum.");
  assert.equal(summarizeTurn(turn("assistant", "Kaç gün?")), "Asistan: Kaç gün?");
  assert.equal(summarizeTurn(turn("user", "   ")), "");
  assert.ok(summarizeTurn(turn("user", "a".repeat(500))).length <= "Kullanıcı: ".length + 120);
});

test("capManifesto sıkı karakter sınırı uygular ve boşu undefined yapar", () => {
  const { capManifesto, MANIFESTO_CHAR_CAP } = loadTs("token-budget.ts");
  assert.equal(capManifesto(undefined), undefined);
  assert.equal(capManifesto("   "), undefined);
  assert.equal(capManifesto("kısa"), "kısa");
  const big = "y".repeat(MANIFESTO_CHAR_CAP + 500);
  assert.equal(capManifesto(big).length, MANIFESTO_CHAR_CAP);
  assert.equal(capManifesto("z".repeat(50), 10).length, 10);
});

// ─────────────────────────── model-history (ContextBudgetError) ───────────────────────────

test("modelMessages aşırı büyük isteği ContextBudgetError (code=CONTEXT_TOO_LARGE) ile reddeder", () => {
  const { modelMessages, ContextBudgetError } = loadTs("model-history.ts");
  let thrown;
  try {
    modelMessages("ü".repeat(16001), []);
  } catch (e) {
    thrown = e;
  }
  assert.ok(thrown instanceof ContextBudgetError);
  assert.equal(thrown.code, "CONTEXT_TOO_LARGE");
  assert.match(thrown.message, /context budget/);
});
