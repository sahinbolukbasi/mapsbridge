const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync, buildSync } = require("esbuild");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");

function loadAiCore() {
  const dir = mkdtempSync(path.join(tmpdir(), "mb-aicore-"));
  const out = path.join(dir, "aicore.cjs");
  buildSync({
    entryPoints: [path.resolve(__dirname, "../../../packages/ai-core/src/index.ts")],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    outfile: out,
  });
  const mod = require(out);
  return { mod, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function loadSupervisor() {
  const dir = mkdtempSync(path.join(tmpdir(), "mb-sup-"));
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

test("packages/ai-core: 4-katmanlı Bedrock matrisi, AgentCore bellek ve 12 alt ajan tam tanımlı", () => {
  const { mod, cleanup } = loadAiCore();
  try {
    assert.equal(Object.keys(mod.BEDROCK_MODEL_MATRIX).length, 4);
    assert.equal(mod.BEDROCK_MODEL_MATRIX.tier1.modelId, "eu.amazon.nova-micro-v1:0");
    assert.equal(mod.BEDROCK_MODEL_MATRIX.tier2.modelId, "eu.amazon.nova-lite-v1:0");
    assert.equal(
      mod.BEDROCK_MODEL_MATRIX.tier3.modelId,
      "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
    );
    assert.equal(
      mod.BEDROCK_MODEL_MATRIX.tier4.modelId,
      "eu.anthropic.claude-3-5-sonnet-20241022-v2:0",
    );

    assert.equal(mod.AGENTCORE_MEMORY_NAMESPACES.length, 4);
    assert.equal(mod.AGENTCORE_HARNESS_STAGES.length, 8);
    assert.equal(mod.UNIFIED_SUB_AGENT_CATALOG.length, 12);
    for (const sa of mod.UNIFIED_SUB_AGENT_CATALOG) {
      assert.equal(sa.wired, true, `${sa.id} wired olmalı`);
      assert.equal(sa.enabledByDefault, true, `${sa.id} varsayılan aktif olmalı`);
    }
  } finally {
    cleanup();
  }
});

test("packages/ai-core: Küratörlü şehir istihbaratı doğrulanmış koordinat ve yerel ipucu döner", () => {
  const { mod, cleanup } = loadAiCore();
  try {
    for (const cityQuery of [
      "İstanbul",
      "Roma",
      "Paris",
      "Barselona",
      "Kapadokya",
      "Antalya",
      "İzmir",
      "Londra",
      "Tokyo",
      "Amsterdam",
    ]) {
      const intel = mod.findCityIntelligence(cityQuery);
      assert.ok(intel, `${cityQuery} için şehir istihbaratı bulunmalı`);
      assert.ok(intel.places.length >= 4, `${cityQuery} en az 4 doğrulanmış mekan içermeli`);
      const selected = mod.selectCuratedPlacesForTrip(cityQuery, {
        days: 3,
        interests: ["food", "history"],
      });
      assert.ok(selected.length >= 4);
      for (const p of selected) {
        assert.ok(Number.isFinite(p.lat) && Math.abs(p.lat) <= 90);
        assert.ok(Number.isFinite(p.lng) && Math.abs(p.lng) <= 180);
        assert.ok(p.localTip.length > 10);
      }
    }
  } finally {
    cleanup();
  }
});

test("2D Principal-Axis Kümeleme: Doğu-Batı (İstanbul Boğaz geçişi) duraklarını farklı günlere ayırır", () => {
  const { mod, cleanup } = loadSupervisor();
  try {
    // Aynı enlemde (~41.00) ama Boğaz'ın iki yakasında (Avrupa: ~28.97, Anadolu: ~29.025) duraklar
    const eastWestResearch = {
      places: [
        {
          id: "eu1",
          name: "Ayasofya",
          lat: 41.0086,
          lng: 28.9802,
          address: "Fatih",
          category: "history",
          typicalDurationMins: 75,
        },
        {
          id: "eu2",
          name: "Yerebatan Sarnıcı",
          lat: 41.0084,
          lng: 28.9779,
          address: "Fatih",
          category: "culture",
          typicalDurationMins: 50,
        },
        {
          id: "as1",
          name: "Kadıköy Çarşı",
          lat: 40.9896,
          lng: 29.0242,
          address: "Kadıköy",
          category: "food",
          typicalDurationMins: 75,
        },
        {
          id: "as2",
          name: "Moda Sahili",
          lat: 40.9794,
          lng: 29.0252,
          address: "Kadıköy",
          category: "relax",
          typicalDurationMins: 60,
        },
      ],
    };

    const candidate = {
      title: "İstanbul İki Yaka",
      summary: "Test",
      theme: "Kültür",
      estimatedDays: 2,
      stops: [
        { placeId: "P1", day: 1 },
        { placeId: "P3", day: 1 }, // LLM yanlışlıkla Kadıköy'ü 1. güne koymuş
        { placeId: "P2", day: 2 },
        { placeId: "P4", day: 2 },
      ],
    };

    const route = mod.buildResearchedRoute(
      candidate,
      { days: 2, destination: "İstanbul" },
      eastWestResearch,
    );
    const dayOf = (id) => route.stops.find((s) => s.id === id).day;
    assert.equal(dayOf("eu1"), dayOf("eu2"), "Avrupa yakası durakları aynı günde toplanmalı");
    assert.equal(dayOf("as1"), dayOf("as2"), "Anadolu yakası durakları aynı günde toplanmalı");
    assert.notEqual(dayOf("eu1"), dayOf("as1"), "İki yaka farklı günlere ayrılmalı (zikzak önleme)");
  } finally {
    cleanup();
  }
});

test("filterGeographicOutliers: şehir merkezinden 50km uzaktaki hatalı durağı temizler", () => {
  const { mod, cleanup } = loadAiCore();
  try {
    const stops = [
      { id: "1", lat: 41.8902, lng: 12.4922 }, // Kolezyum
      { id: "2", lat: 41.8986, lng: 12.4769 }, // Pantheon
      { id: "3", lat: 41.9009, lng: 12.4833 }, // Trevi
      { id: "4", lat: 41.8992, lng: 12.4731 }, // Navona
      { id: "5", lat: 41.8894, lng: 12.4696 }, // Trastevere
      { id: "outlier", lat: 42.45, lng: 12.9 }, // ~70 km uzakta hatalı eşleşme
    ];
    const filtered = mod.filterGeographicOutliers(stops, { maxRadiusKm: 28, minKeepCount: 4 });
    assert.equal(filtered.length, 5);
    assert.equal(
      filtered.some((s) => s.id === "outlier"),
      false,
      "70 km uzaktaki aykırı durak elenmeli",
    );
  } finally {
    cleanup();
  }
});

test("packages/ai-core: İzole AI Lab ve 7/24 Otonom Ajanlar eksiksiz yapılandırılmış", () => {
  const { mod, cleanup } = loadAiCore();
  try {
    const lab = mod.DEFAULT_ISOLATED_AI_LAB_STATE;
    assert.equal(lab.autonomousMode24x7, true);
    assert.equal(lab.daemons.length, 6);
    assert.equal(lab.vectorDb.namespaces.length, 4);
    assert.equal(lab.rag.hybridSearchEnabled, true);
    assert.equal(lab.fineTuning.piiScrubbingEnforced, true);
  } finally {
    cleanup();
  }
});

