const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { readFileSync } = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { transformSync } = require("esbuild");
function load(file) {
  const filename = path.resolve(__dirname, "../app/lib/ai", file);
  if (filename.endsWith(".json")) return JSON.parse(readFileSync(filename, "utf8"));
  const module = { exports: {} };
  vm.runInNewContext(
    transformSync(readFileSync(filename, "utf8"), { loader: "ts", format: "cjs" }).code,
    {
      module,
      exports: module.exports,
      URL,
      require: (spec) =>
        spec === "@aws-sdk/client-geo-places"
          ? {}
          : load(
              path.resolve(path.dirname(filename), spec.endsWith(".json") ? spec : spec + ".ts"),
            ),
    },
  );
  return module.exports;
}
test("place searches translate prose into supported categories without losing named places", () => {
  const { normalizePlaceQueries } = load("place-research.ts");
  const result = normalizePlaceQueries(
    [
      "Roma tarihi mekanlar az yürüyüş",
      "Roma açık hava aktiviteleri",
      "Roma kompakt turist rotası",
    ],
    { interests: [] },
  );
  assert.deepEqual(Array.from(result), ["historical monument", "park", "tourist attraction"]);
  assert.ok(normalizePlaceQueries(["Colosseum"], { interests: [] }).includes("Colosseum"));
  assert.equal(
    normalizePlaceQueries(["kahve", "coffee shops", "cafe"], { interests: [] }).filter(
      (x) => x === "coffee shop",
    ).length,
    1,
  );
});
test("bundled sources match latest city and topic, expire, and never substitute unrelated cities", () => {
  const { bundledEvidence } = load("bundled-evidence.ts"),
    now = Date.parse("2026-09-19");
  const lima = bundledEvidence({ prompt: "Lima yemekleri ve pisco" }, now);
  assert.equal(lima.status, "available");
  assert.equal(lima.passages.length, 2);
  assert.ok(lima.passages.every((p) => p.url.startsWith("https://www.peru.travel/")));
  assert.equal(bundledEvidence({ prompt: "Lima tarih müzeleri" }, now).passages.length, 0);
  assert.equal(bundledEvidence({ prompt: "Nairobi yemekleri" }, now).passages.length, 0);
  assert.equal(
    bundledEvidence({ prompt: "Lima yemekleri" }, Date.parse("2027-01-01")).passages.length,
    0,
  );
  const tokyo = bundledEvidence(
    { prompt: "Roma rotamı değiştirme, Tokyo yemekleri neler?", researchDestination: "Roma" },
    now,
  );
  assert.equal(tokyo.passages.length, 1);
  assert.match(tokyo.passages[0].url, /gotokyo/);
});
test("source merge deduplicates by URL and preserves remote outage state without false evidence", () => {
  const { mergeEvidence } = load("bundled-evidence.ts");
  const source = { id: "S1", url: "https://example.com/" };
  assert.equal(
    mergeEvidence(
      { status: "available", passages: [source] },
      { status: "available", passages: [{ ...source, id: "L1" }] },
    ).passages.length,
    1,
  );
  assert.equal(
    mergeEvidence({ status: "unavailable", passages: [] }, { status: "empty", passages: [] })
      .status,
    "unavailable",
  );
});
test("assistant text preserves paragraphs, emphasis and lists but does not execute HTML or unsafe links", () => {
  const { messageBlocks, inlineParts } = load("message-format.ts");
  const blocks = messageBlocks("## Roma\n\n**İlk gün**\n- Müze\n- Park\n\nSon paragraf.");
  assert.deepEqual(
    Array.from(blocks, (b) => b.kind),
    ["heading", "paragraph", "list", "paragraph"],
  );
  assert.equal(blocks[2].lines.length, 2);
  const safe = inlineParts("**Roma** [Kaynak](https://example.com)");
  assert.equal(safe[0].kind, "strong");
  assert.equal(safe[2].kind, "link");
  const bad = inlineParts("<script>alert(1)</script> [x](javascript:alert(1))");
  assert.equal(bad.length, 1);
  assert.equal(bad[0].kind, "text");
});
