const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("../../../apps/web/node_modules/esbuild");

const sourceRoot = path.resolve(__dirname, "../src");
const env = {
  AWS_REGION: "eu-central-1",
  COGNITO_USER_POOL_ID: "eu-central-1_test",
  COGNITO_CLIENT_ID: "test-client",
  DYNAMODB_TABLE: "test-data",
  CONNECTIONS_TABLE: "test-connections",
  MESSAGES_TABLE: "test-data",
};
const claims = () => ({
  sub: "user-a",
  iss: "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_test",
  client_id: "test-client",
  token_use: "access",
  exp: Math.floor(Date.now() / 1000) + 300,
});
const token = (changes = {}) =>
  [
    { alg: "RS256", typ: "JWT" },
    { ...claims(), ...changes },
  ]
    .map((value) => Buffer.from(JSON.stringify(value)).toString("base64url"))
    .join(".") + ".signature";
const cognitoUser = (sub = "user-a", role = "user") => ({
  UserAttributes: [
    { Name: "sub", Value: sub },
    { Name: "custom:role", Value: role },
  ],
});
const event = (method, route, accessToken, body) => ({
  routeKey: `${method} ${route}`,
  headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  requestContext: { http: { method, path: route }, requestId: "test-request" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

// Load actual source modules, never generated Lambda artifacts. Only external
// Cognito/DynamoDB boundaries are faked; any unexpected dependency fails loudly.
function harness(options = {}) {
  const calls = { cognito: [], data: [] };
  const cache = new Map();
  const commands = {};
  for (const name of [
    "QueryCommand",
    "PutItemCommand",
    "GetItemCommand",
    "UpdateItemCommand",
    "DeleteItemCommand",
    "ScanCommand",
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
        async send(command) {
          calls.data.push({ name: "Forward", input: command.input });
        }
      },
      PostToConnectionCommand: class {
        constructor(input) {
          this.input = input;
        }
      },
    },
    "@aws-sdk/util-dynamodb": { marshall: (value) => value, unmarshall: (value) => value },
    "@aws-sdk/client-s3": {
      S3Client: class {
        async send() {
          return { Contents: [], Body: { transformToString: async () => "{}" } };
        }
      },
      PutObjectCommand: class {
        constructor(input) {
          this.input = input;
        }
      },
      GetObjectCommand: class {
        constructor(input) {
          this.input = input;
        }
      },
      ListObjectsV2Command: class {
        constructor(input) {
          this.input = input;
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
        constructor(input) {
          this.input = input;
        }
      },
      ListGatewayTargetsCommand: class {
        constructor(input) {
          this.input = input;
        }
      },
      GetMemoryCommand: class {
        constructor(input) {
          this.input = input;
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
        constructor(input) {
          this.input = input;
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
        constructor(input) {
          this.input = input;
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
        constructor(input) {
          this.input = input;
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
        constructor(input) {
          this.input = input;
        }
      },
      GetFoundationModelCommand: class {
        constructor(input) {
          this.input = input;
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
          calls.cognito.push({ url, request });
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

test("valid access token is verified with Cognito and mapped to its subject", async () => {
  const h = harness();
  const access = token({ "custom:role": "admin" });
  const result = await h.load("shared/auth.ts").getVerifiedUser(access);
  assert.equal(result.sub, "user-a");
  assert.equal(result.isAdmin, false, "an untrusted JWT role cannot grant admin");
  assert.equal(h.calls.cognito.length, 1);
  const { url, request } = h.calls.cognito[0];
  assert.equal(url, "https://cognito-idp.eu-central-1.amazonaws.com/");
  assert.equal(request.headers["x-amz-target"], "AWSCognitoIdentityProviderService.GetUser");
  assert.equal(JSON.parse(request.body).AccessToken, access);
  assert.ok(request.signal);
  assert.equal(request.redirect, "error");
});

test("invalid shape, issuer, client, token kind, expiry and future validity are rejected before data access", async () => {
  const cases = [
    undefined,
    null,
    42,
    {},
    "",
    "bad",
    "a.b.c",
    "x".repeat(8193),
    token({ iss: "https://attacker.invalid/pool" }),
    token({ client_id: "another-client" }),
    token({ token_use: "id" }),
    token({ exp: 0 }),
    token({ exp: String(Date.now()) }),
    token({ exp: Math.floor(Date.now() / 1000) }),
    token({ nbf: Date.now() / 1000 + 60 }),
    token({ nbf: "invalid" }),
    token({ sub: "" }),
    token({ sub: undefined }),
  ];
  for (const value of cases) {
    const h = harness();
    assert.equal(await h.load("shared/auth.ts").getVerifiedUser(value), null);
    assert.equal(h.calls.cognito.length, 0);
    assert.equal(h.calls.data.length, 0);
  }
});

test("missing deployment identity configuration denies access", async () => {
  for (const field of ["AWS_REGION", "COGNITO_USER_POOL_ID", "COGNITO_CLIENT_ID"]) {
    const h = harness({ env: { [field]: "" } });
    assert.equal(await h.load("shared/auth.ts").getVerifiedUser(token()), null);
    assert.equal(h.calls.cognito.length, 0);
  }
});

test("forged/revoked token, provider outage, timeout and malformed Cognito response never yield an identity", async () => {
  const failures = [
    async () => ({ ok: false }),
    async () => {
      throw new Error("Network unavailable");
    },
    async () => {
      throw new DOMException("Timed out", "TimeoutError");
    },
    async () => ({
      ok: true,
      json: async () => {
        throw new Error("Bad JSON");
      },
    }),
    async () => ({ ok: true, json: async () => ({}) }),
    async () => ({ ok: true, json: async () => cognitoUser("user-b", "admin") }),
  ];
  for (const fetch of failures) {
    const h = harness({ fetch });
    assert.equal(
      await h.load("shared/auth.ts").getVerifiedUser(token({ "custom:role": "admin" })),
      null,
    );
    assert.equal(h.calls.data.length, 0);
  }
});

const protectedRoutes = [
  ["auth/index.ts", "POST", "/profile/publish", { username: "traveler" }],
  ["auth/index.ts", "POST", "/auth/change-password", { newPassword: "a-long-test-password" }],
  ["routes/index.ts", "POST", "/routes", { name: "Trip", userId: "user-b" }],
  ["chat/index.ts", "GET", "/chat/threads"],
  ["marketplace/index.ts", "POST", "/marketplace/guides", { title: "Guide" }],
  ["stripe/index.ts", "POST", "/stripe/checkout", { tier: "pro" }],
];
for (const [modulePath, method, route, body] of protectedRoutes) {
  test(`${modulePath} denies Cognito-rejected tokens without touching data`, async () => {
    const h = harness({ fetch: async () => ({ ok: false }) });
    const result = await h.load(modulePath).handler(event(method, route, token(), body));
    assert.equal(result.statusCode, 401);
    assert.equal(h.calls.cognito.length, 1);
    assert.equal(h.calls.data.length, 0);
  });
}

test("route creation uses verified owner, ignoring client-supplied identity", async () => {
  const h = harness();
  const result = await h
    .load("routes/index.ts")
    .handler(event("POST", "/routes", token(), { name: "Trip", userId: "user-b" }));
  assert.equal(result.statusCode, 201);
  const writes = h.calls.data.filter((c) => c.name === "PutItemCommand");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].input.Item.PK, "USER#user-a");
  assert.equal(writes[0].input.Item.userId, "user-a");
});

test("profile publishing preserves the verified owner and conditional ownership write", async () => {
  const h = harness();
  const result = await h
    .load("auth/index.ts")
    .handler(event("POST", "/profile/publish", token(), { username: "traveler", owner: "user-b" }));
  assert.equal(result.statusCode, 200);
  assert.equal(
    h.calls.data.filter((c) => c.name === "PutItemCommand")[0].input.Item.PK,
    "OWNER#user-a",
  );
  assert.equal(
    h.calls.data.filter((c) => c.name === "PutItemCommand")[1].input.Item.owner,
    "user-a",
  );
  assert.ok(
    h.calls.data
      .filter((c) => c.name === "PutItemCommand")[1]
      .input.ConditionExpression.includes("#owner = :owner"),
  );
});

test("admin rejects a fabricated role after Cognito rejects the token", async () => {
  const h = harness({ fetch: async () => ({ ok: false }) });
  const result = await h
    .load("admin/index.ts")
    .handler(event("GET", "/admin/metrics", token({ "custom:role": "admin" })));
  assert.equal(result.statusCode, 401);
  assert.equal(h.calls.data.length, 0);
});

test("admin does not fall back to JWT role when Cognito is unavailable", async () => {
  const h = harness({
    fetch: async () => {
      throw new Error("Service unavailable");
    },
  });
  const result = await h
    .load("admin/index.ts")
    .handler(event("GET", "/admin/metrics", token({ "custom:role": "admin" })));
  assert.equal(result.statusCode, 401);
  assert.equal(h.calls.data.length, 0);
});

test("verified non-admin receives 403 even if token claims admin", async () => {
  const h = harness();
  const result = await h
    .load("admin/index.ts")
    .handler(event("GET", "/admin/metrics", token({ "custom:role": "admin" })));
  assert.equal(result.statusCode, 403);
  assert.equal(h.calls.data.length, 1);
  assert.equal(h.calls.data[0].input.ProjectionExpression, "suspended");
});

test("verified Cognito admin can reach the existing metrics handler", async () => {
  const h = harness({
    fetch: async () => ({ ok: true, json: async () => cognitoUser("user-a", "admin") }),
  });
  const result = await h.load("admin/index.ts").handler(event("GET", "/admin/metrics", token()));
  assert.equal(result.statusCode, 200);
  assert.ok(h.calls.data.length > 0);
});

test("WebSocket rejects fabricated or wrong-client identity before storing connection", async () => {
  for (const access of [token(), token({ client_id: "other-client" }), null]) {
    const h = harness({ fetch: async () => ({ ok: false }) });
    const result = await h.load("ws/onconnect.ts").handler({
      requestContext: { connectionId: "conn-1" },
      queryStringParameters: { token: access },
    });
    assert.equal(result.statusCode, 401);
    assert.equal(h.calls.data.length, 0);
  }
});

test("WebSocket stores only verified identity", async () => {
  const h = harness();
  const result = await h.load("ws/onconnect.ts").handler({
    requestContext: { connectionId: "conn-1" },
    queryStringParameters: { token: token(), userId: "user-b" },
  });
  assert.equal(result.statusCode, 200);
  assert.equal(h.calls.data.find((c) => c.name === "PutItemCommand").input.Item.userId, "user-a");
  assert.equal(
    h.calls.data.find((c) => c.name === "PutItemCommand").input.Item.connectionId,
    "conn-1",
  );
});

test("public marketplace listing and OPTIONS remain public", async () => {
  const h = harness();
  const result = await h.load("marketplace/index.ts").handler(event("GET", "/marketplace/guides"));
  assert.equal(result.statusCode, 200);
  assert.equal(h.calls.cognito.length, 0);
  for (const modulePath of [...protectedRoutes.map((r) => r[0]), "admin/index.ts"]) {
    const result = await h.load(modulePath).handler(event("OPTIONS", "/"));
    assert.equal(result.statusCode, 200);
  }
  assert.equal(h.calls.cognito.length, 0);
});

// Conversation authorization exercises the production HTTP/WS modules.
for (const method of ["GET", "POST"]) {
  for (const membership of [
    undefined,
    { participants: ["user-b", "user-c"] },
    { participants: "user-a" },
  ]) {
    test(`HTTP ${method} denies missing, unrelated or malformed membership: ${JSON.stringify(membership)}`, async () => {
      const h = harness({ data: () => ({ Item: membership }) });
      const result = await h
        .load("chat/index.ts")
        .handler(event(method, "/chat/threads/private/messages", token(), { content: "secret" }));
      assert.equal(result.statusCode, 404);
      assert.equal(h.calls.data.length, 2);
      assert.equal(h.calls.data[1].name, "GetItemCommand");
      assert.equal(h.calls.data[1].input.Key.PK, "THREAD#private");
      assert.equal(h.calls.data[1].input.ConsistentRead, true);
    });
  }
  test(`HTTP ${method} allows canonical member`, async () => {
    const h = harness({
      data: (command) =>
        command.name === "GetItemCommand"
          ? { Item: { participants: ["user-a", "user-b"] } }
          : { Items: [] },
    });
    const result = await h
      .load("chat/index.ts")
      .handler(event(method, "/chat/threads/own/messages", token(), { content: "hello" }));
    assert.equal(result.statusCode, method === "GET" ? 200 : 201);
    assert.ok(
      h.calls.data.some((c) => c.name === (method === "GET" ? "QueryCommand" : "PutItemCommand")),
    );
  });
}
const connection = () => ({
  userId: "user-a",
  authVersion: 1,
  expiresAt: Math.floor(Date.now() / 1000) + 60,
});
const wsEvent = (body) => ({
  requestContext: { connectionId: "connection-a", domainName: "test.invalid", stage: "test" },
  body: JSON.stringify(body),
});
function wsHarness({
  conn = connection(),
  participants = ["user-a", "user-b"],
  fail = false,
} = {}) {
  return harness({
    data: (command) => {
      if (fail) throw new Error("database unavailable");
      if (command.name === "GetItemCommand")
        return { Item: command.input.TableName === "test-connections" ? conn : { participants } };
      return { Items: [] };
    },
  });
}
for (const action of ["send_message", "typing", "mark_read"]) {
  test(`WS ${action} denies non-member without writing or forwarding`, async () => {
    const h = wsHarness({ participants: ["user-b", "user-c"] });
    assert.equal(
      (
        await h
          .load("ws/onmessage.ts")
          .handler(wsEvent({ action, threadId: "private", content: "secret" }))
      ).statusCode,
      404,
    );
    assert.ok(h.calls.data.every((c) => c.name === "GetItemCommand"));
  });
  test(`WS ${action} rejects unrelated recipient`, async () => {
    const h = wsHarness();
    assert.equal(
      (
        await h
          .load("ws/onmessage.ts")
          .handler(wsEvent({ action, threadId: "own", content: "hello", recipientId: "user-c" }))
      ).statusCode,
      403,
    );
    assert.ok(h.calls.data.every((c) => c.name === "GetItemCommand"));
  });
  test(`WS ${action} permits member and derives recipient`, async () => {
    const h = wsHarness();
    assert.equal(
      (
        await h
          .load("ws/onmessage.ts")
          .handler(wsEvent({ action, threadId: "own", content: "hello" }))
      ).statusCode,
      200,
    );
    const query = h.calls.data.find((c) => c.name === "QueryCommand");
    if (action !== "mark_read")
      assert.equal(query.input.ExpressionAttributeValues[":userId"], "user-b");
  });
}
test("WS rejects expired, legacy and malformed sessions before thread access", async () => {
  for (const conn of [
    { userId: "user-a" },
    { ...connection(), expiresAt: 0 },
    { ...connection(), expiresAt: "9999999999" },
    { ...connection(), userId: "" },
  ]) {
    const h = wsHarness({ conn });
    assert.equal(
      (await h.load("ws/onmessage.ts").handler(wsEvent({ action: "typing", threadId: "own" })))
        .statusCode,
      401,
    );
    assert.equal(h.calls.data.length, 1);
  }
});
test("WS provider outage fails closed and invalid body has no side effects", async () => {
  const h = wsHarness({ fail: true });
  assert.equal(
    (await h.load("ws/onmessage.ts").handler(wsEvent({ action: "typing", threadId: "own" })))
      .statusCode,
    503,
  );
  for (const body of [null, [], { action: "typing" }, { action: "unexpected", threadId: "own" }]) {
    const clean = wsHarness();
    assert.equal((await clean.load("ws/onmessage.ts").handler(wsEvent(body))).statusCode, 400);
    assert.equal(clean.calls.data.length, 0);
  }
});
test("new WS connection expires no later than verified access token and marks auth version", async () => {
  const h = harness();
  const exp = Math.floor(Date.now() / 1000) + 120;
  const result = await h.load("ws/onconnect.ts").handler({
    requestContext: { connectionId: "new" },
    queryStringParameters: { token: token({ exp }) },
  });
  assert.equal(result.statusCode, 200);
  assert.equal(h.calls.data.find((c) => c.name === "PutItemCommand").input.Item.expiresAt, exp);
  assert.equal(h.calls.data.find((c) => c.name === "PutItemCommand").input.Item.authVersion, 1);
});

test("WS forwards only to current verified recipient connections", async () => {
  const active = { ...connection(), userId: "user-b", connectionId: "valid-b" };
  const h = harness({
    data: (command) => {
      if (command.name === "GetItemCommand")
        return {
          Item:
            command.input.TableName === "test-connections"
              ? connection()
              : { participants: ["user-a", "user-b"] },
        };
      if (command.name === "QueryCommand")
        return {
          Items: [
            active,
            { ...active, connectionId: "expired", expiresAt: 0 },
            { ...active, connectionId: "legacy", authVersion: undefined },
            { ...active, connectionId: "wrong-user", userId: "user-c" },
          ],
        };
      return {};
    },
  });
  const result = await h
    .load("ws/onmessage.ts")
    .handler(wsEvent({ action: "send_message", threadId: "own", content: "hello" }));
  assert.equal(result.statusCode, 200);
  const forwarded = h.calls.data.filter((c) => c.name === "Forward");
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0].input.ConnectionId, "valid-b");
});
test("HTTP database failure does not expose history or write messages", async () => {
  for (const method of ["GET", "POST"]) {
    const h = harness({
      data: (command) => {
        if (command.input.ProjectionExpression === "suspended") return {};
        throw new Error("unavailable");
      },
    });
    const result = await h
      .load("chat/index.ts")
      .handler(event(method, "/chat/threads/own/messages", token(), { content: "hello" }));
    assert.equal(result.statusCode, 500);
    assert.equal(h.calls.data.length, 2);
  }
});

test("suspended users cannot access APIs even with a valid Cognito token", async () => {
  const h = harness({
    data: (command) =>
      command.input.ProjectionExpression === "suspended" ? { Item: { suspended: true } } : {},
  });
  const result = await h.load("routes/index.ts").handler(event("GET", "/routes", token()));
  assert.equal(result.statusCode, 401);
  assert.equal(h.calls.data.length, 1);
  assert.equal(h.calls.data[0].input.ConsistentRead, true);
});

test("suspended routes cannot be republished or shared by their owner", async () => {
  for (const [method, url] of [
    ["PUT", "/routes/hidden"],
    ["POST", "/routes/hidden/share"],
  ]) {
    const h = harness({
      data: (command) =>
        command.input.ProjectionExpression === "suspended"
          ? {}
          : { Item: { adminStatus: "suspended" } },
    });
    const result = await h
      .load("routes/index.ts")
      .handler(event(method, url, token(), { isPublic: true }));
    assert.equal(result.statusCode, 403);
    assert.ok(!h.calls.data.some((c) => ["PutItemCommand", "UpdateItemCommand"].includes(c.name)));
  }
});

test("suspension also blocks messages on an existing WebSocket connection", async () => {
  const h = harness({
    data: (command) => {
      if (command.input.TableName === "test-connections") return { Item: connection() };
      if (command.input.ProjectionExpression === "suspended") return { Item: { suspended: true } };
      return {};
    },
  });
  const result = await h
    .load("ws/onmessage.ts")
    .handler(wsEvent({ action: "send_message", threadId: "own", content: "blocked" }));
  assert.equal(result.statusCode, 403);
  assert.ok(!h.calls.data.some((c) => ["PutItemCommand", "Forward"].includes(c.name)));
});
