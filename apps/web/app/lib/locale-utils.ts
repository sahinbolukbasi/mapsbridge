export type AppLocale = "tr" | "en";

export function getLocaleFromPath(pathname: string): AppLocale {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "tr";
}

const ROUTE_MAP: Record<string, string> = {
  "/": "/en/",
  "/en/": "/",
  "/maps/": "/maps/",
  "/haritalar/": "/maps/",
  "/harita/": "/maps/",
  "/desk/": "/maps/",
  "/travel-assistant/": "/travel-assistant/",
  "/gezi-asistani/": "/travel-assistant/",
  "/ai-asistan/": "/travel-assistant/",
  "/ai/": "/travel-assistant/",
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
