"use client";

import { useEffect, useRef, useState } from "react";
import { Progress, type IconName } from "../components/ui";
import { useLocale } from "../lib/locale-context";

// Aşamalar GERÇEK boru hattı adımlarıdır (Increment 1.10, bug 6): S0 niyet → S1 aday havuzu
// (gerçek mekan verisi) → S3 günlere kümeleme → S3/S4 gün içi sıra → S5 anlatım. Süre ya da
// sistemin yapmadığı bir iş (uçuş/konaklama taraması vb.) metinde iddia edilmez. Stream
// yokken (buffered /ai/chat) aşamalar zamanlayıcıyla ilerler; sunucu aşaması gelirse ona atlar.
const THINKING_PHASES: readonly { icon: IconName; key: string; label: string; delay: number }[] = [
  { icon: "sparkle", key: "studio.think.intent", label: "İsteğini anlıyorum…", delay: 0 },
  {
    icon: "search",
    key: "studio.think.research",
    label: "Gerçek mekan verisinden aday yerleri topluyorum…",
    delay: 2500,
  },
  {
    icon: "calendar",
    key: "studio.think.cluster",
    label: "Durakları günlere ayırıyorum…",
    delay: 7000,
  },
  {
    icon: "route",
    key: "studio.think.route",
    label: "Gün içi sırayı hesaplıyorum…",
    delay: 11000,
  },
  {
    icon: "check",
    key: "studio.think.finalize",
    label: "Planı anlatıyorum…",
    delay: 15000,
  },
];
/** Sohbet (rota yok) yanıtında yalnız niyet + anlatım aşamaları. */
const CHAT_PHASES = [THINKING_PHASES[0], THINKING_PHASES[4]] as const;
// Sunucu SSE aşaması → THINKING_PHASES indeksi.
const PHASE_MAP: Record<string, number> = {
  intent: 0,
  research: 1,
  places: 1,
  flights: 1,
  advisory: 1,
  stay: 1,
  discovery: 1,
  cluster: 2,
  route: 3,
  finalize: 4,
  narration: 4,
  complete: 4,
};
/** Sunucu aşaması: index THINKING_PHASES'e, message sunucunun kendi metni (varsa). */
export interface LivePhase {
  index: number;
  message?: string;
}

interface ThinkingStepsProps {
  isRoute: boolean;
  livePhase?: LivePhase | null;
}

export function ThinkingSteps({ isRoute, livePhase }: ThinkingStepsProps) {
  const { t } = useLocale();
  const [visiblePhases, setVisiblePhases] = useState(1);
  const timersCleaned = useRef(false);

  // If livePhase is provided, jump to the matching phase index
  useEffect(() => {
    if (!livePhase) return;
    setVisiblePhases(livePhase.index + 1);
  }, [livePhase]);

  // Fallback timer-based progression when no live phases come in
  useEffect(() => {
    if (timersCleaned.current) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    THINKING_PHASES.forEach((phase, i) => {
      if (i === 0) return;
      timers.push(setTimeout(() => setVisiblePhases((prev) => Math.max(prev, i + 1)), phase.delay));
    });
    timersCleaned.current = true;
    return () => timers.forEach(clearTimeout);
  }, []);

  const phases: readonly (typeof THINKING_PHASES)[number][] = isRoute
    ? THINKING_PHASES
    : CHAT_PHASES;
  // Etkin adım: rota modunda görünen aşama sayısı − 1; sohbet modunda niyet → anlatım.
  const current = isRoute
    ? Math.min(visiblePhases, phases.length) - 1
    : visiblePhases >= THINKING_PHASES.length
      ? 1
      : 0;
  const liveLabel = livePhase
    ? livePhase.message ||
      t(THINKING_PHASES[livePhase.index]?.key ?? "", THINKING_PHASES[livePhase.index]?.label)
    : null;

  return (
    <div className="as-studio-thinking">
      <p className="as-studio-thinking__title">
        <span className="as-studio-thinking__pulse" aria-hidden="true" />
        {liveLabel ?? t("studio.think.title", "Planlıyorum")}
      </p>

      {/* Increment 2.8: aşamalı ilerleme primitive'i (aktif adım döner, tamamlanan onaylanır). */}
      <Progress
        variant="steps"
        label={t("studio.think.title", "Planlıyorum")}
        steps={phases.map((phase) => ({ id: phase.key, label: t(phase.key, phase.label) }))}
        current={current}
      />
    </div>
  );
}

/** Convert an SSE status event { phase, message } to a LivePhase for ThinkingSteps. */
export function sseStatusToLivePhase(phase: string, message?: string): LivePhase {
  const idx = PHASE_MAP[phase?.toLowerCase()] ?? 0;
  return { index: idx, message: message || undefined };
}
