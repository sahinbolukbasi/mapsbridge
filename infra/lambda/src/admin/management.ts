import { stripeClient } from "../billing/stripe-client";
import {
  GetItemCommand,
  ScanCommand,
  QueryCommand,
  TransactWriteItemsCommand,
  PutItemCommand,
  type AttributeValue,
} from "@aws-sdk/client-dynamodb";
import { getDynamoClient } from "../shared/dynamo";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminUpdateUserAttributesCommand,
  AdminUserGlobalSignOutCommand,
  AdminDeleteUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { ok, created, jsonResponse, parseBody, type ApiGatewayEvent } from "../shared/http";
import type { AuthorizedEvent } from "../shared/types";
import { permissions, type StaffRole } from "./permissions";

export type Row = Record<string, any>;
export class AdminError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const table = () => process.env.DYNAMODB_TABLE!;
const cognito = () => new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const pool = () => process.env.COGNITO_USER_POOL_ID!;
const actor = (event: ApiGatewayEvent) => (event as AuthorizedEvent).verifiedUser.sub as string;
export function text(value: unknown, label: string, max = 1000, required = true): string {
  if (typeof value !== "string" || (required && !value.trim()) || value.length > max)
    throw new AdminError(400, `${label} geçersiz (en fazla ${max} karakter).`);
  return value.trim();
}
export function bodyOf(event: ApiGatewayEvent): Row {
  const body = parseBody<Row>(event);
  if (!body || Array.isArray(body) || typeof body !== "object")
    throw new AdminError(400, "Geçerli işlem verisi gerekli.");
  return body;
}
export async function get(PK: string, SK = "META"): Promise<Row | null> {
  const result = await getDynamoClient().send(
    new GetItemCommand({ TableName: table(), Key: marshall({ PK, SK }), ConsistentRead: true }),
  );
  return result.Item ? unmarshall(result.Item) : null;
}
export async function scan(
  filter: string,
  values: Row,
  names?: Record<string, string>,
): Promise<Row[]> {
  const rows: Row[] = [];
  let cursor: Record<string, AttributeValue> | undefined;
  do {
    const result = await getDynamoClient().send(
      new ScanCommand({
        TableName: table(),
        FilterExpression: filter,
        ExpressionAttributeValues: marshall(values),
        ExpressionAttributeNames: names,
        ExclusiveStartKey: cursor,
      }),
    );
    rows.push(...(result.Items || []).map((item) => unmarshall(item)));
    cursor = result.LastEvaluatedKey;
  } while (cursor);
  return rows;
}
export async function userRows(id: string): Promise<Row[]> {
  const rows: Row[] = [];
  let cursor: Record<string, AttributeValue> | undefined;
  do {
    const result = await getDynamoClient().send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: marshall({ ":pk": `USER#${id}` }),
        ExclusiveStartKey: cursor,
      }),
    );
    rows.push(...(result.Items || []).map((item) => unmarshall(item)));
    cursor = result.LastEvaluatedKey;
  } while (cursor);
  return rows;
}
function audit(
  event: ApiGatewayEvent,
  action: string,
  targetId: string,
  reason: string,
  details: Row = {},
) {
  const auditId = crypto.randomUUID();
  return {
    PK: `AUDIT#${auditId}`,
    SK: "META",
    auditId,
    actorSub: actor(event),
    action,
    targetId,
    reason,
    details,
    createdAt: new Date().toISOString(),
  };
}
export async function commit(
  event: ApiGatewayEvent,
  item: Row,
  action: string,
  reason: string,
  existing?: Row | null,
  patchOnly = false,
) {
  const condition = existing
    ? existing.version === undefined
      ? "attribute_exists(PK) AND attribute_not_exists(#version)"
      : "#version = :previous"
    : "attribute_not_exists(PK)";
  const next = {
    ...item,
    version: (existing?.version || 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  const names: Record<string, string> = { "#version": "version" };
  const values: Row = { ":version": next.version, ":updated": next.updatedAt };
  const assignments = ["#version = :version", "#updated = :updated"];
  const checks = [condition];
  names["#updated"] = "updatedAt";
  if (existing?.version !== undefined) values[":previous"] = existing.version;
  if (patchOnly && existing) {
    for (const [key, value] of Object.entries(item)) {
      if (
        ["PK", "SK", "version", "updatedAt"].includes(key) ||
        JSON.stringify(value) === JSON.stringify(existing[key])
      )
        continue;
      const n = `#field${assignments.length}`,
        v = `:value${assignments.length}`,
        old = `:old${assignments.length}`;
      names[n] = key;
      values[v] = value;
      assignments.push(`${n} = ${v}`);
      if (existing[key] === undefined) checks.push(`attribute_not_exists(${n})`);
      else {
        values[old] = existing[key];
        checks.push(`${n} = ${old}`);
      }
    }
  }
  const patch =
    patchOnly && existing
      ? {
          Update: {
            TableName: table(),
            Key: marshall({ PK: item.PK, SK: item.SK }),
            UpdateExpression: `SET ${assignments.join(", ")}`,
            ConditionExpression: checks.join(" AND "),
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: marshall(values, { removeUndefinedValues: true }),
          },
        }
      : null;
  try {
    await getDynamoClient().send(
      new TransactWriteItemsCommand({
        TransactItems: [
          patch || {
            Put: {
              TableName: table(),
              Item: marshall(next, { removeUndefinedValues: true }),
              ConditionExpression: condition,
              ...(existing
                ? {
                    ExpressionAttributeNames: { "#version": "version" },
                    ...(existing.version !== undefined
                      ? { ExpressionAttributeValues: marshall({ ":previous": existing.version }) }
                      : {}),
                  }
                : {}),
            },
          },
          {
            Put: {
              TableName: table(),
              Item: marshall(audit(event, action, item.PK, reason), {
                removeUndefinedValues: true,
              }),
            },
          },
        ],
      }),
    );
  } catch (error: any) {
    if (error.name === "TransactionCanceledException")
      throw new AdminError(409, "Kayıt başka bir işlemle değişti. Yenileyip tekrar deneyin.");
    throw error;
  }
  return next;
}
async function log(event: ApiGatewayEvent, action: string, targetId: string, reason: string) {
  await getDynamoClient().send(
    new PutItemCommand({
      TableName: table(),
      Item: marshall(audit(event, action, targetId, reason)),
    }),
  );
}
export async function groupsFor(username: string): Promise<string[]> {
  if (!process.env.COGNITO_USER_MANAGEMENT && !process.env.ADMIN_GROUP_NAME) return [];
  const groups: string[] = [];
  let token: string | undefined;
  do {
    const result = await cognito().send(
      new AdminListGroupsForUserCommand({
        UserPoolId: pool(),
        Username: username,
        NextToken: token,
      }),
    );
    groups.push(...(result.Groups || []).map((group) => group.GroupName!));
    token = result.NextToken;
  } while (token);
  return groups;
}
async function account(id: string) {
  try {
    const result = await cognito().send(
      new AdminGetUserCommand({ UserPoolId: pool(), Username: id }),
    );
    const fields = Object.fromEntries((result.UserAttributes || []).map((a) => [a.Name, a.Value]));
    return {
      userId: fields.sub || id,
      username: result.Username!,
      email: fields.email || "",
      name: fields.name || "",
      phone: fields.phone_number || "",
      emailVerified: fields.email_verified === "true",
      enabled: result.Enabled,
      status: result.UserStatus,
      createdAt: result.UserCreateDate?.toISOString(),
      groups: await groupsFor(result.Username!),
    };
  } catch (error: any) {
    if (error.name === "UserNotFoundException") throw new AdminError(404, "Kullanıcı bulunamadı.");
    throw error;
  }
}
export function getTableName(): string {
  return process.env.DYNAMODB_TABLE || `mapsbridge-${process.env.ENVIRONMENT || "prod"}-data`;
}

export async function scanAllRaw(
  ddb: any,
  input: Record<string, any>,
): Promise<{ Items: any[]; Count: number }> {
  const { ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const Items: any[] = [];
  let Count = 0;
  let cursor = input.ExclusiveStartKey;
  do {
    const page = await ddb.send(new ScanCommand({ ...input, ExclusiveStartKey: cursor }));
    Items.push(...(page.Items || []));
    Count += page.Count || 0;
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  return { Items, Count };
}

export async function findRouteRecord(routeId: string): Promise<Row | null> {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });
  const result = await scanAllRaw(ddb, {
    TableName: getTableName(),
    FilterExpression: "(PK = :route AND SK = :meta) OR (begins_with(PK, :user) AND SK = :route)",
    ExpressionAttributeValues: {
      ":route": { S: `ROUTE#${routeId}` },
      ":meta": { S: "META" },
      ":user": { S: "USER#" },
    },
  });
  return result.Items.length === 1 ? unmarshall(result.Items[0]) : null;
}

export async function recordAuditLog(
  actorSub: string,
  action: string,
  targetId: string,
  reason: string,
  details?: Record<string, unknown>,
): Promise<string | null> {
  try {
    const { DynamoDBClient, PutItemCommand } = await import("@aws-sdk/client-dynamodb");
    const { marshall } = await import("@aws-sdk/util-dynamodb");
    const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });
    const auditId = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    await ddb.send(
      new PutItemCommand({
        TableName: getTableName(),
        Item: marshall({
          PK: `AUDIT#${auditId}`,
          SK: "META",
          auditId,
          actorSub,
          action,
          targetId,
          reason: reason || "Belirtilmedi",
          details: details || {},
          createdAt: now,
        }),
      }),
    );
    return auditId;
  } catch (err) {
    console.error("[Admin] Audit log recording failed:", err);
    return null;
  }
}

export async function protectAccount(event: ApiGatewayEvent, id: string) {
  if (id === process.env.PROTECTED_ADMIN_SUB)
    throw new AdminError(403, "Birincil yönetici hesabı korunuyor.");
  if (id === actor(event)) throw new AdminError(400, "Kendi hesabınız için bu işlem yapılamaz.");
  const groups = await groupsFor(id);
  if (groups.includes(process.env.ADMIN_GROUP_NAME || "mapsbridge-admin"))
    throw new AdminError(
      409,
      "Yönetici hesabı korunuyor. Önce farklı bir yönetici tarafından rolü değiştirilmelidir.",
    );
}
export const managementRoutes: Record<string, (e: ApiGatewayEvent) => Promise<any>> = {
  "GET /admin/session": async (e) => {
    const user = (e as AuthorizedEvent).verifiedUser;
    const role: StaffRole = user.staffRole || "admin";
    return ok({
      session: {
        userId: user.sub,
        role,
        permissions: permissions[role],
        paymentsConfigured: !!process.env.STRIPE_SECRET_KEY,
        userManagement: process.env.COGNITO_USER_MANAGEMENT === "true",
      },
    });
  },
  "GET /admin/users/{id}": async (e) => {
    const id = e.pathParameters!.id!;
    const user = await account(id);
    const rows = await userRows(id);
    const meta = rows.find((r) => r.SK === "META") || {};
    return ok({
      user: { ...user, notes: meta.notes || "", version: meta.version || 0 },
      wallet: rows.find((r) => r.SK === "CREDITS") || { credits: 0, frozen: false },
      subscription: rows.find((r) => r.SK === "SUBSCRIPTION") || { tier: "free", status: "none" },
      routes: rows.filter((r) => r.SK?.startsWith("ROUTE#")),
      usage: rows
        .filter((r) => r.SK?.startsWith("AI#"))
        .map((r) => ({
          requestId: r.SK.slice(3),
          status: r.state,
          cost: r.cost,
          createdAt: r.createdAt,
        }))
        .slice(-100),
    });
  },
  "POST /admin/users/{id}/profile": async (e) => {
    const id = e.pathParameters!.id!;
    const b = bodyOf(e);
    const reason = text(b.reason, "Gerekçe");
    const name = text(b.name, "Ad", 120);
    const phone = text(b.phone || "", "Telefon", 25, false);
    const notes = text(b.notes || "", "Not", 4000, false);
    if (phone && !/^\+[1-9]\d{7,14}$/.test(phone))
      throw new AdminError(400, "Telefon ülke koduyla yazılmalıdır (+905…).");
    const user = await account(id);
    const previous = await get(`USER#${id}`);
    if ((previous?.version || 0) !== b.version)
      throw new AdminError(409, "Kullanıcı bilgileri değişti; yeniden açın.");
    await log(e, "user_profile_requested", id, reason);
    await cognito().send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: pool(),
        Username: user.username,
        UserAttributes: [
          { Name: "name", Value: name },
          ...(phone ? [{ Name: "phone_number", Value: phone }] : []),
        ],
      }),
    );
    if (!phone && user.phone)
      await cognito().send(
        new AdminDeleteUserAttributesCommand({
          UserPoolId: pool(),
          Username: user.username,
          UserAttributeNames: ["phone_number"],
        }),
      );
    await commit(
      e,
      { ...previous, PK: `USER#${id}`, SK: "META", name, notes },
      "user_profile_updated",
      reason,
      previous,
      true,
    );
    return ok({ status: "updated" });
  },
  "POST /admin/users/{id}/role": async (e) => {
    const id = e.pathParameters!.id!;
    const b = bodyOf(e);
    const reason = text(b.reason, "Gerekçe");
    if (id === process.env.PROTECTED_ADMIN_SUB)
      throw new AdminError(403, "Birincil yönetici rolü bu panelden değiştirilemez.");
    if (id === actor(e)) throw new AdminError(400, "Kendi yetkinizi değiştiremezsiniz.");
    const roles: Record<string, string> = {
      admin: process.env.ADMIN_GROUP_NAME || "mapsbridge-admin",
      moderator: process.env.MODERATOR_GROUP_NAME || "mapsbridge-moderator",
      support: process.env.SUPPORT_GROUP_NAME || "mapsbridge-support",
    };
    if (!["user", ...Object.keys(roles)].includes(b.role))
      throw new AdminError(400, "Geçersiz rol.");
    const user = await account(id);
    await log(e, "user_role_requested", id, reason);
    // Remove elevated memberships first: an interrupted transition cannot accidentally retain admin access.
    for (const group of user.groups.filter(
      (g) => Object.values(roles).includes(g) && g !== roles[b.role],
    ))
      await cognito().send(
        new AdminRemoveUserFromGroupCommand({
          UserPoolId: pool(),
          Username: user.username,
          GroupName: group,
        }),
      );
    if (roles[b.role] && !user.groups.includes(roles[b.role]))
      await cognito().send(
        new AdminAddUserToGroupCommand({
          UserPoolId: pool(),
          Username: user.username,
          GroupName: roles[b.role],
        }),
      );
    await log(e, "user_role_updated", id, reason);
    return ok({ status: "updated", role: b.role });
  },
  "POST /admin/users/{id}/sessions": async (e) => {
    const id = e.pathParameters!.id!;
    const reason = text(bodyOf(e).reason, "Gerekçe");
    await protectAccount(e, id);
    const user = await account(id);
    await log(e, "user_sessions_revoke_requested", id, reason);
    await cognito().send(
      new AdminUserGlobalSignOutCommand({ UserPoolId: pool(), Username: user.username }),
    );
    await log(e, "user_sessions_revoked", id, reason);
    return ok({ status: "revoked" });
  },
  "POST /admin/users/{id}/credits": async (e) => {
    const id = e.pathParameters!.id!;
    const b = bodyOf(e);
    const reason = text(b.reason, "Gerekçe");
    if (!Number.isSafeInteger(b.delta) || b.delta === 0 || Math.abs(b.delta) > 10000)
      throw new AdminError(
        400,
        "Kredi değişimi sıfır dışında -10000 ile 10000 arasında tam sayı olmalıdır.",
      );
    const requestId = text(b.requestId, "İşlem kimliği", 80);
    if (!/^[a-zA-Z0-9_-]{16,80}$/.test(requestId))
      throw new AdminError(400, "Geçersiz işlem kimliği.");
    await account(id);
    const receiptKey = `ADMINCREDIT#${requestId}`;
    const existing = await get(receiptKey);
    if (existing) {
      if (existing.userId !== id || existing.delta !== b.delta)
        throw new AdminError(409, "İşlem kimliği başka bir işlemde kullanılmış.");
      return ok({ status: "applied", duplicate: true });
    }
    const wallet = await get(`USER#${id}`, "CREDITS");
    const balance = wallet?.credits || 0;
    if (wallet?.frozen) throw new AdminError(409, "Dondurulmuş cüzdanın incelemesini tamamlayın.");
    if (balance + b.delta < 0) throw new AdminError(400, "Bakiye negatif olamaz.");
    try {
      await getDynamoClient().send(
        new TransactWriteItemsCommand({
          TransactItems: [
            {
              Put: {
                TableName: table(),
                Item: marshall({
                  PK: receiptKey,
                  SK: "META",
                  userId: id,
                  delta: b.delta,
                  reason,
                  actorSub: actor(e),
                  createdAt: new Date().toISOString(),
                }),
                ConditionExpression: "attribute_not_exists(PK)",
              },
            },
            {
              Update: {
                TableName: table(),
                Key: marshall({ PK: `USER#${id}`, SK: "CREDITS" }),
                UpdateExpression: "SET credits = :next",
                ConditionExpression:
                  "(attribute_not_exists(credits) OR credits = :balance) AND (attribute_not_exists(frozen) OR frozen = :no)",
                ExpressionAttributeValues: marshall({
                  ":next": balance + b.delta,
                  ":balance": balance,
                  ":no": false,
                }),
              },
            },
            {
              Put: {
                TableName: table(),
                Item: marshall(
                  audit(e, "credits_adjusted", id, reason, { delta: b.delta, requestId }),
                ),
              },
            },
          ],
        }),
      );
    } catch (error: any) {
      if (error.name === "TransactionCanceledException") {
        const duplicate = await get(receiptKey);
        if (duplicate?.userId === id && duplicate?.delta === b.delta)
          return ok({ status: "applied", duplicate: true });
        throw new AdminError(409, "Bakiye değişti; yenileyip tekrar deneyin.");
      }
      throw error;
    }
    return ok({ status: "applied", credits: balance + b.delta });
  },
  "POST /admin/users/{id}/wallet": async (e) => {
    const id = e.pathParameters!.id!;
    const b = bodyOf(e);
    const reason = text(b.reason, "Gerekçe");
    if (typeof b.frozen !== "boolean") throw new AdminError(400, "Cüzdan durumu gerekli.");
    await account(id);
    const previous = await get(`USER#${id}`, "CREDITS");
    await getDynamoClient().send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Update: {
              TableName: table(),
              Key: marshall({ PK: `USER#${id}`, SK: "CREDITS" }),
              UpdateExpression: "SET frozen = :frozen",
              ExpressionAttributeValues: marshall({ ":frozen": b.frozen }),
            },
          },
          {
            Put: {
              TableName: table(),
              Item: marshall(audit(e, "wallet_reviewed", id, reason, { frozen: b.frozen })),
            },
          },
        ],
      }),
    );
    return ok({ status: "updated" });
  },
  "POST /admin/users/{id}/subscription": async (e) => {
    const id = e.pathParameters!.id!;
    const b = bodyOf(e);
    const reason = text(b.reason, "Gerekçe");
    if (!["cancel", "resume"].includes(b.action))
      throw new AdminError(400, "Geçersiz abonelik işlemi.");
    if (!process.env.STRIPE_SECRET_KEY) throw new AdminError(503, "Ödeme sağlayıcısı bağlı değil.");
    const previous = await get(`USER#${id}`, "SUBSCRIPTION");
    const customer = await get(`USER#${id}`, "STRIPE_CUSTOMER");
    if (!previous?.stripeSubscriptionId || !customer?.customerId)
      throw new AdminError(404, "Yönetilebilir abonelik bulunamadı.");
    const stripe = await stripeClient();
    const subscription = await stripe.subscriptions.retrieve(previous.stripeSubscriptionId);
    if (
      (typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id) !== customer.customerId
    )
      throw new AdminError(409, "Abonelik sahibi doğrulanamadı.");
    await log(e, "subscription_change_requested", id, reason);
    const updated = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: b.action === "cancel",
    });
    await commit(
      e,
      { ...previous, cancelAtPeriodEnd: updated.cancel_at_period_end },
      "subscription_updated",
      reason,
      previous,
      true,
    );
    return ok({ status: "updated" });
  },
  "POST /admin/routes/{id}/details": async (e) => {
    const b = bodyOf(e);
    const reason = text(b.reason, "Gerekçe");
    const id = e.pathParameters!.id!;
    const matches = await scan(
      "(PK = :route AND SK = :meta) OR (begins_with(PK, :user) AND SK = :route)",
      { ":route": `ROUTE#${id}`, ":meta": "META", ":user": "USER#" },
    );
    if (matches.length !== 1) throw new AdminError(404, "Rota bulunamadı.");
    const previous = matches[0];
    if ((previous.version || 0) !== b.version)
      throw new AdminError(409, "Rota değişti; yeniden açın.");
    await commit(
      e,
      {
        ...previous,
        name: text(b.name, "Rota adı", 120),
        description: text(b.description || "", "Açıklama", 2000, false),
      },
      "route_details_updated",
      reason,
      previous,
      true,
    );
    return ok({ status: "updated" });
  },
  "GET /admin/usage": async () => {
    const rows = await scan("begins_with(PK, :user) AND begins_with(SK, :ai)", {
      ":user": "USER#",
      ":ai": "AI#",
    });
    return ok({
      usage: rows
        .map((r) => ({
          id: r.SK.slice(3),
          userId: r.PK.slice(5),
          status: r.state,
          credits: r.cost,
          createdAt: r.createdAt,
        }))
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
    });
  },
  "GET /admin/subscriptions": async () =>
    ok({
      subscriptions: await scan("begins_with(PK, :pk) AND SK = :sk", {
        ":pk": "USER#",
        ":sk": "SUBSCRIPTION",
      }),
    }),
  "GET /admin/shares": async () => {
    const rows = await scan("begins_with(PK, :pk)", { ":pk": "SHARE#" });
    return ok({
      shares: rows
        .filter((r) => r.SK === "METADATA" || r.SK === "ROUTE")
        .map((r) => ({
          id: r.PK.slice(6),
          type: r.SK === "ROUTE" ? "route" : "location",
          owner: r.owner || r.userId,
          address: r.address,
          createdAt:
            typeof r.createdAt === "number"
              ? new Date(r.createdAt * 1000).toISOString()
              : r.createdAt,
          expiresAt: r.expiresAt,
          status: r.revoked ? "revoked" : r.expiresAt <= Date.now() / 1000 ? "expired" : "active",
        })),
    });
  },
  "POST /admin/shares/{id}/revoke": async (e) => {
    const id = e.pathParameters!.id!;
    const reason = text(bodyOf(e).reason, "Gerekçe");
    const previous = (await get(`SHARE#${id}`, "METADATA")) || (await get(`SHARE#${id}`, "ROUTE"));
    if (!previous) throw new AdminError(404, "Paylaşım bulunamadı.");
    await commit(
      e,
      {
        ...previous,
        revoked: true,
        expiresAt: Math.min(previous.expiresAt || 0, Math.floor(Date.now() / 1000)),
      },
      "share_revoked",
      reason,
      previous,
      true,
    );
    return ok({ status: "revoked" });
  },
  "GET /admin/profiles": async () =>
    ok({
      profiles: (
        await scan("begins_with(PK, :pk) AND SK = :sk", { ":pk": "PROFILE#", ":sk": "PUBLIC" })
      ).map((r) => ({
        id: r.PK.slice(8),
        owner: r.owner,
        name: [r.profile?.firstName, r.profile?.lastName].filter(Boolean).join(" "),
        published: r.published,
        status: r.adminStatus || (r.published ? "published" : "draft"),
        version: r.version || 0,
      })),
    }),
  "POST /admin/profiles/{id}/moderate": async (e) => {
    const id = e.pathParameters!.id!;
    const b = bodyOf(e);
    const reason = text(b.reason, "Gerekçe");
    if (!["suspend", "approve"].includes(b.action))
      throw new AdminError(400, "Geçersiz profil kararı.");
    const previous = await get(`PROFILE#${id}`, "PUBLIC");
    if (!previous) throw new AdminError(404, "Profil bulunamadı.");
    await commit(
      e,
      {
        ...previous,
        ...(b.action === "suspend" ? { published: false } : {}),
        adminStatus: b.action === "suspend" ? "suspended" : "approved",
      },
      `profile_${b.action}`,
      reason,
      previous,
      true,
    );
    return ok({ status: "updated" });
  },
  "GET /admin/content": async () =>
    ok({
      content: await scan("(begins_with(PK, :blog) OR begins_with(PK, :guide)) AND SK = :sk", {
        ":blog": "BLOG#",
        ":guide": "GUIDE#",
        ":sk": "META",
      }),
    }),
  "POST /admin/content": async (e) => {
    const b = bodyOf(e);
    const reason = text(b.reason, "Gerekçe");
    const title = text(b.title, "Başlık", 200);
    const content = text(b.content, "İçerik", 30000);
    const blogId = crypto.randomUUID();
    const row = {
      PK: `BLOG#${blogId}`,
      SK: "META",
      blogId,
      title,
      content,
      authorId: actor(e),
      published: false,
      status: "draft",
      createdAt: new Date().toISOString(),
    };
    return created({ content: await commit(e, row, "blog_created", reason) });
  },
  "POST /admin/content/{type}/{id}": async (e) => {
    const { type, id } = e.pathParameters!;
    if (!["blog", "guide"].includes(type!)) throw new AdminError(400, "Geçersiz içerik türü.");
    const b = bodyOf(e);
    const reason = text(b.reason, "Gerekçe");
    if (!["draft", "published", "archived"].includes(b.status))
      throw new AdminError(400, "Geçersiz yayın durumu.");
    const previous = await get(`${type!.toUpperCase()}#${id}`);
    if (!previous) throw new AdminError(404, "İçerik bulunamadı.");
    if ((previous.version || 0) !== b.version)
      throw new AdminError(409, "İçerik değişti; yeniden açın.");
    const next = {
      ...previous,
      title: text(b.title, "Başlık", 200),
      ...(type === "blog"
        ? { content: text(b.content, "İçerik", 30000) }
        : { description: text(b.description || "", "Açıklama", 2000, false) }),
      status: b.status,
      published: b.status === "published",
      adminStatus: b.status === "archived" ? "suspended" : "approved",
    };
    return ok({ content: await commit(e, next, "content_updated", reason, previous) });
  },
  "GET /admin/tickets": async () =>
    ok({
      tickets: (
        await scan("begins_with(PK, :pk) AND SK = :sk", { ":pk": "TICKET#", ":sk": "META" })
      ).sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)),
    }),
  "POST /admin/tickets/{id}": async (e) => {
    const b = bodyOf(e);
    const reason = text(b.reason, "Gerekçe");
    const previous = await get(`TICKET#${e.pathParameters!.id}`);
    if (!previous) throw new AdminError(404, "Talep bulunamadı.");
    if ((previous.version || 0) !== b.version)
      throw new AdminError(409, "Talep değişti; yeniden açın.");
    if (
      !["open", "in_progress", "resolved", "closed"].includes(b.status) ||
      !["low", "normal", "high", "urgent"].includes(b.priority)
    )
      throw new AdminError(400, "Durum veya öncelik geçersiz.");
    const reply = text(b.reply || "", "Yanıt", 4000, false);
    const internalNote = text(b.internalNote || "", "İç not", 4000, false);
    const messages = [
      ...(previous.messages || []),
      ...(reply ? [{ body: reply, author: "support", createdAt: new Date().toISOString() }] : []),
    ];
    if (messages.length > 100) throw new AdminError(400, "Bu talep yanıt sınırına ulaştı.");
    const updated = await commit(
      e,
      {
        ...previous,
        status: b.status,
        priority: b.priority,
        assignedTo: b.assignToMe ? actor(e) : previous.assignedTo || "",
        internalNote,
        messages,
      },
      "ticket_updated",
      reason,
      previous,
    );
    return ok({ ticket: updated });
  },
  "GET /admin/announcements": async () =>
    ok({ announcements: await scan("begins_with(PK, :pk)", { ":pk": "ANNOUNCEMENT#" }) }),
  "POST /admin/announcements": async (e) => {
    const b = bodyOf(e);
    const reason = text(b.reason, "Gerekçe");
    const id = b.id ? text(b.id, "Duyuru kimliği", 100) : crypto.randomUUID();
    const previous = b.id ? await get(`ANNOUNCEMENT#${id}`) : null;
    if (b.id && !previous) throw new AdminError(404, "Duyuru bulunamadı.");
    if (previous && (previous.version || 0) !== b.version)
      throw new AdminError(409, "Duyuru değişti; yeniden açın.");
    if (!["draft", "published", "archived"].includes(b.status))
      throw new AdminError(400, "Geçersiz durum.");
    if (
      (b.startsAt && !Number.isFinite(Date.parse(b.startsAt))) ||
      (b.endsAt && !Number.isFinite(Date.parse(b.endsAt)))
    )
      throw new AdminError(400, "Geçersiz duyuru tarihi.");
    const start = b.startsAt ? new Date(b.startsAt).toISOString() : new Date().toISOString();
    const end = b.endsAt ? new Date(b.endsAt).toISOString() : "";
    if (end && end <= start) throw new AdminError(400, "Bitiş başlangıçtan sonra olmalı.");
    return ok({
      announcement: await commit(
        e,
        {
          PK: `ANNOUNCEMENT#${id}`,
          SK: "META",
          id,
          title: text(b.title, "Başlık", 160),
          message: text(b.message, "Duyuru", 1500),
          status: b.status,
          startsAt: start,
          endsAt: end,
          createdAt: previous?.createdAt || new Date().toISOString(),
        },
        "announcement_updated",
        reason,
        previous,
      ),
    });
  },
};
