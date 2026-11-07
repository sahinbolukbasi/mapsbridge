// Biyometrik kilit saf kuralı (K4; test: apps/web/tests/mobile/notifications.test.cjs).
export const GRACE_MS = 60_000;
/** Arka plandan dönüşte kilit gerekir mi: açık + GRACE_MS'ten uzun arka planda kalındı. */
export function shouldLock(enabled: boolean, backgroundedAt: number | null, now: number): boolean {
  return enabled && backgroundedAt !== null && now - backgroundedAt >= GRACE_MS;
}
