"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "../components/ui";
import { useLocale } from "../lib/locale-context";

// Her aşama [anahtar, TR yedeği]; ikon Icon primitive adı (R3).
const THINKING_PHASES: readonly { icon: IconName; key: string; label: string; delay: number }[] = [
  { icon: "sparkle", key: "studio.think.intent", label: "İsteğini analiz ediyorum...", delay: 0 },
  {
    icon: "search",
    key: "studio.think.research",
    label: "Mekanları ve bölgeleri araştırıyorum...",
    delay: 2200,
  },
  {
    icon: "plane",
    key: "studio.think.flights",
    label: "Uçuş fiyatlarını kontrol ediyorum...",
    delay: 4200,
  },
  {
    icon: "shield",
    key: "studio.think.advisory",
    label: "Seyahat tavsiyelerini ve giriş koşullarını alıyorum...",
    delay: 6000,
  },
  {
    icon: "route",
    key: "studio.think.route",
    label: "Rota ve zaman optimizasyonu yapıyorum...",
    delay: 8500,
  },
  {
    icon: "bed",
    key: "studio.think.stay",
    label: "Konaklama seçeneklerini değerlendiriyorum...",
    delay: 11500,
  },
  {
    icon: "food",
    key: "studio.think.discovery",
    label: "Yerel lezzetleri ve aktiviteleri eşleştiriyorum...",
    delay: 14500,
  },
  {
    icon: "check",
    key: "studio.think.finalize",
    label: "Bilgileri doğrulayıp planı derliyorum...",
    delay: 17500,
  },
];

const QUICK_FACTS: readonly (readonly [string, string])[] = [
  ["studio.think.fact.walk", "Şehir içi yürüyüş mesafelerini hesaplıyorum"],
  ["studio.think.fact.hours", "Açılış saatlerini ve müze bilet slotlarını kontrol ediyorum"],
  ["studio.think.fact.budget", "Bütçe dostu alternatifleri değerlendiriyorum"],
  ["studio.think.fact.sunset", "Gün batımı ve fotoğraf noktalarını belirliyorum"],
  ["studio.think.fact.card", "Yerel ulaşım kartı avantajlarını karşılaştırıyorum"],
  ["studio.think.fact.events", "Mevsimsel etkinlik ve festivalleri tarıyorum"],
  ["studio.think.fact.crowds", "Kalabalık saatlerden kaçınma stratejisi oluşturuyorum"],
  ["studio.think.fact.gateway", "AgentCore Gateway'den mekan verileri çekiyorum"],
  ["studio.think.fact.flights", "Travelpayouts önbelleğinden uçuş fiyatlarını alıyorum"],
  ["studio.think.fact.fcdo", "FCDO seyahat tavsiyesi kontrol ediliyor"],
];

// Map SSE status phase strings to THINKING_PHASES indexes
const PHASE_MAP: Record<string, number> = {
  intent: 0,
  research: 1,
  places: 1,
  flights: 2,
  advisory: 3,
  route: 4,
  stay: 5,
  discovery: 6,
  finalize: 7,
  complete: 7,
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
  const [factIndex, setFactIndex] = useState(0);
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

  useEffect(() => {
    if (!isRoute) return;
    const interval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % QUICK_FACTS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [isRoute]);

  const phases = isRoute ? THINKING_PHASES : THINKING_PHASES.slice(0, 3);
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

      <ol className="as-studio-thinking__phases">
        {phases.slice(0, visiblePhases).map((phase, i) => {
          const isLatest = i === visiblePhases - 1;
          return (
            <li
              key={phase.key}
              className="as-studio-thinking__phase"
              data-state={isLatest ? "active" : "done"}
            >
              <Icon name={isLatest ? phase.icon : "check"} size={16} />
              <span>{t(phase.key, phase.label)}</span>
            </li>
          );
        })}
      </ol>

      {isRoute && visiblePhases >= 3 && (
        <p className="as-studio-thinking__fact" key={factIndex}>
          <Icon name="info" size={16} />
          <span>{t(...QUICK_FACTS[factIndex])}</span>
        </p>
      )}
    </div>
  );
}

/** Convert an SSE status event { phase, message } to a LivePhase for ThinkingSteps. */
export function sseStatusToLivePhase(phase: string, message?: string): LivePhase {
  const idx = PHASE_MAP[phase?.toLowerCase()] ?? 0;
  return { index: idx, message: message || undefined };
}
