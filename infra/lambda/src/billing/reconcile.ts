/**
 * Billing Reconciliation Lambda — webhook kaybına karşı güvence.
 * EventBridge ile günlük çalışır. Son 48 saatte değişmiş ya da needsReconcile
 * işaretli abonelikleri RevenueCat REST v2 ile karşılaştırır; drift varsa düzeltir
 * ve CloudWatch'a metrik basar. Yetki kaynağı yine kendi DynamoDB'miz; bu job
 * yalnızca RC ile DynamoDB'yi hizalar.
 */
import { ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { getDynamoClient } from "../shared/dynamo";
import { table } from "./store";
import { getRcSubscriber, syncFromSubscriber } from "../revenuecat/index";

/** CloudWatch EMF metriği (structured JSON log). */
function metric(name: string, value: number, unit = "Count") {
  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: "MapsBridge/Billing",
            Dimensions: [["Service"]],
            Metrics: [{ Name: name, Unit: unit }],
          },
        ],
      },
      Service: "billing-reconcile",
      [name]: value,
    }),
  );
}

const DAY_MS = 86400 * 1000;

export async function handler(_event: unknown, context?: { getRemainingTimeInMillis(): number }) {
  const db = getDynamoClient({ maxAttempts: 2 });
  const cutoff = Date.now() - 2 * DAY_MS; // son 48 saat
  let scanned = 0,
    checked = 0,
    drift = 0,
    failed = 0;
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    if (context && context.getRemainingTimeInMillis() < 15000) break;
    const page = await db.send(
      new ScanCommand({
        TableName: table(),
        FilterExpression: "SK = :sk",
        ExpressionAttributeValues: { ":sk": { S: "SUBSCRIPTION" } },
        ExclusiveStartKey: ExclusiveStartKey as never,
        Limit: 100,
      }),
    );
    for (const item of page.Items || []) {
      scanned++;
      const sub = unmarshall(item) as {
        PK: string;
        needsReconcile?: boolean;
        updatedAt?: string;
        eventTime?: number;
      };
      const userId = sub.PK?.replace(/^USER#/, "");
      if (!userId) continue;
      // Yalnızca son 48 saatte değişmiş ya da reconcile işaretli olanlar
      const recent =
        sub.needsReconcile === true || (sub.eventTime ? sub.eventTime * 1000 >= cutoff : false);
      if (!recent) continue;
      checked++;
      try {
        const subscriber = await getRcSubscriber(userId);
        if (subscriber) {
          // RC gerçeğini DynamoDB'ye uygula (syncSubscription içindeki eventTime
          // koşulu eski veriyi korur; yalnızca ileri gider).
          await syncFromSubscriber(userId, subscriber, Math.floor(Date.now() / 1000));
          drift++;
        }
      } catch (err) {
        failed++;
        console.log(
          JSON.stringify({ msg: "reconcile_user_failed", userId, error: (err as Error).name }),
        );
      }
    }
    ExclusiveStartKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  metric("Scanned", scanned);
  metric("Checked", checked);
  metric("DriftCorrected", drift);
  metric("Failed", failed);
  metric("Heartbeat", 1);
  return { scanned, checked, drift, failed };
}
