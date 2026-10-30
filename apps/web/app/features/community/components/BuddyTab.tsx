"use client";

import React from "react";
import type { TravelBuddy } from "../initial-data";
import "../community-layout.css";

interface BuddyTabProps {
  travelBuddies: TravelBuddy[];
  searchQuery: string;
  interestFilter: string;
  followedUsernames: string[];
  onSearchChange: (query: string) => void;
  onInterestChange: (interest: string) => void;
  onOpenDirectMessage: (buddy: TravelBuddy) => void;
  onToggleFollow: (username: string) => void;
}

export function BuddyTab({
  travelBuddies,
  searchQuery,
  interestFilter,
  followedUsernames,
  onSearchChange,
  onInterestChange,
  onOpenDirectMessage,
  onToggleFollow,
}: BuddyTabProps) {
  const filteredBuddies = travelBuddies.filter((b) => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const matchQ =
        b.name.toLowerCase().includes(q) ||
        b.username.toLowerCase().includes(q) ||
        b.targetDestination.toLowerCase().includes(q) ||
        b.travelStyle.toLowerCase().includes(q) ||
        b.interests.some((it) => it.toLowerCase().includes(q));
      if (!matchQ) return false;
    }
    if (interestFilter !== "all") {
      if (!b.interests.some((it) => it.toLowerCase().includes(interestFilter.toLowerCase()))) {
        return false;
      }
    }
    return true;
  });

  return (
    <section className="tab-pane-content" aria-label="Gezi Arkadaşı Eşleşmesi">
      {/* AI Matching Info Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--color-surface-inverse) 95%, transparent), color-mix(in srgb, var(--color-brand-hover) 90%, transparent))",
          border: "1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)",
          borderRadius: "16px",
          padding: "1.25rem 1.5rem",
          marginBottom: "1.5rem",
          color: "var(--color-on-primary)",
          boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ maxWidth: "680px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span
              className="material-symbols-outlined"
              style={{ color: "var(--color-accent-strong)", fontSize: "22px" }}
            >
              psychology
            </span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "0.06em",
                color: "var(--color-accent-strong)",
                textTransform: "uppercase",
              }}
            >
              AI Destekli Akıllı Gezgin Eşleşmesi
            </span>
          </div>
          <h3 style={{ margin: "0 0 6px", fontSize: "17px", fontWeight: 700, color: "var(--color-on-primary)" }}>
            Ortak İlgi Alanları ve Rotalara Göre Gezi Arkadaşı Bulun
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              lineHeight: "1.5",
              color: "color-mix(in srgb, var(--color-on-primary) 80%, transparent)",
            }}
          >
            Yapay zeka motorumuz seyahat etmek istediğiniz destinasyonları, ilgi etiketlerinizi
            (Tarih, Doğa, Gastronomi) ve planlanan gezi tarihlerini analiz ederek en yüksek uyuma
            sahip gezginleri eşleştirir.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <span
            style={{
              padding: "6px 14px",
              borderRadius: "999px",
              background: "var(--color-accent-a20)",
              border: "1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)",
              color: "var(--color-accent-strong)",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            ⚡ Aktif Eşleşme Algoritması
          </span>
        </div>
      </div>

      {/* Buddy Search & Filter Bar */}
      <div className="marketplace-controls-bar" style={{ marginBottom: "1.25rem" }}>
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Gezgin adı, şehir veya ilgi alanı ara (örn: Roma, Doğa, Kahve)..."
            className="market-search-input"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              style={{
                background: "transparent",
                border: "none",
                color: "color-mix(in srgb, var(--color-on-primary) 60%, transparent)",
                cursor: "pointer",
                padding: "0 8px",
                fontSize: "14px",
              }}
              title="Aramayı Temizle"
            >
              ✕
            </button>
          )}
        </div>

        <div className="market-filter-group">
          <select
            className="filter-select"
            value={interestFilter}
            onChange={(e) => onInterestChange(e.target.value)}
          >
            <option value="all">Tüm İlgi Alanları</option>
            <option value="Tarih & Kültür">🏛️ Tarih &amp; Kültür</option>
            <option value="Doğa & Yürüyüş">🌲 Doğa &amp; Yürüyüş</option>
            <option value="Gastronomi">🍽️ Gastronomi &amp; Kahve</option>
            <option value="Fotoğrafçılık">📷 Fotoğrafçılık</option>
            <option value="Bisiklet">🚲 Bisiklet &amp; Macera</option>
          </select>
        </div>
      </div>

      {/* Travel Buddy Match Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "1.25rem",
        }}
      >
        {filteredBuddies.length === 0 ? (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "3rem 1.5rem",
              textAlign: "center",
              background: "var(--card-bg, var(--color-surface))",
              borderRadius: "16px",
              border: "1px dashed var(--card-border, color-mix(in srgb, var(--color-primary) 20%, transparent))",
            }}
          >
            <span style={{ fontSize: "2rem", display: "block", marginBottom: "0.5rem" }}>🤝</span>
            <h3 style={{ margin: "0 0 0.5rem", color: "var(--text-primary, var(--color-on-accent))" }}>
              Aramanıza uygun gezi arkadaşı bulunamadı
            </h3>
            <p style={{ margin: 0, color: "var(--text-muted, #4b5563)", fontSize: "0.9rem" }}>
              Filtreleri sıfırlayarak tüm gezginleri listeleyebilirsiniz.
            </p>
          </div>
        ) : (
          filteredBuddies.map((buddy) => {
            const isFollowing = followedUsernames.includes(buddy.username);

            return (
              <div
                key={buddy.id}
                style={{
                  background: "var(--card-bg, var(--color-surface))",
                  borderRadius: "16px",
                  border: "1px solid var(--card-border, color-mix(in srgb, var(--color-primary) 12%, transparent))",
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.9rem",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
              >
                {/* Header: Avatar, Name, Score */}
                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <img
                      src={buddy.avatar}
                      alt={buddy.name}
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "2px solid var(--color-accent)",
                      }}
                    />
                    <div>
                      <h4
                        style={{
                          margin: 0,
                          fontSize: "15px",
                          fontWeight: 700,
                          color: "var(--text-primary, var(--color-on-accent))",
                        }}
                      >
                        {buddy.name}
                      </h4>
                      <span style={{ fontSize: "12px", color: "var(--text-muted, var(--color-text-subtle))" }}>
                        @{buddy.username} · {buddy.travelStyle}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                      border: "1px solid var(--color-accent-a30)",
                      borderRadius: "10px",
                      padding: "4px 8px",
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "var(--color-success-strong)",
                        display: "block",
                      }}
                    >
                      UYUM
                    </span>
                    <strong style={{ fontSize: "14px", color: "var(--color-success)" }}>
                      %{buddy.matchScore}
                    </strong>
                  </div>
                </div>

                {/* Destination & Date */}
                <div
                  style={{
                    background: "rgba(0,0,0,0.02)",
                    borderRadius: "10px",
                    padding: "8px 12px",
                    fontSize: "12px",
                    color: "var(--text-secondary, var(--color-neutral-800))",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>📍</span>
                    <strong>Hedef:</strong>
                    <span>{buddy.targetDestination}</span>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}
                  >
                    <span>🗓️</span>
                    <strong>Tarih:</strong>
                    <span>{buddy.travelDates}</span>
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--color-success-strong)",
                      marginTop: "4px",
                      fontStyle: "italic",
                    }}
                  >
                    ✨ {buddy.matchReason}
                  </div>
                </div>

                {/* Bio */}
                <p
                  style={{
                    margin: 0,
                    fontSize: "12.5px",
                    lineHeight: "1.45",
                    color: "var(--text-body, var(--color-neutral-700))",
                  }}
                >
                  &quot;{buddy.bio}&quot;
                </p>

                {/* Interests Chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  {buddy.interests.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        background: "var(--tag-bg, rgba(0,0,0,0.05))",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--text-muted, #475569)",
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", gap: "8px", marginTop: "auto", paddingTop: "8px" }}>
                  <button
                    type="button"
                    onClick={() => onOpenDirectMessage(buddy)}
                    style={{
                      flex: 1,
                      padding: "9px 12px",
                      borderRadius: "10px",
                      background: "var(--color-accent)",
                      color: "#031c13",
                      fontWeight: 700,
                      fontSize: "12.5px",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <span className="material-symbols-outlined">chat</span>
                    <span>Bire Bir Mesaj</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleFollow(buddy.username)}
                    style={{
                      padding: "9px 14px",
                      borderRadius: "10px",
                      background: isFollowing ? "rgba(16,185,129,0.15)" : "rgba(0,0,0,0.06)",
                      color: isFollowing ? "#059669" : "inherit",
                      fontWeight: 600,
                      fontSize: "12.5px",
                      border: "1px solid rgba(0,0,0,0.08)",
                      cursor: "pointer",
                    }}
                  >
                    {isFollowing ? "✓ Takipte" : "+ Takip"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
