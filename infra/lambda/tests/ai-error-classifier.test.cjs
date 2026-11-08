// AI handler'ın (infra/lambda/src/ai/index.ts) içe aktardığı hata sınıflandırıcıyı doğrular:
// Bedrock ValidationException / bağlam-boyutu hataları belirsiz 503 yerine CONTEXT_TOO_LARGE'a
// eşlenmeli; faturalandırma kodları (günlük sınır / kredi) ZAYIFLATILMADAN kendi kodlarını
// korumalı. Handler catch'i isContextSizeError + classifyAIError üzerine kuruludur.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTs } = require("../../../apps/web/tests/helpers/load-ts.cjs");

function classifier() {
  return loadTs(path.resolve(__dirname, "../../../apps/web/app/lib/ai/error-classifier.ts"));
}

test("handler ValidationException'ı CONTEXT_TOO_LARGE'a eşler (belirsiz 503 değil)", () => {
  const { isContextSizeError, classifyAIError } = classifier();
  assert.equal(isContextSizeError({ name: "ValidationException" }), true);
  const c = classifyAIError({ name: "ValidationException" });
  assert.equal(c.code, "CONTEXT_TOO_LARGE");
  assert.equal(c.retriable, false);
  assert.ok(c.message.length > 0);
});

test("modelMessages ContextBudgetError (code) bağlam hatası olarak tanınır", () => {
  const { isContextSizeError } = classifier();
  assert.equal(isContextSizeError({ code: "CONTEXT_TOO_LARGE" }), true);
});

test("throttling tekrar edilebilir, timeout AI_TIMEOUT — her ikisi de bağlam hatası DEĞİL", () => {
  const { isContextSizeError, classifyAIError } = classifier();
  assert.equal(isContextSizeError({ name: "ThrottlingException" }), false);
  assert.equal(classifyAIError({ name: "ThrottlingException" }).code, "THROTTLED");
  assert.equal(classifyAIError({ name: "ThrottlingException" }).retriable, true);
  assert.equal(classifyAIError({ name: "ModelTimeoutException" }).code, "AI_TIMEOUT");
});

test("faturalandırma sınırları kendi kodlarını korur (danger zone — zayıflatılmaz)", () => {
  const { classifyAIError } = classifier();
  assert.equal(classifyAIError({ code: "USER_DAILY_LIMIT" }).code, "USER_DAILY_LIMIT");
  assert.equal(classifyAIError({ code: "INSUFFICIENT_CREDITS" }).code, "INSUFFICIENT_CREDITS");
  assert.equal(classifyAIError({ code: "WALLET_FROZEN" }).code, "WALLET_FROZEN");
});
