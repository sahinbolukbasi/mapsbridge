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
};

const claims = () => ({
  sub: "admin-user",
  iss: "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_test",
  client_id: "test-client",
  token_use: "access",
  exp: Math.floor(Date.now() / 1000) + 300,
});

const adminToken = () =>
  [{ alg: "RS256", typ: "JWT" }, { ...claims() }]
    .map((value) => Buffer.from(JSON.stringify(value)).toString("base64url"))
    .join(".") + ".signature";

const nonAdminToken = () =>
  [
    { alg: "RS256", typ: "JWT" },
    { ...claims(), sub: "normal-user" },
  ]
    .map((value) => Buffer.from(JSON.stringify(value)).toString("base64url"))
    .join(".") + ".signature";

const cognitoUser = (sub = "admin-user", role = "admin") => ({
  Username: sub,
  UserAttributes: [
    { Name: "sub", Value: sub },
    { Name: "custom:role", Value: role },
    { Name: "email_verified", Value: "true" },
  ],
});

const event = (method, route, accessToken, body) => ({
  routeKey: `${method} ${route}`,
  headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  requestContext: { http: { method, path: route }, requestId: "test-request" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

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
    "DescribeTableCommand",
    "TransactWriteItemsCommand",
  ]) {
    commands[name] = class {
      constructor(input) {
        this.name = name;
        this.input = input;
      }
    };
  }
  const cognitoCommands = {};
  for (const name of [
    "AdminListGroupsForUserCommand",
    "ListUsersCommand",
    "AdminDisableUserCommand",
    "AdminEnableUserCommand",
    "AdminGetUserCommand",
    "AdminAddUserToGroupCommand",
    "AdminRemoveUserFromGroupCommand",
    "AdminUpdateUserAttributesCommand",
    "AdminUserGlobalSignOutCommand",
    "AdminDeleteUserAttributesCommand",
  ])
    cognitoCommands[name] = class {
      constructor(input) {
        this.name = name;
        this.input = input;
      }
    };
  const external = {
    "@aws-sdk/client-cognito-identity-provider": {
      ...cognitoCommands,
      CognitoIdentityProviderClient: class {
        async send(command) {
          calls.cognito.push(command);
          return options.cognito ? options.cognito(command) : {};
        }
      },
    },
    "@aws-sdk/client-dynamodb": {
      ...commands,
      DynamoDBClient: class {
        async send(command) {
          calls.data.push(command);
          return options.data
            ? options.data(command)
            : { Items: [], Count: 0, Table: { TableStatus: "ACTIVE" } };
        }
      },
    },
    "@aws-sdk/util-dynamodb": {
      marshall: (value) => value,
      unmarshall: (value) => value,
    },
    "@aws-sdk/client-s3": {
      S3Client: class {
        async send(command) {
          calls.data.push(command);
          return options.s3
            ? options.s3(command)
            : { Contents: [], Body: { transformToString: async () => "{}" } };
        }
      },
      PutObjectCommand: class {
        constructor(input) {
          this.name = "PutObjectCommand";
          this.input = input;
        }
      },
      GetObjectCommand: class {
        constructor(input) {
          this.name = "GetObjectCommand";
          this.input = input;
        }
      },
      ListObjectsV2Command: class {
        constructor(input) {
          this.name = "ListObjectsV2Command";
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
    jose: {
      createRemoteJWKSet: () => () => ({}),
      jwtVerify: async () => ({ payload: {}, protectedHeader: {} }),
    },
  };

  function load(relative) {
    const filename = path.resolve(sourceRoot, relative);
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
        performance: { now: () => Date.now() },
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

test("admin handler denies unauthenticated or non-admin requests", async () => {
  const h = harness();
  // Missing token
  const noToken = await h.load("admin/index.ts").handler(event("GET", "/admin/system-health"));
  assert.equal(noToken.statusCode, 401);

  // Non-admin user
  const h2 = harness({
    fetch: async () => ({ ok: true, json: async () => cognitoUser("normal-user", "user") }),
  });
  const forbiddenResult = await h2
    .load("admin/index.ts")
    .handler(event("GET", "/admin/system-health", nonAdminToken()));
  assert.equal(forbiddenResult.statusCode, 403);
});

test("GET /admin/system-health returns operational status and service breakdown", async () => {
  const h = harness();
  const res = await h
    .load("admin/index.ts")
    .handler(event("GET", "/admin/system-health", adminToken()));
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.health.status, "operational");
  assert.ok(body.health.services.dynamodb);
  assert.ok(body.health.services.cognito);
  assert.ok(body.health.services.bedrock);
  assert.ok(body.health.services.osrm);
});

test("POST /admin/users/{id}/suspend suspends user and writes audit log", async () => {
  const h = harness();
  const res = await h.load("admin/index.ts").handler(
    event("POST", "/admin/users/target-user-123/suspend", adminToken(), {
      reason: "Kullanım koşulları ihlali",
    }),
  );
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.status, "suspended");
  assert.equal(body.userId, "target-user-123");
  assert.equal(body.reason, "Kullanım koşulları ihlali");

  // Verify UpdateItemCommand and PutItemCommand for AUDIT#
  const updateCmd = h.calls.data.find((c) => c.name === "UpdateItemCommand");
  assert.ok(updateCmd);
  assert.equal(updateCmd.input.Key.PK, "USER#target-user-123");

  const auditCmd = h.calls.data.find((c) => c.name === "PutItemCommand");
  assert.ok(auditCmd);
  assert.ok(auditCmd.input.Item.PK.startsWith("AUDIT#"));
  assert.equal(auditCmd.input.Item.action, "user_suspended");
  assert.equal(auditCmd.input.Item.targetId, "target-user-123");
});

test("POST /admin/users/{id}/unsuspend unsuspends user and writes audit log", async () => {
  const h = harness();
  const res = await h.load("admin/index.ts").handler(
    event("POST", "/admin/users/target-user-123/unsuspend", adminToken(), {
      reason: "İtiraz kabul edildi",
    }),
  );
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.status, "active");
  assert.equal(body.userId, "target-user-123");

  const updateCmd = h.calls.data.find((c) => c.name === "UpdateItemCommand");
  assert.ok(updateCmd);
  assert.equal(updateCmd.input.Key.PK, "USER#target-user-123");

  const auditCmd = h.calls.data.find((c) => c.name === "PutItemCommand");
  assert.ok(auditCmd);
  assert.equal(auditCmd.input.Item.action, "user_unsuspended");
});

test("GET /admin/audit-logs returns list of audit records", async () => {
  const sampleAudit = {
    PK: "AUDIT#aud_123",
    SK: "META",
    auditId: "aud_123",
    action: "user_suspended",
    targetId: "user-xyz",
    reason: "Şüpheli aktivite",
    createdAt: "2026-09-15T10:00:00.000Z",
  };
  const h = harness({
    data: (cmd) => (cmd.name === "ScanCommand" ? { Items: [sampleAudit], Count: 1 } : { Count: 0 }),
  });
  const res = await h
    .load("admin/index.ts")
    .handler(event("GET", "/admin/audit-logs", adminToken()));
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.count, 1);
  assert.equal(body.logs[0].auditId, "aud_123");
});

test("GET /admin/reports and POST /admin/reports/{id}/resolve handles moderation queue", async () => {
  const sampleReport = {
    PK: "REPORT#rep_456",
    SK: "META",
    reportId: "rep_456",
    contentType: "route",
    contentId: "route_abc",
    reason: "Spam içerik",
    status: "pending",
  };
  const h = harness({
    data: (cmd) => {
      if (cmd.name === "GetItemCommand" && cmd.input.Key.PK === "REPORT#rep_456")
        return { Item: sampleReport };
      if (cmd.name === "ScanCommand" && cmd.input.ExpressionAttributeValues[":route"])
        return {
          Items: [{ PK: "USER#owner", SK: "ROUTE#route_abc", routeId: "route_abc" }],
          Count: 1,
        };
      return cmd.name === "ScanCommand" ? { Items: [sampleReport], Count: 1 } : {};
    },
  });
  const listRes = await h
    .load("admin/index.ts")
    .handler(event("GET", "/admin/reports", adminToken()));
  assert.equal(listRes.statusCode, 200);
  const listBody = JSON.parse(listRes.body);
  assert.equal(listBody.count, 1);

  const resolveRes = await h.load("admin/index.ts").handler(
    event("POST", "/admin/reports/rep_456/resolve", adminToken(), {
      action: "hide_content",
      notes: "İçerik gizlendi.",
    }),
  );
  assert.equal(resolveRes.statusCode, 200);
  const resolveBody = JSON.parse(resolveRes.body);
  assert.equal(resolveBody.status, "resolved");
  assert.equal(resolveBody.action, "hide_content");
  const routeUpdate = h.calls.data.find(
    (c) => c.name === "UpdateItemCommand" && c.input.Key.SK === "ROUTE#route_abc",
  );
  assert.ok(routeUpdate, "moderation must update the real owner route");
  assert.equal(routeUpdate.input.ExpressionAttributeValues[":public"], false);
});

test("GET /admin/realtime returns telemetry across all domains (maps, social, AI)", async () => {
  const h = harness();
  const res = await h.load("admin/index.ts").handler(event("GET", "/admin/realtime", adminToken()));
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.ok(body.realtime);
  assert.equal(body.realtime.registeredUsers, 0);
  assert.deepEqual(body.realtime.mapClusters, []);
  assert.equal(body.realtime.currentMapUsers, null);
  assert.equal(body.realtime.telemetry.waypointsPerSec, null);
});

test("GET /admin/routes and POST /admin/routes/{id}/action allows route lifecycle management", async () => {
  const sampleRoute = {
    PK: "ROUTE#rt_istanbul_1",
    SK: "META",
    title: "Tarihi Yarımada",
    status: "approved",
  };
  const h = harness({
    data: (cmd) => (cmd.name === "ScanCommand" ? { Items: [sampleRoute], Count: 1 } : {}),
  });

  const listRes = await h
    .load("admin/index.ts")
    .handler(event("GET", "/admin/routes", adminToken()));
  assert.equal(listRes.statusCode, 200);
  const listBody = JSON.parse(listRes.body);
  assert.equal(listBody.count, 1);

  const actRes = await h.load("admin/index.ts").handler(
    event("POST", "/admin/routes/rt_istanbul_1/action", adminToken(), {
      action: "feature",
      reason: "Haftanın öne çıkan rotası",
    }),
  );
  assert.equal(actRes.statusCode, 200);
  const actBody = JSON.parse(actRes.body);
  assert.equal(actBody.status, "success");
  assert.equal(actBody.action, "feature");

  const updateCmd = h.calls.data.find((c) => c.name === "UpdateItemCommand");
  assert.ok(updateCmd);
  assert.equal(updateCmd.input.Key.PK, "ROUTE#rt_istanbul_1");
});

test("GET /admin/system-config and POST /admin/system-config manages maintenance mode persistently", async () => {
  const h = harness();
  const getRes = await h
    .load("admin/index.ts")
    .handler(event("GET", "/admin/system-config", adminToken()));
  assert.equal(getRes.statusCode, 200);
  const getBody = JSON.parse(getRes.body);
  assert.equal(typeof getBody.config.maintenanceMode, "boolean");

  const postRes = await h.load("admin/index.ts").handler(
    event("POST", "/admin/system-config", adminToken(), {
      maintenanceMode: true,
      reason: "Sistem altyapı yükseltmesi",
    }),
  );
  assert.equal(postRes.statusCode, 200);
  const postBody = JSON.parse(postRes.body);
  assert.equal(postBody.config.maintenanceMode, true);

  const tx = h.calls.data.find((c) => c.name === "TransactWriteItemsCommand");
  assert.ok(tx);
  assert.equal(tx.input.TransactItems[0].Put.Item.PK, "SYSTEM#CONFIG");
  assert.ok(tx.input.TransactItems[1].Put.Item.PK.startsWith("AUDIT#"));
});

test("route moderation updates the owner row, hides suspended routes, and preserves privacy on approval", async () => {
  for (const action of ["suspend", "approve"]) {
    const h = harness({
      data: (cmd) =>
        cmd.name === "ScanCommand"
          ? { Items: [{ PK: "USER#owner", SK: "ROUTE#real-route", isPublic: false }], Count: 1 }
          : {},
    });
    const res = await h.load("admin/index.ts").handler(
      event("POST", "/admin/routes/real-route/action", adminToken(), {
        action,
        reason: "İncelendi",
      }),
    );
    assert.equal(res.statusCode, 200);
    const update = h.calls.data.find((c) => c.name === "UpdateItemCommand");
    assert.equal(update.input.Key.PK, "USER#owner");
    assert.equal(update.input.Key.SK, "ROUTE#real-route");
    assert.ok(update.input.ConditionExpression.includes("attribute_exists"));
    if (action === "suspend")
      assert.equal(update.input.ExpressionAttributeValues[":public"], false);
    else assert.ok(!update.input.UpdateExpression.includes("isPublic"));
  }
});

test("invalid or missing route actions never write phantom records", async () => {
  for (const [body, expected] of [
    [{ action: "delete" }, 400],
    [{}, 400],
    [{ action: "approve" }, 404],
  ]) {
    const h = harness();
    const res = await h
      .load("admin/index.ts")
      .handler(event("POST", "/admin/routes/missing/action", adminToken(), body));
    assert.equal(res.statusCode, expected);
    assert.ok(
      !h.calls.data.some((c) => c.name === "UpdateItemCommand" || c.name === "PutItemCommand"),
    );
  }
});

test("filtered scans follow empty pages and group a user only once", async () => {
  const h = harness({
    data: (cmd) => {
      if (cmd.name !== "ScanCommand") return {};
      if (!cmd.input.ExclusiveStartKey)
        return { Items: [], Count: 0, LastEvaluatedKey: { PK: "cursor", SK: "cursor" } };
      return {
        Items: [
          { PK: "USER#one", SK: "CREDITS" },
          { PK: "USER#one", SK: "ROUTE#one" },
          { PK: "USER#one", SK: "META", email: "one@example.com", suspended: true },
        ],
        Count: 3,
      };
    },
  });
  const res = await h.load("admin/index.ts").handler(event("GET", "/admin/users", adminToken()));
  const body = JSON.parse(res.body);
  assert.equal(res.statusCode, 200);
  assert.equal(body.count, 1);
  assert.equal(body.users[0].routesCount, 1);
  assert.equal(body.users[0].email, "one@example.com");
  assert.equal(body.users[0].suspended, true);
  assert.equal(h.calls.data.filter((c) => c.name === "ScanCommand").length, 2);
});

test("invalid configuration and self suspension are rejected without writes", async () => {
  for (const [route, body] of [
    ["/admin/system-config", { maintenanceMode: "false" }],
    ["/admin/users/admin-user/suspend", { reason: "test" }],
  ]) {
    const h = harness();
    const res = await h.load("admin/index.ts").handler(event("POST", route, adminToken(), body));
    assert.equal(res.statusCode, 400);
    assert.ok(
      !h.calls.data.some((c) => c.name === "PutItemCommand" || c.name === "UpdateItemCommand"),
    );
  }
});

test("payments include canonical billing receipts and reflect successful refunds", async () => {
  const h = harness({
    data: (cmd) =>
      cmd.name === "ScanCommand"
        ? {
            Items: [
              {
                PK: "BILLING#CHECKOUT#one",
                SK: "RECEIPT",
                paymentIntentId: "pi_one",
                amount: 12000,
                currency: "try",
                createdAt: "2026-09-15T00:00:00Z",
              },
              {
                PK: "BILLING#INVOICE#two",
                SK: "RECEIPT",
                paymentIntentId: "pi_two",
                amount: 20000,
                currency: "try",
              },
              { PK: "REFUND#one", SK: "META", paymentIntentId: "pi_one", status: "succeeded" },
            ],
          }
        : {},
  });
  const handler = h.load("admin/index.ts").handler;
  const payments = JSON.parse(
    (await handler(event("GET", "/admin/payments", adminToken()))).body,
  ).payments;
  assert.equal(payments.length, 2);
  assert.equal(payments.find((p) => p.paymentIntentId === "pi_one").status, "refunded");
  const finance = JSON.parse(
    (await handler(event("GET", "/admin/finance", adminToken()))).body,
  ).finance;
  assert.equal(finance.totalRevenueTRY, 200);
});

test("every admin handler endpoint is included in the Terraform gateway routes", () => {
  const source = readFileSync(path.join(sourceRoot, "admin/index.ts"), "utf8");
  const routes = readFileSync(path.resolve(__dirname, "../../admin-runtime/routes.json"), "utf8");
  for (const [, route] of source.matchAll(/"((?:GET|POST) \/admin\/[^\"]+)": handle/g))
    assert.ok(routes.includes(`"${route}"`), route);
});

test("production admin membership is read from Cognito groups and ignores custom role", async () => {
  for (const allowed of [true, false]) {
    const h = harness({
      env: { ADMIN_GROUP_NAME: "mapsbridge-admin" },
      cognito: () => ({ Groups: allowed ? [{ GroupName: "mapsbridge-admin" }] : [] }),
    });
    const result = await h
      .load("admin/index.ts")
      .handler(event("GET", "/admin/system-config", adminToken()));
    assert.equal(result.statusCode, allowed ? 200 : 403);
    assert.ok(h.calls.cognito.some((c) => c.name === "AdminListGroupsForUserCommand"));
  }
});

test("production user list includes Cognito accounts without application records", async () => {
  const h = harness({
    env: { COGNITO_USER_MANAGEMENT: "true" },
    cognito: () => ({
      Users: [
        {
          Username: "new-user",
          Enabled: true,
          Attributes: [
            { Name: "sub", Value: "new-user" },
            { Name: "email", Value: "new@example.com" },
          ],
        },
      ],
    }),
  });
  const result = await h.load("admin/index.ts").handler(event("GET", "/admin/users", adminToken()));
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).users[0].email, "new@example.com");
});

test("production suspension also disables the Cognito account", async () => {
  const h = harness({ env: { COGNITO_USER_MANAGEMENT: "true" } });
  const result = await h
    .load("admin/index.ts")
    .handler(
      event("POST", "/admin/users/target-user/suspend", adminToken(), { reason: "İncelendi" }),
    );
  assert.equal(result.statusCode, 200);
  const command = h.calls.cognito.find((c) => c.name === "AdminDisableUserCommand");
  assert.equal(command.input.Username, "target-user");
});

const accountResult = (id = "target-user") => ({
  Username: id,
  Enabled: true,
  UserAttributes: [
    { Name: "sub", Value: id },
    { Name: "email", Value: "target@example.com" },
  ],
});
const pkOf = (cmd) =>
  typeof cmd.input.Key?.PK === "string" ? cmd.input.Key.PK : cmd.input.Key?.PK?.S;

test("moderator and support permissions are enforced on the server", async () => {
  for (const [group, allowed, forbiddenPath] of [
    ["mapsbridge-moderator", "/admin/shares", "/admin/users"],
    ["mapsbridge-support", "/admin/users", "/admin/finance"],
  ]) {
    const h = harness({
      env: {
        ADMIN_GROUP_NAME: "mapsbridge-admin",
        MODERATOR_GROUP_NAME: "mapsbridge-moderator",
        SUPPORT_GROUP_NAME: "mapsbridge-support",
      },
      cognito: () => ({ Groups: [{ GroupName: group }] }),
    });
    const handler = h.load("admin/index.ts").handler;
    assert.equal((await handler(event("GET", allowed, adminToken()))).statusCode, 200);
    assert.equal((await handler(event("GET", forbiddenPath, adminToken()))).statusCode, 403);
    const roleAttempt = await handler(
      event("POST", "/admin/users/target/role", adminToken(), { role: "admin", reason: "test" }),
    );
    assert.equal(roleAttempt.statusCode, 403);
    assert.ok(!h.calls.cognito.some((c) => c.name === "AdminAddUserToGroupCommand"));
  }
});

test("own and protected primary administrator roles cannot be changed", async () => {
  for (const target of ["admin-user", "owner-user"]) {
    const h = harness({ env: { PROTECTED_ADMIN_SUB: "owner-user" } });
    const result = await h.load("admin/index.ts").handler(
      event("POST", `/admin/users/${target}/role`, adminToken(), {
        role: "user",
        reason: "test",
      }),
    );
    assert.ok([400, 403].includes(result.statusCode));
    assert.ok(!h.calls.cognito.some((c) => c.name === "AdminRemoveUserFromGroupCommand"));
  }
});

test("role replacement removes prior elevated roles before granting the selected role", async () => {
  const h = harness({
    env: { COGNITO_USER_MANAGEMENT: "true" },
    cognito: (cmd) =>
      cmd.name === "AdminGetUserCommand"
        ? accountResult()
        : cmd.name === "AdminListGroupsForUserCommand"
          ? { Groups: [{ GroupName: "mapsbridge-admin" }] }
          : {},
  });
  const result = await h.load("admin/index.ts").handler(
    event("POST", "/admin/users/target-user/role", adminToken(), {
      role: "support",
      reason: "Destek ekibine geçiş",
    }),
  );
  assert.equal(result.statusCode, 200);
  const changes = h.calls.cognito.filter((c) =>
    ["AdminAddUserToGroupCommand", "AdminRemoveUserFromGroupCommand"].includes(c.name),
  );
  assert.equal(changes[0].name, "AdminRemoveUserFromGroupCommand");
  assert.equal(changes[1].input.GroupName, "mapsbridge-support");
});

test("credit adjustments are atomic, audited, and reject negative balances", async () => {
  for (const [delta, expected] of [
    [5, 200],
    [-20, 400],
    [0, 400],
    [0.5, 400],
  ]) {
    const h = harness({
      cognito: () => accountResult(),
      data: (cmd) =>
        cmd.name === "GetItemCommand" && cmd.input.Key?.SK === "CREDITS"
          ? { Item: { credits: 10 } }
          : {},
    });
    const result = await h.load("admin/index.ts").handler(
      event("POST", "/admin/users/target-user/credits", adminToken(), {
        delta,
        requestId: "request_1234567890",
        reason: "Destek düzeltmesi",
      }),
    );
    assert.equal(result.statusCode, expected);
    const tx = h.calls.data.find((c) => c.name === "TransactWriteItemsCommand");
    if (expected === 200) {
      assert.equal(tx.input.TransactItems.length, 3);
      assert.equal(tx.input.TransactItems[1].Update.ExpressionAttributeValues[":next"], 15);
      assert.ok(
        tx.input.TransactItems[1].Update.ConditionExpression.includes("credits = :balance"),
      );
    } else assert.equal(tx, undefined);
  }
});

test("replayed credit adjustment never changes the balance twice", async () => {
  const h = harness({
    cognito: () => accountResult(),
    data: (cmd) =>
      pkOf(cmd) === "ADMINCREDIT#request_1234567890"
        ? { Item: { userId: "target-user", delta: 5 } }
        : {},
  });
  const result = await h.load("admin/index.ts").handler(
    event("POST", "/admin/users/target-user/credits", adminToken(), {
      delta: 5,
      requestId: "request_1234567890",
      reason: "retry",
    }),
  );
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).duplicate, true);
  assert.ok(!h.calls.data.some((c) => c.name === "TransactWriteItemsCommand"));
});

test("wallet review never overwrites a concurrently changing credit balance", async () => {
  const h = harness({ cognito: () => accountResult() });
  const result = await h.load("admin/index.ts").handler(
    event("POST", "/admin/users/target-user/wallet", adminToken(), {
      frozen: true,
      reason: "İnceleme",
    }),
  );
  assert.equal(result.statusCode, 200);
  const tx = h.calls.data.find((c) => c.name === "TransactWriteItemsCommand");
  assert.equal(tx.input.TransactItems[0].Update.UpdateExpression, "SET frozen = :frozen");
});

test("share listing omits secret links and coordinates; revocation changes the real record", async () => {
  const record = {
    PK: "SHARE#123456",
    SK: "METADATA",
    code: "123456",
    owner: "target",
    token: "secret",
    lat: "41",
    lng: "29",
    expiresAt: 9999999999,
  };
  const h = harness({
    data: (cmd) =>
      cmd.name === "ScanCommand"
        ? { Items: [record] }
        : pkOf(cmd) === record.PK
          ? { Item: record }
          : {},
  });
  const handler = h.load("admin/index.ts").handler;
  const list = JSON.parse((await handler(event("GET", "/admin/shares", adminToken()))).body).shares;
  assert.equal(list[0].token, undefined);
  assert.equal(list[0].lat, undefined);
  assert.equal(
    (await handler(event("POST", "/admin/shares/123456/revoke", adminToken(), { reason: "İhlal" })))
      .statusCode,
    200,
  );
  const saved = h.calls.data.find((c) => c.name === "TransactWriteItemsCommand").input
    .TransactItems[0].Update;
  assert.equal(saved.Key.SK, "METADATA");
  assert.ok(Object.values(saved.ExpressionAttributeValues).includes(true));
  assert.ok(!Object.values(saved.ExpressionAttributeNames).includes("token"));
  assert.ok(!Object.values(saved.ExpressionAttributeNames).includes("lat"));
});

test("support tickets do not expose internal notes or accept another user replies", async () => {
  const row = {
    PK: "TICKET#one",
    SK: "META",
    id: "one",
    userId: "other-user",
    subject: "Account",
    status: "open",
    version: 1,
    messages: [],
    internalNote: "private",
    createdAt: "2026-09-16",
  };
  const h = harness({
    data: (cmd) =>
      cmd.name === "ScanCommand"
        ? { Items: [{ ...row, userId: "admin-user" }] }
        : pkOf(cmd) === "TICKET#one"
          ? { Item: row }
          : {},
  });
  const handler = h.load("operations/index.ts").handler;
  const list = await handler(event("GET", "/support/tickets", adminToken()));
  assert.equal(JSON.parse(list.body).tickets[0].internalNote, undefined);
  assert.equal(
    (
      await handler(
        event("POST", "/support/tickets/one/reply", adminToken(), {
          version: 1,
          message: "attempt",
        }),
      )
    ).statusCode,
    404,
  );
  assert.ok(!h.calls.data.some((c) => c.name === "TransactWriteItemsCommand"));
});

test("support replies preserve ownership, internal notes and conditional versioning", async () => {
  const row = {
    PK: "TICKET#one",
    SK: "META",
    id: "one",
    userId: "admin-user",
    status: "resolved",
    version: 2,
    messages: [],
    internalNote: "private",
  };
  const h = harness({ data: (cmd) => (pkOf(cmd) === "TICKET#one" ? { Item: row } : {}) });
  const response = await h.load("operations/index.ts").handler(
    event("POST", "/support/tickets/one/reply", adminToken(), {
      version: 2,
      message: "Teşekkürler",
    }),
  );
  assert.equal(response.statusCode, 200);
  const item = h.calls.data.find((c) => c.name === "TransactWriteItemsCommand").input
    .TransactItems[0].Put;
  assert.equal(item.Item.version, 3);
  assert.equal(item.Item.internalNote, "private");
  assert.equal(item.ExpressionAttributeValues[":previous"], 2);
  assert.equal(JSON.parse(response.body).ticket.internalNote, undefined);
});

test("stale content and ticket edits are rejected without overwriting newer records", async () => {
  for (const route of ["/admin/content/blog/example", "/admin/tickets/example"]) {
    const h = harness({
      data: (cmd) =>
        cmd.name === "GetItemCommand" && !cmd.input.ProjectionExpression
          ? { Item: { PK: "BLOG#example", SK: "META", version: 5 } }
          : {},
    });
    const result = await h.load("admin/index.ts").handler(
      event("POST", route, adminToken(), {
        version: 1,
        status: "draft",
        title: "Title",
        content: "Text",
        reason: "Edit",
      }),
    );
    assert.equal(result.statusCode, 409);
    assert.ok(!h.calls.data.some((c) => c.name === "TransactWriteItemsCommand"));
  }
});

test("public announcements respect their publishing window and omit administrative fields", async () => {
  const h = harness({
    data: (cmd) =>
      cmd.name === "ScanCommand"
        ? {
            Items: [
              {
                id: "visible",
                title: "Hi",
                message: "Hello",
                startsAt: "2000-01-01",
                endsAt: "",
                status: "published",
                actorSub: "secret",
              },
              { id: "future", startsAt: "2999-01-01", endsAt: "", status: "published" },
              { id: "expired", startsAt: "2000-01-01", endsAt: "2001-01-01", status: "published" },
            ],
          }
        : {},
  });
  const result = await h.load("operations/index.ts").handler(event("GET", "/system/status"));
  assert.equal(result.statusCode, 200);
  const rows = JSON.parse(result.body).announcements;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "visible");
  assert.equal(rows[0].actorSub, undefined);
});

test("unpublished blog details never leak to public readers", async () => {
  const h = harness({ data: () => ({ Item: { published: false, content: "private draft" } }) });
  const result = await h
    .load("operations/index.ts")
    .handler(event("GET", "/marketplace/blogs/draft"));
  assert.equal(result.statusCode, 404);
  assert.ok(!result.body.includes("private draft"));
});

test("active deployment includes every new management endpoint", () => {
  const source = readFileSync(path.join(sourceRoot, "admin/management.ts"), "utf8");
  const routes = JSON.parse(
    readFileSync(path.resolve(__dirname, "../../admin-runtime/routes.json"), "utf8"),
  );
  for (const [, route] of source.matchAll(/"((?:GET|POST) \/admin\/[^\"]+)":/g))
    assert.equal(routes[route], "admin", route);
});

test("profile edits preserve concurrently updated suspension fields", async () => {
  const row = {
    PK: "USER#target",
    SK: "META",
    name: "Old",
    notes: "",
    suspended: false,
    version: 2,
  };
  const h = harness({
    cognito: () => ({ Username: "target", UserAttributes: [{ Name: "sub", Value: "target" }] }),
    data: (cmd) => (pkOf(cmd) === row.PK ? { Item: row } : {}),
  });
  const result = await h.load("admin/index.ts").handler(
    event("POST", "/admin/users/target/profile", adminToken(), {
      name: "New",
      phone: "",
      notes: "note",
      version: 2,
      reason: "Correction",
    }),
  );
  assert.equal(result.statusCode, 200);
  const update = h.calls.data.find((c) => c.name === "TransactWriteItemsCommand").input
    .TransactItems[0].Update;
  assert.ok(!Object.values(update.ExpressionAttributeNames).includes("suspended"));
  assert.ok(Object.values(update.ExpressionAttributeValues).includes("Old"));
  assert.ok(update.ConditionExpression.includes("#version = :previous"));
});

test("AI dashboard queries a bounded recent window and never fabricates runtime health", async () => {
  const h = harness();
  const response = await h.load("admin/ai-operations.ts").aiOverview();
  const body = JSON.parse(response.body);
  assert.equal(body.runtime, null);
  assert.equal(body.events.length, 0);
  const query = h.calls.data.find((c) => c.name === "QueryCommand");
  assert.equal(query.input.Limit, 200);
  assert.equal(query.input.ScanIndexForward, false);
  assert.equal(query.input.ExpressionAttributeValues[":pk"], "AI#OPERATIONS");
});

test("AI control validates runtime models, optimistic version and default model availability", async () => {
  const runtime = {
    models: ["primary", "intake"],
    primaryModel: "primary",
    observedAt: new Date().toISOString(),
  };
  const existing = { version: 2, enabled: true, defaultModel: "primary", disabledModels: [] };
  const h = harness({
    data: (c) =>
      c.name === "GetItemCommand"
        ? { Item: c.input.Key.PK === "SYSTEM#AI_RUNTIME" ? runtime : existing }
        : {},
  });
  const { updateAIControl } = h.load("admin/ai-operations.ts");
  const valid = {
    version: 2,
    enabled: true,
    defaultModel: "primary",
    disabledModels: [],
    reason: "Operasyon ayarı",
  };
  const make = (patch) => ({
    ...event("POST", "/admin/ai-control", adminToken(), { ...valid, ...patch }),
    verifiedUser: { sub: "admin-user" },
  });
  for (const patch of [
    { version: 1 },
    { defaultModel: "arbitrary" },
    { enabled: "true" },
    { disabledModels: ["primary"] },
    { disabledModels: ["arbitrary"] },
    { reason: "" },
  ]) {
    await assert.rejects(
      () => updateAIControl(make(patch)),
      (err) => [400, 409].includes(err.status),
    );
  }
  assert.equal(h.calls.data.filter((c) => c.name === "TransactWriteItemsCommand").length, 0);
  const response = await updateAIControl(
    make({ defaultModel: "intake", disabledModels: ["primary"] }),
  );
  assert.equal(JSON.parse(response.body).control.defaultModel, "intake");
  const write = h.calls.data.find((c) => c.name === "TransactWriteItemsCommand");
  assert.equal(write.input.TransactItems.length, 2);
  assert.equal(write.input.TransactItems[0].Put.ConditionExpression, "#version = :previous");
  assert.equal(write.input.TransactItems[1].Put.Item.action, "ai_control_updated");
});

test("AI control rejects absent and stale runtime registration", async () => {
  for (const runtime of [null, { models: ["primary"], observedAt: "2020-01-01T00:00:00Z" }]) {
    const h = harness({
      data: (c) =>
        c.name === "GetItemCommand" && c.input.Key.PK === "SYSTEM#AI_RUNTIME"
          ? { Item: runtime }
          : {},
    });
    await assert.rejects(
      () =>
        h
          .load("admin/ai-operations.ts")
          .updateAIControl(event("POST", "/admin/ai-control", adminToken(), { reason: "test" })),
      (err) => err.status === 409,
    );
  }
});

test("runtime blocks disabled assistant, disabled models and unknown models", () => {
  const h = harness({ env: { BEDROCK_MODEL_ID: "primary", BEDROCK_INTAKE_MODEL_ID: "intake" } });
  const { chooseModel } = h.load("shared/ai-operations.ts");
  const control = { enabled: true, defaultModel: "intake", disabledModels: [], version: 0 };
  assert.equal(chooseModel(control), "intake");
  assert.equal(chooseModel(control, "primary"), "primary");
  assert.throws(() => chooseModel({ ...control, enabled: false }), /AI_DISABLED/);
  assert.throws(() => chooseModel({ ...control, disabledModels: ["intake"] }), /MODEL_DISABLED/);
  assert.throws(() => chooseModel(control, "unknown"), /MODEL_NOT_CONFIGURED/);
});

test("AI operations endpoints require system permission", () => {
  const { routePermission, can } = harness().load("admin/permissions.ts");
  for (const endpoint of [
    "/admin/ai-operations",
    "/admin/ai-control",
    "/admin/ai-training",
    "/admin/ai-training/example/review",
  ]) {
    const permission = routePermission(endpoint, "POST");
    assert.equal(permission, "system");
    assert.equal(can("support", permission), false);
    assert.equal(can("moderator", permission), false);
    assert.equal(can("admin", permission), true);
  }
});

test("AI release requires a quality gate and supports publish plus rollback", async () => {
  let release;
  const runtime = {
    models: ["primary"],
    primaryModel: "primary",
    observedAt: new Date().toISOString(),
  };
  const h = harness({
    data: (c) => {
      if (c.name === "GetItemCommand") {
        if (c.input.Key.PK === "SYSTEM#AI_RUNTIME") return { Item: runtime };
        if (c.input.Key.PK === "SYSTEM#AI_RELEASE") return release ? { Item: release } : {};
      }
      if (c.name === "TransactWriteItemsCommand") {
        const put = c.input.TransactItems[0].Put;
        release = put.Item;
      }
      return {};
    },
  });
  const operations = h.load("admin/ai-operations.ts");
  const base = {
    model: "primary",
    promptVersion: "travel-dialogue-v5",
    reason: "Kalite testi",
    metrics: {
      schemaPassRate: 0.99,
      routeValidityRate: 0.95,
      sourceCoverageRate: 0.95,
      decisionSummarySafetyRate: 0.99,
      p95LatencyMs: 3000,
    },
  };
  const blocked = await operations.proposeAIRelease({
    ...event("POST", "/admin/ai-release/propose", adminToken(), {
      ...base,
      metrics: { ...base.metrics, routeValidityRate: 0.8 },
    }),
    verifiedUser: { sub: "admin-user" },
  });
  assert.equal(JSON.parse(blocked.body).qualityGate, "blocked");
  const published = await operations.proposeAIRelease({
    ...event("POST", "/admin/ai-release/propose", adminToken(), base),
    verifiedUser: { sub: "admin-user" },
  });
  assert.equal(JSON.parse(published.body).qualityGate, "passed");
  const publishedResult = await operations.publishAIRelease({
    ...event("POST", "/admin/ai-release/publish", adminToken(), { reason: "Yayın" }),
    verifiedUser: { sub: "admin-user" },
  });
  assert.equal(JSON.parse(publishedResult.body).release.status, "published");
  await operations.proposeAIRelease({
    ...event("POST", "/admin/ai-release/propose", adminToken(), {
      ...base,
      promptVersion: "travel-dialogue-v6",
    }),
    verifiedUser: { sub: "admin-user" },
  });
  await operations.publishAIRelease({
    ...event("POST", "/admin/ai-release/publish", adminToken(), { reason: "İkinci yayın" }),
    verifiedUser: { sub: "admin-user" },
  });
  const rollback = await operations.rollbackAIRelease({
    ...event("POST", "/admin/ai-release/rollback", adminToken(), { reason: "Geri alma" }),
    verifiedUser: { sub: "admin-user" },
  });
  assert.equal(JSON.parse(rollback.body).release.status, "rolled_back");
});
