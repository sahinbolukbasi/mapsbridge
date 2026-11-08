// apps/web/app/lib/trip/pin-popup.ts ile aynı saf mantık (yalnız IconName içe aktarma yolu farklı)
// (parite testi: apps/web/tests/mobile-parity.test.cjs).
// Pine dokununca bilgi (Increment 1.7, bug 3, P5). Saf model: alanlar YALNIZ kullanıcının pin
// kaydından ve yer proxy'sinin döndürdüğü ayrıntıdan gelir (I1). Boş alan modele girmez (I10);
// puan/saat/telefon kaynakta yoksa çizilmez. Google atfı yalnız Google kaynaklı ayrıntıda.
import type { IconName } from "../theme/icon-paths";
import type { ApiPlace, ApiPlacePhoto } from "./places-api";
import type { Pin, PinCategory } from "./models";

/** Kategori ikonla kodlanır (renk tek bilgi taşıyıcı değil, WCAG 1.4.1; design F45). */
export const CATEGORY_ICON: Record<PinCategory, IconName> = {
  tarih: "landmark",
  muze: "landmark",
  kultur: "landmark",
  turistik: "landmark",
  yemek: "food",
  gastronomi: "food",
  kahve: "food",
  alisveris: "bag",
  manzara: "camera",
  fotograf: "camera",
  doga: "compass",
  gezi: "compass",
  gezilecek: "compass",
  aktivite: "sparkle",
  eglence: "sparkle",
  spor: "sparkle",
  konaklama: "home",
  otel: "home",
  genel: "map",
};

export type PinPopupModel = {
  id: string;
  title: string;
  icon: IconName;
  category: PinCategory;
  /** Güne atanmışsa gün numarası; Kaydedilenler (0) için yok. */
  day?: number;
  address?: string;
  /** Kullanıcı notunun ilk boş olmayan satırı. */
  noteLine?: string;
  visited: boolean;
  /** Yalnız kaynak ayrıntısında varsa. */
  openingHours?: string[];
  phone?: string;
  website?: string;
  rating?: number;
  userRatingCount?: number;
  /** Yalnız ayrıntıda, kaynakta http(s) adresli fotoğraf varsa (SKU: yalnız ayrıntı açılışında). */
  photos?: ApiPlacePhoto[];
  /** Ayrıntı kaynağının atfı (Google ise GoogleLogo gösterilir). */
  attribution?: { provider: "amazon" | "google"; text: string };
};

const text = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
const finite = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

export function firstNoteLine(note: string | undefined): string | undefined {
  if (!note) return undefined;
  const line = note
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  if (!line) return undefined;
  return line.length > 140 ? `${line.slice(0, 139)}…` : line;
}

/** Yalnız http(s) bağlantı (javascript: vb. atılır). */
export function safeWebsite(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Popup/ayrıntı modeli. `detail` yer proxy'sinden gelen ayrıntıdır (yoksa yalnız pin kaydı).
 * Adres önce kullanıcının kaydı, yoksa kaynağın adresi. Hiçbir alan tahmin edilmez.
 */
export function pinPopupModel(pin: Pin, detail?: ApiPlace | null): PinPopupModel {
  const model: PinPopupModel = {
    id: pin.id,
    title: text(pin.label) || text(detail?.name) || "",
    icon: CATEGORY_ICON[pin.category] ?? "map",
    category: pin.category,
    visited: !!pin.visited,
  };
  if (pin.dayIndex > 0) model.day = pin.dayIndex;
  const address = text(pin.address) || text(detail?.address);
  if (address) model.address = address;
  const note = firstNoteLine(pin.note);
  if (note) model.noteLine = note;
  if (detail) {
    const hours = (detail.openingHours || []).map(text).filter((h): h is string => !!h);
    if (hours.length) model.openingHours = hours;
    const phone = text(detail.phone);
    if (phone) model.phone = phone;
    const website = safeWebsite(text(detail.website));
    if (website) model.website = website;
    const rating = finite(detail.rating);
    if (rating !== undefined && rating >= 0 && rating <= 5) model.rating = rating;
    const count = finite(detail.userRatingCount);
    if (count !== undefined && count >= 0 && model.rating !== undefined)
      model.userRatingCount = Math.round(count);
    const photos = (detail.photos || []).filter(
      (p): p is ApiPlacePhoto =>
        !!p && typeof p.url === "string" && /^https?:\/\//.test(p.url),
    );
    if (photos.length) model.photos = photos;
    const attr = text(detail.attribution);
    if (attr) model.attribution = { provider: detail.provider, text: attr };
  }
  return model;
}

/** Google atfı (GoogleLogo) yalnız Google kaynaklı ayrıntıda zorunlu ve gösterilir. */
export const showsGoogleAttribution = (m: PinPopupModel) => m.attribution?.provider === "google";

/**
 * Pin açma yan etkileri (bug 3): "Rotalarım" görünümünde kenar çubuğu bağlı değildir; ayrıntı
 * olayı kaybolmasın diye önce plana geçilir. Mobilde harita dokunuşu (expand:false) yalnız
 * popup açar; sayfayı "Ayrıntı" düğmesi yarıya çeker.
 */
export function openPinEffects(
  view: string,
  compact: boolean,
  expand = true,
): { switchToPlan: boolean; expandSheet: boolean } {
  return { switchToPlan: view === "trips", expandSheet: compact && expand };
}
