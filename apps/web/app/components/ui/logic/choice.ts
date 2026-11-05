// ChipGroup ve Stepper saf yardımcıları (design §4.2).
export type ChoiceMode = "single" | "multi";

/** Çoklu grupta `max` dolduysa seçili olmayan çipler kilitlenir (aria-disabled). */
export function chipLocked(
  pressed: boolean,
  selectedCount: number,
  mode: ChoiceMode,
  max?: number,
): boolean {
  if (pressed || mode !== "multi" || max === undefined) return false;
  return selectedCount >= max;
}

/** Seçim listesine değer ekler/çıkarır; single tek değer tutar, multi `max`'ı aşmaz. */
export function toggleChoice<T>(
  selected: readonly T[],
  value: T,
  mode: ChoiceMode,
  max?: number,
): T[] {
  if (selected.includes(value)) return selected.filter((v) => v !== value);
  if (mode === "single") return [value];
  if (max !== undefined && selected.length >= max) return [...selected];
  return [...selected, value];
}

/** Stepper: değeri adım kadar değiştirip [min, max] aralığına sıkıştırır. */
export function clampStep(value: number, delta: number, min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const base = Number.isFinite(value) ? value : lo;
  return Math.min(hi, Math.max(lo, base + delta));
}
