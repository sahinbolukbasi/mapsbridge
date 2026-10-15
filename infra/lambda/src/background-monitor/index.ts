/**
 * Background Monitor Lambda
 * Runs every 6 hours via EventBridge. Scans active user sessions, checks
 * FCDO advisory for each destination, and writes alert items to DynamoDB
 * when the advisory level changes.
 */

import { ScanCommand, PutItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { getDynamoClient } from "../shared/dynamo";

const TABLE = process.env.DYNAMODB_TABLE!;
const FCDO_BASE = "https://www.gov.uk/api/content/foreign-travel-advice";
const dynamo = getDynamoClient();

const ADVISORY_LABELS: Record<string, string> = {
  normal: "Normal seyahat tavsiyesi",
  some_risk: "Dikkatli olun",
  avoid_non_essential: "Zorunlu olmayan seyahatten kaçının",
  avoid: "Seyahat önerilmiyor",
};

function parseLevel(text: string): string {
  const t = (text || "").toLowerCase();
  if (t.includes("advise against all travel")) return "avoid";
  if (t.includes("essential travel only") || t.includes("non-essential"))
    return "avoid_non_essential";
  if (t.includes("some risk") || t.includes("exercise caution")) return "some_risk";
  return "normal";
}

async function fetchAdvisory(
  slug: string,
): Promise<{ level: string; levelLabel: string; summary: string } | null> {
  try {
    const res = await fetch(`${FCDO_BASE}/${slug}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const parts: any[] = Array.isArray(data.details?.parts) ? data.details.parts : [];
    const part = parts.find((p: any) => p.slug === "summary" || p.slug === "before-you-travel");
    const rawSummary: string = part?.body || data.details?.summary || data.description || "";
    const summary = rawSummary
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 400);
    const level = parseLevel(summary);
    return { level, levelLabel: ADVISORY_LABELS[level] || "Normal", summary };
  } catch {
    return null;
  }
}

export async function handler(): Promise<{ checked: number; alerts: number }> {
  // Scan AI conversation states to find recent active destinations
  const now = Date.now();
  const cutoff = Math.floor((now - 7 * 24 * 3600 * 1000) / 1000); // 7 days
  const destUsers = new Map<string, Set<string>>(); // slug → set of userIds

  let lastKey: Record<string, any> | undefined;
  do {
    const result = await dynamo.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression:
          "begins_with(PK, :prefix) AND begins_with(SK, :sk) AND updatedEpoch > :cutoff",
        ExpressionAttributeValues: {
          ":prefix": { S: "USER#" },
          ":sk": { S: "AI_CHAT#" },
          ":cutoff": { N: String(cutoff) },
        },
        ProjectionExpression: "PK, SK, route, conversationState",
        Limit: 200,
        ExclusiveStartKey: lastKey,
      }),
    );

    for (const raw of result.Items || []) {
      const item = unmarshall(raw) as any;
      const userId = item.PK?.replace("USER#", "");
      const dest: string | undefined =
        item.route?.destination || item.conversationState?.context?.destination;
      if (!userId || !dest) continue;
      const slug = dest
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      if (!destUsers.has(slug)) destUsers.set(slug, new Set());
      destUsers.get(slug)!.add(userId);
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  let checked = 0,
    alerts = 0;

  for (const [slug, userIds] of destUsers) {
    const advisory = await fetchAdvisory(slug);
    if (!advisory) continue;
    checked++;

    // Read previous advisory level for this destination
    const prevItem = await dynamo.send(
      new GetItemCommand({
        TableName: TABLE,
        Key: marshall({ PK: `ADVISORY#${slug}`, SK: "LATEST" }),
      }),
    );
    const prev = prevItem.Item ? (unmarshall(prevItem.Item) as any) : null;
    const prevLevel = prev?.level as string | undefined;

    // Store current level
    await dynamo.send(
      new PutItemCommand({
        TableName: TABLE,
        Item: marshall({
          PK: `ADVISORY#${slug}`,
          SK: "LATEST",
          level: advisory.level,
          levelLabel: advisory.levelLabel,
          summary: advisory.summary,
          checkedAt: new Date().toISOString(),
          expiresAt: Math.floor(now / 1000) + 7 * 24 * 3600,
        }),
      }),
    );

    // If advisory worsened, create alert items for affected users
    const levels = ["normal", "some_risk", "avoid_non_essential", "avoid"];
    const prevIdx = prevLevel ? levels.indexOf(prevLevel) : 0;
    const curIdx = levels.indexOf(advisory.level);
    if (curIdx > prevIdx && curIdx >= 1) {
      for (const userId of userIds) {
        await dynamo.send(
          new PutItemCommand({
            TableName: TABLE,
            Item: marshall({
              PK: `USER#${userId}`,
              SK: `ADVISORY_ALERT#${slug}#${Date.now()}`,
              destination: slug,
              level: advisory.level,
              levelLabel: advisory.levelLabel,
              summary: advisory.summary.slice(0, 200),
              createdAt: new Date().toISOString(),
              read: false,
              expiresAt: Math.floor(now / 1000) + 14 * 24 * 3600,
            }),
          }),
        );
        alerts++;
      }
      console.log(
        `[monitor] Advisory worsened for ${slug}: ${prevLevel} → ${advisory.level} (${userIds.size} users alerted)`,
      );
    }
  }

  console.log(`[monitor] Checked ${checked} destinations, created ${alerts} alerts`);
  return { checked, alerts };
}
