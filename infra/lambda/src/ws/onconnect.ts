/**
 * MapsBridge WebSocket — OnConnect Handler
 * Stores connectionId → userId mapping in DynamoDB.
 * Authenticates the user via ?token= query param (Cognito JWT).
 */

import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { verifiedUserId } from "../shared/auth";

export const handler = async (event: any) => {
  const connectionId = event.requestContext?.connectionId;
  const queryString = event.queryStringParameters || {};
  const token = queryString.token;

  if (!connectionId) {
    return { statusCode: 400, body: "Missing connectionId" };
  }

  if (!token) {
    return { statusCode: 401, body: "Missing auth token" };
  }

  const userId = await verifiedUserId(token);
  if (!userId) {
    return { statusCode: 401, body: "Invalid session" };
  }

  const tableName = process.env.CONNECTIONS_TABLE || "";
  const now = new Date().toISOString();
  // Claims are read only after Cognito has verified this exact token.
  const tokenExpiresAt = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).exp;
  const expiresAt = Math.min(tokenExpiresAt, Math.floor(Date.now() / 1000) + 3600);

  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  await ddb.send(
    new PutItemCommand({
      TableName: tableName,
      Item: marshall({
        connectionId,
        userId,
        connectedAt: now,
        expiresAt,
        authVersion: 1,
      }),
    }),
  );

  return { statusCode: 200, body: "Connected" };
};
