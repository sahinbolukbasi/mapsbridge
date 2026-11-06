// ============================================================
// Çok katmanlı arama ve ters geocoding (Increment 1.6, bug 4)
// Sıra: sunucu yer proxy'si (GET /ai/chat?op=places; CSP'den bağımsız) → Nominatim → Photon
// (→ BigDataCloud yalnız reverse). Doğrudan sağlayıcılar CSP connect-src açılırsa çalışır
// (infra-changes.md). Hiçbir katman yanıt vermezse arama PlaceSearchError fırlatır: hata asla
// "Sonuç bulunamadı" (boş dizi) olarak gösterilmez. I1: alan uydurulmaz (ülke varsayılanı yok).
// ============================================================
import { PinCategory } from "./models";
import { placesCache } from "../google/places-cache";
import { placesApi, type ApiPlace, type PlaceProvider } from "./places-api";
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
  /** Yalnız proxy sonucunda: sağlayıcı yer kimliği (ayrıntı için). */
  placeId?: string;
  provider?: PlaceProvider;
  attribution?: string;
}
/** Tüm arama katmanları başarısız (ağ/CSP/sağlayıcı); gerçek boş sonuç DEĞİL. */
export class PlaceSearchError extends Error {
  constructor(message = "Arama şu an yanıt vermiyor.") {
    super(message);
    this.name = "PlaceSearchError";
  }
}
/** Proxy yerini planlayıcı biçimine çevirir; adres yoksa boş kalır (uydurulmaz). */
export function fromApiPlace(p: ApiPlace): GeocodedPlace {
  return {
    label: p.name,
    address: p.address || "",
    lat: p.lat,
    lng: p.lng,
    category: detectCategoryFromText(`${p.name} ${p.category || ""}`),
    placeId: p.id,
    provider: p.provider,
    attribution: p.attribution,
  };
}
export function detectCategoryFromText(text: string): PinCategory {
  const lower = text.toLowerCase();
  if (
    lower.includes("cami") ||
    lower.includes("kilise") ||
    lower.includes("saray") ||
    lower.includes("kale") ||
    lower.includes("tarih") ||
    lower.includes("antik") ||
    lower.includes("sarnıç") ||
    lower.includes("tapınak")
  ) {
    return "tarih";
  }
  if (
    lower.includes("müze") ||
    lower.includes("museum") ||
    lower.includes("galeri") ||
    lower.includes("sanat")
  ) {
    return "muze";
  }
  if (
    lower.includes("kafe") ||
    lower.includes("cafe") ||
    lower.includes("kahve") ||
    lower.includes("coffee") ||
    lower.includes("roastery")
  ) {
    return "kahve";
  }
  if (
    lower.includes("restoran") ||
    lower.includes("lokanta") ||
    lower.includes("kebap") ||
    lower.includes("meyhane") ||
    lower.includes("mutfak") ||
    lower.includes("tatlı") ||
    lower.includes("bistro")
  ) {
    return "yemek";
  }
  if (
    lower.includes("park") ||
    lower.includes("bahçe") ||
    lower.includes("koru") ||
    lower.includes("orman") ||
    lower.includes("göl") ||
    lower.includes("şelale") ||
    lower.includes("vadi") ||
    lower.includes("tepe") ||
    lower.includes("sahil")
  ) {
    return "manzara";
  }
  if (
    lower.includes("çarşı") ||
    lower.includes("avm") ||
    lower.includes("bazar") ||
    lower.includes("pasaj") ||
    lower.includes("mağaza") ||
    lower.includes("market")
  ) {
    return "alisveris";
  }
  if (
    lower.includes("otel") ||
    lower.includes("hotel") ||
    lower.includes("pansiyon") ||
    lower.includes("resort") ||
    lower.includes("hostel")
  ) {
    return "konaklama";
  }
  return "genel";
}

/** Reverse Geocoding with Fallback Hierarchy and Multi-Tier Cache */
export async function reverseGeocodeLocation(lat: number, lng: number): Promise<GeocodedPlace> {
  const cached = placesCache.getPlaceDetails<GeocodedPlace>(
    `geo:${lat.toFixed(4)},${lng.toFixed(4)}`,
  );
  if (cached) return cached;

  const fallbackLabel = `Nokta (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  const fallbackAddr = `Enlem: ${lat.toFixed(5)}, Boylam: ${lng.toFixed(5)}`;
  // 0. Katman: sunucu yer proxy'si (Amazon Location ReverseGeocode).
  try {
    const { places } = await placesApi.reverse(lat, lng);
    const hit = places[0];
    if (hit) {
      // Ad ve adres kaynaktan; koordinat kullanıcının dokunduğu nokta kalır.
      return { ...fromApiPlace(hit), lat, lng, address: hit.address || fallbackAddr };
    }
  } catch {}
  // 1. Tier: Nominatim with explicit email parameter to prevent rate-limiting
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=tr&email=destek@mapsbridge.com`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const namePart =
          data.name ||
          addr.amenity ||
          addr.historic ||
          addr.tourism ||
          addr.building ||
          addr.road ||
          addr.suburb;
        const district = addr.suburb || addr.district || addr.town || addr.county || "";
        const city = addr.province || addr.city || addr.state || "";

        let label = namePart || district || city || fallbackLabel;
        if (label === district && city) label = `${district}, ${city}`;

        const shortAddrParts = [addr.road, district, city].filter(Boolean);
        const address =
          shortAddrParts.length > 0
            ? shortAddrParts.join(", ")
            : data.display_name?.split(", ").slice(0, 3).join(", ") || fallbackAddr;

        return {
          label,
          address,
          district,
          city,
          country: addr.country || undefined,
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
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=tr`, {
      signal: controller.signal,
    });
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
          country: p.country || undefined,
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
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const label = data.locality || data.principalSubdivision || fallbackLabel;
      const address =
        [data.locality, data.principalSubdivision, data.countryName].filter(Boolean).join(", ") ||
        fallbackAddr;
      return {
        label,
        address,
        district: data.locality || "",
        city: data.principalSubdivision || "",
        country: data.countryName || undefined,
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

/**
 * Mekan/adres araması. Proxy yanıt verirse (boş da olsa) onun sonucu döner. Proxy düşerse
 * Nominatim ve Photon denenir; yanıt veren ilk katmanın sonucu (boş olabilir) döner. Hiçbir
 * katman yanıt vermezse PlaceSearchError.
 */
export async function searchPlaces(
  query: string,
  limit = 5,
  opts: { near?: { lat: number; lng: number } } = {},
): Promise<GeocodedPlace[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];
  // 0. Katman: sunucu yer proxy'si.
  try {
    const { places } = await placesApi.search(cleanQ, { near: opts.near });
    return places.slice(0, limit).map(fromApiPlace);
  } catch {}
  let answered = false;
  const results: GeocodedPlace[] = [];
  // 1. Tier: Nominatim Search
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQ)}&limit=${limit}&addressdetails=1&accept-language=tr&email=destek@mapsbridge.com`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (res.ok) {
      answered = true;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        for (const item of data) {
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const addr = item.address || {};
          const namePart = item.name || item.display_name?.split(",")[0];
          if (!namePart) continue;
          const district = addr.suburb || addr.district || addr.town || "";
          const city = addr.province || addr.city || "";
          const shortAddr = [district, city].filter(Boolean).join(", ") || item.display_name || "";
          results.push({
            label: namePart,
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
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (res.ok) {
      answered = true;
      const data = await res.json();
      if (data && Array.isArray(data.features)) {
        for (const f of data.features) {
          const p = f.properties || {};
          const [lon, lat] = f.geometry?.coordinates || [];
          if (!p.name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          const label = p.name;
          const address = [p.street, p.district, p.city].filter(Boolean).join(", ");
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
  if (!answered) throw new PlaceSearchError();
  return results;
}
