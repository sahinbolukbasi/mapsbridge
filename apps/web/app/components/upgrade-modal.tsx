"use client";

import React, { useState, useEffect } from "react";
import { billingService } from "../lib/billing/billing-service";
import { getStoredSession } from "../lib/cognito";
import { BillingCycle, SubscriptionTierId } from "../lib/billing/billing-types";
import "./upgrade-modal.css";

interface PlanItem {
  id: SubscriptionTierId;
  name: string;
  monthlyCredits: number;
  monthlyPrice: number;
  yearlyMonthlyPrice: number;
  highlight?: boolean;
  badge?: string;
  features: string[];
}

const PLANS: PlanItem[] = [
  {
    id: "explorer",
    name: "Kaşif",
    monthlyCredits: 100,
    monthlyPrice: 199,
    yearlyMonthlyPrice: 159,
    features: [
      "Aylık 100 AI Rota Kredisi",
      "Sınırsız Rota ve Durak Kaydı",
      "Google Maps'e Tek Tıkla Aktarım",
      "GPX & Çevrimdışı PDF Gezi Rehberi",
      "Standart AI Yanıt Hızı",
    ],
  },
  {
    id: "pro",
    name: "Pro Kaşif",
    monthlyCredits: 500,
    monthlyPrice: 499,
    yearlyMonthlyPrice: 399,
    highlight: true,
    badge: "EN POPÜLER",
    features: [
      "Aylık 500 AI Rota Kredisi",
      "Doğal Dilde AI ile Rota Düzenleme (v1, v2)",
      "Akıllı Gezi Arkadaşı Eşleşmesi (% Uyum)",
      "Otomatik Mekan Zenginleştirme Agent'ı",
      "Öncelikli 7/24 VIP Destek",
    ],
  },
  {
    id: "agency",
    name: "Tur Lideri & Grup",
    monthlyCredits: 2500,
    monthlyPrice: 1499,
    yearlyMonthlyPrice: 1199,
    features: [
      "Aylık 2.500 AI Rota Kredisi",
      "Toplu Gezi Grupları ve Eşzamanlı Canlı Rota",
      "Harita Üzerinde Özel Markalama",
      "Çoklu Rehber ve Ekip Koordinasyonu",
      "Özel Müşteri Temsilcisi",
    ],
  },
];

const PACKS = [
  {
    id: "pack-starter",
    title: "Hızlı Başlangıç",
    credits: 50,
    price: 89,
    desc: "10 kapsamlı AI seyahat planı ve harita analizi için ideal.",
  },
  {
    id: "pack-popular",
    title: "Popüler Gezgin",
    credits: 300,
    price: 299,
    popular: true,
    badge: "AVANTAJLI",
    desc: "Düzenli gezi planlayanlar için en çok tercih edilen ek paket.",
  },
  {
    id: "pack-master",
    title: "Usta Kaşif",
    credits: 1000,
    price: 749,
    desc: "Geniş rota kütüphanesi oluşturan kaşifler için dev paket.",
  },
];

export function UpgradeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [customReason, setCustomReason] = useState("");
  const [activeTab, setActiveTab] = useState<"subscriptions" | "packs">("subscriptions");
  const [cycle, setCycle] = useState<BillingCycle>("yearly");
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [wallet, setWallet] = useState(() => billingService.getWallet());

  useEffect(() => {
    const handleOpen = (e: CustomEvent<{ reason?: string; tab?: "subscriptions" | "packs" }>) => {
      setCustomReason(e.detail?.reason || "");
      if (e.detail?.tab) setActiveTab(e.detail.tab);
      setErrorMessage("");
      setIsOpen(true);
      void billingService.refreshWallet().then(setWallet).catch(() => {});
    };

    const handleWallet = (e: CustomEvent<any>) => {
      if (e.detail) setWallet(e.detail);
    };

    window.addEventListener("mapsbridge:open_upgrade_modal" as any, handleOpen);
    window.addEventListener("mapsbridge:wallet_updated" as any, handleWallet);

    return () => {
      window.removeEventListener("mapsbridge:open_upgrade_modal" as any, handleOpen);
      window.removeEventListener("mapsbridge:wallet_updated" as any, handleWallet);
    };
  }, []);

  if (!isOpen) return null;

  const handleCheckout = async (mode: "subscription" | "credit_pack", targetId: string) => {
    const session = getStoredSession();
    if (!session?.token) {
      window.location.assign("/login/?redirect=" + encodeURIComponent(window.location.pathname));
      return;
    }

    setBusyItem(targetId);
    setErrorMessage("");

    try {
      const result = await billingService.processCheckout({
        mode,
        targetId,
        cycle: mode === "subscription" ? cycle : undefined,
      });

      if (result.stripeRedirectUrl) {
        window.location.assign(result.stripeRedirectUrl);
      } else {
        setErrorMessage(result.message || "Ödeme başlatılamadı. Lütfen tekrar deneyin.");
        setBusyItem(null);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Ödeme servisine ulaşılamadı.");
      setBusyItem(null);
    }
  };

  const getTierName = (t: string) => {
    switch (t) {
      case "explorer": return "Kaşif";
      case "pro": return "Pro Kaşif";
      case "agency": return "Tur Lideri";
      default: return "Gezgin (Ücretsiz)";
    }
  };

  return (
    <div
      className="mb-upgrade-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busyItem) setIsOpen(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div className="mb-upgrade-modal-dialog">
        {/* Header */}
        <div className="mb-upgrade-modal-header">
          <div className="mb-upgrade-modal-title-wrap">
            <div className="mb-upgrade-modal-icon">
              <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                bolt
              </span>
            </div>
            <div>
              <h2 id="upgrade-modal-title">Kredi &amp; Üyelik Masası</h2>
              <p>Stripe ile 256-bit SSL güvenli ödeme · Taahhüt yok · Anında hesaba tanımlanır</p>
            </div>
          </div>
          <button
            type="button"
            className="mb-upgrade-modal-close-btn"
            onClick={() => !busyItem && setIsOpen(false)}
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="mb-upgrade-modal-body">
          {/* Current Status Card */}
          <div className="mb-upgrade-status-card">
            <div className="mb-upgrade-status-left">
              <span className="mb-upgrade-status-label">Hesap Durumu</span>
              <span className="mb-upgrade-status-val">
                {customReason || `${wallet.credits} Kredi Kullanılabilir`}
              </span>
            </div>
            <div className="mb-upgrade-status-badge">
              {getTierName(wallet.subscriptionTier)} Planı
            </div>
          </div>

          {errorMessage && (
            <div className="mb-upgrade-alert" role="alert">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Navigation Category Tabs */}
          <div className="mb-upgrade-category-tabs">
            <button
              type="button"
              className={`mb-upgrade-cat-tab-btn ${activeTab === "subscriptions" ? "active" : ""}`}
              onClick={() => setActiveTab("subscriptions")}
            >
              ⭐ 3 Abonelik Paketi (Yükselt)
            </button>
            <button
              type="button"
              className={`mb-upgrade-cat-tab-btn ${activeTab === "packs" ? "active" : ""}`}
              onClick={() => setActiveTab("packs")}
            >
              ⚡ Ek Kredi Paketleri (Anında Yükle)
            </button>
          </div>

          {activeTab === "subscriptions" ? (
            <>
              {/* Billing Cycle Toggle */}
              <div className="mb-upgrade-cycle-row">
                <span
                  className={`mb-upgrade-cycle-label ${cycle === "monthly" ? "active" : ""}`}
                  onClick={() => setCycle("monthly")}
                >
                  Aylık Ödeme
                </span>
                <button
                  type="button"
                  className={`mb-upgrade-cycle-toggle ${cycle === "yearly" ? "yearly" : ""}`}
                  onClick={() => setCycle(cycle === "monthly" ? "yearly" : "monthly")}
                  aria-label="Aylık ve Yıllık Ödeme Değiştir"
                >
                  <span className="mb-upgrade-cycle-knob" />
                </button>
                <span
                  className={`mb-upgrade-cycle-label ${cycle === "yearly" ? "active" : ""}`}
                  onClick={() => setCycle("yearly")}
                >
                  Yıllık Ödeme
                </span>
                <span className="mb-upgrade-discount-badge">%20 İNDİRİM (2 AY HEDİYE)</span>
              </div>

              {/* 3 Subscription Plans Grid */}
              <div className="mb-upgrade-plans-grid">
                {PLANS.map((plan) => {
                  const price = cycle === "yearly" ? plan.yearlyMonthlyPrice : plan.monthlyPrice;
                  const isCurrent = wallet.subscriptionTier === plan.id;
                  const isBusy = busyItem === plan.id;

                  return (
                    <div
                      key={plan.id}
                      className={`mb-upgrade-plan-card ${plan.highlight ? "highlight" : ""}`}
                    >
                      {plan.badge && <span className="mb-upgrade-popular-badge">{plan.badge}</span>}
                      <div className="mb-upgrade-plan-header">
                        <h3>{plan.name}</h3>
                        <div className="mb-upgrade-plan-credits">
                          ★ {plan.monthlyCredits.toLocaleString("tr-TR")} AI Kredisi / ay
                        </div>
                      </div>

                      <div className="mb-upgrade-plan-price-wrap">
                        <span className="mb-upgrade-plan-price">₺{price}</span>
                        <span className="mb-upgrade-plan-period">/ ay</span>
                      </div>

                      <ul className="mb-upgrade-plan-features">
                        {plan.features.map((feat, idx) => (
                          <li key={idx}>
                            <span className="mb-upgrade-feature-check">✓</span>
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        type="button"
                        className={`mb-upgrade-plan-btn ${plan.highlight ? "primary" : ""}`}
                        disabled={isBusy || isCurrent}
                        onClick={() => handleCheckout("subscription", plan.id)}
                      >
                        {isBusy
                          ? "Yönlendiriliyor…"
                          : isCurrent
                          ? "Mevcut Planınız"
                          : `${plan.name}'e Geç`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Extra Credit Packs Grid */
            <div className="mb-upgrade-packs-grid">
              {PACKS.map((pack) => {
                const isBusy = busyItem === pack.id;
                return (
                  <div
                    key={pack.id}
                    className={`mb-upgrade-pack-card ${pack.popular ? "popular" : ""}`}
                  >
                    {pack.badge && <span className="mb-upgrade-popular-badge">{pack.badge}</span>}
                    <div className="mb-upgrade-pack-top">
                      <span className="mb-upgrade-pack-title">{pack.title}</span>
                    </div>
                    <div className="mb-upgrade-pack-amount">
                      +{pack.credits.toLocaleString("tr-TR")} Kredi
                    </div>
                    <p className="mb-upgrade-pack-desc">{pack.desc}</p>
                    <div className="mb-upgrade-pack-price">₺{pack.price}</div>
                    <button
                      type="button"
                      className={`mb-upgrade-plan-btn ${pack.popular ? "primary" : ""}`}
                      disabled={isBusy}
                      onClick={() => handleCheckout("credit_pack", pack.id)}
                    >
                      {isBusy ? "Yönlendiriliyor…" : "Hemen Kredi Yükle"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mb-upgrade-footer-note">
            Ödemeler 256-bit SSL şifreleme ve 3D Secure ile doğrudan Stripe üzerinde gerçekleşir.
            Kart bilgileriniz sunucularımızda saklanmaz.
          </p>
        </div>
      </div>
    </div>
  );
}

export function openUpgradeModal(reason?: string, tab?: "subscriptions" | "packs") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("mapsbridge:open_upgrade_modal", {
        detail: { reason, tab },
      })
    );
  }
}
