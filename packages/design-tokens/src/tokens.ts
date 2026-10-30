// Semantik token'lar ve ölçekler (design §2.2, §2.3).
// Renk değerleri yalnızca palette referansıdır: { ref: "forest-900" } veya bir alfa karışımı.
import type { PaletteName } from "./palette.ts";
import { componentInverseOverrides, componentTokens } from "./components.ts";

export type ColorValue =
  | { ref: PaletteName }
  | { mix: PaletteName; percent: number } // color-mix(in srgb, X p%, transparent)
  | { token: string }; // başka bir semantik token'a referans (var(--x))

const r = (ref: PaletteName): ColorValue => ({ ref });
const mix = (name: PaletteName, percent: number): ColorValue => ({ mix: name, percent });

// CSS adı → değer. Sıra üretilen dosyada korunur.
export const color: Record<string, ColorValue> = {
  // Zeminler ve yüzeyler
  "color-bg": r("slate-50"),
  "color-surface": r("slate-0"),
  "color-surface-sunken": r("slate-100"),
  "color-surface-tint": r("lavender-100"),
  "color-surface-brand": r("mint-50"),
  "color-surface-brand-strong": r("mint-100"),
  "color-on-surface-brand": r("emerald-800"),
  "color-surface-inverse": r("forest-950"),
  "color-surface-inverse-strong": r("forest-990"),
  // Metin
  "color-text": r("slate-900"),
  "color-text-muted": r("sage-600"),
  "color-text-subtle": r("slate-500"),
  "color-text-inverse": r("slate-0"),
  "color-text-inverse-muted": r("slate-300"),
  "color-text-inverse-subtle": r("slate-400"),
  "color-text-brand": r("forest-900"),
  // Koyu yüzey üstü soluk marka yeşili (Stitch on-primary-container)
  "color-text-inverse-brand": r("forest-300"),
  // Koyu zemin üstü vurgu/rozet yeşili (Stitch secondary-container)
  "color-surface-brand-soft": r("forest-200"),
  // Marka ve etkileşim
  "color-brand": r("forest-700"),
  "color-brand-hover": r("forest-800"),
  "color-link": r("forest-700"),
  "color-link-hover": r("forest-900"),
  "color-link-inverse": r("emerald-400"),
  "color-link-inverse-hover": r("forest-200"),
  "color-primary": r("forest-900"),
  "color-primary-hover": r("forest-800"),
  "color-primary-active": r("forest-950"),
  "color-on-primary": r("slate-0"),
  "color-accent": r("emerald-500"),
  "color-accent-strong": r("emerald-400"),
  "color-on-accent": r("forest-950"),
  "color-accent-sky": r("sky-600"),
  "color-accent-sky-soft": r("sky-400"),
  "color-accent-a10": mix("emerald-500", 10),
  "color-accent-a20": mix("emerald-500", 20),
  "color-accent-a30": mix("emerald-500", 30),
  "color-white-a08": mix("slate-0", 8),
  "color-white-a12": mix("slate-0", 12),
  // Nötr ölçek
  "color-neutral-0": r("slate-0"),
  "color-neutral-50": r("slate-50"),
  "color-neutral-100": r("slate-100"),
  "color-neutral-200": r("slate-200"),
  "color-neutral-300": r("slate-300"),
  "color-neutral-400": r("slate-400"),
  "color-neutral-500": r("slate-500"),
  "color-neutral-600": r("sage-600"),
  "color-neutral-700": r("slate-700"),
  "color-neutral-800": r("slate-800"),
  "color-neutral-900": r("slate-900"),
  // Kenarlıklar
  "color-border": r("slate-200"),
  "color-border-subtle": mix("slate-200", 85),
  "color-border-control": r("slate-500"),
  "color-border-strong": r("slate-300"),
  // Durum renkleri
  "color-success": r("emerald-700"),
  "color-success-strong": r("emerald-600"),
  "color-success-bg": r("mint-50"),
  "color-success-border": r("forest-200"),
  "color-warning": r("amber-800"),
  "color-warning-bg": r("amber-50"),
  "color-warning-bg-strong": r("amber-100"),
  "color-warning-border": r("amber-200"),
  "color-warning-icon": r("amber-500"),
  "color-warning-strong": r("amber-700"),
  "color-danger": r("red-700"),
  "color-danger-bg": r("red-50"),
  "color-danger-border": r("red-200"),
  "color-danger-solid": r("red-700"),
  "color-danger-icon": r("red-500"),
  "color-info": r("blue-700"),
  "color-info-bg": r("blue-50"),
  "color-info-border": r("blue-200"),
  "color-info-icon": r("blue-500"),
  // Harita
  "color-map-route": r("blue-600"),
  // Focus
  "focus-ring-color": r("forest-900"),
  "focus-ring-color-inverse": r("emerald-400"),
  // Scrim
  "color-scrim": mix("black", 45),
};

// Bileşen token'ları (design §3.1): kaynak components.ts. Primitive'ler doğrudan semantik renk
// değil bunları kullanır.
export const component: Record<string, ColorValue> = componentTokens;

// [data-surface="inverse"] kapsamında yeniden tanımlanan token'lar (design §2.2 Inverse kapsamı).
export const inverseOverrides: Record<string, string> = {
  "color-text": "color-text-inverse",
  "color-text-muted": "color-text-inverse-muted",
  "color-text-subtle": "color-text-inverse-subtle",
  "color-link": "color-link-inverse",
  "color-link-hover": "color-link-inverse-hover",
  "color-border": "color-white-a12",
  "color-border-control": "color-text-inverse-subtle",
  "color-text-brand": "color-text-inverse",
  "focus-ring-color": "focus-ring-color-inverse",
  ...componentInverseOverrides,
};

export const space = {
  "0": "0",
  "1": "0.25rem",
  "2": "0.5rem",
  "3": "0.75rem",
  "4": "1rem",
  "5": "1.25rem",
  "6": "1.5rem",
  "8": "2rem",
  "10": "2.5rem",
  "12": "3rem",
  "16": "4rem",
  "20": "5rem",
} as const;

export const fontFamily = {
  sans: 'var(--font-inter), system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  display: "var(--font-plus-jakarta), var(--font-inter), system-ui, sans-serif",
  mono: "ui-monospace, SFMono-Regular, monospace",
} as const;

// rem değerleri; mobil çıktıda ×16 px olur.
export const fontSize = {
  "2xs": 0.6875,
  xs: 0.75,
  sm: 0.8125,
  md: 0.875,
  base: 1,
  lg: 1.125,
  xl: 1.25,
  "2xl": 1.5,
  "3xl": 1.875,
} as const;
export const fontSizeDisplay = "clamp(2rem, 4.5vw, 2.75rem)";

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;
export const lineHeight = { tight: 1.15, heading: 1.2, body: 1.6 } as const;

// px
export const radius = { xs: 6, sm: 8, md: 12, lg: 16, xl: 24, full: 9999 } as const;

// Gölgeler: taban forest-950 (13,40,30)
export const shadow = {
  xs: { y: 1, blur: 2, alpha: 0.04, elevation: 1 },
  sm: { y: 2, blur: 8, alpha: 0.06, elevation: 2 },
  md: { y: 8, blur: 24, alpha: 0.08, elevation: 4 },
  lg: { y: 16, blur: 48, alpha: 0.1, elevation: 8 },
  xl: { y: 24, blur: 64, alpha: 0.16, elevation: 12 },
} as const;
export const shadowBase: PaletteName = "forest-950";

export const zIndex = {
  base: 0,
  raised: 1,
  sticky: 10,
  header: 50,
  dropdown: 100,
  overlay: 1000,
  modal: 1100,
  toast: 2000,
  "skip-link": 3000,
} as const;

export const motion = {
  duration: { instant: 0, fast: 120, base: 200, slow: 320 },
  easing: { standard: "cubic-bezier(0.2, 0, 0, 1)", emphasized: "cubic-bezier(0.3, 0, 0, 1)" },
} as const;

export const control = { "height-sm": 36, height: 44, "height-lg": 52, touch: 44 } as const;

export const focusRing = { width: 2, offset: 2 } as const;

export const layout = {
  "container-max": "1200px",
  "container-wide": "1440px",
  "container-full": "min(100%, 1800px)",
  "content-reading": "720px",
  "content-form": "500px",
  "page-gutter": "clamp(1rem, 3vw, 1.5rem)",
  "header-height": "64px",
} as const;

// Breakpoint'e bağlı token'lar: taban ve override html seçicisinde yazılır (design §2.3).
export const responsive = {
  "app-header-height": {
    base: "calc(76px + env(safe-area-inset-top, 0px))",
    overrides: [
      { media: "(max-width: 767px)", value: "calc(64px + env(safe-area-inset-top, 0px))" },
    ],
  },
} as const;

export const breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;
