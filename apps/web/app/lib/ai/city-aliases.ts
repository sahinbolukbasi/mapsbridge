/**
 * Şehir alias'ları — TEK KAYNAK (Faz 1 / görev 3).
 *
 * Daha önce bu tablo iki yerde ayrı ayrı tanımlıydı (`retrieval.ts` canonicalCity
 * ve `bundled-evidence.ts` yerel korpus eşlemesi) ve sessizce birbirinden sapabiliyordu.
 * Artık her iki tüketici de buradan türetir:
 *   - `CITY_ALIASES`  : Kanonik ad → normalize edilmiş alias listesi (bundled-evidence biçimi)
 *   - `aliasToCanonical()` : normalize alias → Kanonik ad (retrieval canonicalCity biçimi)
 *
 * Yeni bir şehir/alias eklerken YALNIZCA bu tabloyu düzenle; iki tüketici de
 * otomatik güncellenir. `city-aliases.test.cjs` iki biçimin tutarlılığını doğrular.
 *
 * Not: Alias'lar önceden normalize edilmiş (küçük harf, aksansız) biçimde tutulur;
 * normalizeText() ile karşılaştırılırlar. Kanonik adlar kullanıcıya gösterilen
 * biçimdir (İstanbul, Roma).
 */

/** Kanonik şehir adı → normalize edilmiş alias'lar. Bu, sözlüğün OTORİTE biçimidir. */
export const CITY_ALIASES: Record<string, string[]> = {
  Tokyo: ["tokyo", "tokio"],
  Roma: ["roma", "rome"],
  İstanbul: ["istanbul"],
  Lima: ["lima"],
  Paris: ["paris"],
  Barcelona: ["barcelona", "barselona"],
};

/**
 * Ters harita: normalize alias → Kanonik ad. `retrieval.ts` canonicalCity için.
 * CITY_ALIASES'tan türetilir, böylece iki biçim asla birbirinden sapamaz.
 */
export const ALIAS_TO_CANONICAL: Record<string, string> = Object.fromEntries(
  Object.entries(CITY_ALIASES).flatMap(([canonical, aliases]) =>
    aliases.map((alias) => [alias, canonical] as const),
  ),
);

/** Normalize edilmiş bir alias'ı kanonik ada çevirir; bilinmiyorsa undefined. */
export function aliasToCanonical(normalizedAlias: string): string | undefined {
  return ALIAS_TO_CANONICAL[normalizedAlias];
}
