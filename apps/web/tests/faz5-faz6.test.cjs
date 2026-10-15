"use strict";
/**
 * Faz 5 + Faz 6 tests:
 *  - budget-tracker.ts  (§11.5)
 *  - reservation-tracker.ts  (§11.2)
 *  - feasibility.ts new §11.1 checks
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

// ---------------------------------------------------------------------------
// esbuild + vm module loader (same pattern as visa.test.cjs)
// ---------------------------------------------------------------------------

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
    });
    vm.runInContext(code, ctx);
    return mod.exports;
  }

  return loadFile(absPath);
}

// ---------------------------------------------------------------------------
// Load modules
// ---------------------------------------------------------------------------

const budgetMod = loadTs("app/lib/ai/budget-tracker.ts");
const resMod = loadTs("app/lib/ai/reservation-tracker.ts");
const feasMod = loadTs("app/lib/ai/feasibility.ts");

const {
  computeBudgetSummary,
  addBudgetLine,
  removeBudgetLine,
  budgetSummaryToPromptSnippet,
  checkBudgetOverrun,
} = budgetMod;

const {
  buildReservationChecklist,
  markReservationConfirmed,
  getUrgentReservations,
  reservationChecklistToPromptSnippet,
} = resMod;

const { validateTripPlanFeasibility } = feasMod;

// ===========================================================================
// §11.5 BudgetTracker
// ===========================================================================

describe("BudgetTracker — computeBudgetSummary", () => {
  test("empty lines produce zeroed summary", () => {
    const s = computeBudgetSummary([], 2, "EUR");
    assert.equal(s.totalEstimate, 0);
    assert.equal(s.totalConfirmed, 0);
    assert.equal(s.perPersonEstimate, 0);
    assert.equal(s.travelers, 2);
    assert.equal(s.currency, "EUR");
  });

  test("estimates sum correctly, confirmed excluded from totalConfirmed", () => {
    const lines = [
      {
        category: "food",
        description: "Lunch",
        amount: 40,
        currency: "EUR",
        isEstimate: true,
        addedAt: "2026-01-01",
      },
      {
        category: "lodging",
        description: "Hotel",
        amount: 120,
        currency: "EUR",
        isEstimate: false,
        addedAt: "2026-01-01",
      },
    ];
    const s = computeBudgetSummary(lines, 2, "EUR");
    // totalEstimate = 40 (estimate) + 120 (confirmed also counts) = 160
    assert.equal(s.totalEstimate, 160);
    assert.equal(s.totalConfirmed, 120);
    assert.equal(s.perPersonEstimate, 80); // 160 / 2
  });

  test("travelers defaults to 1 when 0 passed", () => {
    const s = computeBudgetSummary([], 0, "USD");
    assert.equal(s.travelers, 1);
  });

  test("days field is included when provided", () => {
    const s = computeBudgetSummary([], 2, "EUR", 5);
    assert.equal(s.days, 5);
  });

  test("days field is absent when not provided", () => {
    const s = computeBudgetSummary([], 2, "EUR");
    assert.equal(s.days, undefined);
  });
});

describe("BudgetTracker — addBudgetLine", () => {
  test("immutable: original summary unchanged", () => {
    const original = computeBudgetSummary([], 1, "EUR");
    const updated = addBudgetLine(original, {
      category: "food",
      description: "Coffee",
      amount: 5,
      currency: "EUR",
      isEstimate: true,
      addedAt: "2026-01-01",
    });
    assert.equal(original.totalEstimate, 0);
    assert.equal(updated.totalEstimate, 5);
    assert.equal(updated.lines.length, 1);
  });

  test("adds line and recomputes", () => {
    const s0 = computeBudgetSummary([], 2, "EUR");
    const s1 = addBudgetLine(s0, {
      placeId: "p1",
      category: "entry_ticket",
      description: "Museum",
      amount: 20,
      currency: "EUR",
      isEstimate: false,
      addedAt: "2026-01-01",
    });
    assert.equal(s1.totalConfirmed, 20);
    assert.equal(s1.perPersonEstimate, 10);
  });
});

describe("BudgetTracker — removeBudgetLine", () => {
  test("removes lines by placeId", () => {
    const s0 = computeBudgetSummary(
      [
        {
          placeId: "a",
          category: "food",
          description: "A",
          amount: 30,
          currency: "EUR",
          isEstimate: true,
          addedAt: "2026-01-01",
        },
        {
          placeId: "b",
          category: "transport",
          description: "B",
          amount: 20,
          currency: "EUR",
          isEstimate: true,
          addedAt: "2026-01-01",
        },
      ],
      1,
      "EUR",
    );
    const s1 = removeBudgetLine(s0, "a");
    assert.equal(s1.lines.length, 1);
    assert.equal(s1.totalEstimate, 20);
  });

  test("no-op when placeId not found", () => {
    const s0 = computeBudgetSummary([], 1, "EUR");
    const s1 = removeBudgetLine(s0, "nonexistent");
    assert.equal(s1.lines.length, 0);
  });

  test("lines without placeId are never removed", () => {
    const s0 = computeBudgetSummary(
      [
        {
          category: "food",
          description: "No id",
          amount: 10,
          currency: "EUR",
          isEstimate: true,
          addedAt: "2026-01-01",
        },
      ],
      1,
      "EUR",
    );
    const s1 = removeBudgetLine(s0, "anything");
    assert.equal(s1.lines.length, 1);
  });
});

describe("BudgetTracker — checkBudgetOverrun", () => {
  test("returns null for unspecified budget level", () => {
    const s = computeBudgetSummary([], 1, "EUR");
    assert.equal(checkBudgetOverrun(s, "unspecified"), null);
  });

  test("returns null when within budget threshold", () => {
    // 3 days, 1 person, total 90 EUR → 30/day < 50 budget threshold
    const s = computeBudgetSummary(
      [
        {
          category: "food",
          description: "x",
          amount: 90,
          currency: "EUR",
          isEstimate: true,
          addedAt: "2026-01-01",
        },
      ],
      1,
      "EUR",
      3,
    );
    assert.equal(checkBudgetOverrun(s, "budget"), null);
  });

  test("returns warning string when over budget threshold", () => {
    // 3 days, 1 person, total 600 EUR → 200/day > 150 mid threshold
    const s = computeBudgetSummary(
      [
        {
          category: "lodging",
          description: "Hotel",
          amount: 600,
          currency: "EUR",
          isEstimate: true,
          addedAt: "2026-01-01",
        },
      ],
      1,
      "EUR",
      3,
    );
    const warning = checkBudgetOverrun(s, "mid");
    assert.ok(warning !== null, "should return a warning");
    assert.ok(warning.includes("mid"), "warning should mention budget level");
  });

  test("fallback (no days): warns when total per-person exceeds threshold×3", () => {
    // budget threshold = 50; 50×3 = 150 loose threshold. 200 > 150 → warn
    const s = computeBudgetSummary(
      [
        {
          category: "food",
          description: "x",
          amount: 200,
          currency: "EUR",
          isEstimate: true,
          addedAt: "2026-01-01",
        },
      ],
      1,
      "EUR",
    );
    const warning = checkBudgetOverrun(s, "budget");
    assert.ok(warning !== null);
  });

  test("luxury threshold is 500 EUR/person/day", () => {
    // 1 day, 1 person, 400 EUR → 400 < 500 luxury → no warning
    const s = computeBudgetSummary(
      [
        {
          category: "activity",
          description: "Private tour",
          amount: 400,
          currency: "EUR",
          isEstimate: false,
          addedAt: "2026-01-01",
        },
      ],
      1,
      "EUR",
      1,
    );
    assert.equal(checkBudgetOverrun(s, "luxury"), null);
  });
});

describe("BudgetTracker — budgetSummaryToPromptSnippet", () => {
  test("snippet contains key labels in Turkish", () => {
    const s = computeBudgetSummary(
      [
        {
          category: "food",
          description: "Kahvaltı",
          amount: 15,
          currency: "EUR",
          isEstimate: true,
          addedAt: "2026-01-01",
        },
      ],
      2,
      "EUR",
      3,
    );
    const snippet = budgetSummaryToPromptSnippet(s);
    assert.ok(snippet.includes("Bütçe Özeti"));
    assert.ok(snippet.includes("Toplam Tahmini"));
    assert.ok(snippet.includes("Kişi Başı"));
    assert.ok(snippet.includes("Günlük Kişi Başı"));
    assert.ok(snippet.includes("Kahvaltı"));
  });

  test("overBudgetWarning is included when set", () => {
    const s = { ...computeBudgetSummary([], 1, "EUR"), overBudgetWarning: "Bütçe aşıldı!" };
    const snippet = budgetSummaryToPromptSnippet(s);
    assert.ok(snippet.includes("Bütçe aşıldı!"));
  });
});

// ===========================================================================
// §11.2 ReservationTracker
// ===========================================================================

describe("ReservationTracker — buildReservationChecklist", () => {
  test("missingCount = number of required-but-not-confirmed items", () => {
    const items = [
      { placeId: "p1", placeName: "Louvre", status: "required" },
      { placeId: "p2", placeName: "Eiffel", status: "confirmed" },
      { placeId: "p3", placeName: "Versailles", status: "required" },
    ];
    const cl = buildReservationChecklist(items);
    assert.equal(cl.missingCount, 2);
    assert.equal(cl.urgentCount, 0); // no tripStartDate given
  });

  test("urgentCount = 0 without tripStartDate", () => {
    const items = [{ placeId: "p1", placeName: "Museum", dayIndex: 0, status: "required" }];
    const cl = buildReservationChecklist(items);
    assert.equal(cl.urgentCount, 0);
  });

  test("urgentCount increments for visit within 3 days when tripStartDate given", () => {
    // tripStartDate = today → dayIndex 0 = today = daysUntilVisit 0 < 3 → urgent
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const items = [
      { placeId: "p1", placeName: "Urgent Place", dayIndex: 0, status: "required" },
      { placeId: "p2", placeName: "Far Place", dayIndex: 10, status: "required" },
    ];
    const cl = buildReservationChecklist(items, todayStr);
    assert.equal(cl.urgentCount, 1); // only day 0 is within 3 days
    assert.equal(cl.missingCount, 2);
  });

  test("not_booked status also triggers urgentCount", () => {
    const today = new Date().toISOString().slice(0, 10);
    const items = [{ placeId: "p1", placeName: "Show", dayIndex: 1, status: "not_booked" }];
    const cl = buildReservationChecklist(items, today);
    assert.equal(cl.urgentCount, 1);
    assert.equal(cl.missingCount, 0); // not_booked doesn't count as missing
  });

  test("not_required status is not counted", () => {
    const items = [{ placeId: "p1", placeName: "Park", status: "not_required" }];
    const cl = buildReservationChecklist(items);
    assert.equal(cl.missingCount, 0);
    assert.equal(cl.urgentCount, 0);
  });
});

describe("ReservationTracker — markReservationConfirmed", () => {
  test("sets status to confirmed and stores code", () => {
    const cl = buildReservationChecklist([
      { placeId: "p1", placeName: "Louvre", status: "required" },
    ]);
    const updated = markReservationConfirmed(cl, "p1", "CONF-123");
    assert.equal(updated.items[0].status, "confirmed");
    assert.equal(updated.items[0].confirmationCode, "CONF-123");
  });

  test("decrements missingCount by 1", () => {
    const cl = buildReservationChecklist([
      { placeId: "p1", placeName: "Louvre", status: "required" },
      { placeId: "p2", placeName: "Versailles", status: "required" },
    ]);
    assert.equal(cl.missingCount, 2);
    const updated = markReservationConfirmed(cl, "p1", "X");
    assert.equal(updated.missingCount, 1);
  });

  test("no-op when placeId not found", () => {
    const cl = buildReservationChecklist([]);
    const updated = markReservationConfirmed(cl, "nonexistent", "X");
    assert.equal(updated.missingCount, 0);
    assert.equal(updated.items.length, 0);
  });

  test("immutable: original checklist unchanged", () => {
    const cl = buildReservationChecklist([
      { placeId: "p1", placeName: "Louvre", status: "required" },
    ]);
    markReservationConfirmed(cl, "p1", "X");
    assert.equal(cl.items[0].status, "required");
  });
});

describe("ReservationTracker — getUrgentReservations", () => {
  const items = [
    { placeId: "p1", placeName: "Day1 Museum", dayIndex: 0, status: "required" },
    { placeId: "p2", placeName: "Day5 Concert", dayIndex: 4, status: "required" },
    { placeId: "p3", placeName: "Day1 Park", dayIndex: 0, status: "not_required" },
    { placeId: "p4", placeName: "Day2 Show", dayIndex: 1, status: "not_booked" },
  ];

  test("when daysUntilTrip <= 3, all unconfirmed required/not_booked items returned", () => {
    const cl = buildReservationChecklist(items);
    const urgent = getUrgentReservations(cl, 2);
    // p1, p2 (required), p4 (not_booked) — NOT p3 (not_required)
    assert.equal(urgent.length, 3);
  });

  test("when daysUntilTrip > 3, only dayIndex < 3 items returned", () => {
    const cl = buildReservationChecklist(items);
    const urgent = getUrgentReservations(cl, 10);
    // p1 (day 0, required), p4 (day 1, not_booked) — p2 (day 4) excluded
    const ids = urgent.map((i) => i.placeId).sort();
    assert.deepEqual(ids, ["p1", "p4"]);
  });

  test("confirmed items are never urgent", () => {
    const cl = buildReservationChecklist([
      { placeId: "p1", placeName: "Museum", dayIndex: 0, status: "confirmed" },
    ]);
    const urgent = getUrgentReservations(cl, 0);
    assert.equal(urgent.length, 0);
  });
});

describe("ReservationTracker — reservationChecklistToPromptSnippet", () => {
  test("snippet contains Turkish reservation labels", () => {
    const cl = buildReservationChecklist([
      { placeId: "p1", placeName: "Müze", status: "required", bookingUrl: "https://example.com" },
      { placeId: "p2", placeName: "Park", status: "not_required" },
    ]);
    const snippet = reservationChecklistToPromptSnippet(cl);
    assert.ok(snippet.includes("Rezervasyon Durumu"));
    assert.ok(snippet.includes("Eksik rezervasyon"));
    assert.ok(snippet.includes("Müze"));
    assert.ok(snippet.includes("https://example.com"));
    assert.ok(snippet.includes("Rezervasyon Gerektirmeyen"));
  });

  test("confirmed items appear in Onaylananlar section", () => {
    const cl = buildReservationChecklist([
      { placeId: "p1", placeName: "Louvre", status: "required" },
    ]);
    const confirmed = markReservationConfirmed(cl, "p1", "CONF-999");
    const snippet = reservationChecklistToPromptSnippet(confirmed);
    assert.ok(snippet.includes("Onaylananlar"));
    assert.ok(snippet.includes("CONF-999"));
  });
});

// ===========================================================================
// §11.1 Feasibility — new checks
// ===========================================================================

function makePlan(blocks, date = "2026-11-10", weatherNote = "Açık") {
  return {
    trip_id: "test",
    days: [{ date, weather_note: weatherNote, blocks }],
    budget_summary: { total: 0, currency: "EUR" },
    sources: [],
  };
}

describe("Feasibility — last entry time rule (LAST_ENTRY_VIOLATION)", () => {
  test("no issue when block starts > 60 min before closing", () => {
    const plan = makePlan([
      {
        time: "09:00-11:00",
        type: "museum",
        place_id: "p1",
        name: "Louvre",
        why: "test",
        closingTime: "18:00",
      },
    ]);
    const r = validateTripPlanFeasibility(plan);
    const hasLastEntry = r.issues.some((i) => i.code === "LAST_ENTRY_VIOLATION");
    assert.equal(hasLastEntry, false);
  });

  test("warning when block starts 31-59 min before closing", () => {
    // Block starts at 17:10, closing 18:00 → 50 min before
    const plan = makePlan([
      {
        time: "17:10-17:50",
        type: "museum",
        place_id: "p1",
        name: "Müze",
        why: "test",
        closingTime: "18:00",
      },
    ]);
    const r = validateTripPlanFeasibility(plan);
    const issue = r.issues.find((i) => i.code === "LAST_ENTRY_VIOLATION");
    assert.ok(issue, "should have LAST_ENTRY_VIOLATION issue");
    assert.equal(issue.severity, "warning");
  });

  test("error when block starts < 30 min before closing", () => {
    // Block starts at 17:40, closing 18:00 → 20 min before
    const plan = makePlan([
      {
        time: "17:40-17:55",
        type: "museum",
        place_id: "p1",
        name: "Müze",
        why: "test",
        closingTime: "18:00",
      },
    ]);
    const r = validateTripPlanFeasibility(plan);
    const issue = r.issues.find((i) => i.code === "LAST_ENTRY_VIOLATION");
    assert.ok(issue, "should have LAST_ENTRY_VIOLATION issue");
    assert.equal(issue.severity, "error");
  });
});

describe("Feasibility — minimum visit duration (MIN_VISIT_DURATION)", () => {
  test("no issue when block duration >= minVisitMinutes", () => {
    const plan = makePlan([
      {
        time: "10:00-12:00",
        type: "museum",
        place_id: "p1",
        name: "Büyük Müze",
        why: "test",
        minVisitMinutes: 90,
      },
    ]);
    const r = validateTripPlanFeasibility(plan);
    assert.equal(
      r.issues.some((i) => i.code === "MIN_VISIT_DURATION"),
      false,
    );
  });

  test("warning when block duration < minVisitMinutes", () => {
    // Block = 30 min, min = 90 min
    const plan = makePlan([
      {
        time: "10:00-10:30",
        type: "museum",
        place_id: "p1",
        name: "Küçük Müze",
        why: "test",
        minVisitMinutes: 90,
      },
    ]);
    const r = validateTripPlanFeasibility(plan);
    const issue = r.issues.find((i) => i.code === "MIN_VISIT_DURATION");
    assert.ok(issue, "should have MIN_VISIT_DURATION issue");
    assert.equal(issue.severity, "warning");
    assert.ok(issue.message.includes("90"));
  });
});

describe("Feasibility — meal gap check (MEAL_GAP)", () => {
  test("no issue when day has food block within 8 hours", () => {
    const plan = makePlan([
      { time: "09:00-10:00", type: "museum", place_id: "p1", name: "Museum", why: "test" },
      { time: "13:00-14:00", type: "restaurant", place_id: "p2", name: "Lunch", why: "test" },
    ]);
    const r = validateTripPlanFeasibility(plan);
    assert.equal(
      r.issues.some((i) => i.code === "MEAL_GAP"),
      false,
    );
  });

  test("warning when entire day has no food block and spans 8+ hours", () => {
    const plan = makePlan([
      { time: "09:00-11:00", type: "museum", place_id: "p1", name: "Museum 1", why: "test" },
      { time: "12:00-14:00", type: "museum", place_id: "p2", name: "Museum 2", why: "test" },
      { time: "15:00-18:00", type: "park", place_id: "p3", name: "Park", why: "test" },
    ]);
    const r = validateTripPlanFeasibility(plan);
    const issue = r.issues.find((i) => i.code === "MEAL_GAP");
    assert.ok(issue, "should warn about missing food block");
  });

  test("warning when gap between food blocks exceeds 8 hours", () => {
    const plan = makePlan([
      { time: "08:00-09:00", type: "cafe", place_id: "p1", name: "Kahvaltı", why: "test" },
      { time: "09:30-11:00", type: "museum", place_id: "p2", name: "Museum", why: "test" },
      // No food until 17:30 → gap from 09:00 to 17:30 = 8.5 hours
      { time: "17:30-18:30", type: "restaurant", place_id: "p3", name: "Akşam", why: "test" },
    ]);
    const r = validateTripPlanFeasibility(plan);
    const issue = r.issues.find((i) => i.code === "MEAL_GAP");
    assert.ok(issue, "should warn about meal gap between food blocks");
  });

  test("no issue when day is less than 8 hours total", () => {
    const plan = makePlan([
      { time: "10:00-11:00", type: "museum", place_id: "p1", name: "Museum", why: "test" },
      { time: "11:30-13:00", type: "park", place_id: "p2", name: "Park", why: "test" },
    ]);
    const r = validateTripPlanFeasibility(plan);
    assert.equal(
      r.issues.some((i) => i.code === "MEAL_GAP"),
      false,
    );
  });
});

describe("Feasibility — walking budget check (WALKING_BUDGET)", () => {
  test("no issue when walking is within 15 km", () => {
    // 10 min walking = 10 * 83 = 830 m, well within 15 km
    const plan = makePlan([
      {
        time: "09:00-10:00",
        type: "cafe",
        place_id: "p1",
        name: "Kafe",
        why: "test",
        transit: { mode: "walking", minutes: 10 },
      },
    ]);
    const r = validateTripPlanFeasibility(plan);
    assert.equal(
      r.issues.some((i) => i.code === "WALKING_BUDGET"),
      false,
    );
  });

  test("warning when walking exceeds 15 km (>180 min walking)", () => {
    // 200 min walking = 200 * 83 = 16,600 m > 15,000 m
    const blocks = Array.from({ length: 4 }, (_, i) => ({
      time: `${9 + i * 2}:00-${9 + i * 2 + 1}:00`,
      type: "activity",
      place_id: `p${i}`,
      name: `Activity ${i}`,
      why: "test",
      transit: { mode: "walking", minutes: 50 },
    }));
    const plan = makePlan(blocks);
    const r = validateTripPlanFeasibility(plan);
    const issue = r.issues.find((i) => i.code === "WALKING_BUDGET");
    assert.ok(issue, "should warn about excessive walking");
    assert.equal(issue.severity, "warning");
  });
});

describe("Feasibility — closed days check (CLOSED_DAY)", () => {
  test("no issue when place is open on that day", () => {
    // 2026-11-10 is a Tuesday (weekday=2 → "tuesday")
    const plan = makePlan([
      {
        time: "10:00-12:00",
        type: "museum",
        place_id: "p1",
        name: "Museum",
        why: "test",
        closedDays: ["monday"],
      },
    ]);
    const r = validateTripPlanFeasibility(plan);
    assert.equal(
      r.issues.some((i) => i.code === "CLOSED_DAY"),
      false,
    );
  });

  test("error when place is closed on that day", () => {
    // 2026-11-10 is a Tuesday
    const plan = makePlan([
      {
        time: "10:00-12:00",
        type: "museum",
        place_id: "p1",
        name: "Kapalı Müze",
        why: "test",
        closedDays: ["tuesday"],
      },
    ]);
    const r = validateTripPlanFeasibility(plan);
    const issue = r.issues.find((i) => i.code === "CLOSED_DAY");
    assert.ok(issue, "should flag closed day");
    assert.equal(issue.severity, "error");
    assert.ok(issue.message.includes("tuesday"));
  });
});

describe("Feasibility — geographic coherence check (GEO_INCOHERENCE)", () => {
  test("no issue when consecutive stops are within 20 km", () => {
    // Istanbul Sultanahmet to Beyoğlu ~3 km
    const plan = makePlan([
      {
        time: "09:00-11:00",
        type: "museum",
        place_id: "p1",
        name: "Ayasofya",
        why: "test",
        lat: 41.0085,
        lng: 28.9802,
      },
      {
        time: "12:00-13:00",
        type: "restaurant",
        place_id: "p2",
        name: "Beyoğlu",
        why: "test",
        lat: 41.0331,
        lng: 28.9777,
      },
    ]);
    const r = validateTripPlanFeasibility(plan);
    assert.equal(
      r.issues.some((i) => i.code === "GEO_INCOHERENCE"),
      false,
    );
  });

  test("warning when consecutive stops are > 20 km apart", () => {
    // Istanbul (~41, 29) to Ankara (~39.9, 32.8) → ~350 km
    const plan = makePlan([
      {
        time: "09:00-11:00",
        type: "museum",
        place_id: "p1",
        name: "İstanbul Müze",
        why: "test",
        lat: 41.0,
        lng: 29.0,
      },
      {
        time: "12:00-14:00",
        type: "museum",
        place_id: "p2",
        name: "Ankara Müze",
        why: "test",
        lat: 39.9,
        lng: 32.8,
      },
    ]);
    const r = validateTripPlanFeasibility(plan);
    const issue = r.issues.find((i) => i.code === "GEO_INCOHERENCE");
    assert.ok(issue, "should warn about geographically distant stops");
    assert.equal(issue.severity, "warning");
    assert.ok(issue.message.includes("km"));
  });

  test("no issue when blocks have no coordinates", () => {
    const plan = makePlan([
      { time: "09:00-11:00", type: "museum", place_id: "p1", name: "Museum A", why: "test" },
      { time: "12:00-14:00", type: "museum", place_id: "p2", name: "Museum B", why: "test" },
    ]);
    const r = validateTripPlanFeasibility(plan);
    assert.equal(
      r.issues.some((i) => i.code === "GEO_INCOHERENCE"),
      false,
    );
  });
});

describe("Feasibility — existing checks still work after refactor", () => {
  test("valid plan returns isValid=true with score 1.0", () => {
    const plan = {
      trip_id: "ok",
      days: [
        {
          date: "2026-11-10",
          weather_note: "Güneşli",
          blocks: [
            {
              time: "09:00-10:00",
              type: "cafe",
              place_id: "p1",
              name: "Kahve",
              why: "x",
              est_cost: 5,
            },
            {
              time: "10:30-12:30",
              type: "museum",
              place_id: "p2",
              name: "Müze",
              why: "x",
              est_cost: 15,
              transit: { mode: "walking", minutes: 20 },
            },
            {
              time: "13:00-14:00",
              type: "restaurant",
              place_id: "p3",
              name: "Öğle",
              why: "x",
              est_cost: 20,
            },
          ],
        },
      ],
      budget_summary: { total: 40, currency: "EUR" },
      sources: [],
    };
    const r = validateTripPlanFeasibility(plan);
    assert.equal(r.isValid, true);
    assert.equal(r.score, 1.0);
  });

  test("time overlap is still detected", () => {
    const plan = makePlan([
      { time: "09:00-11:00", type: "museum", place_id: "p1", name: "A", why: "x" },
      { time: "10:00-12:00", type: "museum", place_id: "p2", name: "B", why: "x" },
    ]);
    const r = validateTripPlanFeasibility(plan);
    assert.ok(r.issues.some((i) => i.code === "TIME_OVERLAP"));
    assert.equal(r.isValid, false);
  });
});
