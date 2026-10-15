import type { TrainingJob } from "../../../../apps/web/server/ai/training-outbox";
import type { MemorySettings, MemoryJob } from "../../../../apps/web/server/ai/memory-service";
import {
  DynamoDBClient,
  GetItemCommand,
  TransactWriteItemsCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

export class BillingError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const table = () => {
  if (!process.env.DYNAMODB_TABLE)
    throw new BillingError(503, "BILLING_UNAVAILABLE", "Kredi servisi yapılandırılmadı.");
  return process.env.DYNAMODB_TABLE;
};
export const db = () => new DynamoDBClient({ region: process.env.AWS_REGION });
export async function read(PK: string, SK: string) {
  const result = await db().send(
    new GetItemCommand({ TableName: table(), Key: marshall({ PK, SK }), ConsistentRead: true }),
  );
  return result.Item ? unmarshall(result.Item) : null;
}
export async function subscription(userId: string) {
  const sub = await read(`USER#${userId}`, "SUBSCRIPTION");
  if (
    !sub ||
    sub.status !== "active" ||
    Date.parse(sub.currentPeriodEnd) <= Date.now() ||
    !Number.isFinite(Date.parse(sub.currentPeriodEnd)) ||
    !["explorer", "pro", "agency"].includes(sub.tier)
  )
    return { tier: "free", status: "active" };
  return sub;
}
export async function wallet(userId: string) {
  const value = await read(`USER#${userId}`, "CREDITS");
  return {
    credits: Number.isSafeInteger(value?.credits) && value!.credits >= 0 ? value!.credits : 0,
    welcomeGift: value?.welcomeGift || null,
    frozen: value?.frozen === true,
    ...(await subscription(userId)),
  };
}
// Free credits are granted only by the verified-email AI entry point, once per subject.
export async function initializeTrial(userId: string) {
  try {
    await db().send(
      new PutItemCommand({
        TableName: table(),
        Item: marshall({
          PK: `USER#${userId}`,
          SK: "CREDITS",
          credits: 5,
          welcomeGift: { credits: 5, grantedAt: new Date().toISOString() },
        }),
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );
  } catch (err: any) {
    if (err.name !== "ConditionalCheckFailedException") throw err;
  }
}
/** Permanent business receipt + balance mutation commit together; retries never grant twice. */
export async function grantCredits(
  userId: string,
  receipt: string,
  credits: number,
  details: Record<string, unknown>,
) {
  if (!Number.isSafeInteger(credits) || credits <= 0 || credits > 100000 || !userId)
    throw new Error("Invalid grant");
  const PK = `BILLING#${receipt}`;
  try {
    await db().send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Put: {
              TableName: table(),
              Item: marshall({ PK, SK: "RECEIPT", userId, credits, ...details }),
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            Update: {
              TableName: table(),
              Key: marshall({ PK: `USER#${userId}`, SK: "CREDITS" }),
              UpdateExpression: "ADD credits :credits",
              ExpressionAttributeValues: marshall({ ":credits": credits }),
            },
          },
        ],
      }),
    );
  } catch (err) {
    const existing = await read(PK, "RECEIPT");
    if (existing?.userId === userId && existing.credits === credits) return;
    throw err;
  }
}
export async function reserveAI(
  userId: string,
  requestId: string,
  fingerprint: string,
  reservationCost = 5,
) {
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(requestId))
    throw new BillingError(400, "REQUEST_ID_REQUIRED", "Geçerli işlem kimliği gerekli.");
  const day = new Date().toISOString().slice(0, 10);
  const cost = reservationCost; // Server-owned reservation policy; never taken from request body.
  if (![0, 5].includes(cost)) throw new BillingError(500, "INVALID_COST", "Geçersiz kredi işlemi.");
  const cap = Number(process.env.AI_DAILY_REQUEST_LIMIT || 200);
  if (!Number.isSafeInteger(cap) || cap < 1)
    throw new BillingError(503, "AI_DISABLED", "AI geçici olarak kapalı.");
  const PK = `USER#${userId}`,
    SK = `AI#${requestId}`;
  try {
    await db().send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Put: {
              TableName: table(),
              Item: marshall({
                PK,
                SK,
                fingerprint,
                cost,
                state: "reserved",
                createdAt: new Date().toISOString(),
              }),
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            Update: {
              TableName: table(),
              Key: marshall({ PK, SK: "CREDITS" }),
              UpdateExpression: "ADD credits :minus",
              ConditionExpression:
                "credits >= :cost AND (attribute_not_exists(frozen) OR frozen = :no)",
              ExpressionAttributeValues: marshall({ ":minus": -cost, ":cost": cost, ":no": false }),
            },
          },
          ...[
            { PK, SK: `AI_DAY#${day}`, limit: 20 },
            { PK: "SYSTEM#AI", SK: day, limit: cap },
          ].map((key) => ({
            Update: {
              TableName: table(),
              Key: marshall({ PK: key.PK, SK: key.SK }),
              UpdateExpression: "ADD requests :one",
              ConditionExpression: "attribute_not_exists(requests) OR requests < :limit",
              ExpressionAttributeValues: marshall({ ":one": 1, ":limit": key.limit }),
            },
          })),
        ],
      }),
    );
  } catch (err: any) {
    if (await read(PK, SK))
      throw new BillingError(
        409,
        "REQUEST_ALREADY_USED",
        "Bu işlem daha önce alındı; yeniden ücretlendirilmedi.",
      );
    if (
      err.name === "TransactionCanceledException" &&
      err.CancellationReasons?.some((r: any) => r.Code === "ConditionalCheckFailed")
    ) {
      const current = await wallet(userId);
      if (current.frozen)
        throw new BillingError(403, "WALLET_FROZEN", "Kredi hesabı geçici olarak durduruldu.");
      if (current.credits < cost)
        throw new BillingError(
          402,
          "INSUFFICIENT_CREDITS",
          `Bu işlem için ${cost} kredi gerekiyor. Kalan: ${current.credits}.`,
        );
      const daily = await read(PK, `AI_DAY#${day}`);
      if ((daily?.requests || 0) >= 20)
        throw new BillingError(
          429,
          "USER_DAILY_LIMIT",
          "Günlük 20 mesaj deneme sınırına ulaştın. Sayaç Türkiye saatiyle 03:00’te yenilenir.",
        );
      throw new BillingError(
        429,
        "SERVICE_DAILY_LIMIT",
        "Asistanın günlük servis kapasitesi doldu. Sayaç Türkiye saatiyle 03:00’te yenilenir.",
      );
    }
    throw err;
  }
  return { userId, requestId, cost };
}
/** Debit before paid research/generation. The receipt makes retries and refunds atomic. */
export async function authorizeAI(
  reservation: { userId: string; requestId: string; cost: number },
  cost: 1 | 5,
) {
  const PK = `USER#${reservation.userId}`,
    SK = `AI#${reservation.requestId}`;
  if (![1, 5].includes(cost)) throw new BillingError(500, "INVALID_COST", "Geçersiz kredi işlemi.");
  try {
    await db().send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Update: {
              TableName: table(),
              Key: marshall({ PK, SK }),
              UpdateExpression: "SET cost = :cost",
              ConditionExpression: "#state = :reserved AND cost = :zero",
              ExpressionAttributeNames: { "#state": "state" },
              ExpressionAttributeValues: marshall({
                ":cost": cost,
                ":reserved": "reserved",
                ":zero": 0,
              }),
            },
          },
          {
            Update: {
              TableName: table(),
              Key: marshall({ PK, SK: "CREDITS" }),
              UpdateExpression: "ADD credits :minus",
              ConditionExpression:
                "credits >= :cost AND (attribute_not_exists(frozen) OR frozen = :no)",
              ExpressionAttributeValues: marshall({ ":minus": -cost, ":cost": cost, ":no": false }),
            },
          },
        ],
      }),
    );
  } catch (error) {
    const receipt = await read(PK, SK);
    if (receipt?.state === "reserved" && receipt.cost === cost) {
      reservation.cost = cost;
      return;
    }
    const current = await wallet(reservation.userId);
    if (current.frozen)
      throw new BillingError(403, "WALLET_FROZEN", "Kredi hesabı geçici olarak durduruldu.");
    if (current.credits < cost) {
      if (cost === 5 && current.credits > 0) {
        const flexCost = current.credits;
        try {
          await db().send(
            new TransactWriteItemsCommand({
              TransactItems: [
                {
                  Update: {
                    TableName: table(),
                    Key: marshall({ PK, SK }),
                    UpdateExpression: "SET cost = :cost",
                    ConditionExpression: "#state = :reserved AND cost = :zero",
                    ExpressionAttributeNames: { "#state": "state" },
                    ExpressionAttributeValues: marshall({
                      ":cost": flexCost,
                      ":reserved": "reserved",
                      ":zero": 0,
                    }),
                  },
                },
                {
                  Update: {
                    TableName: table(),
                    Key: marshall({ PK, SK: "CREDITS" }),
                    UpdateExpression: "ADD credits :minus",
                    ConditionExpression:
                      "credits >= :cost AND (attribute_not_exists(frozen) OR frozen = :no)",
                    ExpressionAttributeValues: marshall({
                      ":minus": -flexCost,
                      ":cost": flexCost,
                      ":no": false,
                    }),
                  },
                },
              ],
            }),
          );
          reservation.cost = flexCost;
          return;
        } catch {
          const flexReceipt = await read(PK, SK);
          if (flexReceipt?.state === "reserved" && flexReceipt.cost === flexCost) {
            reservation.cost = flexCost;
            return;
          }
        }
      }
      throw new BillingError(
        402,
        "INSUFFICIENT_CREDITS",
        `Bu işlem için ${cost} kredi gerekiyor. Kalan: ${current.credits}. Kredi paketi alarak devam edebilirsin.`,
      );
    }
    throw error;
  }
  reservation.cost = cost;
}
export async function finishAI(
  reservation: { userId: string; requestId: string; cost: number },
  success: boolean,
  completion?: {
    response: Record<string, unknown>;
    preferences?: Record<string, unknown>;
    finalCost?: number;
    trainingJob?: TrainingJob;
    memory?: { settings: MemorySettings; job?: MemoryJob };
    conversation?: { id: string; expectedVersion: number; value: Record<string, unknown> };
  },
) {
  const { userId, requestId } = reservation;
  const receipt = await read(`USER#${userId}`, `AI#${requestId}`);
  if (!receipt) throw new BillingError(409, "RESERVATION_MISSING", "Kredi işlemi bulunamadı.");
  const cost = receipt.cost;
  const finalCost = success ? (completion?.finalCost ?? cost) : 0;
  if (finalCost > cost)
    throw new BillingError(
      402,
      "INSUFFICIENT_CREDITS",
      "Ücretli üretim öncesinde kredi ayrılmadı.",
    );
  if (!Number.isSafeInteger(finalCost) || finalCost < 0 || finalCost > 5)
    throw new BillingError(500, "INVALID_COST", "Geçersiz kredi işlemi.");
  const PK = `USER#${userId}`,
    SK = `AI#${requestId}`;
  const items: any[] = [
    {
      Update: {
        TableName: table(),
        Key: marshall({ PK, SK }),
        UpdateExpression:
          completion && success
            ? "SET #state = :next, #response = :response, chargedCost = :chargedCost"
            : "SET #state = :next",
        ConditionExpression: "#state = :reserved",
        ExpressionAttributeNames: {
          "#state": "state",
          ...(completion && success ? { "#response": "response" } : {}),
        },
        ExpressionAttributeValues: marshall({
          ":next": success ? "succeeded" : "failed",
          ":reserved": "reserved",
          ...(completion && success
            ? { ":response": completion.response, ":chargedCost": finalCost }
            : {}),
        }),
      },
    },
  ];
  if (success && completion?.trainingJob) {
    items.push({
      Put: {
        TableName: table(),
        Item: marshall(completion.trainingJob),
        ConditionExpression: "attribute_not_exists(PK)",
      },
    });
  }
  if (success && completion?.memory && process.env.AI_MEMORY_TABLE) {
    const settings = completion.memory.settings;
    items.push({
      ConditionCheck: {
        TableName: process.env.AI_MEMORY_TABLE,
        Key: marshall({ PK, SK: "SETTINGS" }),
        ConditionExpression:
          settings.version === 0 ? "attribute_not_exists(PK)" : "#version = :version",
        ...(settings.version === 0
          ? {}
          : {
              ExpressionAttributeNames: { "#version": "version" },
              ExpressionAttributeValues: marshall({ ":version": settings.version }),
            }),
      },
    });
    if (completion.memory.job)
      items.push({
        Put: {
          TableName: process.env.AI_MEMORY_TABLE,
          Item: marshall(completion.memory.job),
          ConditionExpression: "attribute_not_exists(PK)",
        },
      });
  }
  if (success && completion?.preferences && Object.keys(completion.preferences).length) {
    const entries = Object.entries(completion.preferences);
    items.push({
      Update: {
        TableName: table(),
        Key: marshall({ PK, SK: "AI_PREFERENCES" }),
        UpdateExpression: "SET " + entries.map((_, i) => `#p${i} = :p${i}`).join(", "),
        ExpressionAttributeNames: Object.fromEntries(entries.map(([key], i) => [`#p${i}`, key])),
        ExpressionAttributeValues: marshall(
          Object.fromEntries(entries.map(([, value], i) => [`:p${i}`, value])),
        ),
      },
    });
  }
  if (success && completion?.conversation) {
    const c = completion.conversation;
    items.push({
      Put: {
        TableName: table(),
        Item: marshall({ PK, SK: `AI_CHAT#${c.id}`, ...c.value }),
        ConditionExpression:
          c.expectedVersion === 0 ? "attribute_not_exists(PK)" : "#version = :version",
        ...(c.expectedVersion === 0
          ? {}
          : {
              ExpressionAttributeNames: { "#version": "version" },
              ExpressionAttributeValues: marshall({ ":version": c.expectedVersion }),
            }),
      },
    });
    items.push({
      Put: {
        TableName: table(),
        Item: marshall({
          PK,
          SK: "AI_LATEST",
          conversationId: c.id,
          updatedAt: new Date().toISOString(),
          expiresAt: Math.floor(Date.now() / 1000) + 30 * 86400,
        }),
      },
    });
  }
  if (success && finalCost !== cost) {
    const delta = finalCost - cost;
    items.push({
      Update: {
        TableName: table(),
        Key: marshall({ PK, SK: "CREDITS" }),
        UpdateExpression: "ADD credits :change",
        ...(delta > 0
          ? {
              ConditionExpression:
                "credits >= :required AND (attribute_not_exists(frozen) OR frozen = :no)",
            }
          : {}),
        ExpressionAttributeValues: marshall({
          ":change": -delta,
          ...(delta > 0 ? { ":required": delta, ":no": false } : {}),
        }),
      },
    });
  }
  if (!success)
    items.push({
      Update: {
        TableName: table(),
        Key: marshall({ PK, SK: "CREDITS" }),
        UpdateExpression: "ADD credits :cost",
        ExpressionAttributeValues: marshall({ ":cost": cost }),
      },
    });
  try {
    await db().send(new TransactWriteItemsCommand({ TransactItems: items }));
  } catch (err) {
    const existing = await read(PK, SK);
    if (existing?.state === (success ? "succeeded" : "failed")) return;
    if (success && completion?.conversation) {
      const current = await read(PK, `AI_CHAT#${completion.conversation.id}`);
      if ((current?.version || 0) !== completion.conversation.expectedVersion)
        throw new BillingError(
          409,
          "CONVERSATION_CHANGED",
          "Bu sohbet başka bir istekte güncellendi. Son mesajları yükleyip tekrar dene.",
        );
    }
    if (success && finalCost > cost) {
      const current = await wallet(userId);
      if (current.credits < finalCost - cost)
        throw new BillingError(
          402,
          "INSUFFICIENT_CREDITS",
          `Bu yanıt için ${finalCost} kredi gerekiyor. Kalan: ${current.credits}. Ücret alınmadı.`,
        );
    }
    throw err;
  }
  // Daily attempt counters are deliberately never refunded; outages must not enable unlimited model calls.
}

export async function forgetAIPreferences(userId: string) {
  await db().send(
    new PutItemCommand({
      TableName: table(),
      Item: marshall({ PK: `USER#${userId}`, SK: "AI_PREFERENCES" }),
    }),
  );
}

export async function aiUsage(userId: string) {
  const day = new Date().toISOString().slice(0, 10);
  const daily = await read(`USER#${userId}`, `AI_DAY#${day}`);
  return {
    dailyLimit: 20,
    requestsToday: daily?.requests || 0,
    resetsAt: new Date(Date.parse(day) + 86400000).toISOString(),
    costs: { clarify: 0, chat: 1, route: 5 },
  };
}
