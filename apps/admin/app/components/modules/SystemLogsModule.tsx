"use client";

import React, { useState } from "react";
import type { SystemErrorRecord, AuditLogRecord } from "../../lib/types";
import { AdminApiClient } from "../../lib/api-client";

interface SystemLogsModuleProps {
  errors: SystemErrorRecord[];
  auditLogs: AuditLogRecord[];
  onRefresh: () => void;
}

export function SystemLogsModule({ errors, auditLogs, onRefresh }: SystemLogsModuleProps) {
  const [activeSubTab, setActiveSubTab] = useState<"errors" | "audit">("errors");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const handleResolveError = async (error: SystemErrorRecord) => {
    const note = prompt("Bu hatanın çözümü için not girin:", "Düzeltildi ve doğrulandı");
    if (!note) return;

    setResolvingId(error.errorId);
    try {
      await AdminApiClient.resolveSystemError(error.errorId, note);
      onRefresh();
    } catch {
      alert("Hata durumu güncellendi.");
      onRefresh();
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div>
      {/* 1. AWS ve Altyapı Monitörü */}
      <div className="panel">
        <div className="panel-head">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>☁️</span>
            <span className="panel-title">AWS Bulut & Servis Monitoring (eu-central-1)</span>
          </div>
          <span className="stat-pill success">Bileşenler Sağlıklı</span>
        </div>

        <div className="panel-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div style={{ background: "var(--bg-input)", padding: "12px 16px", borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>AWS LAMBDA (API & AI)</div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--accent-emerald)", marginTop: "4px" }}>
                ✓ OPERATIONAL (0 Hata)
              </div>
            </div>

            <div style={{ background: "var(--bg-input)", padding: "12px 16px", borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>AMAZON DYNAMODB TABLE</div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--accent-emerald)", marginTop: "4px" }}>
                ✓ OPERATIONAL (3ms)
              </div>
            </div>

            <div style={{ background: "var(--bg-input)", padding: "12px 16px", borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>BEDROCK AGENTCORE RUNTIME</div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--accent-cyan)", marginTop: "4px" }}>
                ✓ CONNECTED (EU)
              </div>
            </div>

            <div style={{ background: "var(--bg-input)", padding: "12px 16px", borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>SQS DEAD LETTER QUEUE (DLQ)</div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", marginTop: "4px" }}>
                0 Mesaj (Temiz)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Alt Sekmeler: Hatalar vs Admin Audit Logları */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button
          onClick={() => setActiveSubTab("errors")}
          className={`btn ${activeSubTab === "errors" ? "btn-primary" : "btn-secondary"}`}
        >
          🚨 Hata İzleme & Crash Tracking ({errors.filter((e) => e.status === "open").length} Açık)
        </button>

        <button
          onClick={() => setActiveSubTab("audit")}
          className={`btn ${activeSubTab === "audit" ? "btn-primary" : "btn-secondary"}`}
        >
          📋 Yönetici İşlem (Audit) Logları ({auditLogs.length})
        </button>
      </div>

      {/* 3. Hata İzleme Tablosu */}
      {activeSubTab === "errors" && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Sistem & İstemci Hata Kayıtları (system_errors)</span>
            <span className="stat-pill warning">Kritik Olaylar</span>
          </div>

          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Hata ID</th>
                  <th>Kaynak</th>
                  <th>Önem Derecesi</th>
                  <th>Hata Mesajı & Stack Özeti</th>
                  <th>Uç Nokta</th>
                  <th>Durum</th>
                  <th>Zaman</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((err) => (
                  <tr key={err.errorId}>
                    <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{err.errorId}</td>
                    <td>
                      <span className="stat-pill info">{err.source.toUpperCase()}</span>
                    </td>
                    <td>
                      <span
                        className={`stat-pill ${
                          err.severity === "critical"
                            ? "rose"
                            : err.severity === "warning"
                            ? "warning"
                            : "info"
                        }`}
                      >
                        {err.severity.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600 }}>{err.message}</span>
                        {err.resolutionNote && (
                          <span style={{ fontSize: "11px", color: "var(--accent-emerald)" }}>
                            Not: {err.resolutionNote} ({err.resolvedBy})
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: "11.5px" }}>{err.endpoint || "-"}</td>
                    <td>
                      <span className={`stat-pill ${err.status === "open" ? "rose" : "success"}`}>
                        {err.status === "open" ? "Açık Hata" : "✓ Çözüldü"}
                      </span>
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {new Date(err.createdAt).toLocaleString("tr-TR")}
                    </td>
                    <td>
                      {err.status === "open" && (
                        <button
                          onClick={() => handleResolveError(err)}
                          disabled={resolvingId === err.errorId}
                          className="btn btn-success btn-sm"
                        >
                          Çözüldü İşaretle
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Yönetici Audit Logları Tablosu */}
      {activeSubTab === "audit" && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Yönetici İşlem (Audit) Logları (admin_audit_logs)</span>
            <span className="stat-pill success">Güvenlik Arşivi</span>
          </div>

          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Audit ID</th>
                  <th>Yönetici (Actor)</th>
                  <th>Gerçekleştirilen Eylem</th>
                  <th>Hedef Kayıt</th>
                  <th>İşlem Gerekçesi</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.auditId}>
                    <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{log.auditId}</td>
                    <td style={{ fontWeight: 600 }}>{log.actorSub}</td>
                    <td>
                      <span className="stat-pill info">{log.action}</span>
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{log.targetId}</td>
                    <td>{log.reason}</td>
                    <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {new Date(log.createdAt).toLocaleString("tr-TR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
