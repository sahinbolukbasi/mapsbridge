// Sayaç animasyonu (Increment 3.6, checkout bakiyesi): saf ara değer hesabı. Ease-out kübik;
// ilerleme [0,1] dışına taşmaz, sonuç tam sayıdır ve son karede hedefe eşittir.
export function countUpValue(from: number, to: number, progress: number): number {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 1));
  const eased = 1 - Math.pow(1 - p, 3);
  return p >= 1 ? to : Math.round(from + (to - from) * eased);
}
