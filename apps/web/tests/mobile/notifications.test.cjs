// Increment 4.7 (K4): yerel bildirim planı (gün başı özeti + açık saatli yaklaşan durak; push yok).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTs } = require("../helpers/load-ts.cjs");
const MOBILE = path.resolve(__dirname, "../../../mobile/src");
const n = loadTs(path.join(MOBILE, "services/notification-logic.ts"));
const bio = loadTs(path.join(MOBILE, "services/lock-logic.ts"));
const TEXT = {
  dayStartTitle: (name) => `Bugün: ${name}`,
  dayStartBody: (c, f) => `${c} durak, ilk ${f}`,
  stopTitle: (name) => `Sıradaki: ${name}`,
  stopBody: (time) => time,
};
test("açık saat yalnız SS:DD ise; 'Sabah' gibi dilim saate çevrilmez (I2)", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(n.explicitTime("1. gün · 14:05"))), {
    hour: 14,
    minute: 5,
  });
  assert.equal(n.explicitTime("1. gün · Sabah"), null);
  assert.equal(n.explicitTime("25:00"), null);
  assert.equal(n.explicitTime(undefined), null);
});
test("gün başı 08:30; saatli duraklar 15 dk önce; geçmiş/boş rota yok", () => {
  const now = new Date(2026, 10, 7, 20, 0).getTime();
  const plan = n.planReminders(
    {
      id: "r1",
      name: "Roma",
      stops: [
        { name: "Kolezyum", time: "10:00" },
        { name: "Forum", time: "Öğle" },
        { name: "Pantheon", time: "08:40" },
      ],
    },
    now,
    TEXT,
  );
  const start = new Date(2026, 10, 8, 8, 30).getTime();
  assert.equal(plan[0].at, start);
  assert.equal(plan[0].body, "3 durak, ilk Kolezyum");
  assert.equal(plan.length, 2, "Pantheon 08:25 gün başından önce → kurulmaz");
  assert.equal(plan[1].at, new Date(2026, 10, 8, 9, 45).getTime());
  assert.equal(plan[1].title, "Sıradaki: Kolezyum");
  assert.deepEqual(
    JSON.parse(JSON.stringify(n.planReminders({ id: "e", name: "x", stops: [] }, now, TEXT))),
    [],
  );
  const morning = new Date(2026, 10, 7, 7, 0).getTime();
  assert.equal(n.nextDayStart(morning), new Date(2026, 10, 7, 8, 30).getTime());
});
test("biyometrik kilit: kapalıyken asla; açıkken 60 sn'den uzun arka planda kalınca", () => {
  assert.equal(bio.shouldLock(false, 0, 10 ** 9), false);
  assert.equal(bio.shouldLock(true, null, 10 ** 9), false);
  assert.equal(bio.shouldLock(true, 1000, 1000 + 59_999), false);
  assert.equal(bio.shouldLock(true, 1000, 1000 + 60_000), true);
});
