const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { transformSync } = require("esbuild");
const vm = require("node:vm");

function loadModule(relativePath, extraContext = {}) {
  const fullPath = path.resolve(__dirname, "../app/lib", relativePath);
  const code = fs.readFileSync(fullPath, "utf8");
  const compiled = transformSync(code, { loader: "ts", format: "cjs" }).code;
  const module = { exports: {} };
  const context = {
    module,
    exports: module.exports,
    console,
    Date,
    Math,
    String,
    Number,
    Array,
    Object,
    Set,
    Map,
    Buffer,
    setTimeout,
    clearTimeout,
    crypto: globalThis.crypto,
    ...extraContext,
  };
  vm.runInNewContext(compiled, context);
  return module.exports;
}

test("DevOps & Scalability Agent supports 10,000 concurrent users with circuit breaker protection", () => {
  const { evaluateSystemScalability } = loadModule("ai/sub-agents/devops-agent.ts");

  // Test standard load
  const standardReport = evaluateSystemScalability(150, 2, 5000);
  assert.equal(standardReport.isHealthy, true);
  assert.equal(standardReport.concurrentCapacity, 10000);
  assert.equal(standardReport.circuitBreakerStatus, "closed");
  assert.equal(standardReport.queueStatus, "healthy");
  assert.ok(standardReport.cacheHitRatio >= 0.85);

  // Test surge / provider degradation triggering circuit breaker
  const degradedReport = evaluateSystemScalability(200, 2500, 5000); // 50% failure rate
  assert.equal(degradedReport.circuitBreakerStatus, "open");
  assert.equal(degradedReport.isHealthy, false);
  assert.ok(degradedReport.recommendations.some((r) => r.includes("circuit breaker")));

  // Test queue overload
  const overloadedReport = evaluateSystemScalability(9000, 10, 10000);
  assert.equal(overloadedReport.queueStatus, "overloaded");
  assert.equal(overloadedReport.isHealthy, false);
});

test("Ticket Tracker Agent generates deals and price benchmarks for routes", async () => {
  const mockBedrockClient = {
    invokeBedrockJSON: async () => ({
      success: true,
      data: {
        origin: "İstanbul",
        destination: "Roma",
        bestEstimatedPrice: 2450,
        averageMarketPrice: 4100,
        currency: "₺",
        bestDeals: [
          {
            id: "deal-test-1",
            title: "Pegasus Roma İndirimi",
            price: 2450,
            originalPrice: 4100,
            currency: "₺",
            provider: "Pegasus Airlines",
            highlights: ["Direkt Uçuş", "Kabin Bagajı"],
          },
        ],
        flexibleDateSavings: ["Hafta içi biletleri %30 daha uygun"],
        bookingTips: ["Erken rezervasyon yapın"],
        trackerRecommended: true,
      },
    }),
  };

  const { runTicketTrackerAgent } = loadModule("ai/sub-agents/ticket-tracker-agent.ts", {
    require: (spec) => {
      if (spec.includes("bedrock-client")) return mockBedrockClient;
      return {};
    },
  });

  const res = await runTicketTrackerAgent("İstanbul", "Roma", "15-20 Ekim");
  assert.equal(res.output.destination, "Roma");
  assert.equal(res.output.bestEstimatedPrice, 2450);
  assert.equal(res.output.bestDeals.length, 1);
  assert.equal(res.output.bestDeals[0].provider, "Pegasus Airlines");
  assert.equal(res.output.trackerRecommended, true);
});

test("Hotel Deal Finder Agent analyzes budget lodging when requested", async () => {
  const mockBedrockClient = {
    invokeBedrockJSON: async () => ({
      success: true,
      data: {
        destination: "Roma",
        bestEstimatedNightlyPrice: 1350,
        averageMarketPrice: 2700,
        currency: "₺",
        recommendedArea: "Trastevere & Termini",
        bestDeals: [
          {
            id: "hotel-test-1",
            title: "Trastevere Butik Otel",
            price: 1350,
            originalPrice: 2700,
            currency: "₺",
            provider: "Booking.com",
            highlights: ["Metroya 3 dk", "Ücretsiz İptal"],
          },
        ],
        budgetTips: ["Merkez dışı metro hattındaki semtleri seçin"],
        trackerRecommended: true,
      },
    }),
  };

  const { runHotelDealAgent } = loadModule("ai/sub-agents/hotel-deal-agent.ts", {
    require: (spec) => {
      if (spec.includes("bedrock-client")) return mockBedrockClient;
      return {};
    },
  });

  const res = await runHotelDealAgent("Roma", "15-20 Ekim");
  assert.equal(res.output.destination, "Roma");
  assert.equal(res.output.bestEstimatedNightlyPrice, 1350);
  assert.equal(res.output.bestDeals[0].title, "Trastevere Butik Otel");
  assert.ok(res.output.budgetTips.length > 0);
});

test("Deal models and system capacity contracts conform to requirements", () => {
  const fullPath = path.resolve(__dirname, "../app/lib/tracker/deal-models.ts");
  const code = fs.readFileSync(fullPath, "utf8");
  assert.ok(code.includes('export type TrackerType = "flight" | "hotel"'));
  assert.ok(code.includes("export interface TrackerJob"));
  assert.ok(code.includes("supportedConcurrentUsers: number"));
});
