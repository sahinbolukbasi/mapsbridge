// Characterization tests for background-monitor/index.ts.
// Verifies handler returns { checked, alerts } and doesn't crash on empty table.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

const sourceRoot = path.resolve(__dirname, "../src");
const env = {
  AWS_REGION: "eu-central-1",
  DYNAMODB_TABLE: "test-data",
};

function harness(options = {}) {
  const calls = [];
  const cache = new Map();
  const commands = {};
  for (const name of ["ScanCommand", "GetItemCommand", "PutItemCommand"]) {
    commands[name] = class {
      constructor(input) {
        this.name = name;
        this.input = input;
      }
    };
  }
  const external = {
    "@aws-sdk/client-dynamodb": {
      ...commands,
      DynamoDBClient: class {
        async send(cmd) {
          calls.push(cmd);
          if (options.db) return options.db(cmd);
          if (cmd.name === "ScanCommand") return { Items: [] };
          return { Item: null };
        }
      },
    },
    "@aws-sdk/util-dynamodb": { marshall: (v) => v, unmarshall: (v) => v },
  };
  function load(relative) {
    const filename = path.resolve(sourceRoot, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} };
    cache.set(filename, mod);
    const code = transformSync(readFileSync(filename, "utf8"), {
      loader: "ts",
      format: "cjs",
      target: "node22",
    }).code;
    vm.runInNewContext(
      code,
      {
        module: mod,
        exports: mod.exports,
        Buffer,
        process: { env: { ...env, ...options.env } },
        console: { log() {}, warn() {}, error() {} },
        fetch: async (url) => (options.fetch ? options.fetch(url) : { ok: false }),
        require(specifier) {
          if (specifier.startsWith("."))
            return load(path.resolve(path.dirname(filename), `${specifier}.ts`));
          if (external[specifier]) return external[specifier];
          throw new Error(`Unexpected dependency: ${specifier}`);
        },
      },
      { filename },
    );
    return mod.exports;
  }
  return { load, calls };
}

test("handler returns { checked: 0, alerts: 0 } when table is empty", async () => {
  const h = harness();
  const result = await h.load("background-monitor/index.ts").handler();
  assert.equal(result.checked, 0);
  assert.equal(result.alerts, 0);
  const scan = h.calls.find((c) => c.name === "ScanCommand");
  assert.ok(scan, "issued a scan");
});

test("handler issues ScanCommand with correct table", async () => {
  const h = harness();
  await h.load("background-monitor/index.ts").handler();
  const scan = h.calls.find((c) => c.name === "ScanCommand");
  assert.equal(scan.input.TableName, "test-data");
});

test("handler handles FCDO fetch failure gracefully — no alerts, no crash", async () => {
  const h = harness({
    db(cmd) {
      if (cmd.name === "ScanCommand") {
        return {
          Items: [
            {
              PK: "USER#user-a",
              SK: "AI_CHAT#conv1",
              route: { destination: "Turkey" },
              updatedEpoch: Math.floor(Date.now() / 1000),
            },
          ],
        };
      }
      return { Item: null };
    },
    fetch: async () => {
      throw new Error("network error");
    },
  });
  const result = await h.load("background-monitor/index.ts").handler();
  assert.equal(typeof result.checked, "number");
  assert.equal(result.alerts, 0);
});

test("handler skips destination when fetch returns non-ok", async () => {
  const h = harness({
    db(cmd) {
      if (cmd.name === "ScanCommand") {
        return {
          Items: [
            {
              PK: "USER#user-a",
              SK: "AI_CHAT#conv1",
              route: { destination: "Paris" },
              updatedEpoch: Math.floor(Date.now() / 1000),
            },
          ],
        };
      }
      return { Item: null };
    },
    fetch: async () => ({ ok: false }),
  });
  const result = await h.load("background-monitor/index.ts").handler();
  assert.equal(result.checked, 0);
  assert.equal(result.alerts, 0);
});
