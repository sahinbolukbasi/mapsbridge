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
    "BatchGetItemCommand",
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
    redis: {
      createClient() {
        throw new Error("Unexpected Redis access");
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

test("GET /chat/threads returns 200 with an empty threads list", async () => {
  const h = harness();
  const result = await h.load("chat/index.ts").handler(event("GET", "/chat/threads", token()));
  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.ok(Array.isArray(body.threads));
  const query = h.calls.data.find((c) => c.name === "QueryCommand");
  assert.ok(query);
  assert.equal(query.input.IndexName, "GSI1");
  assert.equal(query.input.ExpressionAttributeValues[":pk"], "THREAD#user-a");
});

test("POST /chat/threads returns 400 when participantId is missing", async () => {
  const h = harness();
  const result = await h.load("chat/index.ts").handler(event("POST", "/chat/threads", token(), {}));
  assert.equal(result.statusCode, 400);
  assert.equal(h.calls.data.filter((c) => c.name === "TransactWriteItemsCommand").length, 0);
});

// Alıcı kayıtlı (USER#<id>/META var) — 1.14 kayıtlı-kullanıcı kontrolü.
const registered = (command) =>
  command.name === "BatchGetItemCommand"
    ? { Responses: { "test-data": [{ PK: "USER#x" }] } }
    : { Items: [], Count: 0 };
test("POST /chat/threads creates thread with sorted participants and returns 201", async () => {
  const h = harness({ data: registered });
  const result = await h
    .load("chat/index.ts")
    .handler(event("POST", "/chat/threads", token(), { participantId: "user-z" }));
  assert.equal(result.statusCode, 201);
  const body = JSON.parse(result.body);
  assert.ok(typeof body.threadId === "string" && body.threadId.length > 0);
  const tx = h.calls.data.find((c) => c.name === "TransactWriteItemsCommand");
  assert.ok(tx);
  const meta = tx.input.TransactItems.find((i) => i.Put?.Item?.SK === "META");
  assert.ok(meta);
  assert.equal(meta.Put.Item.createdBy, "user-a");
  // participants are sorted alphabetically
  assert.equal(meta.Put.Item.participants.length, 2);
  assert.ok(meta.Put.Item.participants.includes("user-a"));
  assert.ok(meta.Put.Item.participants.includes("user-z"));
  assert.equal(meta.Put.Item.participants[0], "user-a", "participants must be sorted");
  assert.equal(meta.Put.Item.participants[1], "user-z");
});

test("POST /chat/threads includes initial message in the transaction when provided", async () => {
  const h = harness({ data: registered });
  const result = await h.load("chat/index.ts").handler(
    event("POST", "/chat/threads", token(), {
      participantId: "user-b",
      initialMessage: "Merhaba!",
    }),
  );
  assert.equal(result.statusCode, 201);
  const tx = h.calls.data.find((c) => c.name === "TransactWriteItemsCommand");
  assert.ok(tx);
  const msgPut = tx.input.TransactItems.find((i) => i.Put?.Item?.PK?.startsWith("CHAT#"));
  assert.ok(msgPut, "initial message item should be included in the transaction");
  assert.equal(msgPut.Put.Item.senderId, "user-a");
  assert.equal(msgPut.Put.Item.content, "Merhaba!");
});

test("POST /chat/threads/{id}/messages returns 400 for empty content", async () => {
  const h = harness({ data: () => ({ Item: { participants: ["user-a", "user-b"] } }) });
  const result = await h
    .load("chat/index.ts")
    .handler(event("POST", "/chat/threads/thread-1/messages", token(), { content: "   " }));
  assert.equal(result.statusCode, 400);
  assert.equal(h.calls.data.filter((c) => c.name === "PutItemCommand").length, 0);
});

test("POST /chat/threads/{id}/messages returns 404 when user is not a participant", async () => {
  const h = harness({ data: () => ({ Item: { participants: ["user-b", "user-c"] } }) });
  const result = await h
    .load("chat/index.ts")
    .handler(event("POST", "/chat/threads/private-thread/messages", token(), { content: "Hello" }));
  assert.equal(result.statusCode, 404);
  assert.equal(h.calls.data.filter((c) => c.name === "PutItemCommand").length, 0);
});

test("POST /chat/threads/{id}/messages returns 201 and persists message for verified participant", async () => {
  const h = harness({
    data: (command) => {
      if (command.name === "GetItemCommand")
        return { Item: { participants: ["user-a", "user-b"] } };
      return {};
    },
  });
  const result = await h
    .load("chat/index.ts")
    .handler(
      event("POST", "/chat/threads/shared-thread/messages", token(), { content: "Hi there" }),
    );
  assert.equal(result.statusCode, 201);
  const body = JSON.parse(result.body);
  assert.ok(typeof body.timestamp === "string");
  const put = h.calls.data.find((c) => c.name === "PutItemCommand");
  assert.ok(put);
  assert.equal(put.input.Item.senderId, "user-a");
  assert.equal(put.input.Item.content, "Hi there");
  assert.ok(put.input.Item.PK.startsWith("CHAT#"));
  // thread metadata update should also be issued
  const update = h.calls.data.find((c) => c.name === "UpdateItemCommand");
  assert.ok(update);
  assert.ok(update.input.UpdateExpression.includes("lastMessageAt"));
});

test("GET /chat/threads/{id}/messages returns 404 when thread does not include caller", async () => {
  const h = harness({ data: () => ({ Item: { participants: ["user-b", "user-c"] } }) });
  const result = await h
    .load("chat/index.ts")
    .handler(event("GET", "/chat/threads/secret-thread/messages", token()));
  assert.equal(result.statusCode, 404);
});

test("GET /chat/threads/{id}/messages returns 200 with messages for a participant", async () => {
  const h = harness({
    data: (command) => {
      if (command.name === "GetItemCommand")
        return { Item: { participants: ["user-a", "user-b"] } };
      if (command.name === "QueryCommand")
        return { Items: [{ PK: "CHAT#t1", SK: "MSG#ts", senderId: "user-b", content: "Hey" }] };
      return {};
    },
  });
  const result = await h
    .load("chat/index.ts")
    .handler(event("GET", "/chat/threads/my-thread/messages", token()));
  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.ok(Array.isArray(body.messages));
  assert.equal(body.messages.length, 1);
  assert.equal(body.messages[0].senderId, "user-b");
});

// ─── Increment 1.14 (M1/M2): mesaj istekleri — HTTP + WebSocket kapısı ─────
/** Durumlu bellek tablosu: GetItem/BatchGet/Put/Update/TransactWrite (koşullar dahil). */
function store(seed = {}) {
  const rows = new Map(Object.entries(seed));
  const k = (key) => `${key.PK}|${key.SK}`;
  return {
    rows,
    data(command) {
      const i = command.input;
      switch (command.name) {
        case "GetItemCommand": {
          if (i.TableName === "test-connections")
            return {
              Item: {
                connectionId: i.Key.connectionId,
                userId: i.Key.connectionId.replace("conn-", ""),
                authVersion: 1,
                expiresAt: Math.floor(Date.now() / 1000) + 600,
              },
            };
          return { Item: rows.get(k(i.Key)) };
        }
        case "BatchGetItemCommand": {
          const [t, req] = Object.entries(i.RequestItems)[0];
          return { Responses: { [t]: req.Keys.map((x) => rows.get(k(x))).filter(Boolean) } };
        }
        case "TransactWriteItemsCommand":
          for (const op of i.TransactItems) if (op.Put) rows.set(k(op.Put.Item), op.Put.Item);
          return {};
        case "PutItemCommand":
          rows.set(k(i.Item), i.Item);
          return {};
        case "UpdateItemCommand": {
          const row = rows.get(k(i.Key));
          const v = i.ExpressionAttributeValues;
          if (i.ConditionExpression?.includes(":pending")) {
            if (!row || row.status !== v[":pending"] || row.to !== v[":me"])
              throw Object.assign(new Error("c"), { name: "ConditionalCheckFailedException" });
            rows.set(k(i.Key), { ...row, status: v[":next"] });
          }
          return {};
        }
        default:
          return { Items: [] };
      }
    },
  };
}
const tokenAs = (sub) =>
  [
    { alg: "RS256", typ: "JWT" },
    {
      sub,
      iss: "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_test",
      client_id: "test-client",
      token_use: "access",
      exp: Math.floor(Date.now() / 1000) + 300,
    },
  ]
    .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
    .join(".") + ".signature";
function chatEnv(seed) {
  const s = store({
    "USER#user-b|META": { PK: "USER#user-b", SK: "META" },
    "USER#user-a|META": { PK: "USER#user-a", SK: "META" },
    ...seed,
  });
  const h = harness({
    data: s.data,
    fetch: async (_url, request) => {
      const t = JSON.parse(request.body).AccessToken;
      const sub = JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()).sub;
      return { ok: true, json: async () => cognitoUser(sub) };
    },
  });
  const chat = h.load("chat/index.ts");
  const call = (sub, method, route, body) => chat.handler(event(method, route, tokenAs(sub), body));
  return { s, h, call };
}
async function openThread(env) {
  const res = await env.call("user-a", "POST", "/chat/threads", {
    participantId: "user-b",
    initialMessage: "Merhaba",
  });
  assert.equal(res.statusCode, 201);
  return JSON.parse(res.body).threadId;
}
const send = (env, sub, id, content = "Selam") =>
  env.call(sub, "POST", `/chat/threads/${id}/messages`, { content });

test("1.14: kayıtsız alıcı 404, kendine istek 400", async () => {
  const env = chatEnv();
  const ghost = await env.call("user-a", "POST", "/chat/threads", { participantId: "nobody" });
  assert.equal(ghost.statusCode, 404);
  assert.match(JSON.parse(ghost.body).error, /bulunamadı/);
  const self = await env.call("user-a", "POST", "/chat/threads", { participantId: "user-a" });
  assert.equal(self.statusCode, 400);
  assert.equal(
    env.h.calls.data.filter((c) => c.name === "TransactWriteItemsCommand").length,
    0,
    "thread yazılmaz",
  );
});

test("1.14: yeni thread pending; gönderenin ikinci mesajı 409, alıcı yanıtlamadan 409", async () => {
  const env = chatEnv();
  const id = await openThread(env);
  const req = env.s.rows.get(`THREAD#${id}|REQUEST`);
  assert.deepEqual([req.status, req.from, req.to], ["pending", "user-a", "user-b"]);
  const second = await send(env, "user-a", id);
  assert.equal(second.statusCode, 409);
  assert.equal(JSON.parse(second.body).code, "REQUEST_PENDING");
  assert.match(JSON.parse(second.body).error, /yanıt bekliyor/);
  const early = await send(env, "user-b", id);
  assert.equal(early.statusCode, 409);
  assert.match(JSON.parse(early.body).error, /Önce mesaj isteğini yanıtla/);
});

test("1.14: yalnız alıcı yanıtlar; kabul mesajlaşmayı açar", async () => {
  const env = chatEnv();
  const id = await openThread(env);
  const byOwner = await env.call("user-a", "POST", `/chat/threads/${id}/request`, {
    action: "accept",
  });
  assert.equal(byOwner.statusCode, 404, "gönderen kendi isteğini kabul edemez");
  const bad = await env.call("user-b", "POST", `/chat/threads/${id}/request`, { action: "x" });
  assert.equal(bad.statusCode, 400);
  const ok = await env.call("user-b", "POST", `/chat/threads/${id}/request`, {
    action: "accept",
  });
  assert.equal(ok.statusCode, 200);
  assert.equal(JSON.parse(ok.body).request, "accepted");
  assert.equal((await send(env, "user-a", id)).statusCode, 201);
  assert.equal((await send(env, "user-b", id)).statusCode, 201);
  const again = await env.call("user-b", "POST", `/chat/threads/${id}/request`, {
    action: "decline",
  });
  assert.equal(again.statusCode, 409, "yanıtlanmış istek tekrar değişmez");
});

test("1.14: reddet/engelle → mesaj 403", async () => {
  for (const action of ["decline", "block"]) {
    const env = chatEnv();
    const id = await openThread(env);
    await env.call("user-b", "POST", `/chat/threads/${id}/request`, { action });
    const res = await send(env, "user-a", id);
    assert.equal(res.statusCode, 403, action);
    assert.equal((await send(env, "user-b", id)).statusCode, 403);
  }
});

test("1.14: REQUEST kaydı olmayan eski thread mesaj atabilir; GSI1 anahtarları değişmez", async () => {
  const env = chatEnv({
    "THREAD#legacy|META": { PK: "THREAD#legacy", SK: "META", participants: ["user-a", "user-b"] },
  });
  assert.equal((await send(env, "user-a", "legacy")).statusCode, 201);
  const id = await openThread(env);
  const tx = env.h.calls.data.find((c) => c.name === "TransactWriteItemsCommand").input
    .TransactItems;
  const gsi = tx.filter((o) => o.Put.Item.GSI1PK);
  assert.equal(gsi.length, 2);
  for (const o of gsi) {
    assert.match(o.Put.Item.GSI1PK, /^THREAD#user-[ab]$/);
    assert.equal(typeof o.Put.Item.GSI1SK, "string");
    assert.equal(o.Put.Item.SK.startsWith("PARTICIPANT#"), true);
  }
  assert.equal(tx.find((o) => o.Put.Item.SK === "REQUEST").Put.Item.GSI1PK, undefined);
  const list = await env.call("user-a", "GET", "/chat/threads");
  const q = env.h.calls.data.filter((c) => c.name === "QueryCommand").at(-1);
  assert.equal(list.statusCode, 200);
  assert.deepEqual([q.input.IndexName, q.input.KeyConditionExpression], ["GSI1", "GSI1PK = :pk"]);
  assert.ok(id);
});

test("1.14 WS: pending 409, reddedilmiş 403, kabul edilmiş gönderilir (kapı atlanamaz)", async () => {
  const wsSend = async (env, sub, id) => {
    const ws = env.h.load("ws/onmessage.ts");
    return ws.handler({
      requestContext: { connectionId: `conn-${sub}`, domainName: "ws.example", stage: "prod" },
      body: JSON.stringify({ action: "send_message", threadId: id, content: "WS selam" }),
    });
  };
  const env = chatEnv();
  const id = await openThread(env);
  const pending = await wsSend(env, "user-a", id);
  assert.equal(pending.statusCode, 409);
  assert.equal(JSON.parse(pending.body).code, "REQUEST_PENDING");
  const msgCount = () =>
    [...env.s.rows.keys()].filter((k) => k.startsWith(`CHAT#${id}|MSG#`)).length;
  const before = msgCount();
  assert.equal((await wsSend(env, "user-b", id)).statusCode, 409);
  assert.equal(msgCount(), before, "pending iken WS mesaj yazmaz");

  const declinedEnv = chatEnv();
  const d = await openThread(declinedEnv);
  await declinedEnv.call("user-b", "POST", `/chat/threads/${d}/request`, { action: "decline" });
  assert.equal((await wsSend(declinedEnv, "user-a", d)).statusCode, 403);

  await env.call("user-b", "POST", `/chat/threads/${id}/request`, { action: "accept" });
  const ok = await wsSend(env, "user-a", id);
  assert.equal(ok.statusCode, 200);
  assert.equal(JSON.parse(ok.body).status, "sent");
});

test("1.14: yayınlanmış profil kullanıcı adıyla istek; 404 USER_NOT_FOUND kodu; liste istek durumunu taşır", async () => {
  const env = chatEnv({
    "PROFILE#ayse_k|PUBLIC": {
      PK: "PROFILE#ayse_k",
      SK: "PUBLIC",
      published: true,
      owner: "user-b",
    },
    "PROFILE#gizli|PUBLIC": {
      PK: "PROFILE#gizli",
      SK: "PUBLIC",
      published: false,
      owner: "user-b",
    },
  });
  const byName = await env.call("user-a", "POST", "/chat/threads", { participantId: "Ayse_K" });
  assert.equal(byName.statusCode, 201);
  const id = JSON.parse(byName.body).threadId;
  assert.equal(env.s.rows.get(`THREAD#${id}|REQUEST`).to, "user-b", "kullanıcı adı → sahip sub");
  const unpublished = await env.call("user-a", "POST", "/chat/threads", { participantId: "gizli" });
  assert.equal(unpublished.statusCode, 404);
  assert.equal(JSON.parse(unpublished.body).code, "USER_NOT_FOUND");
  // Liste: GSI1 satırı + REQUEST durumu; REQUEST'siz eski thread accepted.
  const h = harness({
    data: (c) =>
      c.name === "QueryCommand"
        ? { Items: [{ threadId: "t-new", otherParticipant: "user-b" }, { threadId: "t-old" }] }
        : c.name === "BatchGetItemCommand"
          ? {
              Responses: {
                "test-data": [
                  {
                    PK: "THREAD#t-new",
                    SK: "REQUEST",
                    status: "pending",
                    from: "user-a",
                    to: "user-b",
                  },
                ],
              },
            }
          : {},
  });
  const list = JSON.parse(
    (await h.load("chat/index.ts").handler(event("GET", "/chat/threads", token()))).body,
  );
  assert.deepEqual(
    list.threads.map((x) => x.request.status),
    ["pending", "accepted"],
  );
  assert.equal(list.threads[0].request.from, "user-a");
});
