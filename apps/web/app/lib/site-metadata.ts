import type { Metadata } from "next";
import { getAlternatePath, type AppLocale } from "./locale-utils";

const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
export const siteOrigin = configuredOrigin ? new URL(configuredOrigin).origin : undefined;

export function publicMetadata(
  title: string,
  description: string,
  path: string,
  locale: AppLocale = "tr",
): Metadata {
  const url = siteOrigin ? new URL(path, siteOrigin).href : undefined;
  const fullTitle = title.includes("MapsBridge") ? title : `${title} | MapsBridge`;
  const altPath = getAlternatePath(path);

  return {
    title: fullTitle,
    description,
    alternates: {
      canonical: url,
      languages: siteOrigin
        ? {
            tr: new URL(locale === "tr" ? path : altPath, siteOrigin).href,
            en: new URL(locale === "en" ? path : altPath, siteOrigin).href,
            "x-default": new URL("/en/", siteOrigin).href,
          }
        : undefined,
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      type: "website",
      locale: locale === "tr" ? "tr_TR" : "en_US",
      alternateLocale: locale === "tr" ? ["en_US"] : ["tr_TR"],
      siteName: "MapsBridge",
    },
    twitter: { card: "summary", title: fullTitle, description },
  };
}
