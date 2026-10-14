import type { LocalDiscoveryInfo, StayAndTransitInfo } from './types';

const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value.length <= 2000;
const texts = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 20 && value.every(text);
const price = /(?:\d[\d.,– -]*\s*(?:TL|USD|EUR|JPY|GBP|₺|€|¥)|[$₺€¥£]\s*\d)/iu;

// Model JSON is untrusted, including every nested value rendered by React.
export function isStayAndTransitInfo(value: any): value is StayAndTransitInfo {
  return !!value && texts(value.recommendedAreas) && Array.isArray(value.stays) && value.stays.length <= 10 &&
    value.stays.every((stay: any) => stay && text(stay.name) && text(stay.area) && text(stay.description) &&
      ['hotel', 'hostel', 'airbnb_area', 'boutique'].includes(stay.type) && ['$', '$$', '$$$', '$$$$'].includes(stay.priceLevel) && texts(stay.pros)) &&
    Array.isArray(value.transitTips) && value.transitTips.length <= 10 && value.transitTips.every((tip: any) =>
      tip && text(tip.title) && text(tip.description) && ['airport_transfer', 'metro_bus', 'city_pass', 'taxi_rideshare', 'general'].includes(tip.type) && tip.estimatedCost === undefined) &&
    (value.cityCardRecommendation === undefined || text(value.cityCardRecommendation)) && !price.test(JSON.stringify(value));
}

export function isLocalDiscoveryInfo(value: any): value is LocalDiscoveryInfo {
  return !!value && texts(value.specialties) && texts(value.cultureTips) && Array.isArray(value.gems) && value.gems.length <= 10 &&
    value.gems.every((gem: any) => gem && text(gem.name) && text(gem.description) && text(gem.highlight) &&
      ['food', 'cafe', 'viewpoint', 'shopping', 'hidden_spot'].includes(gem.category) &&
      (gem.addressOrArea === undefined || text(gem.addressOrArea))) && !price.test(JSON.stringify(value));
}
