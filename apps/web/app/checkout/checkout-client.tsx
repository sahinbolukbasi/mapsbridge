"use client";
// /checkout/ = yalnızca bakiye + satın alma adımı (design §5.2, §7.1). Plan karşılaştırması
// /pricing/'de. Fiyat ve ürünler yalnızca canlı katalogdan (S2); contracts TRY fiyatları ve
// maliyetleri gösterilmez. Kredi yalnızca sunucuda düşer/eklenir; satın alma akışı (RevenueCat
// checkout + webhook doğrulama yoklaması) bugünkü gibi.
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
} from "../components/ui";
import { apiFetch } from "../lib/api-client";
import { billingService } from "../lib/billing/billing-service";
import {
  PLAN_PERIODS,
  creditPacks,
  fetchCatalog,
  findPlanProduct,
  formatPrice,
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

export default function CheckoutClient() {
  const { t } = useLocale();
  const [catalog, setCatalog] = useState<Catalog | "loading">("loading");
  const [wallet, setWallet] = useState(() => billingService.getWallet());
  const [tab, setTab] = useUrlParam<CheckoutTab>("tab", { allowed: TABS, fallback: "plans" });
  const [period, setPeriod] = useUrlParam<PlanPeriod>("period", {
    allowed: PLAN_PERIODS,
    fallback: "monthly",
  });
  const [plan, setPlan] = useState<PlanTier | null>(null);
  const [message, setMessage] = useState("");
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
      setPromoMsg(`${res.credits} kredi hesabına eklendi. Yeni bakiye: ${res.balance}`);
      setPromoCode("");
      setWallet((w) => ({ ...w, credits: res.balance }));
    } catch (e: unknown) {
      const err = e as { message?: string };
      setPromoMsg(err?.message || "Kod kullanılamadı.");
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
    if (params.canceled) setMessage("Ödeme iptal edildi. Kredi eklenmedi.");

    loadCatalog(controller.signal);

    const refresh = () =>
      billingService.refreshWallet().then((x) => {
        if (!stopped) setWallet(x);
      });
    void refresh().catch(() => {
      if (!stopped) setMessage("Kredi bilgisi alınamadı. Tekrar deneyin.");
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
            setMessage("Ödemen doğrulandı, kredilerin hesabına eklendi.");
            return;
          }
          setMessage("Ödemen kontrol ediliyor. Doğrulandığında kredilerin otomatik eklenecek.");
          if (++attempts < 10) timer = setTimeout(check, 3000);
          else
            setMessage(
              "Ödeme doğrulaması devam ediyor. Daha sonra bakiyeni tekrar kontrol et; yeniden ödeme yapmana gerek yok.",
            );
        } catch {
          if (!stopped)
            setMessage("Ödeme durumu alınamadı. Yeniden ödeme yapmadan önce bakiyeni kontrol et.");
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
    if (!getStoredSession()) {
      location.href = "/login/?next=" + encodeURIComponent(location.pathname + location.search);
      return;
    }
    setBusy(true);
    setMessage("Güvenli ödeme sayfası hazırlanıyor…");
    const result = await billingService.processCheckout({
      mode: product.mode,
      targetId: product.id,
      cycle: product.mode === "subscription" ? period : undefined,
    });
    if (result.stripeRedirectUrl) {
      location.assign(result.stripeRedirectUrl);
      return;
    }
    setMessage(result.message);
    setBusy(false);
  }

  const ok = catalog !== "loading" && catalog.status === "ok" ? catalog : null;
  const subscriptions = ok
    ? PAID_TIERS.flatMap((tier) => {
        const product = findPlanProduct(ok.products, tier, period);
        return product ? [{ tier, product }] : [];
      })
    : [];
  const packs = ok ? creditPacks(ok.products) : [];
  const planMissing =
    !!ok && tab === "plans" && plan !== null && !subscriptions.some((s) => s.tier === plan);
  const tierName = t(`pricing.tier.${wallet.subscriptionTier}`);
  const gift = wallet.welcomeGift;

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
          ? "Mevcut planın"
          : !ok?.enabled || !product.available
            ? "Şu an satın alınamıyor"
            : signedIn
              ? "Satın al"
              : "Giriş yap ve satın al"}
      </Button>
    );
  }

  return (
    <PageShell
      layout="content"
      className="checkout"
      header={
        <PageHeader
          description="Bakiyeni gör, abonelik ya da kredi paketi satın al."
          actions={
            <Button href="/pricing/" variant="link" iconEnd={<Icon name="arrow" size={16} />}>
              Planları karşılaştır
            </Button>
          }
        />
      }
    >
      <section className="checkout-balance" data-surface="default" aria-label="Kredi hesabı">
        <div className="checkout-balance__main">
          <p className="checkout-balance__label">Kullanılabilir AI kredin</p>
          <p className="checkout-balance__value">
            {signedIn ? wallet.credits.toLocaleString("tr-TR") : "—"}
          </p>
          {signedIn && <p className="checkout-balance__tier">Planın: {tierName}</p>}
        </div>
        <Button
          href={signedIn ? "/travel-assistant/" : "/login/?next=%2Fcheckout%2F"}
          variant="secondary"
        >
          {signedIn ? "Rotamı planla" : "Giriş yap"}
        </Button>
      </section>

      <p className="checkout-note">
        {gift
          ? `Hoş geldin hediyen (${gift.credits.toLocaleString("tr-TR")} kredi) hesabına tanımlandı. Bu hediye tek seferliktir.`
          : `E-postanı doğruladığında hesabına ${WELCOME_CREDITS_DISPLAY} hoş geldin kredisi tanımlanır.`}
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
          title="Paketler yüklenemedi"
          action={
            <Button variant="secondary" size="sm" onClick={() => loadCatalog()}>
              Tekrar dene
            </Button>
          }
        />
      )}
      {ok && !ok.enabled && (
        <Alert
          tone="warning"
          live="polite"
          className="checkout-alert"
          title="Satın alma şu an kapalı"
        >
          Mevcut ve hediye kredilerini kullanabilirsin.
        </Alert>
      )}

      <Section title="Satın al" className="checkout-section">
        <SegmentedControl
          label="Satın alma türü"
          value={tab}
          onChange={setTab}
          options={[
            { value: "plans", label: "Abonelik" },
            { value: "credits", label: "Kredi paketi" },
          ]}
        />
        {tab === "plans" && (
          <SegmentedControl
            label="Ödeme dönemi"
            value={period}
            onChange={setPeriod}
            options={[
              { value: "monthly", label: "Aylık" },
              { value: "yearly", label: "Yıllık" },
            ]}
          />
        )}
        {planMissing && (
          <Alert tone="info" className="checkout-alert">
            Seçtiğin plan bu dönem için şu an satın alınamıyor.
          </Alert>
        )}
        {catalog === "loading" ? (
          <LoadingState label="Paketler yükleniyor…" />
        ) : !ok ? null : tab === "plans" ? (
          subscriptions.length > 0 ? (
            <ul className="checkout-products">
              {subscriptions.map(({ tier, product }) => {
                const isCurrent = signedIn && wallet.subscriptionTier === tier;
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
                      {tier === plan && <Badge tone="info">Seçtiğin plan</Badge>}
                    </div>
                    <p className="checkout-product__credits">
                      {product.credits.toLocaleString("tr-TR")} kredi
                    </p>
                    <p className="checkout-product__price">
                      {formatPrice(product.amount, "tr")} / {period === "yearly" ? "yıl" : "ay"}
                    </p>
                    <p className="checkout-muted">
                      Abonelik dönemsel yenilenir; istediğin an iptal edebilirsin.
                    </p>
                    {buyButton(product, isCurrent)}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="checkout-muted">Bu dönem için şu an satın alınabilir abonelik yok.</p>
          )
        ) : packs.length > 0 ? (
          <ul className="checkout-products">
            {packs.map((product) => (
              <li key={product.id} className="checkout-product" data-surface="default">
                <h3 className="checkout-product__name">
                  {product.credits.toLocaleString("tr-TR")} kredi
                </h3>
                <p className="checkout-product__price">{formatPrice(product.amount, "tr")}</p>
                <p className="checkout-muted">Tek seferlik ek kredi. Kredilerin süresi dolmaz.</p>
                {buyButton(product, false)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="checkout-muted">Şu an satın alınabilir kredi paketi yok.</p>
        )}
      </Section>

      {signedIn && (
        <Section title="Promosyon kodu" className="checkout-section">
          <div className="checkout-promo">
            <Field label="Promosyon kodun var mı?" className="checkout-promo__field">
              {(ids) => (
                <Input
                  {...ids}
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="KOD"
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
              Kodu kullan
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
        title="Ne kadar kredi harcar?"
        description="Kredi, ücretli işlem başlamadan sunucuda ayrılır. İşlem başarısız olursa otomatik iade edilir."
        className="checkout-section"
      >
        <CreditCostTable />
        <p className="checkout-muted">
          Ödemeler RevenueCat üzerinden güvenli biçimde gerçekleşir. Krediler yalnızca ödeme
          sunucuda doğrulandıktan sonra hesabına yüklenir.
        </p>
      </Section>
    </PageShell>
  );
}
