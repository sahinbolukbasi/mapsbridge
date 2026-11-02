const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");
const crypto = require("node:crypto");

function loadModule(filePath) {
  const code = readFileSync(path.resolve(__dirname, filePath), "utf8");
  const transformed = transformSync(code, { loader: "ts", format: "cjs", target: "node22" }).code;
  const mod = { exports: {} };
  vm.runInNewContext(transformed, {
    module: mod,
    exports: mod.exports,
    require(spec) {
      if (spec === "./models" || spec === "./models.ts")
        return loadModule("../app/lib/trip/models.ts");
      if (spec === "../ai/types" || spec === "../ai/types.ts") return {};
      if (spec === "./domain" || spec === "./domain.ts")
        return loadModule("../app/lib/trip/domain.ts");
      return {};
    },
    crypto,
    Math,
    Number,
    Array,
    Object,
    Set,
    Map,
    JSON,
    Error,
    String,
    RegExp,
    parseInt,
    parseFloat,
    console,
  });
  return mod.exports;
}

function getWorkspaceStore() {
  return loadModule("../app/lib/trip/workspace-store.ts");
}

function getDomain() {
  return loadModule("../app/lib/trip/domain.ts");
}

// --- validCoordinates ---

test("validCoordinates accepts valid lat/lng", () => {
  const { validCoordinates } = getWorkspaceStore();
  assert.equal(validCoordinates(41.0, 29.0), true, "Istanbul coords");
  assert.equal(validCoordinates(0, 0), true, "origin");
  assert.equal(validCoordinates(90, 180), true, "max positive bounds");
  assert.equal(validCoordinates(-90, -180), true, "max negative bounds");
});

test("validCoordinates rejects invalid values", () => {
  const { validCoordinates } = getWorkspaceStore();
  assert.equal(validCoordinates(NaN, 29), false, "NaN lat");
  assert.equal(validCoordinates(41, NaN), false, "NaN lng");
  assert.equal(validCoordinates(Infinity, 29), false, "Infinity lat");
  assert.equal(validCoordinates(41, -Infinity), false, "-Infinity lng");
  assert.equal(validCoordinates("41", "29"), false, "string values");
  assert.equal(validCoordinates(null, 29), false, "null lat");
  assert.equal(validCoordinates(41, undefined), false, "undefined lng");
  assert.equal(validCoordinates(91, 0), false, "lat out of range (+91)");
  assert.equal(validCoordinates(-91, 0), false, "lat out of range (-91)");
  assert.equal(validCoordinates(0, 181), false, "lng out of range (+181)");
  assert.equal(validCoordinates(0, -181), false, "lng out of range (-181)");
});

// --- normalizeCategory ---

test("normalizeCategory maps aliases and defaults unknown to genel", () => {
  const { normalizeCategory } = getWorkspaceStore();
  assert.equal(normalizeCategory("lezzet"), "yemek", "lezzet -> yemek");
  assert.equal(normalizeCategory("gurme"), "gastronomi", "gurme -> gastronomi");
  assert.equal(normalizeCategory("cafe"), "kahve", "cafe -> kahve");
  assert.equal(normalizeCategory("gece"), "eglence", "gece -> eglence");
  // "gezi" is itself a valid PinCategory in DEFAULT_CATEGORY_META, so it passes through
  assert.equal(normalizeCategory("gezi"), "gezi", "gezi is a valid category, passes through");
  assert.equal(normalizeCategory("tarih"), "tarih", "valid category passes through");
  assert.equal(normalizeCategory("muze"), "muze", "valid category passes through");
  assert.equal(normalizeCategory("unknown"), "genel", "unknown -> genel");
  assert.equal(normalizeCategory("foo"), "genel", "arbitrary string -> genel");
});

// --- parseWorkspace ---

test("parseWorkspace returns empty workspace for null/empty", () => {
  const { parseWorkspace } = getWorkspaceStore();

  const fromNull = parseWorkspace(null);
  assert.equal(fromNull.trips.length, 0);
  assert.equal(fromNull.generalPins.length, 0);
  assert.equal(fromNull.imports.length, 0);
  assert.equal(fromNull.version, 1);
  assert.equal(fromNull.activeTripId, "");
  assert.equal(fromNull.activeDayIndex, 0);

  const fromEmpty = parseWorkspace("");
  assert.equal(fromEmpty.trips.length, 0);
  assert.equal(fromEmpty.generalPins.length, 0);
  assert.equal(fromEmpty.imports.length, 0);
  assert.equal(fromEmpty.version, 1);
});

test("parseWorkspace throws on invalid data", () => {
  const { parseWorkspace } = getWorkspaceStore();

  // wrong version
  assert.throws(
    () => parseWorkspace(JSON.stringify({ version: 2, trips: [], generalPins: [], imports: [] })),
    /Kayıtlı plan okunamadı/,
    "version !== 1",
  );

  // missing trips array
  assert.throws(
    () =>
      parseWorkspace(
        JSON.stringify({ version: 1, trips: "not-array", generalPins: [], imports: [] }),
      ),
    /Kayıtlı plan okunamadı/,
    "trips not an array",
  );

  // missing generalPins array
  assert.throws(
    () => parseWorkspace(JSON.stringify({ version: 1, trips: [], generalPins: "x", imports: [] })),
    /Kayıtlı plan okunamadı/,
    "generalPins not an array",
  );

  // missing imports array
  assert.throws(
    () => parseWorkspace(JSON.stringify({ version: 1, trips: [], generalPins: [], imports: null })),
    /Kayıtlı plan okunamadı/,
    "imports not an array",
  );

  // duplicate trip IDs
  const dupTrip = {
    id: "trip-1",
    title: "Trip",
    pins: [],
    days: [],
    groups: [],
    transportMode: "walking",
    isPublic: false,
  };
  assert.throws(
    () =>
      parseWorkspace(
        JSON.stringify({
          version: 1,
          trips: [dupTrip, dupTrip],
          generalPins: [],
          imports: [],
        }),
      ),
    /Gezi kaydı geçersiz/,
    "duplicate trip IDs",
  );

  // invalid pin coordinates inside generalPins
  assert.throws(
    () =>
      parseWorkspace(
        JSON.stringify({
          version: 1,
          trips: [],
          generalPins: [{ id: "p1", label: "X", address: "A", lat: NaN, lng: 29 }],
          imports: [],
        }),
      ),
    /Konum kaydı geçersiz/,
    "invalid pin coordinates",
  );

  // invalid day indexes (dayIndex < 1)
  assert.throws(
    () =>
      parseWorkspace(
        JSON.stringify({
          version: 1,
          trips: [
            {
              id: "t1",
              title: "T",
              pins: [],
              groups: [],
              days: [{ dayIndex: 0, label: "Day 0", color: "#fff", pins: [] }],
              transportMode: "walking",
              isPublic: false,
            },
          ],
          generalPins: [],
          imports: [],
        }),
      ),
    /Gezi günleri geçersiz/,
    "dayIndex < 1",
  );
});

// --- isValidPlaceRef ---

test("isValidPlaceRef validates place references", () => {
  const { isValidPlaceRef } = getDomain();

  // valid ref
  const valid = {
    id: "google:ChIJLdqEqJC5yhQRlOcaHNkz-nY",
    source: "google_places",
    name: "Hagia Sophia",
    lat: 41.008583,
    lng: 28.980175,
    confidence: "high",
    retrievedAt: "2026-01-01T00:00:00Z",
  };
  assert.equal(isValidPlaceRef(valid), true, "valid Google place ref");

  // overture prefix
  assert.equal(isValidPlaceRef({ ...valid, id: "overture:place/abc" }), true, "overture prefix");

  // fsq prefix
  assert.equal(isValidPlaceRef({ ...valid, id: "fsq:abc123" }), true, "fsq prefix");

  // manual prefix
  assert.equal(isValidPlaceRef({ ...valid, id: "manual:custom-1" }), true, "manual prefix");

  // invalid: missing prefix
  assert.equal(isValidPlaceRef({ ...valid, id: "ChIJ-no-prefix" }), false, "missing prefix");

  // invalid: empty name
  assert.equal(isValidPlaceRef({ ...valid, name: "" }), false, "empty name");

  // invalid: whitespace-only name
  assert.equal(isValidPlaceRef({ ...valid, name: "   " }), false, "whitespace-only name");

  // invalid: NaN lat
  assert.equal(isValidPlaceRef({ ...valid, lat: NaN }), false, "NaN lat");

  // invalid: lng out of range
  assert.equal(isValidPlaceRef({ ...valid, lng: 200 }), false, "lng out of range");

  // invalid: missing retrievedAt
  assert.equal(
    isValidPlaceRef({ id: "google:abc", source: "google_places", name: "X", lat: 41, lng: 29 }),
    false,
    "missing retrievedAt",
  );

  // invalid: null input
  assert.equal(isValidPlaceRef(null), false, "null");
  assert.equal(isValidPlaceRef(undefined), false, "undefined");
  assert.equal(isValidPlaceRef("string"), false, "string");
});

// --- routeToTrip ---

test("routeToTrip creates trip from valid route plan", () => {
  const { routeToTrip } = getWorkspaceStore();

  const route = {
    title: "Istanbul Tarih Turu",
    summary: "2 durak, 1 gun",
    theme: "Tarih",
    destination: "Istanbul",
    estimatedDays: 1,
    stops: [
      {
        name: "Ayasofya",
        lat: 41.008583,
        lng: 28.980175,
        day: 1,
        description: "Tarihi yapit",
        suggestedDuration: "1.5 saat",
        category: "tarih",
        address: "Sultanahmet",
      },
      {
        name: "Topkapi Sarayi",
        lat: 41.011667,
        lng: 28.983333,
        day: 1,
        description: "Osmanli sarayi",
        suggestedDuration: "120 dakika",
        category: "muze",
        address: "Fatih",
      },
    ],
  };

  const trip = routeToTrip(route, "test-trip-1");

  assert.equal(trip.id, "test-trip-1");
  assert.equal(trip.title, "Istanbul Tarih Turu");
  assert.equal(trip.destination, "Istanbul");
  assert.equal(trip.theme, "Tarih");
  assert.equal(trip.transportMode, "walking");
  assert.equal(trip.isPublic, false);
  assert.equal(trip.days.length, 1);
  assert.equal(trip.pins.length, 2);

  // first pin
  const pin0 = trip.pins.find((p) => p.label === "Ayasofya");
  assert.ok(pin0, "Ayasofya pin exists");
  assert.equal(pin0.lat, 41.008583);
  assert.equal(pin0.lng, 28.980175);
  assert.equal(pin0.category, "tarih");
  assert.equal(pin0.dayIndex, 1);
  assert.equal(pin0.durationMinutes, 90, "1.5 saat = 90 minutes");

  // second pin
  const pin1 = trip.pins.find((p) => p.label === "Topkapi Sarayi");
  assert.ok(pin1, "Topkapi pin exists");
  assert.equal(pin1.category, "muze");
  assert.equal(pin1.durationMinutes, 120, "120 dakika = 120 minutes");

  // day structure
  assert.equal(trip.days[0].dayIndex, 1);
  assert.equal(trip.days[0].pins.length, 2);
});

test("routeToTrip rejects invalid routes", () => {
  const { routeToTrip } = getWorkspaceStore();

  const validStop = {
    name: "Ayasofya",
    lat: 41.008583,
    lng: 28.980175,
    day: 1,
    description: "Test",
    suggestedDuration: "60",
    category: "tarih",
    address: "Sultanahmet",
  };

  // no title
  assert.throws(
    () =>
      routeToTrip(
        {
          title: "",
          summary: "",
          theme: "",
          destination: "X",
          estimatedDays: 1,
          stops: [validStop],
        },
        "id-1",
      ),
    /AI planı geçerli günler ve duraklar içermeli/,
    "empty title",
  );

  // whitespace-only title
  assert.throws(
    () =>
      routeToTrip(
        {
          title: "   ",
          summary: "",
          theme: "",
          destination: "X",
          estimatedDays: 1,
          stops: [validStop],
        },
        "id-2",
      ),
    /AI planı geçerli günler ve duraklar içermeli/,
    "whitespace-only title",
  );

  // empty stops
  assert.throws(
    () =>
      routeToTrip(
        {
          title: "Valid Title",
          summary: "",
          theme: "",
          destination: "X",
          estimatedDays: 1,
          stops: [],
        },
        "id-3",
      ),
    /AI planı geçerli günler ve duraklar içermeli/,
    "empty stops",
  );

  // estimatedDays = 0
  assert.throws(
    () =>
      routeToTrip(
        {
          title: "Valid Title",
          summary: "",
          theme: "",
          destination: "X",
          estimatedDays: 0,
          stops: [validStop],
        },
        "id-4",
      ),
    /AI planı geçerli günler ve duraklar içermeli/,
    "estimatedDays = 0",
  );

  // estimatedDays = 31
  assert.throws(
    () =>
      routeToTrip(
        {
          title: "Valid Title",
          summary: "",
          theme: "",
          destination: "X",
          estimatedDays: 31,
          stops: [validStop],
        },
        "id-5",
      ),
    /AI planı geçerli günler ve duraklar içermeli/,
    "estimatedDays = 31",
  );

  // estimatedDays not integer
  assert.throws(
    () =>
      routeToTrip(
        {
          title: "Valid Title",
          summary: "",
          theme: "",
          destination: "X",
          estimatedDays: 1.5,
          stops: [validStop],
        },
        "id-6",
      ),
    /AI planı geçerli günler ve duraklar içermeli/,
    "estimatedDays not integer",
  );

  // stop with invalid coordinates
  assert.throws(
    () =>
      routeToTrip(
        {
          title: "Valid Title",
          summary: "",
          theme: "",
          destination: "X",
          estimatedDays: 1,
          stops: [{ ...validStop, lat: NaN }],
        },
        "id-7",
      ),
    /AI planında geçersiz konum veya gün var/,
    "stop with NaN lat",
  );

  // stop with day out of range
  assert.throws(
    () =>
      routeToTrip(
        {
          title: "Valid Title",
          summary: "",
          theme: "",
          destination: "X",
          estimatedDays: 1,
          stops: [{ ...validStop, day: 2 }],
        },
        "id-8",
      ),
    /AI planında geçersiz konum veya gün var/,
    "stop day exceeds estimatedDays",
  );
});
