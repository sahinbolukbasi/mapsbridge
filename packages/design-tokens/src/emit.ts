// Token'lardan üç çıktı metni üretir (saf fonksiyonlar): web CSS, web TS, React Native teması.
import { dataPalette, illustration, palette, thirdParty } from "./palette.ts";
import { resolveColor, resolveValue, rgbaString, type Rgba } from "./resolve.ts";
import {
  breakpoints,
  color,
  component,
  control,
  focusRing,
  fontFamily,
  fontSize,
  fontSizeDisplay,
  fontWeight,
  inverseOverrides,
  layout,
  lineHeight,
  motion,
  radius,
  responsive,
  shadow,
  shadowBase,
  space,
  zIndex,
  type ColorValue,
} from "./tokens.ts";

export const LAYER_ORDER = "@layer tokens, base, legacy, chrome, pages, primitives;";
const HEADER = "OTOMATİK ÜRETİLDİ — packages/design-tokens. Elle düzenleme. `npm run tokens:build`";

function cssColor(value: ColorValue): string {
  if ("ref" in value) return palette[value.ref];
  if ("mix" in value) return `color-mix(in srgb, ${palette[value.mix]} ${value.percent}%, transparent)`;
  return `var(--${value.token})`;
}

function shadowCss(s: { y: number; blur: number; alpha: number }): string {
  const base = resolveValue({ ref: shadowBase });
  return `0 ${s.y}px ${s.blur}px rgb(${base.r} ${base.g} ${base.b} / ${Math.round(s.alpha * 100)}%)`;
}

export function toCss(): string {
  const lines: string[] = [];
  const decl = (name: string, value: string | number) => lines.push(`    --${name}: ${value};`);
  lines.push(`/* ${HEADER} */`);
  lines.push(LAYER_ORDER);
  lines.push("/* Breakpoint'ler (px; @media içinde var() çalışmaz): " +
    Object.entries(breakpoints).map(([k, v]) => `${k} ${v}`).join(", ") + " */");
  lines.push("@layer tokens {");
  lines.push("  :root {");
  lines.push("    color-scheme: light;");
  for (const [name, value] of Object.entries(color)) decl(name, cssColor(value));
  for (const [name, value] of Object.entries(component)) decl(name, cssColor(value));
  for (const [name, hex] of Object.entries(dataPalette)) decl(`color-data-${name}`, hex);
  for (const [name, hex] of Object.entries(thirdParty)) decl(`color-brand-${name}`, hex);
  for (const [name, value] of Object.entries(space)) decl(`space-${name}`, value);
  decl("font-family-sans", fontFamily.sans);
  decl("font-family-display", fontFamily.display);
  decl("font-family-mono", fontFamily.mono);
  for (const [name, rem] of Object.entries(fontSize)) decl(`font-size-${name}`, `${rem}rem`);
  decl("font-size-display", fontSizeDisplay);
  for (const [name, w] of Object.entries(fontWeight)) decl(`font-weight-${name}`, w);
  for (const [name, lh] of Object.entries(lineHeight)) decl(`line-height-${name}`, lh);
  for (const [name, px] of Object.entries(radius)) decl(`radius-${name}`, `${px}px`);
  for (const [name, s] of Object.entries(shadow)) decl(`shadow-${name}`, shadowCss(s));
  decl("shadow-focus", "0 0 0 var(--focus-ring-width) var(--focus-ring-color)");
  for (const [name, z] of Object.entries(zIndex)) decl(`z-${name}`, z);
  for (const [name, ms] of Object.entries(motion.duration)) decl(`duration-${name}`, `${ms}ms`);
  for (const [name, e] of Object.entries(motion.easing)) decl(`easing-${name}`, e);
  decl("control-height-sm", `${control["height-sm"]}px`);
  decl("control-height", `${control.height}px`);
  decl("control-height-lg", `${control["height-lg"]}px`);
  decl("touch-target", `${control.touch}px`);
  decl("focus-ring-width", `${focusRing.width}px`);
  decl("focus-ring-offset", `${focusRing.offset}px`);
  for (const [name, v] of Object.entries(layout)) decl(name, v);
  decl("mobile-nav-height", "0px");
  lines.push("  }");
  // Breakpoint'e bağlı token'lar: taban da html'de (eşit özgüllük, kaynak sırası kazanır).
  lines.push("  html {");
  for (const [name, def] of Object.entries(responsive)) decl(name, def.base);
  lines.push("  }");
  const byMedia = new Map<string, Array<[string, string]>>();
  for (const [name, def] of Object.entries(responsive)) {
    for (const o of def.overrides) {
      const list = byMedia.get(o.media) ?? [];
      list.push([name, o.value]);
      byMedia.set(o.media, list);
    }
  }
  for (const [media, list] of byMedia) {
    lines.push(`  @media ${media} {`);
    lines.push("    html {");
    for (const [name, value] of list) lines.push(`      --${name}: ${value};`);
    lines.push("    }");
    lines.push("  }");
  }
  // Ters yüzey kapsamı ve sızıntı önleyici varsayılan kapsam.
  lines.push('  [data-surface="inverse"] {');
  for (const [name, target] of Object.entries(inverseOverrides)) decl(name, `var(--${target})`);
  lines.push("  }");
  lines.push('  [data-surface="default"] {');
  for (const name of Object.keys(inverseOverrides)) {
    const value = color[name] ?? component[name];
    decl(name, cssColor(value));
  }
  lines.push("  }");
  lines.push("}");
  return lines.join("\n") + "\n";
}

function hex(c: Rgba): string {
  if (c.a < 1) return rgbaString(c);
  return "#" + [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function resolvedColors(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of [...Object.keys(color), ...Object.keys(component)]) {
    out[camel(name.replace(/^color-/, ""))] = hex(resolveColor(name));
  }
  return out;
}

function camel(s: string): string {
  return s.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function literal(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/"([A-Za-z_$][A-Za-z0-9_$]*)":/g, "$1:");
}

export function toWebTs(): string {
  return [
    `// ${HEADER}`,
    "// CSS değişkeni okuyamayan JS tüketicileri (Leaflet, canvas) için çözülmüş değerler.",
    "// Diğer her yerde CSS'te var(--…) kullan.",
    "",
    `export const color = ${literal(resolvedColors())} as const;`,
    "",
    `export const dataPalette = ${literal(dataPalette)} as const;`,
    "",
    `export const thirdParty = ${literal(thirdParty)} as const;`,
    "",
    `export const illustration = ${literal(illustration)} as const;`,
    "",
    `export const mapLine = ${literal({ route: hex(resolveColor("color-map-route")) })} as const;`,
    "",
    `export const breakpoints = ${literal(breakpoints)} as const;`,
    "",
  ].join("\n");
}

export function toNative(): string {
  const spacePx: Record<string, number> = {};
  for (const [k, v] of Object.entries(space)) spacePx[k] = v === "0" ? 0 : Math.round(Number.parseFloat(v) * 16);
  const sizePx: Record<string, number> = {};
  for (const [k, rem] of Object.entries(fontSize)) sizePx[k] = Math.round(rem * 16 * 100) / 100;
  sizePx.display = 36;
  const weights: Record<string, string> = {};
  for (const [k, w] of Object.entries(fontWeight)) weights[k] = String(w);
  const base = resolveValue({ ref: shadowBase });
  const shadows: Record<string, object> = {};
  for (const [k, s] of Object.entries(shadow)) {
    shadows[k] = {
      shadowColor: hex(base),
      shadowOpacity: s.alpha,
      shadowRadius: s.blur / 2,
      shadowOffset: { width: 0, height: s.y },
      elevation: s.elevation,
    };
  }
  const tokens = {
    color: resolvedColors(),
    dataPalette,
    thirdParty,
    space: spacePx,
    radius,
    font: { size: sizePx, weight: weights, lineHeight },
    shadow: shadows,
    motion: { duration: motion.duration },
    touch: { min: control.touch },
    control: { heightSm: control["height-sm"], height: control.height, heightLg: control["height-lg"] },
    focusRing,
  };
  return [
    `// ${HEADER}`,
    "// React Native teması. Renkler çözülmüş hex/rgba; RN CSS karışımlarını ve değişken referanslarını desteklemez.",
    "",
    `export const tokens = ${literal(tokens)} as const;`,
    "",
    "export type Tokens = typeof tokens;",
    "",
  ].join("\n");
}
