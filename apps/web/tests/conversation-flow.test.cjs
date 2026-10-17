const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("../node_modules/esbuild");

function loadModule() {
  const file = path.resolve(__dirname, "../app/lib/ai/conversation-flow.ts");
  const code = readFileSync(file, "utf8");
  const transformed = transformSync(code, { loader: "ts", format: "cjs", target: "node22" }).code;
  const mod = { exports: {} };
  vm.runInNewContext(transformed, {
    module: mod, exports: mod.exports,
    require, console, Math, Number, JSON,
  });
  return mod.exports;
}

const {
  EMPTY_FLOW,
  advanceFlow,
  shouldSurfacePricing,
  markPriced,
  flowToPromptSnippet,
  getFlowQuickReplies,
} = loadModule();

// ─── EMPTY_FLOW ───────────────────────────────────────────────────

test("EMPTY_FLOW has activeTopic none", () => {
  assert.equal(EMPTY_FLOW.activeTopic, "none");
  assert.equal(EMPTY_FLOW.stage, "none");
  assert.equal(EMPTY_FLOW.turnsInTopic, 0);
  assert.equal(Object.keys(EMPTY_FLOW.gathered).length, 0);
  assert.equal(EMPTY_FLOW.pricedTopics.length, 0);
  assert.equal(EMPTY_FLOW.sessionDestinations.length, 0);
});

// ─── Topic detection via advanceFlow ──────────────────────────────

test("hotel message switches topic to hotel", () => {
  const next = advanceFlow(EMPTY_FLOW, "İstanbul'da otel arıyorum");
  assert.equal(next.activeTopic, "hotel");
  assert.equal(next.stage, "discovery");
  assert.equal(next.turnsInTopic, 1);
});

test("flight message switches topic to flight", () => {
  const next = advanceFlow(EMPTY_FLOW, "Roma'ya bilet fiyatı ne kadar?");
  assert.equal(next.activeTopic, "flight");
  assert.equal(next.stage, "origin_check");
});

test("car rental message switches topic to car_rental", () => {
  const next = advanceFlow(EMPTY_FLOW, "Araba kiralama fiyatları nedir?");
  assert.equal(next.activeTopic, "car_rental");
  assert.equal(next.stage, "need_check");
});

test("destination question switches topic to destination", () => {
  const next = advanceFlow(EMPTY_FLOW, "Nereye gitsem iyi olur?");
  assert.equal(next.activeTopic, "destination");
  assert.equal(next.stage, "exploring");
});

test("unrelated message keeps topic as none", () => {
  const next = advanceFlow(EMPTY_FLOW, "Merhaba nasılsın");
  assert.equal(next.activeTopic, "none");
});

// ─── Destination tracking ─────────────────────────────────────────

test("destination param is added to sessionDestinations", () => {
  const next = advanceFlow(EMPTY_FLOW, "Otel bakıyorum", undefined, "istanbul");
  assert.ok(next.sessionDestinations.includes("istanbul"));
});

test("duplicate destination is not added twice", () => {
  const withDest = { ...EMPTY_FLOW, sessionDestinations: ["istanbul"] };
  const next = advanceFlow(withDest, "Otel var mı", undefined, "istanbul");
  assert.equal(next.sessionDestinations.filter(d => d === "istanbul").length, 1);
});

// ─── Topic switching ──────────────────────────────────────────────

test("switching from hotel to flight resets stage and turns", () => {
  const withHotel = { ...EMPTY_FLOW, activeTopic: "hotel", stage: "recommendation", turnsInTopic: 3 };
  const next = advanceFlow(withHotel, "Roma'ya bilet fiyati ne kadar?");
  assert.equal(next.activeTopic, "flight");
  assert.equal(next.stage, "origin_check");
  assert.equal(next.turnsInTopic, 1);
});

// ─── Stage advancement ───────────────────────────────────────────

test("hotel: continues in same topic increments turnsInTopic", () => {
  const flow1 = advanceFlow(EMPTY_FLOW, "otel arıyorum");
  assert.equal(flow1.turnsInTopic, 1);
  const flow2 = advanceFlow(flow1, "bütçem var");
  assert.equal(flow2.turnsInTopic, 2);
});

test("hotel: after 2 turns moves to recommendation stage", () => {
  let flow = advanceFlow(EMPTY_FLOW, "otel arıyorum");  // turn 1 → discovery
  flow = advanceFlow(flow, "ekonomik otel istiyorum");   // turn 2 → needs
  flow = advanceFlow(flow, "nasıl bir yer tavsiye edersin"); // turn 3 → recommendation
  assert.equal(flow.stage, "recommendation");
});

// ─── Slot extraction ─────────────────────────────────────────────

test("hotel: budget slot extracted from message", () => {
  const next = advanceFlow(EMPTY_FLOW, "ekonomik otel arıyorum");
  assert.equal(next.gathered.hotelBudget, "budget");
});

test("hotel: luxury budget extracted", () => {
  const next = advanceFlow(EMPTY_FLOW, "lüks bir otel istiyorum");
  assert.equal(next.gathered.hotelBudget, "luxury");
});

test("hotel: ISO dates extracted", () => {
  const next = advanceFlow(EMPTY_FLOW, "2025-06-01 ile 2025-06-07 arası konaklama");
  assert.equal(next.gathered.hotelCheckIn, "2025-06-01");
  assert.equal(next.gathered.hotelCheckOut, "2025-06-07");
});

test("hotel: boutique style extracted", () => {
  const next = advanceFlow(EMPTY_FLOW, "butik otel tercih ederim");
  assert.equal(next.gathered.hotelStyle, "boutique");
});

// ─── shouldSurfacePricing ─────────────────────────────────────────

test("pricing not surfaced when topic is none", () => {
  assert.equal(shouldSurfacePricing(EMPTY_FLOW), false);
});

test("pricing not surfaced in early hotel stage", () => {
  const flow = { ...EMPTY_FLOW, activeTopic: "hotel", stage: "discovery", turnsInTopic: 1 };
  assert.equal(shouldSurfacePricing(flow), false);
});

test("pricing surfaced at hotel pricing stage", () => {
  const flow = { ...EMPTY_FLOW, activeTopic: "hotel", stage: "pricing", turnsInTopic: 4 };
  assert.equal(shouldSurfacePricing(flow), true);
});

test("pricing surfaced at hotel recommendation with >= 3 turns", () => {
  const flow = { ...EMPTY_FLOW, activeTopic: "hotel", stage: "recommendation", turnsInTopic: 3 };
  assert.equal(shouldSurfacePricing(flow), true);
});

test("pricing NOT surfaced if already priced", () => {
  const flow = { ...EMPTY_FLOW, activeTopic: "hotel", stage: "pricing", turnsInTopic: 4, pricedTopics: ["hotel"] };
  assert.equal(shouldSurfacePricing(flow), false);
});

// ─── markPriced ───────────────────────────────────────────────────

test("markPriced adds topic to pricedTopics", () => {
  const next = markPriced(EMPTY_FLOW, "hotel");
  assert.ok(next.pricedTopics.includes("hotel"));
});

test("markPriced does not duplicate", () => {
  const once = markPriced(EMPTY_FLOW, "hotel");
  const twice = markPriced(once, "hotel");
  assert.equal(twice.pricedTopics.filter(t => t === "hotel").length, 1);
});

// ─── flowToPromptSnippet ──────────────────────────────────────────

test("flowToPromptSnippet includes past destination", () => {
  const snippet = flowToPromptSnippet(EMPTY_FLOW, ["istanbul"]);
  assert.ok(snippet.includes("istanbul"), `snippet: ${snippet}`);
});

test("flowToPromptSnippet empty when no topic and no destinations", () => {
  const snippet = flowToPromptSnippet(EMPTY_FLOW, []);
  assert.equal(snippet, "");
});

test("flowToPromptSnippet includes topic when active", () => {
  const flow = { ...EMPTY_FLOW, activeTopic: "hotel", stage: "discovery", turnsInTopic: 1 };
  const snippet = flowToPromptSnippet(flow, []);
  assert.ok(snippet.includes("hotel"));
});

// ─── getFlowQuickReplies ──────────────────────────────────────────

test("getFlowQuickReplies returns empty array when topic is none", () => {
  const replies = getFlowQuickReplies(EMPTY_FLOW);
  assert.equal(replies.length, 0);
});

test("getFlowQuickReplies returns hotel options at discovery stage", () => {
  const flow = { ...EMPTY_FLOW, activeTopic: "hotel", stage: "discovery", turnsInTopic: 1 };
  const replies = getFlowQuickReplies(flow, "istanbul");
  assert.ok(replies.length > 0);
  assert.ok(replies.every(r => r.topic === "hotel"));
});

test("getFlowQuickReplies returns flight options at origin_check stage", () => {
  const flow = { ...EMPTY_FLOW, activeTopic: "flight", stage: "origin_check", turnsInTopic: 1 };
  const replies = getFlowQuickReplies(flow, "paris");
  assert.ok(replies.length > 0);
  assert.ok(replies.every(r => r.topic === "flight"));
});
