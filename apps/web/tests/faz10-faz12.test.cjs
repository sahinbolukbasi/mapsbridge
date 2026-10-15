"use strict";
/**
 * Faz 10, 11, 12 tests
 *
 * Covers:
 *  §11.7  — accessibility.ts
 *  §11.9  — local-context.ts
 *  §11.12 — plan-quality-score.ts
 *  §11.10 — trip/export.ts
 *  §14    — monetization-eval.ts
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

// ── Module loader (shared pattern from faz3-faz9.test.cjs) ──────────────────

function loadTs(relPath) {
  const absPath = path.resolve(__dirname, "..", relPath);
  const cache = new Map();

  function loadFile(filepath) {
    if (cache.has(filepath)) return cache.get(filepath).exports;
    const mod = { exports: {} };
    cache.set(filepath, mod);
    const src = readFileSync(filepath, "utf8");
    const code = transformSync(src, { loader: "ts", format: "cjs" }).code;
    const fileDir = path.dirname(filepath);
    const ctx = vm.createContext({
      require: (id) => {
        if (id.startsWith("./") || id.startsWith("../")) {
          const candidates = [
            path.resolve(fileDir, id) + ".ts",
            path.resolve(fileDir, id, "index.ts"),
          ];
          for (const c of candidates) {
            try {
              return loadFile(c);
            } catch (_) {}
          }
          throw new Error(`Cannot resolve ${id} from ${filepath}`);
        }
        if (id === "node:crypto") return require("node:crypto");
        return require(id);
      },
      module: mod,
      exports: mod.exports,
      __dirname: fileDir,
      __filename: filepath,
      process,
      console,
      URL,
      URLSearchParams,
      Set,
      Map,
      Date,
    });
    vm.runInContext(code, ctx);
    return mod.exports;
  }

  return loadFile(absPath);
}

// ── Load modules ─────────────────────────────────────────────────────────────

const accessibility = loadTs("app/lib/ai/accessibility.ts");
const localCtx = loadTs("app/lib/ai/local-context.ts");
const planQuality = loadTs("app/lib/ai/plan-quality-score.ts");
const exportLib = loadTs("app/lib/trip/export.ts");
const monetization = loadTs("app/lib/ai/monetization-eval.ts");

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePlace(overrides = {}) {
  return {
    id: "p_001",
    name: "Test Place",
    category: "museum",
    hasElevator: true,
    hasRamp: true,
    cobblestone: false,
    ...overrides,
  };
}

function makeProfile(needs = [], extras = {}) {
  return { needs, ...extras };
}

function makeBlock(overrides = {}) {
  return {
    time: "10:00-11:00",
    type: "museum",
    place_id: "p_001",
    name: "Topkapi Palace",
    why: "Historic gem",
    ...overrides,
  };
}

function makePlan(dayOverrides = []) {
  const days =
    dayOverrides.length > 0
      ? dayOverrides
      : [
          {
            date: "2025-06-01",
            weather_note: "Sunny",
            blocks: [
              makeBlock({ type: "museum", place_id: "p1", name: "Museum A" }),
              makeBlock({
                type: "restaurant",
                place_id: "p2",
                name: "Restaurant B",
                time: "13:00-14:00",
              }),
              makeBlock({ type: "park", place_id: "p3", name: "Park C", time: "15:00-16:00" }),
            ],
          },
        ];

  return {
    trip_id: "trip_test_001",
    days,
    budget_summary: { total: 500, currency: "EUR" },
    sources: ["source1", "source2"],
  };
}

function makeTripProfile(extras = {}) {
  return {
    interests: { food: ["Turkish cuisine"], culture: ["history"] },
    pace: "moderate",
    completeness: 80,
    ...extras,
  };
}

// ── Tests: accessibility.ts ───────────────────────────────────────────────────

describe("accessibility.ts", () => {
  test("no needs → empty checks", () => {
    const places = [makePlace()];
    const profile = makeProfile([]);
    const result = accessibility.checkPlanAccessibility(places, profile);
    assert.strictEqual(result.length, 0);
  });

  test("wheelchair + no elevator in museum → blocking", () => {
    const places = [makePlace({ hasElevator: false, category: "museum" })];
    const profile = makeProfile(["wheelchair"]);
    const result = accessibility.checkPlanAccessibility(places, profile);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].severity, "blocking");
  });

  test("wheelchair + cobblestone → warning", () => {
    const places = [makePlace({ cobblestone: true, category: "park", hasElevator: true })];
    const profile = makeProfile(["wheelchair"]);
    const result = accessibility.checkPlanAccessibility(places, profile);
    assert.ok(result.length >= 1);
    assert.ok(result.some((r) => r.severity === "warning"));
  });

  test("elderly + cobblestone → warning", () => {
    const places = [makePlace({ cobblestone: true, category: "park" })];
    const profile = makeProfile(["elderly"]);
    const result = accessibility.checkPlanAccessibility(places, profile);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].severity, "warning");
  });

  test("stroller + no ramp in museum → warning", () => {
    const places = [makePlace({ hasRamp: false, category: "museum" })];
    const profile = makeProfile(["stroller"], { requiresRamp: false });
    const result = accessibility.checkPlanAccessibility(places, profile);
    assert.ok(result.length >= 1);
  });

  test("buildAccessibilityPromptSnippet returns non-empty string for wheelchair", () => {
    const profile = makeProfile(["wheelchair"], { requiresElevator: true, maxWalkingMinutes: 20 });
    const snippet = accessibility.buildAccessibilityPromptSnippet(profile);
    assert.ok(snippet.includes("wheelchair"));
    assert.ok(snippet.includes("20"));
  });

  test("buildAccessibilityPromptSnippet returns empty string for no needs", () => {
    const snippet = accessibility.buildAccessibilityPromptSnippet(makeProfile([]));
    assert.strictEqual(snippet, "");
  });

  test("getTempoForProfile — wheelchair → relaxed", () => {
    assert.strictEqual(accessibility.getTempoForProfile(makeProfile(["wheelchair"])), "relaxed");
  });

  test("getTempoForProfile — elderly → relaxed", () => {
    assert.strictEqual(accessibility.getTempoForProfile(makeProfile(["elderly"])), "relaxed");
  });

  test("getTempoForProfile — children_5_12 → moderate", () => {
    assert.strictEqual(
      accessibility.getTempoForProfile(makeProfile(["children_5_12"])),
      "moderate",
    );
  });

  test("getTempoForProfile — no needs → fast", () => {
    assert.strictEqual(accessibility.getTempoForProfile(makeProfile([])), "fast");
  });
});

// ── Tests: local-context.ts ───────────────────────────────────────────────────

describe("local-context.ts", () => {
  test("getLocalContext istanbul returns ≥5 entries", () => {
    const entries = localCtx.getLocalContext("istanbul");
    assert.ok(entries.length >= 5, `Expected ≥5, got ${entries.length}`);
  });

  test("getLocalContext barcelona returns ≥5 entries", () => {
    const entries = localCtx.getLocalContext("barcelona");
    assert.ok(entries.length >= 5, `Expected ≥5, got ${entries.length}`);
  });

  test("getLocalContext paris returns ≥5 entries", () => {
    const entries = localCtx.getLocalContext("paris");
    assert.ok(entries.length >= 5, `Expected ≥5, got ${entries.length}`);
  });

  test("getLocalContext rome returns ≥5 entries", () => {
    const entries = localCtx.getLocalContext("rome");
    assert.ok(entries.length >= 5, `Expected ≥5, got ${entries.length}`);
  });

  test("rome has a critical ZTL entry", () => {
    const entries = localCtx.getLocalContext("rome");
    const ztl = entries.find((e) => e.severity === "critical" && /ZTL/i.test(e.title));
    assert.ok(ztl, "Expected a critical ZTL entry for Rome");
  });

  test("istanbul has a mosque dress_code entry", () => {
    const entries = localCtx.getLocalContext("istanbul");
    const mosque = entries.find((e) => e.category === "dress_code");
    assert.ok(mosque, "Expected a dress_code entry for Istanbul");
  });

  test("localContextToPromptSnippet returns heading line", () => {
    const entries = localCtx.getLocalContext("rome");
    const snippet = localCtx.localContextToPromptSnippet(entries);
    assert.ok(snippet.includes("Yerel Bağlam"));
  });

  test("localContextToPromptSnippet places critical entries first", () => {
    const entries = localCtx.getLocalContext("rome");
    const snippet = localCtx.localContextToPromptSnippet(entries);
    const ztlPos = snippet.indexOf("ZTL");
    const infoPos = snippet.indexOf("ℹ️");
    // ztl (critical) should appear before the first info entry
    if (infoPos !== -1) {
      assert.ok(ztlPos < infoPos, "Critical entries should appear before info entries");
    }
  });

  test("unknown city returns empty array", () => {
    const entries = localCtx.getLocalContext("timbuktu");
    assert.strictEqual(entries.length, 0);
  });

  test("city lookup is case-insensitive", () => {
    const lower = localCtx.getLocalContext("istanbul");
    const upper = localCtx.getLocalContext("Istanbul");
    assert.strictEqual(lower.length, upper.length);
  });

  test("all entries have body ≤150 chars", () => {
    ["istanbul", "barcelona", "paris", "rome"].forEach((city) => {
      const entries = localCtx.getLocalContext(city);
      for (const e of entries) {
        assert.ok(
          e.body.length <= 150,
          `${city}/${e.title}: body too long (${e.body.length} chars)`,
        );
      }
    });
  });

  test("categories are valid", () => {
    const valid = new Set([
      "etiquette",
      "safety",
      "practical",
      "language",
      "food_culture",
      "dress_code",
    ]);
    ["istanbul", "barcelona", "paris", "rome"].forEach((city) => {
      for (const e of localCtx.getLocalContext(city)) {
        assert.ok(valid.has(e.category), `${city}/${e.title}: invalid category "${e.category}"`);
      }
    });
  });
});

// ── Tests: plan-quality-score.ts ─────────────────────────────────────────────

describe("plan-quality-score.ts", () => {
  test("scorePlan returns all fields", () => {
    const plan = makePlan();
    const profile = makeTripProfile();
    const score = planQuality.scorePlan(plan, profile, []);
    assert.ok(typeof score.overall === "number");
    assert.ok(typeof score.geoEfficiency === "number");
    assert.ok(typeof score.densityBalance === "number");
    assert.ok(typeof score.profileMatch === "number");
    assert.ok(typeof score.feasibilityCompliance === "number");
    assert.ok(typeof score.sourcedInfoRatio === "number");
    assert.ok(Array.isArray(score.details));
  });

  test("overall is in [0, 100]", () => {
    const score = planQuality.scorePlan(makePlan(), makeTripProfile(), []);
    assert.ok(score.overall >= 0 && score.overall <= 100);
  });

  test("no feasibility issues → feasibilityCompliance = 100", () => {
    const score = planQuality.scorePlan(makePlan(), makeTripProfile(), []);
    assert.strictEqual(score.feasibilityCompliance, 100);
  });

  test("2 errors → feasibilityCompliance = 60", () => {
    const issues = [
      { severity: "error", code: "TIME_OVERLAP", message: "err1" },
      { severity: "error", code: "EXCESSIVE_DURATION", message: "err2" },
    ];
    const score = planQuality.scorePlan(makePlan(), makeTripProfile(), issues);
    assert.strictEqual(score.feasibilityCompliance, 60);
  });

  test("4 errors → feasibilityCompliance = 20", () => {
    const issues = Array.from({ length: 4 }, (_, i) => ({
      severity: "error",
      code: "TIME_OVERLAP",
      message: `err${i}`,
    }));
    const score = planQuality.scorePlan(makePlan(), makeTripProfile(), issues);
    assert.strictEqual(score.feasibilityCompliance, 20);
  });

  test("1 warning → feasibilityCompliance = 95", () => {
    const issues = [{ severity: "warning", code: "MISSING_WEATHER_ALT", message: "warn" }];
    const score = planQuality.scorePlan(makePlan(), makeTripProfile(), issues);
    assert.strictEqual(score.feasibilityCompliance, 95);
  });

  test("relaxed pace + >5 stops/day reduces profileMatch", () => {
    const manyBlocks = Array.from({ length: 7 }, (_, i) =>
      makeBlock({ type: "museum", place_id: `p${i}`, name: `Place ${i}` }),
    );
    const plan = makePlan([{ date: "2025-06-01", weather_note: "", blocks: manyBlocks }]);
    const profile = makeTripProfile({ pace: "relaxed" });
    const score = planQuality.scorePlan(plan, profile, []);
    assert.ok(score.profileMatch < 100);
  });

  test("ideal 3-5 stops/day → densityBalance = 100", () => {
    const plan = makePlan(); // 3 stops
    const score = planQuality.scorePlan(plan, makeTripProfile(), []);
    assert.strictEqual(score.densityBalance, 100);
  });

  test("8+ stops/day → densityBalance < 70", () => {
    const manyBlocks = Array.from({ length: 8 }, (_, i) =>
      makeBlock({ type: "museum", place_id: `p${i}`, name: `Place ${i}` }),
    );
    const plan = makePlan([{ date: "2025-06-01", weather_note: "", blocks: manyBlocks }]);
    const score = planQuality.scorePlan(plan, makeTripProfile(), []);
    assert.ok(score.densityBalance < 70, `Expected <70, got ${score.densityBalance}`);
  });

  test("qualityScoreToPromptSnippet returns a single-line string with key tokens", () => {
    const score = planQuality.scorePlan(makePlan(), makeTripProfile(), []);
    const snippet = planQuality.qualityScoreToPromptSnippet(score);
    assert.ok(snippet.includes("overall="));
    assert.ok(snippet.includes("geo="));
    assert.ok(snippet.includes("density="));
    assert.ok(!snippet.includes("\n"));
  });
});

// ── Tests: trip/export.ts ─────────────────────────────────────────────────────

describe("trip/export.ts", () => {
  test("buildShareableExport returns valid structure", () => {
    const plan = makePlan();
    const ex = exportLib.buildShareableExport(plan);
    assert.ok(typeof ex.title === "string");
    assert.ok(Array.isArray(ex.days));
    assert.strictEqual(ex.days.length, 1);
    assert.ok(ex.days[0].stops.length > 0);
    assert.ok(typeof ex.exportedAt === "string");
  });

  test("buildShareableExport skips transit blocks", () => {
    const blocks = [
      makeBlock({ type: "museum", place_id: "p1", name: "Museum" }),
      makeBlock({ type: "transit", place_id: "p2", name: "Walk" }),
    ];
    const plan = makePlan([{ date: "2025-06-01", weather_note: "", blocks }]);
    const ex = exportLib.buildShareableExport(plan);
    assert.strictEqual(ex.days[0].stops.length, 1);
    assert.strictEqual(ex.days[0].stops[0].name, "Museum");
  });

  test("exportToICS starts with BEGIN:VCALENDAR", () => {
    const ex = exportLib.buildShareableExport(makePlan());
    const ics = exportLib.exportToICS(ex);
    assert.ok(ics.startsWith("BEGIN:VCALENDAR"));
    assert.ok(ics.includes("END:VCALENDAR"));
  });

  test("exportToICS contains VEVENT for each stop", () => {
    const ex = exportLib.buildShareableExport(makePlan());
    const ics = exportLib.exportToICS(ex);
    const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
    assert.ok(eventCount > 0);
  });

  test("exportToMarkdown contains title and day label", () => {
    const ex = exportLib.buildShareableExport(makePlan());
    const md = exportLib.exportToMarkdown(ex);
    assert.ok(md.includes("#"));
    assert.ok(md.includes("Gün 1"));
  });

  test("exportToMarkdown lists stop names", () => {
    const ex = exportLib.buildShareableExport(makePlan());
    const md = exportLib.exportToMarkdown(ex);
    assert.ok(md.includes("Museum A"));
    assert.ok(md.includes("Restaurant B"));
  });

  test("buildTravelWallet contains SEYAHAT CÜZDANI header", () => {
    const ex = exportLib.buildShareableExport(makePlan());
    const wallet = exportLib.buildTravelWallet(ex);
    assert.ok(wallet.includes("SEYAHAT CÜZDANI"));
  });

  test("buildShareableExport with notes overrides why", () => {
    const plan = makePlan();
    const notes = { p1: "Custom note for museum" };
    const ex = exportLib.buildShareableExport(plan, notes);
    const stop = ex.days[0].stops.find((s) => s.name === "Museum A");
    assert.ok(stop);
    assert.strictEqual(stop.notes, "Custom note for museum");
  });
});

// ── Tests: monetization-eval.ts ───────────────────────────────────────────────

describe("monetization-eval.ts", () => {
  test("empty list passes with score 100", () => {
    const result = monetization.checkNeutrality([]);
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.score, 100);
    assert.strictEqual(result.violations.length, 0);
  });

  test("all non-partner recommendations pass", () => {
    const recs = [
      { name: "A", rank: 1, hasPartnerLink: false, userRelevanceScore: 95 },
      { name: "B", rank: 2, hasPartnerLink: false, userRelevanceScore: 80 },
    ];
    const result = monetization.checkNeutrality(recs);
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.violations.length, 0);
  });

  test("partner ranked above more-relevant non-partner → violation", () => {
    const recs = [
      {
        name: "Partner Hotel",
        rank: 1,
        hasPartnerLink: true,
        partnerCommission: 20,
        userRelevanceScore: 60,
      },
      { name: "Better Hotel", rank: 2, hasPartnerLink: false, userRelevanceScore: 90 },
    ];
    const result = monetization.checkNeutrality(recs);
    assert.strictEqual(result.passed, false);
    assert.ok(result.violations.length > 0);
    assert.ok(result.score < 100);
  });

  test("partner ranked below less-relevant non-partner → no violation", () => {
    const recs = [
      { name: "Best Hotel", rank: 1, hasPartnerLink: false, userRelevanceScore: 92 },
      {
        name: "Partner Hotel",
        rank: 2,
        hasPartnerLink: true,
        partnerCommission: 20,
        userRelevanceScore: 70,
      },
    ];
    const result = monetization.checkNeutrality(recs);
    assert.strictEqual(result.passed, true);
  });

  test("score decreases with each violation", () => {
    const recs = [
      { name: "P1", rank: 1, hasPartnerLink: true, partnerCommission: 30, userRelevanceScore: 40 },
      { name: "P2", rank: 2, hasPartnerLink: true, partnerCommission: 20, userRelevanceScore: 30 },
      { name: "NP1", rank: 3, hasPartnerLink: false, userRelevanceScore: 95 },
      { name: "NP2", rank: 4, hasPartnerLink: false, userRelevanceScore: 85 },
    ];
    const result = monetization.checkNeutrality(recs);
    assert.ok(result.violations.length > 0);
    assert.ok(result.score < 75);
  });

  test("buildNeutralityWarning returns non-empty string", () => {
    const warning = monetization.buildNeutralityWarning();
    assert.ok(typeof warning === "string");
    assert.ok(warning.length > 20);
  });

  test("buildNeutralityWarning mentions MapsBridge", () => {
    const warning = monetization.buildNeutralityWarning();
    assert.ok(warning.includes("MapsBridge"));
  });

  test("neutral ordering passes even with partner links", () => {
    const recs = [
      {
        name: "Top Relevant (partner)",
        rank: 1,
        hasPartnerLink: true,
        partnerCommission: 10,
        userRelevanceScore: 98,
      },
      { name: "Second Relevant", rank: 2, hasPartnerLink: false, userRelevanceScore: 85 },
      {
        name: "Third",
        rank: 3,
        hasPartnerLink: true,
        partnerCommission: 5,
        userRelevanceScore: 70,
      },
    ];
    const result = monetization.checkNeutrality(recs);
    assert.strictEqual(result.passed, true);
  });
});
