import { GetItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { getDynamoClient, getTableName } from "./dynamo";

export async function read(PK: string, SK: string) {
  const result = await getDynamoClient().send(
    new GetItemCommand({
      TableName: getTableName(),
      Key: marshall({ PK, SK }),
      ConsistentRead: true,
    }),
  );
  return result.Item ? unmarshall(result.Item) : null;
}

// G5: belirli bir PK altındaki SK öneki eşleşen öğeleri döndürür (ör. AI_CHAT# geçmişi).
// Salt okunur; kredi/yazma yoktur. `limit` ile sayfa büyüklüğü sınırlanır (varsayılan 50),
// `scanForward=false` en yeni (SK'ya göre) başta gibi davranır. Çağıran yalnız kendi
// PK'si (USER#<sub>) ile çağırmalıdır — yetki handler'da doğrulanır.
export async function listByPrefix(
  PK: string,
  skPrefix: string,
  opts: { limit?: number; scanForward?: boolean } = {},
): Promise<Record<string, unknown>[]> {
  const result = await getDynamoClient().send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :skp)",
      ExpressionAttributeNames: { "#pk": "PK", "#sk": "SK" },
      ExpressionAttributeValues: marshall({ ":pk": PK, ":skp": skPrefix }),
      Limit: opts.limit ?? 50,
      ScanIndexForward: opts.scanForward ?? true,
    }),
  );
  return (result.Items ?? []).map((item) => unmarshall(item));
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
