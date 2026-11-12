"use client";

import React, { useState } from "react";
import type { Campaign } from "../../lib/types";
import { AdminApiClient } from "../../lib/api-client";

interface CampaignsModuleProps {
  campaigns: Campaign[];
  onRefresh: () => void;
}

export function CampaignsModule({ campaigns, onRefresh }: CampaignsModuleProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [channel, setChannel] = useState<Campaign["channel"]>("all");
  const [targetSegment, setTargetSegment] = useState<Campaign["targetSegment"]>("all");
  const [sendImmediately, setSendImmediately] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    setCreating(true);
    try {
      await AdminApiClient.createCampaign({
        title: title.trim(),
        body: body.trim(),
        actionUrl: actionUrl.trim() || undefined,
        channel,
        targetSegment,
        status: sendImmediately ? "sent" : "scheduled",
        scheduledAt: sendImmediately ? undefined : scheduledAt,
      });
      setModalOpen(false);
      setTitle("");
      setBody("");
      setActionUrl("");
      onRefresh();
    } catch {
      setModalOpen(false);
      onRefresh();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      {/* 1. Kampanya Oluştur Butonu & Bilgilendirme */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <span className="panel-title">Çok Kanallı Kampanya & Bildirim Merkezi</span>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              Web (in-app banner/toast) ve Mobil (APNs/FCM Push Notification) üzerinden hedefli bildirim yayınlayın
            </p>
          </div>
          <button onClick={() => setModalOpen(true)} className="btn btn-primary btn-sm">
            📢 Yeni Kampanya Oluştur
          </button>
        </div>
      </div>

      {/* 2. Kampanyalar ve Metrikler Listesi */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Yayınlanan ve Planlanan Kampanyalar</span>
          <span className="stat-pill info">{campaigns.length} Kampanya</span>
        </div>

        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Kampanya Başlığı & Mesaj</th>
                <th>Kanal</th>
                <th>Hedef Segment</th>
                <th>Durum</th>
                <th>Gönderilen</th>
                <th>Açılma (Open Rate)</th>
                <th>Tıklanma (CTR)</th>
                <th>Zaman</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const openRate = c.stats.sent > 0 ? Math.round((c.stats.opened / c.stats.sent) * 100) : 0;
                const clickRate = c.stats.sent > 0 ? Math.round((c.stats.clicked / c.stats.sent) * 100) : 0;

                return (
                  <tr key={c.campaignId}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 700 }}>{c.title}</span>
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{c.body}</span>
                      </div>
                    </td>
                    <td>
                      <span className="stat-pill info">
                        {c.channel === "all" ? "🌐 Web + 📱 Mobil" : c.channel === "mobile" ? "📱 Sadece Mobil" : "💻 Sadece Web"}
                      </span>
                    </td>
                    <td>
                      <span className="stat-pill success">
                        {c.targetSegment === "all"
                          ? "Tüm Kullanıcılar"
                          : c.targetSegment === "free"
                          ? "Ücretsiz Plandakiler"
                          : c.targetSegment === "inactive_7d"
                          ? "7+ Gündür İnaktif"
                          : "Yurt Dışı Rotalılar"}
                      </span>
                    </td>
                    <td>
                      <span className={`stat-pill ${c.status === "sent" ? "success" : "warning"}`}>
                        {c.status === "sent" ? "✓ İletildi" : "⏳ Planlandı"}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>{c.stats.sent.toLocaleString("tr-TR")}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontWeight: 600 }}>%{openRate}</span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>({c.stats.opened})</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontWeight: 600, color: "var(--accent-primary)" }}>%{clickRate}</span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>({c.stats.clicked})</span>
                      </div>
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {new Date(c.createdAt).toLocaleDateString("tr-TR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Kampanya Oluştur */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: "16px", fontWeight: 700 }}>Yeni Kampanya / Bildirim Yayını</h3>
              <button onClick={() => setModalOpen(false)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "18px" }}>
                ✕
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Bildirim Başlığı</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Örn: Hafta Sonu Rotalarında %30 Kredi İndirimi ✈️"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Bildirim Mesajı</label>
                  <textarea
                    required
                    rows={3}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Kullanıcıların bildirim çubuğunda veya in-app banner'da göreceği mesaj..."
                    className="form-textarea"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Yönlendirme Linki (Deep Link / Web URL)</label>
                  <input
                    type="text"
                    value={actionUrl}
                    onChange={(e) => setActionUrl(e.target.value)}
                    placeholder="mapsbridge://routes veya https://mapsbridge.com/planlar/"
                    className="form-input"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="form-group">
                    <label className="form-label">Yayın Kanalı</label>
                    <select
                      className="form-select"
                      value={channel}
                      onChange={(e) => setChannel(e.target.value as Campaign["channel"])}
                    >
                      <option value="all">🌐 Web + 📱 Mobil Push</option>
                      <option value="mobile">📱 Sadece Mobil Push</option>
                      <option value="web">💻 Sadece Web In-App</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Hedef Kitle Segmenti</label>
                    <select
                      className="form-select"
                      value={targetSegment}
                      onChange={(e) => setTargetSegment(e.target.value as Campaign["targetSegment"])}
                    >
                      <option value="all">Tüm Kullanıcılar</option>
                      <option value="free">Ücretsiz Plandakiler</option>
                      <option value="inactive_7d">Son 7 Gündür İnaktif Olanlar</option>
                      <option value="international">Yurt Dışı Rotası Oluşturanlar</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: "10px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={sendImmediately}
                      onChange={(e) => setSendImmediately(e.target.checked)}
                    />
                    <span>Anında tüm hedeflenen kullanıcılara gönder</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">
                  İptal
                </button>
                <button type="submit" disabled={creating} className="btn btn-primary">
                  {creating ? "Gönderiliyor..." : "Yayına Al"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
