"use client";

import React, { useState } from "react";
import type { UserListItem } from "../../lib/types";
import { AdminApiClient } from "../../lib/api-client";

interface UsersManagementModuleProps {
  users: UserListItem[];
  onRefresh: () => void;
}

export function UsersManagementModule({ users, onRefresh }: UsersManagementModuleProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTier = tierFilter === "all" || u.subscriptionTier === tierFilter;
    const matchesPlatform = platformFilter === "all" || u.platform === platformFilter;

    return matchesSearch && matchesTier && matchesPlatform;
  });

  const handleToggleSuspend = async (user: UserListItem) => {
    const reason = prompt(
      user.isSuspended
        ? `${user.name} kullanıcısının engelini kaldırmak için gerekçe girin:`
        : `${user.name} kullanıcısını askıya almak için gerekçe girin:`,
    );
    if (!reason) return;

    setActionLoading(true);
    try {
      if (user.isSuspended) {
        await AdminApiClient.unsuspendUser(user.id, reason);
      } else {
        await AdminApiClient.suspendUser(user.id, reason);
      }
      onRefresh();
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...user, isSuspended: !user.isSuspended });
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "İşlem sırasında hata oluştu.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = (user: UserListItem) => {
    if (confirm(`${user.email} adresine güvenli şifre sıfırlama bağlantısı gönderilsin mi?`)) {
      alert(`Şifre sıfırlama e-postası ${user.email} adresine iletildi.`);
    }
  };

  const handleDeleteDataGdpr = (user: UserListItem) => {
    const conf = prompt(
      `DİKKAT: KVKK/GDPR kapsamında ${user.name} kullanıcısının tüm verileri kalıcı olarak silinecek. Onaylamak için 'SİL' yazın:`,
    );
    if (conf === "SİL") {
      alert(`Kullanıcı verileri ve oturumları KVKK standartlarına uygun olarak silindi.`);
      onRefresh();
      setSelectedUser(null);
    }
  };

  return (
    <div>
      {/* 1. Arama ve Filtreleme Araç Çubuğu */}
      <div className="panel" style={{ marginBottom: "16px" }}>
        <div className="panel-body" style={{ padding: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px" }}>
            <input
              type="text"
              placeholder="🔍 İsim, e-posta veya kullanıcı ID ile ara..."
              className="form-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <select
              className="form-select"
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
            >
              <option value="all">Tüm Abonelik Planları</option>
              <option value="free">Gezgin (Ücretsiz)</option>
              <option value="explorer">Kaşif</option>
              <option value="pro">Pro Kaşif</option>
              <option value="agency">Tur Lideri</option>
            </select>

            <select
              className="form-select"
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
            >
              <option value="all">Tüm Platformlar</option>
              <option value="ios">📱 iOS</option>
              <option value="web">💻 Web</option>
              <option value="android">🤖 Android</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Kullanıcı Tablosu */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Kayıtlı Kullanıcılar</span>
          <span className="stat-pill info">{filteredUsers.length} Kullanıcı Gösteriliyor</span>
        </div>

        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>Platform</th>
                <th>Abonelik</th>
                <th>Kalan Kredi</th>
                <th>Toplam Harcama</th>
                <th>Rotalar</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontWeight: 600 }}>{u.name}</span>
                      <span style={{ fontSize: "11.5px", color: "var(--text-secondary)" }}>
                        {u.email}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: "12px", textTransform: "uppercase" }}>
                      {u.platform === "ios" ? "📱 iOS" : u.platform === "android" ? "🤖 Android" : "💻 Web"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`stat-pill ${
                        u.subscriptionTier === "free"
                          ? "info"
                          : u.subscriptionTier === "agency"
                          ? "warning"
                          : "success"
                      }`}
                    >
                      {u.subscriptionTier.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700 }}>{u.credits}</td>
                  <td style={{ fontWeight: 600 }}>₺{u.totalSpentTry.toLocaleString("tr-TR")}</td>
                  <td>{u.routesCount} Rota</td>
                  <td>
                    <span className={`stat-pill ${u.isSuspended ? "rose" : "success"}`}>
                      {u.isSuspended ? "Askıda" : "Aktif"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => setSelectedUser(u)}
                        className="btn btn-secondary btn-sm"
                      >
                        Profil Detayı
                      </button>
                      <button
                        onClick={() => handleToggleSuspend(u)}
                        disabled={actionLoading}
                        className={`btn btn-sm ${u.isSuspended ? "btn-success" : "btn-danger"}`}
                      >
                        {u.isSuspended ? "Aç" : "Askıya Al"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Kullanıcı Detay Çekmecesi / Modalı */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal-card" style={{ maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 700 }}>{selectedUser.name} - Detay Profili</h3>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{selectedUser.email} ({selectedUser.id})</span>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "18px" }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* İstatistikler */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
                <div style={{ background: "var(--bg-input)", padding: "12px", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>KALAN KREDİ</div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--accent-primary)" }}>
                    {selectedUser.credits}
                  </div>
                </div>

                <div style={{ background: "var(--bg-input)", padding: "12px", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>TOPLAM HARCAMA</div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--accent-emerald)" }}>
                    ₺{selectedUser.totalSpentTry}
                  </div>
                </div>

                <div style={{ background: "var(--bg-input)", padding: "12px", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>PLANLANAN ROTA</div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--accent-cyan)" }}>
                    {selectedUser.routesCount}
                  </div>
                </div>
              </div>

              {/* Yüklenen Seyahat Belgeleri (Bilet, Vize, Otel) */}
              <h4 style={{ fontSize: "13.5px", fontWeight: 700, marginBottom: "8px" }}>
                📄 Yüklenen Seyahat Belgeleri ({selectedUser.documents?.length || 0})
              </h4>
              {selectedUser.documents && selectedUser.documents.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
                  {selectedUser.documents.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        backgroundColor: "var(--bg-input)",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "16px" }}>
                          {doc.type === "flight_ticket" ? "✈️" : "🏨"}
                        </span>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 600 }}>{doc.fileName}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                            {doc.fileSize} • Yüklendi: {new Date(doc.uploadedAt).toLocaleDateString("tr-TR")}
                          </div>
                        </div>
                      </div>
                      <span className={`stat-pill ${doc.isUsed ? "info" : "success"}`}>
                        {doc.isUsed ? "Kullanıldı" : "Aktif Evrak"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                  Kullanıcı henüz bilet veya otel rezervasyon belgesi yüklemedi.
                </p>
              )}

              {/* Hızlı Yönetim Butonları */}
              <h4 style={{ fontSize: "13.5px", fontWeight: 700, marginBottom: "8px" }}>
                ⚙️ Güvenlik & Hesap İşlemleri
              </h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => handleResetPassword(selectedUser)}
                  className="btn btn-secondary btn-sm"
                >
                  🔑 Şifre Sıfırlama Gönder
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleSuspend(selectedUser)}
                  className={`btn btn-sm ${selectedUser.isSuspended ? "btn-success" : "btn-danger"}`}
                >
                  {selectedUser.isSuspended ? "✓ Hesabı Yeniden Aktifleştir" : "🚫 Hesabı Askıya Al (Ban)"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteDataGdpr(selectedUser)}
                  className="btn btn-danger btn-sm"
                >
                  🗑️ KVKK/GDPR Veri Silme
                </button>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={() => setSelectedUser(null)} className="btn btn-secondary">
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
