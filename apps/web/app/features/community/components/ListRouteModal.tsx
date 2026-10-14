"use client";

import React, { useState } from "react";

interface ListRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  userSavedRoutes: string[];
  onSubmit: (data: {
    title: string;
    destination: string;
    category: string;
    duration: string;
    description: string;
  }) => void;
}

export function ListRouteModal({
  isOpen,
  onClose,
  userSavedRoutes,
  onSubmit,
}: ListRouteModalProps) {
  const [title, setTitle] = useState("");
  const [dest, setDest] = useState("");
  const [category, setCategory] = useState("Şehir Gezisi");
  const [duration, setDuration] = useState("1 Gün");
  const [desc, setDesc] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      title: title.trim(),
      destination: dest.trim() || "Popüler Destinasyon",
      category,
      duration: duration || "1 Gün",
      description: desc.trim() || "Yazar tarafından hazırlanan gezi rehberi.",
    });

    setTitle("");
    setDest("");
    setDesc("");
  };

  return (
    <div className="community-modal-overlay" onClick={onClose}>
      <div className="standard-dialog-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Rotanı Toplulukla Paylaş</h3>
          <button type="button" className="btn-modal-close-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-form">
          {/* Kayıtlı Rotalardan Combobox ile Seçim */}
          <div className="dialog-form-row">
            <label className="dialog-label" style={{ flex: 1 }}>
              Kayıtlı Rotalarınızdan Seçin (Combobox)
              <select
                className="dialog-select"
                value={title}
                onChange={(e) => {
                  const val = e.target.value;
                  setTitle(val);
                  if (val.toLowerCase().includes("roma")) setDest("Roma, İtalya");
                  else if (val.toLowerCase().includes("istanbul")) setDest("İstanbul, Türkiye");
                  else if (val.toLowerCase().includes("kapadokya")) setDest("Nevşehir, Kapadokya");
                }}
              >
                <option value="">-- Mevcut Rotanızı Seçin --</option>
                {userSavedRoutes.map((rTitle, idx) => (
                  <option key={idx} value={rTitle}>
                    🗺️ {rTitle}
                  </option>
                ))}
                <option value="İstanbul Tarihi Yarımada & Boğaz (12 Durak)">
                  🗺️ İstanbul Tarihi Yarımada &amp; Boğaz (12 Durak)
                </option>
                <option value="Roma Antik Miras & Trastevere (9 Durak)">
                  🗺️ Roma Antik Miras &amp; Trastevere (9 Durak)
                </option>
                <option value="Kapadokya Vadileri & Gün Batımı (8 Durak)">
                  🗺️ Kapadokya Vadileri &amp; Gün Batımı (8 Durak)
                </option>
              </select>
            </label>
          </div>

          <label className="dialog-label">
            Rota Başlığı (Özelleştirin veya Yeni Başlık Girin)
            <input
              type="text"
              required
              placeholder="Örn: Roma Gizli Sokakları & Kahve Rehberi"
              className="dialog-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </label>

          <div className="dialog-form-row">
            <label className="dialog-label">
              Şehir / Destinasyon
              <input
                type="text"
                required
                placeholder="Örn: Roma, İtalya"
                className="dialog-input"
                value={dest}
                onChange={(e) => setDest(e.target.value)}
              />
            </label>

            <label className="dialog-label">
              Kategori
              <select
                className="dialog-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="Şehir Gezisi">Şehir Gezisi</option>
                <option value="Gastronomi">Gastronomi &amp; Kafe</option>
                <option value="Fotoğrafçılık">Fotoğrafçılık</option>
                <option value="Tarih & Kültür">Tarih &amp; Kültür</option>
                <option value="Doğa & Yürüyüş">Doğa &amp; Yürüyüş</option>
              </select>
            </label>
          </div>

          <div className="dialog-form-row">
            <label className="dialog-label" style={{ flex: 1 }}>
              Tahmini Gezi Süresi
              <input
                type="text"
                placeholder="Örn: 2 Gün veya 5 Saat"
                className="dialog-input"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </label>
          </div>

          <label className="dialog-label">
            Rota Açıklaması &amp; Gezgin İpuçları
            <textarea
              rows={3}
              required
              placeholder="Gezginlerin bu rotayı neden tercih etmesi gerektiğini ve tavsiyelerinizi açıklayın..."
              className="dialog-textarea"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </label>

          <button type="submit" className="btn-modal-submit">
            ✓ Rotayı Toplulukta Paylaş
          </button>
        </form>
      </div>
    </div>
  );
}
