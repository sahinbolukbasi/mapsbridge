import type { ApiGatewayEvent } from "../shared/http";
import { ok, badRequest, parseBody } from "../shared/http";
import { get, commit, scan, getTableName, scanAllRaw } from "./management";
import { paymentRecords } from "./users";

export async function handleFinance() {
  const payments = await paymentRecords();

  const totalRevenue = payments
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const failedCount = payments.filter((p) => p.status === "failed").length;

  const monthly: Record<string, number> = {};
  for (const p of payments) {
    if (p.status === "succeeded" && p.createdAt) {
      const month = p.createdAt.slice(0, 7);
      monthly[month] = (monthly[month] || 0) + (p.amount || 0);
    }
  }

  return ok({
    finance: {
      totalRevenueTRY: totalRevenue / 100,
      totalTransactions: payments.length,
      failedTransactions: failedCount,
      monthlyRevenue: Object.entries(monthly).map(([month, amount]) => ({
        month,
        amount: amount / 100,
      })),
      currency: "TRY",
    },
  });
}

export async function handleGetCreditStats() {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { unmarshall } = await import("@aws-sdk/util-dynamodb");
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION });

  const walletResult = await scanAllRaw(ddb, {
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk) AND SK = :sk",
    ExpressionAttributeValues: { ":pk": { S: "USER#" }, ":sk": { S: "CREDITS" } },
  });
  const wallets = walletResult.Items.map((item: any) => unmarshall(item));

  const subResult = await scanAllRaw(ddb, {
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk) AND SK = :sk",
    ExpressionAttributeValues: { ":pk": { S: "USER#" }, ":sk": { S: "SUBSCRIPTION" } },
  });
  const subs = new Map(
    subResult.Items.map((item: any) => {
      const r = unmarshall(item);
      return [r.PK, r];
    }),
  );

  const usageResult = await scanAllRaw(ddb, {
    TableName: getTableName(),
    FilterExpression: "begins_with(PK, :pk) AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": { S: "USER#" }, ":sk": { S: "AI#" } },
  });
  const usageRows = usageResult.Items.map((item: any) => unmarshall(item));

  let totalGranted = 0;
  let totalConsumed = 0;
  let totalRemaining = 0;
  const activeWallets = wallets.filter((w) => (w.credits || 0) > 0).length;

  for (const w of wallets) {
    totalRemaining += w.credits || 0;
  }

  const byModule = { ai_chat: 0, ai_deep_trip: 0, ai_stay_dining: 0, route_optimize: 0 };
  for (const u of usageRows) {
    const cost = u.cost || 0;
    totalConsumed += cost;
    const kind = (u.SK || "").toLowerCase();
    if (kind.includes("deep") || kind.includes("trip")) byModule.ai_deep_trip += cost;
    else if (kind.includes("stay") || kind.includes("dining")) byModule.ai_stay_dining += cost;
    else if (kind.includes("route") || kind.includes("optim")) byModule.route_optimize += cost;
    else byModule.ai_chat += cost;
  }
  totalGranted = totalRemaining + totalConsumed;

  const tierCounts: Record<string, { count: number; totalCredits: number }> = {};
  for (const w of wallets) {
    const userId = w.PK;
    const sub = subs.get(userId);
    const tier = sub?.tier || "free";
    if (!tierCounts[tier]) tierCounts[tier] = { count: 0, totalCredits: 0 };
    tierCounts[tier].count++;
    tierCounts[tier].totalCredits += w.credits || 0;
  }

  const planDistribution = Object.entries(tierCounts).map(([tier, data]) => ({
    tier,
    userCount: data.count,
    avgCredits: data.count > 0 ? Math.round(data.totalCredits / data.count) : 0,
  }));

  const topConsumers = wallets
    .map((w) => {
      const userId = w.PK?.replace(/^USER#/, "") || "";
      const sub = subs.get(w.PK);
      const consumed = usageRows
        .filter((u) => u.PK === w.PK)
        .reduce((sum, u) => sum + (u.cost || 0), 0);
      return { userId, email: w.email, tier: sub?.tier || "free", consumed };
    })
    .filter((c) => c.consumed > 0)
    .sort((a, b) => b.consumed - a.consumed)
    .slice(0, 20);

  const now30 = new Date();
  const dailyMap: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now30);
    d.setDate(d.getDate() - i);
    dailyMap[d.toISOString().slice(0, 10)] = 0;
  }
  for (const u of usageRows) {
    const day = (u.createdAt || u.SK || "").slice(0, 10);
    if (day in dailyMap) dailyMap[day] += u.cost || 0;
  }
  const dailyConsumption = Object.entries(dailyMap).map(([date, credits]) => ({
    date,
    credits: Math.round(credits * 100) / 100,
  }));

  return ok({
    stats: {
      totalCreditsGranted: totalGranted,
      totalCreditsConsumed: totalConsumed,
      totalCreditsRemaining: totalRemaining,
      activeWallets,
      averageBalancePerUser:
        wallets.length > 0 ? Math.round((totalRemaining / wallets.length) * 10) / 10 : 0,
      byModule,
      dailyConsumption,
      planDistribution,
      topConsumers,
    },
  });
}

export async function handleGetStripeConfig() {
  const config = await get("STRIPE#CONFIG");
  const envConnected = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY);
  const envMode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")
    ? "live"
    : process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")
      ? "test"
      : "unconfigured";

  const stripe = {
    connected: config ? !!(config.publishableKey && config.secretKeyHash) : envConnected,
    mode: config?.mode || (envConnected ? envMode : "unconfigured"),
    publishableKey: config?.publishableKey || process.env.STRIPE_PUBLISHABLE_KEY || "",
    webhookConfigured: config ? !!config.webhookSecret : !!process.env.STRIPE_WEBHOOK_SECRET,
    webhookUrl: config?.webhookUrl || "https://api.mapsbridge.com/stripe/webhook",
    lastWebhookAt: config?.lastWebhookAt,
    supportedCurrencies: config?.supportedCurrencies || ["try"],
    defaultCurrency: config?.defaultCurrency || "try",
    taxEnabled: config?.taxEnabled || false,
    version: config?.version || 0,
    updatedAt: config?.updatedAt,
    updatedBy: config?.updatedBy,
  };
  return ok({ stripe });
}

export async function handleUpdateStripeConfig(event: ApiGatewayEvent) {
  const body = parseBody<Record<string, any>>(event);
  if (!body) return badRequest("Geçerli yapılandırma verisi gerekli.");
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason || reason.length > 1000)
    return badRequest("Gerekçe zorunludur (en fazla 1000 karakter).");

  const previous = await get("STRIPE#CONFIG");
  let mode = body.mode || previous?.mode || "unconfigured";
  if (body.publishableKey)
    mode = body.publishableKey.startsWith("pk_live_")
      ? "live"
      : body.publishableKey.startsWith("pk_test_")
        ? "test"
        : mode;

  const next: Record<string, any> = {
    PK: "STRIPE#CONFIG",
    SK: "META",
    ...(previous || {}),
    mode,
    defaultCurrency: body.defaultCurrency || previous?.defaultCurrency || "try",
    taxEnabled: body.taxEnabled !== undefined ? !!body.taxEnabled : previous?.taxEnabled || false,
    webhookUrl:
      body.webhookUrl || previous?.webhookUrl || "https://api.mapsbridge.com/stripe/webhook",
    supportedCurrencies: previous?.supportedCurrencies || ["try"],
  };
  if (body.publishableKey) next.publishableKey = body.publishableKey;
  if (body.secretKey) next.secretKeyHash = `configured:${Date.now()}`;
  if (body.webhookSecret) next.webhookSecret = `configured:${Date.now()}`;

  const saved = (await commit(event, next, "stripe_config_updated", reason, previous)) as Record<
    string,
    any
  >;
  return ok({
    status: "updated",
    stripe: {
      connected: !!(saved.publishableKey && saved.secretKeyHash),
      mode: saved.mode,
      publishableKey: saved.publishableKey,
      webhookConfigured: !!saved.webhookSecret,
      webhookUrl: saved.webhookUrl,
      supportedCurrencies: saved.supportedCurrencies || ["try"],
      defaultCurrency: saved.defaultCurrency,
      taxEnabled: saved.taxEnabled,
      version: saved.version,
      updatedAt: saved.updatedAt,
      updatedBy: saved.updatedBy,
    },
  });
}

const DEFAULT_PLANS = [
  {
    id: "free",
    name: "Gezgin",
    tagline: "Temel seyahat planlama",
    badge: "ÜCRETSİZ",
    monthlyPriceTry: 0,
    yearlyPriceTry: 0,
    monthlyCredits: 10,
    color: "#64748b",
    highlight: false,
    enabled: true,
  },
  {
    id: "explorer",
    name: "Kaşif",
    tagline: "Aktif seyahat planlamacılar için",
    badge: "KAŞİF",
    monthlyPriceTry: 14900,
    yearlyPriceTry: 9900,
    monthlyCredits: 100,
    color: "#0d9488",
    highlight: false,
    enabled: true,
  },
  {
    id: "pro",
    name: "Pro Kaşif",
    tagline: "Sık seyahat edenler için",
    badge: "PRO",
    monthlyPriceTry: 29900,
    yearlyPriceTry: 24900,
    monthlyCredits: 300,
    color: "#7c3aed",
    highlight: true,
    enabled: true,
  },
  {
    id: "agency",
    name: "Tur Lideri",
    tagline: "Tur operatörleri ve profesyoneller",
    badge: "LİDER",
    monthlyPriceTry: 79900,
    yearlyPriceTry: 64900,
    monthlyCredits: 1000,
    color: "#c2410c",
    highlight: false,
    enabled: true,
  },
];

const DEFAULT_CREDIT_PACKS = [
  {
    id: "starter",
    title: "Başlangıç Paketi",
    description: "Seyahat planlamaya başlamak için",
    credits: 50,
    bonusCredits: 0,
    priceTry: 4900,
    unitPriceTry: 98,
    popular: false,
    enabled: true,
  },
  {
    id: "explorer",
    title: "Kaşif Paketi",
    description: "Aktif seyahat planlamacılar için",
    credits: 150,
    bonusCredits: 15,
    priceTry: 12900,
    unitPriceTry: 86,
    popular: true,
    enabled: true,
  },
  {
    id: "pro",
    title: "Pro Paket",
    description: "En iyi değer — sık seyahat edenler için",
    credits: 400,
    bonusCredits: 60,
    priceTry: 29900,
    unitPriceTry: 74,
    popular: false,
    enabled: true,
  },
];

export async function handleGetPlans() {
  const rows = await scan("begins_with(PK, :pk) AND SK = :sk", { ":pk": "PLAN#", ":sk": "META" });
  const subRows = await scan("begins_with(PK, :pk) AND SK = :sk", {
    ":pk": "USER#",
    ":sk": "SUBSCRIPTION",
  });
  const tierCounts: Record<string, number> = {};
  for (const sub of subRows) {
    if (sub.status === "active" && sub.tier) tierCounts[sub.tier] = (tierCounts[sub.tier] || 0) + 1;
  }

  const plans =
    rows.length > 0
      ? rows.map((r) => ({
          ...r,
          id: r.planId || r.id || r.PK?.replace(/^PLAN#/, ""),
          activeSubscribers: tierCounts[r.planId || r.id] || 0,
        }))
      : DEFAULT_PLANS.map((p) => ({
          ...p,
          activeSubscribers: tierCounts[p.id] || 0,
          stripePriceIdMonthly: "",
          stripePriceIdYearly: "",
        }));

  return ok({ plans });
}

export async function handleUpdatePlan(event: ApiGatewayEvent) {
  const planId = event.pathParameters?.id;
  if (!planId) return badRequest("Plan ID gerekli.");

  const body = parseBody<Record<string, any>>(event);
  if (!body) return badRequest("Geçerli plan verisi gerekli.");
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason || reason.length > 1000) return badRequest("Gerekçe zorunludur.");

  const previous = await get(`PLAN#${planId}`);
  const defaults: Record<string, any> = DEFAULT_PLANS.find((p) => p.id === planId) || {
    monthlyPriceTry: 0,
    yearlyPriceTry: 0,
    monthlyCredits: 0,
    color: "#64748b",
    highlight: false,
  };

  const next: Record<string, any> = {
    PK: `PLAN#${planId}`,
    SK: "META",
    planId,
    id: planId,
    name: body.name || previous?.name || defaults.id,
    tagline: body.tagline !== undefined ? body.tagline : previous?.tagline || "",
    badge: body.badge || previous?.badge || planId.toUpperCase(),
    monthlyPriceTry: Number(
      body.monthlyPriceTry ?? previous?.monthlyPriceTry ?? defaults.monthlyPriceTry,
    ),
    yearlyPriceTry: Number(
      body.yearlyPriceTry ?? previous?.yearlyPriceTry ?? defaults.yearlyPriceTry,
    ),
    monthlyCredits: Number(
      body.monthlyCredits ?? previous?.monthlyCredits ?? defaults.monthlyCredits,
    ),
    color: previous?.color || defaults.color,
    highlight: previous?.highlight ?? defaults.highlight,
    enabled: body.enabled !== undefined ? !!body.enabled : previous?.enabled !== false,
    stripePriceIdMonthly:
      body.stripePriceIdMonthly !== undefined
        ? body.stripePriceIdMonthly
        : previous?.stripePriceIdMonthly || "",
    stripePriceIdYearly:
      body.stripePriceIdYearly !== undefined
        ? body.stripePriceIdYearly
        : previous?.stripePriceIdYearly || "",
  };

  const saved = (await commit(
    event,
    next,
    "plan_updated",
    reason,
    previous ? { ...previous } : null,
  )) as Record<string, any>;
  return ok({ status: "updated", plan: saved });
}

export async function handleGetCreditPacks() {
  const rows = await scan("begins_with(PK, :pk) AND SK = :sk", {
    ":pk": "CREDITPACK#",
    ":sk": "META",
  });
  const paymentRows = await scan("begins_with(PK, :pk) AND SK = :sk", {
    ":pk": "PAYMENT#",
    ":sk": "META",
  });
  const packCounts: Record<string, number> = {};
  for (const p of paymentRows) {
    if (p.packId && p.status === "succeeded")
      packCounts[p.packId] = (packCounts[p.packId] || 0) + 1;
  }

  const packs =
    rows.length > 0
      ? rows.map((r) => {
          const id = r.packId || r.id || r.PK?.replace(/^CREDITPACK#/, "");
          const credits = r.credits || 0;
          const priceTry = r.priceTry || 0;
          return {
            ...r,
            id,
            totalPurchases: packCounts[id] || r.totalPurchases || 0,
            unitPriceTry: credits > 0 ? Math.round(priceTry / credits) : 0,
          };
        })
      : DEFAULT_CREDIT_PACKS.map((p) => ({
          ...p,
          totalPurchases: packCounts[p.id] || 0,
          stripeProductId: "",
        }));

  return ok({ packs });
}

export async function handleUpdateCreditPack(event: ApiGatewayEvent) {
  const packId = event.pathParameters?.id;
  if (!packId) return badRequest("Paket ID gerekli.");

  const body = parseBody<Record<string, any>>(event);
  if (!body) return badRequest("Geçerli paket verisi gerekli.");
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason || reason.length > 1000) return badRequest("Gerekçe zorunludur.");

  const previous = await get(`CREDITPACK#${packId}`);
  const defaults: Record<string, any> = DEFAULT_CREDIT_PACKS.find((p) => p.id === packId) || {
    credits: 0,
    bonusCredits: 0,
    priceTry: 0,
    popular: false,
  };

  const credits = Number(body.credits ?? previous?.credits ?? defaults.credits);
  const priceTry = Number(body.priceTry ?? previous?.priceTry ?? defaults.priceTry);

  const next: Record<string, any> = {
    PK: `CREDITPACK#${packId}`,
    SK: "META",
    packId,
    id: packId,
    title: body.title || previous?.title || packId,
    description: body.description !== undefined ? body.description : previous?.description || "",
    credits,
    bonusCredits: Number(body.bonusCredits ?? previous?.bonusCredits ?? defaults.bonusCredits),
    priceTry,
    unitPriceTry: credits > 0 ? Math.round(priceTry / credits) : 0,
    popular: body.popular !== undefined ? !!body.popular : (previous?.popular ?? defaults.popular),
    enabled: body.enabled !== undefined ? !!body.enabled : previous?.enabled !== false,
    stripeProductId:
      body.stripeProductId !== undefined ? body.stripeProductId : previous?.stripeProductId || "",
  };

  const saved = (await commit(
    event,
    next,
    "creditpack_updated",
    reason,
    previous ? { ...previous } : null,
  )) as Record<string, any>;
  return ok({
    status: "updated",
    pack: { ...saved, totalPurchases: previous?.totalPurchases || 0 },
  });
}
