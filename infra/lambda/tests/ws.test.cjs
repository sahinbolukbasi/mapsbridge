const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

const sourceRoot = path.resolve(__dirname, "../src");
const env = {
  AWS_REGION: "eu-central-1",
  CONNECTIONS_TABLE: "test-connections",
  MESSAGES_TABLE: "test-data",
};

function fakeToken(claims = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: "user-a",
      iss: "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_test",
      exp: Math.floor(Date.now() / 1000) + 300,
      ...claims,
    }),
  ).toString("base64url");
  return `${header}.${payload}.fakesig`;
}

function buildHandler(filename, opts = {}) {
  const rows = new Map();
  const calls = [];
  const posted = [];

  function loadSource(filepath) {
    const code = readFileSync(filepath, "utf8");
    return transformSync(code, { loader: "ts", format: "cjs", target: "node22" }).code;
  }

  const context = {
    module: { exports: {} },
    exports: {},
    require(spec) {
      if (spec === "@aws-sdk/client-dynamodb") {
        return {
          DynamoDBClient: class {
            send(cmd) {
              calls.push(cmd);
              if (cmd.constructor.name === "GetItemCommand") {
                const pk = cmd.input.Key?.connectionId?.S;
                const row = rows.get(pk);
                return { Item: row || null };
              }
              if (cmd.constructor.name === "QueryCommand") {
                return { Items: opts.queryResult || [] };
              }
              return {};
            }
          },
          GetItemCommand: class GetItemCommand {
            constructor(input) { this.input = input; }
          },
          PutItemCommand: class PutItemCommand {
            constructor(input) { this.input = input; }
          },
          DeleteItemCommand: class DeleteItemCommand {
            constructor(input) { this.input = input; }
          },
          QueryCommand: class QueryCommand {
            constructor(input) { this.input = input; }
          },
        };
      }
      if (spec === "@aws-sdk/util-dynamodb") {
        return {
          marshall: (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, { S: String(v) }])),
          unmarshall: (obj) => {
            if (!obj) return obj;
            const result = {};
            for (const [k, v] of Object.entries(obj)) {
              result[k] = v?.S ?? v?.N ? Number(v.N) : v;
            }
            return result;
          },
        };
      }
      if (spec === "@aws-sdk/client-apigatewaymanagementapi") {
        return {
          ApiGatewayManagementApiClient: class { send(cmd) { posted.push(cmd); } },
          PostToConnectionCommand: class { constructor(input) { this.input = input; } },
        };
      }
      if (spec.startsWith("../shared/")) {
        const resolved = path.resolve(sourceRoot, spec.replace("../shared/", "shared/") + ".ts");
        const mod = { exports: {} };
        const sharedCode = loadSource(resolved);
        vm.runInNewContext(sharedCode, {
          module: mod, exports: mod.exports,
          require: context.require,
          process: { env }, console, Buffer, crypto: require("crypto"), URL, fetch,
        });
        return mod.exports;
      }
      return require(spec);
    },
    process: { env },
    console,
    Buffer,
    JSON,
    Date,
    Math,
    Number,
    crypto: require("crypto"),
  };

  const code = loadSource(path.join(sourceRoot, "ws", filename));
  vm.runInNewContext(code, context);

  return { handler: context.module.exports.handler, calls, rows, posted };
}

// ─── OnConnect Tests ──────────────────────────────────────────────

test("onconnect rejects missing connectionId", async () => {
  const { handler } = buildHandler("onconnect.ts");
  const result = await handler({ requestContext: {} });
  assert.equal(result.statusCode, 400);
});

test("onconnect rejects missing token", async () => {
  const { handler } = buildHandler("onconnect.ts");
  const result = await handler({
    requestContext: { connectionId: "conn-1" },
    queryStringParameters: {},
  });
  assert.equal(result.statusCode, 401);
});

test("onconnect rejects invalid token", async () => {
  const { handler } = buildHandler("onconnect.ts");
  const result = await handler({
    requestContext: { connectionId: "conn-1" },
    queryStringParameters: { token: "invalid.token.here" },
  });
  assert.equal(result.statusCode, 401);
});

// ─── OnDisconnect Tests ───────────────────────────────────────────

test("ondisconnect rejects missing connectionId", async () => {
  const { handler } = buildHandler("ondisconnect.ts");
  const result = await handler({ requestContext: {} });
  assert.equal(result.statusCode, 400);
});

test("ondisconnect sends DeleteItem for valid connectionId", async () => {
  const { handler, calls } = buildHandler("ondisconnect.ts");
  const result = await handler({
    requestContext: { connectionId: "conn-123" },
  });
  assert.equal(result.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].constructor.name, "DeleteItemCommand");
});

// ─── OnMessage Tests ──────────────────────────────────────────────

test("onmessage rejects missing connectionId", async () => {
  const { handler } = buildHandler("onmessage.ts");
  const result = await handler({ requestContext: {}, body: "{}" });
  assert.equal(result.statusCode, 400);
});

test("onmessage rejects invalid JSON body", async () => {
  const { handler } = buildHandler("onmessage.ts");
  const result = await handler({
    requestContext: { connectionId: "conn-1" },
    body: "not json",
  });
  assert.equal(result.statusCode, 400);
});

test("onmessage rejects unknown action", async () => {
  const { handler } = buildHandler("onmessage.ts");
  const result = await handler({
    requestContext: { connectionId: "conn-1" },
    body: JSON.stringify({ action: "unknown", threadId: "t-1" }),
  });
  assert.equal(result.statusCode, 400);
});

test("onmessage rejects missing threadId", async () => {
  const { handler } = buildHandler("onmessage.ts");
  const result = await handler({
    requestContext: { connectionId: "conn-1" },
    body: JSON.stringify({ action: "send_message" }),
  });
  assert.equal(result.statusCode, 400);
});

test("onmessage rejects empty array body", async () => {
  const { handler } = buildHandler("onmessage.ts");
  const result = await handler({
    requestContext: { connectionId: "conn-1" },
    body: "[]",
  });
  assert.equal(result.statusCode, 400);
});
