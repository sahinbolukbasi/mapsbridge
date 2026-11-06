// Yer verisi proxy'si: altyapı katmanı (DynamoDB). Single-table `{env}-data`, GSI YOK.
//   Önbellek:   PK=PLACECACHE#<provider>#<sha256>  SK=META   { places, expiresAt }  (TTL expiresAt)
//   Günlük kota: PK=PLACES_QUOTA#<subject>          SK=<yyyymmdd> { count, expiresAt +2 gün }
//   Aylık bütçe: PK=SYSTEM#PLACES_BUDGET            SK=<yyyymm>   { count }
//   Kill switch: PK=SYSTEM#PLACES_CONTROL           SK=META   { googleEnabled, userDailyLimit, monthlyGoogleCalls }
import { GetItemCommand, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { getDynamoClient, getTableName, marshall, unmarshall } from "../shared/dynamo";
import {
  DEFAULT_PLACES_CONTROL,
  PLACES_CONTROL_KEY,
  parsePlacesControl,
  type Place,
  type PlacesControl,
  type PlacesRepo,
} from "./places.service";

export { PLACES_CONTROL_KEY };
export const PLACES_BUDGET_KEY = "SYSTEM#PLACES_BUDGET";
const CONTROL_CACHE_MS = 60_000;

const client = () => getDynamoClient({ maxAttempts: 1 });
const timeout = (ms: number) => ({ abortSignal: AbortSignal.timeout(ms) });
const isConditionFailure = (err: unknown) =>
  (err as { name?: string })?.name === "ConditionalCheckFailedException";

let controlCache: { at: number; value: PlacesControl } | null = null;
/** Testler için bellek önbelleğini sıfırlar. */
export function resetPlacesControlCache() {
  controlCache = null;
}

async function consume(PK: string, SK: string, limit: number, expiresAt?: number) {
  if (limit <= 0) return false;
  try {
    await client().send(
      new UpdateItemCommand({
        TableName: getTableName(),
        Key: marshall({ PK, SK }),
        UpdateExpression: expiresAt ? "ADD #count :one SET expiresAt = :exp" : "ADD #count :one",
        ConditionExpression: "attribute_not_exists(#count) OR #count < :limit",
        ExpressionAttributeNames: { "#count": "count" },
        ExpressionAttributeValues: marshall({
          ":one": 1,
          ":limit": limit,
          ...(expiresAt ? { ":exp": expiresAt } : {}),
        }),
      }),
      timeout(1500),
    );
    return true;
  } catch (err) {
    if (isConditionFailure(err)) return false;
    throw err;
  }
}

export const placesRepo: PlacesRepo = {
  async getCache(key, nowSeconds) {
    const result = await client().send(
      new GetItemCommand({ TableName: getTableName(), Key: marshall({ PK: key, SK: "META" }) }),
      timeout(1200),
    );
    if (!result.Item) return null;
    const row = unmarshall(result.Item);
    // TTL silmesi gecikmeli olabilir: süresi geçmiş satır isabet sayılmaz.
    if (typeof row.expiresAt !== "number" || row.expiresAt <= nowSeconds) return null;
    return Array.isArray(row.places) ? (row.places as Place[]) : null;
  },
  async putCache(key, places, expiresAt) {
    await client().send(
      new PutItemCommand({
        TableName: getTableName(),
        Item: marshall({ PK: key, SK: "META", places, expiresAt }, { removeUndefinedValues: true }),
      }),
      timeout(1500),
    );
  },
  async consumeDaily(subject, day, limit) {
    const expiresAt = Math.floor(Date.now() / 1000) + 2 * 86400;
    return consume(`PLACES_QUOTA#${subject}`, day, limit, expiresAt);
  },
  async consumeGoogleBudget(month, limit) {
    return consume(PLACES_BUDGET_KEY, month, limit);
  },
  async readControl() {
    if (controlCache && Date.now() - controlCache.at < CONTROL_CACHE_MS) return controlCache.value;
    let value: PlacesControl;
    try {
      const result = await client().send(
        new GetItemCommand({
          TableName: getTableName(),
          Key: marshall({ PK: PLACES_CONTROL_KEY, SK: "META" }),
          ConsistentRead: true,
        }),
        timeout(1200),
      );
      value = result.Item ? parsePlacesControl(unmarshall(result.Item)) : DEFAULT_PLACES_CONTROL;
    } catch {
      // Okunamazsa Google kapalı say (approval: kill switch güvenli varsayılan).
      value = { ...DEFAULT_PLACES_CONTROL, googleEnabled: false };
    }
    controlCache = { at: Date.now(), value };
    return value;
  },
};
