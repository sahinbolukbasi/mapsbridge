"use client";

import React, { useState } from "react";
import type { PinCategory } from "../../lib/trip/models";
import { DEFAULT_CATEGORY_META } from "../../lib/trip/models";

export interface ManualPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pinData: {
    label: string;
    category: PinCategory;
    day: number;
    duration: number;
    note: string;
  }) => void;
  tripDaysCount?: number;
  activeDayIndex?: number | null;
}

export function ManualPinModal({
  isOpen,
  onClose,
  onSubmit,
  tripDaysCount = 1,
  activeDayIndex = 0,
}: ManualPinModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<PinCategory>("genel");
  const [day, setDay] = useState((activeDayIndex ?? 0) + 1);
  const [duration, setDuration] = useState(45);
  const [note, setNote] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      label: title.trim(),
      category,
      day,
      duration: Number(duration) || 45,
      note: note.trim(),
    });
    setTitle("");
    setNote("");
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#1e293b",
          borderRadius: "16px",
          padding: "24px",
          width: "100%",
          maxWidth: "420px",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          color: "#f8fafc",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <span>📍</span> Manuel Durak Ekle
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: "1.2rem",
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "4px" }}>
              Durak Adı / Mekan *
            </label>
            <input
              type="text"
              required
              placeholder="Örn: Galata Kulesi"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                backgroundColor: "#0f172a",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff",
                fontSize: "0.9rem",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "4px" }}>
                Kategori
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PinCategory)}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "8px",
                  backgroundColor: "#0f172a",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#fff",
                  fontSize: "0.85rem",
                }}
              >
                {Object.entries(DEFAULT_CATEGORY_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.emoji} {meta.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "4px" }}>
                Hangi Gün?
              </label>
              <select
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "8px",
                  backgroundColor: "#0f172a",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#fff",
                  fontSize: "0.85rem",
                }}
              >
                {Array.from({ length: Math.max(1, tripDaysCount) }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}. Gün
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "4px" }}>
              Tahmini Süre (Dakika)
            </label>
            <input
              type="number"
              min={10}
              max={360}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                backgroundColor: "#0f172a",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff",
                fontSize: "0.85rem",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "4px" }}>
              Özel Not (İsteğe Bağlı)
            </label>
            <textarea
              rows={2}
              placeholder="Giriş bileti önceden alınmalı vb."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                backgroundColor: "#0f172a",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff",
                fontSize: "0.85rem",
                resize: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                backgroundColor: "rgba(255,255,255,0.08)",
                border: "none",
                color: "#cbd5e1",
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              İptal
            </button>
            <button
              type="submit"
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                backgroundColor: "#3b82f6",
                border: "none",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              Durak Ekle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
