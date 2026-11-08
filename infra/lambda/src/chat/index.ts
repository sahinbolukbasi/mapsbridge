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
import { getDynamoClient } from "../shared/dynamo";
import {
  ok,
  created,
  badRequest,
  unauthorized,
  notFound,
  serverError,
  handlePreflight as _handlePreflight,
  extractBearerToken,
  jsonResponse,
  parseBody,
} from "../shared/http";
import { requestGate, threadRequest } from "../shared/thread-access";
import type { TransactWriteItem } from "@aws-sdk/client-dynamodb";
import { Router } from "../shared/router";
import {
  threadParticipants,
  ChatService,
} from "../../../../services/messaging/src/application/chat-service";

const router = new Router();

router.add("GET /chat/threads", handleListThreads);
router.add("POST /chat/threads", handleCreateThread);
router.add("GET /chat/threads/{id}/messages", handleGetMessages);
router.add("POST /chat/threads/{id}/messages", handleSendMessage);
router.add("POST /chat/threads/{id}/request", handleRespondRequest);

/** Kayıtlı kullanıcı kimliği (Cognito sub) biçimi. */
const USER_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
/**
 * Profil kullanıcı adı biçimi. Web istemcisinin USERNAME_RE'si (navigation/profile-href.ts) ile
 * birebir aynı tutulur (backend web'i import edemez; chat.test.cjs eşitliği doğrular).
 */
const PROFILE_USERNAME_RE = /^[a-z0-9_.-]{1,40}$/;

/**
 * Yayınlanmış profil kullanıcı adının sahibi (auth lambda PROFILE#<ad>/PUBLIC.owner).
 * PROFILE# anahtarları auth publish yolunda küçük harfle yazılır; burada da küçük harfle okunur.
 * Yayınlanmamış/sahipsiz profil null döner (çağıran, var olmayan kullanıcıyla aynı 404'ü verir).
 */
async function profileOwner(username: string): Promise<string | null> {
  const { GetItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall, unmarshall } = await import("@aws-sdk/util-dynamodb");
  const r = await getDynamoClient().send(
    new GetItemCommand({
      TableName: getTableName(),
      Key: marshall({ PK: `PROFILE#${username.toLowerCase()}`, SK: "PUBLIC" }),
    }),
  );
  const row = r.Item ? unmarshall(r.Item) : null;
  return row?.published === true && typeof row.owner === "string" && row.owner ? row.owner : null;
}
/** Alıcı kayıtlı kullanıcı mı (USER#<id>/META ya da USER#<id>/CREDITS kaydı)? */
async function isRegisteredUser(id: string) {
  const { BatchGetItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const r = await getDynamoClient().send(
    new BatchGetItemCommand({
      RequestItems: {
        [getTableName()]: {
          Keys: [
            marshall({ PK: `USER#${id}`, SK: "META" }),
            marshall({ PK: `USER#${id}`, SK: "CREDITS" }),
          ],
          ProjectionExpression: "PK",
        },
      },
    }),
  );
  return (r.Responses?.[getTableName()] || []).length > 0;
}

export const handler = async (event: ApiGatewayEvent) => {
  try {
    if (event.requestContext.http.path === "/health" && event.requestContext.http.method === "GET")
      return ok({ status: "ok", service: "chat", timestamp: new Date().toISOString() });
    return await router.dispatch(event);
  } catch (err) {
    console.error(`[Chat] Error:`, err);
    return serverError();
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────
function getTableName(): string {
  return process.env.DYNAMODB_TABLE || `mapsbridge-${process.env.ENVIRONMENT}-data`;
}

// ─── List Threads (user's conversations) ──────────────────────────────────
async function handleListThreads(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();

  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();

  const { QueryCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall, unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = getDynamoClient();

  // Query GSI by participant
  const result = await ddb.send(
    new QueryCommand({
      TableName: getTableName(),
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: marshall({ ":pk": `THREAD#${userId}` }),
      ScanIndexForward: false,
      Limit: ChatService.MAX_THREAD_LIST,
    }),
  );

  const threads = (result.Items || []).map((i) => unmarshall(i));
  // M1/M2: her thread'e istek durumu (REQUEST kaydı; yoksa eski thread → accepted).
  const ids = [...new Set(threads.map((x) => String(x.threadId || "")).filter(Boolean))];
  const requests = new Map<string, Record<string, unknown>>();
  const unknown = new Set<string>();
  if (ids.length) {
    const { BatchGetItemCommand } = await import("@aws-sdk/client-dynamodb");
    const table = getTableName();
    let keys = ids.map((id) => marshall({ PK: `THREAD#${id}`, SK: "REQUEST" }));
    // review-final #4: UnprocessedKeys bir kez yeniden denenir; hâlâ okunamayan thread'in durumu
    // "unknown" döner (accepted varsayılmaz). Gönderim kapısı yine sunucuda (thread-access).
    for (let attempt = 0; attempt < 2 && keys.length; attempt++) {
      const got = await ddb.send(
        new BatchGetItemCommand({ RequestItems: { [table]: { Keys: keys } } }),
      );
      for (const item of got.Responses?.[table] || []) {
        const r = unmarshall(item);
        requests.set(String(r.PK).slice("THREAD#".length), r);
      }
      keys = got.UnprocessedKeys?.[table]?.Keys || [];
    }
    for (const key of keys) unknown.add(String(unmarshall(key).PK).slice("THREAD#".length));
  }
  return ok({
    threads: threads.map((x) => {
      const r = requests.get(String(x.threadId));
      return {
        ...x,
        request:
          r && typeof r.status === "string"
            ? { status: r.status, from: r.from, to: r.to }
            : unknown.has(String(x.threadId))
              ? { status: "unknown" }
              : { status: "accepted" },
      };
    }),
  });
}

// ─── Create Thread ────────────────────────────────────────────────────────
async function handleCreateThread(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();

  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();

  const body = parseBody<{ participantId?: string; initialMessage?: string }>(event);
  if (!body?.participantId) return badRequest("Alıcı kullanıcı ID'si zorunludur.");
  // Alıcı: kayıtlı kullanıcı kimliği ya da yayınlanmış profil kullanıcı adı (PROFILE#<ad>).
  const raw = body.participantId.trim();
  const username = raw.replace(/^@+/, "").toLowerCase();
  const recipient =
    USER_ID_RE.test(raw) && (await isRegisteredUser(raw))
      ? raw
      : PROFILE_USERNAME_RE.test(username)
        ? await profileOwner(username)
        : null;
  if (!recipient)
    return jsonResponse(404, { error: "Bu kullanıcı bulunamadı.", code: "USER_NOT_FOUND" });
  if (recipient === userId) return badRequest("Kendine mesaj isteği gönderemezsin.");
  body.participantId = recipient;

  const threadId = crypto.randomUUID();
  const now = new Date().toISOString();
  const participants = [userId, body.participantId].sort();

  const { TransactWriteItemsCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = getDynamoClient();

  const transactItems: TransactWriteItem[] = [
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
    // M1/M2: mesaj isteği (alıcı kabul edene kadar gönderen tek mesajla sınırlı).
    {
      Put: {
        TableName: getTableName(),
        Item: marshall({
          PK: `THREAD#${threadId}`,
          SK: "REQUEST",
          status: "pending",
          from: userId,
          to: body.participantId,
          createdAt: now,
        }),
        ConditionExpression: "attribute_not_exists(PK)",
      },
    },
    // GSI entries for each participant
    ...participants.map((p) => ({
      Put: {
        TableName: getTableName(),
        Item: marshall({
          PK: `THREAD#${threadId}`,
          SK: `PARTICIPANT#${p}`,
          GSI1PK: `THREAD#${p}`,
          GSI1SK: now,
          threadId,
          otherParticipant: participants.find((x) => x !== p),
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

  return created({ threadId, request: "pending" });
}

// ─── Get Messages ─────────────────────────────────────────────────────────
async function handleGetMessages(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();

  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();

  const threadId = event.pathParameters?.id;
  if (!threadId) return badRequest("Thread ID gerekli.");

  if (!(await threadParticipants(getDynamoClient(), getTableName(), threadId, userId)))
    return notFound();

  const { QueryCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall, unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = getDynamoClient();

  const limit = Math.min(
    Number(event.queryStringParameters?.limit) || ChatService.MAX_THREAD_LIST,
    ChatService.MAX_MESSAGE_HISTORY,
  );
  const rawCursor = event.queryStringParameters?.cursor;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsedCursor: any;
  if (rawCursor) {
    try {
      const cursor = JSON.parse(Buffer.from(rawCursor, "base64").toString());
      if (cursor.PK?.S !== `CHAT#${threadId}`) {
        return badRequest("Invalid cursor");
      }
      parsedCursor = cursor;
    } catch {
      return badRequest("Invalid cursor");
    }
  }

  const result = await ddb.send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: marshall({ ":pk": `CHAT#${threadId}`, ":sk": "MSG#" }),
      Limit: limit,
      ScanIndexForward: false, // newest first
      ExclusiveStartKey: parsedCursor,
    }),
  );

  const messages = (result.Items || []).map((i) => unmarshall(i)).reverse();
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

  if (!(await threadParticipants(getDynamoClient(), getTableName(), threadId, userId)))
    return notFound();

  const gate = requestGate(
    await threadRequest(getDynamoClient(), getTableName(), threadId),
    userId,
  );
  if (gate) return jsonResponse(gate.status, { error: gate.error, code: gate.code });

  const body = parseBody<{ content?: string }>(event);
  if (typeof body?.content !== "string" || !body.content.trim())
    return badRequest("Mesaj içeriği zorunludur.");

  const now = new Date().toISOString();

  const { PutItemCommand, UpdateItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = getDynamoClient();

  // Put message
  await ddb.send(
    new PutItemCommand({
      TableName: getTableName(),
      Item: marshall({
        PK: `CHAT#${threadId}`,
        SK: `MSG#${now}`,
        senderId: userId,
        content: body.content.trim().slice(0, ChatService.MAX_MESSAGE_LENGTH),
        timestamp: now,
      }),
    }),
  );

  // Update thread metadata
  await ddb.send(
    new UpdateItemCommand({
      TableName: getTableName(),
      Key: marshall({ PK: `THREAD#${threadId}`, SK: "META" }),
      UpdateExpression: "SET lastMessageAt = :now, lastMessage = :msg",
      ExpressionAttributeValues: marshall({
        ":now": now,
        ":msg": body.content.trim().slice(0, 200),
      }),
    }),
  );

  return created({ timestamp: now });
}

// ─── Respond Request (M1/M2) ──────────────────────────────────────────────
async function handleRespondRequest(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();
  const userId = await verifiedUserId(token);
  if (!userId) return unauthorized();
  const threadId = event.pathParameters?.id;
  if (!threadId) return badRequest("Thread ID gerekli.");
  const body = parseBody<{ action?: string }>(event);
  const next = ({ accept: "accepted", decline: "declined", block: "blocked" } as const)[
    body?.action as "accept" | "decline" | "block"
  ];
  if (!next) return badRequest("Geçersiz işlem.");
  const request = await threadRequest(getDynamoClient(), getTableName(), threadId);
  if (!request || request.to !== userId) return notFound();
  const { UpdateItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  try {
    await getDynamoClient().send(
      new UpdateItemCommand({
        TableName: getTableName(),
        Key: marshall({ PK: `THREAD#${threadId}`, SK: "REQUEST" }),
        UpdateExpression: "SET #s = :next, respondedAt = :now",
        ConditionExpression: "#s = :pending AND #to = :me",
        ExpressionAttributeNames: { "#s": "status", "#to": "to" },
        ExpressionAttributeValues: marshall({
          ":next": next,
          ":pending": "pending",
          ":me": userId,
          ":now": new Date().toISOString(),
        }),
      }),
    );
  } catch (e) {
    if ((e as { name?: string }).name === "ConditionalCheckFailedException")
      return jsonResponse(409, { error: "İstek zaten yanıtlanmış." });
    throw e;
  }
  return ok({ threadId, request: next });
}
