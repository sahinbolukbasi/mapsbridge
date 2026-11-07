// Mekan arama / haritaya dokunma sorgusu (Increment 4.4; web ile aynı yer proxy'si
// `GET /ai/chat?op=places`, trip/places-api.ts). Önceki istemci Google anahtarı kaldırıldı (K2:
// anahtar yalnız backend'de); anahtar boşken arama sessizce boş dönüyordu ("arama çalışmıyor").
// Yalnızca kaynağın döndürdüğü veri kullanılır (I1): ad yoksa koordinat yazılır, puan/yorum
// uydurulmaz. Arama hatası FIRLATILIR (PlacesApiError): arayüz hatayı "sonuç yok" diye göstermez.
import { API_BASE, authService } from "../services/api";
import { configurePlaces, placesApi, type ApiPlace, type PlaceProvider } from "../trip/places-api";

configurePlaces({
  base: API_BASE,
  token: async () => (await authService.getSession())?.token,
  fetch: (...args) => fetch(...args),
});

export interface PlaceCandidate {
  name: string;
  address: string;
  category: string;
  lat: number;
  lng: number;
  placeId?: string;
  provider?: PlaceProvider;
  attribution?: string;
}

const coordsName = (lat: number, lng: number) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

export function toCandidate(p: ApiPlace): PlaceCandidate {
  return {
    name: p.name.trim() || coordsName(p.lat, p.lng),
    address: p.address ?? "",
    category: p.category ?? "",
    lat: p.lat,
    lng: p.lng,
    placeId: p.id,
    provider: p.provider,
    attribution: p.attribution,
  };
}

/** Metin araması (en fazla 6 sonuç); `near` verilirse yakın sonuçlar öne alınır (sunucu). */
export async function searchPlaces(
  query: string,
  near?: { lat: number; lng: number },
): Promise<PlaceCandidate[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const { places } = await placesApi.search(q, { near, lang: "tr" });
  return places.map(toCandidate).slice(0, 6);
}

/** Haritada dokunulan nokta: yakındaki yer / adres, yoksa yalnız koordinat (hata fırlatmaz). */
export async function lookupPoint(lat: number, lng: number): Promise<PlaceCandidate> {
  const fallback: PlaceCandidate = {
    name: coordsName(lat, lng),
    address: "",
    category: "",
    lat,
    lng,
  };
  try {
    const { places } = await placesApi.reverse(lat, lng, "tr");
    const top = places[0];
    // Kullanıcının dokunduğu nokta korunur; ad/adres kaynaktan.
    return top ? { ...toCandidate(top), lat, lng } : fallback;
  } catch {
    return fallback;
  }
}
