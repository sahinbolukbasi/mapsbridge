// ============================================================
// Multi-Tier Geocoding & Reverse Geocoding Service
// Supports: Nominatim, Photon (Komoot), and BigDataCloud
// ============================================================

import { PinCategory } from "./models";
import { placesCache } from "../google/places-cache";

export interface GeocodedPlace {
  label: string;
  address: string;
  district?: string;
  city?: string;
  country?: string;
  lat: number;
  lng: number;
  category: PinCategory;
  importance?: number;
}

export interface NearbyPoi {
  label: string;
  category: PinCategory;
  distanceMeters: number;
  lat: number;
  lng: number;
}

function detectCategoryFromText(text: string): PinCategory {
  const lower = text.toLowerCase();
  if (lower.includes("cami") || lower.includes("kilise") || lower.includes("saray") || lower.includes("kale") || lower.includes("tarih") || lower.includes("antik") || lower.includes("sarnıç") || lower.includes("tapınak")) {
    return "tarih";
  }
  if (lower.includes("müze") || lower.includes("museum") || lower.includes("galeri") || lower.includes("sanat")) {
    return "muze";
  }
  if (lower.includes("kafe") || lower.includes("cafe") || lower.includes("kahve") || lower.includes("coffee") || lower.includes("roastery")) {
    return "kahve";
  }
  if (lower.includes("restoran") || lower.includes("lokanta") || lower.includes("kebap") || lower.includes("meyhane") || lower.includes("mutfak") || lower.includes("tatlı") || lower.includes("bistro")) {
    return "yemek";
  }
  if (lower.includes("park") || lower.includes("bahçe") || lower.includes("koru") || lower.includes("orman") || lower.includes("göl") || lower.includes("şelale") || lower.includes("vadi") || lower.includes("tepe") || lower.includes("sahil")) {
    return "manzara";
  }
  if (lower.includes("çarşı") || lower.includes("avm") || lower.includes("bazar") || lower.includes("pasaj") || lower.includes("mağaza") || lower.includes("market")) {
    return "alisveris";
  }
  if (lower.includes("otel") || lower.includes("hotel") || lower.includes("pansiyon") || lower.includes("resort") || lower.includes("hostel")) {
    return "konaklama";
  }
  return "genel";
}

/** Reverse Geocoding with Fallback Hierarchy and Multi-Tier Cache */
export async function reverseGeocodeLocation(lat: number, lng: number): Promise<GeocodedPlace> {
  const cached = placesCache.getPlaceDetails<GeocodedPlace>(`geo:${lat.toFixed(4)},${lng.toFixed(4)}`);
  if (cached) return cached;

  const fallbackLabel = `Nokta (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  const fallbackAddr = `Enlem: ${lat.toFixed(5)}, Boylam: ${lng.toFixed(5)}`;

  // 1. Tier: Nominatim with explicit email parameter to prevent rate-limiting
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=tr&email=destek@mapsbridge.com`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const namePart = data.name || addr.amenity || addr.historic || addr.tourism || addr.building || addr.road || addr.suburb;
        const district = addr.suburb || addr.district || addr.town || addr.county || "";
        const city = addr.province || addr.city || addr.state || "";
        
        let label = namePart || district || city || fallbackLabel;
        if (label === district && city) label = `${district}, ${city}`;

        const shortAddrParts = [addr.road, district, city].filter(Boolean);
        const address = shortAddrParts.length > 0 ? shortAddrParts.join(", ") : (data.display_name?.split(", ").slice(0, 3).join(", ") || fallbackAddr);

        return {
          label,
          address,
          district,
          city,
          country: addr.country || "Türkiye",
          lat,
          lng,
          category: detectCategoryFromText(`${label} ${address} ${data.type || ""}`),
        };
      }
    }
  } catch {}

  // 2. Tier: Photon Komoot API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(
      `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=tr`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const feature = data.features?.[0];
      if (feature && feature.properties) {
        const p = feature.properties;
        const label = p.name || p.street || p.district || p.city || fallbackLabel;
        const addressParts = [p.street, p.district, p.city].filter(Boolean);
        const address = addressParts.length > 0 ? addressParts.join(", ") : fallbackAddr;

        return {
          label,
          address,
          district: p.district || "",
          city: p.city || p.state || "",
          country: p.country || "Türkiye",
          lat,
          lng,
          category: detectCategoryFromText(`${label} ${address}`),
        };
      }
    }
  } catch {}

  // 3. Tier: BigDataCloud Reverse Geocoding Client
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=tr`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const label = data.locality || data.principalSubdivision || fallbackLabel;
      const address = [data.locality, data.principalSubdivision, data.countryName].filter(Boolean).join(", ") || fallbackAddr;
      return {
        label,
        address,
        district: data.locality || "",
        city: data.principalSubdivision || "",
        country: data.countryName || "Türkiye",
        lat,
        lng,
        category: detectCategoryFromText(`${label} ${address}`),
      };
    }
  } catch {}

  return {
    label: fallbackLabel,
    address: fallbackAddr,
    lat,
    lng,
    category: "genel",
  };
}

/** Search Places with Multi-Tier Geocoding */
export async function searchPlaces(query: string, limit = 5): Promise<GeocodedPlace[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const results: GeocodedPlace[] = [];

  // 1. Tier: Nominatim Search
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQ)}&limit=${limit}&addressdetails=1&accept-language=tr&email=destek@mapsbridge.com`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        for (const item of data) {
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          const addr = item.address || {};
          const namePart = item.name || item.display_name?.split(",")[0];
          const district = addr.suburb || addr.district || addr.town || "";
          const city = addr.province || addr.city || "";
          const shortAddr = [district, city].filter(Boolean).join(", ") || item.display_name;

          results.push({
            label: namePart || cleanQ,
            address: shortAddr,
            district,
            city,
            country: addr.country,
            lat,
            lng,
            category: detectCategoryFromText(`${namePart} ${item.type} ${item.display_name}`),
            importance: item.importance,
          });
        }
        if (results.length > 0) return results;
      }
    }
  } catch {}

  // 2. Tier: Photon Komoot Search
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQ)}&limit=${limit}&lang=tr`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.features)) {
        for (const f of data.features) {
          const p = f.properties || {};
          const [lon, lat] = f.geometry.coordinates;
          const label = p.name || cleanQ;
          const address = [p.street, p.district, p.city].filter(Boolean).join(", ") || label;

          results.push({
            label,
            address,
            district: p.district || "",
            city: p.city || p.state || "",
            country: p.country,
            lat,
            lng: lon,
            category: detectCategoryFromText(`${label} ${address}`),
          });
        }
      }
    }
  } catch {}

  return results;
}

/** Fetch Nearby Curated Suggestions around a Coordinate */
export function getCuratedNearbyPOIs(lat: number, lng: number): NearbyPoi[] {
  // Istanbul Historical Peninsula & Kadıköy anchor samples
  const sampleAnchors: { lat: number; lng: number; name: string; cat: PinCategory }[] = [
    { lat: 41.0054, lng: 28.9768, name: "Sultanahmet Camii", cat: "tarih" },
    { lat: 41.0086, lng: 28.9802, name: "Ayasofya-i Kebîr Câmii", cat: "tarih" },
    { lat: 41.0084, lng: 28.9778, name: "Yerebatan Sarnıcı", cat: "muze" },
    { lat: 41.0115, lng: 28.9833, name: "Topkapı Sarayı Müzesi", cat: "muze" },
    { lat: 41.0106, lng: 28.9680, name: "Kapalıçarşı", cat: "alisveris" },
    { lat: 41.0165, lng: 28.9710, name: "Mısır Çarşısı (Eminönü)", cat: "alisveris" },
    { lat: 41.0256, lng: 28.9741, name: "Galata Kulesi", cat: "manzara" },
    { lat: 41.0369, lng: 28.9850, name: "İstiklal Caddesi & Taksim", cat: "turistik" },
    { lat: 40.9882, lng: 29.0267, name: "Moda Sahili & Parkı", cat: "manzara" },
    { lat: 40.9904, lng: 29.0289, name: "Bahariye Caddesi & Süreyya Operası", cat: "kultur" },
    { lat: 38.6431, lng: 34.8289, name: "Göreme Açık Hava Müzesi", cat: "muze" },
    { lat: 38.6521, lng: 34.8054, name: "Uçhisar Kalesi", cat: "manzara" },
    { lat: 41.8902, lng: 12.4922, name: "Kolezyum (Colosseum)", cat: "tarih" },
    { lat: 35.6595, lng: 139.7005, name: "Shibuya Crossing", cat: "turistik" },
  ];

  return sampleAnchors
    .map((anchor) => {
      const d = Math.hypot(anchor.lat - lat, anchor.lng - lng) * 111000; // ~meters
      return {
        label: anchor.name,
        category: anchor.cat,
        distanceMeters: Math.round(d),
        lat: anchor.lat,
        lng: anchor.lng,
      };
    })
    .filter((poi) => poi.distanceMeters < 50000) // Within 50km
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 4);
}
