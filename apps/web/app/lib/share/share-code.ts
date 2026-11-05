// Paylaşım kodu normalizasyonu (design §5.4, §12.2). Saf modül. Kanonik URL parametresi `code`;
// /k/ geriye uyumluluk için `kod`'u da okur.

export const SHARE_CODE_PATTERN = /^[A-Z0-9-]{4,32}$/;

/** Kenar ve iç boşlukları siler, büyük harfe çevirir. */
export function normalizeShareCode(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, "").toUpperCase();
}

/** Normalize edilmiş kod `^[A-Z0-9-]{4,32}$` biçiminde mi. */
export function isValidShareCode(code: string): boolean {
  return SHARE_CODE_PATTERN.test(code);
}
