// Paylaşım kodu kuralı (design §5.4, §12.2; karar S16): apps/web/app/lib/share/share-code.ts'in
// birebir kopyası (mobil web'e bağımlı olamaz; eşitliği apps/web/tests/mobile-parity.test.cjs
// doğrular). Büyük/küçük harf KORUNUR, boşluklar silinir, `^[A-Za-z0-9-]{4,64}$`.
export const SHARE_CODE_PATTERN = /^[A-Za-z0-9-]{4,64}$/;
/** Kenar ve iç boşlukları siler; harf büyüklüğüne dokunmaz. */
export function normalizeShareCode(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, "");
}
/** Normalize edilmiş kod `^[A-Za-z0-9-]{4,64}$` biçiminde mi. */
export function isValidShareCode(code: string): boolean {
  return SHARE_CODE_PATTERN.test(code);
}
/** Tek giriş noktası: normalize eder, geçerliyse kodu, değilse null döner. */
export function readShareCode(raw: string | null | undefined): string | null {
  const code = normalizeShareCode(raw);
  return isValidShareCode(code) ? code : null;
}
/** Kodun web görüntüleyicisi (/k/?code=, design §6.4; hesapsız açılır). */
export function shareCodeUrl(code: string): string {
  return `https://mapsbridge.com/k/?code=${encodeURIComponent(code)}`;
}
