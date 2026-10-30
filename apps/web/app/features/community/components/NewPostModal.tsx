"use client";

import React, { useState } from "react";
import { PRESET_TRAVEL_PHOTOS } from "../initial-data";
import "../community-layout.css";
import { Modal } from "../../../components/ui";

interface NewPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeUsername: string;
  userSavedRoutes: string[];
  onSubmit: (data: {
    content: string;
    photo: string | null;
    category: string;
    linkedRoute?: string;
  }) => void;
}

export function NewPostModal({
  isOpen,
  onClose,
  activeUsername,
  userSavedRoutes,
  onSubmit,
}: NewPostModalProps) {
  const [content, setContent] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [category, setCategory] = useState("Tarih & Kültür");
  const [selectedRoute, setSelectedRoute] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    onSubmit({
      content: content.trim(),
      photo,
      category,
      linkedRoute: selectedRoute || undefined,
    });

    setContent("");
    setPhoto(null);
    setSelectedRoute("");
  };

  return (
    <Modal open onClose={onClose} title="Yeni paylaşım" size="md" className="new-post-dialog">
      <div className="x-tweet-modal">
        {/* Gizlilik bilgisi (eski üst çubuk; kapat düğmesi Modal'da) */}
        <div className="x-tweet-header">
          <div className="x-tweet-privacy-pill">
            <span className="material-symbols-outlined" aria-hidden="true">
              public
            </span>
            <span>Topluluk &amp; Keşfet Akışı</span>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="x-tweet-body">
            {/* Sol Avatar */}
            <div className="x-tweet-avatar-wrap">
              <div className="x-tweet-avatar">{activeUsername.charAt(0).toUpperCase()}</div>
            </div>

            {/* Sağ Yazım Alanı */}
            <div className="x-tweet-content-col">
              <textarea
                required
                rows={3}
                placeholder="Neler keşfettiniz? Seyahat fikrinizi veya rotanızı paylaşın..."
                className="x-tweet-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                autoFocus
              />

              {/* Seçili Görsel Önizlemesi */}
              {photo && (
                <div className="x-attached-photo-card">
                  <img src={photo} alt="Seyahat görseli" className="x-attached-photo-img" />
                  <button
                    type="button"
                    className="x-photo-remove-btn"
                    onClick={() => setPhoto(null)}
                    title="Fotoğrafı Kaldır"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Bağlı Rota Rozeti */}
              {selectedRoute && (
                <div className="x-attached-route-tag">
                  <span className="material-symbols-outlined">map</span>
                  <span>{selectedRoute}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedRoute("")}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--color-text-subtle)",
                      marginLeft: "4px",
                    }}
                    title="Rotayı Kaldır"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Örnek Seyahat Fotoğrafları Seçici */}
              <div className="x-preset-photo-section">
                <span className="x-preset-title">📸 Örnek Seyahat Fotoğrafı Seçin:</span>
                <div className="x-preset-scroll no-scrollbar">
                  {PRESET_TRAVEL_PHOTOS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`x-preset-item-btn ${photo === p.url ? "selected" : ""}`}
                      onClick={() => setPhoto(p.url)}
                    >
                      <img src={p.url} alt={p.label} className="x-preset-thumb" />
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Alt X Medya & Gönderim Araç Çubuğu */}
          <div className="x-tweet-media-bar">
            <div className="x-tweet-icons-row">
              {/* Kategori Seç */}
              <select
                className="dialog-select"
                style={{
                  fontSize: "11.5px",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "9999px",
                  background: "transparent",
                  border: "1px solid var(--color-border-strong)",
                }}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                title="Gönderi Kategorisi"
              >
                <option value="Tarih & Kültür">🏛️ Tarih &amp; Kültür</option>
                <option value="Gastronomi">🍽️ Gastronomi &amp; Lezzet</option>
                <option value="Doğa & Yürüyüş">🌲 Doğa &amp; Yürüyüş</option>
                <option value="Fotoğrafçılık">📷 Fotoğrafçılık</option>
                <option value="Şehir Rehberi">🌆 Şehir Rehberi</option>
              </select>

              {/* Rota Seç Dropdown */}
              <select
                className="dialog-select"
                style={{
                  fontSize: "11.5px",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "9999px",
                  background: "transparent",
                  border: "1px solid var(--color-border-strong)",
                  maxWidth: "160px",
                }}
                value={selectedRoute}
                onChange={(e) => setSelectedRoute(e.target.value)}
                title="Bağlı Gezi Rotası Ekle"
              >
                <option value="">📍 Rota Ekle...</option>
                {userSavedRoutes.map((title, idx) => (
                  <option key={idx} value={title}>
                    {title}
                  </option>
                ))}
                <option value="İstanbul Tarihi Yarımada">İstanbul Tarihi Yarımada</option>
                <option value="Roma Antik Miras">Roma Antik Miras</option>
                <option value="Kapadokya Vadileri">Kapadokya Vadileri</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: content.length > 250 ? "#ef4444" : "#94a3b8",
                }}
              >
                {280 - content.length}
              </span>
              <button type="submit" className="x-tweet-submit-btn">
                Yayınla
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
