"use client";

import React from "react";
import { useAdminAuth } from "../lib/auth-context";
import type { ActiveAdminTab } from "../lib/types";

interface AdminHeaderProps {
  activeTab: ActiveAdminTab;
  onRefresh?: () => void;
  refreshing?: boolean;
}

const TAB_TITLES: Record<ActiveAdminTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Canlı İzleme & Analitik",
    subtitle: "Web ve Mobil (iOS / Android) anlık kullanıcılar, finansal özet ve servis sağlığı",
  },
  subscriptions: {
    title: "Abonelik, Ödeme & Polar.sh",
    subtitle: "Polar CLI ürün eşitlemesi, kredi defteri (ledger) ve gerçekleşen satış işlemleri",
  },
  "ai-agentcore": {
    title: "Bedrock AgentCore & AI Harness",
    subtitle: "Canlı sistem promptları, model yönlendirme (routing), Vector DB ve kullanıcı geri bildirimleri",
  },
  users: {
    title: "Kullanıcı & Hesap Yönetimi",
    subtitle: "Kullanıcı profilleri, oluşturulan rotalar, seyahat belgeleri ve hesap güvenliği",
  },
  campaigns: {
    title: "Kampanya & Bildirim Merkezi",
    subtitle: "Web ve mobil (Push notification) için çok kanallı segmentli bildirim gönderimi",
  },
  "logs-errors": {
    title: "Sistem Logları & Hata Takibi",
    subtitle: "Merkezi log arşivi, hata ayıklama (error tracking) ve AWS CloudWatch servis monitörü",
  },
};

export function AdminHeader({ activeTab, onRefresh, refreshing }: AdminHeaderProps) {
  const { session, logout } = useAdminAuth();
  const info = TAB_TITLES[activeTab];

  return (
    <header className="admin-header">
      <div>
        <h1 style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "-0.01em" }}>
          {info.title}
        </h1>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{info.subtitle}</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            padding: "6px 12px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
          }}
        >
          <div className="pulse-dot" />
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent-emerald)" }}>
            admin.mapsbridge.com (İzole Canlı)
          </span>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="btn btn-secondary btn-sm"
            title="Verileri Yenile"
          >
            {refreshing ? "Yenileniyor..." : "↻ Yenile"}
          </button>
        )}

        <button onClick={logout} className="btn btn-danger btn-sm" title="Güvenli Çıkış Yap">
          Çıkış
        </button>
      </div>
    </header>
  );
}
