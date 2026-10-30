"use client";

import React from "react";
import type { MarketRoute, GroupTrip } from "../types";

interface StripeCheckoutModalProps {
  item: MarketRoute | GroupTrip | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function StripeCheckoutModal({ item, onClose, onConfirm }: StripeCheckoutModalProps) {
  if (!item) return null;

  const isRoute = "price" in item;
  const price = isRoute ? (item as MarketRoute).price : (item as GroupTrip).pricePerPerson || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm();
  };

  return (
    <div className="community-modal-overlay" onClick={onClose}>
      <div className="stripe-checkout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="checkout-header">
          <div className="stripe-logo-badge">Stripe Güvenli Ödeme</div>
          <button type="button" className="btn-modal-close-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="checkout-product-summary">
          <h4>{item.title}</h4>
          <span className="checkout-dest">📍 {item.destination}</span>
          <div className="checkout-price-total">
            <span>Ödenecek Tutar</span>
            <strong>{price} ₺</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="checkout-form">
          <label className="checkout-label">
            Kart Sahibi
            <input
              type="text"
              required
              placeholder="Ad Soyad"
              className="checkout-input"
              defaultValue="Gezgin Kullanıcı"
            />
          </label>

          <label className="checkout-label">
            Kart Numarası
            <input
              type="text"
              required
              placeholder="•••• •••• •••• 4242"
              className="checkout-input"
              defaultValue="4242 4242 4242 4242"
            />
          </label>

          <div className="checkout-two-col">
            <label className="checkout-label">
              Son Kullanma
              <input
                type="text"
                required
                placeholder="AA/YY"
                className="checkout-input"
                defaultValue="12/28"
              />
            </label>
            <label className="checkout-label">
              CVC
              <input
                type="text"
                required
                placeholder="•••"
                className="checkout-input"
                defaultValue="123"
              />
            </label>
          </div>

          <button type="submit" className="btn-confirm-payment" data-surface="inverse">
            🔒 Güvenli Ödemeyi Tamamla
          </button>
        </form>
      </div>
    </div>
  );
}
