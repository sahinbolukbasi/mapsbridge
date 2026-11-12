#!/usr/bin/env node
/**
 * Polar CLI & AI Package Sync Tool for MapsBridge
 * Automatically creates, manages, and syncs products on Polar (polar.sh)
 *
 * Usage:
 *   node scripts/polar-cli.mjs list
 *   node scripts/polar-cli.mjs sync
 *   node scripts/polar-cli.mjs create-all
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

const POLAR_TOKEN = process.env.POLAR_ACCESS_TOKEN;
const POLAR_WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET;

if (!POLAR_TOKEN && (process.argv[2] === "sync" || process.argv[2] === "list" || process.argv[2] === "create-all")) {
  console.error("❌ HATA: POLAR_ACCESS_TOKEN ortam değişkeni veya AWS Secrets Manager yapılandırması gerekli.");
  process.exit(1);
}

const API_BASE = "https://api.polar.sh/v1";

const HEADERS = {
  Authorization: `Bearer ${POLAR_TOKEN}`,
  "Content-Type": "application/json",
};

// 7 Temel MapsBridge Paketi
export const DEFAULT_PACKAGES = [
  // ─── Abonelikler (Monthly Subscriptions) ───────────────────────────────────
  {
    key: "POLAR_PRODUCT_EXPLORER",
    id: "explorer",
    name: "Kaşif (Explorer)",
    description: "Aylık 100 gezi kredisi, akıllı rota optimizasyonu, çevrimdışı harita ve AI asistan desteği.",
    is_recurring: true,
    recurring_interval: "month",
    credits: 100,
    price_usd_cents: 699, // $6.99
    price_try_cents: 19900, // 199 TL
  },
  {
    key: "POLAR_PRODUCT_PRO",
    id: "pro",
    name: "Pro Kaşif (Pro Traveler)",
    description: "Aylık 500 gezi kredisi, sınırsız durak optimizasyonu, öncelikli AI ve rota dışa aktarma.",
    is_recurring: true,
    recurring_interval: "month",
    credits: 500,
    price_usd_cents: 1499, // $14.99
    price_try_cents: 49900, // 499 TL
  },
  {
    key: "POLAR_PRODUCT_AGENCY",
    id: "agency",
    name: "Tur Lideri & Grup Paketi",
    description: "Aylık 2500 gezi kredisi, çoklu gün planlama, tur operatörü araçları ve ekip paylaşımı.",
    is_recurring: true,
    recurring_interval: "month",
    credits: 2500,
    price_usd_cents: 4999, // $49.99
    price_try_cents: 149900, // 1499 TL
  },

  // ─── Kredi Paketleri (One-Time Credit Packs) ───────────────────────────────
  {
    key: "POLAR_PRODUCT_PACK_30",
    id: "pack-30",
    name: "Başlangıç Kredi Paketi (30 Kredi)",
    description: "30 gezi kredisi. Süre sınırı yok, istediğiniz zaman dilediğiniz rotayı planlayın.",
    is_recurring: false,
    credits: 30,
    price_usd_cents: 299, // $2.99
    price_try_cents: 9900, // 99 TL
  },
  {
    key: "POLAR_PRODUCT_PACK_100",
    id: "pack-100",
    name: "Gezgin Kredi Paketi (100 Kredi)",
    description: "100 gezi kredisi. Popüler gezi paketi; yaklaşık 20 detaylı rota planlama imkanı.",
    is_recurring: false,
    credits: 100,
    price_usd_cents: 799, // $7.99
    price_try_cents: 24900, // 249 TL
  },
  {
    key: "POLAR_PRODUCT_PACK_300",
    id: "pack-300",
    name: "Usta Kaşif Paketi (300 Kredi)",
    description: "300 gezi kredisi. Uzun seyahatler ve çok şehirli tatiller için en avantajlı kredi paketi.",
    is_recurring: false,
    credits: 300,
    price_usd_cents: 1899, // $18.99
    price_try_cents: 59900, // 599 TL
  },
  {
    key: "POLAR_PRODUCT_PACK_PRO",
    id: "pack-pro",
    name: "Stratejik Kaşif (3000 Kredi)",
    description: "3000 gezi kredisi. Yıllık gezginler, dijital göçebeler ve rehberler için dev kredi paketi.",
    is_recurring: false,
    credits: 3000,
    price_usd_cents: 5999, // $59.99
    price_try_cents: 189900, // 1899 TL
  },
];

async function api(endpoint, method = "GET", body = null) {
  const url = `${API_BASE}${endpoint}`;
  const opts = { method, headers: HEADERS };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (res.status === 204) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`[Polar API ${res.status}] ${json?.error || json?.detail?.[0]?.msg || JSON.stringify(json)}`);
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
  const res = await api(`/products/?organization_id=${orgId}`);
  return res?.items || [];
}

export async function createPolarProduct(orgId, pkg) {
  const payload = {
    name: pkg.name,
    description: pkg.description,
    prices: [
      {
        amount_type: "fixed",
        price_amount: pkg.price_usd_cents,
        price_currency: "usd",
      },
      {
        amount_type: "fixed",
        price_amount: pkg.price_try_cents,
        price_currency: "try",
      },
    ],
  };

  if (pkg.is_recurring) {
    payload.recurring_interval = pkg.recurring_interval || "month";
  }

  const created = await api("/products/", "POST", payload);
  return created;
}

export async function syncAllProducts() {
  console.log("⚡ Polar API bağlantısı kuruluyor...");
  const org = await getOrganization();
  console.log(`✓ Organizasyon: ${org.name} (Slug: ${org.slug}, ID: ${org.id})`);

  const existing = await listProducts(org.id);
  console.log(`ℹ Mevcut ürün sayısı: ${existing.length}`);

  const productMap = {};

  for (const pkg of DEFAULT_PACKAGES) {
    // Mevcut ürün var mı kontrol et (ad veya slug üzerinden)
    const match = existing.find(
      (p) =>
        p.name.toLowerCase() === pkg.name.toLowerCase() ||
        (p.metadata && p.metadata.mb_id === pkg.id)
    );

    if (match) {
      console.log(`✓ Zaten mevcut: ${pkg.name} -> ID: ${match.id}`);
      productMap[pkg.key] = match.id;
    } else {
      process.stdout.write(`+ Oluşturuluyor: ${pkg.name}... `);
      try {
        const created = await createPolarProduct(org.id, pkg);
        console.log(`TAMAM! -> ID: ${created.id}`);
        productMap[pkg.key] = created.id;
      } catch (err) {
        console.log(`HATA: ${err.message}`);
      }
    }
  }

  console.log("\n📦 Ortam Değişkenleri (.env):");
  const envLines = [
    `POLAR_ACCESS_TOKEN=${POLAR_TOKEN}`,
    `POLAR_WEBHOOK_SECRET=${POLAR_WEBHOOK_SECRET}`,
    `POLAR_ENVIRONMENT=production`,
    `POLAR_ORGANIZATION_ID=${org.id}`,
    ...Object.entries(productMap).map(([k, v]) => `${k}=${v}`),
  ];

  console.log(envLines.join("\n"));

  // .env dosyalarını güncelle
  updateEnvFiles(productMap, org.id);

  return productMap;
}

function updateEnvFiles(productMap, orgId) {
  const envContent = [
    `# Polar Ödeme Entegrasyonu`,
    `POLAR_ACCESS_TOKEN=${POLAR_TOKEN}`,
    `POLAR_WEBHOOK_SECRET=${POLAR_WEBHOOK_SECRET}`,
    `POLAR_ENVIRONMENT=production`,
    `POLAR_ORGANIZATION_ID=${orgId}`,
    ...Object.entries(productMap).map(([k, v]) => `${k}=${v}`),
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
      // Eski polar satırlarını ayıkla ve yenilerini ekle
      const cleaned = existing
        .split("\n")
        .filter((l) => !l.startsWith("POLAR_"))
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

// CLI Komut Yürütücü
const cmd = process.argv[2] || "sync";

if (cmd === "list") {
  getOrganization().then(async (org) => {
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
      }))
    );
  }).catch(console.error);
} else if (cmd === "sync" || cmd === "create-all") {
  syncAllProducts()
    .then(() => {
      console.log("\n🎉 Tüm Polar paketleri başarıyla oluşturuldu ve senkronize edildi!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n❌ Senkronizasyon hatası:", err);
      process.exit(1);
    });
} else {
  console.log(`Kullanım:
  node scripts/polar-cli.mjs sync      - Tüm paketleri Polar üzerinde oluşturur ve .env'leri günceller
  node scripts/polar-cli.mjs list      - Polar'daki mevcut ürünleri listeler
`);
}
