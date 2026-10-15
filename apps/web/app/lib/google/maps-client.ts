import { placesCache } from "./places-cache";

export const googleMapsConfig = {
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "",
};
// DEMO_MAP_ID is useful in local examples but is not a production map
// configuration. The desk has a Leaflet fallback so it remains usable until
// a real JavaScript Map ID is provisioned.
export const googleMapsEnabled = Boolean(
  googleMapsConfig.apiKey && googleMapsConfig.mapId && googleMapsConfig.mapId !== "DEMO_MAP_ID",
);
let loading: Promise<void> | undefined;
/** Browser key must be restricted to site referrers and Maps JS / Places APIs in Cloud Console. */
export function loadGoogleMaps(): Promise<void> {
  if (!googleMapsEnabled)
    return Promise.reject(new Error("Google Maps bağlantısı henüz yapılandırılmadı."));
  if (typeof window.google?.maps?.importLibrary === "function") return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const globals = window as unknown as Record<string, unknown>;
    let finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      delete globals.mapsbridgeGoogleReady;
      if (error) {
        script.remove();
        loading = undefined;
        reject(error);
      } else resolve();
    };
    const timer = setTimeout(
      () => finish(new Error("Google Maps yüklenemedi. Bağlantıyı ve API erişimini kontrol edin.")),
      15000,
    );
    globals.mapsbridgeGoogleReady = () => finish();
    globals.gm_authFailure = () => {
      finish(new Error("Google Maps yetkilendirmesi başarısız."));
      window.dispatchEvent(new Event("mapsbridge:google-auth-error"));
    };
    script.id = "mapsbridge-google-maps";
    script.async = true;
    script.src =
      "https://maps.googleapis.com/maps/api/js?" +
      new URLSearchParams({
        key: googleMapsConfig.apiKey,
        v: "quarterly",
        loading: "async",
        language: "tr",
        region: "TR",
        callback: "mapsbridgeGoogleReady",
      });
    script.onerror = () => finish(new Error("Google Maps servisine ulaşılamadı."));
    document.head.appendChild(script);
  });
  return loading;
}

export async function googlePlace(id: string) {
  const cached = placesCache.getPlaceDetails(id);
  if (cached) return cached;

  await loadGoogleMaps();
  const { Place } = (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;
  const place = new Place({ id, requestedLanguage: "tr" });
  await place.fetchFields({
    fields: [
      "id",
      "displayName",
      "formattedAddress",
      "location",
      "photos",
      "rating",
      "userRatingCount",
      "reviews",
      "regularOpeningHours",
      "nationalPhoneNumber",
      "websiteURI",
      "googleMapsURI",
      "businessStatus",
      "attributions",
    ],
  });
  placesCache.setPlaceDetails(id, place);
  return place;
}
export async function searchGooglePlaces(query: string, location?: { lat: number; lng: number }) {
  const locKey = location ? `${location.lat.toFixed(3)},${location.lng.toFixed(3)}` : "";
  const cached = placesCache.getSearch<google.maps.places.Place[]>(query, locKey);
  if (cached && Array.isArray(cached) && cached.length > 0) return cached;

  await loadGoogleMaps();
  const { Place } = (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;
  const result = await Place.searchByText({
    textQuery: query,
    fields: ["id", "displayName", "formattedAddress", "location"],
    language: "tr",
    maxResultCount: 5,
    ...(location ? { locationBias: { center: location, radius: 1500 } } : {}),
  });
  if (result.places && result.places.length > 0) {
    placesCache.setSearch(query, result.places, locKey);
  }
  return result.places;
}
export function safeGoogleLink(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}
