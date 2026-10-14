const fs = require("node:fs");
const path = require("node:path");

const manifestPath = path.resolve(__dirname, "../../apps/web/evals/golden-travel-cases.json");
const baselinePath = path.resolve(__dirname, "../../docs/verification/golden-evaluation-baseline.json");

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function validateManifest(manifest) {
  const errors = [];
  const cases = Array.isArray(manifest.cases) ? manifest.cases : [];
  const counts = Object.create(null);
  const ids = new Set();

  if (!manifest.version) errors.push("missing version");
  if (cases.length !== 100) errors.push(`expected 100 cases, got ${cases.length}`);

  for (const item of cases) {
    if (!item || typeof item.id !== "string" || typeof item.category !== "string" || typeof item.prompt !== "string") {
      errors.push("every case needs id, category and prompt");
      continue;
    }
    if (ids.has(item.id)) errors.push(`duplicate id: ${item.id}`);
    ids.add(item.id);
    counts[item.category] = (counts[item.category] || 0) + 1;
    if (!item.expect || typeof item.expect.mode !== "string") errors.push(`missing expectation: ${item.id}`);
  }

  for (const [category, expected] of Object.entries(manifest.requiredCategories || {})) {
    if (counts[category] !== expected) errors.push(`${category}: expected ${expected}, got ${counts[category] || 0}`);
  }
  return { errors, counts, total: cases.length };
}

function normalizeReport(report) {
  const turns = Array.isArray(report.turns) ? report.turns : [];
  const passed = turns.filter((turn) => Array.isArray(turn.failures) && turn.failures.length === 0).length;
  const latencies = turns.map((turn) => Number(turn.elapsedMs)).filter(Number.isFinite).sort((a, b) => a - b);
  const percentile = (ratio) => latencies.length ? latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * ratio) - 1)] : null;
  const resultValues = turns.map((turn) => turn.result).filter(Boolean);
  const sourceRatios = resultValues.map((result) => result.sourceCoverage?.ratio).filter(Number.isFinite);
  const routeResults = resultValues.filter((result) => result.responseMode === "route");
  const validRoutes = routeResults.filter((result) => result.route && Array.isArray(result.route.stops) && result.route.stops.length > 0);
  const decisionSummaries = resultValues.filter((result) => Array.isArray(result.decisionSummary) && result.decisionSummary.every((item) => typeof item === "string" && !/thinking|chain.of.thought|internal.reasoning/i.test(item)));
  const costs = turns.map((turn) => Number(turn.estimatedCostUsd ?? turn.result?.estimatedCostUsd)).filter(Number.isFinite);
  const categoryMetrics = {};
  for (const turn of turns) {
    const category = turn.category || "uncategorized";
    const bucket = categoryMetrics[category] || (categoryMetrics[category] = { total: 0, passed: 0 });
    bucket.total += 1;
    if (Array.isArray(turn.failures) && turn.failures.length === 0) bucket.passed += 1;
  }
  for (const bucket of Object.values(categoryMetrics)) bucket.passRate = Number((bucket.passed / bucket.total).toFixed(4));
  return {
    total: turns.length,
    passed,
    passRate: turns.length ? Number((passed / turns.length).toFixed(4)) : 0,
    p50LatencyMs: percentile(0.5),
    p95LatencyMs: percentile(0.95),
    averageSourceCoverage: sourceRatios.length ? Number((sourceRatios.reduce((sum, value) => sum + value, 0) / sourceRatios.length).toFixed(4)) : null,
    routeValidityRate: routeResults.length ? Number((validRoutes.length / routeResults.length).toFixed(4)) : null,
    safeDecisionSummaryRate: resultValues.length ? Number((decisionSummaries.length / resultValues.length).toFixed(4)) : null,
    averageEstimatedCostUsd: costs.length ? Number((costs.reduce((sum, value) => sum + value, 0) / costs.length).toFixed(8)) : null,
    categoryMetrics
  };
}

function compareBaseline(current, baseline) {
  if (!baseline) return { status: "not_available", failures: [] };
  const failures = [];
  if (Number.isFinite(baseline.passRate) && current.passRate < baseline.passRate) failures.push(`passRate regressed from ${baseline.passRate} to ${current.passRate}`);
  if (Number.isFinite(baseline.p95LatencyMs) && Number.isFinite(current.p95LatencyMs) && current.p95LatencyMs > baseline.p95LatencyMs * 1.2) failures.push("p95 latency regressed by more than 20%");
  if (Number.isFinite(baseline.averageSourceCoverage) && Number.isFinite(current.averageSourceCoverage) && current.averageSourceCoverage < baseline.averageSourceCoverage - 0.05) failures.push("source coverage regressed by more than 0.05");
  if (Number.isFinite(baseline.routeValidityRate) && Number.isFinite(current.routeValidityRate) && current.routeValidityRate < baseline.routeValidityRate) failures.push("route validity regressed");
  if (Number.isFinite(baseline.safeDecisionSummaryRate) && Number.isFinite(current.safeDecisionSummaryRate) && current.safeDecisionSummaryRate < baseline.safeDecisionSummaryRate) failures.push("decision summary safety regressed");
  return { status: failures.length ? "failed" : "passed", failures };
}

function main() {
  const manifest = loadJson(manifestPath);
  const validation = validateManifest(manifest);
  if (validation.errors.length) {
    console.error(JSON.stringify({ ok: false, ...validation }, null, 2));
    process.exitCode = 1;
    return;
  }

  const reportPath = process.argv[2];
  const report = reportPath ? loadJson(path.resolve(reportPath)) : null;
  const metrics = report ? normalizeReport(report) : null;
  const baseline = fs.existsSync(baselinePath) ? loadJson(baselinePath) : null;
  const comparison = !report
    ? { status: "pending", failures: [] }
    : report.goldenVersion !== manifest.version
      ? { status: "skipped", failures: [], reason: "report is not a golden evaluation run" }
      : compareBaseline(metrics, baseline);
  const output = { ok: comparison.status !== "failed", manifest: validation, metrics, baseline: baseline || null, comparison };
  console.log(JSON.stringify(output, null, 2));
  if (comparison.status === "failed") process.exitCode = 1;
}

if (require.main === module) main();
module.exports = { compareBaseline, normalizeReport, validateManifest };
