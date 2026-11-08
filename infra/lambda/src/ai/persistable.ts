// DynamoDB `marshall` (removeUndefinedValues yok) undefined alan görünce fırlatır:
// "Pass options.removeUndefinedValues=true to remove undefined values from map/array/set."
// Canlı hata (2026-11-08, run 42487395701): rota yanıtındaki isteğe bağlı alanlar
// (ör. durak `checkedAt`, `estimatedMinutes`, `timeSlot`) undefined geldiğinde finishAI
// tüm turu AI_RESULT_UNCONFIRMED 503'e çeviriyordu. finishAI (billing/store.ts, danger-zone)
// değiştirilmez; ona verilen tamamlama yükü burada temizlenir.

// Düz nesne: prototipi null ya da (herhangi bir realm'in) Object.prototype'u. Date/Set gibi
// sınıf örneklerinin prototip zinciri bir adım daha uzundur.
const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== "object" || v === null) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === null || Object.getPrototypeOf(proto) === null;
};

/**
 * Düz nesne/dizilerden undefined değerleri derinlemesine atar (nesnede anahtar silinir, dizide
 * eleman çıkarılır). null, sayı, metin, boolean ve sınıf örnekleri (Date, Set, Uint8Array)
 * olduğu gibi kalır. Girdi değiştirilmez.
 */
export function persistable<T>(value: T): T {
  if (Array.isArray(value))
    return value.filter((v) => v !== undefined).map((v) => persistable(v)) as unknown as T;
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = persistable(v);
  return out as T;
}
