// Renk katlama matematiği (design §2.2, §2.4b): CIE76 ΔE ve en yakın UI primitive'i.
// Kodmod ve alias üreticisi bu modülü kullanır; ΔE > 6 için karar tablosu bağlayıcıdır.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dataPalette, illustration, palette, thirdParty } from "./palette.ts";
import { hexToRgb } from "./resolve.ts";

type FoldRow = { hex: string; target: string; code: string; dE: number; note: string };
const here = dirname(fileURLToPath(import.meta.url));
const decisions: FoldRow[] = JSON.parse(
  readFileSync(resolve(here, "../data/fold-decisions.json"), "utf8"),
).rows;
const decisionByHex = new Map(decisions.map((r) => [r.hex.toLowerCase(), r]));

export function normalizeHex(input: string): string | null {
  const m = input
    .trim()
    .toLowerCase()
    .match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!m) return null;
  const h = m[1];
  return (
    "#" +
    (h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h)
  );
}

function toLab(hex: string): [number, number, number] {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

export type Group = "ui" | "data" | "thirdParty" | "illustration";
export type Fold = { name: string; group: Group; dE: number; decided: boolean; code?: string };

const ALL: Array<[string, string, Group]> = [
  ...Object.entries(palette).map(([n, h]) => [n, h, "ui"] as [string, string, Group]),
  ...Object.entries(dataPalette).map(
    ([n, h]) => [`data-${n}`, h, "data"] as [string, string, Group],
  ),
  ...Object.entries(thirdParty).map(([n, h]) => [n, h, "thirdParty"] as [string, string, Group]),
  ...Object.entries(illustration).map(
    ([n, h]) => [n, h, "illustration"] as [string, string, Group],
  ),
];

export function hexOf(name: string): string | undefined {
  return ALL.find(([n]) => n === name)?.[1];
}

/**
 * Bir hex'i UI primitive'ine katlar. Karar tablosundaki satır her zaman önceliklidir.
 * Tabloda yoksa ve en yakın UI primitive'i ΔE ≤ 6 değilse `undefined` döner (karar gerekir).
 */
export function fold(hexInput: string): Fold | undefined {
  const hex = normalizeHex(hexInput);
  if (!hex) return undefined;
  const decided = decisionByHex.get(hex);
  if (decided) {
    const target = ALL.find(([n]) => n === decided.target);
    return {
      name: decided.target,
      group: target?.[2] ?? "ui",
      dE: decided.dE,
      decided: true,
      code: decided.code,
    };
  }
  let best: Fold | undefined;
  for (const [name, h, group] of ALL) {
    if (group !== "ui") continue;
    const d = deltaE(hex, h);
    if (!best || d < best.dE) best = { name, group, dE: d, decided: false };
  }
  return best && best.dE <= 6 ? best : undefined;
}
