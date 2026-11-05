// /checkout/ URL parametreleri (design §12.2): sabit enum'lara karşı doğrulanır, geçersiz değer
// yok sayılır. Yalnızca ön seçim içindir; satın alınacak ürün yine sunucu kataloğundan gelir.
import { PLAN_PERIODS, PLAN_TIERS, type PlanPeriod, type PlanTier } from "./catalog";

export type CheckoutTab = "plans" | "credits";
const CHECKOUT_TABS: readonly CheckoutTab[] = ["plans", "credits"];

export type CheckoutParams = {
  /** free|explorer|pro|agency; geçersizse null (yok sayılır). */
  plan: PlanTier | null;
  /** monthly|yearly; geçersizse monthly. */
  period: PlanPeriod;
  /** credits|plans; geçersizse null (sayfa varsayılanı). */
  tab: CheckoutTab | null;
  canceled: boolean;
  success: boolean;
};

const pick = <T extends string>(value: string | null, allowed: readonly T[]): T | null =>
  value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;

export function parseCheckoutParams(search: string): CheckoutParams {
  const params = new URLSearchParams(search);
  return {
    plan: pick(params.get("plan"), PLAN_TIERS),
    period: pick(params.get("period"), PLAN_PERIODS) ?? "monthly",
    tab: pick(params.get("tab"), CHECKOUT_TABS),
    canceled: params.has("canceled"),
    success: params.has("success"),
  };
}

/** /pricing/ plan CTA hedefi (design §5.5 J4): checkout URL'i; oturumsuzsa login next'i. */
export function checkoutHref(tier: PlanTier, period: PlanPeriod): string {
  return `/checkout/?plan=${tier}&period=${period}`;
}
export function planCtaHref(tier: PlanTier, period: PlanPeriod, signedIn: boolean): string {
  if (tier === "free") return "/register/";
  const target = checkoutHref(tier, period);
  return signedIn ? target : `/login/?next=${encodeURIComponent(target)}`;
}
