/**
 * Foursquare Places API Collector
 *
 * Uses Foursquare Places API v3 for rich POI data with ratings,
 * photos, tips, and verified business info. Requires API key.
 */

import type { NormalizedPlace, PlaceCategory, CityDiscoveryRequest } from '../domain/types';
import { inferTiming } from '../application/normalizer';

const FSQ_BASE = 'https://api.foursquare.com/v3/places';
const REQUEST_TIMEOUT = 10_000;

const CATEGORY_IDS: Record<string, string> = {
  restaurant: '13065',
  cafe: '13032',
  bar: '13003',
  nightlife: '10032',
  museum: '10027',
  gallery: '10025',
  monument: '16026',
  historical: '16000',
  park: '16032',
  garden: '16019',
  beach: '16003',
  hotel: '19014',
  hostel: '19011',
  temple: '12100',
  mosque: '12101',
  church: '12096',
  shop: '17000',
  market: '17114',
  viewpoint: '16046',
  landmark: '16009',
  attraction: '16000',
};

interface FoursquarePlace {
  fsq_id: string;
  name: string;
  geocodes?: { main?: { latitude: number; longitude: number } };
  location?: {
    formatted_address?: string;
    locality?: string;
    country?: string;
  };
  categories?: Array<{ id: number; name: string; short_name: string }>;
  rating?: number;
  stats?: { total_ratings?: number };
  tel?: string;
  website?: string;
  hours?: { display?: string; regular?: Array<{ day: number; open: string; close: string }> };
  photos?: Array<{ prefix: string; suffix: string; width: number; height: number }>;
  price?: number;
  description?: string;
  tips?: Array<{ text: string }>;
}

function mapFoursquareCategory(categories: FoursquarePlace['categories']): PlaceCategory {
  if (!categories?.length) return 'other';
  const name = categories[0].name.toLowerCase();
  if (name.includes('restaurant') || name.includes('food')) return 'restaurant';
  if (name.includes('café') || name.includes('coffee') || name.includes('cafe')) return 'cafe';
  if (name.includes('bar') || name.includes('pub')) return 'bar';
  if (name.includes('nightclub') || name.includes('club')) return 'nightlife';
  if (name.includes('museum')) return 'museum';
  if (name.includes('gallery') || name.includes('art')) return 'gallery';
  if (name.includes('monument') || name.includes('historic')) return 'monument';
  if (name.includes('park')) return 'park';
  if (name.includes('garden')) return 'garden';
  if (name.includes('beach')) return 'beach';
  if (name.includes('hotel')) return 'hotel';
  if (name.includes('hostel')) return 'hostel';
  if (name.includes('temple') || name.includes('shrine')) return 'temple';
  if (name.includes('mosque')) return 'mosque';
  if (name.includes('church') || name.includes('cathedral')) return 'church';
  if (name.includes('shop') || name.includes('store') || name.includes('market')) return 'shop';
  if (name.includes('viewpoint') || name.includes('scenic')) return 'viewpoint';
  if (name.includes('landmark') || name.includes('attraction')) return 'attraction';
  return 'other';
}

async function geocodeCity(city: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1&accept-language=en`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'MapsBridge/1.0 (travel-platform)' },
    signal: AbortSignal.timeout(5000),
  });
  const data = await response.json() as Array<{ lat: string; lon: string }>;
  if (!data[0]) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

export async function collectFromFoursquare(request: CityDiscoveryRequest): Promise<NormalizedPlace[]> {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) {
    console.warn('[Foursquare] No API key configured');
    return [];
  }

  const center = await geocodeCity(request.city);
  if (!center) {
    console.warn(`[Foursquare] Could not geocode city: ${request.city}`);
    return [];
  }

  const categories = request.categories || ['restaurant', 'cafe', 'museum', 'monument', 'park', 'attraction'];
  const categoryIds = categories.map(c => CATEGORY_IDS[c]).filter(Boolean).join(',');
  const radius = Math.min(request.radius || 15000, 50000);
  const limit = Math.min(request.maxResults || 50, 50);

  const params = new URLSearchParams({
    ll: `${center.lat},${center.lng}`,
    radius: String(radius),
    categories: categoryIds,
    limit: String(limit),
    fields: 'fsq_id,name,geocodes,location,categories,rating,stats,tel,website,hours,photos,price,description,tips',
  });

  const response = await fetch(`${FSQ_BASE}/search?${params}`, {
    headers: {
      Authorization: apiKey,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });

  if (!response.ok) {
    console.warn(`[Foursquare] HTTP ${response.status}`);
    return [];
  }

  const data = await response.json() as { results: FoursquarePlace[] };
  const now = new Date().toISOString();

  return data.results
    .filter(p => p.geocodes?.main && p.name)
    .map(p => {
      const cat = mapFoursquareCategory(p.categories);
      const timing = inferTiming(cat, p.name);

      return {
        id: `fsq_${p.fsq_id}`,
        sourceId: p.fsq_id,
        source: 'foursquare' as const,
        name: p.name,
        lat: p.geocodes!.main!.latitude,
        lng: p.geocodes!.main!.longitude,
        address: p.location?.formatted_address,
        city: p.location?.locality || request.city,
        country: p.location?.country || request.country || '',
        category: cat,
        subcategories: (p.categories || []).map(c => c.name),
        rating: p.rating ? p.rating / 2 : undefined,
        reviewCount: p.stats?.total_ratings,
        priceLevel: p.price as NormalizedPlace['priceLevel'],
        phone: p.tel,
        website: p.website,
        photos: (p.photos || []).slice(0, 3).map(photo => ({
          url: `${photo.prefix}original${photo.suffix}`,
          width: photo.width,
          height: photo.height,
        })),
        tags: (p.categories || []).map(c => c.short_name),
        typicalDurationMins: timing.typicalDurationMins,
        recommendedSlot: timing.recommendedSlot,
        description: p.description || p.tips?.[0]?.text,
        collectedAt: now,
        updatedAt: now,
        ttl: Math.floor(Date.now() / 1000) + 30 * 86400,
      };
    });
}
