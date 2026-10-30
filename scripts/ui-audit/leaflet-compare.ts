/**
 * Leaflet anlık görüntü karşılaştırması: K1 kaskad eşdeğerliği, K2 geometri, K3 katlama farkında
 * renk (design §2.6 "Leaflet kanıtı", R6-1; §17.-3 #2, #3). Saf modül; CLI cli.ts'tedir.
 *
 *  --mode cascade (K1): aynı build'in layer'lı (a) ve layer'sız (b) çifti; tüm kümeler string eşit.
 *  --mode commits (K2/K3): iki layer'lı anlık görüntü; geometri birebir (ya da expectedChanges
 *    satırı), renkler eşit ya da beklenen katlama, box-shadow yalnızca bilgi.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fold, hexOf, normalizeHex } from "../../packages/design-tokens/src/color-math.ts";
import { resolveColor, type Rgba } from "../../packages/design-tokens/src/resolve.ts";
import { inverseOverrides } from "../../packages/design-tokens/src/tokens.ts";
import type { LeafletItem, LeafletSnapshot } from "./checks.ts";

export type Verdict = "equal" | "expected-fold" | "expected-change" | "info" | "fail";
export interface Row {
  key: string;
  property: string;
  before: string;
  after: string;
  verdict: Verdict;
  note?: string;
}
export type ExpectedChange =
  | { key: string; property: string; before: string; after: string; reason: string; commit: string }
  | { key: string; change: "added" | "removed"; reason: string; commit: string };
export interface CompareOptions {
  mode: "cascade" | "commits";
  expectedChanges?: ExpectedChange[];
  /** before hex → izinli after hex kümesi (varsayılan: defaultExpectedColors). */
  expectedColors?: (hex: string) => Set<string>;
}

export class LeafletCompareError extends Error {}

const ALPHA_TOLERANCE = 0.005;

/** Computed renk → RGBA; çözülemeyen biçimde null. */
export function parseComputedColor(value: string): Rgba | null {
  const v = value.trim().toLowerCase();
  if (v === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const num = String.raw`([-+]?\d*\.?\d+(?:e[-+]?\d+)?)`;
  let m = new RegExp(
    String.raw`^rgba?\(\s*${num}\s*[,\s]\s*${num}\s*[,\s]\s*${num}\s*(?:[,/]\s*${num}(%?)\s*)?\)$`,
  ).exec(v);
  if (m) {
    const a = m[4] === undefined ? 1 : Number(m[4]) / (m[5] ? 100 : 1);
    return {
      r: Math.round(Number(m[1])),
      g: Math.round(Number(m[2])),
      b: Math.round(Number(m[3])),
      a,
    };
  }
  m = new RegExp(
    String.raw`^color\(\s*srgb\s+${num}\s+${num}\s+${num}\s*(?:/\s*${num}(%?)\s*)?\)$`,
  ).exec(v);
  if (m) {
    const ch = (s: string) => Math.round(Number(s) * 255);
    const a = m[4] === undefined ? 1 : Number(m[4]) / (m[5] ? 100 : 1);
    return { r: ch(m[1]), g: ch(m[2]), b: ch(m[3]), a };
  }
  return null;
}

export function rgbHex(c: Rgba): string {
  return "#" + [c.r, c.g, c.b].map((n) => n.toString(16).padStart(2, "0")).join("");
}

type AliasRow = { name: string; values: string[]; target: string };
const ALIAS_TABLE = fileURLToPath(
  new URL("../../packages/design-tokens/data/alias-table.json", import.meta.url),
);

/** expectedColors(h) = {h} ∪ hexOf(fold(h).name) ∪ alias-table hedefleri (+ inverse karşılıkları). */
export function defaultExpectedColors(): (hex: string) => Set<string> {
  const rows = JSON.parse(readFileSync(ALIAS_TABLE, "utf8")) as AliasRow[];
  const tokenHex = (name: string): string | null => {
    try {
      return rgbHex(resolveColor(name));
    } catch {
      return null;
    }
  };
  return (hexInput: string) => {
    const h = normalizeHex(hexInput) ?? hexInput.toLowerCase();
    const out = new Set<string>([h]);
    const f = fold(h);
    const folded = f ? hexOf(f.name) : undefined;
    if (folded) out.add(folded.toLowerCase());
    for (const row of rows) {
      if (!row.values.some((v) => normalizeHex(v) === h)) continue;
      const m = /^var\(--([\w-]+)\)$/.exec(row.target.trim());
      if (!m) continue;
      for (const name of [m[1], inverseOverrides[m[1]]].filter(Boolean)) {
        const hex = tokenHex(name);
        if (hex) out.add(hex);
      }
    }
    return out;
  };
}

function flatten(s: LeafletSnapshot): Map<string, LeafletItem> {
  const map = new Map<string, LeafletItem>();
  for (const items of Object.values(s.scenarios)) for (const it of items) map.set(it.key, it);
  return map;
}

function validate(a: LeafletSnapshot, b: LeafletSnapshot, mode: CompareOptions["mode"]): void {
  if (a?.schema !== 2 || b?.schema !== 2)
    throw new LeafletCompareError("anlık görüntü şeması desteklenmiyor (schema 2 bekleniyor)");
  if (mode === "cascade") {
    const ok =
      a.build.unlayered === false &&
      b.build.unlayered === true &&
      a.build.buildId !== null &&
      a.build.buildId === b.build.buildId;
    if (!ok) throw new LeafletCompareError("K1 aynı build'in layer'lı/layer'sız çiftini ister");
  } else if (mode === "commits") {
    if (!(a.build.unlayered === false && b.build.unlayered === false))
      throw new LeafletCompareError("K2/K3 layer'lı anlık görüntü ister");
  } else {
    throw new LeafletCompareError(`bilinmeyen mod: ${String(mode)} (cascade | commits)`);
  }
}

export function compareLeaflet(
  a: LeafletSnapshot,
  b: LeafletSnapshot,
  opts: CompareOptions,
): { rows: Row[]; failed: boolean } {
  validate(a, b, opts.mode);
  const expectedChanges = opts.expectedChanges ?? [];
  const expectedColors = opts.expectedColors ?? defaultExpectedColors();
  const A = flatten(a);
  const B = flatten(b);
  const rows: Row[] = [];
  const used = new Set<ExpectedChange>();
  // §17.-3 #2: eksik/fazla anahtar yalnızca kendi `change` satırıyla expected-change olur.
  const keyChange = (key: string, change: "added" | "removed") => {
    const row = expectedChanges.find(
      (e) => "change" in e && e.key === key && e.change === change && !used.has(e),
    );
    if (row) used.add(row);
    return row;
  };
  for (const key of new Set([...A.keys(), ...B.keys()])) {
    const before = A.get(key);
    const after = B.get(key);
    if (!before || !after) {
      const change = before ? "removed" : "added";
      const ok = opts.mode === "commits" ? keyChange(key, change) : undefined;
      rows.push({
        key,
        property: "(anahtar)",
        before: before ? "var" : "yok",
        after: after ? "var" : "yok",
        verdict: ok ? "expected-change" : "fail",
        note: ok ? ok.reason : `anahtar ${change === "added" ? "fazla" : "eksik"}`,
      });
      continue;
    }
    for (const group of ["geometry", "color", "info"] as const) {
      const props = new Set([...Object.keys(before[group]), ...Object.keys(after[group])]);
      for (const property of props) {
        const x = before[group][property] ?? "";
        const y = after[group][property] ?? "";
        rows.push(judge(key, group, property, x, y));
      }
    }
  }
  return { rows, failed: rows.some((r) => r.verdict === "fail") };

  function judge(key: string, group: string, property: string, x: string, y: string): Row {
    const base = { key, property, before: x, after: y };
    if (opts.mode === "cascade") return { ...base, verdict: x === y ? "equal" : "fail" };
    if (group === "info") return { ...base, verdict: x === y ? "equal" : "info" };
    if (group === "geometry") {
      if (x === y) return { ...base, verdict: "equal" };
      const hit = expectedChanges.find(
        (e) =>
          "property" in e &&
          e.key === key &&
          e.property === property &&
          e.before === x &&
          e.after === y,
      );
      return hit
        ? { ...base, verdict: "expected-change", note: hit.reason }
        : { ...base, verdict: "fail", note: "geometri farkı" };
    }
    const cx = parseComputedColor(x);
    const cy = parseComputedColor(y);
    if (!cx || !cy) return { ...base, verdict: "fail", note: "çözülemeyen renk biçimi" };
    if (cx.a === 0 && cy.a === 0) return { ...base, verdict: "equal" };
    if (rgbHex(cx) === rgbHex(cy) && cx.a === cy.a) return { ...base, verdict: "equal" };
    if (Math.abs(cx.a - cy.a) > ALPHA_TOLERANCE)
      return { ...base, verdict: "fail", note: "alfa farkı" };
    const allowed = expectedColors(rgbHex(cx));
    return allowed.has(rgbHex(cy))
      ? { ...base, verdict: "expected-fold", note: `${rgbHex(cx)} → ${rgbHex(cy)}` }
      : { ...base, verdict: "fail", note: `beklenmeyen renk ${rgbHex(cx)} → ${rgbHex(cy)}` };
  }
}

export function summarize(rows: Row[]): Record<Verdict, number> {
  const out: Record<Verdict, number> = {
    equal: 0,
    "expected-fold": 0,
    "expected-change": 0,
    info: 0,
    fail: 0,
  };
  for (const r of rows) out[r.verdict]++;
  return out;
}
