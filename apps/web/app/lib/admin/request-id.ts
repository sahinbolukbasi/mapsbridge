// Kredi düzeltmesi idempotency anahtarı (design §8.6). Handler kuralı: /^[a-zA-Z0-9_-]{16,80}$/.
export const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{16,80}$/;

/** 32 karakterlik onaltılık kimlik. Aynı dialogdaki tekrar denemeler aynı kimliği kullanır. */
export function newRequestId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}
