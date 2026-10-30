"use client";

import React, { useState } from "react";
import type { TravelBuddy } from "../initial-data";

interface DirectMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  attachedRoute?: string;
}

interface DirectMessageModalProps {
  target: TravelBuddy | null;
  onClose: () => void;
  history: DirectMessage[];
  onSendMessage: (text: string) => void;
}

export function DirectMessageModal({
  target,
  onClose,
  history,
  onSendMessage,
}: DirectMessageModalProps) {
  const [text, setText] = useState("");

  if (!target) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    onSendMessage(text.trim());
    setText("");
  };

  return (
    <div className="community-modal-overlay" onClick={onClose}>
      <div
        className="standard-dialog-modal"
        style={{ maxWidth: "520px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img
              src={target.avatar}
              alt={target.name}
              style={{ width: "38px", height: "38px", borderRadius: "50%", objectFit: "cover" }}
            />
            <div>
              <h3 style={{ margin: 0, fontSize: "15px" }}>{target.name}</h3>
              <span style={{ fontSize: "11px", color: "var(--color-accent)" }}>
                @{target.username} · {target.targetDestination || "Gezgin"}
              </span>
            </div>
          </div>
          <button type="button" className="btn-modal-close-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Chat Messages Feed */}
        <div
          style={{
            padding: "16px",
            height: "280px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            background: "rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ textAlign: "center", fontSize: "11px", color: "gray", margin: "4px 0" }}>
            🤝 {target.name} ile ortak gezi planlaması sohbeti başlatıldı.
          </div>

          {history.map((m) => {
            const isMe = m.sender === "me";
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: isMe ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                  background: isMe ? "#10b981" : "rgba(255,255,255,0.9)",
                  color: isMe ? "#022c22" : "#1e293b",
                  padding: "10px 14px",
                  borderRadius: "14px",
                  borderBottomRightRadius: isMe ? "2px" : "14px",
                  borderBottomLeftRadius: !isMe ? "2px" : "14px",
                  fontSize: "13px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              >
                <p style={{ margin: 0 }}>{m.text}</p>
                {m.attachedRoute && (
                  <div
                    style={{
                      marginTop: "6px",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      background: isMe ? "rgba(0,0,0,0.08)" : "rgba(16,185,129,0.12)",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    🗺️ Ekli Rota: {m.attachedRoute}
                  </div>
                )}
                <span
                  style={{
                    display: "block",
                    fontSize: "10px",
                    textAlign: "right",
                    marginTop: "4px",
                    opacity: 0.7,
                  }}
                >
                  {m.time}
                </span>
              </div>
            );
          })}
        </div>

        {/* Message Input Form */}
        <form onSubmit={handleSubmit} style={{ padding: "14px", display: "flex", gap: "8px" }}>
          <input
            type="text"
            placeholder={`@${target.username} için bir mesaj yazın...`}
            className="dialog-input"
            style={{ flex: 1, margin: 0 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            disabled={!text.trim()}
            style={{
              padding: "0 18px",
              borderRadius: "8px",
              background: "var(--color-accent)",
              color: "#031c13",
              fontWeight: 700,
              fontSize: "13px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Gönder
          </button>
        </form>
      </div>
    </div>
  );
}
