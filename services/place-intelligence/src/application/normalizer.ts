/**
 * Place Data Normalizer & Deduplicator
 *
 * Normalizes data from multiple sources into a canonical format,
 * deduplicates by proximity + name similarity, and merges enrichments.
 */

import type { NormalizedPlace, PlaceCategory } from '../domain/types';

export function categoryFromOsmTags(tags: Record<string, string>): PlaceCategory {
  if (tags.amenity === 'restaurant' || tags.cuisine) return 'restaurant';
  if (tags.amenity === 'cafe') return 'cafe';
  if (tags.amenity === 'bar' || tags.amenity === 'pub') return 'bar';
  if (tags.amenity === 'nightclub') return 'nightlife';
  if (tags.tourism === 'museum') return 'museum';
  if (tags.tourism === 'gallery') return 'gallery';
  if (tags.historic === 'monument' || tags.historic === 'memorial') return 'monument';
  if (tags.historic) return 'historical';
  if (tags.leisure === 'park' || tags.leisure === 'nature_reserve') return 'park';
  if (tags.leisure === 'garden') return 'garden';
  if (tags.natural === 'beach') return 'beach';
  if (tags.tourism === 'hotel' || tags.tourism === 'motel') return 'hotel';
  if (tags.tourism === 'hostel') return 'hostel';
  if (tags.amenity === 'place_of_worship') {
    const religion = tags.religion;
    if (religion === 'muslim') return 'mosque';
    if (religion === 'christian') return 'church';
    return 'temple';
  }
  if (tags.shop) return 'shop';
  if (tags.amenity === 'marketplace') return 'market';
  if (tags.tourism === 'viewpoint') return 'viewpoint';
  if (tags.tourism === 'attraction') return 'attraction';
  if (tags.railway === 'station') return 'transport';
  if (tags.amenity === 'pharmacy') return 'pharmacy';
  if (tags.amenity === 'hospital') return 'hospital';
  return 'other';
}

export function inferTiming(category: PlaceCategory, name: string): {
  typicalDurationMins: number;
  recommendedSlot: 'morning' | 'afternoon' | 'evening' | 'any';
} {
  const n = name.toLowerCase();

  switch (category) {
    case 'museum':
    case 'gallery':
      return { typicalDurationMins: 120, recommendedSlot: 'morning' };
    case 'cafe':
      return { typicalDurationMins: 45, recommendedSlot: 'morning' };
    case 'restaurant':
      if (n.includes('breakfast') || n.includes('kahvaltı')) return { typicalDurationMins: 60, recommendedSlot: 'morning' };
      return { typicalDurationMins: 75, recommendedSlot: 'afternoon' };
    case 'bar':
    case 'nightlife':
      return { typicalDurationMins: 90, recommendedSlot: 'evening' };
    case 'park':
    case 'garden':
    case 'beach':
    case 'nature':
      return { typicalDurationMins: 90, recommendedSlot: 'morning' };
    case 'monument':
    case 'historical':
      return { typicalDurationMins: 45, recommendedSlot: 'morning' };
    case 'viewpoint':
      if (n.includes('sunset') || n.includes('gün batımı')) return { typicalDurationMins: 45, recommendedSlot: 'evening' };
      return { typicalDurationMins: 30, recommendedSlot: 'afternoon' };
    case 'landmark':
    case 'attraction':
      return { typicalDurationMins: 60, recommendedSlot: 'afternoon' };
    case 'temple':
    case 'mosque':
    case 'church':
      return { typicalDurationMins: 30, recommendedSlot: 'morning' };
    case 'shop':
    case 'market':
    case 'mall':
      return { typicalDurationMins: 60, recommendedSlot: 'afternoon' };
    default:
      return { typicalDurationMins: 45, recommendedSlot: 'any' };
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeString(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9À-ɏЀ-ӿ؀-ۿ]/g, '');
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeString(a);
  const nb = normalizeString(b);
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  let matches = 0;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }
  return matches / longer.length;
}

export function deduplicatePlaces(places: NormalizedPlace[]): NormalizedPlace[] {
  const PROXIMITY_THRESHOLD_KM = 0.05;
  const NAME_SIMILARITY_THRESHOLD = 0.7;

  const result: NormalizedPlace[] = [];

  for (const place of places) {
    const duplicate = result.find(existing =>
      haversineKm(existing.lat, existing.lng, place.lat, place.lng) < PROXIMITY_THRESHOLD_KM &&
      nameSimilarity(existing.name, place.name) > NAME_SIMILARITY_THRESHOLD
    );

    if (duplicate) {
      mergePlaceData(duplicate, place);
    } else {
      result.push({ ...place });
    }
  }

  return result;
}

function mergePlaceData(target: NormalizedPlace, source: NormalizedPlace): void {
  if (!target.rating && source.rating) target.rating = source.rating;
  if (!target.reviewCount && source.reviewCount) target.reviewCount = source.reviewCount;
  if (!target.phone && source.phone) target.phone = source.phone;
  if (!target.website && source.website) target.website = source.website;
  if (!target.description && source.description) target.description = source.description;
  if (!target.openingHours && source.openingHours) target.openingHours = source.openingHours;
  if (!target.priceLevel && source.priceLevel) target.priceLevel = source.priceLevel;
  if ((!target.photos || target.photos.length === 0) && source.photos?.length) target.photos = source.photos;

  const newTags = source.tags.filter(t => !target.tags.includes(t));
  target.tags.push(...newTags);

  const newSubs = source.subcategories.filter(s => !target.subcategories.includes(s));
  target.subcategories.push(...newSubs);
}

export function rankPlaces(places: NormalizedPlace[]): NormalizedPlace[] {
  return [...places].sort((a, b) => {
    let scoreA = 0, scoreB = 0;

    if (a.rating) scoreA += a.rating * 10;
    if (b.rating) scoreB += b.rating * 10;

    if (a.reviewCount) scoreA += Math.min(Math.log10(a.reviewCount) * 5, 20);
    if (b.reviewCount) scoreB += Math.min(Math.log10(b.reviewCount) * 5, 20);

    if (a.description) scoreA += 5;
    if (b.description) scoreB += 5;

    if (a.photos?.length) scoreA += Math.min(a.photos.length * 3, 9);
    if (b.photos?.length) scoreB += Math.min(b.photos.length * 3, 9);

    if (a.openingHours) scoreA += 3;
    if (b.openingHours) scoreB += 3;

    if (a.phone) scoreA += 2;
    if (b.phone) scoreB += 2;

    if (a.website) scoreA += 2;
    if (b.website) scoreB += 2;

    return scoreB - scoreA;
  });
}
