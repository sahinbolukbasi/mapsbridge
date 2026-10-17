export type AppLocale = "tr" | "en";

export function getLocaleFromPath(pathname: string): AppLocale {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "tr";
}

const ROUTE_MAP: Record<string, string> = {
  "/": "/en/",
  "/en/": "/",
  "/haritalar/": "/desk/",
  "/desk/": "/haritalar/",
  "/harita/": "/desk/",
  "/gezi-asistani/": "/ai-asistan/",
  "/ai-asistan/": "/gezi-asistani/",
  "/ai/": "/ai-asistan/",
  "/mobil-uygulamalar/": "/mobile-apps/",
  "/mobile-apps/": "/mobil-uygulamalar/",
  "/sifre-sifirla/": "/reset-password/",
  "/reset-password/": "/sifre-sifirla/",
  "/forgot-password/": "/reset-password/",
};

export function getAlternatePath(pathname: string): string {
  if (ROUTE_MAP[pathname]) return ROUTE_MAP[pathname];
  const locale = getLocaleFromPath(pathname);
  return locale === "en" ? pathname.replace(/^\/en/, "") || "/" : `/en${pathname}`;
}
