/**
 * MapsBridge Synthetic Canary Health Check Runner
 * Periodically verifies critical public and protected API paths across Web CDN and API Gateway.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "endpoints.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

async function checkEndpoint(check) {
  const baseUrl = check.target === "api" ? config.apiBaseUrl : config.webBaseUrl;
  const url = `${baseUrl}${check.path}`;
  const start = Date.now();

  return new Promise((resolve) => {
    const req = https.get(url, { timeout: check.maxLatencyMs || 5000 }, (res) => {
      const latencyMs = Date.now() - start;
      const passed = res.statusCode === check.expectedStatus;
      
      resolve({
        name: check.name,
        path: check.path,
        expected: check.expectedStatus,
        actual: res.statusCode,
        latencyMs,
        passed,
      });
    });

    req.on("error", (err) => {
      resolve({
        name: check.name,
        path: check.path,
        error: err.message,
        passed: false,
        latencyMs: Date.now() - start,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        name: check.name,
        path: check.path,
        error: "Timeout exceeded",
        passed: false,
        latencyMs: Date.now() - start,
      });
    });
  });
}

async function runCanary() {
  console.log(`[Synthetics] Starting health check for ${config.checks.length} endpoints...`);
  const results = [];
  
  for (const check of config.checks) {
    const result = await checkEndpoint(check);
    results.push(result);
    const statusIcon = result.passed ? "✓ PASS" : "✗ FAIL";
    console.log(`  ${statusIcon}: ${result.name} (${result.path}) -> ${result.actual || result.error} in ${result.latencyMs}ms`);
  }

  const failures = results.filter((r) => !r.passed);
  if (failures.length > 0) {
    console.error(`[Synthetics] ${failures.length} canary checks failed!`);
    return false;
  }

  console.log("[Synthetics] All canary checks passed successfully.");
  return true;
}

if (require.main === module) {
  runCanary().then((ok) => {
    process.exit(ok ? 0 : 1);
  });
}

module.exports = { runCanary, checkEndpoint };
