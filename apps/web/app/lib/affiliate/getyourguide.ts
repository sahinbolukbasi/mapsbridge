/**
 * GetYourGuide affiliate link builder.
 *
 * Partner ID is read from NEXT_PUBLIC_GYG_PARTNER_ID env var.
 * Without a partner ID, links still work but don't earn commission — safe to render.
 *
 * Activity deep links:
 *  - Category search: https://www.getyourguide.com/{slug}/activities/?partner_id={id}
 *  - Specific tour:   https://www.getyourguide.com/-t{tourId}/?partner_id={id}
 */

import type { AffiliateCard } from "./types";

const GYG_PARTNER_ID =
  typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_GYG_PARTNER_ID ?? "")
    : "";

const GYG_BASE = "https://www.getyourguide.com";

function gygId(): string {
  return `gyg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// Destination slug map — GYG uses city slugs in URLs
const CITY_SLUGS: Record<string, string> = {
  istanbul: "istanbul",
  barcelona: "barcelona",
  paris: "paris",
  london: "london",
  rome: "rome",
  madrid: "madrid",
  amsterdam: "amsterdam",
  berlin: "berlin",
  lisbon: "lisbon",
  athens: "athens",
};

function toSlug(destination: string): string {
  return CITY_SLUGS[destination.toLowerCase().replace(/\s+/g, "")] ?? destination.toLowerCase();
}

// ── Category-level activity card ─────────────────────────────────────────────

export type GygCategory =
  | "tours"
  | "day-trips"
  | "experiences"
  | "tickets"
  | "food-and-drink"
  | "outdoor-activities";

export interface ActivityCardOptions {
  destination: string;
  category?: GygCategory;
  /** GYG tour ID for a specific tour deep link. */
  tourId?: string;
  title?: string;
  price?: { amount: number; currency: string; expires_at: string };
}

export function buildActivityCard(opts: ActivityCardOptions): AffiliateCard {
  const slug = toSlug(opts.destination);
  const url = new URL(
    opts.tourId
      ? `${GYG_BASE}/-t${opts.tourId}/`
      : `${GYG_BASE}/${slug}/activities/`
  );
  if (GYG_PARTNER_ID) url.searchParams.set("partner_id", GYG_PARTNER_ID);
  url.searchParams.set("cmp", "activities");
  if (opts.category && !opts.tourId) url.searchParams.set("category", opts.category);

  const title = opts.title ?? `${opts.destination} Aktiviteleri`;
  const cta = opts.tourId ? "Turu Gör & Rezervasyon Yap" : "Aktiviteleri Keşfet";

  return {
    id: gygId(),
    type: "activity",
    provider: "getyourguide",
    title,
    href: url.toString(),
    attribution: "GetYourGuide aracılığıyla",
    cta,
    ...(opts.price ? { price: opts.price } : {}),
    destination: opts.destination,
    createdAt: new Date().toISOString(),
  };
}

// ── Preset cards for known destination categories ────────────────────────────

/**
 * Returns 2-3 curated activity cards for a destination.
 * These are category-level cards (no specific tour ID) to avoid hardcoding stale IDs.
 */
export function buildCuratedActivityCards(destination: string): AffiliateCard[] {
  const dest = destination.toLowerCase().replace(/\s+/g, "");

  const cards: Array<{ category: GygCategory; title: string }> = [];

  switch (dest) {
    case "istanbul":
      cards.push(
        { category: "tours", title: "İstanbul Şehir Turları" },
        { category: "food-and-drink", title: "İstanbul Yemek & İçki Deneyimleri" },
        { category: "day-trips", title: "Boğaz Tekne Turları" }
      );
      break;
    case "barcelona":
      cards.push(
        { category: "tickets", title: "Sagrada Família Biletleri" },
        { category: "tours", title: "Barselona Mimari Turları" },
        { category: "food-and-drink", title: "Tapas & Şarap Deneyimleri" }
      );
      break;
    case "paris":
      cards.push(
        { category: "tickets", title: "Eyfel Kulesi Biletleri" },
        { category: "tours", title: "Paris Müze Turları" },
        { category: "food-and-drink", title: "Fransız Mutfağı Deneyimleri" }
      );
      break;
    default:
      cards.push(
        { category: "tours", title: `${destination} Şehir Turları` },
        { category: "experiences", title: `${destination} Yerel Deneyimler` }
      );
  }

  return cards.map(c =>
    buildActivityCard({ destination, category: c.category, title: c.title })
  );
}
