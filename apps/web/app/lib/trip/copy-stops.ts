// Paylaşılan bir rotayı/konumu hesaba kopyalamak için durak normalizasyonu (design §5.5 J2, §6.4).
// Saf modül: yalnızca gerçekten verisi olan duraklar kopyalanır (I1). Koordinatı olmayan ya da
// adı olmayan durak atılır; eksik durak uydurulmaz, yerine varsayılan koordinat konmaz.
// Kopyalama sunucuda `POST /routes` ile yapılır (routesApi.create); bu modül ağ çağrısı yapmaz.

/** Planlayıcının tek istekte işlediği en fazla durak (OSRM istemci sınırı ile aynı, design §6.3). */
export const COPY_MAX_STOPS = 25;

export type CopyStop = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  category?: string;
  day: number;
};

type RawStop = {
  label?: unknown;
  name?: unknown;
  address?: unknown;
  lat?: unknown;
  lng?: unknown;
  category?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function coord(value: unknown, limit: number): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

/** Girdi listesinden kopyalanabilir durakları üretir (en fazla COPY_MAX_STOPS, sıra korunur). */
export function toCopyStops(stops: readonly unknown[] | null | undefined): CopyStop[] {
  if (!Array.isArray(stops)) return [];
  const out: CopyStop[] = [];
  for (const raw of stops) {
    if (out.length >= COPY_MAX_STOPS) break;
    if (!raw || typeof raw !== "object") continue;
    const s = raw as RawStop;
    const lat = coord(s.lat, 90);
    const lng = coord(s.lng, 180);
    const name = text(s.label) || text(s.name) || text(s.address);
    if (lat === null || lng === null || !name) continue;
    const address = text(s.address);
    const category = text(s.category);
    out.push({
      id: `stop-${out.length + 1}`,
      name,
      lat,
      lng,
      ...(address ? { address } : {}),
      ...(category ? { category } : {}),
      day: 1,
    });
  }
  return out;
}

/** Kopyalanan rotanın adı: boşsa null (çağıran kendi yerelleştirilmiş varsayılanını verir). */
export function copyRouteName(title: unknown): string | null {
  const name = text(title).replace(/\s+/g, " ");
  return name ? name.slice(0, 120) : null;
}
