"use client";

import React, { useState } from "react";

interface NewTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    destination: string;
    dates: string;
    capacity: number;
    price: number;
    meetingPoint: string;
    style: string;
    description: string;
  }) => void;
}

export function NewTripModal({ isOpen, onClose, onSubmit }: NewTripModalProps) {
  const [title, setTitle] = useState("");
  const [dest, setDest] = useState("");
  const [dates, setDates] = useState("");
  const [capacity, setCapacity] = useState(6);
  const [price, setPrice] = useState("0");
  const [meeting, setMeeting] = useState("");
  const [style, setStyle] = useState("Kültür & Şehir");
  const [desc, setDesc] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      title: title.trim(),
      destination: dest.trim() || "Destinasyon",
      dates: dates.trim() || "Tarih Belirlenecek",
      capacity: Number(capacity) || 6,
      price: Math.max(0, Number(price) || 0),
      meetingPoint: meeting.trim() || "Şehir Merkezi",
      style,
      description: desc.trim() || "Birlikte seyahat edeceğimiz keyifli bir gezi grubu.",
    });

    setTitle("");
    setDest("");
    setDates("");
    setDesc("");
  };

  return (
    <div className="community-modal-overlay" onClick={onClose}>
      <div className="standard-dialog-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Yeni Gezi Grubu veya Tur Düzenle</h3>
          <button type="button" className="btn-modal-close-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-form">
          <label className="dialog-label">
            Grup Gezisi Başlığı
            <input
              type="text"
              required
              placeholder="Örn: Barcelona Hafta Sonu Gezginler Buluşması"
              className="dialog-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </label>

          <div className="dialog-form-row">
            <label className="dialog-label">
              Destinasyon
              <input
                type="text"
                required
                placeholder="Örn: Barcelona, İspanya"
                className="dialog-input"
                value={dest}
                onChange={(e) => setDest(e.target.value)}
              />
            </label>

            <label className="dialog-label">
              Tarihler
              <input
                type="text"
                required
                placeholder="Örn: 12 - 15 Haziran 2026"
                className="dialog-input"
                value={dates}
                onChange={(e) => setDates(e.target.value)}
              />
            </label>
          </div>

          <div className="dialog-form-row">
            <label className="dialog-label">
              Kişi Kapasitesi
              <input
                type="number"
                min="2"
                max="30"
                className="dialog-input"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
              />
            </label>

            <label className="dialog-label">
              Katılım Ücreti (₺) — Ücretsiz için 0
              <input
                type="number"
                min="0"
                className="dialog-input"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
          </div>

          <div className="dialog-form-row">
            <label className="dialog-label" style={{ flex: 1 }}>
              Buluşma Noktası
              <input
                type="text"
                required
                placeholder="Örn: Plaça de Catalunya Metro Çıkışı"
                className="dialog-input"
                value={meeting}
                onChange={(e) => setMeeting(e.target.value)}
              />
            </label>

            <label className="dialog-label">
              Gezi Tarzı
              <select
                className="dialog-select"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
              >
                <option value="Kültür & Şehir">Kültür &amp; Şehir</option>
                <option value="Doğa & Kamp">Doğa &amp; Kamp</option>
                <option value="Gastronomi">Gastronomi</option>
                <option value="Fotoğraf Turu">Fotoğraf Turu</option>
                <option value="Sırt Çantalı">Sırt Çantalı</option>
              </select>
            </label>
          </div>

          <label className="dialog-label">
            Gezi Açıklaması &amp; Gezgin Profili
            <textarea
              rows={3}
              required
              placeholder="Seyahat planı, yürüyüş temposu ve aranan gezi arkadaşı özellikleri..."
              className="dialog-textarea"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </label>

          <button type="submit" className="btn-modal-submit">
            Grup Gezisini Başlat ➔
          </button>
        </form>
      </div>
    </div>
  );
}
