"use client";

import { useMemo } from "react";
import { buildFlightCard, buildHotelCard, buildTripAffiliateBundle } from "../lib/affiliate/travelpayouts";
import type { AffiliateCard } from "../lib/affiliate/types";
import type { UnifiedRoutePlan } from "../lib/ai/types";

interface Props {
  route: UnifiedRoutePlan;
  onTrack?: (card: AffiliateCard) => void;
}

const ICON: Record<string, string> = {
  flight: "flight_takeoff",
  hotel: "hotel",
  car: "directions_car",
  insurance: "shield",
  activity: "star",
};

const COLOR: Record<string, string> = {
  flight: "rgba(14,165,233,0.12)",
  hotel: "rgba(16,185,129,0.12)",
  car: "rgba(251,146,60,0.12)",
  insurance: "rgba(139,92,246,0.12)",
};

const BORDER_COLOR: Record<string, string> = {
  flight: "rgba(14,165,233,0.3)",
  hotel: "rgba(16,185,129,0.3)",
  car: "rgba(251,146,60,0.3)",
  insurance: "rgba(139,92,246,0.3)",
};

const ICON_COLOR: Record<string, string> = {
  flight: "#0ea5e9",
  hotel: "#10b981",
  car: "#fb923c",
  insurance: "#8b5cf6",
};

export function TravelAffiliateCards({ route, onTrack }: Props) {
  const bundle = useMemo(() => {
    const dest = route.destination || route.title || "destination";
    return buildTripAffiliateBundle({ destination: dest });
  }, [route.destination, route.title]);

  const cards = [bundle.flight, bundle.hotel, bundle.carRental, bundle.insurance];

  function handleClick(card: AffiliateCard) {
    onTrack?.(card);
    try {
      const event = {
        cardId: card.id,
        provider: card.provider,
        type: card.type,
        destination: card.destination,
        coarseWeek: getISOWeek(),
      };
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mapsbridge:affiliate_click", { detail: event }));
      }
    } catch {}
  }

  return (
    <div className="tp-affiliate-bundle" aria-label="Seyahat fırsatları">
      <div className="tp-bundle-header">
        <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "#10b981" }}>
          sell
        </span>
        <span>
          <strong>{route.destination || "Rotanız"}</strong> için seyahat fırsatları
        </span>
      </div>
      <div className="tp-cards-grid">
        {cards.map((card) => (
          <a
            key={card.id}
            href={card.href}
            target="_blank"
            rel="noopener noreferrer"
            className="tp-card"
            style={{
              background: COLOR[card.type] || "rgba(100,100,100,0.06)",
              borderColor: BORDER_COLOR[card.type] || "rgba(100,100,100,0.2)",
            }}
            onClick={() => handleClick(card)}
            aria-label={card.title}
          >
            <span
              className="material-symbols-outlined tp-card-icon"
              style={{ color: ICON_COLOR[card.type] || "#64748b" }}
            >
              {ICON[card.type] || "open_in_new"}
            </span>
            <div className="tp-card-body">
              <strong className="tp-card-title">{card.title}</strong>
              <span className="tp-card-cta">{card.cta} →</span>
            </div>
          </a>
        ))}
      </div>
      <p className="tp-attribution">
        Travelpayouts ortaklık programı. Bağlantıya tıkladığınızda yönlendirilirsiniz.
      </p>
    </div>
  );
}

/** Compact 2-button strip for non-route messages where a destination is detected. */
export function InlineAffiliateStrip({ destination }: { destination: string }) {
  const flight = useMemo(() => buildFlightCard({ destination }), [destination]);
  const hotel = useMemo(() => buildHotelCard({ destination }), [destination]);

  function track(card: AffiliateCard) {
    try {
      window.dispatchEvent(
        new CustomEvent("mapsbridge:affiliate_click", {
          detail: { cardId: card.id, provider: card.provider, type: card.type, destination: card.destination, coarseWeek: getISOWeek() },
        }),
      );
    } catch {}
  }

  return (
    <div className="tp-inline-strip" aria-label="Hızlı rezervasyon">
      <span className="tp-inline-label">
        <span className="material-symbols-outlined" style={{ fontSize: "13px", verticalAlign: "middle" }}>sell</span>
        {" "}<strong>{destination}</strong> için:
      </span>
      <a
        href={flight.href}
        target="_blank"
        rel="noopener noreferrer"
        className="tp-inline-btn tp-inline-flight"
        onClick={() => track(flight)}
      >
        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>flight_takeoff</span>
        Uçuş Ara
      </a>
      <a
        href={hotel.href}
        target="_blank"
        rel="noopener noreferrer"
        className="tp-inline-btn tp-inline-hotel"
        onClick={() => track(hotel)}
      >
        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>hotel</span>
        Otel Bul
      </a>
    </div>
  );
}

function getISOWeek(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const wn = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(wn).padStart(2, "0")}`;
}
