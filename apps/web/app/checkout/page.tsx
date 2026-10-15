"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HeaderNav } from "../components/header-nav";
import { billingService } from "../lib/billing/billing-service";
import { apiFetch } from "../lib/api-client";
import { getStoredSession } from "../lib/cognito";
import { openStripeBillingPortal } from "../lib/billing/stripe-client";
import { BillingCycle } from "../lib/billing/billing-types";
import {
  SUBSCRIPTION_PLAN_DEFS,
  CREDIT_PACKAGE_DEFS,
  ACTION_CREDIT_COSTS,
} from "@mapsbridge/contracts";
import "./checkout.css";

type Product = {
  id: string;
  mode: "credit_pack" | "subscription";
  credits: number;
  amount: number;
  available: boolean;
};

type Catalog = {
  enabled: boolean;
  products: Product[];
};

// Derive display metadata from the single source of truth in @mapsbridge/contracts
const PLAN_NAMES: Record<
  string,
  { title: string; desc: string; badge?: string; highlight?: boolean }
> = Object.fromEntries(
  SUBSCRIPTION_PLAN_DEFS.filter((p) => p.id !== "free").map((p) => [
    p.id,
    { title: p.name, desc: p.tagline, badge: p.badge, highlight: p.highlight },
  ]),
);

const PACK_NAMES: Record<
  string,
  { title: string; desc: string; badge?: string; popular?: boolean }
> = Object.fromEntries(
  CREDIT_PACKAGE_DEFS.map((p) => [
    p.id,
    {
      title: `${p.title} (${p.credits.toLocaleString("tr-TR")} Kredi)`,
      desc: p.description,
      badge: p.popular ? "AVANTAJLI" : undefined,
      popular: p.popular,
    },
  ]),
);

// Yearly discounted prices from contracts (TRY)
const YEARLY_RATES: Record<string, number> = Object.fromEntries(
  SUBSCRIPTION_PLAN_DEFS.filter((p) => p.id !== "free").map((p) => [p.id, p.yearlyPriceTry]),
);

export default function CheckoutPage() {
  const [catalog, setCatalog] = useState<Catalog>();
  const [wallet, setWallet] = useState(() => billingService.getWallet());
  const [tab, setTab] = useState<"credit_pack" | "subscription">("subscription");
  const [cycle, setCycle] = useState<BillingCycle>("yearly");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let stopped = false;
    setSignedIn(!!getStoredSession());
    const params = new URLSearchParams(location.search);
    if (params.get("tab") === "credits") setTab("credit_pack");
    if (params.get("tab") === "plans") setTab("subscription");
    if (params.has("canceled")) setMessage("Ödeme iptal edildi. Kredi eklenmedi.");

    void apiFetch<Catalog>("/stripe/plans", { skipAuth: true })
      .then((x) => {
        if (!stopped) setCatalog(x);
      })
      .catch(() => {
        if (!stopped) setMessage("Paketler yüklenemedi. Lütfen sayfayı yenileyin.");
      });

    const refresh = () =>
      billingService.refreshWallet().then((x) => {
        if (!stopped) setWallet(x);
      });
    void refresh().catch(() => {
      if (!stopped) setMessage("Kredi bilgisi alınamadı. Tekrar deneyin.");
    });

    const sessionId = params.get("session_id");
    let timer: ReturnType<typeof setTimeout>;
    if (params.has("success") && sessionId) {
      let attempts = 0;
      const check = async () => {
        try {
          const result = await apiFetch<{ status: string }>(
            "/stripe/session?session_id=" + encodeURIComponent(sessionId),
          );
          if (stopped) return;
          if (result.status === "credited") {
            setMessage("✓ Ödemen doğrulandı, kredilerin hesabına anında eklendi!");
            await refresh();
            return;
          }
          if (result.status === "expired") {
            setMessage("Ödeme oturumunun süresi doldu. Yeni bir ödeme başlatabilirsin.");
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
      clearTimeout(timer);
    };
  }, []);

  async function buy(product: Product) {
    if (!getStoredSession()) {
      location.href = "/login/?redirect=" + encodeURIComponent("/checkout/");
      return;
    }
    setBusy(true);
    setMessage("Güvenli Stripe ödeme sayfası hazırlanıyor…");
    const result = await billingService.processCheckout({
      mode: product.mode,
      targetId: product.id,
      cycle: product.mode === "subscription" ? cycle : undefined,
    });
    if (result.stripeRedirectUrl) {
      location.assign(result.stripeRedirectUrl);
      return;
    }
    setMessage(result.message);
    setBusy(false);
  }

  // 3 Farklı Abonelik Paketi (explorer, pro, agency)
  const allowedSubIds = ["explorer", "pro", "agency"];
  // 3 Farklı Kredi Paketi (pack-starter, pack-popular, pack-master)
  const allowedPackIds = ["pack-starter", "pack-popular", "pack-master"];

  const filteredProducts = (catalog?.products || []).filter((p) => {
    if (tab === "subscription") return p.mode === "subscription" && allowedSubIds.includes(p.id);
    return p.mode === "credit_pack" && allowedPackIds.includes(p.id);
  });

  return (
    <div className="odeme-page-root">
      <HeaderNav />
      <main className="billing-home">
        <Link href="/ai/" className="billing-back">
          ← Seyahat asistanına dön
        </Link>

        <h1>Kredi &amp; Üyelik Masası</h1>
        <p>
          Yapay zeka asistanı ve harita masası için ihtiyacın olan planı seç. İstediğin zaman iptal
          et veya paketini yükselt, Stripe ile güvenli ve anında aktif.
        </p>

        {/* ── Kredi Takibi & Cüzdan Özeti ── */}
        <section className="billing-balance" aria-label="Kredi hesabı">
          <div>
            <span>Kullanılabilir AI Kredin</span>
            <strong>{signedIn ? wallet.credits.toLocaleString("tr-TR") : "—"}</strong>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#10b981" }}>
              {wallet.subscriptionTier === "agency"
                ? "Tur Lideri Planı"
                : wallet.subscriptionTier === "pro"
                  ? "Pro Kaşif Planı"
                  : wallet.subscriptionTier === "explorer"
                    ? "Kaşif Planı"
                    : "Gezgin (Ücretsiz Plan)"}
            </span>
            <Link href={signedIn ? "/ai/" : "/login/"}>
              {signedIn ? "Rotamı Planla" : "Giriş Yap"}
            </Link>
          </div>
        </section>

        {/* Karşılama Hediyesi */}
        <section className="billing-gift">
          <strong>İlk rotan bizden: 5 kredi hediye</strong>
          <p>
            {wallet.welcomeGift
              ? "Karşılama hediyen hesabına tanımlandı. Bu hediye tek seferliktir."
              : "Yeni hesabının e-postasını doğrula; ilk AI rotanı oluşturman için tek seferlik 5 kredi hesabına eklensin."}
          </p>
        </section>

        {/* Kredi Tüketim Maliyetleri */}
        <div className="billing-costs">
          <span>
            <b>{ACTION_CREDIT_COSTS.ai_deep_trip} kredi</b> Rota oluştur / derin plan
          </span>
          <span>
            <b>{ACTION_CREDIT_COSTS.ai_chat} kredi</b> Seyahat danışmanı sohbeti
          </span>
          <span>
            <b>Ücretsiz</b> Seyahat tercih soruları
          </span>
        </div>
        <p className="billing-explain">
          Kredi, ücretli üretim başlamadan ayrılır. İşlem başarısız olursa anında ve otomatik iade
          edilir.
        </p>

        {message && (
          <p className="billing-message" role="status">
            {message}
          </p>
        )}

        {catalog && !catalog.enabled && (
          <p className="billing-message">
            Kredi satışı yakında açılacak. Mevcut ve hediye kredilerini kullanabilirsin.
          </p>
        )}

        {/* ── Paket Türü Sekmeleri ── */}
        <div className="billing-tabs" aria-label="Paket türü">
          <button aria-pressed={tab === "subscription"} onClick={() => setTab("subscription")}>
            ⭐ 3 Abonelik Paketi
          </button>
          <button aria-pressed={tab === "credit_pack"} onClick={() => setTab("credit_pack")}>
            ⚡ Ek Kredi Paketleri (Kredi Bitince)
          </button>
        </div>

        {/* ── Aylık / Yıllık Satış Toggle (Abonelik Sekmesinde) ── */}
        {tab === "subscription" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "14px",
              margin: "18px 0 24px",
            }}
          >
            <span
              style={{
                fontSize: "0.95rem",
                fontWeight: cycle === "monthly" ? 800 : 500,
                color: cycle === "monthly" ? "#0f172a" : "#64748b",
                cursor: "pointer",
              }}
              onClick={() => setCycle("monthly")}
            >
              Aylık Satış
            </span>
            <button
              type="button"
              onClick={() => setCycle(cycle === "monthly" ? "yearly" : "monthly")}
              style={{
                width: "48px",
                height: "26px",
                borderRadius: "9999px",
                border: "none",
                background: cycle === "yearly" ? "#10b981" : "#cbd5e1",
                padding: "3px",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s ease",
              }}
              aria-label="Aylık ve Yıllık Ödeme Değiştir"
            >
              <span
                style={{
                  display: "block",
                  width: "20px",
                  height: "20px",
                  borderRadius: "9999px",
                  background: "#ffffff",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  transform: cycle === "yearly" ? "translateX(22px)" : "translateX(0)",
                  transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              />
            </button>
            <span
              style={{
                fontSize: "0.95rem",
                fontWeight: cycle === "yearly" ? 800 : 500,
                color: cycle === "yearly" ? "#0f172a" : "#64748b",
                cursor: "pointer",
              }}
              onClick={() => setCycle("yearly")}
            >
              Yıllık Satış
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                padding: "4px 8px",
                borderRadius: "6px",
                background: "#fef08a",
                color: "#854d0e",
              }}
            >
              %20 İNDİRİM (2 AY HEDİYE)
            </span>
          </div>
        )}

        {/* ── Ürün Kartları Listesi ── */}
        {!catalog ? (
          <p role="status">Paketler yükleniyor…</p>
        ) : (
          <div className="billing-products">
            {filteredProducts.map((product) => {
              const meta =
                tab === "subscription"
                  ? PLAN_NAMES[product.id] || { title: product.id, desc: "" }
                  : PACK_NAMES[product.id] || { title: product.id, desc: "" };

              const priceTRY =
                tab === "subscription" && cycle === "yearly" && YEARLY_RATES[product.id]
                  ? YEARLY_RATES[product.id]
                  : product.amount / 100;

              const isCurrent = wallet.subscriptionTier === product.id;

              return (
                <article
                  key={product.id}
                  className={`billing-product ${("highlight" in meta && meta.highlight) || ("popular" in meta && meta.popular) ? "highlight" : ""}`}
                >
                  {meta.badge && (
                    <span
                      style={{
                        position: "absolute",
                        top: "-12px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "#10b981",
                        color: "#fff",
                        padding: "4px 12px",
                        borderRadius: "9999px",
                        fontSize: "11px",
                        fontWeight: 800,
                      }}
                    >
                      {meta.badge}
                    </span>
                  )}
                  <h2>{meta.title}</h2>
                  <strong>{product.credits.toLocaleString("tr-TR")} kredi</strong>
                  <p>{meta.desc}</p>
                  <div className="billing-price">
                    {priceTRY.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                    {tab === "subscription" && <small> / ay</small>}
                  </div>
                  {tab === "subscription" && cycle === "yearly" && (
                    <p style={{ fontSize: "12px", color: "#10b981", fontWeight: 700 }}>
                      Yıllık faturalandırılır (Yıllık {(priceTRY * 12).toLocaleString("tr-TR")} ₺)
                    </p>
                  )}
                  <p>
                    {tab === "subscription"
                      ? "Abonelik dönemsel yenilenir. İstediğin an iptal edebilirsin."
                      : "Tek seferlik ek kredi alımı. Kredilerin süresi dolmaz."}
                  </p>
                  <button
                    disabled={busy || !product.available || isCurrent}
                    onClick={() => void buy(product)}
                  >
                    {!product.available
                      ? "Satış yakında"
                      : isCurrent
                        ? "Mevcut Planınız"
                        : busy
                          ? "Hazırlanıyor…"
                          : signedIn
                            ? tab === "subscription"
                              ? `${meta.title}'e Yükselt`
                              : "Hemen Kredi Yükle"
                            : "Giriş yap ve satın al"}
                  </button>
                </article>
              );
            })}
          </div>
        )}

        {wallet.subscriptionTier !== "free" && (
          <button
            className="billing-manage"
            onClick={() => void openStripeBillingPortal().catch((e) => setMessage(e.message))}
          >
            Aboneliğimi Stripe Üzerinden Yönet
          </button>
        )}

        <p className="billing-explain">
          Ödemeler Stripe üzerinden 256-bit SSL ve 3D Secure korumasıyla gerçekleşir. Krediler
          yalnızca ödeme sunucuda doğrulandıktan sonra anında hesabınıza yüklenir.
        </p>
      </main>
    </div>
  );
}

export { CheckoutPage as OdemePage };
