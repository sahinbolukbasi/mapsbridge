// K3 (approval notes): Google Places içeriği eğitim / RAG / kalıcı korpusa GİRMEZ. Bu yüklem
// training-worker ve kb-ingest gibi korpus yazıcılarında kullanılır; bağımlılığı yoktur ki her
// worker ucuzca import edebilsin.

/** Yer önbelleği anahtarları (places.repo.ts); bu ön ekli kayıtlar korpusa alınmaz. */
export const PLACE_CACHE_PREFIXES = ["PLACECACHE#", "PLACEID#"] as const;

/**
 * Değer (kayıt, mesaj, JSON) Google kaynaklı yer verisi ya da yer önbelleği kaydı içeriyor mu?
 * JSON metni üzerinden bakar: `"provider":"google"` alanı ya da PLACECACHE#/PLACEID# anahtarı.
 */
export function isGoogleDerived(value: unknown): boolean {
  let text: string;
  try {
    text = typeof value === "string" ? value : JSON.stringify(value ?? null);
  } catch {
    // Döngüsel ya da serileştirilemeyen değer: emin olunamıyorsa korpusa alınmaz.
    return true;
  }
  if (!text) return false;
  if (/"provider"\s*:\s*"google"/i.test(text)) return true;
  return PLACE_CACHE_PREFIXES.some((p) => text.includes(p));
}
