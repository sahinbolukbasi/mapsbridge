/**
 * MapsBridge Synthetic Canary Health Check Runner
 * Periodically verifies critical public and protected API paths across Web CDN and API Gateway.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "endpoints.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

// Endpoint'ler önce ortam değişkenlerinden okunur (deploy sonrası kod değişmeden güncellenir).
// Ortam değişkeni yoksa endpoints.json'daki değer kullanılır.
const webBaseUrl = process.env.SYNTHETICS_WEB_URL || process.env.NEXT_PUBLIC_SITE_URL || config.webBaseUrl;
const apiBaseUrl = process.env.SYNTHETICS_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || config.apiBaseUrl;

async function checkEndpoint(check) {
  const baseUrl = check.target === "api" ? apiBaseUrl : webBaseUrl;
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
      // DNS çözümleme hatası = endpoint deploy edilmemiş veya yanlış yapılandırılmış.
      const diagnosis =
        err.code === "ENOTFOUND"
          ? `DNS çözülemedi (${err.hostname || baseUrl}). Endpoint deploy edilmemiş veya SYNTHETICS_API_URL/SYNTHETICS_WEB_URL yanlış.`
          : err.message;
      resolve({
        name: check.name,
        path: check.path,
        error: diagnosis,
        code: err.code,
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
  console.log(`[Synthetics] Hedefler: web=${webBaseUrl} api=${apiBaseUrl}`);
  console.log(`[Synthetics] Starting health check for ${config.checks.length} endpoints...`);
  const results = [];

  for (const check of config.checks) {
    const result = await checkEndpoint(check);
    results.push(result);
    const statusIcon = result.passed ? "✓ PASS" : "✗ FAIL";
    console.log(
      `  ${statusIcon}: ${result.name} (${result.path}) -> ${result.actual || result.error} in ${result.latencyMs}ms`,
    );
  }

  const passed = results.filter((r) => r.passed);
  const failures = results.filter((r) => !r.passed);
  if (failures.length > 0) {
    const allFailuresDns = failures.every((f) => f.code === "ENOTFOUND");
    if (allFailuresDns) {
      console.error(
        `[Synthetics] Başarısız ${failures.length} kontrolün tamamı DNS çözümleme hatası ` +
          "(ENOTFOUND) — bu ortamdan ilgili host'a çıkılamıyor ya da adres güncel değil. " +
          "Canlı ölçüm için SYNTHETICS_WEB_URL / SYNTHETICS_API_URL ortam değişkenlerini " +
          `doğru değerlerle verin. (Geçen kontrol: ${passed.length}/${results.length})`,
      );
    }
    console.error(`[Synthetics] ${failures.length}/${results.length} canary checks failed!`);
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
