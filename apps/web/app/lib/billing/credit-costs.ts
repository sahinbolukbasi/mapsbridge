// Kredi gösterim tablosu (design §7.4, tek kaynak): ana sayfa, fiyat sayfası, kapılar ve
// upgrade yüzeyi bu satırları gösterir. Yalnızca GÖSTERİM içindir; kredi istemcide hesaplanmaz
// ve düşülmez, sunucu kredi zinciri tek otoritedir. Değerler product.md "Kredi Modeli"
// tablosundan gelir; contracts ile eşitliği tests/credit-costs.test.cjs doğrular (S1 kararı:
// contracts ai_chat 0.5 ve lambda hoş geldin 100 çelişkisi testte KNOWN_EXCEPTIONS olarak durur).
// UI hoş geldin 100 (sunucu initializeTrial ile hizalı) / ai_chat 1 gösterir; sunucu değeri yayından önce kullanıcı tarafından
// teyit edilmeli.

export type CreditCost = number | "free";

export const CREDIT_COST_ROWS = [
  { action: "clarify", labelKey: "credits.row.clarify", cost: "free" },
  { action: "ai_chat", labelKey: "credits.row.aiChat", cost: 1 },
  { action: "route_optimize", labelKey: "credits.row.routeOptimize", cost: 1 },
  { action: "ai_stay_dining", labelKey: "credits.row.stayDining", cost: 2 },
  { action: "ai_deep_trip", labelKey: "credits.row.deepTrip", cost: 5 },
] as const;

export type CreditCostAction = (typeof CREDIT_COST_ROWS)[number]["action"];
export type CreditCostRow = (typeof CREDIT_COST_ROWS)[number];

/**
 * Ücretsiz hesapla gösterilen hoş geldin kredisi (S1 güncellendi, redesign-v2 approval): UI
 * sunucu davranışını yansıtır; store.ts initializeTrial 100 kredi verir.
 */
export const WELCOME_CREDITS_DISPLAY = 100;

/** Bir işlemin gösterilen maliyeti. */
export function costOf(action: CreditCostAction): CreditCost {
  const row = CREDIT_COST_ROWS.find((r) => r.action === action);
  if (!row) throw new Error(`Bilinmeyen kredi işlemi: ${action}`);
  return row.cost;
}
