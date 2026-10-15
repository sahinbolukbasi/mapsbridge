/**
 * MapsBridge WebSocket — OnMessage Handler
 * Routes incoming WebSocket messages to the appropriate handler.
 * Actions: "send_message", "typing", "mark_read"
 *
 * Messages are stored in the shared DynamoDB table (CHAT#threadId).
 * The WS posts to the Personal Channel API or uses the ManageConnections
 * API to forward messages to the recipient.
 */

import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  PutItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { threadParticipants } from "../shared/thread-access";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

export const handler = async (event: any) => {
  try {
    return await handleEvent(event);
  } catch {
    return { statusCode: 503, body: "Messaging temporarily unavailable" };
  }
};

async function handleEvent(event: any) {
  const connectionId = event.requestContext?.connectionId;
  const domain = event.requestContext?.domainName;
  const stage = event.requestContext?.stage;
  const connectionsTable = process.env.CONNECTIONS_TABLE || "";
  const messagesTable = process.env.MESSAGES_TABLE || "";

  if (!connectionId) {
    return { statusCode: 400, body: "Missing connectionId" };
  }

  let body: any;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  if (!body || typeof body !== "object" || Array.isArray(body))
    return { statusCode: 400, body: "Invalid message" };
  const { action, threadId, content } = body;
  if (
    !["send_message", "typing", "mark_read"].includes(action) ||
    typeof threadId !== "string" ||
    !threadId.trim() ||
    threadId.length > 128
  ) {
    return { statusCode: 400, body: "Invalid action or threadId" };
  }

  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  // Get sender's userId from connections table
  const senderResult = await ddb.send(
    new GetItemCommand({
      TableName: connectionsTable,
      Key: marshall({ connectionId }),
      ConsistentRead: true,
    }),
  );

  if (!senderResult.Item) {
    return { statusCode: 401, body: "Not authenticated" };
  }

  const sender = unmarshall(senderResult.Item);
  if (
    sender.authVersion !== 1 ||
    typeof sender.userId !== "string" ||
    !sender.userId ||
    !Number.isFinite(sender.expiresAt) ||
    sender.expiresAt <= Date.now() / 1000
  ) {
    return { statusCode: 401, body: "Session expired; reconnect" };
  }
  const senderId = sender.userId;
  const account = await ddb.send(
    new GetItemCommand({
      TableName: messagesTable,
      Key: marshall({ PK: `USER#${senderId}`, SK: "META" }),
      ProjectionExpression: "suspended",
      ConsistentRead: true,
    }),
  );
  if (account.Item && unmarshall(account.Item).suspended === true)
    return { statusCode: 403, body: "Account suspended" };
  const participants = await threadParticipants(ddb, messagesTable, threadId, senderId);
  if (!participants) return { statusCode: 404, body: "Conversation unavailable" };
  // This API currently supports direct conversations only. Never forward to an arbitrary client recipient.
  if (participants.length !== 2) return { statusCode: 400, body: "Unsupported conversation" };
  const recipientId = participants.find((id) => id !== senderId)!;
  if (body.recipientId !== undefined && body.recipientId !== recipientId) {
    return { statusCode: 403, body: "Invalid recipient" };
  }

  switch (action) {
    case "send_message":
      return handleSendMessage(
        ddb,
        connectionsTable,
        messagesTable,
        domain,
        stage,
        senderId,
        threadId,
        content,
        recipientId,
      );
    case "typing":
      return handleTyping(ddb, connectionsTable, domain, stage, senderId, threadId, recipientId);
    case "mark_read":
      return handleMarkRead(ddb, messagesTable, senderId, threadId);
    default:
      return { statusCode: 400, body: `Unknown action: ${action}` };
  }
}

// ─── Send Message ─────────────────────────────────────────────────────────
async function handleSendMessage(
  ddb: DynamoDBClient,
  connectionsTable: string,
  messagesTable: string,
  domain: string,
  stage: string,
  senderId: string,
  threadId: string,
  content: string,
  recipientId: string,
) {
  if (typeof content !== "string" || !content.trim()) {
    return { statusCode: 400, body: "Message content required" };
  }

  const now = new Date().toISOString();
  const timestamp = now;

  // Store message in DynamoDB
  await ddb.send(
    new PutItemCommand({
      TableName: messagesTable,
      Item: marshall({
        PK: `CHAT#${threadId}`,
        SK: `MSG#${timestamp}`,
        senderId,
        content: content.trim().slice(0, 2000),
        timestamp,
      }),
    }),
  );

  // Forward to recipient if connected
  if (recipientId) {
    await forwardToRecipient(ddb, connectionsTable, domain, stage, recipientId, {
      type: "new_message",
      threadId,
      senderId,
      content: content.trim().slice(0, 2000),
      timestamp,
    });
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ status: "sent", timestamp }),
  };
}

// ─── Typing Indicator ─────────────────────────────────────────────────────
async function handleTyping(
  ddb: DynamoDBClient,
  connectionsTable: string,
  domain: string,
  stage: string,
  senderId: string,
  threadId: string,
  recipientId: string,
) {
  if (recipientId) {
    await forwardToRecipient(ddb, connectionsTable, domain, stage, recipientId, {
      type: "typing",
      threadId,
      senderId,
    });
  }

  return { statusCode: 200, body: "OK" };
}

// ─── Mark as Read ─────────────────────────────────────────────────────────
async function handleMarkRead(
  ddb: DynamoDBClient,
  messagesTable: string,
  senderId: string,
  threadId: string,
) {
  // Update the last read timestamp for the user
  await ddb.send(
    new PutItemCommand({
      TableName: messagesTable,
      Item: marshall({
        PK: `CHAT#${threadId}`,
        SK: `READ#${senderId}`,
        userId: senderId,
        lastReadAt: new Date().toISOString(),
      }),
    }),
  );

  return { statusCode: 200, body: "OK" };
}

// ─── Forward to Recipient ─────────────────────────────────────────────────
async function forwardToRecipient(
  ddb: DynamoDBClient,
  connectionsTable: string,
  domain: string,
  stage: string,
  recipientId: string,
  payload: any,
) {
  // Find all connections for the recipient
  const result = await ddb.send(
    new QueryCommand({
      TableName: connectionsTable,
      IndexName: "userId-index",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: marshall({ ":userId": recipientId }),
    }),
  );

  if (!result.Items?.length) return;

  const apiClient = new ApiGatewayManagementApiClient({
    endpoint: `https://${domain}/${stage}`,
    region: process.env.AWS_REGION,
  });

  const message = JSON.stringify(payload);

  for (const item of result.Items) {
    const conn = unmarshall(item);
    if (
      conn.authVersion !== 1 ||
      conn.userId !== recipientId ||
      !Number.isFinite(conn.expiresAt) ||
      conn.expiresAt <= Date.now() / 1000
    )
      continue;
    try {
      await apiClient.send(
        new PostToConnectionCommand({
          ConnectionId: conn.connectionId,
          Data: Buffer.from(message),
        }),
      );
    } catch (err: any) {
      // Connection might be stale — remove it
      if (err.name === "GoneException") {
        await ddb.send(
          new DeleteItemCommand({
            TableName: connectionsTable,
            Key: marshall({ connectionId: conn.connectionId }),
          }),
        );
      }
    }
  }
}
