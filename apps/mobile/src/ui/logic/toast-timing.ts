// apps/web/app/components/ui/logic/toast-timing.ts ile aynı saf mantık (birebir kopya)
// (parite testi: apps/web/tests/mobile-parity.test.cjs).
// Toast süre mantığı (direction §3, design-system.md §5): saf, zamanlayıcıyı çağıran kurar.
// - danger (hata) kendiliğinden kapanmaz (role="alert"; kullanıcı okuyup kapatır).
// - eylemli toast ("Geri al", "Tekrar dene") kendiliğinden kapanmaz (WCAG 2.2.1).
// - diğerleri durationMs (varsayılan 6 sn); üzerine gelince / odakta duraklar, kalan süre korunur.
export type ToastTimingTone = "info" | "success" | "warning" | "danger";
export const DEFAULT_TOAST_MS = 6000;

/** Otomatik kapanma süresi (ms); null = süresiz. */
export function toastDuration(input: {
  tone: ToastTimingTone;
  hasAction: boolean;
  durationMs?: number;
}): number | null {
  if (input.tone === "danger" || input.hasAction) return null;
  const ms = input.durationMs ?? DEFAULT_TOAST_MS;
  return Number.isFinite(ms) && ms > 0 ? ms : DEFAULT_TOAST_MS;
}

export type ToastTimer = {
  /** Kalan süre (ms). */
  remaining: number;
  /** Çalışıyorsa başlangıç zamanı; duraklatılmışsa null. */
  startedAt: number | null;
};

export function startTimer(duration: number, now: number): ToastTimer {
  return { remaining: Math.max(0, duration), startedAt: now };
}
/** Duraklat: geçen süre kalan süreden düşülür. Zaten duraklatılmışsa değişmez. */
export function pauseTimer(timer: ToastTimer, now: number): ToastTimer {
  if (timer.startedAt === null) return timer;
  return { remaining: Math.max(0, timer.remaining - (now - timer.startedAt)), startedAt: null };
}
/** Sürdür: kalan süreyle yeniden başlar. Zaten çalışıyorsa değişmez. */
export function resumeTimer(timer: ToastTimer, now: number): ToastTimer {
  return timer.startedAt === null ? { remaining: timer.remaining, startedAt: now } : timer;
}
/** Süre çubuğu oranı (1 → 0). */
export function timerProgress(timer: ToastTimer, duration: number, now: number): number {
  if (duration <= 0) return 0;
  const left =
    timer.startedAt === null ? timer.remaining : timer.remaining - (now - timer.startedAt);
  return Math.min(1, Math.max(0, left / duration));
}
