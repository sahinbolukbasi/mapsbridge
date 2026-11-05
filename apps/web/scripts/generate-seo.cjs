#!/usr/bin/env node
// SEO üretici: public/sitemap.xml + public/robots.txt
// ---------------------------------------------------
// Statik export uyumlu (app/sitemap.ts yerine deterministik build script — GSC tasarım kararı).
// prebuild'de çalışır; sürümden bağımsız, özel Next.js doküman teyidi gerektirmez.
//
// Kurallar:
//  - Yalnızca PUBLIC + INDEKSLENEBİLİR + KANONİK sayfalar sitemap'e girer.
//  - noindex/auth sayfaları (ai, desk, login, messages, profile, register, reset-password,
//    verify, admin, checkout, auth) HARİÇ.
//  - Çift-URL'lerin yalnız KANONİK İngilizce versiyonu girer (haritalar/harita/desk→maps değil;
//    gezi-asistani/ai-asistan→travel-assistant; mobil-uygulamalar→mobile-apps; sifre-sifirla→(noindex)).
//  - Ana sayfa: Googlebot çerezsiz '/'yi 302 ile /en/'e attığından sitemap birincili /en/ (200 dönen).

const fs = require("fs");
const path = require("path");

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://mapsbridge.com";
const origin = SITE.replace(/\/$/, "");

// Kanonik public sayfalar (trailing-slash'lı; trailingSlash:true ile uyumlu).
// priority: ana sayfa 1.0, ana özellikler 0.8, yasal/bilgi 0.5
const PAGES = [
  { path: "/en/", priority: "1.0", changefreq: "daily" }, // ana sayfa kanonik (bkz yukarı)
  { path: "/maps/", priority: "0.8", changefreq: "weekly" },
  { path: "/travel-assistant/", priority: "0.8", changefreq: "weekly" },
  { path: "/mobile-apps/", priority: "0.7", changefreq: "monthly" },
  { path: "/pricing/", priority: "0.7", changefreq: "monthly" },
  { path: "/community/", priority: "0.7", changefreq: "weekly" },
  { path: "/how-it-works/", priority: "0.6", changefreq: "monthly" },
  { path: "/support/", priority: "0.5", changefreq: "monthly" },
  { path: "/about/", priority: "0.5", changefreq: "monthly" },
  { path: "/contact/", priority: "0.5", changefreq: "monthly" },
  { path: "/privacy/", priority: "0.3", changefreq: "yearly" },
  { path: "/terms/", priority: "0.3", changefreq: "yearly" },
  { path: "/cookies/", priority: "0.3", changefreq: "yearly" },
];

// Disallow edilen path'ler (noindex/auth/özel). robots.txt'e girer.
const DISALLOW = [
  "/ai/",
  "/desk/",
  "/messages/",
  "/profile/",
  "/login/",
  "/register/",
  "/verify/",
  "/reset-password/",
  "/forgot-password/",
  "/sifre-sifirla/",
  "/admin/",
  "/u/admin/",
  "/checkout/",
  "/auth/callback/",
];

const today = new Date().toISOString().slice(0, 10);

const urls = PAGES.map(
  (p) =>
    `  <url>\n    <loc>${origin}${p.path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`,
).join("\n");

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

const robots = `# MapsBridge robots.txt — generate-seo.cjs tarafından üretildi
User-agent: *
Allow: /
${DISALLOW.map((d) => `Disallow: ${d}`).join("\n")}

Sitemap: ${origin}/sitemap.xml
`;

const publicDir = path.resolve(__dirname, "../public");
fs.writeFileSync(path.join(publicDir, "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(publicDir, "robots.txt"), robots);

console.log(
  `[generate-seo] sitemap.xml (${PAGES.length} URL) + robots.txt üretildi → ${publicDir}`,
);
console.log(`[generate-seo] origin: ${origin}`);
