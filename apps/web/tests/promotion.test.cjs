// Faz 4 / görev 16 — onaylı → korpus promotion kanalı (fine-tune YOK).
// promoteApprovedRecord: approved+reviewed+consent kaydı iki kanala böler —
// olgu→RAG (tarihli), üslup→few-shot (olgu kırpılır). approved değilse reddeder.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { transformSync } = require("esbuild");

function load() {
  const file = path.resolve(__dirname, "../server/ai/promotion.ts");
  const code = transformSync(fs.readFileSync(file, "utf8"), { loader: "ts", format: "cjs" }).code;
  const mod = { exports: {} };
  vm.runInNewContext(code, { module: mod, exports: mod.exports, Date, require });
  return mod.exports;
}

const p = load();

function approved(over = {}) {
  return {
    privacyReview: "approved",
    reviewed: true,
    consent: { scope: "current_turn" },
    messages: [
      { role: "user", content: [{ text: "Roma'da 3 gün, akşam 19:00 civarı yemek, bütçe €150" }] },
      {
        role: "assistant",
        content: [{ text: "Trastevere'de 20:30 gibi akşam yemeği öneririm, kişi başı €40 civarı." }],
      },
    ],
    metadata: { model: "haiku", promptVersion: "v8", responseMode: "chat" },
    createdAt: "2026-11-01T00:00:00Z",
    ...over,
  };
}

test("approved kayıt iki kanala bölünür: rag + fewShot", () => {
  const r = p.promoteApprovedRecord(approved(), Date.parse("2026-11-09T00:00:00Z"));
  assert.ok(r.rag);
  assert.ok(r.fewShot);
  assert.equal(r.rejected, undefined);
  assert.equal(r.rag.kind, "rag");
  assert.equal(r.fewShot.kind, "fewshot");
});

test("RAG dokümanı olgusal içerik + tarih + kaynak model taşır", () => {
  const r = p.promoteApprovedRecord(approved(), Date.parse("2026-11-09T00:00:00Z"));
  assert.ok(r.rag.text.includes("Trastevere"));
  assert.equal(r.rag.promotedAt, "2026-11-09T00:00:00.000Z");
  assert.equal(r.rag.sourceModel, "haiku");
  assert.equal(r.rag.promptVersion, "v8");
});

test("few-shot ÜSLUP taşır, OLGU kırpılır (fiyat/saat →) — fine-tune değil", () => {
  const r = p.promoteApprovedRecord(approved());
  // €150, 19:00, €40, 20:30 gibi olgular few-shot'ta kalmamalı.
  assert.equal(/€150|€40|19:00|20:30/.test(r.fewShot.assistantStyle + r.fewShot.userGist), false);
  assert.equal(r.fewShot.note, "style_only_not_finetune");
});

test("toStyleOnly para/saat/ölçü değerlerini söker", () => {
  const out = p.toStyleOnly("Giriş €15, açılış 09:00, 3 km yürüyüş, 45 dakika");
  assert.equal(/€15|09:00|3 km|45 dakika/.test(out), false);
});

test("approved değil → reddedilir (not_approved)", () => {
  assert.equal(
    p.promoteApprovedRecord(approved({ privacyReview: "required" })).rejected,
    "not_approved",
  );
  assert.equal(
    p.promoteApprovedRecord(approved({ privacyReview: "rejected" })).rejected,
    "not_approved",
  );
});

test("reviewed=false veya consent yanlış → not_promotable", () => {
  assert.equal(p.promoteApprovedRecord(approved({ reviewed: false })).rejected, "not_promotable");
  assert.equal(
    p.promoteApprovedRecord(approved({ consent: { scope: "forever" } })).rejected,
    "not_promotable",
  );
});

test("boş içerik → empty_content", () => {
  const r = p.promoteApprovedRecord(
    approved({
      messages: [
        { role: "user", content: [{ text: "" }] },
        { role: "assistant", content: [{ text: "" }] },
      ],
    }),
  );
  assert.equal(r.rejected, "empty_content");
});

test("isPromotable: approved+reviewed+current_turn+≥2 mesaj", () => {
  assert.equal(p.isPromotable(approved()), true);
  assert.equal(p.isPromotable(approved({ messages: [{ role: "user", content: [] }] })), false);
});
