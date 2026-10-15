/**
 * Affiliate card types — shared across Travelpayouts, GetYourGuide, and future providers.
 *
 * INVARIANTS:
 *  - Every card has an attributed `href`. Never render a bare external URL.
 *  - If `price` is set, call `isExpired(card)` before rendering. Expired prices MUST NOT be shown.
 *  - `attribution` text must be visible near the CTA (legal + commission disclosure requirement).
 */

export type AffiliateProvider =
  | "travelpayouts_aviasales" // flights
  | "travelpayouts_hotellook" // hotels
  | "travelpayouts_rental" // car rental
  | "travelpayouts_insurance" // travel insurance
  | "getyourguide"; // activities / tours

export type AffiliateCardType = "flight" | "hotel" | "car" | "insurance" | "activity";

export interface AffiliatePrice {
  amount: number;
  currency: string;
  /**
   * ISO-8601 timestamp after which this price is stale and MUST NOT be rendered.
   * Unset = link-only card, no price shown.
   */
  expires_at: string;
}

export interface AffiliateCard {
  id: string;
  type: AffiliateCardType;
  provider: AffiliateProvider;
  title: string;
  /** Deep link with affiliate tracking params already appended. */
  href: string;
  /** One-line attribution shown near the CTA. Required. */
  attribution: string;
  /** Button label. */
  cta: string;
  /** Set only when we have a real cached price from an external API. */
  price?: AffiliatePrice;
  destination: string;
  /** ISO timestamp when this card was generated. */
  createdAt: string;
}

/**
 * Returns true if the card has a price that is past its TTL.
 * Callers must call this and skip rendering if true.
 */
export function isExpired(card: AffiliateCard): boolean {
  if (!card.price?.expires_at) return false;
  return Date.now() > new Date(card.price.expires_at).getTime();
}

/**
 * Click event emitted by the affiliate CTA component.
 * Logged to analytics — never PII.
 */
export interface AffiliateClickEvent {
  cardId: string;
  provider: AffiliateProvider;
  type: AffiliateCardType;
  destination: string;
  /** Coarse week (ISO week string) for cohort analysis. */
  coarseWeek: string;
}
