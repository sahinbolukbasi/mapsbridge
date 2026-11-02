// Promosyon kodu sistemi — kredi atomikliği danger-zone deseniyle (bkz. billing/store.ts).
// Krediler yalnızca sunucuda eklenir. Redeem TEK TransactWriteItems ile atomiktir:
// kullanıcı-başına-tek-kullanım + kod kullanım limiti + bakiye artışı birlikte commit edilir.
// Biri başarısızsa hiçbiri yazılmaz → double-redeem ve limit aşımı DynamoDB seviyesinde imkansız.
import {
  GetItemCommand,
  PutItemCommand,
  TransactWriteItemsCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { getDynamoClient } from "../shared/dynamo";
import { BillingError, table } from "./store";

export interface PromoCode {
  code: string;
  credits: number;
  maxRedemptions: number; // 0 = sınırsız
  redeemedCount: number;
  expiresAt?: string; // ISO; yoksa süresiz
  active: boolean;
  createdAt: string;
  createdBy: string;
  note?: string;
}

const PROMO_PK = (code: string) => `BILLING#PROMO#${code.toUpperCase()}`;
const REDEEM_PK = (code: string, userId: string) =>
  `BILLING#PROMO#${code.toUpperCase()}#USER#${userId}`;
const CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,31}$/;

export function normalizeCode(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase();
}

/** Admin: yeni promosyon kodu oluştur. Aynı kod iki kez oluşturulamaz (attribute_not_exists). */
export async function createPromoCode(input: {
  code: string;
  credits: number;
  maxRedemptions: number;
  expiresAt?: string;
  createdBy: string;
  note?: string;
}): Promise<PromoCode> {
  const code = normalizeCode(input.code);
  if (!CODE_RE.test(code)) throw new BillingError(400, "PROMO_INVALID_CODE", "Geçersiz kod biçimi.");
  if (!Number.isSafeInteger(input.credits) || input.credits <= 0 || input.credits > 100000)
    throw new BillingError(400, "PROMO_INVALID_CREDITS", "Geçersiz kredi miktarı.");
  if (!Number.isSafeInteger(input.maxRedemptions) || input.maxRedemptions < 0)
    throw new BillingError(400, "PROMO_INVALID_LIMIT", "Geçersiz kullanım limiti.");
  if (input.expiresAt && !Number.isFinite(Date.parse(input.expiresAt)))
    throw new BillingError(400, "PROMO_INVALID_EXPIRY", "Geçersiz son kullanma tarihi.");
  const item: PromoCode = {
    code,
    credits: input.credits,
    maxRedemptions: input.maxRedemptions,
    redeemedCount: 0,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    active: true,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
    ...(input.note ? { note: input.note.slice(0, 200) } : {}),
  };
  try {
    await getDynamoClient().send(
      new PutItemCommand({
        TableName: table(),
        Item: marshall({
          PK: PROMO_PK(code),
          SK: "META",
          GSI1PK: "BILLING#PROMO#INDEX",
          GSI1SK: item.createdAt,
          ...item,
        }),
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );
  } catch (err) {
    if ((err as Error).name === "ConditionalCheckFailedException")
      throw new BillingError(409, "PROMO_EXISTS", "Bu kod zaten mevcut.");
    throw err;
  }
  return item;
}

export async function getPromoCode(code: string): Promise<PromoCode | null> {
  const r = await getDynamoClient().send(
    new GetItemCommand({
      TableName: table(),
      Key: marshall({ PK: PROMO_PK(normalizeCode(code)), SK: "META" }),
      ConsistentRead: true,
    }),
  );
  return r.Item ? (unmarshall(r.Item) as PromoCode) : null;
}

/** Admin: tüm promosyon kodlarını listele. */
export async function listPromoCodes(): Promise<PromoCode[]> {
  const r = await getDynamoClient().send(
    new QueryCommand({
      TableName: table(),
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: marshall({ ":pk": "BILLING#PROMO#INDEX" }),
    }),
  );
  return (r.Items || []).map((i) => unmarshall(i) as PromoCode);
}

/** Admin: kodu devre dışı bırak (yeni redeem engellenir; geçmiş korunur). */
export async function deactivatePromoCode(code: string): Promise<void> {
  await getDynamoClient().send(
    new TransactWriteItemsCommand({
      TransactItems: [
        {
          Update: {
            TableName: table(),
            Key: marshall({ PK: PROMO_PK(normalizeCode(code)), SK: "META" }),
            UpdateExpression: "SET active = :no",
            ConditionExpression: "attribute_exists(PK)",
            ExpressionAttributeValues: marshall({ ":no": false }),
          },
        },
      ],
    }),
  );
}

/**
 * Kullanıcı: promosyon kodunu kullan. ATOMİK (tek TransactWriteItems):
 *  1) Redeem kaydı — attribute_not_exists → bu kullanıcı bu kodu DAHA ÖNCE kullanmadı,
 *  2) Kod sayacı +1 — active=true, süresi geçmemiş, (limit=0 VEYA redeemedCount < limit),
 *  3) Kullanıcı bakiyesi += credits.
 * Biri koşulu sağlamazsa transaction tümüyle iptal → kredi verilmez.
 */
export async function redeemPromoCode(userId: string, rawCode: string): Promise<{ credits: number }> {
  const code = normalizeCode(rawCode);
  if (!userId) throw new BillingError(401, "UNAUTHORIZED", "Oturum doğrulanamadı.");
  if (!CODE_RE.test(code)) throw new BillingError(400, "PROMO_INVALID_CODE", "Geçersiz kod.");
  const promo = await getPromoCode(code);
  if (!promo || !promo.active)
    throw new BillingError(404, "PROMO_NOT_FOUND", "Kod bulunamadı veya kullanımda değil.");
  if (promo.expiresAt && Date.parse(promo.expiresAt) <= Date.now())
    throw new BillingError(410, "PROMO_EXPIRED", "Bu kodun süresi dolmuş.");

  const now = new Date().toISOString();
  // Limit koşulu: sınırsız (0) ise sayaç koşulu koyma; değilse redeemedCount < maxRedemptions.
  const limited = promo.maxRedemptions > 0;
  const condParts = ["active = :yes"];
  const values: Record<string, unknown> = { ":yes": true, ":one": 1, ":credits": promo.credits };
  if (limited) {
    condParts.push("redeemedCount < :max");
    values[":max"] = promo.maxRedemptions;
  }
  if (promo.expiresAt) {
    condParts.push("expiresAt > :now");
    values[":now"] = now;
  }
  try {
    await getDynamoClient().send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            // 1) Kullanıcı-başına-tek-kullanım kilidi
            Put: {
              TableName: table(),
              Item: marshall({
                PK: REDEEM_PK(code, userId),
                SK: "REDEEM",
                userId,
                code,
                credits: promo.credits,
                redeemedAt: now,
              }),
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            // 2) Kod sayacı + limit/aktiflik/süre koşulu
            Update: {
              TableName: table(),
              Key: marshall({ PK: PROMO_PK(code), SK: "META" }),
              UpdateExpression: "ADD redeemedCount :one",
              ConditionExpression: condParts.join(" AND "),
              ExpressionAttributeValues: marshall(values),
            },
          },
          {
            // 3) Bakiye artışı (yalnızca sunucuda)
            Update: {
              TableName: table(),
              Key: marshall({ PK: `USER#${userId}`, SK: "CREDITS" }),
              UpdateExpression: "ADD credits :credits",
              ExpressionAttributeValues: marshall({ ":credits": promo.credits }),
            },
          },
        ],
      }),
    );
  } catch (err) {
    const name = (err as Error).name;
    if (name === "TransactionCanceledException") {
      // Hangi koşul patladı: önce tekrar-kullanım mı, yoksa limit/süre mi?
      const already = await getDynamoClient().send(
        new GetItemCommand({
          TableName: table(),
          Key: marshall({ PK: REDEEM_PK(code, userId), SK: "REDEEM" }),
          ConsistentRead: true,
        }),
      );
      if (already.Item)
        throw new BillingError(409, "PROMO_ALREADY_REDEEMED", "Bu kodu zaten kullandınız.");
      throw new BillingError(409, "PROMO_LIMIT_REACHED", "Bu kodun kullanım limiti dolmuş.");
    }
    throw err;
  }
  return { credits: promo.credits };
}
