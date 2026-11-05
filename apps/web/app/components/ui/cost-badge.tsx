"use client";
import { useLocale } from "../../lib/locale-context";
import type { CreditCost } from "../../lib/billing/credit-costs";
import { cx } from "./cx";
import { Icon } from "./svg-icon";
import "./ui.css";
/** "1 kredi" / "5 credits" / "Ücretsiz" (i18n). Yalnızca gösterim; kredi sunucuda düşer. */
export function formatCreditCost(cost: CreditCost, t: (key: string, fallback?: string) => string) {
  if (cost === "free") return t("credits.free", "Ücretsiz");
  const key = cost === 1 ? "credits.one" : "credits.other";
  return t(key, "{n} kredi").replace("{n}", String(cost));
}
/** Kredi maliyeti etiketi (design §4.2): metin olarak okunur, ikon dekoratif. */
export function CostBadge({ cost, className }: { cost: CreditCost; className?: string }) {
  const { t } = useLocale();
  return (
    <span className={cx("ui-cost-badge", className)}>
      <Icon name="coin" size={16} />
      {formatCreditCost(cost, t)}
    </span>
  );
}
