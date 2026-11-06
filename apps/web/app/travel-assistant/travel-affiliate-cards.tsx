"use client";
// Hazırlık sekmesinin affiliate yüzeyi (I8: yalnız prep-panel.tsx render eder). FEAT-013:
// Icon + studio.css token'ları, metinler t() üzerinden (I11); tıklama izleme değişmedi.

import { useEffect, useMemo, useState } from "react";
import {
  buildFlightCard,
  buildHotelCard,
  buildTripAffiliateBundle,
  extractDateFromText,
  toIataPublic,
} from "../lib/affiliate/travelpayouts";
import type { AffiliateCard, AffiliateCardType } from "../lib/affiliate/types";
import type { UnifiedRoutePlan } from "../lib/ai/types";
import { useLocale } from "../lib/locale-context";
import { Icon, type IconName } from "../components/ui";
import { fill, type Translate } from "./studio-format";

interface Props {
  route: UnifiedRoutePlan;
  onTrack?: (card: AffiliateCard) => void;
}

const ICON: Record<AffiliateCardType, IconName> = {
  flight: "plane",
  hotel: "bed",
  car: "drive",
  insurance: "shield",
  activity: "sparkle",
};

/** Kart başlığı/CTA kullanıcının dilinde (I11); lib metni yalnızca bilinmeyen tipte yedek. */
function cardText(t: Translate, card: AffiliateCard): { title: string; cta: string } {
  const destination = card.destination;
  switch (card.type) {
    case "flight":
      return {
        title: fill(t("studio.affiliate.flight.title", "{destination} Uçuş Arama"), {
          destination,
        }),
        cta: t("studio.affiliate.flight.cta", "Uçuş Fiyatlarını Gör"),
      };
    case "hotel":
      return {
        title: fill(t("studio.affiliate.hotel.title", "{destination} Otel Arama"), { destination }),
        cta: t("studio.affiliate.hotel.cta", "Otel Fiyatlarını Gör"),
      };
    case "car":
      return {
        title: fill(t("studio.affiliate.car.title", "{destination} Araç Kiralama"), {
          destination,
        }),
        cta: t("studio.affiliate.car.cta", "Araç Fiyatlarını Karşılaştır"),
      };
    case "insurance":
      return {
        title: t("studio.affiliate.insurance.title", "Seyahat Sigortası"),
        cta: t("studio.affiliate.insurance.cta", "Sigorta Fiyatlarını Gör"),
      };
    default:
      return { title: card.title, cta: card.cta };
  }
}

/** Hazırlık sekmesi (rota var): uçuş/otel/araç/sigorta bağlantıları. Yalnız PrepPanel'den (I8). */
export function TravelAffiliateCards({ route, onTrack }: Props) {
  const { t } = useLocale();
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
    } catch {
      // ignore
    }
  }

  return (
    <div className="as-studio-affiliate">
      <p className="as-studio-affiliate__head">
        <Icon name="coin" size={16} />
        {fill(t("studio.affiliate.heading", "{destination} için seyahat fırsatları"), {
          destination: route.destination || t("studio.affiliate.yourRoute", "Rotanız"),
        })}
      </p>
      <ul className="as-studio-affiliate__grid">
        {cards.map((card) => {
          const text = cardText(t, card);
          return (
            <li key={card.id}>
              <a
                href={card.href}
                target="_blank"
                rel="noopener noreferrer"
                className="as-studio-affiliate__card"
                onClick={() => handleClick(card)}
              >
                <Icon name={ICON[card.type]} className="as-studio-affiliate__icon" />
                <span className="as-studio-affiliate__body">
                  <strong className="as-studio-affiliate__title">{text.title}</strong>
                  <span className="as-studio-affiliate__cta">
                    {text.cta}
                    <Icon name="arrow" size={16} />
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      <p className="as-studio__meta">
        {t(
          "studio.affiliate.attribution",
          "Travelpayouts ortaklık programı. Bağlantıya tıkladığınızda yönlendirilirsiniz.",
        )}
      </p>
    </div>
  );
}

interface LivePrice {
  flight?: { amount: number; currency: string; link: string };
  hotel?: { amount: number; currency: string; link: string };
}

/** Compact 2-button strip for non-route messages where a destination is detected.
 *  Fetches real prices from Travelpayouts Data API via /prices/flights and /prices/hotels.
 */
export function InlineAffiliateStrip({
  destination,
  messageText,
  authToken,
}: {
  destination: string;
  messageText?: string;
  authToken?: string;
}) {
  const { t } = useLocale();
  const departDate = useMemo(
    () => (messageText ? extractDateFromText(messageText) : undefined),
    [messageText],
  );
  const flight = useMemo(
    () => buildFlightCard({ destination, departDate }),
    [destination, departDate],
  );
  const hotel = useMemo(
    () => buildHotelCard({ destination, checkIn: departDate }),
    [destination, departDate],
  );

  const [livePrice, setLivePrice] = useState<LivePrice | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  useEffect(() => {
    if (!authToken) return;
    const iata = toIataPublic(destination);
    if (!iata) return;

    let cancelled = false;
    setPriceLoading(true);

    const fetchPrices = async () => {
      try {
        const params = new URLSearchParams({ origin: "IST", destination: iata, currency: "usd" });
        if (departDate) params.set("departDate", departDate.toISOString().slice(0, 7));

        const [flightRes, hotelRes] = await Promise.allSettled([
          fetch(`/prices/flights?${params}`, {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
          fetch(
            `/prices/hotels?location=${encodeURIComponent(destination)}&checkIn=${
              departDate
                ? departDate.toISOString().slice(0, 10)
                : new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
            }&checkOut=${
              departDate
                ? new Date(departDate.getTime() + 7 * 86400000).toISOString().slice(0, 10)
                : new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
            }&adults=2`,
            { headers: { Authorization: `Bearer ${authToken}` } },
          ),
        ]);

        if (cancelled) return;

        const live: LivePrice = {};

        if (flightRes.status === "fulfilled" && flightRes.value.ok) {
          const data = await flightRes.value.json();
          const best = data.prices?.[0];
          if (best?.price) {
            live.flight = { amount: best.price, currency: "USD", link: best.link || flight.href };
          }
        }

        if (hotelRes.status === "fulfilled" && hotelRes.value.ok) {
          const data = await hotelRes.value.json();
          const best = data.hotels?.[0];
          if (best?.priceFrom) {
            live.hotel = {
              amount: best.priceFrom,
              currency: best.currency?.toUpperCase() || "USD",
              link: best.hotelUrl || hotel.href,
            };
          }
        }

        if (!cancelled) setLivePrice(live);
      } catch {
        // Silently fall back to deep links
      } finally {
        if (!cancelled) setPriceLoading(false);
      }
    };

    fetchPrices();
    return () => {
      cancelled = true;
    };
  }, [destination, authToken, departDate]);

  function track(card: AffiliateCard) {
    try {
      window.dispatchEvent(
        new CustomEvent("mapsbridge:affiliate_click", {
          detail: {
            cardId: card.id,
            provider: card.provider,
            type: card.type,
            destination: card.destination,
            coarseWeek: getISOWeek(),
          },
        }),
      );
    } catch {
      // ignore
    }
  }

  const flightHref = livePrice?.flight?.link || flight.href;
  const hotelHref = livePrice?.hotel?.link || hotel.href;
  const loadingText = t("studio.affiliate.loading", "Fiyat yükleniyor...");

  return (
    <div className="as-studio-affiliate-strip">
      <p className="as-studio-affiliate__head">
        <Icon name="coin" size={16} />
        {fill(t("studio.affiliate.stripFor", "{destination} için:"), { destination })}
      </p>
      <div className="as-studio-affiliate-strip__links">
        <a
          href={flightHref}
          target="_blank"
          rel="noopener noreferrer"
          className="as-studio-affiliate-strip__link"
          onClick={() => track(flight)}
        >
          <Icon name="plane" size={16} />
          {livePrice?.flight
            ? fill(t("studio.affiliate.flightFrom", "Uçuş {price}'dan"), {
                price: `${livePrice.flight.amount} ${livePrice.flight.currency}`,
              })
            : priceLoading
              ? loadingText
              : t("studio.affiliate.searchFlights", "Uçuş Ara")}
        </a>
        <a
          href={hotelHref}
          target="_blank"
          rel="noopener noreferrer"
          className="as-studio-affiliate-strip__link"
          onClick={() => track(hotel)}
        >
          <Icon name="bed" size={16} />
          {livePrice?.hotel
            ? fill(t("studio.affiliate.hotelFrom", "Otel {price}/gece"), {
                price: `${livePrice.hotel.amount} ${livePrice.hotel.currency}`,
              })
            : priceLoading
              ? loadingText
              : t("studio.affiliate.findHotel", "Otel Bul")}
        </a>
      </div>
    </div>
  );
}

function getISOWeek(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const wn =
    1 +
    Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(wn).padStart(2, "0")}`;
}
