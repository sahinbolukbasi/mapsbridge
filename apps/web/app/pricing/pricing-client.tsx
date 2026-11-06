"use client";
// /pricing/ (design §7, mock b-pricing.html; karar S1/S2). Herkese açık; API'siz de çalışır:
// tier adı + kredi statik, fiyat ve satın alınabilirlik yalnızca canlı katalogdan. Kredi istemcide
// hesaplanmaz/düşülmez; "≈" satırları yalnızca gösterim için maliyet tablosundan türetilir.
// ⚠ UI hoş geldin 5 / ai_chat 1 gösterir; sunucu değeri yayından önce kullanıcı tarafından teyit
// edilmeli.
import { useCallback, useEffect, useState } from "react";
import { PlanCard, type PlanCta } from "../components/billing/plan-card";
import {
  Accordion,
  Alert,
  Button,
  CreditCostTable,
  Icon,
  PageHeader,
  PageShell,
  Section,
  SegmentedControl,
  useUrlParam,
} from "../components/ui";
import { billingService } from "../lib/billing/billing-service";
import {
  PLAN_PERIODS,
  creditPacks,
  fetchCatalog,
  formatPrice,
  planInfos,
  planOffer,
  type Catalog,
  type PlanOffer,
  type PlanPeriod,
  type PlanTier,
} from "../lib/billing/catalog";
import { planCtaHref } from "../lib/billing/checkout-params";
import { getStoredSession } from "../lib/cognito";
import { useLocale } from "../lib/locale-context";
import { findRoute } from "../lib/route-registry";
import "./pricing.css";

const FAQ = [
  { id: "sss-kredi", q: "pricing.faq.q1", a: "pricing.faq.a1" },
  { id: "sss-iade", q: "pricing.faq.q2", a: "pricing.faq.a2" },
  { id: "sss-iptal", q: "pricing.faq.q3", a: "pricing.faq.a3" },
  { id: "sss-platform", q: "pricing.faq.q4", a: "pricing.faq.a4" },
] as const;

const CREDITS_TAB = "/checkout/?tab=credits";

export default function PricingClient() {
  const { t, locale } = useLocale();
  const [period, setPeriod] = useUrlParam<PlanPeriod>("period", {
    allowed: PLAN_PERIODS,
    fallback: "monthly",
  });
  const [catalog, setCatalog] = useState<Catalog | "loading">("loading");
  const [signedIn, setSignedIn] = useState(false);
  const [current, setCurrent] = useState<{ tier: PlanTier; period: PlanPeriod } | null>(null);

  const load = useCallback((signal?: AbortSignal) => {
    setCatalog("loading");
    void fetchCatalog(signal).then((next) => {
      if (!signal?.aborted) setCatalog(next);
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    // Oturumluysa "Mevcut planın" sunucu wallet tier'ından (checkout ile aynı çağrı).
    if (getStoredSession()) {
      setSignedIn(true);
      void billingService
        .refreshWallet()
        .then((w) => {
          if (!controller.signal.aborted && getStoredSession())
            setCurrent({ tier: w.subscriptionTier, period: w.subscriptionCycle });
        })
        .catch(() => {});
    }
    return () => controller.abort();
  }, [load]);

  const route = findRoute("/pricing/");
  const ok = catalog !== "loading" && catalog.status === "ok" ? catalog : null;
  const packs = ok ? creditPacks(ok.products) : [];

  function ctaFor(tier: PlanTier, offer: PlanOffer): PlanCta | undefined {
    if (tier === "free") {
      // Oturumlu kullanıcıya kayıt CTA'sı uygulanmaz (I10).
      if (signedIn) return undefined;
      return { label: t("pricing.cta.free"), href: "/register/", variant: "secondary" };
    }
    const label = t(`pricing.cta.${tier}`);
    const reason =
      offer.purchase === "current"
        ? t("pricing.current.reason")
        : offer.purchase === "closed"
          ? t("pricing.alert.disabled")
          : offer.purchase === "unavailable"
            ? t("pricing.unavailable")
            : undefined;
    return reason
      ? { label, disabledReason: reason }
      : { label, href: planCtaHref(tier, period, signedIn) };
  }

  return (
    <PageShell
      layout="content"
      className="pricing"
      header={<PageHeader description={route?.description?.[locale]} />}
    >
      {catalog !== "loading" && catalog.status === "unavailable" && (
        <Alert
          tone="info"
          live="polite"
          className="pricing__alert"
          title={t("pricing.alert.failed")}
          action={
            <Button variant="secondary" size="sm" onClick={() => load()}>
              {t("pricing.alert.retry")}
            </Button>
          }
        />
      )}
      {ok && !ok.enabled && (
        <Alert
          tone="warning"
          live="polite"
          className="pricing__alert"
          title={t("pricing.alert.disabled")}
        />
      )}
      <div className="pricing__period">
        <SegmentedControl
          label={t("pricing.period.label")}
          value={period}
          onChange={setPeriod}
          options={[
            { value: "monthly", label: t("pricing.period.monthly") },
            { value: "yearly", label: t("pricing.period.yearly") },
          ]}
        />
      </div>
      <ul className="pricing__plans" aria-label={t("pricing.plans.label")}>
        {planInfos().map((info) => {
          const mine = signedIn ? current : null;
          const offer = planOffer(info.tier, period, catalog, mine?.tier ?? null, mine?.period);
          return (
            <li key={info.tier} className="pricing__plan">
              <PlanCard
                tier={info.tier}
                credits={offer.credits?.n ?? info.credits}
                creditsKind={offer.credits?.kind ?? info.kind}
                price={offer.price}
                discount={offer.discount}
                current={offer.purchase === "current"}
                cta={ctaFor(info.tier, offer)}
              />
            </li>
          );
        })}
      </ul>
      <p className="pricing__note">
        {t("pricing.note.equivalents")} {t("pricing.note.payment")}
      </p>

      <Section
        id="krediler"
        title={t("pricing.costs.title")}
        description={t("pricing.costs.free")}
        className="pricing__section"
      >
        <CreditCostTable />
      </Section>

      {/* Kredi paketleri yalnızca katalogdan; katalog yüklü ama paket yoksa bölüm çizilmez (I10). */}
      {(catalog === "loading" || catalog.status === "unavailable" || packs.length > 0) && (
        <Section
          id="paketler"
          title={t("pricing.packs.title")}
          description={t("pricing.packs.sub")}
          className="pricing__section"
        >
          {catalog !== "loading" && catalog.status === "unavailable" && (
            <p className="pricing__muted">{t("pricing.packs.atCheckout")}</p>
          )}
          {packs.length > 0 && (
            <ul className="pricing__packs">
              {packs.map((pack) => {
                const buyable = !!ok?.enabled && pack.available;
                return (
                  <li key={pack.id} className="pricing__pack" data-surface="default">
                    <p className="pricing__pack-credits">
                      {t("credits.other").replace(
                        "{n}",
                        pack.credits.toLocaleString(locale === "en" ? "en-GB" : "tr-TR"),
                      )}
                    </p>
                    {pack.amount !== null && (
                      <p className="pricing__pack-price">{formatPrice(pack.amount, locale)}</p>
                    )}
                    {buyable ? (
                      <Button
                        variant="secondary"
                        href={
                          signedIn ? CREDITS_TAB : `/login/?next=${encodeURIComponent(CREDITS_TAB)}`
                        }
                        prefetch={false}
                      >
                        {t("pricing.packs.cta")}
                      </Button>
                    ) : (
                      <p className="pricing__muted">
                        {ok?.enabled ? t("pricing.unavailable") : t("pricing.alert.disabled")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      )}

      <Section
        id="bagimsizlik"
        title={t("pricing.independence.title")}
        className="pricing__section pricing__independence"
      >
        <div className="pricing__independence-body">
          <Icon name="shield" size={24} className="pricing__independence-icon" />
          <p className="pricing__muted">{t("pricing.independence.body")}</p>
        </div>
      </Section>

      <Section id="sss" title={t("pricing.faq.title")} className="pricing__section">
        <Accordion
          items={FAQ.map((item) => ({
            id: item.id,
            summary: t(item.q),
            content: <p className="pricing__muted">{t(item.a)}</p>,
          }))}
        />
      </Section>
    </PageShell>
  );
}
