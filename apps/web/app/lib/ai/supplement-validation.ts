import type { LocalDiscoveryInfo, StayAndTransitInfo } from "./types";

const text = (value: unknown): value is string =>
  typeof value === "string" && !!value.trim() && value.length <= 2000;
const texts = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length <= 20 && value.every(text);
const price = /(?:\d[\d.,– -]*\s*(?:TL|USD|EUR|JPY|GBP|₺|€|¥)|[$₺€¥£]\s*\d)/iu;

// Model JSON is untrusted, including every nested value rendered by React.
export function isStayAndTransitInfo(value: unknown): value is StayAndTransitInfo {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const stays = v.stays;
  const transitTips = v.transitTips;
  return (
    texts(v.recommendedAreas) &&
    Array.isArray(stays) &&
    stays.length <= 10 &&
    stays.every((stay: unknown) => {
      if (!stay || typeof stay !== "object") return false;
      const s = stay as Record<string, unknown>;
      return (
        text(s.name) &&
        text(s.area) &&
        text(s.description) &&
        (["hotel", "hostel", "airbnb_area", "boutique"] as string[]).includes(s.type as string) &&
        (["$", "$$", "$$$", "$$$$"] as string[]).includes(s.priceLevel as string) &&
        texts(s.pros)
      );
    }) &&
    Array.isArray(transitTips) &&
    transitTips.length <= 10 &&
    transitTips.every((tip: unknown) => {
      if (!tip || typeof tip !== "object") return false;
      const t = tip as Record<string, unknown>;
      return (
        text(t.title) &&
        text(t.description) &&
        (
          ["airport_transfer", "metro_bus", "city_pass", "taxi_rideshare", "general"] as string[]
        ).includes(t.type as string) &&
        t.estimatedCost === undefined
      );
    }) &&
    (v.cityCardRecommendation === undefined || text(v.cityCardRecommendation)) &&
    !price.test(JSON.stringify(v))
  );
}

export function isLocalDiscoveryInfo(value: unknown): value is LocalDiscoveryInfo {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const gems = v.gems;
  return (
    texts(v.specialties) &&
    texts(v.cultureTips) &&
    Array.isArray(gems) &&
    gems.length <= 10 &&
    gems.every((gem: unknown) => {
      if (!gem || typeof gem !== "object") return false;
      const g = gem as Record<string, unknown>;
      return (
        text(g.name) &&
        text(g.description) &&
        text(g.highlight) &&
        (["food", "cafe", "viewpoint", "shopping", "hidden_spot"] as string[]).includes(
          g.category as string,
        ) &&
        (g.addressOrArea === undefined || text(g.addressOrArea))
      );
    }) &&
    !price.test(JSON.stringify(v))
  );
}
