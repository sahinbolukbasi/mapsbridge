// apps/web/app/components/ui/logic/progress.ts ile aynı saf mantık (birebir kopya)
// (parite testi: apps/web/tests/mobile-parity.test.cjs).
// Progress saf mantığı (direction §2/§3): değer sınırlama ve adım durumu.
/** value/max → 0–100 yüzde (NaN, negatif ve taşma sınırlanır). */
export function clampProgress(value: number, max = 100): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.round(Math.min(100, Math.max(0, (value / max) * 100)) * 10) / 10;
}
export type StepState = "done" | "active" | "pending";
/** current: etkin adımın sırası (0'dan); current ≥ adım sayısı → hepsi tamam. */
export function stepState(index: number, current: number): StepState {
  if (index < current) return "done";
  return index === current ? "active" : "pending";
}
/** Ekran okuyucu metni: "Adım 2/4: Aday havuzu" (şablon dışarıdan, I11). */
export function stepAnnouncement(
  template: string,
  current: number,
  labels: readonly string[],
): string {
  if (!labels.length) return "";
  const i = Math.min(Math.max(0, current), labels.length - 1);
  return template
    .replace("{n}", String(i + 1))
    .replace("{total}", String(labels.length))
    .replace("{label}", labels[i]);
}
