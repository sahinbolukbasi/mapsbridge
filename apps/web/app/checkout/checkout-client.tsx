"use client";
// /checkout/ = yalnızca bakiye + satın alma adımı (design §5.2, §7.1). Plan karşılaştırması
// /pricing/'de. Fiyat ve ürünler yalnızca canlı katalogdan (S2); contracts TRY fiyatları ve
// maliyetleri gösterilmez. Kredi yalnızca sunucuda düşer/eklenir; satın alma akışı (RevenueCat
// checkout + webhook doğrulama yoklaması) bugünkü gibi. Metinler i18n `checkout.*` (I11; locale
// yol tabanlıdır, /checkout/ bugün yalnızca TR çözülür).
// ⚠ UI hoş geldin 5 / ai_chat 1 gösterir; sunucu değeri yayından önce kullanıcı tarafından teyit
// edilmeli.
import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  CreditCostTable,
  Field,
  Icon,
  Input,
  LoadingState,
  PageHeader,
  PageShell,
  Section,
  SegmentedControl,
  useUrlParam,
  VisuallyHidden,
} from "../components/ui";
import { apiFetch } from "../lib/api-client";
import { billingService } from "../lib/billing/billing-service";
import {
  PLAN_PERIODS,
  creditPacks,
  fetchCatalog,
  findPlanProduct,
  formatPrice,
  isWebSellable,
  type Catalog,
  type CatalogProduct,
  type PlanPeriod,
  type PlanTier,
} from "../lib/billing/catalog";
import { parseCheckoutParams, type CheckoutTab } from "../lib/billing/checkout-params";
import { WELCOME_CREDITS_DISPLAY } from "../lib/billing/credit-costs";
import { verifyRevenueCatPurchase } from "../lib/billing/revenuecat-client";
import { getStoredSession } from "../lib/cognito";
import { useLocale } from "../lib/locale-context";
import "./checkout.css";

const PAID_TIERS: readonly Exclude<PlanTier, "free">[] = ["explorer", "pro", "agency"];
const TABS: readonly CheckoutTab[] = ["plans", "credits"];
/** Durum mesajı: i18n anahtarı (etkilerde) ya da hazır metin (sunucu/olay işleyici). */
type Notice = { key: string } | { text: string } | null;

export default function CheckoutClient() {
  const { t, locale } = useLocale();
  const num = (n: number) => n.toLocaleString(locale === "en" ? "en-GB" : "tr-TR");
  const [catalog, setCatalog] = useState<Catalog | "loading">("loading");
  const [wallet, setWallet] = useState(() => billingService.getWallet());
  const [tab, setTab] = useUrlParam<CheckoutTab>("tab", { allowed: TABS, fallback: "plans" });
  const [period, setPeriod] = useUrlParam<PlanPeriod>("period", {
    allowed: PLAN_PERIODS,
    fallback: "monthly",
  });
  const [plan, setPlan] = useState<PlanTier | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const setMessage = (key: string) => setNotice({ key });
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoMsg, setPromoMsg] = useState("");

  async function redeemPromo() {
    const code = promoCode.trim();
    if (!code) return;
    setPromoBusy(true);
    setPromoMsg("");
    try {
      const res = await apiFetch<{ credits: number; balance: number }>("/stripe/promo/redeem", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setPromoMsg(
        t("checkout.promo.added")
          .replace("{credits}", num(res.credits))
          .replace("{balance}", num(res.balance)),
      );
      setPromoCode("");
      setWallet((w) => ({ ...w, credits: res.balance }));
    } catch (e: unknown) {
      const err = e as { message?: string };
      setPromoMsg(err?.message || t("checkout.promo.failed"));
    } finally {
      setPromoBusy(false);
    }
  }

  function loadCatalog(signal?: AbortSignal) {
    setCatalog("loading");
    void fetchCatalog(signal).then((next) => {
      if (!signal?.aborted) setCatalog(next);
    });
  }

  useEffect(() => {
    let stopped = false;
    const controller = new AbortController();
    setSignedIn(!!getStoredSession());
    // plan/period/tab enum'lara karşı doğrulanır (design §12.2); geçersiz değer yok sayılır.
    const params = parseCheckoutParams(location.search);
    if (params.plan && params.plan !== "free") setPlan(params.plan);
    if (params.canceled) setMessage("checkout.msg.canceled");

    loadCatalog(controller.signal);

    const refresh = () =>
      billingService.refreshWallet().then((x) => {
        if (!stopped) setWallet(x);
      });
    void refresh().catch(() => {
      if (!stopped) setMessage("checkout.msg.walletFailed");
    });

    let timer: ReturnType<typeof setTimeout>;
    if (params.success) {
      let attempts = 0;
      const check = async () => {
        try {
          // RevenueCat webhook arrives async; poll wallet until credits appear
          await verifyRevenueCatPurchase().catch(() => null);
          const updated = await billingService.refreshWallet();
          if (stopped) return;
          if (updated.credits > 0) {
            setMessage("checkout.msg.verified");
            return;
          }
          setMessage("checkout.msg.verifying");
          if (++attempts < 10) timer = setTimeout(check, 3000);
          else setMessage("checkout.msg.verifyPending");
        } catch {
          if (!stopped) setMessage("checkout.msg.verifyFailed");
        }
      };
      void check();
    }
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  async function buy(product: CatalogProduct) {
    // S18: web yalnızca aylık abonelik ve kredi paketi satar (yıllık listelenmez; burada da reddedilir).
    if (!isWebSellable(product)) return;
    if (!getStoredSession()) {
      location.href = "/login/?next=" + encodeURIComponent(location.pathname + location.search);
      return;
    }
    setBusy(true);
    setMessage("checkout.msg.preparing");
    const result = await billingService.processCheckout({
      mode: product.mode,
      targetId: product.id,
      cycle: product.mode === "subscription" ? period : undefined,
    });
    if (result.stripeRedirectUrl) {
      location.assign(result.stripeRedirectUrl);
      return;
    }
    setNotice({ text: result.message });
    setBusy(false);
  }

  const ok = catalog !== "loading" && catalog.status === "ok" ? catalog : null;
  const subscriptions = ok
    ? PAID_TIERS.flatMap((tier) => {
        // S18: yıllık ürünler web'de satılmaz → Yıllık modda "satın alınabilir abonelik yok".
        const product = findPlanProduct(ok.products, tier, period);
        return product && isWebSellable(product) ? [{ tier, product }] : [];
      })
    : [];
  const packs = ok ? creditPacks(ok.products) : [];
  const planMissing =
    !!ok && tab === "plans" && plan !== null && !subscriptions.some((s) => s.tier === plan);
  const tierName = t(`pricing.tier.${wallet.subscriptionTier}`);
  const gift = wallet.welcomeGift;
  const message = notice ? ("key" in notice ? t(notice.key) : notice.text) : "";

  function buyButton(product: CatalogProduct, isCurrent: boolean) {
    const purchasable = !!ok?.enabled && product.available && !isCurrent;
    return (
      <Button
        variant="primary"
        fullWidth
        disabled={!purchasable}
        loading={busy && purchasable}
        onClick={() => void buy(product)}
      >
        {isCurrent
          ? t("pricing.current")
          : !ok?.enabled || !product.available
            ? t("pricing.unavailable")
            : signedIn
              ? t("checkout.buy")
              : t("checkout.buy.login")}
      </Button>
    );
  }

  return (
    <PageShell
      layout="content"
      className="checkout"
      header={
        <PageHeader
          description={t("checkout.description")}
          actions={
            <Button href="/pricing/" variant="link" iconEnd={<Icon name="arrow" size={16} />}>
              {t("upgrade.compare")}
            </Button>
          }
        />
      }
    >
      <section
        className="checkout-balance"
        data-surface="default"
        aria-label={t("checkout.balance.region")}
      >
        <div className="checkout-balance__main">
          <p className="checkout-balance__label">{t("checkout.balance.label")}</p>
          {signedIn ? (
            <p className="checkout-balance__value">{num(wallet.credits)}</p>
          ) : (
            <p className="checkout-balance__value">
              <span aria-hidden="true">—</span>
              <VisuallyHidden>{t("checkout.balance.guest")}</VisuallyHidden>
            </p>
          )}
          {signedIn && (
            <p className="checkout-balance__tier">
              {t("upgrade.tier").replace("{name}", tierName)}
            </p>
          )}
        </div>
        <Button
          href={signedIn ? "/travel-assistant/" : "/login/?next=%2Fcheckout%2F"}
          variant="secondary"
        >
          {signedIn ? t("checkout.balance.plan") : t("checkout.balance.login")}
        </Button>
      </section>

      <p className="checkout-note">
        {gift
          ? t("checkout.gift.granted").replace("{n}", num(gift.credits))
          : t("checkout.gift.pending").replace("{n}", num(WELCOME_CREDITS_DISPLAY))}
      </p>

      {message && (
        <Alert tone="info" live="polite" className="checkout-alert">
          {message}
        </Alert>
      )}
      {catalog !== "loading" && catalog.status === "unavailable" && (
        <Alert
          tone="info"
          live="polite"
          className="checkout-alert"
          title={t("checkout.catalog.failed")}
          action={
            <Button variant="secondary" size="sm" onClick={() => loadCatalog()}>
              {t("pricing.alert.retry")}
            </Button>
          }
        />
      )}
      {ok && !ok.enabled && (
        <Alert
          tone="warning"
          live="polite"
          className="checkout-alert"
          title={t("pricing.alert.disabled")}
        >
          {t("checkout.closed.body")}
        </Alert>
      )}

      <Section title={t("checkout.buy.title")} className="checkout-section">
        <SegmentedControl
          label={t("checkout.type.label")}
          value={tab}
          onChange={setTab}
          options={[
            { value: "plans", label: t("checkout.type.plans") },
            { value: "credits", label: t("checkout.type.credits") },
          ]}
        />
        {tab === "plans" && (
          <SegmentedControl
            label={t("pricing.period.label")}
            value={period}
            onChange={setPeriod}
            options={[
              { value: "monthly", label: t("pricing.period.monthly") },
              { value: "yearly", label: t("pricing.period.yearly") },
            ]}
          />
        )}
        {planMissing && (
          <Alert tone="info" className="checkout-alert">
            {t("checkout.planMissing")}
          </Alert>
        )}
        {catalog === "loading" ? (
          <LoadingState label={t("checkout.loading")} />
        ) : !ok ? null : tab === "plans" ? (
          subscriptions.length > 0 ? (
            <ul className="checkout-products">
              {subscriptions.map(({ tier, product }) => {
                // Sunucu wallet'ı dönem bildirmez; subscriptionCycle bugün hep "monthly".
                const isCurrent =
                  signedIn &&
                  wallet.subscriptionTier === tier &&
                  wallet.subscriptionCycle === period;
                return (
                  <li
                    key={product.id}
                    className={
                      tier === plan
                        ? "checkout-product checkout-product--selected"
                        : "checkout-product"
                    }
                    data-surface="default"
                  >
                    <div className="checkout-product__head">
                      <h3 className="checkout-product__name">{t(`pricing.tier.${tier}`)}</h3>
                      {tier === plan && <Badge tone="info">{t("checkout.selected")}</Badge>}
                    </div>
                    <p className="checkout-product__credits">
                      {t("credits.other").replace("{n}", num(product.credits))}
                    </p>
                    <p className="checkout-product__price">
                      {t(
                        period === "yearly" ? "pricing.price.yearly" : "pricing.price.monthly",
                      ).replace("{price}", formatPrice(product.amount, locale))}
                    </p>
                    <p className="checkout-muted">{t("checkout.subscription.note")}</p>
                    {buyButton(product, isCurrent)}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="checkout-muted">{t("checkout.noSubscriptions")}</p>
          )
        ) : packs.length > 0 ? (
          <ul className="checkout-products">
            {packs.map((product) => (
              <li key={product.id} className="checkout-product" data-surface="default">
                <h3 className="checkout-product__name">
                  {t("credits.other").replace("{n}", num(product.credits))}
                </h3>
                <p className="checkout-product__price">{formatPrice(product.amount, locale)}</p>
                <p className="checkout-muted">{t("checkout.pack.note")}</p>
                {buyButton(product, false)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="checkout-muted">{t("checkout.noPacks")}</p>
        )}
      </Section>

      {signedIn && (
        <Section title={t("checkout.promo.title")} className="checkout-section">
          <div className="checkout-promo">
            <Field label={t("checkout.promo.label")} className="checkout-promo__field">
              {(ids) => (
                <Input
                  {...ids}
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder={t("checkout.promo.placeholder")}
                  autoComplete="off"
                  maxLength={32}
                  disabled={promoBusy}
                />
              )}
            </Field>
            <Button
              variant="secondary"
              onClick={() => void redeemPromo()}
              disabled={!promoCode.trim()}
              loading={promoBusy}
            >
              {t("checkout.promo.submit")}
            </Button>
          </div>
          {promoMsg && (
            <p className="checkout-muted" role="status">
              {promoMsg}
            </p>
          )}
        </Section>
      )}

      <Section
        title={t("pricing.costs.title")}
        description={t("checkout.costs.sub")}
        className="checkout-section"
      >
        <CreditCostTable />
        <p className="checkout-muted">{t("checkout.costs.payment")}</p>
      </Section>
    </PageShell>
  );
}
