"use client";

import React, { useState } from "react";
import type { Pin } from "../../lib/trip/models";

export interface RouteVersion {
  id: string;
  versionNum: number;
  label: string;
  prompt?: string;
  stops: Pin[];
}

export interface AIRouteModifierProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
  versions: RouteVersion[];
  activeVersionNum: number;
  onSwitchVersion: (versionNum: number) => void;
}

const QUICK_PROMPTS = [
  "☕ Kahve molalarını artır",
  "🌿 Daha sakin bir gezi temposu",
  "🍽️ Öğle yemeklerini yerel lezzetlere ayarla",
  "🏛️ Tarihi yerleri sabah erken saatlere koy",
  "👟 Yürüyüş mesafelerini kısalt",
];

export function AIRouteModifier({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  versions,
  activeVersionNum,
  onSwitchVersion,
}: AIRouteModifierProps) {
  const [prompt, setPrompt] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onSubmit(prompt.trim());
    setPrompt("");
  };

  const handleQuickPromptClick = (text: string) => {
    setPrompt(text);
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
          maxWidth: "500px",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          color: "#f8fafc",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h3
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>🤖</span> AI ile Rotayı Yeniden Düzenle
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

        {/* Version History Selector */}
        {versions.length > 1 && (
          <div style={{ marginBottom: "16px" }}>
            <span
              style={{
                fontSize: "0.75rem",
                color: "#94a3b8",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Rota Versiyonları (Geçmişe Dön):
            </span>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {versions.map((ver) => (
                <button
                  key={ver.id}
                  type="button"
                  onClick={() => onSwitchVersion(ver.versionNum)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    border: "none",
                    cursor: "pointer",
                    backgroundColor:
                      ver.versionNum === activeVersionNum ? "#3b82f6" : "rgba(255,255,255,0.08)",
                    color: ver.versionNum === activeVersionNum ? "#fff" : "#cbd5e1",
                    fontWeight: ver.versionNum === activeVersionNum ? 600 : 400,
                  }}
                >
                  {ver.label} ({ver.stops.length} durak)
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                color: "#94a3b8",
                marginBottom: "6px",
              }}
            >
              AI Asistanına Ne Değiştirmesini İstediğinizi Yazın:
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Örn: 2. güne güzel bir boğaz manzaralı kahvaltı yeri ekle ve öğleden sonraki yürüyüşü kısalt..."
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                backgroundColor: "#0f172a",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff",
                fontSize: "0.85rem",
                resize: "none",
              }}
            />
          </div>

          {/* Quick prompt suggestions */}
          <div>
            <span
              style={{
                fontSize: "0.75rem",
                color: "#64748b",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Hızlı İstekler:
            </span>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {QUICK_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleQuickPromptClick(qp)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#94a3b8",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  {qp}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
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
              Kapat
            </button>
            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                backgroundColor: isLoading ? "#64748b" : "#8b5cf6",
                border: "none",
                color: "#fff",
                fontWeight: 600,
                cursor: isLoading ? "not-allowed" : "pointer",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {isLoading ? "Düzenleniyor..." : "✨ Rotayı Düzenle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
