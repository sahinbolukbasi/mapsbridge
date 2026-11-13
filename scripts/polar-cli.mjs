#!/usr/bin/env node
/**
 * Polar CLI & Multi-Market (TR / US / EU) Package & Checkout Link Sync Tool for MapsBridge
 * Automatically calculates unit/package cloud AI costs, syncs products & multi-currency prices
 * (TRY, USD, EUR), creates Polar Hosted Checkout Links, and updates env + AWS secret files.
 *
 * Usage:
 *   node scripts/polar-cli.mjs list
 *   node scripts/polar-cli.mjs costs
 *   node scripts/polar-cli.mjs sync
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

function loadDotEnv() {
  for (const rel of [".env", "apps/web/.env.local", "infra/lambda/.env"]) {
    const p = path.join(ROOT_DIR, rel);
    if (!fs.existsSync(p)) continue;
    const lines = fs.readFileSync(p, "utf8").split("\n");
    for (const line of lines) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
      }
    }
  }
}
loadDotEnv();

const POLAR_TOKEN = process.env.POLAR_ACCESS_TOKEN;
const POLAR_WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET || "";

if (
  !POLAR_TOKEN &&
  ["sync", "list", "create-all", "costs"].includes(process.argv[2] || "sync")
) {
  console.error(
    "❌ HATA: POLAR_ACCESS_TOKEN ortam değişkeni veya .env yapılandırması gerekli.",
  );
  process.exit(1);
}

const API_BASE = "https://api.polar.sh/v1";

const HEADERS = {
  Authorization: `Bearer ${POLAR_TOKEN}`,
  "Content-Type": "application/json",
};

// Birim Kredi Maliyet Modeli (AWS Bedrock 4-Tier + Places + OSRM + DynamoDB + Polar MoR Ücreti)
export const UNIT_COST_MODEL = {
  usdTryRate: 34.5,
  eurUsdRate: 1.08,
  aiChatCostUsd: 0.0022, // 1 kredi: Nova Micro / Haiku 4.5
  aiDeepTripCostUsd: 0.0145, // 5 kredi: 12 alt ajanlı derin rota (~$0.0029/kredi)
  blendedCloudCostPerCreditUsd: 0.0035, // RAG + Vector DB + 7/24 Ajan payı dahil güvenli birim maliyet
  polarFeePercent: 0.04, // %4 Polar MoR komisyonu
  polarFixedFeeUsd: 0.4, // $0.40 işlem başı sabit ücret
};

// 7 Resmi MapsBridge Paketi (Türkiye TRY • ABD USD • Avrupa EUR)
export const DEFAULT_PACKAGES = [
  // ─── Abonelikler (Monthly Subscriptions) ───────────────────────────────────
  {
    key: "POLAR_PRODUCT_EXPLORER",
    checkoutKey: "POLAR_CHECKOUT_EXPLORER",
    id: "explorer",
    mode: "subscription",
    name: "Kaşif (Explorer)",
    description:
      "Aylık 100 gezi kredisi (~20 derin AI rota veya 100 sohbet), akıllı rota optimizasyonu, çevrimdışı harita ve AI asistan desteği.",
    is_recurring: true,
    recurring_interval: "month",
    credits: 100,
    price_try_cents: 19900, // ₺199.00 (TR Pazarı)
    price_usd_cents: 699, // $6.99 (ABD Pazarı)
    price_eur_cents: 649, // €6.49 (Avrupa Pazarı)
  },
  {
    key: "POLAR_PRODUCT_PRO",
    checkoutKey: "POLAR_CHECKOUT_PRO",
    id: "pro",
    mode: "subscription",
    name: "Pro Kaşif (Pro Traveler)",
    description:
      "Aylık 500 gezi kredisi (~100 derin AI rota veya 500 sohbet), doğal dilde rota versiyonlama, öncelikli AI ve Google Maps aktarımı.",
    is_recurring: true,
    recurring_interval: "month",
    credits: 500,
    price_try_cents: 49900, // ₺499.00 (TR Pazarı)
    price_usd_cents: 1499, // $14.99 (ABD Pazarı)
    price_eur_cents: 1399, // €13.99 (Avrupa Pazarı)
  },
  {
    key: "POLAR_PRODUCT_AGENCY",
    checkoutKey: "POLAR_CHECKOUT_AGENCY",
    id: "agency",
    mode: "subscription",
    name: "Tur Lideri & Grup Paketi",
    description:
      "Aylık 2500 gezi kredisi (~500 derin AI rota), çoklu gün planlama, tur operatörü araçları ve ekip paylaşımı.",
    is_recurring: true,
    recurring_interval: "month",
    credits: 2500,
    price_try_cents: 149900, // ₺1,499.00 (TR Pazarı)
    price_usd_cents: 4999, // $49.99 (ABD Pazarı)
    price_eur_cents: 4599, // €45.99 (Avrupa Pazarı)
  },

  // ─── Kredi Paketleri (One-Time Credit Packs) ───────────────────────────────
  {
    key: "POLAR_PRODUCT_PACK_30",
    checkoutKey: "POLAR_CHECKOUT_PACK_30",
    id: "pack-30",
    mode: "credit_pack",
    name: "Başlangıç Kredi Paketi (30 Kredi)",
    description:
      "30 gezi kredisi (~6 derin AI rota). Süre sınırı yok, istediğiniz zaman dilediğiniz rotayı planlayın.",
    is_recurring: false,
    credits: 30,
    price_try_cents: 9900, // ₺99.00 (TR Pazarı)
    price_usd_cents: 299, // $2.99 (ABD Pazarı)
    price_eur_cents: 279, // €2.79 (Avrupa Pazarı)
  },
  {
    key: "POLAR_PRODUCT_PACK_100",
    checkoutKey: "POLAR_CHECKOUT_PACK_100",
    id: "pack-100",
    mode: "credit_pack",
    name: "Gezgin Kredi Paketi (100 Kredi)",
    description:
      "100 gezi kredisi (~20 derin AI rota). Popüler gezi paketi; süre sınırı olmadan kullanım.",
    is_recurring: false,
    credits: 100,
    price_try_cents: 24900, // ₺249.00 (TR Pazarı)
    price_usd_cents: 799, // $7.99 (ABD Pazarı)
    price_eur_cents: 749, // €7.49 (Avrupa Pazarı)
  },
  {
    key: "POLAR_PRODUCT_PACK_300",
    checkoutKey: "POLAR_CHECKOUT_PACK_300",
    id: "pack-300",
    mode: "credit_pack",
    name: "Usta Kaşif Paketi (300 Kredi)",
    description:
      "300 gezi kredisi (~60 derin AI rota). Uzun seyahatler ve çok şehirli tatiller için en avantajlı paket.",
    is_recurring: false,
    credits: 300,
    price_try_cents: 59900, // ₺599.00 (TR Pazarı)
    price_usd_cents: 1899, // $18.99 (ABD Pazarı)
    price_eur_cents: 1749, // €17.49 (Avrupa Pazarı)
  },
  {
    key: "POLAR_PRODUCT_PACK_PRO",
    checkoutKey: "POLAR_CHECKOUT_PACK_PRO",
    id: "pack-pro",
    mode: "credit_pack",
    name: "Stratejik Kaşif (3000 Kredi)",
    description:
      "3000 gezi kredisi (~600 derin AI rota). Yıllık gezginler, dijital göçebeler ve rehberler için dev kredi paketi.",
    is_recurring: false,
    credits: 3000,
    price_try_cents: 189900, // ₺1,899.00 (TR Pazarı)
    price_usd_cents: 5999, // $59.99 (ABD Pazarı)
    price_eur_cents: 5499, // €54.99 (Avrupa Pazarı)
  },
];

export function calculatePackageEconomics(pkg) {
  const cloudCostUsd = +(pkg.credits * UNIT_COST_MODEL.blendedCloudCostPerCreditUsd).toFixed(2);
  const priceUsd = pkg.price_usd_cents / 100;
  const priceEur = pkg.price_eur_cents / 100;
  const priceTry = pkg.price_try_cents / 100;

  const polarFeeUsd = +(priceUsd * UNIT_COST_MODEL.polarFeePercent + UNIT_COST_MODEL.polarFixedFeeUsd).toFixed(2);
  const totalCostUsd = +(cloudCostUsd + polarFeeUsd).toFixed(2);
  const totalCostTry = Math.round(totalCostUsd * UNIT_COST_MODEL.usdTryRate);

  const netUsd = +(priceUsd - totalCostUsd).toFixed(2);
  const marginUsdPct = Math.round((netUsd / priceUsd) * 100);
  const marginTryPct = Math.round(((priceTry - totalCostTry) / priceTry) * 100);

  return {
    id: pkg.id,
    name: pkg.name,
    credits: pkg.credits,
    cloudCostUsd: `$${cloudCostUsd.toFixed(2)}`,
    totalCostWithPolarUsd: `$${totalCostUsd.toFixed(2)} (~₺${totalCostTry})`,
    trPrice: `₺${priceTry}`,
    usPrice: `$${priceUsd.toFixed(2)}`,
    euPrice: `€${priceEur.toFixed(2)}`,
    marginTr: `%${marginTryPct}`,
    marginUsEu: `%${marginUsdPct}`,
  };
}

async function api(endpoint, method = "GET", body = null) {
  const url = `${API_BASE}${endpoint}`;
  const opts = { method, headers: HEADERS };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (res.status === 204) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      `[Polar API ${res.status}] ${json?.error || json?.detail?.[0]?.msg || JSON.stringify(json)}`,
    );
  }
  return json;
}

export async function getOrganization() {
  const orgs = await api("/organizations/");
  const org = orgs?.items?.[0];
  if (!org) throw new Error("Polar üzerinde aktif bir organizasyon bulunamadı.");
  return org;
}

export async function listProducts(orgId) {
  const res = await api(`/products/?organization_id=${orgId}&is_archived=false`);
  return res?.items || [];
}

export async function listCheckoutLinks(orgId) {
  const res = await api(`/checkout-links/?organization_id=${orgId}`);
  return res?.items || [];
}

export async function createOrUpdatePolarProduct(orgId, pkg, existingProduct) {
  const desiredPrices = [
    { currency: "usd", amount: pkg.price_usd_cents },
    { currency: "try", amount: pkg.price_try_cents },
    { currency: "eur", amount: pkg.price_eur_cents },
  ];

  if (!existingProduct) {
    const payload = {
      name: pkg.name,
      description: pkg.description,
      metadata: {
        mb_id: pkg.id,
        credits: pkg.credits,
        mode: pkg.mode,
        markets: "TR,US,EU",
      },
      prices: desiredPrices.map((p) => ({
        amount_type: "fixed",
        price_amount: p.amount,
        price_currency: p.currency,
      })),
      ...(pkg.is_recurring ? { recurring_interval: pkg.recurring_interval || "month" } : {}),
    };
    return await api("/products/", "POST", payload);
  }

  // Mevcut üründe eksik para birimi (ör. EUR) varsa veya metadata güncellenecekse PATCH uygula
  const currentPrices = existingProduct.prices || [];
  const nextPrices = [];

  for (const dp of desiredPrices) {
    const found = currentPrices.find(
      (cp) => cp.price_currency === dp.currency && cp.price_amount === dp.amount,
    );
    if (found) {
      nextPrices.push({ id: found.id });
    } else {
      nextPrices.push({
        amount_type: "fixed",
        price_amount: dp.amount,
        price_currency: dp.currency,
      });
    }
  }

  return await api(`/products/${existingProduct.id}`, "PATCH", {
    name: pkg.name,
    description: pkg.description,
    metadata: {
      mb_id: pkg.id,
      credits: pkg.credits,
      mode: pkg.mode,
      markets: "TR,US,EU",
    },
    prices: nextPrices,
  });
}

export async function ensureCheckoutLink(pkg, productId, existingLinks) {
  const match = existingLinks.find(
    (l) =>
      (Array.isArray(l.products) && l.products.some((p) => p.id === productId)) ||
      l.product_id === productId ||
      l.label === pkg.name,
  );
  if (match && match.url) return match;

  return await api("/checkout-links/", "POST", {
    payment_processor: "stripe",
    products: [productId],
    label: pkg.name,
    allow_discount_codes: true,
    metadata: {
      targetId: pkg.id,
      mode: pkg.mode,
      credits: pkg.credits,
    },
    success_url: "https://mapsbridge.com/checkout/?success=true&checkout_id={CHECKOUT_ID}",
  });
}

export async function syncAllProducts() {
  console.log("⚡ Polar API bağlantısı kuruluyor...");
  const org = await getOrganization();
  console.log(`✓ Organizasyon: ${org.name} (Slug: ${org.slug}, ID: ${org.id})`);

  console.log("\n📊 Paket Maliyet ve Pazar Analizi (Türkiye TRY • ABD USD • Avrupa EUR):");
  console.table(DEFAULT_PACKAGES.map(calculatePackageEconomics));

  const existing = await listProducts(org.id);
  const existingLinks = await listCheckoutLinks(org.id);

  // Bozuk/test ürünü ("Maps Bridge" 0 TRY / NaN) varsa arşivle
  for (const prod of existing) {
    if (
      prod.name === "Maps Bridge" &&
      !DEFAULT_PACKAGES.some((p) => p.name.toLowerCase() === prod.name.toLowerCase())
    ) {
      try {
        await api(`/products/${prod.id}`, "PATCH", { is_archived: true });
        console.log(`✓ Eski test ürünü arşivlendi: ${prod.name} (${prod.id})`);
      } catch {}
    }
  }

  const productMap = {};
  const checkoutLinkMap = {};

  for (const pkg of DEFAULT_PACKAGES) {
    const match = existing.find(
      (p) =>
        p.name.toLowerCase() === pkg.name.toLowerCase() ||
        (p.metadata && p.metadata.mb_id === pkg.id),
    );

    const synced = await createOrUpdatePolarProduct(org.id, pkg, match);
    productMap[pkg.key] = synced.id;
    console.log(
      `✓ Ürün Hazır: ${pkg.name} -> ID: ${synced.id} [TRY: ₺${pkg.price_try_cents / 100}, USD: $${pkg.price_usd_cents / 100}, EUR: €${pkg.price_eur_cents / 100}]`,
    );

    const link = await ensureCheckoutLink(pkg, synced.id, existingLinks);
    checkoutLinkMap[pkg.checkoutKey] = link.url;
    console.log(`  ↳ Checkout Bağlantısı: ${link.url}`);
  }

  updateEnvAndSecretFiles(productMap, checkoutLinkMap, org.id);
  return { productMap, checkoutLinkMap };
}

function updateEnvAndSecretFiles(productMap, checkoutLinkMap, orgId) {
  const secretJson = {
    POLAR_ACCESS_TOKEN: POLAR_TOKEN,
    POLAR_WEBHOOK_SECRET: POLAR_WEBHOOK_SECRET,
    POLAR_ENVIRONMENT: "production",
    POLAR_ORGANIZATION_ID: orgId,
    ...productMap,
    ...checkoutLinkMap,
  };

  const secretDir = path.join(ROOT_DIR, "infra/secrets");
  fs.mkdirSync(secretDir, { recursive: true });
  fs.writeFileSync(
    path.join(secretDir, "polar.json"),
    JSON.stringify(secretJson, null, 2) + "\n",
    "utf8",
  );
  console.log(`✓ Güncellendi: infra/secrets/polar.json`);

  const envContent = [
    `# Polar Ödeme Entegrasyonu (TR / US / EU Çoklu Pazar)`,
    `POLAR_ACCESS_TOKEN=${POLAR_TOKEN}`,
    `POLAR_WEBHOOK_SECRET=${POLAR_WEBHOOK_SECRET}`,
    `POLAR_ENVIRONMENT=production`,
    `POLAR_ORGANIZATION_ID=${orgId}`,
    ...Object.entries(productMap).map(([k, v]) => `${k}=${v}`),
    ...Object.entries(checkoutLinkMap).map(([k, v]) => `${k}=${v}`),
  ].join("\n");

  const targets = [
    path.join(ROOT_DIR, "apps/web/.env.local"),
    path.join(ROOT_DIR, "infra/lambda/.env"),
    path.join(ROOT_DIR, ".env"),
  ];

  targets.forEach((filePath) => {
    try {
      let existing = "";
      if (fs.existsSync(filePath)) {
        existing = fs.readFileSync(filePath, "utf8");
      }
      const cleaned = existing
        .split("\n")
        .filter((l) => !l.startsWith("POLAR_") && !l.startsWith("# Polar Ödeme Entegrasyonu"))
        .join("\n")
        .trim();

      const next = `${cleaned}\n\n${envContent}\n`;
      fs.writeFileSync(filePath, next, "utf8");
      console.log(`✓ Güncellendi: ${path.relative(ROOT_DIR, filePath)}`);
    } catch (e) {
      console.warn(`! Dosya güncellenemedi (${filePath}):`, e.message);
    }
  });
}

const cmd = process.argv[2] || "sync";

if (cmd === "costs") {
  console.log("\n📊 MapsBridge Paket Maliyet ve Bölgesel Fiyatlandırma Tablosu (TR • US • EU):");
  console.table(DEFAULT_PACKAGES.map(calculatePackageEconomics));
} else if (cmd === "list") {
  getOrganization()
    .then(async (org) => {
      console.log(`Organizasyon: ${org.name} (${org.slug})`);
      const prods = await listProducts(org.id);
      console.table(
        prods.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.is_recurring ? "Subscription" : "One-Time",
          prices: p.prices
            ?.map((pr) => `${pr.price_amount / 100} ${pr.price_currency?.toUpperCase()}`)
            .join(", "),
        })),
      );
    })
    .catch(console.error);
} else if (cmd === "sync" || cmd === "create-all") {
  syncAllProducts()
    .then(() => {
      console.log("\n🎉 Tüm Polar paketleri (TR, US, EU) ve Checkout bağlantıları senkronize edildi!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n❌ Senkronizasyon hatası:", err);
      process.exit(1);
    });
}
