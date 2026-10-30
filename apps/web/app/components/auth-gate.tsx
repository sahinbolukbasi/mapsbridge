"use client";

import React from "react";
import { PageHeader, PageShell } from "./ui";
import { GoogleAuthButton } from "./google-auth-button";
import "./auth-gate.css";

export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

export interface SampleItem {
  title: string;
  description: string;
}

export interface FullPagePromotionProps {
  badgeText: string;
  badgeIcon?: string;
  heroTitle: string;
  heroSubtitle: string;
  features: FeatureItem[];
  samplesTitle?: string;
  samples?: SampleItem[];
  nextUrl: string;
  primaryButtonText?: string;
  secondaryButtonText?: string;
  /** Düz metin başlık (`<title>`/chrome-check); verilmezse heroTitle. C7'de registry'den. */
  titleText?: string;
}

/**
 * Full Page Promotion Gate
 * Displayed when an unauthenticated user navigates directly to a member-only feature
 * (e.g. /ai/, /profil/, /mesajlar/)
 */
export function FullPagePromotion({
  badgeText,
  badgeIcon = "✨",
  heroTitle,
  heroSubtitle,
  features,
  samplesTitle,
  samples,
  nextUrl,
  primaryButtonText = "Hemen Ücretsiz Başla",
  secondaryButtonText = "Giriş Yap",
  titleText,
}: FullPagePromotionProps) {
  const signupLink = `/register/?next=${encodeURIComponent(nextUrl)}`;
  const loginLink = `/login/?next=${encodeURIComponent(nextUrl)}`;

  // Kimlik kapısı (design §4.5): chrome SiteChrome'dadır; kapı kendi PageShell'ini ve tek h1'ini
  // (PageHeader) render eder. Zemin açık olduğu için yüzey varsayılandır (inverse değil).
  return (
    <PageShell layout="landing" className="promotion-page-root">
      <div className="promo-ambient-glow-1" aria-hidden="true" />
      <div className="promo-ambient-glow-2" aria-hidden="true" />
      <div className="promotion-page-flex">
        <div className="promo-main-content">
          <div className="promo-badge">
            <span className="promo-badge-icon">{badgeIcon}</span>
            <span>{badgeText}</span>
          </div>

          <PageHeader
            variant="hero"
            title={heroTitle}
            titleText={titleText}
            titleClassName="promo-hero-title"
          />
          <p className="promo-hero-subtitle">{heroSubtitle}</p>

          <div className="promo-actions-group">
            <a href={signupLink} className="promo-btn-primary">
              <span>🚀</span>
              <span>{primaryButtonText}</span>
            </a>
            <a href={loginLink} className="promo-btn-secondary">
              <span>🔑</span>
              <span>{secondaryButtonText}</span>
            </a>
          </div>

          {/* 4 Feature Value Pillars */}
          <div className="promo-features-grid">
            {features.map((f, i) => (
              <div key={i} className="promo-feature-card">
                <div className="promo-card-icon-wrap">{f.icon}</div>
                <h3 className="promo-card-title">{f.title}</h3>
                <p className="promo-card-desc">{f.description}</p>
              </div>
            ))}
          </div>

          {/* Samples / Teasers */}
          {samples && samples.length > 0 && (
            <div className="promo-teaser-container">
              <div className="promo-teaser-header">
                <h3 className="promo-teaser-title">
                  <span>⚡</span>
                  <span>{samplesTitle || "Örnek Deneyimler & Rotalar"}</span>
                </h3>
                <div className="promo-teaser-pills">
                  <span className="promo-teaser-pill">Yapay Zeka</span>
                  <span className="promo-teaser-pill">Çoklu Durak</span>
                  <span className="promo-teaser-pill">Süreli Şifreleme</span>
                </div>
              </div>
              <div className="promo-samples-grid">
                {samples.map((s, idx) => (
                  <div key={idx} className="promo-sample-card">
                    <strong>{s.title}</strong>
                    <p>{s.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

export interface AuthActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  featureName?: string;
  nextUrl?: string;
}

/**
 * Action Interceptor Modal
 * Triggered in /desk/ or other interactive screens when an unauthenticated
 * visitor attempts to perform a write or sensitive action (e.g. Save Address, Share Location, Add Tab).
 */
export function AuthActionModal({
  isOpen,
  onClose,
  title = "MapsBridge Üyeliği Gereklidir",
  subtitle = "Bu işlemi gerçekleştirmek, duraklarınızı kaydetmek ve güvenli paylaşım oluşturmak için lütfen ücretsiz üye olun veya giriş yapın.",
  featureName = "Özel Gezgin Özelliği",
  nextUrl = "/maps/",
}: AuthActionModalProps) {
  if (!isOpen) return null;

  const signupLink = `/register/?next=${encodeURIComponent(nextUrl)}`;
  const loginLink = `/login/?next=${encodeURIComponent(nextUrl)}`;

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div
        className="auth-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="auth-modal-close-btn" onClick={onClose} aria-label="Kapat">
          ✕
        </button>

        <div className="auth-modal-badge">
          <span>🔒</span>
          <span>{featureName}</span>
        </div>

        <h2 className="auth-modal-title">{title}</h2>
        <p className="auth-modal-subtitle">{subtitle}</p>

        <ul className="auth-modal-perks">
          <li className="auth-modal-perk-item">
            <span className="auth-modal-perk-check">✓</span>
            <span>Süreli, şifreli ve tahmin edilemez konum paylaşımı</span>
          </li>
          <li className="auth-modal-perk-item">
            <span className="auth-modal-perk-check">✓</span>
            <span>Sınırsız seyahat grubu, durak ve harita notu kaydetme</span>
          </li>
          <li className="auth-modal-perk-item">
            <span className="auth-modal-perk-check">✓</span>
            <span>Yapay zeka destekli akıllı rota ve gezi planlayıcı</span>
          </li>
          <li className="auth-modal-perk-item">
            <span className="auth-modal-perk-check">✓</span>
            <span>Tüm cihazlarınızla anında bulut senkronizasyonu</span>
          </li>
        </ul>

        <div style={{ marginBottom: "0.85rem" }}>
          <GoogleAuthButton mode="signin" nextUrl={nextUrl} />
        </div>

        <div className="auth-modal-actions">
          <a href={signupLink} className="auth-modal-signup-btn">
            <span>🚀</span>
            <span>Hemen Ücretsiz Kayıt Ol</span>
          </a>
          <a href={loginLink} className="auth-modal-login-btn">
            <span>Zaten Hesabım Var, Giriş Yap</span>
          </a>
        </div>
      </div>
    </div>
  );
}

export interface PanelGuestBannerProps {
  onRegisterClick?: () => void;
  nextUrl?: string;
}

/**
 * Top Guest Banner for /desk/
 * Lets visitors know they are exploring as guest and guides them to register.
 */
export function PanelGuestBanner({ nextUrl = "/maps/" }: PanelGuestBannerProps) {
  const signupLink = `/register/?next=${encodeURIComponent(nextUrl)}`;
  const loginLink = `/login/?next=${encodeURIComponent(nextUrl)}`;

  return (
    <div className="panel-guest-banner" role="banner">
      <div className="panel-guest-banner-left">
        <span className="panel-guest-banner-icon">🌟</span>
        <div>
          <strong>Harita Masası Önizleme:</strong> Kendi özel seyahat rotanızı çizmek, yeni duraklar
          eklemek ve planlarınızı kaydetmek için ücretsiz üye olun veya giriş yapın.
        </div>
      </div>
      <div className="panel-guest-banner-actions">
        <a href={signupLink} className="panel-guest-cta-btn">
          🚀 Ücretsiz Kayıt Ol
        </a>
        <a href={loginLink} className="panel-guest-sub-btn">
          🔑 Giriş Yap
        </a>
      </div>
    </div>
  );
}
