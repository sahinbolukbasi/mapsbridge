const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");
const moduleUnderTest = { exports: {} };
vm.runInNewContext(
  transformSync(readFileSync(path.join(__dirname, "../app/lib/admin-management.ts"), "utf8"), {
    loader: "ts",
    format: "cjs",
  }).code,
  {
    module: moduleUnderTest,
    exports: moduleUnderTest.exports,
    require: () => {
      throw new Error("admin-management.ts import içermemeli (C16: managementApi kaldırıldı)");
    },
  },
);
const { csvText, download, managementApi } = moduleUnderTest.exports;
test("tipsiz managementApi kaldırıldı; csvText ve download korunur (design §8.2, C16)", () => {
  assert.equal(managementApi, undefined);
  assert.equal(typeof csvText, "function");
  assert.equal(typeof download, "function");
});
test("admin CSV export neutralizes spreadsheet formulas without corrupting quoted text", () => {
  const output = csvText(
    [{ name: '=HYPERLINK("bad")', note: 'He said "hello"\nagain', value: -3 }],
    ["name", "note", "value"],
  );
  assert.ok(output.startsWith("\uFEFF"));
  assert.ok(output.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(output.includes('"He said ""hello""\nagain"'));
  assert.ok(output.includes('"\'-3"'));
});
test("CSV export handles empty lists and null values", () => {
  assert.equal(csvText([], ["name"]), '\uFEFF"name"');
  assert.ok(csvText([{ name: null }], ["name"]).endsWith('\r\n""'));
});
