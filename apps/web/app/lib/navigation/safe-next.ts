// Dönüş parametresi doğrulaması (design §5.4, §12.2; R8). Saf modül: window okumaz, origin
// parametre olarak gelir. Üreticiler yalnızca `next` yazar; okuyucular (login, register, verify,
// auth/callback) bu fonksiyonla okur. Bugünkü login mantığı (origin karşılaştırması) buraya
// taşındı ve daraltıldı: yol registry'de kayıtlı olmalı, hash atılır.
import { expandPaths, LEGACY_REDIRECTS, normalizePath } from "../route-registry";

/** Doğrulamadan önce ham değerin üst sınırı (design §12.2). */
export const NEXT_MAX_LENGTH = 512;
export const DEFAULT_NEXT = "/maps/";

function knownPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  return expandPaths().includes(p) || Object.keys(LEGACY_REDIRECTS).includes(p);
}

/**
 * Güvenli dönüş yolu: `/` ile başlar, `//` ya da `/\` ile başlamaz, aynı origin'e çözülür,
 * pathname kanonik / staticParams / LEGACY yoludur, ≤512 karakterdir. Hash atılır, search korunur.
 * Koşullardan biri tutmazsa `fallback`.
 */
export function safeNext(
  raw: string | null | undefined,
  origin: string,
  fallback: string = DEFAULT_NEXT,
): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > NEXT_MAX_LENGTH) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return fallback;
  }
  if (url.origin !== new URL(origin).origin) return fallback;
  if (!knownPath(url.pathname)) return fallback;
  return normalizePath(url.pathname) + url.search;
}

/** Arama dizgesinden `next`'i, yoksa geriye uyumlu `redirect`'i okuyup doğrular. */
export function readNext(search: string, origin: string, fallback: string = DEFAULT_NEXT): string {
  const params = new URLSearchParams(search);
  return safeNext(params.get("next") || params.get("redirect"), origin, fallback);
}
