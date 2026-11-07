// Real AWS smoke test; creates two suppressed-email accounts, one paid model call,
// verifies only their own rows, and revokes/deletes both accounts in finally.
const assert = require("node:assert/strict");
const { randomUUID, randomBytes, createHash } = require("node:crypto");
const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  InitiateAuthCommand,
  AdminDeleteUserCommand,
} = require("../lambda/node_modules/@aws-sdk/client-cognito-identity-provider");
const {
  DynamoDBClient,
  QueryCommand,
  DeleteItemCommand,
  GetItemCommand,
} = require("../lambda/node_modules/@aws-sdk/client-dynamodb");
const { unmarshall } = require("../lambda/node_modules/@aws-sdk/util-dynamodb");
const {
  BedrockAgentCoreClient,
  ListEventsCommand,
} = require("../../node_modules/@aws-sdk/client-bedrock-agentcore");
const fs = require("node:fs");
const region = "eu-central-1",
  pool = "eu-central-1_TKABiLn5f",
  clientId = "62t35qsehl3o9cdc6i4mg01tqt";
const table = "mapsbridge-prod-data",
  memoryTable = "mapsbridge-prod-ai-memory",
  base = "https://pwi1j8mq0j.execute-api.eu-central-1.amazonaws.com";
const cognito = new CognitoIdentityProviderClient({ region }),
  db = new DynamoDBClient({ region }),
  core = new BedrockAgentCoreClient({ region });
const users = [],
  checks = [];
async function request(user, path, method = "GET", body, expected = 200) {
  const response = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(35000),
  });
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return result;
}
async function createUser() {
  const username = `memory-smoke-${randomUUID()}@example.invalid`;
  const response = await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: pool,
      Username: username,
      MessageAction: "SUPPRESS",
      UserAttributes: [
        { Name: "email", Value: username },
        { Name: "email_verified", Value: "true" },
      ],
    }),
  );
  const user = { username, sub: response.User.Attributes.find((a) => a.Name === "sub").Value };
  users.push(user);
  const password = randomBytes(32).toString("base64") + "aA1!";
  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: pool,
      Username: username,
      Password: password,
      Permanent: true,
    }),
  );
  const auth = await cognito.send(
    new InitiateAuthCommand({
      ClientId: clientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: username, PASSWORD: password },
    }),
  );
  user.token = auth.AuthenticationResult.AccessToken;
  return user;
}
async function row(user, SK) {
  const r = await db.send(
    new GetItemCommand({
      TableName: memoryTable,
      Key: { PK: { S: `USER#${user.sub}` }, SK: { S: SK } },
      ConsistentRead: true,
    }),
  );
  return r.Item ? unmarshall(r.Item) : undefined;
}
async function main() {
  const report = { at: new Date().toISOString(), checks };
  try {
    const a = await createUser(),
      b = await createUser();
    assert.equal((await request(a, "/ai/memory")).enabled, false);
    checks.push("default-opt-out");
    await request(a, "/ai/memory", "PATCH", { enabled: true });
    await request(a, "/ai/memory/pace", "PATCH", { value: "Sakin", userId: b.sub });
    assert.equal((await request(a, "/ai/memory")).preferences.pace, "Sakin");
    assert.equal((await request(b, "/ai/memory")).preferences.pace, undefined);
    checks.push("cross-user-isolation");
    const settings = await row(a, "SETTINGS"),
      requestId = randomUUID();
    const body = {
      prompt:
        "Genelde sakin gezerim; seyahat tercihim budur. Yalnızca bunu anladığını söyle, rota oluşturma.",
      requestId,
      conversationId: randomUUID(),
    };
    const first = await request(a, "/ai/route-planner", "POST", body);
    assert.equal(first.provider, "aws_bedrock");
    const replay = await request(a, "/ai/route-planner", "POST", body);
    assert.equal(replay.replayed, true);
    assert.equal(replay.billing.credits, first.billing.credits);
    checks.push("idempotent-billing");
    let job;
    for (let i = 0; i < 12; i++) {
      job = await row(a, `OUTBOX#${requestId}`);
      if (job?.status === "done") break;
      await new Promise((r) => setTimeout(r, 3000));
    }
    assert.equal(job?.status, "done", "Memory outbox was not completed");
    const actorId =
      "u_" +
      createHash("sha256")
        .update(JSON.stringify([a.sub, settings.generation]))
        .digest("hex");
    const events = await core.send(
      new ListEventsCommand({
        memoryId: process.env.AGENTCORE_MEMORY_ID,
        actorId,
        sessionId: job.sessionId,
        includePayloads: true,
      }),
    );
    assert.equal(events.events.length, 1);
    assert.equal(JSON.stringify(events.events).includes(a.username), false);
    checks.push("real-agentcore-event-without-raw-conversation");
    await request(a, "/ai/memory", "DELETE", { scope: "all" }, 202);
    const erased = await request(a, "/ai/memory");
    assert.equal(erased.enabled, false);
    assert.deepEqual(erased.preferences, {});
    assert.deepEqual(erased.memories, []);
    checks.push("immediate-forget-barrier");
    await request(a, "/ai/route-planner", "POST", body, 409);
    checks.push("forgotten-receipt-not-replayed");
    let purge;
    for (let i = 0; i < 20; i++) {
      purge = await row(a, `PURGE#${settings.generation}`);
      if (purge?.lastCheckedAt) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    assert.ok(purge?.lastCheckedAt, "First physical purge pass did not run");
    const remaining = await core
      .send(
        new ListEventsCommand({
          memoryId: process.env.AGENTCORE_MEMORY_ID,
          actorId,
          sessionId: job.sessionId,
        }),
      )
      .catch((error) => {
        if (error.name === "ResourceNotFoundException") return { events: [] };
        throw error;
      });
    assert.equal((remaining.events || []).length, 0);
    checks.push("physical-event-deletion-first-pass");
    const invalid = await fetch(base + "/ai/route-planner", {
      method: "POST",
      headers: {
        Authorization: "Bearer arbitrary-session-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: "Roma", requestId: randomUUID() }),
    });
    assert.equal(invalid.status, 401);
    checks.push("invalid-session-rejected");
    const preflight = await fetch(base + "/ai/memory", {
      method: "OPTIONS",
      headers: {
        Origin: "https://mapsbridge.com",
        "Access-Control-Request-Method": "PATCH",
        "Access-Control-Request-Headers": "authorization,content-type",
      },
    });
    assert.ok((preflight.headers.get("access-control-allow-methods") || "").includes("PATCH"));
    checks.push("browser-patch-cors");
    report.ok = true;
  } finally {
    for (const user of users) {
      if (user.token)
        try {
          await request(user, "/ai/memory", "DELETE", { scope: "all" }, 202);
        } catch {
          report.cleanupPending = true;
        }
      await cognito.send(new AdminDeleteUserCommand({ UserPoolId: pool, Username: user.username }));
      let cursor;
      do {
        const result = await db.send(
          new QueryCommand({
            TableName: table,
            KeyConditionExpression: "PK = :pk",
            ExpressionAttributeValues: { ":pk": { S: `USER#${user.sub}` } },
            ProjectionExpression: "PK, SK",
            ExclusiveStartKey: cursor,
            ConsistentRead: true,
          }),
        );
        for (const key of result.Items || [])
          await db.send(new DeleteItemCommand({ TableName: table, Key: key }));
        cursor = result.LastEvaluatedKey;
      } while (cursor);
    }
    report.cleanup =
      "Temporary Cognito accounts and application rows removed. Retired actor purge audits remain until deletion verification completes.";
    fs.mkdirSync("docs/verification", { recursive: true });
    fs.writeFileSync(
      "docs/verification/ai-memory-live.json",
      JSON.stringify(report, null, 2) + "\n",
    );
  }
  console.log(JSON.stringify(report));
}
if (!process.env.AGENTCORE_MEMORY_ID) throw Error("AGENTCORE_MEMORY_ID required");
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
