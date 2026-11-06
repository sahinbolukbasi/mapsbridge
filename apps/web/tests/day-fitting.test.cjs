// Rota kalitesi S3/S4 (Increment 1.11; I2, I9): gün içi sıra deterministik 2-opt, zaman
// dilimi ve kilitli durak korunur; gün bütçesi aktif saat × 0,8 (≥%20 tampon); aşılırsa en
// düşük öncelikli durak düşer. LLM sırası kullanılmaz.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTs } = require("./helpers/load-ts.cjs");
const APP = path.resolve(__dirname, "../app");
const F = loadTs(path.join(APP, "lib/ai/day-fitting.ts"));
const plain = (v) => JSON.parse(JSON.stringify(v));
const stop = (id, lat, lng, over = {}) => ({
  id,
  name: `Durak ${id}`,
  lat,
  lng,
  day: 1,
  description: "",
  suggestedDuration: "1 saat",
  estimatedMinutes: 60,
  ...over,
});
// Model sırası zikzak: A(0) → C(2km) → B(1km) → D(3km) — doğrusal hatta.
const zigzag = [
  stop("A", 41.0, 28.9),
  stop("C", 41.0, 28.9 + 0.024),
  stop("B", 41.0, 28.9 + 0.012),
  stop("D", 41.0, 28.9 + 0.036),
];

test("2-opt sonrası toplam mesafe ≤ model sırası; ilk durak yerinde", () => {
  const out = F.orderDayStops(zigzag);
  assert.ok(F.pathKm(out) <= F.pathKm(zigzag));
  assert.ok(F.pathKm(out) < F.pathKm(zigzag) - 0.5, "zikzak düzelir");
  assert.equal(out[0].id, "A");
  assert.deepEqual(
    plain(out).map((s) => s.id),
    ["A", "B", "C", "D"],
  );
  assert.deepEqual(plain(F.orderDayStops([...zigzag])), plain(out), "aynı girdi → aynı sıra");
});

test("zaman dilimi korunur (akşam sabaha gelmez); kilitli durak yerinde kalır", () => {
  const slotted = [
    stop("E", 41.0, 28.9, { timeSlot: "evening" }),
    stop("M", 41.0, 28.95, { timeSlot: "morning" }),
  ];
  assert.deepEqual(
    plain(F.orderDayStops(slotted)).map((s) => s.id),
    ["M", "E"],
  );
  const locked = [zigzag[0], { ...zigzag[1], locked: true }, zigzag[2], zigzag[3]];
  const out = plain(F.orderDayStops(locked));
  assert.equal(out[1].id, "C", "kilitli durak index'i korunur");
});

test("bütçe aşımında en düşük öncelikli durak düşer; her gün tampon ≥ %20", () => {
  const heavy = Array.from({ length: 6 }, (_, i) =>
    stop(`S${i}`, 41.0, 28.9 + i * 0.004, { estimatedMinutes: 120 }),
  );
  const priority = new Map(heavy.map((s, i) => [s.id, i]));
  const { stops, dropped } = F.fitDayBudget(heavy, priority);
  assert.ok(dropped.length >= 2);
  assert.deepEqual(
    plain(dropped).map((s) => s.id),
    ["S5", "S4", "S3"].slice(0, dropped.length),
    "S2 sırasında en sondakiler önce düşer",
  );
  assert.ok(F.dayLoadMinutes(stops) <= F.DAY_BUDGET_MINUTES);
  assert.ok(F.bufferRatio(stops) >= 0.2);
  assert.equal(F.DAY_BUDGET_MINUTES, Math.round(F.ACTIVE_DAY_MINUTES * 0.8));
  const light = F.fitDayBudget(zigzag, new Map());
  assert.equal(light.dropped.length, 0, "bütçe içindeyse düşürme yok");
});

test("günün son durağı düşmez; kilitli durak düşmez", () => {
  const one = F.fitDayBudget([stop("X", 41, 29, { estimatedMinutes: 700 })], new Map());
  assert.equal(one.stops.length, 1);
  const pair = [
    stop("L", 41, 29, { estimatedMinutes: 400, locked: true }),
    stop("F", 41, 29.001, { estimatedMinutes: 400 }),
  ];
  const out = F.fitDayBudget(
    pair,
    new Map([
      ["L", 9],
      ["F", 0],
    ]),
  );
  assert.deepEqual(
    plain(out.dropped).map((s) => s.id),
    ["F"],
  );
});

test("supervisor: sıra/bütçe day-fitting ile; düşenler droppedStops + anlatı notu", () => {
  const src = fs.readFileSync(path.join(APP, "lib/ai/supervisor.ts"), "utf8");
  assert.match(src, /const ordered = orderDayStops\(dayStops\);/);
  assert.match(src, /fitDayBudget\(dayStops, priority\)/);
  assert.match(src, /droppedStops\.length \? \{ droppedStops \}/);
  assert.doesNotMatch(src, /const ordered = \[\.\.\.dayStops\];/);
});
