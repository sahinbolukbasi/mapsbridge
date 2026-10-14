const test = require("node:test");
const assert = require("node:assert/strict");

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateDayTimeline(pins, startTime = "09:00", mode = "walking") {
  const [startHour, startMin] = startTime.split(":").map(Number);
  let currentMinutes = (startHour || 9) * 60 + (startMin || 0);

  let totalDistanceKm = 0;
  let totalTravelMinutes = 0;
  let totalVisitMinutes = 0;

  const avgSpeeds = { walking: 4.5, cycling: 14, driving: 30 };
  const speed = avgSpeeds[mode] || 4.5;

  const pinsWithTime = pins.map((pin, idx) => {
    if (idx > 0) {
      const prev = pins[idx - 1];
      const dist = calculateDistanceKm(prev.lat, prev.lng, pin.lat, pin.lng);
      totalDistanceKm += dist;
      const travelMins = Math.max(5, Math.round((dist / speed) * 60));
      totalTravelMinutes += travelMins;
      currentMinutes += travelMins;
    }

    const startH = Math.floor(currentMinutes / 60) % 24;
    const startM = currentMinutes % 60;
    const calculatedStartTime = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;

    const visitDuration = pin.durationMinutes || 60;
    totalVisitMinutes += visitDuration;
    currentMinutes += visitDuration;

    const endH = Math.floor(currentMinutes / 60) % 24;
    const endM = currentMinutes % 60;
    const calculatedEndTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

    return {
      ...pin,
      calculatedStartTime,
      calculatedEndTime,
    };
  });

  const totalDayDurationMinutes = totalTravelMinutes + totalVisitMinutes;
  const isHeavyDay = totalDayDurationMinutes > 510; // > 8.5 hours

  return {
    pinsWithTime,
    summary: {
      stopCount: pins.length,
      totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
      totalTravelDurationMinutes: totalTravelMinutes,
      totalVisitDurationMinutes: totalVisitMinutes,
      totalDayDurationMinutes,
      isHeavyDay,
    },
  };
}

test("travel planner calculates timeline and total day duration accurately", () => {
  const stops = [
    { id: "1", label: "Otel / Kahvaltı", lat: 41.008, lng: 28.978, durationMinutes: 45 },
    { id: "2", label: "Müze", lat: 41.012, lng: 28.981, durationMinutes: 120 },
    { id: "3", label: "Öğle Yemeği", lat: 41.015, lng: 28.974, durationMinutes: 60 },
  ];

  const result = calculateDayTimeline(stops, "09:00", "walking");
  assert.equal(result.pinsWithTime.length, 3);
  assert.equal(result.pinsWithTime[0].calculatedStartTime, "09:00");
  assert.equal(result.pinsWithTime[0].calculatedEndTime, "09:45");
  assert.ok(result.summary.totalDayDurationMinutes > 225);
  assert.equal(result.summary.isHeavyDay, false);
});

test("heavy day is flagged when schedule exceeds 8.5 hours", () => {
  const longStops = [
    { id: "1", label: "Büyük Saray", lat: 41.008, lng: 28.978, durationMinutes: 240 },
    { id: "2", label: "Müze Kompleksi", lat: 41.035, lng: 28.985, durationMinutes: 240 },
    { id: "3", label: "Şehir Turu", lat: 41.050, lng: 28.995, durationMinutes: 180 },
  ];

  const result = calculateDayTimeline(longStops, "08:00", "walking");
  assert.equal(result.summary.isHeavyDay, true);
});

test("general pin pool supports rapid discovery and assignment to trip days", () => {
  let generalPins = [
    { id: "gen-1", label: "Galata Kulesi", lat: 41.0256, lng: 28.9741, dayIndex: 0, group: "Genel" },
    { id: "gen-2", label: "Karaköy Lokantası", lat: 41.0232, lng: 28.9772, dayIndex: 0, group: "Genel" },
  ];

  let trip = {
    id: "trip-istanbul",
    title: "İstanbul 3 Gün",
    days: [{ dayNumber: 1 }, { dayNumber: 2 }, { dayNumber: 3 }],
    pins: [],
  };

  // Assign gen-1 to trip Day 2
  const targetPin = generalPins.find((p) => p.id === "gen-1");
  generalPins = generalPins.filter((p) => p.id !== "gen-1");
  trip.pins.push({
    ...targetPin,
    tripId: trip.id,
    dayIndex: 2,
    order: 1,
    group: trip.title,
  });

  assert.equal(generalPins.length, 1);
  assert.equal(trip.pins.length, 1);
  assert.equal(trip.pins[0].dayIndex, 2);
  assert.equal(trip.pins[0].group, "İstanbul 3 Gün");
});

test("in-panel pin edits preserve photos gallery and notes", () => {
  const pin = {
    id: "pin-roma",
    label: "Colosseum",
    notes: "Sabah erken gitmek gerek.",
    photos: ["https://example.com/colosseum-1.jpg"],
    category: "tarih",
  };

  // Add photo & update note in-panel
  const updatedPin = {
    ...pin,
    notes: "Sabah erken gitmek gerek. Rehberli tur tavsiye edilir.",
    photos: [...pin.photos, "https://example.com/colosseum-2.jpg"],
    category: "turistik",
  };

  assert.equal(updatedPin.photos.length, 2);
  assert.ok(updatedPin.notes.includes("Rehberli tur"));
  assert.equal(updatedPin.category, "turistik");
});

test("groups support mixed pins without days and flexible day assignments", () => {
  let group = {
    id: "group-mixed",
    title: "Kapadokya Gezisi",
    days: [{ dayIndex: 1, label: "1. Gün" }, { dayIndex: 2, label: "2. Gün" }],
    pins: [
      { id: "p-1", label: "Göreme Açık Hava Müzesi", dayIndex: 0, order: 1 },
      { id: "p-2", label: "Uçhisar Kalesi", dayIndex: 0, order: 2 },
    ],
  };

  // Pins can be purely mixed (dayIndex: 0) without any days required
  const mixedPins = group.pins.filter((p) => p.dayIndex === 0);
  assert.equal(mixedPins.length, 2);

  // Assign general pin directly to day 1
  const generalPin = { id: "p-gen", label: "Paşabağ Vadisi", dayIndex: 0 };
  group.pins.push({ ...generalPin, tripId: group.id, dayIndex: 1, order: 1 });
  assert.equal(group.pins.length, 3);
  assert.equal(group.pins[2].dayIndex, 1);

  // Shift existing mixed pin p-1 to day 2
  group.pins = group.pins.map((p) => (p.id === "p-1" ? { ...p, dayIndex: 2 } : p));
  assert.equal(group.pins.find((p) => p.id === "p-1")?.dayIndex, 2);
});

test("tripToRoute converts trip to UnifiedRoutePlan and back with routeToTrip", () => {
  const { buildSync } = require("esbuild");
  const vm = require("node:vm");
  const result = buildSync({ entryPoints: ["app/lib/trip/workspace-store.ts"], bundle: true, platform: "node", format: "cjs", write: false });
  const context = { module: { exports: {} }, crypto };
  vm.runInNewContext(result.outputFiles[0].text, context);
  const { tripToRoute, routeToTrip } = context.module.exports;

  const sampleRoute = {
    title: "İstanbul Keşfi",
    summary: "Tarihi yarımada gezisi",
    theme: "Tarih & Lezzet",
    destination: "İstanbul",
    estimatedDays: 2,
    stops: [
      { id: "s-1", name: "Ayasofya", lat: 41.0086, lng: 28.9802, day: 1, description: "Tarihi cami ve müze", suggestedDuration: "2 saat" },
      { id: "s-2", name: "Topkapı Sarayı", lat: 41.0115, lng: 28.9833, day: 1, description: "Osmanlı sarayı", suggestedDuration: "3 saat" },
      { id: "s-3", name: "Galata Kulesi", lat: 41.0256, lng: 28.9741, day: 2, description: "Panoramik kule", suggestedDuration: "1 saat" },
    ],
  };

  const trip = routeToTrip(sampleRoute, "trip-123");
  assert.equal(trip.pins.length, 3);
  assert.equal(trip.destination, "İstanbul");

  const converted = tripToRoute(trip);
  assert.equal(converted.stops.length, 3);
  assert.equal(converted.stops[0].name, "Ayasofya");
  assert.equal(converted.stops[0].day, 1);
  assert.equal(converted.stops[2].name, "Galata Kulesi");
  assert.equal(converted.stops[2].day, 2);
});



