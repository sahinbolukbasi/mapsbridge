// Primitive renkler — RENK LİTERALİNİN YAŞADIĞI TEK YER (design §2.2).
// Değerler bugünkü markadan çıkarıldı; yeni palet icat edilmedi.
// Uygulama kodu bu adları doğrudan kullanmaz, semantik token'ları (tokens.ts) kullanır.

export const palette = {
  // Marka yeşilleri (Stitch ailesi)
  "forest-990": "#020e0a",
  "forest-950": "#0d281e",
  "forest-900": "#013628",
  "forest-800": "#1e4d3e",
  "forest-700": "#286954",
  "forest-300": "#a0d1bd",
  "forest-200": "#abedd3",
  // Zümrüt
  "emerald-400": "#34d399",
  "emerald-500": "#10b981",
  "emerald-600": "#059669",
  "emerald-700": "#047857",
  "emerald-800": "#065f46",
  // Mint
  "mint-50": "#ecfdf5",
  "mint-100": "#d1fae5",
  // Nötrler
  "slate-0": "#ffffff",
  "slate-50": "#f8fafc",
  "slate-100": "#f1f5f9",
  "slate-200": "#e2e8f0",
  "slate-300": "#cbd5e1",
  "slate-400": "#94a3b8",
  "slate-500": "#64748b",
  "sage-600": "#404945",
  "slate-700": "#334155",
  "slate-800": "#1e293b",
  "slate-900": "#0f172a",
  // Kartograf (Yön B, design §3.1) — kağıt, mürekkep, kil
  "paper-0": "#fffdf8",
  "paper-50": "#faf7f0",
  "paper-100": "#f2ede2",
  "paper-200": "#e4dccb",
  "paper-300": "#cfc4ad",
  "ink-900": "#1b2420",
  "ink-700": "#3f4843",
  "ink-500": "#5f6762",
  "clay-50": "#fbece4",
  "clay-100": "#f6d9ca",
  "clay-300": "#f2b59b",
  "clay-600": "#b4502b",
  "clay-700": "#9a3f1e",
  // Gün paleti (beyaz numara ≥ 5:1)
  "steel-600": "#2f6f8f",
  "plum-600": "#7a3e8e",
  "olive-700": "#5b6b1f",
  "rose-700": "#a2324f",
  "ochre-700": "#8a5a00",
  // Gökmavisi
  "sky-400": "#38bdf8",
  "sky-600": "#0284c7",
  // Amber
  "amber-50": "#fffbeb",
  "amber-100": "#fef3c7",
  "amber-200": "#fde68a",
  "amber-500": "#f59e0b",
  "amber-700": "#b45309",
  "amber-800": "#92400e",
  // Kırmızı
  "red-50": "#fef2f2",
  "red-200": "#fecaca",
  "red-500": "#ef4444",
  "red-700": "#b91c1c",
  // Mavi
  "blue-50": "#eff6ff",
  "blue-200": "#bfdbfe",
  "blue-500": "#3b82f6",
  "blue-600": "#2563eb",
  "blue-700": "#1d4ed8",
  black: "#000000",
} as const;

export type PaletteName = keyof typeof palette;

// Veri görselleştirme paleti — birebir korunur, hiçbir zaman ΔE ile katlanmaz.
// Kaynak: lib/trip/use-trip-workspace.ts, lib/trip/models.ts, features/trip-planner/map-styles.ts
export const dataPalette = {
  blue: "#2563eb",
  emerald: "#10b981",
  violet: "#8b5cf6",
  orange: "#f97316",
  pink: "#ec4899",
  cyan: "#06b6d4",
  yellow: "#eab308",
  red: "#ef4444",
  indigo: "#6366f1",
  teal: "#14b8a6",
  "blue-light": "#3b82f6",
  green: "#16a34a",
  purple: "#a855f7",
  "orange-deep": "#ea580c",
  amber: "#b45309",
  slate: "#64748b",
} as const;

// Üçüncü taraf marka renkleri — yalnızca logo ve marka butonları (design §2.2).
export const thirdParty = {
  "google-blue": "#4285f4",
  "google-green": "#34a853",
  "google-yellow": "#fbbc05",
  "google-red": "#ea4335",
  "google-blue-hover": "#3367d6",
  whatsapp: "#25d366",
  yandex: "#fc3f1d",
  stripe: "#635bff",
} as const;

// İllüstrasyon — yalnızca components/travel-globe.tsx canvas küresi.
export const illustration = {
  "globe-sky-100": "#bae6fd",
  "globe-sky-600": "#0284c7",
  "globe-sky-700": "#0369a1",
  "globe-navy": "#172554",
} as const;
