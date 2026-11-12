"use client";

import React, { useState, useEffect } from "react";
import { useAdminAuth } from "./lib/auth-context";
import { AdminApiClient } from "./lib/api-client";
import type {
  ActiveAdminTab,
  AnalyticsData,
  PolarStatus,
  CreditTransaction,
  PolarWebhookEvent,
  AIAgentCoreConfig,
  AIFeedbackRecord,
  UserListItem,
  Campaign,
  SystemErrorRecord,
  AuditLogRecord,
} from "./lib/types";

import { AdminSidebar } from "./components/AdminSidebar";
import { AdminHeader } from "./components/AdminHeader";
import { DashboardModule } from "./components/modules/DashboardModule";
import { SubscriptionsModule } from "./components/modules/SubscriptionsModule";
import { AIAgentCoreModule } from "./components/modules/AIAgentCoreModule";
import { UsersManagementModule } from "./components/modules/UsersManagementModule";
import { CampaignsModule } from "./components/modules/CampaignsModule";
import { SystemLogsModule } from "./components/modules/SystemLogsModule";

export default function AdminPage() {
  const { session, loading: authLoading, login, verifyMfa } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<ActiveAdminTab>("dashboard");

  // Login form state
  const [email, setEmail] = useState("admin@mapsbridge.com");
  const [password, setPassword] = useState("AdminPass2026!");
  const [otp, setOtp] = useState("");
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // App data state
  const [dataLoading, setDataLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [polar, setPolar] = useState<PolarStatus | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [webhooks, setWebhooks] = useState<PolarWebhookEvent[]>([]);
  const [aiConfig, setAiConfig] = useState<AIAgentCoreConfig | null>(null);
  const [feedback, setFeedback] = useState<AIFeedbackRecord[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [errors, setErrors] = useState<SystemErrorRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadAllData = async () => {
    setDataLoading(true);
    try {
      const [
        analyticsData,
        polarStatus,
        txList,
        webhookList,
        aiCfg,
        fbList,
        userList,
        cmpList,
        errList,
        auditList,
      ] = await Promise.all([
        AdminApiClient.getAnalytics(),
        AdminApiClient.getPolarStatus(),
        AdminApiClient.getCreditTransactions(),
        AdminApiClient.getPolarWebhooks(),
        AdminApiClient.getAIDetailedConfig(),
        AdminApiClient.getAIFeedback(),
        AdminApiClient.getUsers(),
        AdminApiClient.getCampaigns(),
        AdminApiClient.getSystemErrors(),
        AdminApiClient.getAuditLogs(),
      ]);

      setAnalytics(analyticsData);
      setPolar(polarStatus);
      setTransactions(txList);
      setWebhooks(webhookList);
      setAiConfig(aiCfg);
      setFeedback(fbList);
      setUsers(userList);
      setCampaigns(cmpList);
      setErrors(errList);
      setAuditLogs(auditList);
    } finally {
      setDataLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (session) {
      AdminApiClient.setToken(session.token);
      loadAllData();
    }
  }, [session]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAllData();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setSubmitting(true);

    try {
      if (requiresMfa) {
        const res = await verifyMfa(otp);
        if (!res.success) {
          setLoginError(res.error || "2FA doğrulama başarısız.");
        }
      } else {
        const res = await login(email, password);
        if (res.requiresMfa) {
          setRequiresMfa(true);
        } else if (!res.success) {
          setLoginError(res.error || "Giriş başarısız.");
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="pulse-dot" />
      </div>
    );
  }

  // Not logged in -> Show Isolated Admin Login (with MFA/2FA)
  if (!session) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--bg-page)",
          padding: "20px",
        }}
      >
        <div className="modal-card" style={{ maxWidth: "440px" }}>
          <div className="modal-header" style={{ flexDirection: "column", alignItems: "flex-start", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  color: "#fff",
                  fontSize: "14px",
                }}
              >
                M
              </div>
              <span style={{ fontSize: "16px", fontWeight: 700 }}>MapsBridge Admin Portal</span>
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              admin.mapsbridge.com izole oturum ve MFA/2FA kontrolü
            </span>
          </div>

          <form onSubmit={handleLoginSubmit}>
            <div className="modal-body">
              {loginError && (
                <div
                  style={{
                    padding: "10px 14px",
                    backgroundColor: "rgba(244, 63, 94, 0.15)",
                    color: "var(--badge-text-rose)",
                    borderRadius: "var(--radius-sm)",
                    marginBottom: "16px",
                    fontSize: "12.5px",
                    fontWeight: 600,
                  }}
                >
                  {loginError}
                </div>
              )}

              {!requiresMfa ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Yönetici E-Postası</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Yönetici Şifresi</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "20px" }}>🔐</span>
                    <div>
                      <label className="form-label" style={{ marginBottom: 0 }}>2FA / MFA Doğrulama Kodu</label>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        Google Authenticator veya 6 haneli güvenlik anahtarınızı girin
                      </span>
                    </div>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    className="form-input"
                    style={{ fontSize: "20px", letterSpacing: "8px", textAlign: "center", fontWeight: 700 }}
                  />
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ justifyContent: "space-between" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                RBAC & IP Korumalı Bölge
              </span>
              <button type="submit" disabled={submitting} className="btn btn-primary">
                {submitting
                  ? "Doğrulanıyor..."
                  : requiresMfa
                  ? "Kodu Doğrula ve Giriş Yap"
                  : "Devam Et (MFA Adımı) →"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Logged in -> Main Shell
  return (
    <div className="admin-shell">
      <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="admin-main">
        <AdminHeader activeTab={activeTab} onRefresh={handleRefresh} refreshing={refreshing} />

        <div className="admin-content">
          {dataLoading && !analytics ? (
            <div style={{ height: "300px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
              <div className="pulse-dot" />
              <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>Yönetim paneli verileri yükleniyor...</span>
            </div>
          ) : (
            <>
              {activeTab === "dashboard" && analytics && (
                <DashboardModule data={analytics} />
              )}

              {activeTab === "subscriptions" && polar && (
                <SubscriptionsModule
                  polar={polar}
                  transactions={transactions}
                  webhooks={webhooks}
                  onRefresh={handleRefresh}
                />
              )}

              {activeTab === "ai-agentcore" && aiConfig && (
                <AIAgentCoreModule
                  config={aiConfig}
                  feedback={feedback}
                  onRefresh={handleRefresh}
                />
              )}

              {activeTab === "users" && (
                <UsersManagementModule users={users} onRefresh={handleRefresh} />
              )}

              {activeTab === "campaigns" && (
                <CampaignsModule campaigns={campaigns} onRefresh={handleRefresh} />
              )}

              {activeTab === "logs-errors" && (
                <SystemLogsModule errors={errors} auditLogs={auditLogs} onRefresh={handleRefresh} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

