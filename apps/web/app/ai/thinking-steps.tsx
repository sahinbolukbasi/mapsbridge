"use client";

import { useEffect, useRef, useState } from "react";

const THINKING_PHASES = [
  { icon: "psychology", label: "İsteğini analiz ediyorum...", delay: 0 },
  { icon: "travel_explore", label: "Mekanları ve bölgeleri araştırıyorum...", delay: 2200 },
  { icon: "flight_takeoff", label: "Uçuş fiyatlarını kontrol ediyorum...", delay: 4200 },
  { icon: "policy", label: "Seyahat tavsiyelerini ve giriş koşullarını alıyorum...", delay: 6000 },
  { icon: "route", label: "Rota ve zaman optimizasyonu yapıyorum...", delay: 8500 },
  { icon: "hotel", label: "Konaklama seçeneklerini değerlendiriyorum...", delay: 11500 },
  { icon: "restaurant", label: "Yerel lezzetleri ve aktiviteleri eşleştiriyorum...", delay: 14500 },
  { icon: "verified", label: "Bilgileri doğrulayıp planı derliyorum...", delay: 17500 },
];

const QUICK_FACTS = [
  "Şehir içi yürüyüş mesafelerini hesaplıyorum",
  "Açılış saatlerini ve müze bilet slotlarını kontrol ediyorum",
  "Bütçe dostu alternatifleri değerlendiriyorum",
  "Gün batımı ve fotoğraf noktalarını belirliyorum",
  "Yerel ulaşım kartı avantajlarını karşılaştırıyorum",
  "Mevsimsel etkinlik ve festivalleri tarıyorum",
  "Kalabalık saatlerden kaçınma stratejisi oluşturuyorum",
  "AgentCore Gateway'den mekan verileri çekiyorum",
  "Travelpayouts önbelleğinden uçuş fiyatlarını alıyorum",
  "FCDO seyahat tavsiyesi kontrol ediliyor",
];

// Map SSE status phase strings to THINKING_PHASES indexes
const PHASE_MAP: Record<string, number> = {
  "intent": 0,
  "research": 1,
  "places": 1,
  "flights": 2,
  "advisory": 3,
  "route": 4,
  "stay": 5,
  "discovery": 6,
  "finalize": 7,
  "complete": 7,
};

export interface LivePhase {
  icon: string;
  label: string;
}

interface ThinkingStepsProps {
  isRoute: boolean;
  livePhase?: LivePhase | null;
}

export function ThinkingSteps({ isRoute, livePhase }: ThinkingStepsProps) {
  const [visiblePhases, setVisiblePhases] = useState(1);
  const [factIndex, setFactIndex] = useState(0);
  const timersCleaned = useRef(false);

  // If livePhase is provided, jump to the matching phase index
  useEffect(() => {
    if (!livePhase) return;
    const idx = THINKING_PHASES.findIndex(
      (p) => p.icon === livePhase.icon || p.label === livePhase.label,
    );
    if (idx >= 0) setVisiblePhases(idx + 1);
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
  const _activeLabel = livePhase?.label || phases[visiblePhases - 1]?.label || "";

  return (
    <div className="ai-thinking-steps">
      <div className="ai-thinking-steps-header">
        <div className="ai-thinking-pulse" />
        <span className="ai-thinking-title">
          {livePhase ? livePhase.label : "Planlıyorum"}
        </span>
      </div>

      <div className="ai-thinking-phases">
        {phases.slice(0, visiblePhases).map((phase, i) => {
          const isLatest = i === visiblePhases - 1;
          return (
            <div key={i} className={`ai-thinking-phase ${isLatest ? "active" : "done"}`}>
              <span
                className={`material-symbols-outlined ai-thinking-phase-icon ${isLatest ? "ai-phase-spin" : ""}`}
              >
                {isLatest ? phase.icon : "check_circle"}
              </span>
              <span className="ai-thinking-phase-label">{phase.label}</span>
            </div>
          );
        })}
      </div>

      {isRoute && visiblePhases >= 3 && (
        <div className="ai-thinking-fact" key={factIndex}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "13px", color: "#10b981" }}
          >
            lightbulb
          </span>
          <span>{QUICK_FACTS[factIndex]}</span>
        </div>
      )}
    </div>
  );
}

/** Convert an SSE status event { phase, message } to a LivePhase for ThinkingSteps. */
export function sseStatusToLivePhase(phase: string, message?: string): LivePhase {
  const idx = PHASE_MAP[phase?.toLowerCase()] ?? 0;
  return {
    icon: THINKING_PHASES[idx]?.icon ?? "psychology",
    label: message || THINKING_PHASES[idx]?.label || "İşleniyor...",
  };
}
