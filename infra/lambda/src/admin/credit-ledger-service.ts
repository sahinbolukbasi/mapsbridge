import type { ApiGatewayEvent } from "../shared/http";
import { ok, badRequest, parseBody, notFound } from "../shared/http";
import { getDynamoClient } from "../shared/dynamo";
import { getTableName, scanAllRaw, recordAuditLog } from "./management";
import type { AuthorizedEvent } from "../shared/types";

export interface CreditTransactionItem {
  PK: string;
  SK: string;
  txId: string;
  userId: string;
  amount: number; // positive = credit added, negative = credit deducted
  type: "grant" | "deduct" | "purchase" | "refund" | "promo" | "route_consumption";
  balanceAfter: number;
  reason: string;
  adminActor?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export async function handleListCreditTransactions(event: ApiGatewayEvent) {
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = getDynamoClient();

  const limit = Math.min(Number(event.queryStringParameters?.limit) || 50, 100);
  const userIdFilter = event.queryStringParameters?.userId;

  const result = await scanAllRaw(ddb, {
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk) AND SK = :sk",
    ExpressionAttributeValues: {
      ":pk": { S: "CREDIT#TX#" },
      ":sk": { S: "META" },
    },
    Limit: limit,
  });

  let transactions = (result.Items || []).map((i) => unmarshall(i) as CreditTransactionItem);
  if (userIdFilter) {
    transactions = transactions.filter((t) => t.userId === userIdFilter);
  }

  transactions.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return ok({ transactions, count: transactions.length });
}

export async function handleAdjustUserCredits(event: ApiGatewayEvent) {
  const { GetItemCommand, TransactWriteItemsCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall, unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = getDynamoClient();

  const body = parseBody<{
    userId?: string;
    amount?: number; // e.g. 50 or -20
    reason?: string;
  }>(event);

  if (!body?.userId || typeof body.amount !== "number" || body.amount === 0) {
    return badRequest("Geçerli kullanıcı ID ve sıfırdan farklı miktar gereklidir.");
  }
  const reason = body.reason?.trim() || "Yönetici bakiye düzenlemesi";
  const actorSub = (event as AuthorizedEvent).verifiedUser?.sub || "admin";

  const walletRes = await ddb.send(
    new GetItemCommand({
      TableName: getTableName(),
      Key: marshall({ PK: `USER#${body.userId}`, SK: "CREDITS" }),
    }),
  );

  const currentCredits = walletRes.Item ? Number(unmarshall(walletRes.Item).credits || 0) : 0;
  const newBalance = currentCredits + body.amount;

  if (newBalance < 0) {
    return badRequest("Kullanıcı kredisi sıfırın altına düşürülemez.");
  }

  const txId = `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const txItem: CreditTransactionItem = {
    PK: `CREDIT#TX#${txId}`,
    SK: "META",
    txId,
    userId: body.userId,
    amount: body.amount,
    type: body.amount > 0 ? "grant" : "deduct",
    balanceAfter: newBalance,
    reason,
    adminActor: actorSub,
    createdAt: now,
  };

  await ddb.send(
    new TransactWriteItemsCommand({
      TransactItems: [
        {
          Put: {
            TableName: getTableName(),
            Item: marshall(txItem, { removeUndefinedValues: true }),
          },
        },
        {
          Update: {
            TableName: getTableName(),
            Key: marshall({ PK: `USER#${body.userId}`, SK: "CREDITS" }),
            UpdateExpression: "SET credits = :newCredits, updatedAt = :now",
            ExpressionAttributeValues: marshall({
              ":newCredits": newBalance,
              ":now": now,
            }),
          },
        },
      ],
    }),
  );

  await recordAuditLog(
    actorSub,
    body.amount > 0 ? "credits_granted" : "credits_deducted",
    body.userId,
    reason,
    { amount: body.amount, balanceAfter: newBalance, txId },
  );

  return ok({
    status: "adjusted",
    userId: body.userId,
    previousBalance: currentCredits,
    newBalance,
    txId,
  });
}

