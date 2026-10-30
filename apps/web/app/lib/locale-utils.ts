import { resolveAlternate } from "./route-registry";
export type AppLocale = "tr" | "en";
export function getLocaleFromPath(pathname: string): AppLocale {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "tr";
}
/**
 * Dil alternatifi route registry'den türetilir (design §4.2, D13; GSC MEDIUM-2): LEGACY önce
 * kanonik hedefe çözülür, gerçek dil varyantı ("/" ↔ "/en/") varsa o döner, yoksa path'in
 * kendisi (self). Var olmayan `/en/<path>/` URL'si üretilmez.
 */
export function getAlternatePath(pathname: string): string {
  return resolveAlternate(pathname);
}
/** Dil kökü: alternatifi olmayan sayfada dil anahtarı buraya gider (404 yok). */
export function localeRootPath(locale: AppLocale): string {
  return locale === "en" ? "/en/" : "/";
}
