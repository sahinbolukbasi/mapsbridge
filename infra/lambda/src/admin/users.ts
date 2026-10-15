import type { ApiGatewayEvent } from "../shared/http";
import { ok, badRequest, notFound, serverError, parseBody } from "../shared/http";
import { stripeClient } from "../billing/stripe-client";
import { read } from "../shared/data";
import { grantCredits } from "../billing/store";
import { protectAccount, recordAuditLog, getTableName, scanAllRaw } from "./management";

export async function paymentRecords() {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });
  const result = await scanAllRaw(ddb, {
    TableName: getTableName(),
    FilterExpression:
      "(begins_with(PK, :payment) AND SK = :meta) OR (begins_with(PK, :billing) AND SK = :receipt) OR begins_with(PK, :refund)",
    ExpressionAttributeValues: {
      ":payment": { S: "PAYMENT#" },
      ":meta": { S: "META" },
      ":billing": { S: "BILLING#" },
      ":receipt": { S: "RECEIPT" },
      ":refund": { S: "REFUND#" },
    },
  });
  const records = result.Items.map((item: any) => unmarshall(item));
  const refunded = new Set(
    records
      .filter((r: any) => r.PK?.startsWith("REFUND#") && r.status === "succeeded")
      .map((r: any) => r.paymentIntentId),
  );
  const payments = new Map<string, any>();
  for (const row of records) {
    if (row.PK?.startsWith("REFUND#") || (row.currency && row.currency.toLowerCase() !== "try"))
      continue;
    const id = row.paymentIntentId || row.id || row.PK;
    payments.set(id, {
      ...row,
      id,
      status: refunded.has(row.paymentIntentId)
        ? "refunded"
        : row.status || (row.SK === "RECEIPT" ? "succeeded" : "pending"),
    });
  }
  return [...payments.values()].sort((a, b) =>
    (b.createdAt || "").localeCompare(a.createdAt || ""),
  );
}

export async function handleListUsers(event: ApiGatewayEvent) {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const limit = Math.min(Number(event.queryStringParameters?.limit) || 50, 200);

  const result = await scanAllRaw(ddb, {
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk)",
    ExpressionAttributeValues: { ":pk": { S: "USER#" } },
    Limit: limit,
  });

  const grouped = new Map<string, any>();
  for (const item of result.Items) {
    const row = unmarshall(item);
    const userId = row.PK?.replace(/^USER#/, "");
    if (!userId) continue;
    const user = grouped.get(userId) || { userId, routesCount: 0 };
    if (row.SK === "META" || row.SK === "PROFILE") {
      for (const field of ["email", "name", "role", "suspended", "suspendReason", "createdAt"]) {
        if (row[field] !== undefined) user[field] = row[field];
      }
    }
    if (row.SK === "SUBSCRIPTION") user.tier = row.tier;
    if (row.SK?.startsWith("ROUTE#")) user.routesCount++;
    grouped.set(userId, user);
  }
  if (process.env.COGNITO_USER_MANAGEMENT === "true") {
    const { CognitoIdentityProviderClient, ListUsersCommand } =
      await import("@aws-sdk/client-cognito-identity-provider");
    const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
    let token: string | undefined;
    do {
      const page = await cognito.send(
        new ListUsersCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID,
          PaginationToken: token,
          Limit: 60,
        }),
      );
      for (const account of page.Users || []) {
        const attributes = Object.fromEntries(
          (account.Attributes || []).map((a) => [a.Name, a.Value]),
        );
        const id = attributes.sub;
        if (!id) continue;
        grouped.set(id, {
          ...grouped.get(id),
          userId: id,
          username: account.Username,
          email: attributes.email,
          name: attributes.name,
          suspended: account.Enabled === false || grouped.get(id)?.suspended === true,
          createdAt: account.UserCreateDate?.toISOString(),
        });
      }
      token = page.PaginationToken;
    } while (token);
  }
  const users = [...grouped.values()];
  return ok({ users, count: users.length, nextCursor: null });
}

export async function handleSuspendUser(event: ApiGatewayEvent) {
  const userId = event.pathParameters?.id;
  if (!userId) return badRequest("Kullanıcı ID gerekli.");

  if (userId === (event as any).verifiedUser?.sub)
    return badRequest("Kendi hesabınızın durumunu değiştiremezsiniz.");
  await protectAccount(event, userId);
  const body = parseBody<{ reason?: string }>(event);
  const reason = body?.reason?.trim() || "Yönetici tarafından askıya alındı.";

  const { DynamoDBClient, UpdateItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const now = new Date().toISOString();
  await ddb.send(
    new UpdateItemCommand({
      TableName: getTableName(),
      Key: marshall({ PK: `USER#${userId}`, SK: "META" }),
      UpdateExpression: "SET suspended = :true, suspendedAt = :now, suspendReason = :reason",
      ExpressionAttributeValues: marshall({ ":true": true, ":now": now, ":reason": reason }),
    }),
  );

  if (process.env.COGNITO_USER_MANAGEMENT === "true") {
    const { CognitoIdentityProviderClient, AdminDisableUserCommand } =
      await import("@aws-sdk/client-cognito-identity-provider");
    await new CognitoIdentityProviderClient({ region: process.env.AWS_REGION }).send(
      new AdminDisableUserCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: userId,
      }),
    );
  }

  const actorSub = (event as any).verifiedUser?.sub || "admin";
  await recordAuditLog(actorSub, "user_suspended", userId, reason);

  return ok({ status: "suspended", userId, reason, suspendedAt: now });
}

export async function handleUnsuspendUser(event: ApiGatewayEvent) {
  const userId = event.pathParameters?.id;
  if (!userId) return badRequest("Kullanıcı ID gerekli.");

  if (userId === (event as any).verifiedUser?.sub)
    return badRequest("Kendi hesabınızın durumunu değiştiremezsiniz.");
  const body = parseBody<{ reason?: string }>(event);
  const reason = body?.reason?.trim() || "Yönetici tarafından askı kaldırıldı.";

  const { DynamoDBClient, UpdateItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const now = new Date().toISOString();
  await ddb.send(
    new UpdateItemCommand({
      TableName: getTableName(),
      Key: marshall({ PK: `USER#${userId}`, SK: "META" }),
      UpdateExpression: "SET suspended = :false, unsuspendedAt = :now REMOVE suspendReason",
      ExpressionAttributeValues: marshall({ ":false": false, ":now": now }),
    }),
  );

  if (process.env.COGNITO_USER_MANAGEMENT === "true") {
    const { CognitoIdentityProviderClient, AdminEnableUserCommand } =
      await import("@aws-sdk/client-cognito-identity-provider");
    await new CognitoIdentityProviderClient({ region: process.env.AWS_REGION }).send(
      new AdminEnableUserCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: userId,
      }),
    );
  }

  const actorSub = (event as any).verifiedUser?.sub || "admin";
  await recordAuditLog(actorSub, "user_unsuspended", userId, reason);

  return ok({ status: "active", userId, unsuspendedAt: now });
}

export async function handleRefund(event: ApiGatewayEvent) {
  const userId = event.pathParameters?.id;
  if (!userId) return badRequest("Kullanıcı ID gerekli.");

  const body = parseBody<{ paymentIntentId?: string; reason?: string }>(event);
  if (!body?.paymentIntentId) return badRequest("Ödeme ID gerekli.");
  const reason = body?.reason?.trim() || "Yönetici tarafından iade edildi.";

  try {
    const stripe = await stripeClient();
    const customer = await read(`USER#${userId}`, "STRIPE_CUSTOMER");
    const payment = await stripe.paymentIntents.retrieve(body.paymentIntentId);
    const customerId =
      typeof payment.customer === "string" ? payment.customer : payment.customer?.id;
    if (!customer?.customerId || customerId !== customer.customerId)
      return badRequest("Ödeme bu kullanıcıya ait değil.");
    const refund = await stripe.refunds.create(
      {
        payment_intent: body.paymentIntentId,
        metadata: { refundedBy: "admin", userId, reason },
      },
      { idempotencyKey: `full-refund:${body.paymentIntentId}` },
    );

    const { DynamoDBClient, PutItemCommand } = await import("@aws-sdk/client-dynamodb");
    const { marshall } = await import("@aws-sdk/util-dynamodb");
    const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

    await ddb.send(
      new PutItemCommand({
        TableName: getTableName(),
        Item: marshall({
          PK: `REFUND#${refund.id}`,
          SK: "META",
          paymentIntentId: body.paymentIntentId,
          userId,
          amount: refund.amount,
          status: refund.status,
          reason,
          createdAt: new Date().toISOString(),
        }),
      }),
    );

    const actorSub = (event as any).verifiedUser?.sub || "admin";
    await recordAuditLog(actorSub, "payment_refunded", body.paymentIntentId, reason, {
      userId,
      amount: refund.amount,
    });

    return ok({
      status: refund.status === "succeeded" ? "refunded" : refund.status,
      refundId: refund.id,
      amount: refund.amount,
      reason,
    });
  } catch (err: any) {
    return serverError("İade durumu doğrulanamadı. İşlem kimliğiyle tekrar kontrol edin.");
  }
}

export async function handlePayments(event: ApiGatewayEvent) {
  const records = await paymentRecords();
  const status = event.queryStringParameters?.status;
  const payments = status ? records.filter((p) => p.status === status) : records;
  return ok({ payments, count: payments.length });
}

export async function handleGrantCredits(event: ApiGatewayEvent) {
  const userId = event.pathParameters?.id;
  if (!userId) return badRequest("Kullanıcı ID gerekli.");

  const body = parseBody<{ credits?: number; reason?: string }>(event);
  const credits = body?.credits;
  if (!credits || !Number.isInteger(credits) || credits <= 0 || credits > 10000)
    return badRequest("1–10000 arasında kredi miktarı gerekli.");

  const user = await read(`USER#${userId}`, "PROFILE");
  if (!user) return notFound("Kullanıcı bulunamadı.");

  const reason = body?.reason?.trim() || "Admin kredisi";
  const receiptId = `admin-${Date.now()}-${userId.slice(-6)}`;

  try {
    await grantCredits(userId, receiptId, credits, {
      grantedBy: (event as any).verifiedUser?.sub || "admin",
      reason,
    });
  } catch (err: any) {
    return serverError("Kredi verilemedi: " + err.message);
  }

  const actorSub = (event as any).verifiedUser?.sub || "admin";
  await recordAuditLog(actorSub, "credits_granted", userId, reason, { credits });

  return ok({ status: "granted", userId, credits, reason });
}
