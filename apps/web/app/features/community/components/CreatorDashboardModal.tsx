"use client";

import React from "react";
import type { MarketRoute } from "../types";

interface CreatorDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorMetrics: {
    revenue: number;
    routeViews: number;
    conversionRate: number | string;
    savesCount: number;
    followersCount: number | string;
  };
  marketRoutes: MarketRoute[];
}

export function CreatorDashboardModal({
  isOpen,
  onClose,
  creatorMetrics,
  marketRoutes,
}: CreatorDashboardModalProps) {
  if (!isOpen) return null;

  return (
    <div className="community-modal-overlay" onClick={onClose}>
      <div className="creator-dashboard-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dashboard-modal-header">
          <div>
            <span className="space-eyebrow">GEZGİN PROFİLİ · ETKİLEŞİM &amp; TOPLULUK</span>
            <h3 className="space-title">Gezgin Analitikleri &amp; İlgi Uyumu</h3>
          </div>
          <button type="button" className="btn-modal-close-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* KPI Metrics Grid */}
        <div className="kpi-metrics-grid">
          <div className="kpi-card revenue">
            <span className="kpi-title">Masaya Klonlama</span>
            <strong className="kpi-value">{creatorMetrics.savesCount * 4 || 1240}</strong>
            <span className="kpi-sub">Gezginlerin Aldığı Rotalar</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-title">Rota Görüntülenmesi</span>
            <strong className="kpi-value">{creatorMetrics.routeViews.toLocaleString()}</strong>
            <span className="kpi-sub">Keşif &amp; Akış Trafiği</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-title">Gezi Arkadaşı Eşleşmesi</span>
            <strong className="kpi-value">48 Eşleşme</strong>
            <span className="kpi-sub">AI İlgi Uyumu</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-title">Dönüşüm Oranı</span>
            <strong className="kpi-value">%{creatorMetrics.conversionRate}</strong>
            <span className="kpi-sub">Görüntüleme ➔ Klonlama</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-title">Rota Kaydetmeleri</span>
            <strong className="kpi-value">{creatorMetrics.savesCount}</strong>
            <span className="kpi-sub">Seyahate Eklenenler</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-title">Takipçiler</span>
            <strong className="kpi-value">{creatorMetrics.followersCount}</strong>
            <span className="kpi-sub">Gezgin Kitlesi</span>
          </div>
        </div>

        {/* Traveler Verified Status Card */}
        <div className="stripe-status-banner">
          <div className="stripe-status-left">
            <span className="stripe-dot">●</span>
            <div>
              <strong>Doğrulanmış Gezgin Rozeti Aktif</strong>
              <p>Yayınladığınız rotalar topluluk kütüphanesinde öncelikli olarak önerilmektedir.</p>
            </div>
          </div>
          <span className="stripe-verified-pill">Doğrulandı ✓</span>
        </div>

        {/* Creator's Content List */}
        <div className="creator-content-section">
          <h4>Toplulukta Paylaştığınız Rotalar</h4>
          <div className="creator-items-table">
            {marketRoutes.slice(0, 3).map((r) => (
              <div key={r.id} className="creator-table-row">
                <div>
                  <strong>{r.title}</strong>
                  <span>
                    {r.destination} • {r.stopCount} Durak
                  </span>
                </div>
                <div className="table-row-metrics">
                  <span>{r.salesCount || 85} Klonlama</span>
                  <strong>Topluluk Rotası</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
