const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

function loadEngine() {
  const file = path.resolve(__dirname, "../src/application/scoring-engine.ts");
  const code = readFileSync(file, "utf8");
  const transformed = transformSync(code, { loader: "ts", format: "cjs", target: "node22" }).code;
  const mod = { exports: {} };
  vm.runInNewContext(transformed, {
    module: mod, exports: mod.exports,
    require, console, Math, Number, JSON,
  });
  return mod.exports.RecommendationScoringEngine;
}

const Engine = loadEngine();

const perfectRestaurant = {
  userPreferenceMatch: 1.0,
  localExperienceScore: 1.0,
  dietCompatibility: 1.0,
  isOpenAtPlannedTime: true,
  distanceFromRouteMeters: 0,
  travelRouteCompatibility: 1.0,
  reviewQualityScore: 1.0,
  priceMatchesBudget: true,
  normalizedRating: 1.0,
};

// ─── Restaurant scoring ───────────────────────────────────────────

test("perfect restaurant scores close to 1.0", () => {
  const score = Engine.calculateRestaurantScore(perfectRestaurant);
  assert.ok(score > 0.9, `Expected > 0.9, got ${score}`);
  assert.ok(score <= 1.0);
});

test("diet incompatibility (<=0) returns 0", () => {
  const score = Engine.calculateRestaurantScore({ ...perfectRestaurant, dietCompatibility: 0 });
  assert.equal(score, 0.0);
});

test("closed restaurant gets heavily penalized", () => {
  const open = Engine.calculateRestaurantScore({ ...perfectRestaurant, isOpenAtPlannedTime: true });
  const closed = Engine.calculateRestaurantScore({ ...perfectRestaurant, isOpenAtPlannedTime: false });
  assert.ok(closed < open, `closed (${closed}) should be less than open (${open})`);
});

test("distance > 3000m reduces score", () => {
  const near = Engine.calculateRestaurantScore({ ...perfectRestaurant, distanceFromRouteMeters: 0 });
  const far = Engine.calculateRestaurantScore({ ...perfectRestaurant, distanceFromRouteMeters: 5000 });
  assert.ok(far < near, `far (${far}) should be less than near (${near})`);
});

test("budget mismatch reduces score", () => {
  const matches = Engine.calculateRestaurantScore({ ...perfectRestaurant, priceMatchesBudget: true });
  const noMatch = Engine.calculateRestaurantScore({ ...perfectRestaurant, priceMatchesBudget: false });
  assert.ok(noMatch < matches);
});

test("score is rounded to 2 decimal places", () => {
  const score = Engine.calculateRestaurantScore(perfectRestaurant);
  assert.equal(score, Math.round(score * 100) / 100);
});

test("all-zero inputs with diet > 0 returns non-negative score", () => {
  const score = Engine.calculateRestaurantScore({
    userPreferenceMatch: 0,
    localExperienceScore: 0,
    dietCompatibility: 0.1,
    isOpenAtPlannedTime: false,
    distanceFromRouteMeters: 9999,
    travelRouteCompatibility: 0,
    reviewQualityScore: 0,
    priceMatchesBudget: false,
    normalizedRating: 0,
  });
  assert.ok(score >= 0);
});

// ─── Place scoring ────────────────────────────────────────────────

const perfectPlace = {
  interestMatch: 1.0,
  localUniqueness: 1.0,
  tripScheduleCompatibility: 1.0,
  weatherCompatibility: 1.0,
  distanceFromPreviousStopMeters: 0,
  crowdLevelAvoidance: 1.0,
};

test("perfect place scores close to 1.0", () => {
  const score = Engine.calculatePlaceScore(perfectPlace);
  assert.ok(score > 0.9, `Expected > 0.9, got ${score}`);
  assert.ok(score <= 1.0);
});

test("distance > 5000m reduces place score", () => {
  const near = Engine.calculatePlaceScore({ ...perfectPlace, distanceFromPreviousStopMeters: 0 });
  const far = Engine.calculatePlaceScore({ ...perfectPlace, distanceFromPreviousStopMeters: 7000 });
  assert.ok(far < near);
});

test("low interest match lowers place score significantly", () => {
  const high = Engine.calculatePlaceScore({ ...perfectPlace, interestMatch: 1.0 });
  const low = Engine.calculatePlaceScore({ ...perfectPlace, interestMatch: 0.0 });
  assert.ok(low < high);
  // interestMatch weight is 0.3 — difference should be ~0.3
  assert.ok(high - low >= 0.28);
});

test("place score is rounded to 2 decimal places", () => {
  const score = Engine.calculatePlaceScore(perfectPlace);
  assert.equal(score, Math.round(score * 100) / 100);
});
