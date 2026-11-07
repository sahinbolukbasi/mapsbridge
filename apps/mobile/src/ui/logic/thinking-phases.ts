// Asistan aşamaları (web apps/web/app/travel-assistant/thinking-steps.tsx THINKING_PHASES ile aynı
// anahtar, metin ve gecikme; parite testi: apps/web/tests/mobile-parity.test.cjs). Aşamalar GERÇEK
// boru hattı adımlarıdır (S0 niyet → S1 aday havuzu → S3 kümeleme → S3/S4 sıra → S5 anlatım);
// buffered yanıtta zamanlayıcıyla ilerler, süre iddia edilmez (I1). Saf modül.
export type ThinkingKey =
  | "studio.think.intent"
  | "studio.think.research"
  | "studio.think.cluster"
  | "studio.think.route"
  | "studio.think.finalize";
export const THINKING_PHASES: readonly { key: ThinkingKey; delay: number }[] = [
  { key: "studio.think.intent", delay: 0 },
  { key: "studio.think.research", delay: 2500 },
  { key: "studio.think.cluster", delay: 7000 },
  { key: "studio.think.route", delay: 11000 },
  { key: "studio.think.finalize", delay: 15000 },
];
/** Sohbet (rota yok) yanıtında yalnız niyet + anlatım. */
export const CHAT_PHASES = [THINKING_PHASES[0], THINKING_PHASES[4]] as const;
/** Web ile aynı sezgi: uzun istek ya da süren sohbet rota üretir. */
export function thinkingIsRoute(textLength: number, messageCount: number): boolean {
  return textLength > 20 || messageCount >= 2;
}
/** Geçen süreye göre görünen aşama sayısı (≥1). */
export function visiblePhaseCount(elapsedMs: number): number {
  return Math.max(1, THINKING_PHASES.filter((p) => p.delay <= elapsedMs).length);
}
/** Etkin adım sırası (web ThinkingSteps `current` hesabı). */
export function currentPhase(isRoute: boolean, visible: number): number {
  if (isRoute) return Math.min(visible, THINKING_PHASES.length) - 1;
  return visible >= THINKING_PHASES.length ? 1 : 0;
}
