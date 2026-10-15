const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

function loadContracts() {
  const contractsPath = path.resolve(__dirname, "../../../packages/contracts/src/index.ts");
  const dir = path.dirname(contractsPath);
  const cache = new Map();

  function loadFile(filepath) {
    if (cache.has(filepath)) return cache.get(filepath).exports;
    const mod = { exports: {} };
    cache.set(filepath, mod);
    const content = readFileSync(filepath, "utf8");
    const transformed = transformSync(content, { loader: "ts", format: "cjs" }).code;

    vm.runInNewContext(transformed, {
      module: mod,
      exports: mod.exports,
      require(spec) {
        if (spec.startsWith(".")) {
          const resolved = path.resolve(
            path.dirname(filepath),
            spec.endsWith(".ts") ? spec : spec + ".ts",
          );
          return loadFile(resolved);
        }
        return require(spec);
      },
    });

    return mod.exports;
  }

  return loadFile(contractsPath);
}

const contracts = loadContracts();
const {
  CreditWallet,
  Trip,
  RouteStop,
  Coordinate,
  Subscription,
  DomainException,
  InsufficientCreditsException,
  ValidationException,
} = contracts;

test("Coordinate value object validates latitude and longitude boundaries", () => {
  const valid = new Coordinate(41.0082, 28.9784);
  assert.equal(valid.lat, 41.0082);
  assert.equal(valid.lng, 28.9784);

  // Out of bounds
  assert.throws(() => new Coordinate(91, 28), ValidationException);
  assert.throws(() => new Coordinate(-91, 28), ValidationException);
  assert.throws(() => new Coordinate(41, 185), ValidationException);
  assert.throws(() => new Coordinate(NaN, 28), ValidationException);
});

test("CreditWallet aggregate enforces invariants: balance, reservations, and refunds", () => {
  const wallet = new CreditWallet({
    sub: "user-test-123",
    credits: 10,
    welcomeClaimed: false,
    tier: "free",
  });

  assert.equal(wallet.credits, 10);
  assert.equal(wallet.canAfford(5), true);
  assert.equal(wallet.canAfford(15), false);

  // Reserve 5 credits
  wallet.reserve(5);
  assert.equal(wallet.credits, 5);
  assert.equal(wallet.reservedCredits, 5);

  // Settle with actual cost 5
  wallet.settle(5, 5);
  assert.equal(wallet.credits, 5);
  assert.equal(wallet.reservedCredits, 0);

  // Claim welcome gift once
  wallet.claimWelcomeGift(5);
  assert.equal(wallet.credits, 10);
  assert.equal(wallet.welcomeClaimed, true);

  // Re-claiming does not double-add credits
  wallet.claimWelcomeGift(5);
  assert.equal(wallet.credits, 10);

  // Overdraft throws InsufficientCreditsException
  assert.throws(() => wallet.deductCredits(20), InsufficientCreditsException);
});

test("Suspended wallet rejects credit reservations and deductions", () => {
  const suspended = new CreditWallet({
    sub: "user-suspended",
    credits: 100,
    welcomeClaimed: true,
    tier: "pro",
    status: "suspended",
  });

  assert.equal(suspended.isSuspended(), true);
  assert.equal(suspended.canAfford(5), false);
  assert.throws(() => suspended.reserve(5));
  assert.throws(() => suspended.deductCredits(5));
});

test("Trip aggregate root manages stops, computes day durations and validates feasibility", () => {
  const trip = new Trip({
    id: "trip-1",
    title: "Roma Kültür Gezisi",
    destination: "Roma, İtalya",
  });

  const stop1 = new RouteStop({
    id: "stop-1",
    name: "Kolezyum",
    lat: 41.8902,
    lng: 12.4922,
    day: 1,
    estimatedMinutes: 120,
    timeSlot: "morning",
  });

  const stop2 = new RouteStop({
    id: "stop-2",
    name: "Roma Forumu",
    lat: 41.8925,
    lng: 12.4853,
    day: 1,
    estimatedMinutes: 90,
    timeSlot: "afternoon",
  });

  trip.addStop(stop1);
  trip.addStop(stop2);

  assert.equal(trip.stops.length, 2);
  assert.equal(trip.totalDays, 1);
  // 120 + 90 + 15 transit = 225 mins
  assert.equal(trip.calculateDayDurationMinutes(1), 225);
  assert.equal(trip.isDayHeavy(1), false);

  // Converting to DTO
  const dto = trip.toDto();
  assert.equal(dto.title, "Roma Kültür Gezisi");
  assert.equal(dto.stops.length, 2);
  assert.equal(dto.stops[0].name, "Kolezyum");
});

test("Subscription domain aggregate enforces free-tier route limits and credit allowances", () => {
  const freeSub = new Subscription({
    userId: "user-free",
    tier: "free",
    status: "active",
  });

  assert.equal(freeSub.canCreateRoute(2), true);
  assert.equal(freeSub.canCreateRoute(3), false);
  assert.equal(freeSub.getMonthlyCreditAllowance(), 0);
  assert.equal(freeSub.hasPriorityModelAccess(), false);

  const proSub = new Subscription({
    userId: "user-pro",
    tier: "pro",
    status: "active",
  });

  assert.equal(proSub.canCreateRoute(100), true);
  assert.equal(proSub.getMonthlyCreditAllowance(), 500);
  assert.equal(proSub.hasPriorityModelAccess(), true);
});
