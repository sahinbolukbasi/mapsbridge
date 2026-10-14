import { verifiedUserId } from "../shared/auth";
/**
 * MapsBridge Chat Domain — Lambda handler (HTTP endpoints)
 * Routes: GET /chat/threads, POST /chat/threads
 *         GET /chat/threads/{id}/messages, POST /chat/threads/{id}/messages
 *
 * Real-time messaging is handled by the WebSocket API (messaging module).
 * These HTTP endpoints provide the REST interface for listing threads,
 * fetching history, and sending messages when WebSocket is unavailable.
 *
 * Architecture:
 *   Messages are stored in the shared DynamoDB table (from hosting.tf)
 *   PK = CHAT#threadId
 *   SK = MSG#{timestamp}  (sorted by time)
 *   GSI: by participant for thread listing
 */

import type { ApiGatewayEvent } from "../shared/http";
import { ok, created, badRequest, unauthorized, notFound, serverError, handlePreflight, extractBearerToken, parseBody } from "../shared/http";
import { Router } from "../shared/router";
import { threadParticipants, ChatService } from "../../../../services/messaging/src/application/chat-service";

const router = new Router();

router.add("GET /chat/threads", handleListThreads);
router.add("POST /chat/threads", handleCreateThread);
router.add("GET /chat/threads/{id}/messages", handleGetMessages);
router.add("POST /chat/threads/{id}/messages", handleSendMessage);

export const handler = async (event: ApiGatewayEvent) => {
  try {
    return await router.dispatch(event);
  } catch (err) {
    console.error(`[Chat] Error:`, err);
    return serverError();
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────
function getTableName(): string {
  return process.env.DYNAMODB_TABLE || `adreskopru-${process.env.ENVIRONMENT}-data`;
}



async function getDdb() {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  return new DynamoDBClient({ region: process.env.AWS_REGION });
}

// ─── List Threads (user's conversations) ──────────────────────────────────
async function handleListThreads(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();

  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();

  const { DynamoDBClient, QueryCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall, unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  // Query GSI by participant
  const result = await ddb.send(new QueryCommand({
    TableName: getTableName(),
    IndexName: "GSI1",
    KeyConditionExpression: "GSI1PK = :pk",
    ExpressionAttributeValues: marshall({ ":pk": `THREAD#${userId}` }),
    ScanIndexForward: false,
    Limit: ChatService.MAX_THREAD_LIST,
  }));

  const threads = (result.Items || []).map(i => unmarshall(i));
  return ok({ threads });
}

// ─── Create Thread ────────────────────────────────────────────────────────
async function handleCreateThread(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();

  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();

  const body = parseBody<{ participantId?: string; initialMessage?: string }>(event);
  if (!body?.participantId) return badRequest("Alıcı kullanıcı ID'si zorunludur.");

  const threadId = crypto.randomUUID();
  const now = new Date().toISOString();
  const participants = [userId, body.participantId].sort();

  const { DynamoDBClient, TransactWriteItemsCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const transactItems: any[] = [
    {
      Put: {
        TableName: getTableName(),
        Item: marshall({
          PK: `THREAD#${threadId}`,
          SK: "META",
          threadId,
          participants,
          createdBy: userId,
          createdAt: now,
          lastMessageAt: now,
        }),
        ConditionExpression: "attribute_not_exists(PK)",
      },
    },
    // GSI entries for each participant
    ...participants.map(p => ({
      Put: {
        TableName: getTableName(),
        Item: marshall({
          PK: `THREAD#${threadId}`,
          SK: `PARTICIPANT#${p}`,
          GSI1PK: `THREAD#${p}`,
          GSI1SK: now,
          threadId,
          otherParticipant: participants.find(x => x !== p),
        }),
      },
    })),
  ];

  // Add initial message if provided
  if (body.initialMessage) {
    transactItems.push({
      Put: {
        TableName: getTableName(),
        Item: marshall({
          PK: `CHAT#${threadId}`,
          SK: `MSG#${now}`,
          senderId: userId,
          content: body.initialMessage.slice(0, ChatService.MAX_MESSAGE_LENGTH),
          timestamp: now,
        }),
      },
    });
  }

  await ddb.send(new TransactWriteItemsCommand({ TransactItems: transactItems }));

  return created({ threadId });
}

// ─── Get Messages ─────────────────────────────────────────────────────────
async function handleGetMessages(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();

  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();

  const threadId = event.pathParameters?.id;
  if (!threadId) return badRequest("Thread ID gerekli.");

  if (!await threadParticipants(await getDdb(), getTableName(), threadId, userId)) return notFound();

  const { DynamoDBClient, QueryCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall, unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const limit = Math.min(Number(event.queryStringParameters?.limit) || ChatService.MAX_THREAD_LIST, ChatService.MAX_MESSAGE_HISTORY);
  const exclusiveStartKey = event.queryStringParameters?.cursor;

  const result = await ddb.send(new QueryCommand({
    TableName: getTableName(),
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: marshall({ ":pk": `CHAT#${threadId}`, ":sk": "MSG#" }),
    Limit: limit,
    ScanIndexForward: false, // newest first
    ExclusiveStartKey: exclusiveStartKey ? JSON.parse(Buffer.from(exclusiveStartKey, "base64").toString()) : undefined,
  }));

  const messages = (result.Items || []).map(i => unmarshall(i)).reverse();
  const nextCursor = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
    : null;

  return ok({ messages, nextCursor });
}

// ─── Send Message ─────────────────────────────────────────────────────────
async function handleSendMessage(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();

  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();

  const threadId = event.pathParameters?.id;
  if (!threadId) return badRequest("Thread ID gerekli.");

  if (!await threadParticipants(await getDdb(), getTableName(), threadId, userId)) return notFound();

  const body = parseBody<{ content?: string }>(event);
  if (typeof body?.content !== "string" || !body.content.trim()) return badRequest("Mesaj içeriği zorunludur.");

  const now = new Date().toISOString();

  const { DynamoDBClient, PutItemCommand, UpdateItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  // Put message
  await ddb.send(new PutItemCommand({
    TableName: getTableName(),
    Item: marshall({
      PK: `CHAT#${threadId}`,
      SK: `MSG#${now}`,
      senderId: userId,
      content: body.content.trim().slice(0, ChatService.MAX_MESSAGE_LENGTH),
      timestamp: now,
    }),
  }));

  // Update thread metadata
  await ddb.send(new UpdateItemCommand({
    TableName: getTableName(),
    Key: marshall({ PK: `THREAD#${threadId}`, SK: "META" }),
    UpdateExpression: "SET lastMessageAt = :now, lastMessage = :msg",
    ExpressionAttributeValues: marshall({ ":now": now, ":msg": body.content.trim().slice(0, 200) }),
  }));

  return created({ timestamp: now });
}
