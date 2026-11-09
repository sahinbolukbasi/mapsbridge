// Faz 5 / görev 19 — streaming SSE yolu sağlamlaştırma.
// streamHandler (ai/index.ts) model pipeline + awslambda shim'e bağlı olduğundan
// canlı uçtan uca test ağır; house pattern (bkz ai-stream-cost.test.cjs): SSE
// FORMAT birimini replika ile doğrula + kaynak SÖZLEŞMESİNİ (olay sırası, hata
// kodları, token/complete) drift guard ile dondur. Kaynak değişirse guard kırılır.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const SRC = readFileSync(path.resolve(__dirname, "../src/ai/index.ts"), "utf8");

// ── SSE format birimi (kaynaktaki writeSse ile birebir) ───────────────────────
function writeSse(sink, type, data) {
  sink.push(`data: ${JSON.stringify({ type, ...data })}\n\n`);
}

test("SSE satırı 'data: {json}\\n\\n' biçiminde ve type taşır", () => {
  const sink = [];
  writeSse(sink, "token", { text: "Merhaba" });
  assert.equal(sink.length, 1);
  assert.match(sink[0], /^data: \{.*\}\n\n$/s);
  const parsed = JSON.parse(sink[0].replace(/^data: /, "").trim());
  assert.equal(parsed.type, "token");
  assert.equal(parsed.text, "Merhaba");
});

test("complete event result nesnesi taşıyabilir", () => {
  const sink = [];
  writeSse(sink, "complete", { result: { success: true, orchestratorSummary: "ok" } });
  const parsed = JSON.parse(sink[0].replace(/^data: /, "").trim());
  assert.equal(parsed.type, "complete");
  assert.equal(parsed.result.success, true);
});

// ── Kaynak sözleşmesi drift guard'ları ────────────────────────────────────────

test("drift guard: streamHandler writeSse ile status/token/complete/error yayar", () => {
  assert.ok(SRC.includes('writeSse(meta, "status"'), "status olayı olmalı");
  assert.ok(SRC.includes('writeSse(meta, "token"'), "token olayı olmalı");
  assert.ok(SRC.includes('writeSse(meta, "complete"'), "complete olayı olmalı");
  assert.ok(SRC.includes('writeSse(meta, "error"'), "error olayı olmalı");
});

test("drift guard: status fazları auth → intake → research sırasıyla", () => {
  const authIdx = SRC.indexOf('phase: "auth"');
  const intakeIdx = SRC.indexOf('phase: "intake"');
  const researchIdx = SRC.indexOf('phase: "research"');
  assert.ok(authIdx > 0 && intakeIdx > 0 && researchIdx > 0, "üç faz da olmalı");
  assert.ok(authIdx < intakeIdx, "auth, intake'ten önce");
  assert.ok(intakeIdx < researchIdx, "intake, research'ten önce");
});

test("drift guard: her error olayı bir code taşır", () => {
  // writeSse(meta, "error", { message: ..., code: ... }) kalıbı.
  const errorEvents = [...SRC.matchAll(/writeSse\(meta, "error", \{([^}]*)\}/g)];
  assert.ok(errorEvents.length >= 3, "birden çok hata yolu olmalı");
  for (const m of errorEvents) assert.match(m[1], /code:/, "her error code taşımalı");
});

test("drift guard: token akışı supervisor onToken callback'iyle beslenir", () => {
  // runMultiAgentSupervisor'a token yayıcı geçilir: (text) => writeSse(meta, "token", { text }).
  assert.ok(
    /writeSse\(meta, "token", \{ text \}\)/.test(SRC),
    "onToken writeSse token yaymalı",
  );
});

test("drift guard: CONTEXT_TOO_LARGE hatası stream'de de kurtarma koduyla döner", () => {
  assert.ok(
    SRC.includes("CONTEXT_TOO_LARGE"),
    "bağlam taşması stream yolunda da ele alınmalı",
  );
});

test("drift guard: akış her durumda meta.end() ile kapanır (finally)", () => {
  assert.ok(/finally\s*\{[\s\S]*?\.end\(\)/.test(SRC), "finally bloğu stream'i kapatmalı");
});
