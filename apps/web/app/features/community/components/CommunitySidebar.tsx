"use client";

import React from "react";
import type { MarketRoute, GroupTrip } from "../types";

interface CommunitySidebarProps {
  marketRoutes: MarketRoute[];
  groupTrips: GroupTrip[];
  onOpenTripModal: (trip: GroupTrip) => void;
  onSelectTab: (tab: "discover" | "routes" | "trips" | "buddy") => void;
}

export function CommunitySidebar({
  marketRoutes,
  groupTrips,
  onOpenTripModal,
  onSelectTab,
}: CommunitySidebarProps) {
  return (
    <aside className="content-sidebar" data-purpose="community-sidebar">
      {/* Widget 1: Trend Rotalar & Pazar Yeri */}
      <div className="sidebar-widget">
        <div className="sidebar-widget-header">
          <div className="sidebar-widget-title">
            <span className="sidebar-widget-icon">🌟</span>
            <h3>Trend Rotalar &amp; Pazar Yeri</h3>
          </div>
          <button
            type="button"
            className="sidebar-widget-link"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            onClick={() => onSelectTab("routes")}
          >
            Tümü
          </button>
        </div>
        <div className="sidebar-trend-list">
          {marketRoutes.slice(0, 3).map((r, idx) => (
            <div key={r.id} className="sidebar-trend-item">
              <div className="sidebar-trend-left">
                <div className={`sidebar-trend-rank ${idx === 0 ? "top" : ""}`}>
                  {String(idx + 1).padStart(2, "0")}
                </div>
                <div>
                  <h4 className="sidebar-trend-name">{r.title}</h4>
                  <p className="sidebar-trend-meta">
                    {r.stopCount} Durak • {r.salesCount * 25} İndirme
                  </p>
                </div>
              </div>
              <span className={`sidebar-trend-price ${r.price === 0 ? "free" : ""}`}>
                {r.price === 0 ? "Ücretsiz" : `₺${r.price}`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Widget 2: Yaklaşan Grup Gezileri */}
      <div className="sidebar-widget">
        <div className="sidebar-widget-header">
          <div className="sidebar-widget-title">
            <span className="sidebar-widget-icon">👥</span>
            <h3>Yaklaşan Grup Gezileri</h3>
          </div>
          <span className="sidebar-live-dot" />
        </div>
        <div className="sidebar-trip-list">
          {groupTrips.slice(0, 2).map((trip) => {
            const approvedCount = trip.attendees.filter((a) => a.status === "approved").length;
            const spotsLeft = Math.max(0, trip.capacity - approvedCount);
            return (
              <div key={trip.id} className="sidebar-trip-item">
                <div className="sidebar-trip-header">
                  <span className="sidebar-trip-dates">{trip.dates}</span>
                  <span className={`sidebar-trip-slot ${spotsLeft <= 2 ? "urgent" : ""}`}>
                    {spotsLeft === 0 ? "Grup Dolu" : `${spotsLeft} Kişi Aranıyor`}
                  </span>
                </div>
                <h4 className="sidebar-trip-title">{trip.title}</h4>
                <p className="sidebar-trip-desc">
                  {trip.destination} • {trip.style}
                </p>
                <div className="sidebar-trip-footer">
                  <div className="sidebar-trip-avatars">
                    {trip.attendees.slice(0, 3).map((a) => (
                      <span key={a.id} className="sidebar-mini-avatar">
                        {a.displayName?.charAt(0) || a.username.charAt(0)}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="sidebar-trip-btn"
                    onClick={() => onOpenTripModal(trip)}
                  >
                    Detay ➔
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
