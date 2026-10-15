// End-to-end production smoke test using one temporary account, removed in finally.
// Sends no email; uses only its own trial credits and its own DynamoDB partition.
const assert = require("node:assert/strict");
const { randomUUID, randomBytes } = require("node:crypto");
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
} = require("../lambda/node_modules/@aws-sdk/client-dynamodb");
const region = "eu-central-1",
  pool = "eu-central-1_TKABiLn5f",
  clientId = "62t35qsehl3o9cdc6i4mg01tqt",
  table = "mapsbridge-prod-data";
const cognito = new CognitoIdentityProviderClient({ region }),
  db = new DynamoDBClient({ region });
const username = `ai-smoke-${randomUUID()}@example.invalid`;
let created = false,
  sub;
async function main() {
  try {
    const user = await cognito.send(
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
    created = true;
    sub = user.User.Attributes.find((a) => a.Name === "sub").Value;
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
    const token = auth.AuthenticationResult.AccessToken;
    async function request(path, body) {
      const response = await fetch(
        "https://0duy2hfjd2.execute-api.eu-central-1.amazonaws.com" + path,
        {
          method: body ? "POST" : "GET",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: AbortSignal.timeout(35000),
        },
      );
      const result = await response.json();
      assert.equal(response.status, 200, JSON.stringify(result));
      return result;
    }
    const initial = await request("/stripe/wallet");
    assert.equal(initial.credits, 10);
    assert.equal(initial.configured, true);
    const conversationId = randomUUID();
    const clarify = await request("/ai/route-planner", {
      prompt: "Birlikte bir gezi planlayalım.",
      conversationId,
      requestId: randomUUID(),
    });
    assert.equal(clarify.responseMode, "clarify");
    assert.equal(clarify.route, undefined);
    assert.equal(clarify.billing.cost, 0);
    assert.equal(clarify.billing.credits, 10);
    const interests = await request("/ai/route-planner", {
      prompt: "Roma için iki gün düşünüyorum. Önce ilgi alanlarımı sor.",
      conversationId,
      requestId: randomUUID(),
    });
    assert.equal(interests.responseMode, "clarify");
    assert.equal(interests.billing.cost, 0);
    assert.equal(interests.billing.credits, 10);
    const body = {
      prompt:
        "Her seyahatimde tarih ve kültür duraklarını severim. Bu gezi için tarih ve müzeler ilgimi çekiyor. Şimdi rotayı oluştur.",
      conversationId,
      requestId: randomUUID(),
    };
    const first = await request("/ai/route-planner", body);
    assert.equal(first.provider, "aws_bedrock");
    assert.equal(first.responseMode, "route");
    assert.equal(first.route.estimatedDays, 2);
    assert.match(first.route.destination, /roma|rome/i);
    assert.equal(first.billing.credits, 5);
    assert.equal(first.research.status, "available");
    assert.ok(
      first.preferences.interests?.includes("tarih") ||
        first.preferences.travelStyle === "cultural",
    );
    const replay = await request("/ai/route-planner", body);
    assert.equal(replay.replayed, true);
    assert.equal(replay.billing.credits, 5);
    assert.deepEqual(replay.route, first.route);
    const memory = await request("/stripe/wallet");
    assert.deepEqual(memory.preferences, first.preferences);
    assert.equal(memory.usage.requestsToday, 3);
    const next = await request("/ai/route-planner", {
      prompt: "Aynı şehirde kalalım. İkinci güne kahve molası ekle, diğer durakları koru.",
      conversationId,
      requestId: randomUUID(),
    });
    assert.match(next.route.destination, /roma|rome/i);
    assert.equal(next.billing.credits, 0);
    assert.equal(next.route.estimatedDays, 2);
    assert.ok(
      next.route.stops.some(
        (s) => s.day === 2 && /caff|cafe|coffee|kahve/i.test(s.name + " " + s.description),
      ),
    );
    const forgotten = await request("/ai/route-planner", { action: "forgetPreferences" });
    assert.deepEqual(forgotten.preferences, {});
    assert.deepEqual((await request("/stripe/wallet")).preferences, {});
    console.log(
      JSON.stringify({
        ok: true,
        checks: [
          "verified-login",
          "trial-credits",
          "bedrock-route",
          "learned-preferences",
          "replay-without-double-charge",
          "memory-across-conversations",
          "same-destination-edit",
          "free-clarification",
          "server-conversation-context",
          "live-place-research",
          "forget-preferences",
        ],
        destinations: [first.route.destination, next.route.destination],
      }),
    );
  } finally {
    if (created)
      await cognito.send(new AdminDeleteUserCommand({ UserPoolId: pool, Username: username }));
    if (sub) {
      let cursor;
      do {
        const rows = await db.send(
          new QueryCommand({
            TableName: table,
            KeyConditionExpression: "PK = :pk",
            ExpressionAttributeValues: { ":pk": { S: `USER#${sub}` } },
            ProjectionExpression: "PK, SK",
            ExclusiveStartKey: cursor,
            ConsistentRead: true,
          }),
        );
        for (const key of rows.Items || [])
          await db.send(new DeleteItemCommand({ TableName: table, Key: key }));
        cursor = rows.LastEvaluatedKey;
      } while (cursor);
    }
    if (created) console.log("Temporary test account and its data removed");
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
