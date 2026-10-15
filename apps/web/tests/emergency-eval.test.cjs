const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

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

const emergencyMod = loadModule("sub-agents/emergency-agent.ts");
const tripMode = loadModule("trip-mode.ts");

test("getDeterministicEmergencyLine adheres to Section 9 first-line rule (911 for US, 112 for EU/TR)", () => {
  const usLine = emergencyMod.getDeterministicEmergencyLine("New York");
  assert.equal(usLine.includes("911"), true);
  assert.equal(usLine.includes("ACİL DURUM"), true);

  const euLine = emergencyMod.getDeterministicEmergencyLine("Roma");
  assert.equal(euLine.includes("112"), true);

  const trLine = emergencyMod.getDeterministicEmergencyLine("İstanbul");
  assert.equal(trLine.includes("112"), true);
});

test("runEmergencyAgent provides complete Türkevi and NYPD protocol for New York", () => {
  const res = emergencyMod.runEmergencyAgent("New York", "Pasaportumu kaybettim");
  assert.equal(res.deterministicNotice.includes("911"), true);
  assert.equal(res.info.destinationCountry.includes("New York"), true);
  assert.equal(res.info.turkishEmbassyConsulate.title.includes("Türkevi"), true);
  assert.equal(res.info.turkishEmbassyConsulate.address.includes("825 3rd Ave"), true);
  assert.equal(res.info.turkishEmbassyConsulate.phone.includes("+1 646 560 2100"), true);
  assert.equal(res.info.localEmergencyNumbers.police.includes("911"), true);

  const tips = res.info.safetyAndPassportTips.join(" ");
  assert.equal(tips.includes("NYPD"), true);
  assert.equal(tips.includes("Geçici Pasaport"), true);
  assert.equal(tips.includes("Urgent Care"), true);
});

test("evals/emergency-evaluation.json passes all critical scenarios", () => {
  const evalPath = path.resolve(__dirname, "../../../evals/emergency-evaluation.json");
  assert.equal(fs.existsSync(evalPath), true);
  const scenarios = JSON.parse(fs.readFileSync(evalPath, "utf8"));
  assert.equal(scenarios.length >= 5, true);

  for (const s of scenarios) {
    const res = emergencyMod.runEmergencyAgent(s.destination, s.prompt);
    const combinedOutput = `${res.deterministicNotice} ${JSON.stringify(res.info)}`;

    for (const must of s.mustInclude) {
      assert.equal(
        combinedOutput.toLowerCase().includes(must.toLowerCase()),
        true,
        `Scenario "${s.title}" failed to include required term: "${must}"`,
      );
    }

    for (const mustNot of s.mustNotInclude) {
      assert.equal(
        combinedOutput.toLowerCase().includes(mustNot.toLowerCase()),
        false,
        `Scenario "${s.title}" contained prohibited term: "${mustNot}"`,
      );
    }
  }
});

test("trip-mode tracks current & upcoming blocks and triggers weather alerts", () => {
  const samplePlan = {
    trip_id: "t_trip_mode",
    days: [
      {
        date: "2026-11-10",
        weather_note: "Şiddetli yağış ve fırtına uyarısı",
        blocks: [
          {
            time: "09:00-11:00",
            type: "cafe",
            place_id: "p1",
            name: "Devoción Coffee",
            why: "Kahve",
          },
          {
            time: "11:30-14:00",
            type: "museum",
            place_id: "p2",
            name: "MoMA",
            why: "Sanat",
            transit: { mode: "subway", minutes: 20 },
          },
        ],
      },
    ],
    budget_summary: { total: 50, currency: "USD" },
    sources: [],
  };

  // During first block (10:00)
  const current = tripMode.getCurrentAndNextBlock(samplePlan, "2026-11-10", "10:00");
  assert.equal(current.currentBlock.name, "Devoción Coffee");
  assert.equal(current.nextBlock.name, "MoMA");

  // Weather alert trigger
  const alert = tripMode.evaluateWeatherAlertTrigger("Bölgede fırtına ve şiddetli yağış");
  assert.equal(alert.type, "weather_warning");
  assert.equal(alert.title.includes("Şiddetli"), true);

  // Full on-trip update generator
  const updates = tripMode.generateOnTripUpdate(samplePlan, "2026-11-10", "10:00");
  assert.equal(updates.length >= 2, true);
  assert.equal(
    updates.some((u) => u.type === "weather_warning"),
    true,
  );
  assert.equal(
    updates.some((u) => u.title.includes("Devoción Coffee")),
    true,
  );
});
