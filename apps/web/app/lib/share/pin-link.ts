// Pin paylaşım kodu (D3): bir durağın koordinatı + etiketi, SUNUCUSUZ geri-döndürülebilir kısa
// koda gömülür. /k/ (süreli, sunucu kayıtlı konum paylaşımı) ile karıştırılmaz; burada paylaşılan
// veri gizli değildir (taksiciye gösterilecek varış noktasıdır), iptal/süre gerekmez, ağ turu
// gerektirmez (I12 çevrimdışı: kod istemcide çözülür). Koordinat kullanıcının gerçek pin
// kaydından gelir, uydurulmaz (I1). Saf modül: yüklenme anında window/DOM'a dokunmaz.
// Kod biçimi mevcut paylaşım kuralıyla uyumludur: `^[A-Za-z0-9-]{4,64}$` (share-code.ts).

export { SHARE_CODE_PATTERN } from "./share-code";
import { SHARE_CODE_PATTERN } from "./share-code";

export interface PinPoint {
  lat: number;
  lng: number;
  label: string;
}

/** Yük: `lat|lng|label` (lat/lng 6 ondalık, etiket 60 karaktere kırpılır). */
function encodePayload(pin: PinPoint): string {
  const lat = Number(pin.lat).toFixed(6);
  const lng = Number(pin.lng).toFixed(6);
  const label = (pin.label ?? "").slice(0, 60);
  return `${lat}|${lng}|${label}`;
}

// Base64, ortam bağımsız: tarayıcı/RN'de btoa/atob, Node (test) ortamında Buffer. TS'in `Buffer`
// adını her platformda bilmesi gerekmesin diye globalThis üzerinden erişilir.
interface NodeBuffer {
  toString(enc: string): string;
}
interface BufferCtor {
  from(input: string, enc: string): NodeBuffer;
}
const nodeBuffer = (globalThis as { Buffer?: BufferCtor }).Buffer;
const b64encode = (globalThis as { btoa?: (s: string) => string }).btoa;
const b64decode = (globalThis as { atob?: (s: string) => string }).atob;

/** UTF-8 metni → base64url (`A-Za-z0-9-_`, dolgusuz). */
function toBase64Url(text: string): string {
  const b64 = nodeBuffer
    ? nodeBuffer.from(text, "utf8").toString("base64")
    : b64encode!(unescape(encodeURIComponent(text)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url → UTF-8 metni. */
function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
  if (nodeBuffer) return nodeBuffer.from(b64, "base64").toString("utf8");
  return decodeURIComponent(escape(b64decode!(b64)));
}

// base64url `-` ve `_` kullanır; paylaşım kuralı yalnız `[A-Za-z0-9-]` kabul eder. `_`'yi kaçışla
// alfabeden çıkarırız: önce `-`→`-A`, sonra `_`→`-B`. Böylece kod yalnız `[A-Za-z0-9-]` içerir ve
// çözüm tek anlamlıdır (`-` yalnız kaçış öneki olarak kalır).
function escapeToShareCharset(b64url: string): string {
  return b64url.replace(/-/g, "-A").replace(/_/g, "-B");
}

function unescapeFromShareCharset(code: string): string | null {
  let out = "";
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch !== "-") {
      out += ch;
      continue;
    }
    const next = code[i + 1];
    if (next === "A") out += "-";
    else if (next === "B") out += "_";
    else return null; // tanınmayan kaçış: geçersiz kod
    i++;
  }
  return out;
}

/**
 * Pin'i kısa, büyük/küçük harf koruyan, URL güvenli koda çevirir (`^[A-Za-z0-9-]{4,64}$`).
 * Yük 64 karakteri aşarsa (çok uzun etiket) kod da aşabilir; bu durumda etiket daha da kırpılır.
 */
export function encodePinCode(pin: PinPoint): string {
  let label = (pin.label ?? "").slice(0, 60);
  // Kodun 64 karakter sınırını aşmaması için gerekiyorsa etiketi kademeli kırp.
  for (;;) {
    const code = escapeToShareCharset(toBase64Url(encodePayload({ ...pin, label })));
    if (code.length <= 64 || label.length === 0) return code;
    label = label.slice(0, Math.max(0, label.length - 4));
  }
}

const pinRegistry = new Map<string, PinPoint>();

export function registerNumericPin(code: string, pin: PinPoint): void {
  pinRegistry.set(code, pin);
}

export function resolveNumericPin(code: string): PinPoint | null {
  return pinRegistry.get(code) || null;
}

/**
 * 6 haneli sayısal paylaşım kodu üretir (örn. "482910").
 */
export function generateNumericPinCode(pin: PinPoint): string {
  const str = `${Number(pin.lat).toFixed(4)}_${Number(pin.lng).toFixed(4)}_${pin.label}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % 1000000;
  }
  const code = Math.abs(hash).toString().padStart(6, "0");
  registerNumericPin(code, pin);
  return code;
}

/**
 * Kodu `{lat,lng,label}`'e çözer. Biçim, aralık veya ayrıştırma hatasında `null` döner
 * (asla fırlatmaz, asla koordinat uydurmaz — I1).
 */
export function decodePinCode(code: string | null | undefined): PinPoint | null {
  const raw = (code ?? "").replace(/\s+/g, "");
  if (/^\d{6}$/.test(raw)) {
    const fromRegistry = resolveNumericPin(raw);
    if (fromRegistry) return fromRegistry;
  }
  if (!SHARE_CODE_PATTERN.test(raw)) return null;
  const b64url = unescapeFromShareCharset(raw);
  if (b64url === null) return null;
  let payload: string;
  try {
    payload = fromBase64Url(b64url);
  } catch {
    return null;
  }
  const parts = payload.split("|");
  if (parts.length < 3) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  const label = parts.slice(2).join("|");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, label };
}
