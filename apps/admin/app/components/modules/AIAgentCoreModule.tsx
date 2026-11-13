"use client";

import React, { useState, useEffect } from "react";
import { AdminApiClient } from "../../lib/api-client";
import type { AIAgentCoreConfig, AIFeedbackRecord } from "../../lib/types";

export interface AIAgentCoreModuleProps {
  config?: AIAgentCoreConfig;
  feedback?: AIFeedbackRecord[];
  onRefresh?: () => void;
}

type ActiveTab =
  | "prompts"
  | "routing"
  | "subagents"
  | "autonomous"
  | "isolated_lab"
  | "feedback";

const BEDROCK_MODEL_OPTIONS = [
  {
    id: "eu.amazon.nova-micro-v1:0",
    label: "Amazon Nova Micro v1 (Tier-1 • ~250ms • $0.035/1M) — Ultra Hızlı Intake",
  },
  {
    id: "eu.amazon.nova-lite-v1:0",
    label: "Amazon Nova Lite v1 (Tier-2 • ~750ms • $0.06/1M) — Standart Sohbet & Concierge",
  },
  {
    id: "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
    label: "Claude Haiku 4.5 (Tier-3 • ~1400ms • $0.80/1M) — Ana Rota & Yüksek Kalite Planlama",
  },
  {
    id: "eu.anthropic.claude-3-5-sonnet-20241022-v2:0",
    label: "Claude 3.5 Sonnet v2 (Tier-4 • ~2800ms • $3.00/1M) — Derin Yeniden Planlama & Lab",
  },
  {
    id: "anthropic.claude-3-5-haiku-20241022-v1:0",
    label: "Claude 3.5 Haiku (Legacy Uyumlu)",
  },
  {
    id: "meta.llama3-1-8b-instruct-v1:0",
    label: "Meta Llama 3.1 8B Instruct",
  },
];

export function AIAgentCoreModule({
  config: initialConfig,
  feedback: initialFeedback,
  onRefresh,
}: AIAgentCoreModuleProps = {}) {
  const [config, setConfig] = useState<AIAgentCoreConfig | null>(initialConfig || null);
  const [feedbacks, setFeedbacks] = useState<AIFeedbackRecord[]>(initialFeedback || []);
  const [loading, setLoading] = useState(!initialConfig);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("prompts");

  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
      setLoading(false);
    } else {
      void loadAll();
    }
  }, [initialConfig]);

  useEffect(() => {
    if (initialFeedback) {
      setFeedbacks(initialFeedback);
    }
  }, [initialFeedback]);

  async function loadAll() {
    setLoading(true);
    try {
      const [cfgRes, fbRes] = await Promise.all([
        AdminApiClient.getAIDetailedConfig(),
        AdminApiClient.getAIFeedback(),
      ]);
      if (cfgRes) setConfig(cfgRes);
      setFeedbacks(fbRes || []);
    } catch (err) {
      console.error("Failed to load AI AgentCore config:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    setStatusBanner(null);
    try {
      const res = await AdminApiClient.updateAIDetailedConfig(
        config as unknown as Partial<AIAgentCoreConfig> & Record<string, unknown>,
      );
      if (res?.config) setConfig(res.config);
      setStatusBanner(
        res?.actionSummary ||
          "AWS Bedrock AgentCore, 4-Katmanlı Model Router ve Otonom Lab ayarları kaydedildi.",
      );
      onRefresh?.();
    } catch (err) {
      setStatusBanner(
        "Hata: " + (err instanceof Error ? err.message : "Konfigürasyon kaydedilemedi."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function runLabAction(payload: {
    labAction:
      | "reindex_vector_db"
      | "run_rag_freshness_sweep"
      | "export_finetune_dataset"
      | "toggle_daemon"
      | "trigger_daemon"
      | "toggle_subagent";
    daemonId?: string;
    subAgentId?: string;
    enabled?: boolean;
    namespace?: string;
  }) {
    const key = `${payload.labAction}:${payload.daemonId || payload.subAgentId || payload.namespace || "all"}`;
    setActionBusy(key);
    setStatusBanner(null);
    try {
      const res = await AdminApiClient.updateAIDetailedConfig(payload);
      if (res?.config) setConfig(res.config);
      if (res?.actionSummary) setStatusBanner(res.actionSummary);
      onRefresh?.();
    } catch (err) {
      setStatusBanner("İşlem başarısız: " + (err instanceof Error ? err.message : "Bilinmeyen hata"));
    } finally {
      setActionBusy(null);
    }
  }

  if (loading || !config) {
    return <div className="empty-state">AWS Bedrock AgentCore & Otonom AI Lab yükleniyor...</div>;
  }

  const positiveCount = feedbacks.filter((f) => f.rating === "positive").length;
  const negativeCount = feedbacks.filter((f) => f.rating === "negative").length;
  const satisfactionRate =
    feedbacks.length > 0 ? Math.round((positiveCount / feedbacks.length) * 100) : 96;

  const daemons = config.isolatedLab?.daemons || [];
  const runningDaemonsCount = daemons.filter((d) => d.enabled).length;
  const subAgents = config.subAgents || [];
  const enabledSubAgentsCount = subAgents.filter((s) => s.enabledByDefault).length;

  return (
    <div>
      {/* KPI Overview */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Birincil Rota Motoru (Tier-3)</span>
            <div className="kpi-icon blue">🧠</div>
          </div>
          <div className="kpi-value" style={{ fontSize: 15 }}>
            {(config.routing.tier3PrimaryRouteModel || config.routing.routingModel)
              .replace("eu.anthropic.", "")
              .replace("anthropic.", "")}
          </div>
          <div className="kpi-trend up">
            Intake (Tier-1):{" "}
            {(config.routing.tier1FastIntakeModel || config.routing.fastModel).replace(
              "eu.amazon.",
              "",
            )}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Aktif Alt Ajanlar (Sub-Agents)</span>
            <div className="kpi-icon green">🕸️</div>
          </div>
          <div className="kpi-value">
            {enabledSubAgentsCount} / {subAgents.length || 12}
          </div>
          <div className="kpi-trend up">Web & Mobil birleşik mikroservis katmanı</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">7/24 Otonom Ajanlar (Daemons)</span>
            <div className="kpi-icon amber">⚡</div>
          </div>
          <div className="kpi-value">
            {runningDaemonsCount} / {daemons.length || 6} Aktif
          </div>
          <div className="kpi-trend neutral">Kesintisiz rota iyileştirme & KB tarama</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Vector DB & Memnuniyet</span>
            <div className="kpi-icon green">👍</div>
          </div>
          <div className="kpi-value">
            %{satisfactionRate} • {config.vectorDb.totalVectors.toLocaleString("tr-TR")} Vektör
          </div>
          <div className="kpi-trend up">
            {positiveCount} olumlu / {negativeCount} olumsuz geri bildirim
          </div>
        </div>
      </div>

      {statusBanner && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 8,
            background: "rgba(16, 185, 129, 0.14)",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            color: "#34d399",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>✓ {statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#34d399",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Sub-navigation Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <button
          type="button"
          className={`btn ${activeTab === "prompts" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("prompts")}
        >
          📝 AgentCore Harness & Bellek
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "routing" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("routing")}
        >
          ⚡ 4-Katmanlı Bedrock Router
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "subagents" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("subagents")}
        >
          🕸️ Alt Ajanlar ({enabledSubAgentsCount}/{subAgents.length || 12})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "autonomous" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("autonomous")}
        >
          🤖 7/24 Otonom Ajanlar ({runningDaemonsCount})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "isolated_lab" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("isolated_lab")}
        >
          🧪 İzole Lab: RAG, Vector DB & Fine-Tuning
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "feedback" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("feedback")}
        >
          💬 Rota Geri Bildirimleri ({feedbacks.length})
        </button>
      </div>

      {/* TAB 1: AgentCore Harness, Prompts & Memory Namespaces */}
      {activeTab === "prompts" && (
        <form onSubmit={handleSaveConfig} className="panel-card">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                AWS Bedrock AgentCore Harness, Sistem Promptları & Kullanıcı Bağlamları
              </div>
              <div className="panel-subtitle">
                Web ve Mobil istemcilere ortak hizmet veren ajan çekirdeğinin sistem talimatları,
                bellek (memory) isim alanları ve 8 aşamalı deterministik harness boru hattı
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Kaydediliyor..." : "💾 Değişiklikleri Kaydet"}
            </button>
          </div>

          <div className="panel-body">
            <div className="form-group">
              <label className="form-label">Ana Sistem Promptu (System Prompt)</label>
              <textarea
                className="form-textarea"
                style={{ minHeight: 110, fontFamily: "monospace", fontSize: 12 }}
                value={config.prompts.systemPrompt}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    prompts: { ...config.prompts, systemPrompt: e.target.value },
                  })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Kişiselleştirilmiş Karşılama Şablonu</label>
              <input
                type="text"
                className="form-input"
                value={config.prompts.conciergeGreeting}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    prompts: { ...config.prompts, conciergeGreeting: e.target.value },
                  })
                }
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Davranış & Kalite İlkeleri (Behavior Guidelines)</label>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: 140, fontFamily: "monospace", fontSize: 12 }}
                  value={config.prompts.behaviorGuidelines}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      prompts: { ...config.prompts, behaviorGuidelines: e.target.value },
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">8 Aşamalı AgentCore Harness Akışı</label>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: 140, fontFamily: "monospace", fontSize: 12 }}
                  value={config.prompts.questionFlow}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      prompts: { ...config.prompts, questionFlow: e.target.value },
                    })
                  }
                />
              </div>
            </div>

            {/* AgentCore Memory Namespaces */}
            {config.agentCore?.memoryNamespaces && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
                  🧠 AWS AgentCore Bellek İsim Alanları (Memory Namespaces)
                </div>
                <div className="grid-2" style={{ gap: 12 }}>
                  {config.agentCore.memoryNamespaces.map((ns) => (
                    <div
                      key={ns.id}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 6,
                        }}
                      >
                        <code style={{ color: "#60a5fa", fontWeight: 700, fontSize: 12 }}>
                          {ns.namespaceTemplate}
                        </code>
                        <span className="badge green">
                          {ns.strategy} • TTL {ns.ttlDays}g
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {ns.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>
      )}

      {/* TAB 2: 4-Tier Bedrock Model Routing */}
      {activeTab === "routing" && (
        <form onSubmit={handleSaveConfig} className="panel-card">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                Amazon Bedrock 4-Katmanlı Maliyet-Kalite Model Yönlendirici (ModelRouter)
              </div>
              <div className="panel-subtitle">
                Kritik yolda düşük gecikme ve minimum maliyet için Nova Micro / Nova Lite; yüksek
                hassasiyetli rota kurgusunda Claude Haiku 4.5; ağır yeniden planlamada Claude 3.5
                Sonnet v2
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Kaydediliyor..." : "💾 Model Atamalarını Kaydet"}
            </button>
          </div>

          <div className="panel-body">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">
                  Tier 1 — Ultra Hızlı Intake & Niyet Motoru (~250ms)
                </label>
                <select
                  className="form-select"
                  value={config.routing.tier1FastIntakeModel || config.routing.fastModel}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      routing: {
                        ...config.routing,
                        tier1FastIntakeModel: e.target.value,
                        fastModel: e.target.value,
                      },
                    })
                  }
                >
                  {BEDROCK_MODEL_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Tier 2 — Standart Sohbet, Concierge & Post-Route Harness (~750ms)
                </label>
                <select
                  className="form-select"
                  value={config.routing.tier2StandardChatModel || config.routing.postRouteHarnessModel}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      routing: {
                        ...config.routing,
                        tier2StandardChatModel: e.target.value,
                        postRouteHarnessModel: e.target.value,
                      },
                    })
                  }
                >
                  {BEDROCK_MODEL_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Tier 3 — Birincil Rota & Çok Günlü Seyahat Mimarı (~1400ms)
                </label>
                <select
                  className="form-select"
                  value={config.routing.tier3PrimaryRouteModel || config.routing.routingModel}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      routing: {
                        ...config.routing,
                        tier3PrimaryRouteModel: e.target.value,
                        routingModel: e.target.value,
                      },
                    })
                  }
                >
                  {BEDROCK_MODEL_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Tier 4 — Derin Yeniden Planlama & Otonom Değerlendirme (~2800ms)
                </label>
                <select
                  className="form-select"
                  value={
                    config.routing.tier4DeepReplanningModel ||
                    "eu.anthropic.claude-3-5-sonnet-20241022-v2:0"
                  }
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      routing: {
                        ...config.routing,
                        tier4DeepReplanningModel: e.target.value,
                      },
                    })
                  }
                >
                  {BEDROCK_MODEL_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: 12 }}>
              <div className="form-group">
                <label className="form-label">
                  Temperature (Yaratıcılık vs Determinizm: {config.routing.temperature})
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  className="form-input"
                  value={config.routing.temperature}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      routing: { ...config.routing, temperature: Number(e.target.value) },
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Maksimum Çıktı Token Bütçesi (Max Tokens)</label>
                <input
                  type="number"
                  className="form-input"
                  value={config.routing.maxTokens}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      routing: { ...config.routing, maxTokens: Number(e.target.value) },
                    })
                  }
                />
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: Sub-Agent Orchestration Matrix */}
      {activeTab === "subagents" && (
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                Alt Ajan (Sub-Agent) Atamaları & Mikroservis Araç Matrisi
              </div>
              <div className="panel-subtitle">
                Supervisor altında paralel çalışan 12 uzman alt ajanı ve deterministik rota
                araçlarını tek tıkla etkinleştirin veya devre dışı bırakın
              </div>
            </div>
          </div>
          <div className="panel-body">
            <div className="grid-2" style={{ gap: 14 }}>
              {subAgents.map((sa) => {
                const busy = actionBusy === `toggle_subagent:${sa.id}`;
                return (
                  <div
                    key={sa.id}
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      background: "var(--bg-elevated)",
                      border: `1px solid ${sa.enabledByDefault ? "rgba(16, 185, 129, 0.35)" : "var(--border-subtle)"}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{sa.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          ID: <code>{sa.id}</code> • Katman: <strong>{sa.defaultTier}</strong> •
                          Timeout: {sa.timeoutMs}ms
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`btn btn-sm ${sa.enabledByDefault ? "btn-primary" : "btn-secondary"}`}
                        disabled={busy}
                        onClick={() =>
                          runLabAction({
                            labAction: "toggle_subagent",
                            subAgentId: sa.id,
                            enabled: !sa.enabledByDefault,
                          })
                        }
                      >
                        {sa.enabledByDefault ? "✓ Aktif" : "Pasif"}
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
                      {sa.description}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {sa.tools.map((t) => (
                        <span key={t} className="badge blue" style={{ fontSize: 10 }}>
                          🔧 {t}
                        </span>
                      ))}
                      {sa.guardrails.map((g) => (
                        <span key={g} className="badge green" style={{ fontSize: 10 }}>
                          🛡️ {g}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: 24/7 Autonomous Agents (Daemons) */}
      {activeTab === "autonomous" && (
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                7/24 Kesintisiz Çalışan Otonom Ajan Sistemleri (Autonomous Background Daemons)
              </div>
              <div className="panel-subtitle">
                Gece gündüz arka planda rota anomalilerini iyileştiren, RAG tazeliğini koruyan,
                yerel mekanları indeksleyen ve Fine-Tuning veri setini kürate eden otonom işçiler
              </div>
            </div>
          </div>
          <div className="panel-body">
            <div className="grid-2" style={{ gap: 16 }}>
              {daemons.map((d) => {
                const toggleBusy = actionBusy === `toggle_daemon:${d.id}`;
                const triggerBusy = actionBusy === `trigger_daemon:${d.id}`;
                return (
                  <div
                    key={d.id}
                    style={{
                      padding: 16,
                      borderRadius: 10,
                      background: "var(--bg-elevated)",
                      border: `1px solid ${d.enabled ? "rgba(59, 130, 246, 0.4)" : "var(--border-subtle)"}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{d.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          Zamanlama: <code>{d.scheduleCron}</code> • Model Katmanı:{" "}
                          <strong>{d.tier}</strong>
                        </div>
                      </div>
                      <span className={`badge ${d.enabled ? "green" : "amber"}`}>
                        {d.enabled ? "● 7/24 Çalışıyor" : "⏸ Duraklatıldı"}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
                      {d.description}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 8,
                        padding: 10,
                        borderRadius: 8,
                        background: "rgba(15, 23, 42, 0.45)",
                        marginBottom: 12,
                        fontSize: 11,
                      }}
                    >
                      <div>
                        <div style={{ color: "var(--text-muted)" }}>24s Döngü</div>
                        <div style={{ fontWeight: 700 }}>{d.metrics.cyclesCompleted24h}</div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-muted)" }}>İşlenen Kayıt</div>
                        <div style={{ fontWeight: 700 }}>{d.metrics.itemsProcessed24h}</div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-muted)" }}>Başarı Oranı</div>
                        <div style={{ fontWeight: 700, color: "#34d399" }}>
                          %{(d.metrics.successRate * 100).toFixed(1)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={triggerBusy}
                        onClick={() =>
                          runLabAction({ labAction: "trigger_daemon", daemonId: d.id })
                        }
                      >
                        {triggerBusy ? "Çalıştırılıyor..." : "⚡ Şimdi Döngü Tetikle"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={toggleBusy}
                        onClick={() =>
                          runLabAction({
                            labAction: "toggle_daemon",
                            daemonId: d.id,
                            enabled: !d.enabled,
                          })
                        }
                      >
                        {d.enabled ? "⏸ Duraklat" : "▶ Etkinleştir"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Isolated Lab — RAG, Vector DB & LLM Fine-Tuning */}
      {activeTab === "isolated_lab" && (
        <div className="grid-2">
          <div className="panel-card">
            <div className="panel-header">
              <div>
                <div className="panel-title">🗄️ Vector DB & Hibrit RAG İndeksleri</div>
                <div className="panel-subtitle">
                  {config.isolatedLab?.vectorDb.provider ||
                    "Amazon Bedrock Knowledge Bases + GeoVector"}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={actionBusy === "reindex_vector_db:all"}
                onClick={() => runLabAction({ labAction: "reindex_vector_db" })}
              >
                {actionBusy === "reindex_vector_db:all"
                  ? "İndeksleniyor..."
                  : "🔄 Tüm Vektörleri Senkronize Et"}
              </button>
            </div>
            <div className="panel-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(config.isolatedLab?.vectorDb.namespaces || []).map((ns) => (
                  <div
                    key={ns.namespace}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <code style={{ fontWeight: 700, color: "#60a5fa" }}>{ns.namespace}</code>
                      <span className="badge green">
                        {ns.documentCount.toLocaleString("tr-TR")} doküman • Tazelik %
                        {Math.round(ns.freshnessScore * 100)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                      {ns.description}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={actionBusy === "run_rag_freshness_sweep:all"}
                  onClick={() => runLabAction({ labAction: "run_rag_freshness_sweep" })}
                >
                  {actionBusy === "run_rag_freshness_sweep:all"
                    ? "Taranıyor..."
                    : "🧹 RAG Tazelik & TTL Taraması Başlat"}
                </button>
              </div>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-header">
              <div>
                <div className="panel-title">🎓 LLM Fine-Tuning & Golden Dataset Küratörü</div>
                <div className="panel-subtitle">
                  Yüksek memnuniyetli (👍) rotalardan ve Golden Eval senaryolarından PII-arındırılmış
                  SFT / DPO eğitim havuzu
                </div>
              </div>
            </div>
            <div className="panel-body">
              <div
                style={{
                  padding: 14,
                  background: "var(--bg-elevated)",
                  borderRadius: 8,
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Eğitim Yöntemi & Baz Model</span>
                  <span style={{ fontWeight: 700 }}>
                    {config.isolatedLab?.fineTuning.trainingMethod || "DPO"} •{" "}
                    {config.isolatedLab?.fineTuning.targetBaseModelId || "eu.amazon.nova-lite-v1:0"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "var(--text-secondary)" }}>
                    Kürate Edilen Onaylı Eğitim Örneği
                  </span>
                  <span className="badge green">
                    {(config.isolatedLab?.fineTuning.curatedSampleCount || 1284).toLocaleString(
                      "tr-TR",
                    )}{" "}
                    JSONL Kaydı
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "var(--text-secondary)" }}>S3 Eğitim Havuzu</span>
                  <code style={{ fontSize: 11 }}>
                    {config.isolatedLab?.fineTuning.s3DatasetBucketPrefix ||
                      "s3://mapsbridge-ai-lab/fine-tuning/v2/"}
                  </code>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>PII & Guardrail Filtresi</span>
                  <span className="badge green">Zorunlu (I1 / I5 / K3 Korumalı)</span>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={actionBusy === "export_finetune_dataset:all"}
                  onClick={() => runLabAction({ labAction: "export_finetune_dataset" })}
                >
                  {actionBusy === "export_finetune_dataset:all"
                    ? "Aktarılıyor..."
                    : "📤 Onaylı Veri Setini S3 Fine-Tuning Havuzuna Aktar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: User Route Feedbacks */}
      {activeTab === "feedback" && (
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <div className="panel-title">Rota Sonrası Kullanıcı Geri Bildirimleri</div>
              <div className="panel-subtitle">
                Web ve Mobil istemcilerde oluşturulan rotalara verilen 👍 / 👎 değerlendirmeleri ve
                kullanıcı yorumları
              </div>
            </div>
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Kullanıcı</th>
                  <th>Destinasyon</th>
                  <th>Değerlendirme</th>
                  <th>Kullanıcı Yorumu / Özel Not</th>
                </tr>
              </thead>
              <tbody>
                {feedbacks.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: 28 }}>
                      Henüz rota geri bildirimi kaydı bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  feedbacks.map((fb) => (
                    <tr key={fb.id}>
                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {new Date(fb.createdAt).toLocaleString("tr-TR")}
                      </td>
                      <td>
                        <code>{fb.userId}</code>
                      </td>
                      <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {fb.destination}
                      </td>
                      <td>
                        <span className={`badge ${fb.rating === "positive" ? "green" : "red"}`}>
                          {fb.rating === "positive" ? "👍 Beğendi" : "👎 Beğenmedi"}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-primary)" }}>
                        {fb.feedbackText || fb.customChipsText || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
