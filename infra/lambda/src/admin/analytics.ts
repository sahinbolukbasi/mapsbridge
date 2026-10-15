import type { ApiGatewayEvent } from "../shared/http";
import { ok, badRequest, parseBody } from "../shared/http";
import { getTableName, scanAllRaw } from "./management";
import { paymentRecords } from "./users";

export async function handleMetrics() {
  const { DynamoDBClient, ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });
  const now = new Date();

  const userCountResult = await scanAllRaw(ddb, {
    TableName: getTableName(),
    FilterExpression: "SK = :sk AND begins_with(PK, :pk)",
    ExpressionAttributeValues: { ":sk": { S: "META" }, ":pk": { S: "USER#" } },
    Select: "COUNT",
  });
  const totalUsers = userCountResult.Count || 0;

  const subCount = await scanAllRaw(ddb, {
    TableName: getTableName(),
    FilterExpression: "SK = :sk AND #status = :active",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: { ":sk": { S: "SUBSCRIPTION" }, ":active": { S: "active" } },
    Select: "COUNT",
    Limit: 10000,
  });

  const guideCount = await scanAllRaw(ddb, {
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk)",
    ExpressionAttributeValues: { ":pk": { S: "GUIDE#" } },
    Select: "COUNT",
    Limit: 10000,
  });

  const todayStart = `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
  const payments = (await paymentRecords()).filter((p) => p.createdAt && p.createdAt >= todayStart);

  return ok({
    metrics: {
      totalUsers,
      activeSubscriptions: subCount.Count || 0,
      totalGuides: guideCount.Count || 0,
      todayPayments: payments.length,
      timestamp: now.toISOString(),
    },
  });
}

export async function handleTokenUsageAdmin() {
  return ok({
    usage: {
      note: "Token ölçüm kaynağı henüz bağlanmadı.",
      totalInvocations: null,
      estimatedTokensMonth: null,
      activeModels: [],
      quotaUtilizationPct: null,
    },
  });
}

export async function handleRealtimeTelemetry() {
  const metrics = JSON.parse((await handleMetrics()).body).metrics;
  return ok({
    realtime: {
      timestamp: metrics.timestamp,
      registeredUsers: metrics.totalUsers,
      activeExplorers: null,
      currentMapUsers: null,
      aiQueriesToday: null,
      grossMarketplaceTRY: null,
      netCommissionTRY: null,
      mapClusters: [],
      telemetry: {
        topoLoadPercent: null,
        waypointsPerSec: null,
        geocodingLatencyMs: null,
        liveSyncRooms: null,
      },
      note: "Canlı konum ve performans ölçümleri henüz bağlanmadı.",
    },
  });
}

export async function handleDeviceAnalytics() {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const result = await scanAllRaw(ddb, {
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk) AND SK = :sk",
    ExpressionAttributeValues: { ":pk": { S: "SESSION#" }, ":sk": { S: "META" } },
  });
  const sessions = result.Items.map((i: any) => unmarshall(i));

  let mobile = 0;
  let web = 0;
  let tablet = 0;
  const byDay: Record<string, { mobile: number; web: number }> = {};

  for (const s of sessions) {
    const deviceType = s.deviceType || "web";
    if (deviceType === "mobile") mobile++;
    else if (deviceType === "tablet") tablet++;
    else web++;

    const day = (s.createdAt || "").slice(0, 10);
    if (day) {
      if (!byDay[day]) byDay[day] = { mobile: 0, web: 0 };
      if (deviceType === "mobile" || deviceType === "tablet") byDay[day].mobile++;
      else byDay[day].web++;
    }
  }

  const total = mobile + web + tablet;
  const trend = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, counts]) => ({ date, ...counts }));

  return ok({
    devices: {
      total,
      mobile,
      web,
      tablet,
      mobilePercent: total > 0 ? Math.round(((mobile + tablet) * 100) / total) : 0,
      webPercent: total > 0 ? Math.round((web * 100) / total) : 0,
      trend,
    },
  });
}

export async function handleTrackSession(event: ApiGatewayEvent) {
  const body = parseBody<{ deviceType?: string; page?: string; sessionId?: string }>(event);
  if (!body) return badRequest("Geçersiz istek.");

  const deviceType = ["mobile", "tablet", "web"].includes(body.deviceType || "")
    ? body.deviceType
    : "web";
  const page = typeof body.page === "string" ? body.page.slice(0, 200) : "/";
  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : `s_${Date.now()}`;
  const user = (event as any).verifiedUser;

  const { DynamoDBClient, PutItemCommand } = await import("@aws-sdk/client-dynamodb");
  const { marshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  await ddb.send(
    new PutItemCommand({
      TableName: getTableName(),
      Item: marshall({
        PK: `SESSION#${sessionId}`,
        SK: "META",
        sessionId,
        deviceType,
        page,
        userId: user?.sub || "anonymous",
        createdAt: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 3600,
      }),
    }),
  );

  return ok({ tracked: true });
}

export async function handleAITopicAnalytics() {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString();

  const result = await scanAllRaw(ddb, {
    TableName: getTableName(),
    FilterExpression: "begins_with(SK, :sk) AND createdAt >= :cutoff",
    ExpressionAttributeValues: { ":sk": { S: "AI#" }, ":cutoff": { S: cutoffStr } },
    ProjectionExpression: "PK, SK, #prompt, createdAt, cost",
    ExpressionAttributeNames: { "#prompt": "prompt" },
  });

  const rows = result.Items.map((i: any) => unmarshall(i));

  const topicKeywords: Record<string, string[]> = {
    Uçuş: ["uçuş", "bilet", "havalimanı", "uçak", "flight"],
    Otel: ["otel", "konaklama", "hotel", "kal", "rezervasyon"],
    "Gezi Rotası": ["rota", "plan", "gün", "tur", "seyahat"],
    Vize: ["vize", "pasaport", "giriş", "belge", "visa"],
    "Yeme-İçme": ["restoran", "yemek", "kafe", "lokanta", "food"],
    Aktivite: ["müze", "gezil", "ziyaret", "aktivite", "attraction"],
    Ulaşım: ["toplu", "metro", "taksi", "transfer", "ulaşım"],
    Bütçe: ["fiyat", "bütçe", "ucuz", "para", "maliyet"],
  };

  const topicCounts: Record<string, number> = {};
  const destCounts: Record<string, number> = {};
  let totalRequests = rows.length;
  let totalCost = 0;
  const dailyMap: Record<string, number> = {};

  for (const row of rows) {
    const prompt = (row.prompt || "").toLowerCase();
    totalCost += row.cost || 0;
    const day = (row.createdAt || "").slice(0, 10);
    if (day) dailyMap[day] = (dailyMap[day] || 0) + 1;

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some((k) => prompt.includes(k))) {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      }
    }

    const destPatterns = [
      "istanbul",
      "barcelona",
      "paris",
      "londra",
      "roma",
      "amsterdam",
      "berlin",
      "madrid",
      "atina",
      "dubai",
    ];
    for (const dest of destPatterns) {
      if (prompt.includes(dest)) destCounts[dest] = (destCounts[dest] || 0) + 1;
    }
  }

  const topTopics = Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([topic, count]) => ({
      topic,
      count,
      percent: totalRequests > 0 ? Math.round((count * 100) / totalRequests) : 0,
    }));
  const topDestinations = Object.entries(destCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([destination, count]) => ({ destination, count }));
  const dailyActivity = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, requests]) => ({ date, requests }));

  return ok({
    aiAnalytics: {
      totalRequests,
      totalCost: Math.round(totalCost * 100) / 100,
      avgCostPerRequest:
        totalRequests > 0 ? Math.round((totalCost / totalRequests) * 100) / 100 : 0,
      topTopics,
      topDestinations,
      dailyActivity,
      periodDays: 30,
    },
  });
}

export async function handleCommunityAnalytics() {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const result = await scanAllRaw(ddb, {
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk)",
    ExpressionAttributeValues: { ":pk": { S: "POST#" } },
  });
  const posts = result.Items.map((i: any) => unmarshall(i));

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 3600_000).toISOString();
  const last7d = new Date(now.getTime() - 7 * 24 * 3600_000).toISOString();

  const recentPosts = posts.filter((p) => p.createdAt >= last24h).length;
  const weekPosts = posts.filter((p) => p.createdAt >= last7d).length;
  const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
  const totalComments = posts.reduce((sum, p) => sum + (p.comments || 0), 0);

  const topPosts = posts
    .filter((p) => p.createdAt >= last7d)
    .sort((a, b) => (b.likes || 0) + (b.comments || 0) - ((a.likes || 0) + (a.comments || 0)))
    .slice(0, 10)
    .map((p) => ({
      id: p.postId || p.PK,
      title: (p.content || "").slice(0, 80),
      author: p.authorEmail || "—",
      likes: p.likes || 0,
      comments: p.comments || 0,
      createdAt: p.createdAt,
    }));

  const dailyMap: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dailyMap[d.toISOString().slice(0, 10)] = 0;
  }
  for (const p of posts) {
    const day = (p.createdAt || "").slice(0, 10);
    if (day in dailyMap) dailyMap[day]++;
  }
  const dailyTrend = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

  return ok({
    community: {
      totalPosts: posts.length,
      postsLast24h: recentPosts,
      postsLast7d: weekPosts,
      totalLikes,
      totalComments,
      engagementRate:
        posts.length > 0 ? Math.round(((totalLikes + totalComments) / posts.length) * 10) / 10 : 0,
      topPosts,
      dailyTrend,
    },
  });
}

export async function handleSubscriptionAnalytics() {
  const { DynamoDBClient, ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const result = await scanAllRaw(ddb, {
    TableName: getTableName(),
    FilterExpression: "SK = :sk",
    ExpressionAttributeValues: { ":sk": { S: "SUBSCRIPTION" } },
  });
  const subs = result.Items.map((i: any) => unmarshall(i));

  const payments = await paymentRecords();

  const tierCount: Record<string, number> = {};
  const tierRevenue: Record<string, number> = {};
  let activeCount = 0;
  let cancelledCount = 0;

  for (const s of subs) {
    const tier = s.tier || "free";
    tierCount[tier] = (tierCount[tier] || 0) + 1;
    if (s.status === "active") activeCount++;
    else if (s.status === "cancelled") cancelledCount++;
  }

  for (const p of payments) {
    if (p.status === "succeeded" && p.tier) {
      tierRevenue[p.tier] = (tierRevenue[p.tier] || 0) + (p.amount || 0);
    }
  }

  const now = new Date();
  const last30Start = new Date(now);
  last30Start.setDate(last30Start.getDate() - 30);
  const newSubscribers30d = subs.filter((s) => s.createdAt >= last30Start.toISOString()).length;
  const churnedLast30d = subs.filter(
    (s) => s.cancelledAt && s.cancelledAt >= last30Start.toISOString(),
  ).length;

  const planBreakdown = Object.entries(tierCount)
    .map(([plan, count]) => ({
      plan,
      count,
      revenue: tierRevenue[plan] || 0,
      percent: subs.length > 0 ? Math.round((count * 100) / subs.length) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const PLAN_MONTHLY_TRY: Record<string, number> = { explorer: 49, pro: 99, agency: 299, free: 0 };
  const mrr = Object.entries(tierCount).reduce(
    (sum, [tier, count]) => sum + (PLAN_MONTHLY_TRY[tier] || 0) * count,
    0,
  );

  const totalUsers =
    (
      await scanAllRaw(ddb, {
        TableName: getTableName(),
        FilterExpression: "SK = :sk AND begins_with(PK, :pk)",
        ExpressionAttributeValues: { ":sk": { S: "META" }, ":pk": { S: "USER#" } },
        Select: "COUNT",
      })
    ).Count || 0;
  const paidUsers = subs.filter((s) => s.tier !== "free" && s.status === "active").length;
  const conversionRate =
    totalUsers > 0 ? Math.round(((paidUsers * 100) / totalUsers) * 10) / 10 : 0;

  return ok({
    subscriptions: {
      total: subs.length,
      active: activeCount,
      cancelled: cancelledCount,
      newLast30d: newSubscribers30d,
      churnLast30d: churnedLast30d,
      churnRate: activeCount > 0 ? Math.round(((churnedLast30d * 100) / activeCount) * 10) / 10 : 0,
      mrrTry: mrr,
      paidUsers,
      conversionRate,
      planBreakdown,
    },
  });
}
