const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

function loadModule(fullPath, cache) {
  if (!cache) cache = new Map();
  const resolved = fullPath.endsWith(".ts") ? fullPath : fullPath + ".ts";
  if (cache.has(resolved)) return cache.get(resolved).exports;

  const code = readFileSync(resolved, "utf8");
  const transformed = transformSync(code, { loader: "ts", format: "cjs" }).code;
  const mod = { exports: {} };
  cache.set(resolved, mod);

  vm.runInNewContext(transformed, {
    module: mod,
    exports: mod.exports,
    require(spec) {
      // domain/types is type-only; no runtime values needed
      if (spec.includes("domain/types")) return {};
      if (spec.startsWith(".")) {
        const target = path.resolve(
          path.dirname(resolved),
          spec.endsWith(".ts") ? spec : spec + ".ts",
        );
        return loadModule(target, cache);
      }
      return require(spec);
    },
    console,
    process,
    Buffer,
    setTimeout,
    clearTimeout,
    Math,
  });
  return mod.exports;
}

const normalizerPath = path.resolve(
  __dirname,
  "../src/application/normalizer.ts",
);
const {
  categoryFromOsmTags,
  inferTiming,
  deduplicatePlaces,
  rankPlaces,
} = loadModule(normalizerPath);

// ── categoryFromOsmTags ─────────────────────────────────────────────────────

test("categoryFromOsmTags identifies restaurant by amenity tag", () => {
  assert.equal(categoryFromOsmTags({ amenity: "restaurant" }), "restaurant");
});

test("categoryFromOsmTags identifies restaurant by cuisine tag", () => {
  assert.equal(categoryFromOsmTags({ cuisine: "turkish" }), "restaurant");
});

test("categoryFromOsmTags identifies museum", () => {
  assert.equal(categoryFromOsmTags({ tourism: "museum" }), "museum");
});

test("categoryFromOsmTags identifies mosque by religion", () => {
  assert.equal(
    categoryFromOsmTags({ amenity: "place_of_worship", religion: "muslim" }),
    "mosque",
  );
});

test("categoryFromOsmTags returns other for unknown tags", () => {
  assert.equal(categoryFromOsmTags({ building: "yes" }), "other");
});

// ── inferTiming ─────────────────────────────────────────────────────────────

test("inferTiming returns morning slot for museum", () => {
  const timing = inferTiming("museum", "Istanbul Modern");
  assert.equal(timing.recommendedSlot, "morning");
  assert.equal(timing.typicalDurationMins, 120);
});

test("inferTiming returns evening slot for bar", () => {
  const timing = inferTiming("bar", "Jazz Bar");
  assert.equal(timing.recommendedSlot, "evening");
});

test("inferTiming returns morning for breakfast restaurant", () => {
  const timing = inferTiming("restaurant", "Van Kahvaltı Evi");
  // "kahvaltı" is a breakfast keyword (Turkish dotless ı)
  assert.equal(timing.recommendedSlot, "morning");
  assert.equal(timing.typicalDurationMins, 60);
});

test("inferTiming returns any for unknown category", () => {
  const timing = inferTiming("hospital", "City Hospital");
  assert.equal(timing.recommendedSlot, "any");
});

// ── deduplicatePlaces ───────────────────────────────────────────────────────

function makeFakePlace(overrides) {
  return {
    id: "p1",
    sourceId: "src-1",
    source: "osm",
    name: "Test Place",
    lat: 41.0082,
    lng: 28.9784,
    city: "Istanbul",
    country: "Turkey",
    category: "restaurant",
    subcategories: [],
    tags: [],
    typicalDurationMins: 60,
    recommendedSlot: "afternoon",
    collectedAt: "2024-01-01",
    updatedAt: "2024-01-01",
    ttl: 86400,
    ...overrides,
  };
}

test("deduplicatePlaces merges duplicates within proximity + name similarity", () => {
  const places = [
    makeFakePlace({
      id: "p1",
      name: "Blue Mosque",
      lat: 41.0054,
      lng: 28.9768,
      rating: 4.8,
      phone: null,
    }),
    makeFakePlace({
      id: "p2",
      name: "Blue Mosque",
      lat: 41.0054,
      lng: 28.9769, // ~10m away
      rating: null,
      phone: "+905551234567",
    }),
  ];
  const result = deduplicatePlaces(places);
  assert.equal(result.length, 1);
  // Merged: rating from first, phone from second
  assert.equal(result[0].rating, 4.8);
  assert.equal(result[0].phone, "+905551234567");
});

test("deduplicatePlaces keeps distinct places that are far apart", () => {
  const places = [
    makeFakePlace({
      id: "p1",
      name: "Blue Mosque",
      lat: 41.0054,
      lng: 28.9768,
    }),
    makeFakePlace({
      id: "p2",
      name: "Blue Mosque",
      lat: 41.05,
      lng: 29.05, // several km away
    }),
  ];
  const result = deduplicatePlaces(places);
  assert.equal(result.length, 2);
});

test("deduplicatePlaces returns empty array for empty input", () => {
  assert.equal(deduplicatePlaces([]).length, 0);
});

// ── rankPlaces ──────────────────────────────────────────────────────────────

test("rankPlaces sorts by composite data richness score (rating, reviews, etc.)", () => {
  const places = [
    makeFakePlace({ id: "poor", rating: 3.0, reviewCount: 5 }),
    makeFakePlace({
      id: "rich",
      rating: 4.8,
      reviewCount: 500,
      description: "Great place",
      photos: [{ url: "a.jpg" }, { url: "b.jpg" }],
      openingHours: { monday: { open: "09:00", close: "17:00" } },
      phone: "+90555",
      website: "https://example.com",
    }),
  ];
  const ranked = rankPlaces(places);
  assert.equal(ranked[0].id, "rich");
  assert.equal(ranked[1].id, "poor");
});
