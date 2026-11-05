"use client";
import { useId } from "react";
import { useLocale } from "../../lib/locale-context";
import {
  derivePlanEquivalents,
  formatPrice,
  type PlanPriceState,
  type PlanTier,
} from "../../lib/billing/catalog";
import { Badge, Button, Skeleton, VisuallyHidden } from "../ui";
import "./plan-card.css";

export type { CatalogPrice, PlanPriceState } from "../../lib/billing/catalog";
export type PlanCta = {
  label: string;
  href?: string;
  /** Verilirse CTA devre dışıdır; neden metni aria-describedby ile bağlanır (design §7.3). */
  disabledReason?: string;
  variant?: "primary" | "secondary";
};

/**
 * Plan kartı (design §4.2, §7.2): kredi birincil satır, maliyet tablosundan türetilmiş "≈" satırı,
 * fiyat yalnızca katalogdan. Popülerlik rozeti ve deneme vaadi YOK (§7.1).
 */
export function PlanCard({
  tier,
  credits,
  creditsKind,
  price,
  discount,
  current = false,
  cta,
}: {
  tier: PlanTier;
  credits: number;
  /** yearly: katalogdaki yıllık ürünün kredisi ("5.500 kredi / yıl"), yalnızca yıllık dönemde. */
  creditsKind: "welcome" | "monthly" | "yearly";
  price: PlanPriceState;
  /** Kredi başına yıllık indirim yüzdesi; yalnızca katalogda iki dönem de varsa (design §7.2). */
  discount?: number;
  current?: boolean;
  cta?: PlanCta;
}) {
  const { t, locale } = useLocale();
  const id = useId();
  const titleId = `${id}-title`;
  const reasonId = `${id}-reason`;
  const eq = derivePlanEquivalents(credits);
  const name = t(`pricing.tier.${tier}`);
  const num = (n: number) => n.toLocaleString(locale === "en" ? "en-GB" : "tr-TR");
  const creditsLine = t(`pricing.credits.${creditsKind}`).replace("{n}", num(credits));
  const eqLine = t(eq.deepTrips === 1 ? "pricing.equivalents.oneTrip" : "pricing.equivalents")
    .replace("{trips}", num(eq.deepTrips))
    .replace("{chats}", num(eq.chats));
  return (
    <article
      className={current ? "bl-plan-card bl-plan-card--current" : "bl-plan-card"}
      data-surface="default"
      aria-labelledby={titleId}
    >
      <div className="bl-plan-card__head">
        <h2 id={titleId} className="bl-plan-card__name">
          {name}
        </h2>
        {current && <Badge tone="success">{t("pricing.current")}</Badge>}
      </div>
      <p className="bl-plan-card__credits">{creditsLine}</p>
      <p className="bl-plan-card__equivalent">{eqLine}</p>
      <PriceLine price={price} />
      {discount !== undefined && (
        <p className="bl-plan-card__price-note">
          {t("pricing.period.discount").replace("{n}", String(discount))}
        </p>
      )}
      {cta && (
        <div className="bl-plan-card__cta">
          {cta.disabledReason ? (
            <>
              <Button
                variant={cta.variant ?? "primary"}
                fullWidth
                disabled
                aria-describedby={reasonId}
              >
                {cta.label}
              </Button>
              <p id={reasonId} className="bl-plan-card__reason">
                {cta.disabledReason}
              </p>
            </>
          ) : (
            <Button
              variant={cta.variant ?? "primary"}
              fullWidth
              href={cta.href ?? "/pricing/"}
              prefetch={false}
            >
              {cta.label}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

function PriceLine({ price }: { price: PlanPriceState }) {
  const { t, locale } = useLocale();
  if (price === "none") return null;
  if (price === "loading")
    return (
      <p className="bl-plan-card__price">
        <Skeleton width="72px" height="12px" />
        <VisuallyHidden>{t("pricing.price.loading")}</VisuallyHidden>
      </p>
    );
  if (price === "unavailable")
    return <p className="bl-plan-card__price-note">{t("pricing.price.atCheckout")}</p>;
  if (price === "free") return <p className="bl-plan-card__price">{t("pricing.price.free")}</p>;
  const amount = formatPrice(price.amount, locale);
  return (
    <p className="bl-plan-card__price">
      {t(price.period === "yearly" ? "pricing.price.yearly" : "pricing.price.monthly").replace(
        "{price}",
        amount,
      )}
    </p>
  );
}
