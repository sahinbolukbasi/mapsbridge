// Mekan arama / haritaya dokunma sorgusu (mevcut Google Places + Geocoding istemci çağrıları,
// FEAT-012'de MapScreen'den ayrıldı). Yalnızca kaynağın döndürdüğü veri kullanılır (I1): bulunamazsa
// uydurma "Ayasofya" ön ayarı, varsayılan 4.8 puan ya da 150 yorum gibi değerler YOKTUR; ad yoksa
// koordinat yazılır. Hata fırlatmaz; boş liste / null döner.
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export interface PlaceCandidate {
  name: string;
  address: string;
  category: string;
  lat: number;
  lng: number;
}

/** Google tür listesinden durak kategorisi (mevcut eşleme). */
export function categoryFromTypes(types?: string[]): string {
  if (!types) return "Mekan";
  if (types.includes("museum")) return "Müze";
  if (types.includes("cafe") || types.includes("bakery")) return "Kahve ve mola";
  if (types.includes("restaurant") || types.includes("food")) return "Yeme-içme";
  if (types.includes("church") || types.includes("mosque") || types.includes("place_of_worship"))
    return "Tarihi yer";
  if (types.includes("tourist_attraction")) return "Tarihi yer";
  return "Mekan";
}

type RawPlace = {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  primaryTypeDisplayName?: { text?: string };
};

function toCandidate(p: RawPlace): PlaceCandidate | null {
  const lat = p.location?.latitude;
  const lng = p.location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const name = p.displayName?.text?.trim();
  return {
    name: name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    address: p.formattedAddress ?? "",
    category: p.primaryTypeDisplayName?.text || categoryFromTypes(p.types),
    lat,
    lng,
  };
}

const FIELDS =
  "places.displayName,places.formattedAddress,places.location,places.types,places.primaryTypeDisplayName";

/** Metin araması (en fazla 6 sonuç). */
export async function searchPlaces(query: string): Promise<PlaceCandidate[]> {
  const q = query.trim();
  if (q.length < 3 || !GOOGLE_MAPS_API_KEY) return [];
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": FIELDS,
      },
      body: JSON.stringify({ textQuery: q, languageCode: "tr" }),
    });
    const data = (await res.json()) as { places?: RawPlace[] };
    return (data.places ?? [])
      .map(toCandidate)
      .filter((p): p is PlaceCandidate => p !== null)
      .slice(0, 6);
  } catch {
    return [];
  }
}

/** Haritada dokunulan nokta: yakındaki mekan, yoksa adres, yoksa yalnız koordinat. */
export async function lookupPoint(lat: number, lng: number): Promise<PlaceCandidate> {
  const fallback: PlaceCandidate = {
    name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    address: "",
    category: "Mekan",
    lat,
    lng,
  };
  if (!GOOGLE_MAPS_API_KEY) return fallback;
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": FIELDS,
      },
      body: JSON.stringify({
        locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 60 } },
        languageCode: "tr",
      }),
    });
    const data = (await res.json()) as { places?: RawPlace[] };
    const top = data.places?.map(toCandidate).find((p): p is PlaceCandidate => p !== null);
    if (top) return top;
    const geo = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&language=tr`,
    );
    const g = (await geo.json()) as { results?: Array<{ formatted_address?: string }> };
    const address = g.results?.[0]?.formatted_address;
    return address
      ? { ...fallback, name: address.split(",")[0] || fallback.name, address }
      : fallback;
  } catch {
    return fallback;
  }
}
