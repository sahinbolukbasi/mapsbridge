import type { Metadata } from "next";
import { getAlternatePath, type AppLocale } from "./locale-utils";
import { CANONICAL_ROUTES, localeOfPath, normalizePath, type RoutePath } from "./route-registry";
const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
export const siteOrigin = configuredOrigin ? new URL(configuredOrigin).origin : undefined;
export function publicMetadata(
  title: string,
  description: string | undefined,
  path: string,
  locale: AppLocale = "tr",
): Metadata {
  const url = siteOrigin ? new URL(path, siteOrigin).href : undefined;
  const fullTitle = title.includes("MapsBridge") ? title : `${title} | MapsBridge`;
  const altPath = getAlternatePath(path);
  // Tek dilli sayfa (alternatif = kendisi): yalnızca sayfanın dili ve x-default = sayfa
  // (design §5.5; "en sürümü burada" diye yanlış hreflang yazılmaz).
  const monolingual = normalizePath(altPath) === normalizePath(path);
  const languages = !siteOrigin
    ? undefined
    : monolingual
      ? { [locale]: new URL(path, siteOrigin).href, "x-default": new URL(path, siteOrigin).href }
      : {
          tr: new URL(locale === "tr" ? path : altPath, siteOrigin).href,
          en: new URL(locale === "en" ? path : altPath, siteOrigin).href,
          "x-default": new URL("/en/", siteOrigin).href,
        };
  return {
    title: fullTitle,
    description,
    alternates: { canonical: url, languages },
    openGraph: {
      title: fullTitle,
      description,
      url,
      type: "website",
      locale: locale === "tr" ? "tr_TR" : "en_US",
      alternateLocale: monolingual ? [] : locale === "tr" ? ["en_US"] : ["tr_TR"],
      siteName: "MapsBridge",
      images: [
        {
          url: "/og-default.png",
          width: 1200,
          height: 630,
          alt: "MapsBridge",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: ["/og-default.png"],
    },
  };
}
/**
 * Route registry kaydından metadata (design §4.2, §5.5): self-canonical, registry başlığı ve
 * açıklaması, tek dilli hreflang kuralı. Kayıt yoksa ya da sitemap:true kayıtta description
 * yoksa build-time `throw` (ölümcül). Locale path'ten türetilir (/en/ öneki → en).
 */
export function routeMetadata(path: RoutePath): Metadata {
  const p = normalizePath(path);
  const route = CANONICAL_ROUTES.find((r) => r.path === p);
  if (!route) throw new Error(`routeMetadata: route-registry.ts'te kayıt yok (${p})`);
  if (route.sitemap && !route.description)
    throw new Error(`routeMetadata: sitemap:true kaydın description'ı yok (${p})`);
  const locale = localeOfPath(p);
  const meta = publicMetadata(route.title[locale], route.description?.[locale], p, locale);
  return route.robots === "noindex" ? { ...meta, robots: { index: false, follow: true } } : meta;
}
