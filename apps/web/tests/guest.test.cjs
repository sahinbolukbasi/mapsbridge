// Misafir asistan saf mantığı (design §6.1, §6.2, §12.2, §13; FEAT-006): soru seti I3/I4/I5
// sınırları, yanıt temizleme, taslak deposu (TTL, şema, quota) ve özet mesajı. Ağ yok, window yok:
// depolama bellek içi nesneyle enjekte edilir.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");

const LIB = path.resolve(__dirname, "../app/lib/guest");
const tr = require("../app/locales/tr.json");
const en = require("../app/locales/en.json");
const warnings = [];
const quietConsole = { ...console, warn: (...args) => warnings.push(args.join(" ")) };
const script = loadTs(path.join(LIB, "guest-script.ts"));
const draftLib = loadTs(path.join(LIB, "guest-draft.ts"), { globals: { console: quietConsole } });
const plain = (v) => JSON.parse(JSON.stringify(v));
const tTr = (key, fallback) => tr[key] ?? fallback ?? key;

const { GUEST_TURNS, sanitizeAnswers, nextTurn, validateDateRange, INTERESTS_MAX } = script;
const {
  GUEST_DRAFT_KEY,
  GUEST_DRAFT_TTL_MS,
  loadDraft,
  saveDraft,
  clearDraft,
  createDraft,
  sanitizePrompt,
  buildGuestSummaryMessage,
} = draftLib;

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}
const NOW = Date.parse("2026-11-05T10:00:00.000Z");

test("I3: her turda en fazla 2 soru, her soruda 2–4 seçenek", () => {
  assert.equal(GUEST_TURNS.length, 2);
  for (const turn of GUEST_TURNS) {
    assert.ok(turn.questions.length >= 1 && turn.questions.length <= 2, `tur ${turn.turn}`);
    for (const q of turn.questions) {
      assert.ok(q.options.length >= 2 && q.options.length <= 4, `${q.id}: ${q.options.length}`);
      assert.ok(["single", "multi"].includes(q.mode));
      assert.equal(new Set(q.options.map((o) => o.id)).size, q.options.length, `${q.id} tekil`);
    }
  }
  assert.deepEqual(plain(GUEST_TURNS.map((t) => t.questions.map((q) => q.id))), [
    ["duration", "character"],
    ["pace", "interests"],
  ]);
  assert.deepEqual(plain(GUEST_TURNS[0].questions[0].options.map((o) => o.id)), [
    "weekend-2d",
    "3d",
    "5d",
    "pick-dates",
  ]);
  assert.deepEqual(plain(GUEST_TURNS[0].questions[1].options.map((o) => o.id)), [
    "history-culture",
    "food-drink",
    "nature-views",
    "slow-calm",
  ]);
  assert.deepEqual(plain(GUEST_TURNS[1].questions[0].options.map((o) => o.id)), [
    "calm",
    "balanced",
    "intense",
  ]);
  const interests = GUEST_TURNS[1].questions[1];
  assert.equal(interests.mode, "multi");
  assert.equal(interests.max, 4);
  assert.deepEqual(plain(interests.options.map((o) => o.id)), [
    "museums",
    "local-food",
    "viewpoints",
    "markets",
  ]);
});

test("I5: demografik soru ya da seçenek yok (kimlik, TR ve EN etiketleri)", () => {
  const DEMOGRAPHIC = /yaş|cinsiyet|kiminle|aile|milliyet|age|gender|family|nationality/i;
  for (const turn of GUEST_TURNS)
    for (const q of turn.questions) {
      const texts = [q.id, q.text, tr[q.textKey], en[q.textKey]];
      for (const o of q.options) texts.push(o.id, o.label, tr[o.labelKey], en[o.labelKey]);
      for (const text of texts) {
        assert.equal(typeof text, "string", `${q.id}: eksik metin/çeviri`);
        assert.doesNotMatch(text, DEMOGRAPHIC, `${q.id}: "${text}"`);
      }
    }
});

test("i18n: soru ve seçenek anahtarları tr ve en'de; TR değeri kaynak etiketle aynı", () => {
  for (const turn of GUEST_TURNS)
    for (const q of turn.questions) {
      assert.equal(tr[q.textKey], q.text, q.textKey);
      assert.ok(en[q.textKey], q.textKey);
      for (const o of q.options) {
        assert.equal(tr[o.labelKey], o.label, o.labelKey);
        assert.ok(en[o.labelKey], o.labelKey);
      }
    }
});

test("sanitizeAnswers: bilinmeyen kimlik/alan atılır, ilgi alanları tekil ve en fazla 4", () => {
  assert.deepEqual(plain(sanitizeAnswers(null)), {});
  assert.deepEqual(plain(sanitizeAnswers(["3d"])), {});
  assert.deepEqual(
    plain(
      sanitizeAnswers({
        duration: "7d",
        character: "nightlife",
        pace: "balanced",
        interests: ["museums", "casino", "museums", 3, "markets"],
        age: "30",
      }),
    ),
    { pace: "balanced", interests: ["museums", "markets"] },
  );
  assert.deepEqual(
    plain(
      sanitizeAnswers({
        interests: ["museums", "local-food", "viewpoints", "markets", "museums", "x"],
      }),
    ),
    { interests: ["museums", "local-food", "viewpoints", "markets"] },
  );
  assert.equal(INTERESTS_MAX, 4);
  // "pick-dates" kendisi bir yanıt değildir; yalnız geçerli tarih aralığı kalır.
  assert.deepEqual(plain(sanitizeAnswers({ duration: "pick-dates" })), {});
  assert.deepEqual(plain(sanitizeAnswers({ duration: { from: "2026-12-01", to: "2026-12-04" } })), {
    duration: { from: "2026-12-01", to: "2026-12-04" },
  });
  assert.deepEqual(
    plain(sanitizeAnswers({ duration: { from: "2026-12-04", to: "2026-12-01" } })),
    {},
  );
  assert.deepEqual(
    plain(sanitizeAnswers({ duration: { from: "2026-02-30", to: "2026-03-01" } })),
    {},
  );
});

test("nextTurn: 1 → 2 → 3", () => {
  assert.equal(nextTurn({}), 1);
  assert.equal(nextTurn({ duration: "3d" }), 1);
  assert.equal(nextTurn({ duration: "3d", character: "food-drink" }), 2);
  assert.equal(nextTurn({ duration: "3d", character: "food-drink", pace: "calm" }), 2);
  assert.equal(
    nextTurn({ duration: "3d", character: "food-drink", pace: "calm", interests: ["museums"] }),
    3,
  );
});

test("validateDateRange: from ≤ to, from ≥ bugün, ≤ 30 gün", () => {
  assert.equal(validateDateRange("2026-12-01", "2026-12-03", "2026-11-05"), null);
  assert.equal(validateDateRange("2026-12-03", "2026-12-01", "2026-11-05"), "order");
  assert.equal(validateDateRange("2026-11-04", "2026-11-06", "2026-11-05"), "past");
  assert.equal(validateDateRange("2026-12-01", "2026-12-30", "2026-11-05"), null, "30 gün");
  assert.equal(validateDateRange("2026-12-01", "2026-12-31", "2026-11-05"), "tooLong");
  assert.equal(validateDateRange("", "2026-12-01"), "invalid");
  assert.equal(validateDateRange("2026-13-01", "2026-12-01"), "invalid");
});

test("taslak: bellek içi depoyla yaz/oku gidiş-dönüş", () => {
  const storage = memoryStorage();
  clearDraft(storage);
  const draft = {
    ...plain(createDraft("Roma'da 3 gün", NOW)),
    answers: { duration: "3d", character: "history-culture" },
    turn: 2,
  };
  assert.deepEqual(plain(saveDraft(storage, draft)), { persisted: true });
  const raw = JSON.parse(storage.data[GUEST_DRAFT_KEY]);
  assert.equal(raw.v, 1);
  assert.equal(raw.createdAt, "2026-11-05T10:00:00.000Z");
  assert.deepEqual(plain(loadDraft(storage, NOW + 1000)), draft);
  clearDraft(storage);
  assert.equal(storage.data[GUEST_DRAFT_KEY], undefined);
  assert.equal(loadDraft(storage, NOW), null);
});

test("taslak: TTL 7 gün; 7 gün + 1 ms dolmuş ve silinir", () => {
  const storage = memoryStorage();
  clearDraft(storage);
  saveDraft(storage, plain(createDraft("Roma", NOW)));
  assert.equal(GUEST_DRAFT_TTL_MS, 7 * 24 * 60 * 60 * 1000);
  assert.ok(loadDraft(storage, NOW + GUEST_DRAFT_TTL_MS), "tam 7 gün geçerli");
  assert.equal(loadDraft(storage, NOW + GUEST_DRAFT_TTL_MS + 1), null);
  assert.equal(storage.data[GUEST_DRAFT_KEY], undefined, "süresi dolan taslak silindi");
});

test("taslak: farklı v, bozuk JSON ve şemaya uymayan kayıt sessizce silinir", () => {
  const base = { v: 1, createdAt: new Date(NOW).toISOString(), q: "Roma", answers: {}, turn: 1 };
  const cases = [
    { ...base, v: 2 },
    { ...base, turn: 7 },
    { ...base, q: "x".repeat(501) },
    { ...base, createdAt: "dün" },
    "{bozuk",
  ];
  for (const c of cases) {
    const storage = memoryStorage({
      [GUEST_DRAFT_KEY]: typeof c === "string" ? c : JSON.stringify(c),
    });
    clearDraft(null);
    assert.equal(loadDraft(storage, NOW), null, JSON.stringify(c));
    assert.equal(storage.data[GUEST_DRAFT_KEY], undefined, `silindi: ${JSON.stringify(c)}`);
  }
  // bilinmeyen yanıtlar atılır, taslak kalır
  const storage = memoryStorage({
    [GUEST_DRAFT_KEY]: JSON.stringify({ ...base, answers: { duration: "3d", age: "30" } }),
  });
  assert.deepEqual(plain(loadDraft(storage, NOW).answers), { duration: "3d" });
});

test("taslak: QuotaExceededError / SecurityError → persisted:false, sekmede bellekte kalır", () => {
  warnings.length = 0;
  const quota = {
    getItem: () => null,
    setItem: () => {
      const e = new Error("quota");
      e.name = "QuotaExceededError";
      throw e;
    },
    removeItem: () => {},
  };
  const draft = { ...plain(createDraft("Roma", NOW)), answers: { duration: "5d" }, turn: 1 };
  assert.deepEqual(plain(saveDraft(quota, draft)), { persisted: false });
  assert.deepEqual(plain(loadDraft(quota, NOW)), draft, "bellek kopyası");
  assert.ok(warnings.length > 0, "geliştirmede console.warn");
  const blocked = {
    getItem: () => {
      const e = new Error("blocked");
      e.name = "SecurityError";
      throw e;
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  assert.deepEqual(plain(saveDraft(blocked, draft)), { persisted: false });
  assert.deepEqual(plain(loadDraft(blocked, NOW)), draft);
  assert.deepEqual(plain(saveDraft(null, draft)), { persisted: false });
  clearDraft(blocked);
  assert.equal(loadDraft(blocked, NOW), null);
});

test("sanitizePrompt: kontrol karakterleri atılır, boşluk tekleşir, 500'de kesilir", () => {
  assert.equal(sanitizePrompt("  Roma\u0000'da\t\t3\n gün\u007F "), "Roma 'da 3 gün");
  assert.doesNotMatch(sanitizePrompt("a\u0001b\u001Fc\u007Fd"), /[\u0000-\u001F\u007F]/);
  assert.equal(sanitizePrompt("x".repeat(600)).length, 500);
  assert.equal(sanitizePrompt(undefined), "");
  assert.equal(sanitizePrompt(42), "");
});

test("buildGuestSummaryMessage: design §6.1 düz kullanıcı mesajı", () => {
  const draft = {
    v: 1,
    createdAt: new Date(NOW).toISOString(),
    q: "Roma'da 3 gün",
    answers: {
      duration: "3d",
      character: "history-culture",
      pace: "balanced",
      interests: ["local-food", "viewpoints"],
    },
    turn: 3,
  };
  assert.equal(
    buildGuestSummaryMessage(draft, tTr),
    "Roma'da 3 gün. Süre: 3 gün. Karakter: Tarih ve kültür. Tempo: Dengeli. İlgi: Yerel yemek, Manzara noktaları.",
  );
  assert.equal(
    buildGuestSummaryMessage(
      { ...draft, q: "", answers: { duration: { from: "2026-12-01", to: "2026-12-04" } } },
      tTr,
    ),
    "Tarihler: 2026-12-01 – 2026-12-04.",
  );
  // çeviri yoksa TR yedek etiketleri
  assert.equal(
    buildGuestSummaryMessage({ ...draft, answers: { pace: "intense" } }, (k, f) => f ?? k),
    "Roma'da 3 gün. Tempo: Yoğun.",
  );
});
