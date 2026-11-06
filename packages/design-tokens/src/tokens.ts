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
  "color-bg": r("paper-50"),
  "color-surface": r("paper-0"),
  "color-surface-sunken": r("paper-100"),
  "color-surface-tint": r("paper-100"),
  "color-surface-brand": r("mint-50"),
  "color-surface-brand-strong": r("mint-100"),
  "color-on-surface-brand": r("emerald-800"),
  "color-surface-inverse": r("ink-900"),
  "color-surface-inverse-strong": r("forest-990"),
  // Metin
  "color-text": r("ink-900"),
  "color-text-muted": r("ink-700"),
  "color-text-subtle": r("ink-500"),
  "color-text-inverse": r("paper-50"),
  "color-text-inverse-muted": r("paper-200"),
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
  // Metin/ikon için AA-uyumlu zümrüt (beyaz üstünde 5.48:1). Dolgu/dekor için color-accent kullan.
  "color-text-accent": r("emerald-700"),
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
  "color-border": r("paper-200"),
  "color-border-subtle": mix("slate-200", 85),
  "color-border-control": r("ink-500"),
  "color-border-strong": r("paper-300"),
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
  // "Örnek" rozeti (design §3.2): mevcut warning tonlarına alias
  "color-example-bg": { token: "color-warning-bg" },
  "color-example-fg": { token: "color-warning" },
  "color-example-border": { token: "color-warning-border" },
  // Kil vurgu (Yön B, design §3.2)
  "color-highlight": r("clay-600"),
  "color-highlight-text": r("clay-700"),
  "color-highlight-bg": r("clay-50"),
  "color-highlight-bg-strong": r("clay-100"),
  "color-text-inverse-highlight": r("clay-300"),
  // Harita gün renkleri (döngüsel; 8. gün = day-1). Pin numarası color-on-day.
  "color-day-1": r("forest-900"),
  "color-day-2": r("clay-600"),
  "color-day-3": r("steel-600"),
  "color-day-4": r("plum-600"),
  "color-day-5": r("olive-700"),
  "color-day-6": r("rose-700"),
  "color-day-7": r("ochre-700"),
  "color-on-day": r("slate-0"),
  // Harita
  "color-map-route": r("blue-600"),
  "color-map-route-casing": r("paper-0"),
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
  sans: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  display: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
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
  "4xl": 2.25,
  "5xl": 3,
  "6xl": 3.75,
} as const;
// Hero h1 36→60 px (design §3.3)
export const fontSizeDisplay = "clamp(2.25rem, 1.2rem + 3.6vw, 3.75rem)";

export const letterSpacing = {
  tight: "-0.03em",
  snug: "-0.02em",
  normal: "0",
  caps: "0.08em",
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;
export const lineHeight = { tight: 1.15, heading: 1.2, body: 1.6 } as const;

// px
export const radius = { xs: 4, sm: 6, md: 10, lg: 14, xl: 20, full: 9999 } as const;

// Gölgeler: taban forest-950 (13,40,30)
export const shadow = {
  xs: { y: 1, blur: 2, alpha: 0.04, elevation: 1 },
  sm: { y: 2, blur: 8, alpha: 0.06, elevation: 2 },
  md: { y: 8, blur: 24, alpha: 0.08, elevation: 4 },
  lg: { y: 16, blur: 48, alpha: 0.1, elevation: 8 },
  xl: { y: 24, blur: 64, alpha: 0.16, elevation: 12 },
} as const;
export const shadowBase: PaletteName = "forest-950";

// Semantik yükseklik takma adları: değer shadow adımının adıdır ("none" = gölgesiz).
export const elevation = {
  flat: "none",
  raised: "sm",
  overlay: "lg",
  floating: "xl",
} as const satisfies Record<string, keyof typeof shadow | "none">;

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
  duration: { instant: 0, fast: 120, base: 200, slow: 320, deliberate: 480, route: 900 },
  easing: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    emphasized: "cubic-bezier(0.3, 0, 0, 1)",
    enter: "cubic-bezier(0.05, 0.7, 0.1, 1)", // giriş (decelerate)
    exit: "cubic-bezier(0.3, 0, 0.8, 0.15)", // çıkış (accelerate)
    linear: "cubic-bezier(0, 0, 1, 1)", // süre çubuğu, belirsiz ilerleme, spinner (sabit hız)
  },
  distance: { sm: 4, md: 8, lg: 16 }, // px, giriş kayması
  stagger: { step: 40, max: 240 }, // ms
  // Yalnız RN (Animated.spring); web çıktısına yazılmaz.
  spring: {
    sheet: { stiffness: 260, damping: 28, mass: 1 },
    press: { stiffness: 400, damping: 30, mass: 1 },
  },
} as const;

export const control = { "height-sm": 36, height: 44, "height-lg": 52, touch: 44 } as const;

export const focusRing = { width: 2, offset: 2 } as const;
// Yalnız mobil (design §7.5): metin ölçekleme tavanı. compact = sabit alanlı metin (sekme
// etiketi, rozet, header başlığı), body = gövde metni.
export const fontMaxScale = { compact: 1.4, body: 2 } as const;
// Yalnız mobil: RN'de color-mix olmadığından gölge (shadowColor) ve siyah tabanlı örtüler
// için opak taban renkleri (`withAlpha` ile saydamlaştırılır). Web karşılığı yok.
export const nativeOnlyColors = { black: "black" } as const satisfies Record<string, PaletteName>;

export const layout = {
  "container-max": "1200px",
  "container-wide": "1440px",
  "container-full": "min(100%, 1800px)",
  "content-reading": "720px",
  "content-form": "500px",
  "page-gutter": "clamp(1rem, 3vw, 1.5rem)",
  "header-height": "64px",
  "bottom-nav-height": "64px",
  "sheet-peek": "25dvh",
  "sheet-half": "55dvh",
  "sheet-full": "92dvh",
} as const;

// Breakpoint'e bağlı token'lar: taban ve override html seçicisinde yazılır (design §2.3).
export const responsive = {
  "app-header-height": {
    base: "calc(72px + env(safe-area-inset-top, 0px))",
    overrides: [
      { media: "(max-width: 767px)", value: "calc(56px + env(safe-area-inset-top, 0px))" },
    ],
  },
} as const;

export const breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;
