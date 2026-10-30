// Token değerlerini somut renklere çözer (saf fonksiyonlar).
import { palette, type PaletteName } from "./palette.ts";
import { color, component, type ColorValue } from "./tokens.ts";

export type Rgba = { r: number; g: number; b: number; a: number };

export function hexToRgb(hex: string): Rgba {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
}

const ALL: Record<string, ColorValue> = { ...color, ...component };

export function isPaletteName(name: string): name is PaletteName {
  return Object.prototype.hasOwnProperty.call(palette, name);
}

/** Bir token'ı somut RGBA'ya çözer; döngü ve bilinmeyen ad hata verir. */
export function resolveColor(name: string, seen: string[] = []): Rgba {
  if (seen.includes(name))
    throw new Error(`Döngüsel token referansı: ${[...seen, name].join(" → ")}`);
  const value = ALL[name];
  if (!value) throw new Error(`Bilinmeyen token: ${name}`);
  return resolveValue(value, [...seen, name]);
}

export function resolveValue(value: ColorValue, seen: string[] = []): Rgba {
  if ("ref" in value) {
    if (!isPaletteName(value.ref)) throw new Error(`Palette dışı değer: ${value.ref}`);
    return hexToRgb(palette[value.ref]);
  }
  if ("mix" in value) {
    if (!isPaletteName(value.mix)) throw new Error(`Palette dışı değer: ${value.mix}`);
    return { ...hexToRgb(palette[value.mix]), a: value.percent / 100 };
  }
  return resolveColor(value.token, seen);
}

/** Yarı saydam rengi bir zeminin üstüne bindirir. */
export function composite(fg: Rgba, bg: Rgba): Rgba {
  const a = fg.a;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
    a: 1,
  };
}

export function rgbaString(c: Rgba): string {
  if (c.a >= 1) return `rgb(${c.r}, ${c.g}, ${c.b})`;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${Number(c.a.toFixed(3))})`;
}
