"use client";

import React from "react";
import { useAdminAuth } from "../lib/auth-context";
import type { ActiveAdminTab } from "../lib/types";

interface AdminSidebarProps {
  activeTab: ActiveAdminTab;
  onTabChange: (tab: ActiveAdminTab) => void;
}

export function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
  const { session } = useAdminAuth();

  const NAV_ITEMS: { id: ActiveAdminTab; label: string; icon: string }[] = [
    { id: "dashboard", label: "Canlı İzleme & Analitik", icon: "📊" },
    { id: "subscriptions", label: "Abonelik & Polar.sh", icon: "💳" },
    { id: "ai-agentcore", label: "Bedrock AI & Harness", icon: "🧠" },
    { id: "users", label: "Kullanıcılar & Profiller", icon: "👥" },
    { id: "campaigns", label: "Kampanya & Bildirimler", icon: "📢" },
    { id: "logs-errors", label: "Loglar & Hata Takibi", icon: "🛡️" },
  ];

  return (
    <aside className="admin-sidebar">
      <div className="brand-box">
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "16px",
            fontWeight: 800,
            color: "#fff",
          }}
        >
          M
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="brand-title">MapsBridge</span>
            <span className="brand-badge">ADMIN</span>
          </div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>v2.4.0 (Isolated)</span>
        </div>
      </div>

      <nav className="nav-section">
        {NAV_ITEMS.map((item) => (
          <div
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`nav-item ${activeTab === item.id ? "active" : ""}`}
          >
            <span style={{ fontSize: "16px" }}>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-snippet">
          <div className="avatar">
            {session?.user.name ? session.user.name.charAt(0).toUpperCase() : "A"}
          </div>
          <div className="user-info">
            <span className="user-name">{session?.user.name || "Yönetici"}</span>
            <span className="user-role">{session?.user.role || "SUPER_ADMIN"} (2FA Aktif)</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

