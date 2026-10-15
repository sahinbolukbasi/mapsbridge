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
    require: () => ({
      apiFetch() {
        throw new Error("No network expected");
      },
    }),
  },
);
const { csvText } = moduleUnderTest.exports;
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
