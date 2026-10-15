// Characterization tests for kb-ingest/index.ts.
// Verifies action dispatch, unknown action throws, and collect with empty DB.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("../../../apps/web/node_modules/esbuild");

const sourceRoot = path.resolve(__dirname, "../src");
const env = {
  AWS_REGION: "eu-central-1",
  DYNAMODB_TABLE: "test-data",
  KB_RAW_BUCKET: "test-bucket",
  TRAVEL_KNOWLEDGE_BASE_ID: "kb-test-id",
  BEDROCK_REGION: "eu-central-1",
};

function harness(options = {}) {
  const calls = [];
  const cache = new Map();
  const commands = {};
  for (const name of ["ScanCommand", "GetItemCommand"]) {
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
          calls.push({ type: "dynamo", cmd });
          if (options.db) return options.db(cmd);
          if (cmd.name === "ScanCommand") return { Items: [] };
          return { Item: null };
        }
      },
    },
    "@aws-sdk/util-dynamodb": { unmarshall: (v) => v },
    "@aws-sdk/client-s3": {
      S3Client: class {
        async send(cmd) {
          calls.push({ type: "s3", cmd });
          return {};
        }
      },
      PutObjectCommand: class {
        constructor(i) {
          this.name = "PutObjectCommand";
          this.input = i;
        }
      },
    },
    "@aws-sdk/client-bedrock-agent": {
      BedrockAgentClient: class {
        async send(cmd) {
          calls.push({ type: "bedrock", cmd });
          return { ingestionJob: { ingestionJobId: "job-123" } };
        }
      },
      StartIngestionJobCommand: class {
        constructor(i) {
          this.name = "StartIngestionJobCommand";
          this.input = i;
        }
      },
    },
    "node:fs": require("node:fs"),
    "node:path": require("node:path"),
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
        __dirname: path.dirname(filename),
        process: { env: { ...env, ...options.env } },
        console: { log() {}, warn() {}, error() {} },
        require(specifier) {
          if (specifier.startsWith("."))
            return load(path.resolve(path.dirname(filename), `${specifier}.ts`));
          if (external[specifier]) return external[specifier];
          return require(specifier);
        },
      },
      { filename },
    );
    return mod.exports;
  }
  return { load, calls };
}

test("handler throws on unknown action", async () => {
  const h = harness();
  await assert.rejects(
    () => h.load("kb-ingest/index.ts").handler({ action: "unknown" }),
    /Unknown action/,
  );
});

test("collect action with empty DynamoDB returns COLLECTED status", async () => {
  const h = harness();
  const result = await h.load("kb-ingest/index.ts").handler({ action: "collect" });
  assert.equal(result.status, "COLLECTED");
  assert.equal(typeof result.uploaded, "number");
});

test("collect action issues ScanCommand on correct table", async () => {
  const h = harness();
  await h.load("kb-ingest/index.ts").handler({ action: "collect" });
  const scan = h.calls.find((c) => c.type === "dynamo" && c.cmd.name === "ScanCommand");
  assert.ok(scan, "issued a DynamoDB scan");
  assert.equal(scan.cmd.input.TableName, "test-data");
});

test("ingest action skips when KB_DATA_SOURCE_ID is not set", async () => {
  const h = harness();
  // env has TRAVEL_KNOWLEDGE_BASE_ID but NOT KB_DATA_SOURCE_ID
  const result = await h.load("kb-ingest/index.ts").handler({ action: "ingest" });
  assert.equal(result.status, "SKIPPED_NO_DS_ID");
  const bedrockCall = h.calls.find((c) => c.type === "bedrock");
  assert.equal(bedrockCall, undefined, "no Bedrock call when data source ID missing");
});

test("ingest action triggers Bedrock when KB_DATA_SOURCE_ID is set", async () => {
  const h = harness({ env: { KB_DATA_SOURCE_ID: "ds-test-123" } });
  const result = await h.load("kb-ingest/index.ts").handler({ action: "ingest" });
  assert.equal(result.status, "INGESTION_STARTED");
  const bedrockCall = h.calls.find((c) => c.type === "bedrock");
  assert.ok(bedrockCall, "issued a Bedrock call");
});
