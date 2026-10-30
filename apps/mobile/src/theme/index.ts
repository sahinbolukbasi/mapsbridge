// Mobil tema girişi (design §7, D12). Renkler ve ölçekler `tokens.ts`'ten gelir (üretilmiş;
// elle düzenlenmez — `npm run tokens:build`). Ekranlar ve bileşenler renk literal'i yazmaz,
// `tokens.color.*` (ya da `withAlpha`) kullanır.
import { tokens } from "./tokens";

export { tokens };
export type { Tokens } from "./tokens";

/** Semantik renk adı (ör. "bg", "surface", "textMuted"). */
export type ColorToken = keyof typeof tokens.color;

/**
 * Bir token rengine saydamlık uygular; web'deki `color-mix(in srgb, var(--t) a%, transparent)`
 * karşılığıdır (RN `color-mix` desteklemez). Sonuç 8 haneli hex'tir (RRGGBBAA).
 * Yalnızca opak (6 haneli hex) token'lar kabul edilir; hazır alfa token'ı varsa onu kullanın
 * (`accentA10`, `whiteA08`, `scrim` …).
 */
export function withAlpha(color: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(color);
  if (!m) throw new Error(`withAlpha: opak hex token bekleniyordu (${color})`);
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return "#" + m[1].toLowerCase() + a.toString(16).padStart(2, "0");
}

/** Göreli parlaklık (WCAG); StatusBar stilini zemine göre seçmek için. */
export function relativeLuminance(color: string): number {
  const m = /^#?([0-9a-f]{6})/i.exec(color);
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}
