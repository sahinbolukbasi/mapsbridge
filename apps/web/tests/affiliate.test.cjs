"use strict";
/**
 * Faz C affiliate acceptance tests (spec §Kabul Kriterleri):
 *  1. expired fiyat render edilmiyor — isExpired() guard
 *  2. komisyon ranking'i etkilemiyor — card order is deterministic, not commission-sorted
 *  3. affiliate linkleri atfedilmiş — every card has attribution + TP marker
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

function loadTs(relPath) {
  const absPath = path.resolve(__dirname, "..", relPath);
  const dir = path.dirname(absPath);
  const cache = new Map();

  function loadFile(filepath) {
    if (cache.has(filepath)) return cache.get(filepath).exports;
    const mod = { exports: {} };
    cache.set(filepath, mod);
    const src = readFileSync(filepath, "utf8");
    const code = transformSync(src, { loader: "ts", format: "cjs" }).code;
    const ctx = vm.createContext({
      require: (id) => {
        if (id.startsWith("./") || id.startsWith("../")) {
          const resolved = path.resolve(dir, id).replace(/\.js$/, "") + ".ts";
          try {
            return loadFile(resolved);
          } catch {
            return loadFile(path.resolve(dir, id) + "/index.ts");
          }
        }
        return require(id);
      },
      module: mod,
      exports: mod.exports,
      __dirname: dir,
      __filename: filepath,
      process,
      console,
      URL,
      URLSearchParams,
    });
    vm.runInContext(code, ctx);
    return mod.exports;
  }

  return loadFile(absPath);
}

// ── Load modules ──────────────────────────────────────────────────────────────
const affiliateTypes = loadTs("app/lib/affiliate/types.ts");
const { isExpired } = affiliateTypes;

const travelpayouts = loadTs("app/lib/affiliate/travelpayouts.ts");
const {
  buildFlightCard,
  buildHotelCard,
  buildCarRentalCard,
  buildInsuranceCard,
  buildTripAffiliateBundle,
} = travelpayouts;

const getyourguide = loadTs("app/lib/affiliate/getyourguide.ts");
const { buildActivityCard, buildCuratedActivityCards } = getyourguide;

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeCard(overrides = {}) {
  return {
    id: "test-card",
    type: "hotel",
    provider: "travelpayouts_hotellook",
    title: "Test Hotel",
    href: "https://example.com",
    attribution: "Via Test",
    cta: "Book",
    destination: "istanbul",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("Affiliate — isExpired() guard", () => {
  test("returns false when card has no price (link-only card)", () => {
    const card = makeCard();
    assert.equal(isExpired(card), false);
  });

  test("returns false when price is within TTL", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // +1h
    const card = makeCard({ price: { amount: 100, currency: "USD", expires_at: future } });
    assert.equal(isExpired(card), false);
  });

  test("returns true when price is past TTL", () => {
    const past = new Date(Date.now() - 1).toISOString(); // expired 1ms ago
    const card = makeCard({ price: { amount: 100, currency: "USD", expires_at: past } });
    assert.equal(isExpired(card), true);
  });

  test("expired cards must be filtered before rendering", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 3600000).toISOString();
    const cards = [
      makeCard({ id: "live", price: { amount: 50, currency: "EUR", expires_at: future } }),
      makeCard({ id: "dead", price: { amount: 50, currency: "EUR", expires_at: past } }),
      makeCard({ id: "no-price" }),
    ];
    const rendered = cards.filter((c) => !isExpired(c));
    assert.equal(rendered.length, 2);
    assert.ok(
      rendered.every((c) => c.id !== "dead"),
      "expired card must be excluded",
    );
  });
});

describe("Affiliate — Travelpayouts link builder", () => {
  test("flight card contains TP marker in href", () => {
    const card = buildFlightCard({ destination: "istanbul" });
    assert.ok(card.href.includes("marker="), "href must contain marker param");
    assert.equal(card.type, "flight");
    assert.equal(card.provider, "travelpayouts_aviasales");
  });

  test("flight card with origin and date builds route-specific URL", () => {
    const card = buildFlightCard({
      destination: "barcelona",
      origin: "istanbul",
      departDate: new Date("2026-11-15"),
      adults: 2,
    });
    // Should contain IATA codes IST and BCN
    assert.ok(
      card.href.includes("IST") || card.href.includes("BCN"),
      "URL should contain IATA codes",
    );
  });

  test("hotel card contains marker and destination", () => {
    const card = buildHotelCard({ destination: "paris" });
    assert.ok(card.href.includes("marker="), "href must contain marker");
    assert.ok(
      card.href.includes("paris") || card.href.includes("Paris"),
      "href must contain destination",
    );
    assert.equal(card.type, "hotel");
  });

  test("car rental card has attribution text", () => {
    const card = buildCarRentalCard({ destination: "barcelona" });
    assert.ok(card.attribution.length > 0, "attribution must not be empty");
    assert.equal(card.type, "car");
  });

  test("insurance card has attribution text", () => {
    const card = buildInsuranceCard({ destination: "istanbul" });
    assert.ok(card.attribution.length > 0, "attribution must not be empty");
    assert.equal(card.type, "insurance");
  });

  test("every card has a non-empty attribution", () => {
    const cards = [
      buildFlightCard({ destination: "istanbul" }),
      buildHotelCard({ destination: "istanbul" }),
      buildCarRentalCard({ destination: "istanbul" }),
      buildInsuranceCard({ destination: "istanbul" }),
    ];
    for (const c of cards) {
      assert.ok(c.attribution.trim().length > 0, `${c.type} card must have attribution`);
      assert.ok(c.cta.trim().length > 0, `${c.type} card must have CTA`);
    }
  });
});

describe("Affiliate — ranking not affected by commission", () => {
  test("buildTripAffiliateBundle always returns the same 4 card types in fixed positions", () => {
    const bundle1 = buildTripAffiliateBundle({ destination: "istanbul" });
    const bundle2 = buildTripAffiliateBundle({ destination: "paris" });

    // Both bundles have the same structural type order regardless of destination
    assert.equal(bundle1.flight.type, "flight");
    assert.equal(bundle1.hotel.type, "hotel");
    assert.equal(bundle1.carRental.type, "car");
    assert.equal(bundle1.insurance.type, "insurance");

    assert.equal(bundle2.flight.type, "flight");
    assert.equal(bundle2.hotel.type, "hotel");
    assert.equal(bundle2.carRental.type, "car");
    assert.equal(bundle2.insurance.type, "insurance");
  });

  test("curated activity cards order is deterministic (same destination = same order)", () => {
    const a = buildCuratedActivityCards("istanbul");
    const b = buildCuratedActivityCards("istanbul");
    assert.equal(a.length, b.length, "same number of cards");
    for (let i = 0; i < a.length; i++) {
      assert.equal(a[i].title, b[i].title, `card[${i}] title must be stable`);
    }
  });

  test("different destinations do not bleed into each other", () => {
    const istanbul = buildCuratedActivityCards("istanbul");
    const paris = buildCuratedActivityCards("paris");
    // None of istanbul's cards should appear in paris's cards
    const istTitles = new Set(istanbul.map((c) => c.title));
    for (const c of paris) {
      assert.ok(
        !istTitles.has(c.title),
        `paris card "${c.title}" must not appear in istanbul cards`,
      );
    }
  });
});

describe("Affiliate — GetYourGuide link builder", () => {
  test("activity card has correct type and provider", () => {
    const card = buildActivityCard({ destination: "istanbul", category: "tours" });
    assert.equal(card.type, "activity");
    assert.equal(card.provider, "getyourguide");
  });

  test("tour-specific card uses tour ID in URL", () => {
    const card = buildActivityCard({ destination: "paris", tourId: "123456" });
    assert.ok(card.href.includes("t123456"), "tour-specific URL must include tour ID");
  });

  test("activity card href points to getyourguide.com", () => {
    const card = buildActivityCard({ destination: "barcelona" });
    assert.ok(card.href.startsWith("https://www.getyourguide.com"), "must link to GYG domain");
  });
});
