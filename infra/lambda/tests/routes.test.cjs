const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");

const sourceRoot = path.resolve(__dirname, "../src");
const env = {
  AWS_REGION: "eu-central-1",
  COGNITO_USER_POOL_ID: "eu-central-1_test",
  COGNITO_CLIENT_ID: "test-client",
  DYNAMODB_TABLE: "test-data",
  CONNECTIONS_TABLE: "test-connections",
  MESSAGES_TABLE: "test-data",
};
const cognitoUser = (sub = "user-a") => ({
  UserAttributes: [{ Name: "sub", Value: sub }],
});
const token = () =>
  [
    { alg: "RS256", typ: "JWT" },
    {
      sub: "user-a",
      iss: "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_test",
      client_id: "test-client",
      token_use: "access",
      exp: Math.floor(Date.now() / 1000) + 300,
    },
  ]
    .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
    .join(".") + ".signature";
const event = (method, route, accessToken, body) => ({
  routeKey: `${method} ${route}`,
  headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  requestContext: { http: { method, path: route }, requestId: "test-request" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

function harness(options = {}) {
  const calls = { data: [] };
  const cache = new Map();
  const commands = {};
  for (const name of [
    "QueryCommand",
    "PutItemCommand",
    "GetItemCommand",
    "UpdateItemCommand",
    "DeleteItemCommand",
    "ScanCommand",
    "TransactWriteItemsCommand",
  ]) {
    commands[name] = class {
      constructor(input) {
        this.name = name;
        this.input = input;
      }
    };
  }
  const external = {
    "@aws-sdk/client-cognito-identity-provider": {},
    "@aws-sdk/client-dynamodb": {
      ...commands,
      DynamoDBClient: class {
        async send(command) {
          calls.data.push(command);
          return options.data ? options.data(command) : { Items: [], Count: 0 };
        }
      },
    },
    "@aws-sdk/client-apigatewaymanagementapi": {
      ApiGatewayManagementApiClient: class {
        async send() {}
      },
      PostToConnectionCommand: class {
        constructor(i) {
          this.input = i;
        }
      },
    },
    "@aws-sdk/util-dynamodb": { marshall: (v) => v, unmarshall: (v) => v },
    "@aws-sdk/client-s3": {
      S3Client: class {
        async send() {
          return {};
        }
      },
      PutObjectCommand: class {
        constructor(i) {
          this.input = i;
        }
      },
      GetObjectCommand: class {
        constructor(i) {
          this.input = i;
        }
      },
      ListObjectsV2Command: class {
        constructor(i) {
          this.input = i;
        }
      },
    },
    "@aws-sdk/client-bedrock-agentcore-control": {
      BedrockAgentCoreControlClient: class {
        async send() {
          return {};
        }
      },
      GetGatewayCommand: class {
        constructor(i) {
          this.input = i;
        }
      },
      ListGatewayTargetsCommand: class {
        constructor(i) {
          this.input = i;
        }
      },
      GetMemoryCommand: class {
        constructor(i) {
          this.input = i;
        }
      },
    },
    "@aws-sdk/client-lambda": {
      LambdaClient: class {
        async send() {
          return { Payload: new TextEncoder().encode("{}") };
        }
      },
      InvokeCommand: class {
        constructor(i) {
          this.input = i;
        }
      },
    },
    "@aws-sdk/client-cloudwatch": {
      CloudWatchClient: class {
        async send() {
          return { MetricDataResults: [] };
        }
      },
      GetMetricDataCommand: class {
        constructor(i) {
          this.input = i;
        }
      },
    },
    "@aws-sdk/client-sqs": {
      SQSClient: class {
        async send() {
          return {};
        }
      },
      GetQueueAttributesCommand: class {
        constructor(i) {
          this.input = i;
        }
      },
    },
    "@aws-sdk/client-bedrock": {
      BedrockClient: class {
        async send() {
          return { modelSummaries: [] };
        }
      },
      ListFoundationModelsCommand: class {
        constructor(i) {
          this.input = i;
        }
      },
      GetFoundationModelCommand: class {
        constructor(i) {
          this.input = i;
        }
      },
    },
    "@aws-sdk/client-ecs": {
      ECSClient: class {
        async send() {
          return {};
        }
      },
      UpdateServiceCommand: class {
        constructor(i) {
          this.input = i;
        }
      },
      DescribeServicesCommand: class {
        constructor(i) {
          this.input = i;
        }
      },
    },
    "@aws-sdk/client-cloudwatch-logs": {
      CloudWatchLogsClient: class {
        async send() {
          return { events: [] };
        }
      },
      FilterLogEventsCommand: class {
        constructor(i) {
          this.input = i;
        }
      },
    },
    redis: {
      createClient() {
        throw new Error("Unexpected Redis access");
      },
    },
    jose: {
      createRemoteJWKSet: () => () => ({}),
      jwtVerify: async () => ({ payload: {}, protectedHeader: {} }),
    },
    "node:crypto": require("node:crypto"),
    "node:fs": require("node:fs"),
    "node:path": require("node:path"),
  };
  function load(relative) {
    let filename = path.resolve(sourceRoot, relative);
    // Fall back to index.ts when the path points to a directory
    if (
      !require("node:fs").existsSync(filename) &&
      require("node:fs").existsSync(filename.replace(/\.ts$/, "/index.ts"))
    ) {
      filename = filename.replace(/\.ts$/, "/index.ts");
    }
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = transformSync(readFileSync(filename, "utf8"), {
      loader: "ts",
      format: "cjs",
      target: "node22",
      supported: { "dynamic-import": false },
    }).code;
    vm.runInNewContext(
      code,
      {
        module,
        exports: module.exports,
        Buffer,
        URL,
        AbortSignal,
        process: { env: { ...env, ...options.env } },
        crypto: require("node:crypto").webcrypto,
        console: { log() {}, warn() {}, error() {} },
        fetch: async (url, request) => {
          return options.fetch
            ? options.fetch(url, request)
            : { ok: true, json: async () => cognitoUser() };
        },
        require(specifier) {
          if (specifier.startsWith("."))
            return load(path.resolve(path.dirname(filename), `${specifier}.ts`));
          if (external[specifier]) return external[specifier];
          throw new Error(`Unexpected dependency: ${specifier}`);
        },
      },
      { filename },
    );
    return module.exports;
  }
  return { load, calls };
}

test("GET /routes returns 200 with an empty routes array for authenticated user", async () => {
  const h = harness();
  const result = await h.load("routes/index.ts").handler(event("GET", "/routes", token()));
  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.ok(Array.isArray(body.routes));
  assert.equal(body.routes.length, 0);
  const query = h.calls.data.find((c) => c.name === "QueryCommand");
  assert.ok(query);
  assert.ok(query.input.KeyConditionExpression.includes("begins_with"));
  // handleListRoutes sets ExpressionAttributeValues in DynamoDB wire format { S: '...' }
  assert.equal(query.input.ExpressionAttributeValues[":pk"].S, "USER#user-a");
});

test("POST /routes returns 400 when name is missing", async () => {
  const h = harness();
  const result = await h
    .load("routes/index.ts")
    .handler(event("POST", "/routes", token(), { stops: [] }));
  assert.equal(result.statusCode, 400);
  assert.equal(h.calls.data.filter((c) => c.name === "PutItemCommand").length, 0);
});

test("POST /routes returns 403 with ROUTE_LIMIT_REACHED when free-tier user has 3 routes", async () => {
  const h = harness({
    data: (command) => {
      if (command.name === "QueryCommand" && command.input.Select === "COUNT") return { Count: 3 };
      return { Items: [], Count: 0 };
    },
  });
  const result = await h
    .load("routes/index.ts")
    .handler(event("POST", "/routes", token(), { name: "Fourth Trip" }));
  assert.equal(result.statusCode, 403);
  const body = JSON.parse(result.body);
  assert.equal(body.code, "ROUTE_LIMIT_REACHED");
  assert.ok(typeof body.upgradeUrl === "string");
  assert.equal(h.calls.data.filter((c) => c.name === "PutItemCommand").length, 0);
});

test("GET /routes/{id} returns 404 when the route does not exist", async () => {
  const h = harness();
  const result = await h
    .load("routes/index.ts")
    .handler(event("GET", "/routes/nonexistent-id", token()));
  assert.equal(result.statusCode, 404);
  // handleGetRoute sets Key in DynamoDB wire format { S: '...' }
  const get = h.calls.data.find(
    (c) => c.name === "GetItemCommand" && c.input.Key?.SK?.S === "ROUTE#nonexistent-id",
  );
  assert.ok(get, "should attempt a DynamoDB lookup by route ID");
  assert.equal(get.input.Key.PK.S, "USER#user-a");
});

test("DELETE /routes/{id} returns 200 and issues DeleteItemCommand for the correct owner", async () => {
  const h = harness();
  const result = await h
    .load("routes/index.ts")
    .handler(event("DELETE", "/routes/my-route", token()));
  assert.equal(result.statusCode, 200);
  const del = h.calls.data.find((c) => c.name === "DeleteItemCommand");
  assert.ok(del);
  // handleDeleteRoute sets Key in DynamoDB wire format { S: '...' }
  assert.equal(del.input.Key.PK.S, "USER#user-a");
  assert.equal(del.input.Key.SK.S, "ROUTE#my-route");
});

test("GET /routes/{id}/osrm/{profile} rejects unauthenticated requests", async () => {
  const h = harness();
  const result = await h
    .load("routes/index.ts")
    .handler(event("GET", "/routes/r1/osrm/helicopter"));
  assert.equal(result.statusCode, 401);
  assert.equal(h.calls.data.length, 0);
});

test("GET /routes/{id}/osrm/{profile} rejects unsupported profiles for authenticated user", async () => {
  const h = harness();
  const result = await h
    .load("routes/index.ts")
    .handler(event("GET", "/routes/r1/osrm/helicopter", token()));
  assert.equal(result.statusCode, 400);
  assert.ok(JSON.parse(result.body).error.includes("Geçersiz"));
  // Auth suspension check makes 1 DynamoDB call; no route data is accessed
  const routeDataCalls = h.calls.data.filter(
    (c) => c.name !== "GetItemCommand" || !c.input?.Key?.PK?.S?.startsWith("USER#"),
  );
  assert.equal(routeDataCalls.length, 0);
});

test("POST /routes/{id}/share creates a share record owned by the verified user", async () => {
  const h = harness({
    data: (command) => {
      if (command.name === "GetItemCommand")
        return { Item: { routeId: "target-route", userId: "user-a" } };
      return {};
    },
  });
  const result = await h
    .load("routes/index.ts")
    .handler(event("POST", "/routes/target-route/share", token(), { expiresInHours: 48 }));
  assert.equal(result.statusCode, 201);
  const body = JSON.parse(result.body);
  assert.ok(typeof body.shareCode === "string" && body.shareCode.length > 0);
  assert.ok(body.url.startsWith("/s/"));
  const put = h.calls.data.find((c) => c.name === "PutItemCommand");
  assert.ok(put);
  assert.ok(put.input.Item.PK.startsWith("SHARE#"));
  assert.equal(put.input.Item.userId, "user-a");
  assert.equal(put.input.Item.routeId, "target-route");
  assert.equal(put.input.ConditionExpression, "attribute_not_exists(PK)");
});

test("POST /routes/telemetry logs events for the authenticated user", async () => {
  const h = harness();
  const now = Date.now();
  const result = await h.load("routes/index.ts").handler(
    event("POST", "/routes/telemetry", token(), {
      events: [
        { type: "click", ts: now },
        { type: "view", ts: now },
      ],
    }),
  );
  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.equal(body.received, 2);
  assert.equal(body.status, "logged");
  const put = h.calls.data.find((c) => c.name === "PutItemCommand");
  assert.ok(put);
  assert.equal(put.input.Item.userId, "user-a");
  assert.equal(put.input.Item.count, 2);
});

test("POST /routes/telemetry rejects anonymous events when no token is provided", async () => {
  const h = harness();
  const result = await h
    .load("routes/index.ts")
    .handler(event("POST", "/routes/telemetry", null, { events: [{ type: "pageview" }] }));
  assert.equal(result.statusCode, 401);
});

// ─── Konum Paylaşımı (süreli, token-korumalı) ──────────────────────────────
test("POST /shares geçersiz konumda 400 döner", async () => {
  const h = harness();
  const result = await h
    .load("routes/index.ts")
    .handler(event("POST", "/shares", token(), { lat: 999, lng: 0, hours: 2 }));
  assert.equal(result.statusCode, 400);
});

test("POST /shares geçerli konumda 201 + code/token/expiresAt döner", async () => {
  const h = harness();
  const result = await h
    .load("routes/index.ts")
    .handler(
      event("POST", "/shares", token(), { lat: 41.0, lng: 29.0, address: "İstanbul", hours: 3 }),
    );
  assert.equal(result.statusCode, 201);
  const body = JSON.parse(result.body);
  assert.ok(
    body.code && body.token && Number.isFinite(body.expiresAt),
    "code/token/expiresAt dönmeli",
  );
  assert.ok(body.token.length >= 32, "token yeterince uzun (sır) olmalı");
});

test("POST /shares kimliksiz istekte 401", async () => {
  const h = harness();
  const result = await h
    .load("routes/index.ts")
    .handler(event("POST", "/shares", undefined, { lat: 41, lng: 29 }));
  assert.equal(result.statusCode, 401);
});

test("GET /shares/{token} geçerli paylaşımda 200 + lat/lng (userId sızmaz)", async () => {
  const future = Math.floor(Date.now() / 1000) + 3600;
  const h = harness({
    data: (cmd) => {
      // GSI1 query → bir item döndür
      if (cmd.name === "QueryCommand") {
        return {
          Items: [
            {
              PK: "SHARE#abc12345",
              SK: "LOCATION",
              token: "x".repeat(64),
              userId: "owner-1",
              lat: 41.0,
              lng: 29.0,
              address: "İstanbul",
              expiresAt: future,
              revoked: false,
            },
          ],
          Count: 1,
        };
      }
      return { Items: [], Count: 0 };
    },
  });
  const result = await h
    .load("routes/index.ts")
    .handler(event("GET", "/shares/" + "x".repeat(64), undefined));
  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.equal(body.lat, 41);
  assert.equal(body.lng, 29);
  assert.equal(body.userId, undefined, "sahip userId sızdırılmamalı");
});

test("GET /shares/{token} süresi dolmuş paylaşımda 404", async () => {
  const past = Math.floor(Date.now() / 1000) - 10;
  const h = harness({
    data: (cmd) => {
      if (cmd.name === "QueryCommand") {
        return {
          Items: [
            {
              PK: "SHARE#old99999",
              SK: "LOCATION",
              lat: 41.0,
              lng: 29.0,
              expiresAt: past,
              revoked: false,
            },
          ],
          Count: 1,
        };
      }
      return { Items: [], Count: 0 };
    },
  });
  const result = await h
    .load("routes/index.ts")
    .handler(event("GET", "/shares/" + "o".repeat(64), undefined));
  assert.equal(result.statusCode, 404);
});
