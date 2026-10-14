"use client";

import React from "react";
import type { MarketRoute } from "../types";

interface RoutesTabProps {
  marketRoutes: MarketRoute[];
  searchQuery: string;
  categoryFilter: string;
  costFilter: "all" | "free" | "paid";
  purchasedRouteIds: string[];
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onCostChange: (cost: "all" | "free" | "paid") => void;
  onAddToMyTrip: (route: { title: string; destination?: string; stops?: any[] }) => void;
  onOpenStripeModal: (route: MarketRoute) => void;
  onOpenListRouteModal: () => void;
}

export function RoutesTab({
  marketRoutes,
  searchQuery,
  categoryFilter,
  costFilter,
  purchasedRouteIds,
  onSearchChange,
  onCategoryChange,
  onCostChange,
  onAddToMyTrip,
  onOpenStripeModal,
  onOpenListRouteModal,
}: RoutesTabProps) {
  const filteredRoutes = marketRoutes.filter((r) => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const matchQ =
        r.title.toLowerCase().includes(q) ||
        r.destination.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q);
      if (!matchQ) return false;
    }
    if (categoryFilter !== "all" && r.category !== categoryFilter) {
      return false;
    }
    if (costFilter === "free" && r.price > 0) return false;
    if (costFilter === "paid" && r.price === 0) return false;
    return true;
  });

  return (
    <section className="tab-pane-content" aria-label="Topluluk Rota Kütüphanesi">
      {/* Search & Filter Bar */}
      <div className="marketplace-controls-bar">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Rota veya şehir ara (örn: Roma, İstanbul, Kapadokya)..."
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
                color: "rgba(255,255,255,0.6)",
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
            value={categoryFilter}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            <option value="all">Tüm Kategoriler</option>
            <option value="Şehir Gezisi">Şehir Gezisi</option>
            <option value="Gastronomi">Gastronomi &amp; Kafe</option>
            <option value="Fotoğrafçılık">Fotoğrafçılık</option>
            <option value="Tarih & Kültür">Tarih &amp; Kültür</option>
            <option value="Doğa & Yürüyüş">Doğa &amp; Yürüyüş</option>
          </select>

          <div className="cost-toggle-pill">
            <button
              type="button"
              className={`cost-toggle-btn ${costFilter === "all" ? "active" : ""}`}
              onClick={() => onCostChange("all")}
            >
              Tümü
            </button>
            <button
              type="button"
              className={`cost-toggle-btn ${costFilter === "free" ? "active" : ""}`}
              onClick={() => onCostChange("free")}
            >
              Ücretsiz
            </button>
            <button
              type="button"
              className={`cost-toggle-btn ${costFilter === "paid" ? "active" : ""}`}
              onClick={() => onCostChange("paid")}
            >
              Rehber Satış
            </button>
          </div>

          <button
            type="button"
            className="btn-list-route-action"
            onClick={onOpenListRouteModal}
          >
            <span>+</span>
            <span>Rotanı Paylaş</span>
          </button>
        </div>
      </div>

      {/* Routes Grid */}
      <div className="routes-cards-grid">
        {filteredRoutes.length === 0 ? (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "3.5rem 1.5rem",
              textAlign: "center",
              background: "var(--card-bg, #ffffff)",
              borderRadius: "16px",
              border: "1px dashed var(--card-border, rgba(1,54,40,0.2))",
            }}
          >
            <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "0.5rem" }}>
              🗺️
            </span>
            <h3 style={{ margin: "0 0 0.5rem", color: "var(--text-primary, #0d281e)" }}>
              Aramanıza uygun rota bulunamadı
            </h3>
            <p style={{ margin: "0 0 1rem", color: "var(--text-muted, #4b5563)", fontSize: "0.9rem" }}>
              Farklı bir arama terimi veya filtre deneyebilirsiniz.
            </p>
            <button
              type="button"
              className="btn-list-route-action"
              onClick={() => {
                onSearchChange("");
                onCategoryChange("all");
                onCostChange("all");
              }}
              style={{ display: "inline-flex" }}
            >
              Filtreleri Sıfırla
            </button>
          </div>
        ) : (
          filteredRoutes.map((route) => {
            const isOwned = route.price === 0 || purchasedRouteIds.includes(route.id);
            return (
              <div key={route.id} className="market-route-card">
                {/* Cover Image & Category Pill */}
                <div className="route-cover-wrap">
                  <img
                    src={route.coverImage}
                    alt={route.title}
                    className="route-cover-img"
                    loading="lazy"
                  />
                  <div className="route-cover-overlay" />
                  <span className="route-cat-pill">{route.category}</span>
                  <span className={`route-price-badge ${route.price === 0 ? "free" : ""}`}>
                    {route.price === 0 ? "Ücretsiz" : `₺${route.price}`}
                  </span>
                </div>

                {/* Card Body */}
                <div className="route-card-body">
                  <div className="route-dest-row">
                    <span className="route-dest-pin">📍</span>
                    <span className="route-dest-name">{route.destination}</span>
                    <span className="route-dot-sep">•</span>
                    <span className="route-duration-label">{route.durationLabel}</span>
                  </div>

                  <h3 className="route-card-title">{route.title}</h3>
                  <p className="route-card-desc">{route.description}</p>

                  {/* Highlights / Stops Pill */}
                  <div className="route-stops-preview">
                    <span className="stops-count-tag">📍 {route.stopCount} Durak</span>
                    <span className="stops-rating-tag">⭐ {route.rating.toFixed(1)} ({route.reviewCount})</span>
                    <span className="stops-sales-tag">💾 {route.salesCount * 18} Klonlama</span>
                  </div>

                  {/* Seller info */}
                  <div className="route-seller-row">
                    <div className="seller-avatar-name">
                      {route.sellerAvatar ? (
                        <img
                          src={route.sellerAvatar}
                          alt={route.sellerName}
                          className="seller-avatar"
                        />
                      ) : (
                        <div className="seller-avatar-fallback">
                          {route.sellerName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <span className="seller-name">{route.sellerName}</span>
                        <span className="seller-handle">@{route.sellerUsername}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action */}
                  <div className="route-card-action-row">
                    {isOwned ? (
                      <button
                        type="button"
                        className="btn-add-to-trip-primary"
                        onClick={() => onAddToMyTrip(route)}
                      >
                        <span>➕</span>
                        <span>Seyahate Klonla</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-buy-route-primary"
                        onClick={() => onOpenStripeModal(route)}
                      >
                        <span>🔒</span>
                        <span>Rehberi Satın Al (₺{route.price})</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
