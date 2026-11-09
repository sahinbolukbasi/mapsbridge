/**
 * KB TTL tazelik worker'ı (Faz 2 / görev 8) — zamanlı (scheduled) lambda.
 *
 * Bedrock KB'yi besleyen DynamoDB KB entity'lerinin TTL'ini uygular: bayat
 * (expiresAt geçmiş) entity'leri siler ve tazelik metriklerini yayar. Bounded
 * batch — training-worker deseniyle aynı: her çağrıda sınırlı sayıda entity
 * taranır, kalan bir sonraki tetiğe bırakılır (hasMore).
 *
 * SINIR KURALI (architecture-truth.md §5): backend (infra/lambda) frontend'e
 * bağımlı OLAMAZ. Bu yüzden bayatlık kararı ve kaskad silme, web katmanından
 * import EDİLMEZ; knowledge-base kb-store.isEntityStale ve kb-repo.deleteEntity ile
 * AYNI davranışı buraya yerel olarak kopyalarız (tek-tablo KB_PATTERNS deseni).
 * Davranış eşitliği kb-repo.test.cjs + kb-freshness-worker.test.cjs ile korunur.
 *
 * Metrikler (MapsBridge/AI, aiMetric): KBPruned (silinen), KBOldestAgeSeconds
 * (en eski entity'nin yaşı), KBScanned, Heartbeat.
 */

import {
  ScanCommand,
  QueryCommand,
  DeleteItemCommand,
  type AttributeValue,
} from "@aws-sdk/client-dynamodb";
import { getDynamoClient, getTableName, marshall, unmarshall } from "../shared/dynamo";
import { aiMetric } from "../shared/ai-operations";

/** kb-store.isEntityStale ile aynı: geçersiz tarih veya geçmiş expiresAt → bayat. */
function isStale(expiresAt: unknown, now: number): boolean {
  const t = Date.parse(String(expiresAt));
  if (Number.isNaN(t)) return true;
  return t < now;
}

/** kb-repo.deleteEntity ile aynı: KB#<id> altındaki tüm satırları (META/SOURCE#/CONFLICT#) sil. */
async function deleteEntityCascade(
  client: ReturnType<typeof getDynamoClient>,
  table: string,
  id: string,
): Promise<void> {
  const res = await client.send(
    new QueryCommand({
      TableName: table,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: marshall({ ":pk": `KB#${id}` }),
    }),
  );
  const rows = (res.Items || []).map((i) => unmarshall(i));
  await Promise.all(
    rows.map((r) =>
      client.send(
        new DeleteItemCommand({ TableName: table, Key: marshall({ PK: r.PK, SK: r.SK }) }),
      ),
    ),
  );
}

/**
 * Tüm KB entity'lerini (KB#<id> / META) GSI olmadan bulmanın tek yolu Scan'dir; ancak
 * tek-tablo büyük olduğundan, yalnızca entity satırlarını (kind=entity) FilterExpression
 * ile daraltıp bounded batch halinde tararız. Her çağrı en çok 100 entity işler.
 */
export async function handler(
  _event: unknown,
  context?: { getRemainingTimeInMillis(): number },
): Promise<{ pruned: number; scanned: number; hasMore: boolean }> {
  const table = getTableName();
  if (!process.env.DYNAMODB_TABLE) throw new Error("KB_FRESHNESS_WORKER_NOT_CONFIGURED");
  const client = getDynamoClient({ maxAttempts: 2 });

  let pruned = 0;
  let scanned = 0;
  let oldestAgeSeconds = 0;
  let cursor: Record<string, AttributeValue> | undefined;
  let hasMore = false;
  const now = Date.now();

  do {
    const page = await client.send(
      new ScanCommand({
        TableName: table,
        FilterExpression: "SK = :meta AND #kind = :entity",
        ExpressionAttributeNames: { "#kind": "kind" },
        ExpressionAttributeValues: marshall({ ":meta": "META", ":entity": "entity" }),
        ExclusiveStartKey: cursor,
        Limit: 100,
      }),
    );

    for (const item of page.Items || []) {
      if (context && context.getRemainingTimeInMillis() < 10000) {
        hasMore = true;
        break;
      }
      scanned++;
      const entity = unmarshall(item) as { id: string; updatedAt?: string; expiresAt?: string };
      const ageSec = Number.isFinite(Date.parse(String(entity.updatedAt)))
        ? Math.max(0, (now - Date.parse(String(entity.updatedAt))) / 1000)
        : 0;
      if (ageSec > oldestAgeSeconds) oldestAgeSeconds = ageSec;
      if (isStale(entity.expiresAt, now)) {
        await deleteEntityCascade(client, table, entity.id);
        pruned++;
      }
    }
    cursor = page.LastEvaluatedKey;
    if (hasMore) break;
  } while (cursor);

  aiMetric("KBScanned", scanned);
  aiMetric("KBPruned", pruned);
  aiMetric("KBOldestAgeSeconds", oldestAgeSeconds, "Seconds");
  aiMetric("Heartbeat", 1);

  return { pruned, scanned, hasMore: hasMore || Boolean(cursor) };
}
