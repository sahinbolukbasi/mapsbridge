// Faz 5 / görev 21 — dil eşleme (I11).
// Çıktı kullanıcının diliyle eşleşir, varsayılan Türkçe. Dil tespiti ayrı bir modül
// değil; kural base prompt'larda (ANSWER_PROMPT / CHAT_STREAM_PROMPT) ve Türkçe-
// varsayılan guardrail reddinde yaşar. Bu test I11 talimatının prompt'ta VAR olduğunu
// (görev 21'de eklendi) ve varsayılan Türkçe davranışı drift guard'la sabitler.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");

const PROMPTS_SRC = fs.readFileSync(
  path.resolve(__dirname, "../app/lib/ai/prompts.ts"),
  "utf8",
);

test("I11: ANSWER_PROMPT dil eşleme talimatı içerir (varsayılan Türkçe)", () => {
  const prompts = loadTs(path.resolve(__dirname, "../app/lib/ai/prompts.ts"));
  assert.match(prompts.ANSWER_PROMPT, /DİL \(I11\)/);
  assert.match(prompts.ANSWER_PROMPT, /kullanıcının yazdığı dille eşleştir/);
  assert.match(prompts.ANSWER_PROMPT, /Varsayılan Türkçe/);
});

test("I11: CHAT_STREAM_PROMPT dil eşleme talimatı içerir", () => {
  const prompts = loadTs(path.resolve(__dirname, "../app/lib/ai/prompts.ts"));
  assert.match(prompts.CHAT_STREAM_PROMPT, /DİL \(I11\)/);
  assert.match(prompts.CHAT_STREAM_PROMPT, /kullanıcının yazdığı dille eşleştir/);
});

test("I11: kullanıcı başka dile geçerse o dilde yanıt talimatı var", () => {
  // "İngilizce (veya başka bir dilde) yazarsa o dilde yanıtla" — eşleme kuralının
  // ikinci yarısı (yalnız Türkçe sabit değil).
  assert.ok(/İngilizce.*o dilde yanıtla/su.test(PROMPTS_SRC));
});

test("prompt değişikliği sürümlendi (spec değişikliği = version bump)", () => {
  const prompts = loadTs(path.resolve(__dirname, "../app/lib/ai/prompts.ts"));
  // v8 → v9 (I11 dil kuralı eklendi). Sessiz prompt genişletmesi yok.
  assert.equal(prompts.PROMPT_VERSION, "travel-dialogue-v9");
});

test("varsayılan Türkçe: base prompt'lar Türkçe açılır", () => {
  const prompts = loadTs(path.resolve(__dirname, "../app/lib/ai/prompts.ts"));
  assert.match(prompts.ANSWER_PROMPT, /^Sen MapsBridge seyahat danışmanısın/);
  assert.match(prompts.CHAT_STREAM_PROMPT, /^Sen MapsBridge seyahat danışmanısın/);
});

test("guardrail kapsam-dışı reddi Türkçe varsayılan", () => {
  const g = loadTs(path.resolve(__dirname, "../app/lib/ai/guardrails.ts"));
  const r = g.validateTravelScope("bana python kodu yaz");
  assert.equal(r.isTravelRelated, false);
  // Red mesajı Türkçe (I11 varsayılan): MapsBridge seyahat asistanı vurgusu.
  assert.match(r.refusalMessage, /seyahat/i);
});
