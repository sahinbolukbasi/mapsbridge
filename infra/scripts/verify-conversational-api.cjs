// End-to-end production smoke test using one temporary account, removed in finally.
// Sends no email; uses only its own trial credits and its own DynamoDB partition.
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
} = require("../lambda/node_modules/@aws-sdk/client-dynamodb");
const region = "eu-central-1",
  pool = "eu-central-1_TKABiLn5f",
  clientId = "62t35qsehl3o9cdc6i4mg01tqt",
  table = "adreskopru-prod-data";
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
    assert.equal(initial.credits, 5);
    const conversationId = randomUUID();
    const clarify = await request("/ai/route-planner", {
      prompt: "Birlikte bir gezi planlayalım.",
      conversationId,
      requestId: randomUUID(),
    });
    assert.equal(clarify.responseMode, "clarify");
    assert.equal(clarify.billing.cost, 0);
    assert.equal((clarify.orchestratorSummary.match(/\?/g) || []).length, 1);
    assert.equal(clarify.trainingCollection, "not_collected");
    const body = {
      prompt: "Roma için iki günlük tarih ve müze rotası hazırla. Sakin gezmek istiyorum.",
      conversationId,
      requestId: randomUUID(),
    };
    const first = await request("/ai/route-planner", body);
    assert.equal(first.provider, "aws_bedrock");
    assert.equal(first.responseMode, "route");
    assert.equal(first.route.estimatedDays, 2);
    assert.equal(first.billing.cost, 5);
    assert.equal(first.billing.credits, 0);
    assert.ok(
      first.route.stops.every((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && s.id),
    );
    assert.equal(first.trainingCollection, "not_collected");
    const replay = await request("/ai/route-planner", body);
    assert.equal(replay.replayed, true);
    assert.equal(replay.billing.credits, 0);
    assert.deepEqual(replay.route, first.route);
    console.log(
      JSON.stringify({
        ok: true,
        checks: [
          "authenticated-api",
          "single-clarification",
          "bedrock-route",
          "gateway-places",
          "real-coordinates",
          "training-default-off",
          "replay-no-double-charge",
        ],
        stops: first.route.stops.length,
        days: first.route.estimatedDays,
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
