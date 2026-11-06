// Plan kartı verisi (design §7.2, §4.2 PlanCard; karar S2): web lib/billing/catalog.ts'in
// gösterim parçalarının kopyası (planInfos, derivePlanEquivalents, formatPrice; parite testli).
// Fiyat burada YOKTUR: yalnızca canlı katalogdan (GET /revenuecat/plans) gelir. Yalnızca gösterim;
// kredi istemcide hesaplanmaz/düşülmez. UI hoş geldin 100 (sunucuyla hizalı) / ai_chat 1 gösterir; sunucu değeri
// yayından önce kullanıcı tarafından teyit edilmeli.
import { costOf, WELCOME_CREDITS_DISPLAY, type CreditCostAction } from "./credit-costs";

// Kademeler product.md'den; krediler web planInfos() (contracts SUBSCRIPTION_PLAN_DEFS) ile aynı.
export type PlanTier = "free" | "explorer" | "pro" | "agency";
export const PLAN_TIERS: readonly PlanTier[] = ["free", "explorer", "pro", "agency"];
export const PLAN_CREDITS: Record<PlanTier, { credits: number; kind: "welcome" | "monthly" }> = {
  free: { credits: WELCOME_CREDITS_DISPLAY, kind: "welcome" },
  explorer: { credits: 100, kind: "monthly" },
  pro: { credits: 500, kind: "monthly" },
  agency: { credits: 2500, kind: "monthly" },
};
/** Kredinin karşılığı (web derivePlanEquivalents ile aynı taban bölme). */
export function derivePlanEquivalents(credits: number): { deepTrips: number; chats: number } {
  const safe = Number.isFinite(credits) && credits > 0 ? credits : 0;
  const n = (action: CreditCostAction) => {
    const c = costOf(action);
    return typeof c === "number" ? c : 1;
  };
  return {
    deepTrips: Math.floor(safe / n("ai_deep_trip")),
    chats: Math.floor(safe / n("ai_chat")),
  };
}

export type PlanPeriod = "monthly" | "yearly";
/** Katalogdan gelen fiyat (kuruş). */
export type CatalogPrice = { amount: number; period: PlanPeriod; credits: number };
/**
 * loading: iskelet · unavailable: katalog yüklenemedi ("ödeme adımında") · free: ücretsiz plan ·
 * none: katalogda bu tier/dönem için ürün yok (fiyat satırı çizilmez, I10).
 */
export type PlanPriceState = CatalogPrice | "loading" | "unavailable" | "free" | "none";

/** 2500 → "2.500" (tr-TR gruplama; Hermes Intl'e bağımlı değil). */
export function groupThousands(n: number): string {
  const sign = n < 0 ? "-" : "";
  return (
    sign +
    Math.trunc(Math.abs(n))
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  );
}

/** Kuruş → "₺1.299" / "₺99,99" (web formatPrice(amount, "tr") ile aynı çıktı). */
export function formatPrice(amount: number): string {
  const value = Math.round(amount) / 100;
  const whole = Math.trunc(value);
  const cents = Math.round((value - whole) * 100);
  return cents === 0
    ? `₺${groupThousands(whole)}`
    : `₺${groupThousands(whole)},${String(cents).padStart(2, "0")}`;
}
