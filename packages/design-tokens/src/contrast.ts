// WCAG 2.x kontrast hesabı ve zorunlu çiftler (design §2.4).
import { CONTAINER_BACKGROUNDS, PRIMITIVE_SURFACES } from "./components.ts";
import { composite, resolveColor, type Rgba } from "./resolve.ts";
import { inverseOverrides } from "./tokens.ts";

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(c: Rgba): number {
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

export function contrastRatio(fg: Rgba, bg: Rgba): number {
  const solidFg = fg.a < 1 ? composite(fg, bg) : fg;
  const l1 = luminance(solidFg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export type Pair = { fg: string; bg: string; min: number; note: string; scope?: "inverse" };

const TEXT = 4.5;
const UI = 3.0;

// Açık yüzeylerde metin ve UI çiftleri.
const LIGHT_SURFACES = ["color-bg", "color-surface"];
const ALL_LIGHT = [
  ...LIGHT_SURFACES,
  "color-surface-sunken",
  "color-surface-tint",
  "color-surface-brand",
];

export const REQUIRED_PAIRS: Pair[] = [
  ...ALL_LIGHT.map((bg) => ({ fg: "color-text", bg, min: TEXT, note: "gövde metni" })),
  ...ALL_LIGHT.map((bg) => ({ fg: "color-text-muted", bg, min: TEXT, note: "ikincil metin" })),
  ...LIGHT_SURFACES.map((bg) => ({
    fg: "color-text-subtle",
    bg,
    min: TEXT,
    note: "ince metin yalnız bg/surface",
  })),
  ...LIGHT_SURFACES.map((bg) => ({ fg: "color-link", bg, min: TEXT, note: "link" })),
  ...LIGHT_SURFACES.map((bg) => ({ fg: "color-text-brand", bg, min: TEXT, note: "marka metni" })),
  ...LIGHT_SURFACES.map((bg) => ({ fg: "focus-ring-color", bg, min: UI, note: "focus ring" })),
  ...LIGHT_SURFACES.map((bg) => ({
    fg: "color-border-control",
    bg,
    min: UI,
    note: "kontrol kenarlığı",
  })),
  { fg: "color-on-surface-brand", bg: "color-surface-brand", min: TEXT, note: "marka-soft üstü" },
  { fg: "color-on-surface-brand", bg: "color-surface-brand-strong", min: TEXT, note: "rozet" },
  { fg: "button-primary-fg", bg: "button-primary-bg", min: TEXT, note: "primary buton" },
  {
    fg: "button-primary-fg",
    bg: "button-primary-bg-hover",
    min: TEXT,
    note: "primary buton hover",
  },
  { fg: "button-brand-fg", bg: "button-brand-bg", min: TEXT, note: "brand buton" },
  { fg: "button-brand-fg", bg: "button-brand-bg-hover", min: TEXT, note: "brand buton hover" },
  { fg: "button-secondary-fg", bg: "button-secondary-bg", min: TEXT, note: "secondary buton" },
  { fg: "button-danger-fg", bg: "button-danger-bg", min: TEXT, note: "danger buton" },
  { fg: "color-on-accent", bg: "color-accent", min: TEXT, note: "accent üstü metin" },
  { fg: "color-success", bg: "color-success-bg", min: TEXT, note: "success alert" },
  { fg: "color-warning", bg: "color-warning-bg", min: TEXT, note: "warning alert" },
  { fg: "color-warning", bg: "color-warning-bg-strong", min: TEXT, note: "warning rozet" },
  { fg: "color-danger", bg: "color-danger-bg", min: TEXT, note: "danger alert" },
  { fg: "color-info", bg: "color-info-bg", min: TEXT, note: "info alert" },
  { fg: "color-danger", bg: "color-surface", min: TEXT, note: "hata metni" },
  { fg: "color-success", bg: "color-surface", min: TEXT, note: "başarı metni" },
  { fg: "color-on-primary", bg: "color-primary", min: TEXT, note: "on-primary" },
  // Kil vurgu ve gün renkleri (Yön B, design §3.4)
  ...["color-bg", "color-surface", "color-highlight-bg", "color-highlight-bg-strong"].map((bg) => ({
    fg: "color-highlight-text",
    bg,
    min: TEXT,
    note: "vurgu metni / eyebrow",
  })),
  ...[1, 2, 3, 4, 5, 6, 7].map((d) => ({
    fg: "color-on-day",
    bg: `color-day-${d}`,
    min: TEXT,
    note: "gün pin numarası",
  })),
  {
    fg: "color-text-inverse-highlight",
    bg: "color-surface-inverse",
    min: TEXT,
    note: "ters zeminde eyebrow",
  },
  { fg: "color-example-fg", bg: "color-example-bg", min: TEXT, note: "Örnek rozeti" },
  { fg: "color-highlight", bg: "color-surface", min: UI, note: "vurgu dolgusu / halka" },
  // Ters yüzeyler
  ...["color-surface-inverse", "color-surface-inverse-strong"].flatMap((bg) => [
    { fg: "color-text-inverse", bg, min: TEXT, note: "ters metin" },
    { fg: "color-text-inverse-muted", bg, min: TEXT, note: "ters ikincil" },
    { fg: "color-text-inverse-subtle", bg, min: TEXT, note: "ters ince" },
    { fg: "color-link-inverse", bg, min: TEXT, note: "ters link" },
    { fg: "color-text-inverse-brand", bg, min: TEXT, note: "ters marka metni" },
    { fg: "focus-ring-color-inverse", bg, min: UI, note: "ters focus" },
  ]),
  // Inverse kapsamındaki primary buton (emerald-400 + on-accent)
  { fg: "color-on-accent", bg: "color-accent-strong", min: TEXT, note: "inverse primary buton" },
  {
    fg: "color-on-accent",
    bg: "color-link-inverse-hover",
    min: TEXT,
    note: "inverse primary buton hover",
  },
];

export type Failure = Pair & { ratio: number };

export function checkPairs(pairs: Pair[] = REQUIRED_PAIRS): Failure[] {
  const failures: Failure[] = [];
  for (const p of pairs) {
    const ratio = contrastRatio(resolveColor(p.fg), resolveColor(p.bg));
    if (ratio < p.min) failures.push({ ...p, ratio });
  }
  return failures;
}

/** Inverse kapsamındaki her override hedefinin koyu yüzeyde okunur olduğunu doğrular. */
export function checkInverseScope(): Failure[] {
  const textLike = [
    "color-text",
    "color-text-muted",
    "color-text-subtle",
    "color-link",
    "color-text-brand",
  ];
  const pairs: Pair[] = textLike.map((name) => ({
    fg: inverseOverrides[name],
    bg: "color-surface-inverse",
    min: TEXT,
    note: `inverse ${name}`,
    scope: "inverse" as const,
  }));
  return checkPairs(pairs);
}

/** Bir token'ın kapsamdaki değeri: inverse kapta inverseOverrides hedefi, aksi halde :root değeri. */
export function resolveInScope(name: string, scope: "light" | "inverse"): Rgba {
  return resolveColor(
    scope === "inverse" && inverseOverrides[name] ? inverseOverrides[name] : name,
  );
}

export type SurfaceFailure = {
  primitive: string;
  variant: string;
  scope: "light" | "inverse";
  container: string;
  fg: string;
  bg: string;
  kind: "metin" | "kenarlık/gösterge" | "odak";
  ratio: number;
  min: number;
};

/**
 * AC-4f: her primitive varyantının metin/zemin (≥4.5), kenarlık/gösterge (≥3.0) ve odak
 * (≥3.0) çiftleri açık ve inverse kapta, üçer kap zemininde. ownSurface primitive kendi
 * kökünde data-surface="default" taşıdığı için kendi token'ları açık kapsamda çözülür; odak
 * halkası kabın zemininde çizilir ve kabı izler (default kapsamı onu sıfırlamaz).
 */
export function checkPrimitiveSurfaces(): SurfaceFailure[] {
  const failures: SurfaceFailure[] = [];
  for (const row of PRIMITIVE_SURFACES) {
    if (row.inverse === "n/a" && row.ownSurface === false) continue;
    const scopes = row.inverse === "n/a" ? (["light"] as const) : (["light", "inverse"] as const);
    for (const scope of scopes) {
      const own = row.ownSurface !== false ? "light" : scope;
      for (const container of CONTAINER_BACKGROUNDS[scope]) {
        const kap = resolveColor(container);
        const fill = (name: string): Rgba => {
          const c = resolveInScope(name, own);
          return c.a < 1 ? composite(c, kap) : c;
        };
        const bgs = row.bg === "container" ? [kap] : [fill(row.bg)];
        const bgNames = [row.bg === "container" ? container : row.bg];
        if (row.bgHover) {
          bgs.push(fill(row.bgHover));
          bgNames.push(row.bgHover);
        }
        const push = (
          fg: string,
          bg: string,
          kind: SurfaceFailure["kind"],
          ratio: number,
          min: number,
        ) => {
          if (ratio < min)
            failures.push({
              primitive: row.primitive,
              variant: row.variant,
              scope,
              container,
              fg,
              bg,
              kind,
              ratio,
              min,
            });
        };
        bgs.forEach((bg, k) => {
          for (const fg of row.text)
            push(fg, bgNames[k], "metin", contrastRatio(resolveInScope(fg, own), bg), TEXT);
          for (const fg of row.ui ?? [])
            push(
              fg,
              bgNames[k],
              "kenarlık/gösterge",
              contrastRatio(resolveInScope(fg, own), bg),
              UI,
            );
        });
        push(
          "focus-ring-color",
          container,
          "odak",
          contrastRatio(resolveInScope("focus-ring-color", scope), kap),
          UI,
        );
      }
    }
  }
  return failures;
}
