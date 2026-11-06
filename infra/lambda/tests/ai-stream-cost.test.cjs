// Increment 1.10 (bug 6): stream yolunun ücreti buffered yol ile aynı (supervisor'ın
// authorizeAI ile ayırdığı maliyet). Sabit 5, ayrılandan büyükse finishAI 402 verip üretilmiş
// rotayı düşürüyordu. store.ts (reserveAI/finishAI) değişmedi.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const src = readFileSync(path.resolve(__dirname, "../src/ai/index.ts"), "utf8");
const buffered = readFileSync(
  path.resolve(__dirname, "../../../apps/web/server/ai-handler.ts"),
  "utf8",
);
const costExprs = (s) =>
  [...s.matchAll(/const actualCost =\s*([\s\S]*?);/g)].map((m) => m[1].replace(/\s+/g, " ").trim());

test("ai/index.ts: buffered ve stream actualCost ifadeleri aynı ve reservation.cost'u kullanır", () => {
  const exprs = costExprs(src);
  assert.equal(exprs.length, 2, "iki yol: handleRequest + stream");
  assert.equal(exprs[0], exprs[1]);
  assert.match(exprs[1], /reservation\?\.cost/);
  assert.deepEqual(costExprs(buffered), [exprs[0]], "apps/web/server/ai-handler.ts ile aynı");
});
