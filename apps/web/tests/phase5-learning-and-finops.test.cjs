const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

function loadModule(relativePath) {
  const ts = require("typescript");
  const fullPath = path.resolve(__dirname, "../app/lib/ai", relativePath);
  const code = fs.readFileSync(fullPath, "utf8");
  const transformed = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  const customRequire = (spec) => {
    if (spec.startsWith(".")) {
      const resolved = path.resolve(
        path.dirname(fullPath),
        spec.endsWith(".ts") ? spec : spec + ".ts",
      );
      if (fs.existsSync(resolved)) {
        return loadModule(path.relative(path.resolve(__dirname, "../app/lib/ai"), resolved));
      }
    }
    return require(spec);
  };
  const fn = new Function("require", "exports", "module", "__filename", "__dirname", transformed);
  fn(customRequire, mod.exports, mod, fullPath, path.dirname(fullPath));
  return mod.exports;
}

const learningMod = loadModule("learning-feedback.ts");
const finopsDash = loadModule("finops-dashboard.ts");
const weeklyBatch = require("../../../infra/scripts/weekly-learning-batch.cjs");

test("anonymizeFeedbackSignal completely strips PII and applies coarse week grouping", () => {
  const raw = {
    userId: "user_sensitive_12345",
    userEmail: "traveler@example.com",
    userIp: "198.51.100.42",
    city: "New York",
    category: "cafe",
    placeName: "Devoción Coffee",
    action: "liked",
    rating: 5,
    timestamp: Date.UTC(2026, 8, 23, 12, 0, 0),
  };

  const anon = learningMod.anonymizeFeedbackSignal(raw);

  // Assert NO PII exists in output
  assert.equal("userId" in anon, false);
  assert.equal("userEmail" in anon, false);
  assert.equal("userIp" in anon, false);
  assert.equal(JSON.stringify(anon).includes("user_sensitive"), false);
  assert.equal(JSON.stringify(anon).includes("traveler@example.com"), false);
  assert.equal(JSON.stringify(anon).includes("198.51.100.42"), false);

  // Assert required fields
  assert.equal(anon.city, "New York");
  assert.equal(anon.place_name, "Devoción Coffee");
  assert.equal(anon.action, "liked");
  assert.equal(anon.rating, 5);
  assert.match(anon.signal_id, /^[a-f0-9]{32}$/);
  assert.match(anon.coarse_week, /^\d{4}-W\d{2}$/);
});

test("aggregateFeedbackSignals aggregates scores and sorts by net preference", () => {
  const signals = [
    {
      signal_id: "s1",
      city: "New York",
      category: "cafe",
      place_name: "Devoción Coffee",
      action: "liked",
      coarse_week: "2026-W38",
    },
    {
      signal_id: "s2",
      city: "New York",
      category: "cafe",
      place_name: "Devoción Coffee",
      action: "kept_in_plan",
      coarse_week: "2026-W38",
    },
    {
      signal_id: "s3",
      city: "New York",
      category: "food",
      place_name: "Joe's Pizza",
      action: "completed_trip",
      coarse_week: "2026-W38",
    },
    {
      signal_id: "s4",
      city: "New York",
      category: "cafe",
      place_name: "Overpriced Coffee",
      action: "removed_from_plan",
      coarse_week: "2026-W38",
    },
  ];

  const aggregated = learningMod.aggregateFeedbackSignals(signals);
  assert.equal(aggregated.length, 3);
  assert.equal(aggregated[0].placeName, "Devoción Coffee");
  assert.equal(aggregated[0].netScore, 2);
  assert.equal(aggregated[0].positiveCount, 2);
  assert.equal(aggregated[0].negativeCount, 0);

  const lowRanked = aggregated.find((a) => a.placeName === "Overpriced Coffee");
  assert.equal(lowRanked.netScore, -1);
  assert.equal(lowRanked.negativeCount, 1);
});

test("weekly-learning-batch script processes signals into KB-compliant entries", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mb-batch-test-"));
  const testSignalsPath = path.join(tmpDir, "signals.json");
  const testOutputPath = path.join(tmpDir, "community-kb.json");

  const sampleSignals = [
    {
      city: "New York",
      category: "cafe",
      place_name: "Abraço Coffee",
      action: "liked",
      coarse_week: "2026-W38",
    },
    {
      city: "New York",
      category: "cafe",
      place_name: "Abraço Coffee",
      action: "kept_in_plan",
      coarse_week: "2026-W38",
    },
    {
      city: "New York",
      category: "food",
      place_name: "Katz's Delicatessen",
      action: "completed_trip",
      coarse_week: "2026-W38",
    },
  ];
  fs.writeFileSync(testSignalsPath, JSON.stringify(sampleSignals));

  const result = weeklyBatch.runWeeklyLearningBatch(testSignalsPath, testOutputPath);
  assert.equal(result.success, true);
  assert.equal(result.processedSignals, 3);
  assert.equal(result.generatedEntries, 2);

  const generated = JSON.parse(fs.readFileSync(testOutputPath, "utf8"));
  assert.equal(generated.length, 2);
  assert.equal(generated[0].metadata.sehir, "New York");
  assert.equal(generated[0].approved, true);
  assert.equal(generated[0].visibility, "public");

  // Clean up
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("evals/regression-eval-suite.json defines all 5 mission-critical components", () => {
  const suitePath = path.resolve(__dirname, "../../../evals/regression-eval-suite.json");
  assert.equal(fs.existsSync(suitePath), true);

  const suite = JSON.parse(fs.readFileSync(suitePath, "utf8"));
  assert.equal(suite.length, 5);

  const components = suite.map((s) => s.component);
  assert.equal(components.includes("Concierge"), true);
  assert.equal(components.includes("FeasibilityEngine"), true);
  assert.equal(components.includes("AgentRouter"), true);
  assert.equal(components.includes("EmergencyAgent"), true);
  assert.equal(components.includes("Guardrails"), true);

  for (const item of suite) {
    assert.equal(item.expectedStatus, "PASS");
  }
});

test("calculateCompletedPlanCost tracks unit economics against the $0.15 target", () => {
  const events = [
    {
      agentRole: "concierge",
      durationMs: 400,
      inputTokens: 500,
      outputTokens: 150,
      estimatedCostUsd: 0.00031,
      success: true,
    },
    {
      agentRole: "food",
      durationMs: 650,
      inputTokens: 800,
      outputTokens: 300,
      estimatedCostUsd: 0.00058,
      success: true,
    },
    {
      agentRole: "lodging",
      durationMs: 620,
      inputTokens: 750,
      outputTokens: 250,
      estimatedCostUsd: 0.0005,
      success: true,
    },
    {
      agentRole: "planner",
      durationMs: 1200,
      inputTokens: 2200,
      outputTokens: 800,
      estimatedCostUsd: 0.0186,
      success: true,
    },
    {
      agentRole: "feasibility",
      durationMs: 250,
      inputTokens: 900,
      outputTokens: 100,
      estimatedCostUsd: 0.00035,
      success: true,
    },
  ];

  const breakdown = finopsDash.calculateCompletedPlanCost(events);
  assert.equal(breakdown.totalTokens, 500 + 150 + 800 + 300 + 750 + 250 + 2200 + 800 + 900 + 100);
  assert.equal(breakdown.isWithinTargetRange, true);
  assert.equal(breakdown.targetBudgetUsd, 0.15);
  assert.equal(breakdown.totalCostUsd < 0.03, true);
  assert.equal(breakdown.agentBreakdown.planner.invocations, 1);
  assert.equal(breakdown.agentBreakdown.food.invocations, 1);

  // Aggregate metrics
  const summary = finopsDash.aggregateFinOpsMetrics(events, 1);
  assert.equal(summary.totalInvocations, 5);
  assert.equal(summary.successfulInvocations, 5);
  assert.equal(summary.errorRatePercentage, 0);
  assert.equal(summary.topCostDriverAgent, "planner");
  assert.equal(summary.latency.p50Ms > 0, true);
  assert.equal(summary.latency.p95Ms >= summary.latency.p50Ms, true);
});
