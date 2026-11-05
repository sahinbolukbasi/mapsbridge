// Paylaşım kodu normalizasyonu (design §5.4, §12.2). Saf modül. Kanonik URL parametresi `code`;
// /k/ geriye uyumluluk için `kod`'u da okur.
// Büyük/küçük harf KORUNUR (FEAT-004 kullanıcı kararı A): backend kodları 8 karakter, token'ları
// 64 karakter küçük harf hex olarak üretir ve GET /shares/{code} büyük/küçük harfe duyarlı arar.
// Büyük harfe çevirmek ya da 32 karakterle sınırlamak gerçek kod ve token'ları bozar. Ana sayfa
// ve /k/ aynı kuralı kullanır: yalnızca `readShareCode`.

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
