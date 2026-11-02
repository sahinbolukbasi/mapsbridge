// I2 karakterizasyon + determinizm testi — buildResearchedRoute güne-atama davranışı.
// esbuild bundle ile çünkü supervisor.ts geniş bağımlılık ağına sahip.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildSync } = require("esbuild");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");

function loadSupervisor() {
  const dir = mkdtempSync(path.join(tmpdir(), "mb-i2-"));
  const out = path.join(dir, "s.cjs");
  buildSync({
    entryPoints: [path.resolve(__dirname, "../../../apps/web/app/lib/ai/supervisor.ts")],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    outfile: out,
  });
  const mod = require(out);
  return { mod, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

// Sabit araştırılmış POI havuzu (research.places)
function fixtureResearch() {
  return {
    places: [
      {
        id: "p1",
        name: "Sultanahmet",
        lat: 41.0054,
        lng: 28.9768,
        address: "A",
        category: "history",
        typicalDurationMins: 90,
      },
      {
        id: "p2",
        name: "Ayasofya",
        lat: 41.0086,
        lng: 28.98,
        address: "B",
        category: "history",
        typicalDurationMins: 60,
      },
      {
        id: "p3",
        name: "Galata",
        lat: 41.0256,
        lng: 28.9744,
        address: "C",
        category: "view",
        typicalDurationMins: 45,
      },
      {
        id: "p4",
        name: "Karaköy",
        lat: 41.0255,
        lng: 28.977,
        address: "D",
        category: "food",
        typicalDurationMins: 60,
      },
    ],
  };
}

test("buildResearchedRoute: her gün en az bir durak içerir (karakterizasyon)", () => {
  const { mod, cleanup } = loadSupervisor();
  try {
    const candidate = {
      title: "İstanbul",
      summary: "test",
      theme: "Tarih",
      estimatedDays: 2,
      stops: [
        { placeId: "P1", day: 1 },
        { placeId: "P2", day: 1 },
        { placeId: "P3", day: 2 },
        { placeId: "P4", day: 2 },
      ],
    };
    const route = mod.buildResearchedRoute(
      candidate,
      { days: 2, destination: "İstanbul" },
      fixtureResearch(),
    );
    assert.equal(route.estimatedDays, 2);
    assert.equal(route.stops.length, 4);
    for (let d = 1; d <= 2; d++) {
      assert.ok(
        route.stops.some((s) => s.day === d),
        `gün ${d} dolu olmalı`,
      );
    }
  } finally {
    cleanup();
  }
});

test("buildResearchedRoute: araştırılmamış POI reddedilir (I1 korunumu)", () => {
  const { mod, cleanup } = loadSupervisor();
  try {
    const candidate = {
      title: "x",
      summary: "y",
      theme: "T",
      estimatedDays: 1,
      stops: [{ placeId: "P99", day: 1 }], // P99 yok
    };
    assert.throws(
      () => mod.buildResearchedRoute(candidate, { days: 1, destination: "X" }, fixtureResearch()),
      /Araştırılmamış|Rota oluşturulamadı/,
    );
  } finally {
    cleanup();
  }
});

test("I2: güne-atama LLM'in day çıktısından BAĞIMSIZ (deterministik k-means)", () => {
  const { mod, cleanup } = loadSupervisor();
  try {
    // Aynı POI'ler, ama LLM FARKLI day atamaları veriyor:
    const research = fixtureResearch();
    // Senaryo A: LLM hepsini gün 1'e koymaya çalışıyor
    const candA = {
      title: "İst",
      summary: "s",
      theme: "T",
      estimatedDays: 2,
      stops: [
        { placeId: "P1", day: 1 },
        { placeId: "P2", day: 1 },
        { placeId: "P3", day: 1 },
        { placeId: "P4", day: 1 },
      ],
    };
    // Senaryo B: LLM rastgele dağıtıyor
    const candB = {
      title: "İst",
      summary: "s",
      theme: "T",
      estimatedDays: 2,
      stops: [
        { placeId: "P1", day: 2 },
        { placeId: "P2", day: 1 },
        { placeId: "P3", day: 1 },
        { placeId: "P4", day: 2 },
      ],
    };
    const rA = mod.buildResearchedRoute(candA, { days: 2, destination: "İst" }, research);
    const rB = mod.buildResearchedRoute(candB, { days: 2, destination: "İst" }, research);
    // k-means coğrafi: Sultanahmet+Ayasofya (güney) bir gün, Galata+Karaköy (kuzey) diğer gün
    // LLM ne derse desin, aynı coğrafi gruplama çıkmalı
    const dayOf = (r, id) => r.stops.find((s) => s.id === id).day;
    assert.equal(dayOf(rA, "p1"), dayOf(rB, "p1"), "p1 günü LLM atamasından bağımsız aynı olmalı");
    assert.equal(dayOf(rA, "p2"), dayOf(rB, "p2"), "p2 günü aynı olmalı");
    assert.equal(dayOf(rA, "p3"), dayOf(rB, "p3"), "p3 günü aynı olmalı");
    // Coğrafi tutarlılık: Sultanahmet(p1) ve Ayasofya(p2) aynı günde (yakınlar)
    assert.equal(
      dayOf(rA, "p1"),
      dayOf(rA, "p2"),
      "yakın POI'ler (Sultanahmet+Ayasofya) aynı günde",
    );
    assert.equal(dayOf(rA, "p3"), dayOf(rA, "p4"), "yakın POI'ler (Galata+Karaköy) aynı günde");
  } finally {
    cleanup();
  }
});

test("I2: determinizm — aynı girdi aynı çıktı", () => {
  const { mod, cleanup } = loadSupervisor();
  try {
    const cand = {
      title: "İst",
      summary: "s",
      theme: "T",
      estimatedDays: 2,
      stops: [{ placeId: "P1" }, { placeId: "P2" }, { placeId: "P3" }, { placeId: "P4" }],
    };
    const r1 = mod.buildResearchedRoute(cand, { days: 2, destination: "İst" }, fixtureResearch());
    const r2 = mod.buildResearchedRoute(cand, { days: 2, destination: "İst" }, fixtureResearch());
    assert.deepEqual(
      r1.stops.map((s) => ({ id: s.id, day: s.day })),
      r2.stops.map((s) => ({ id: s.id, day: s.day })),
    );
  } finally {
    cleanup();
  }
});
