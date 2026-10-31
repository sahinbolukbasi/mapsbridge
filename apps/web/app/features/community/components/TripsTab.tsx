"use client";

import React from "react";
import type { GroupTrip } from "../types";

interface TripsTabProps {
  groupTrips: GroupTrip[];
  searchQuery: string;
  activeUsername: string;
  onSearchChange: (query: string) => void;
  onJoinTrip: (trip: GroupTrip) => void;
  onOpenTripModal: (trip: GroupTrip) => void;
  onOpenNewTripModal: () => void;
}

export function TripsTab({
  groupTrips,
  searchQuery,
  activeUsername,
  onSearchChange,
  onJoinTrip,
  onOpenTripModal,
  onOpenNewTripModal,
}: TripsTabProps) {
  const filteredTrips = groupTrips.filter((t) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      t.destination.toLowerCase().includes(q) ||
      t.style.toLowerCase().includes(q)
    );
  });

  return (
    <section className="tab-pane-content" aria-label="Grup Gezileri">
      {/* Control bar */}
      <div className="marketplace-controls-bar">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Grup gezisi veya şehir ara..."
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

        <button type="button" className="btn-list-route-action" onClick={onOpenNewTripModal}>
          <span>👥</span>
          <span>Grup Gezisi Başlat</span>
        </button>
      </div>

      {/* Trips Grid */}
      <div className="trips-cards-grid">
        {filteredTrips.length === 0 ? (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "3.5rem 1.5rem",
              textAlign: "center",
              background: "var(--card-bg, var(--color-surface))",
              borderRadius: "16px",
              border: "1px dashed var(--card-border, color-mix(in srgb, var(--color-primary) 20%, transparent))",
            }}
          >
            <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "0.5rem" }}>👥</span>
            <h3 style={{ margin: "0 0 0.5rem", color: "var(--text-primary, var(--color-on-accent))" }}>
              Aktif grup gezisi bulunamadı
            </h3>
            <p
              style={{
                margin: "0 0 1rem",
                color: "var(--color-text-muted)",
                fontSize: "0.9rem",
              }}
            >
              Yeni bir seyahat grubu başlatabilir ve gezginleri davet edebilirsiniz.
            </p>
            <button
              type="button"
              className="btn-list-route-action"
              onClick={onOpenNewTripModal}
              style={{ display: "inline-flex" }}
            >
              Yeni Grup Başlat
            </button>
          </div>
        ) : (
          filteredTrips.map((trip) => {
            const isJoined = trip.attendees.some((a) => a.username === activeUsername);
            const approvedAttendees = trip.attendees.filter((a) => a.status === "approved");
            const spotsRemaining = Math.max(0, trip.capacity - approvedAttendees.length);

            return (
              <div key={trip.id} className="group-trip-card">
                <div className="trip-card-top-row">
                  <span className="trip-style-tag">{trip.style}</span>
                  <span className={`trip-spots-badge ${spotsRemaining <= 2 ? "urgent" : ""}`}>
                    {spotsRemaining === 0 ? "Grup Dolu" : `${spotsRemaining} Kontenjan Kaldı`}
                  </span>
                </div>

                <h3 className="trip-card-title">{trip.title}</h3>
                <p className="trip-card-desc">{trip.description}</p>

                <div className="trip-info-matrix">
                  <div className="matrix-item">
                    <span>🗓️ Tarih</span>
                    <strong>{trip.dates}</strong>
                  </div>
                  <div className="matrix-item">
                    <span>📍 Şehir</span>
                    <strong>{trip.destination}</strong>
                  </div>
                  <div className="matrix-item">
                    <span>👥 Katılımcı</span>
                    <strong>
                      {approvedAttendees.length} / {trip.capacity}
                    </strong>
                  </div>
                  <div className="matrix-item">
                    <span>💳 Ücret</span>
                    <strong>
                      {trip.pricePerPerson && trip.pricePerPerson > 0
                        ? `${trip.pricePerPerson} ₺`
                        : "Ücretsiz"}
                    </strong>
                  </div>
                </div>

                {/* Organizer & Attendees */}
                <div className="trip-organizer-row">
                  <div className="organizer-profile">
                    {trip.organizerAvatar ? (
                      <img
                        src={trip.organizerAvatar}
                        alt={trip.organizerName}
                        className="org-avatar"
                      />
                    ) : (
                      <div className="org-avatar-fallback">{trip.organizerName.charAt(0)}</div>
                    )}
                    <div>
                      <span className="org-name">{trip.organizerName}</span>
                      <span className="org-role">{trip.organizerRole || "Gezi Lideri"}</span>
                    </div>
                  </div>

                  <div className="attendee-mini-avatars">
                    {approvedAttendees.slice(0, 4).map((att) => (
                      <span key={att.id} className="mini-avatar-bubble">
                        {att.displayName
                          ? att.displayName.charAt(0).toUpperCase()
                          : att.username.charAt(0).toUpperCase()}
                      </span>
                    ))}
                    {approvedAttendees.length > 4 && (
                      <span className="mini-avatar-more">+{approvedAttendees.length - 4}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="trip-card-actions">
                  <button
                    type="button"
                    className="btn-inspect-trip"
                    onClick={() => onOpenTripModal(trip)}
                  >
                    Detayları Gör
                  </button>

                  {isJoined ? (
                    <button
                      type="button"
                      className="btn-joined-trip"
                      onClick={() => onOpenTripModal(trip)}
                    >
                      ✓ Gruba Katıldınız
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-join-trip-action"
                      disabled={spotsRemaining === 0}
                      onClick={() => onJoinTrip(trip)}
                    >
                      {spotsRemaining === 0 ? "Kontenjan Dolu" : "Geziye Katıl"}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
