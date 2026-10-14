"use client";

import { useState, useEffect } from "react";
import { HeaderNav } from "../components/header-nav";
import { getStoredSession } from "../lib/cognito";
import { AuthActionModal } from "../components/auth-gate";
import "./u.css";

interface PricingFeature {
  text: string;
  included: boolean;
}

interface PricingTier {
  id: "free" | "explorer" | "pro";
  name: string;
  emoji: string;
  monthly: number;
  yearly: number;
  tagline: string;
  features: PricingFeature[];
  highlight?: boolean;
}

const TIERS: PricingTier[] = [
  {
    id: "free",
    name: "Başlangıç",
    emoji: "🎒",
    monthly: 0,
    yearly: 0,
    tagline: "Harita keşfi ve temel paylaşım için",
    features: [
      { text: "5 AI rota sorgusu / ay", included: true },
      { text: "2 grup gezisi (5 üyeye kadar)", included: true },
      { text: "3 herkese açık rota", included: true },
      { text: "6 haneli kodla konum paylaşımı", included: true },
      { text: "Sınırsız AI sohbet", included: false },
      { text: "Premium grup & özel rotalar", included: false },
    ],
  },
  {
    id: "explorer",
    name: "Kaşif",
    emoji: "🧭",
    monthly: 499,
    yearly: 399,
    tagline: "Sık seyahat edenler için genişletilmiş paket",
    features: [
      { text: "50 AI rota sorgusu / ay", included: true },
      { text: "10 grup gezisi (20 üyeye kadar)", included: true },
      { text: "Sınırsız herkese açık rota", included: true },
      { text: "Özel rota şablonları", included: true },
      { text: "Rota pazarında satış", included: false },
      { text: "Öncelikli AI yanıtı", included: true },
    ],
    highlight: true,
  },
  {
    id: "pro",
    name: "Profesyonel",
    emoji: "💎",
    monthly: 999,
    yearly: 799,
    tagline: "Rehberler ve etkinlik organizatörleri için",
    features: [
      { text: "Sınırsız AI rota sorgusu", included: true },
      { text: "Sınırsız grup (20+ üye)", included: true },
      { text: "Ücretli etkinlik oluşturma", included: true },
      { text: "Özel rotaları satma (rota pazarı)", included: true },
      { text: "Gelişmiş analitik & istatistik", included: true },
      { text: "Öncelikli destek", included: true },
    ],
  },
];

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const session = getStoredSession();
    if (session?.token) setIsLoggedIn(true);
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function handleSelectPlan(tierId: string) {
    const tier = TIERS.find((t) => t.id === tierId);
    if (!tier) return;
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }
    if (tier.monthly === 0) {
      // Ücretsiz plan — localStorage'a yaz
      try {
        localStorage.setItem("mapsbridge.subscription", JSON.stringify({ plan: "free", cycle: billingCycle }));
      } catch {}
      showToast("✓ Başlangıç planı aktive edildi!");
      return;
    }
    setSelectedTier(tierId);
    setShowCheckout(true);
  }

  function handleConfirmCheckout() {
    const tier = TIERS.find((t) => t.id === selectedTier);
    if (!tier) return;
    const price = billingCycle === "yearly" ? tier.yearly : tier.monthly;
    try {
      localStorage.setItem("mapsbridge.subscription", JSON.stringify({ plan: tier.id, cycle: billingCycle, price, startDate: new Date().toISOString() }));
    } catch {}
    setShowCheckout(false);
    setSelectedTier(null);
    showToast(`🎉 ${tier.name} planınız aktive edildi! (${billingCycle === "yearly" ? "Yıllık" : "Aylık"})`);
  }

  const formatPrice = (cents: number) => {
    if (cents === 0) return "Ücretsiz";
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="pricing-page-root">
      <HeaderNav />

      {toast && (
        <div className="pricing-toast">
          <span>{toast}</span>
        </div>
      )}

      <main className="pricing-container">
        <div className="pricing-header">
          <div className="pricing-eyebrow">
            <span>💎</span> MAPSBRIDGE PREMIUM
          </div>
          <h1 className="pricing-title">
            Seyahatin <span className="pricing-gradient">gücünü aç</span>
          </h1>
          <p className="pricing-sub">
            AI rota kotaları, büyük grup gezileri ve rota pazarı — seyahatlerinizi bir üst seviyeye taşıyın.
          </p>

          {/* Fatura Dönemi Toggle */}
          <div className="billing-toggle" role="group" aria-label="Fatura dönemi seçimi">
            <button
              type="button"
              className={`billing-toggle-btn ${billingCycle === "monthly" ? "active" : ""}`}
              onClick={() => setBillingCycle("monthly")}
            >
              Aylık
            </button>
            <button
              type="button"
              className={`billing-toggle-btn ${billingCycle === "yearly" ? "active" : ""}`}
              onClick={() => setBillingCycle("yearly")}
            >
              Yıllık <span className="save-badge">%20 Tasarruf</span>
            </button>
          </div>
        </div>

        {/* Plan Kartları */}
        <div className="pricing-grid">
          {TIERS.map((tier) => {
            const price = billingCycle === "yearly" ? tier.yearly : tier.monthly;
            return (
              <div key={tier.id} className={`pricing-card ${tier.highlight ? "highlight" : ""}`}>
                {tier.highlight && <span className="pricing-most-popular">EN POPÜLER</span>}
                <div className="pricing-card-head">
                  <span className="pricing-plan-emoji">{tier.emoji}</span>
                  <h3 className="pricing-plan-name">{tier.name}</h3>
                  <p className="pricing-plan-tagline">{tier.tagline}</p>
                </div>

                <div className="pricing-price-row">
                  <span className="pricing-price">
                    {price === 0 ? "Ücretsiz" : <>{formatPrice(price)}<small>/ay</small></>}
                  </span>
                  {billingCycle === "yearly" && price > 0 && (
                    <span className="pricing-monthly-note">
                      {formatPrice(tier.monthly)}/ay yerine
                    </span>
                  )}
                </div>

                <ul className="pricing-features">
                  {tier.features.map((f, i) => (
                    <li key={i} className={f.included ? "" : "not-included"}>
                      <span>{f.included ? "✓" : "—"}</span>
                      {f.text}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className={`pricing-select-btn ${tier.highlight ? "primary" : "ghost"}`}
                  onClick={() => handleSelectPlan(tier.id)}
                >
                  {tier.monthly === 0 ? "Ücretsiz Başla" : `${tier.name} Planına Geç`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Güvenilirlik Rozetleri */}
        <div className="pricing-assurance">
          <span>🔒 Güvenli ödeme · Stripe tarafından korunur</span>
          <span>↩️ 14 gün iade garantisi</span>
          <span>⏱️ İstediğin an iptal</span>
        </div>
      </main>

      {/* Ödeme Onay Modalı */}
      {showCheckout && (
        <div className="pricing-modal-overlay" onClick={() => setShowCheckout(false)}>
          <div className="pricing-checkout-card" onClick={(e) => e.stopPropagation()}>
            <div className="pricing-checkout-head">
              <span className="checkout-icon">💳</span>
              <div>
                <h3>Planını Onayla</h3>
                <p>Sipariş özetini kontrol et ve devam et</p>
              </div>
              <button type="button" className="pricing-close-btn" onClick={() => setShowCheckout(false)}>✕</button>
            </div>

            {selectedTier && (() => {
              const tier = TIERS.find((t) => t.id === selectedTier)!;
              const price = billingCycle === "yearly" ? tier.yearly : tier.monthly;
              return (
                <div className="checkout-details">
                  <div className="checkout-plan-row">
                    <span className="checkout-plan-emoji">{tier.emoji}</span>
                    <div>
                      <strong>{tier.name} Planı</strong>
                      <span>{billingCycle === "yearly" ? "Yıllık fatura" : "Aylık fatura"}</span>
                    </div>
                    <span className="checkout-plan-price">{formatPrice(price)}/ay</span>
                  </div>

                  <div className="checkout-divider" />

                  <div className="checkout-total-row">
                    <span>Toplam</span>
                    <strong>
                      {price === 0 ? "Ücretsiz" : formatPrice(price)}
                      {price > 0 && <small> / {billingCycle === "yearly" ? "yıl" : "ay"}</small>}
                    </strong>
                  </div>

                  <div className="checkout-note">
                    💡 Bu bir demo akıştır. Gerçek Stripe ödeme entegrasyonu Faz 2 kapsamında eklenecektir.
                  </div>

                  <button
                    type="button"
                    className="checkout-confirm-btn"
                    onClick={handleConfirmCheckout}
                  >
                    Ödemeyi Onayla & Aktive Et
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <AuthActionModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Premium İçin Üye Olun"
        subtitle="Abonelik planlarına erişmek için lütfen ücretsiz bir MapsBridge hesabı oluşturun veya giriş yapın."
        featureName="Premium Abonelik"
        nextUrl="/u/"
      />
    </div>
  );
}