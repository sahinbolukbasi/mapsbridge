"use client";

import React from "react";
import type { AnalyticsData } from "../../lib/types";
import { StatCard } from "../StatCard";

interface DashboardModuleProps {
  data: AnalyticsData;
}

export function DashboardModule({ data }: DashboardModuleProps) {
  const { realtime, dau, mau, financials, systemHealth } = data;

  return (
    <div>
      {/* 1. Finansal Özet Kartları */}
      <h2 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "14px", color: "var(--text-secondary)" }}>
        FİNANSAL & KREDİ ÖZETİ
      </h2>
      <div className="stat-grid">
        <StatCard
          label="Toplam Gelir"
          value={`₺${financials.totalRevenueTry.toLocaleString("tr-TR")}`}
          subValue="Polar.sh net tahsilat"
          badge={{ text: "+18.4% bu ay", tone: "success" }}
          icon="💰"
        />
        <StatCard
          label="Aylık Tekrarlayan Gelir (MRR)"
          value={`₺${financials.mrrTry.toLocaleString("tr-TR")}`}
          subValue={`${financials.activeSubscriptions} aktif abonelik`}
          badge={{ text: "Stabil", tone: "info" }}
          icon="📈"
        />
        <StatCard
          label="Dolaşımdaki AI Kredisi"
          value={financials.totalCreditsCirculating.toLocaleString("tr-TR")}
          subValue={`Bugün harcanan: ${financials.totalCreditsSpentToday}`}
          badge={{ text: "Yüksek hacim", tone: "info" }}
          icon="⚡"
        />
        <StatCard
          label="Net Kâr / Maliyet Dengesi"
          value={`%${financials.netProfitMargin}`}
          subValue={`Bugünkü LLM maliyeti: $${financials.llmCostTodayUsd}`}
          badge={{ text: "Yüksek Marj", tone: "success" }}
          icon="🎯"
        />
      </div>

      {/* 2. Platform Bazlı Aktif Kullanıcılar (Real-time, DAU, MAU) */}
      <h2 style={{ fontSize: "15px", fontWeight: 700, margin: "28px 0 14px 0", color: "var(--text-secondary)" }}>
        PLATFORM BAZLI AKTİF KULLANICILAR (WEB vs MOBİL)
      </h2>
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        {/* Real-time */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div className="pulse-dot" />
              <span className="panel-title">Anlık Online Kullanıcı</span>
            </div>
            <span style={{ fontSize: "18px", fontWeight: 800, color: "var(--accent-emerald)" }}>
              {realtime.total}
            </span>
          </div>
          <div className="panel-body">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "12.5px" }}>
                  <span>📱 iOS Uygulaması</span>
                  <span style={{ fontWeight: 600 }}>{realtime.ios} (%{Math.round((realtime.ios / realtime.total) * 100)})</span>
                </div>
                <div style={{ height: "6px", backgroundColor: "var(--bg-input)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: `${(realtime.ios / realtime.total) * 100}%`, height: "100%", backgroundColor: "#3b82f6" }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "12.5px" }}>
                  <span>💻 Web Tarayıcı</span>
                  <span style={{ fontWeight: 600 }}>{realtime.web} (%{Math.round((realtime.web / realtime.total) * 100)})</span>
                </div>
                <div style={{ height: "6px", backgroundColor: "var(--bg-input)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: `${(realtime.web / realtime.total) * 100}%`, height: "100%", backgroundColor: "#06b6d4" }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "12.5px" }}>
                  <span>🤖 Android Uygulaması</span>
                  <span style={{ fontWeight: 600 }}>{realtime.android} (%{Math.round((realtime.android / realtime.total) * 100)})</span>
                </div>
                <div style={{ height: "6px", backgroundColor: "var(--bg-input)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: `${(realtime.android / realtime.total) * 100}%`, height: "100%", backgroundColor: "#10b981" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Günlük Aktif Kullanıcı (DAU) */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <span className="panel-title">Günlük Aktif Kullanıcı (DAU)</span>
            <span style={{ fontSize: "18px", fontWeight: 800, color: "var(--accent-primary)" }}>
              {dau.total.toLocaleString("tr-TR")}
            </span>
          </div>
          <div className="panel-body">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "12.5px" }}>
                  <span>📱 iOS DAU</span>
                  <span style={{ fontWeight: 600 }}>{dau.ios.toLocaleString("tr-TR")}</span>
                </div>
                <div style={{ height: "6px", backgroundColor: "var(--bg-input)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: `${(dau.ios / dau.total) * 100}%`, height: "100%", backgroundColor: "#3b82f6" }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "12.5px" }}>
                  <span>💻 Web DAU</span>
                  <span style={{ fontWeight: 600 }}>{dau.web.toLocaleString("tr-TR")}</span>
                </div>
                <div style={{ height: "6px", backgroundColor: "var(--bg-input)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: `${(dau.web / dau.total) * 100}%`, height: "100%", backgroundColor: "#06b6d4" }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "12.5px" }}>
                  <span>🤖 Android DAU</span>
                  <span style={{ fontWeight: 600 }}>{dau.android.toLocaleString("tr-TR")}</span>
                </div>
                <div style={{ height: "6px", backgroundColor: "var(--bg-input)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: `${(dau.android / dau.total) * 100}%`, height: "100%", backgroundColor: "#10b981" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Aylık Aktif Kullanıcı (MAU) */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <span className="panel-title">Aylık Aktif Kullanıcı (MAU)</span>
            <span style={{ fontSize: "18px", fontWeight: 800, color: "var(--accent-purple)" }}>
              {mau.total.toLocaleString("tr-TR")}
            </span>
          </div>
          <div className="panel-body">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "12.5px" }}>
                  <span>📱 iOS MAU</span>
                  <span style={{ fontWeight: 600 }}>{mau.ios.toLocaleString("tr-TR")}</span>
                </div>
                <div style={{ height: "6px", backgroundColor: "var(--bg-input)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: `${(mau.ios / mau.total) * 100}%`, height: "100%", backgroundColor: "#3b82f6" }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "12.5px" }}>
                  <span>💻 Web MAU</span>
                  <span style={{ fontWeight: 600 }}>{mau.web.toLocaleString("tr-TR")}</span>
                </div>
                <div style={{ height: "6px", backgroundColor: "var(--bg-input)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: `${(mau.web / mau.total) * 100}%`, height: "100%", backgroundColor: "#06b6d4" }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "12.5px" }}>
                  <span>🤖 Android MAU</span>
                  <span style={{ fontWeight: 600 }}>{mau.android.toLocaleString("tr-TR")}</span>
                </div>
                <div style={{ height: "6px", backgroundColor: "var(--bg-input)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: `${(mau.android / mau.total) * 100}%`, height: "100%", backgroundColor: "#10b981" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sistem Sağlığı & Altyapı Metrikleri */}
      <h2 style={{ fontSize: "15px", fontWeight: 700, margin: "28px 0 14px 0", color: "var(--text-secondary)" }}>
        SİSTEM SAĞLIĞI & ALTYAPI DURUMU
      </h2>
      <div className="stat-grid">
        <StatCard
          label="API Yanıt Süresi (p95)"
          value={`${systemHealth.apiLatencyMs} ms`}
          subValue="AWS API Gateway + CloudFront"
          badge={{ text: "Hızlı", tone: "success" }}
          icon="⚡"
        />
        <StatCard
          label="Bedrock / LLM Yanıt Süresi"
          value={`${systemHealth.bedrockLatencyMs} ms`}
          subValue="Claude 3.5 Haiku + Llama 8B"
          badge={{ text: "Normal", tone: "info" }}
          icon="🧠"
        />
        <StatCard
          label="Hata Oranı (Son 24s)"
          value={`%${systemHealth.errorRatePercent}`}
          subValue="5xx ve runtime istisnaları"
          badge={{ text: "Kritik Sıfır", tone: "success" }}
          icon="🛡️"
        />
        <StatCard
          label="AWS Lambda & DynamoDB"
          value="OPERATIONAL"
          subValue={`DLQ bekleyen mesaj: ${systemHealth.sqsDlqCount}`}
          badge={{ text: "100% Uptime", tone: "success" }}
          icon="✅"
        />
      </div>
    </div>
  );
}
