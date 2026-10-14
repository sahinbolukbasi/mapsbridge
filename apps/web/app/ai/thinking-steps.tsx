"use client";

import { useEffect, useState } from "react";

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

interface ThinkingStepsProps {
  isRoute: boolean;
}

export function ThinkingSteps({ isRoute }: ThinkingStepsProps) {
  const [visiblePhases, setVisiblePhases] = useState(1);
  const [factIndex, setFactIndex] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    THINKING_PHASES.forEach((phase, i) => {
      if (i === 0) return;
      timers.push(setTimeout(() => setVisiblePhases(i + 1), phase.delay));
    });
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

  return (
    <div className="ai-thinking-steps">
      <div className="ai-thinking-steps-header">
        <div className="ai-thinking-pulse" />
        <span className="ai-thinking-title">Planlıyorum</span>
      </div>

      <div className="ai-thinking-phases">
        {phases.slice(0, visiblePhases).map((phase, i) => {
          const isLatest = i === visiblePhases - 1;
          return (
            <div
              key={i}
              className={`ai-thinking-phase ${isLatest ? "active" : "done"}`}
            >
              <span className={`material-symbols-outlined ai-thinking-phase-icon ${isLatest ? "ai-phase-spin" : ""}`}>
                {isLatest ? phase.icon : "check_circle"}
              </span>
              <span className="ai-thinking-phase-label">{phase.label}</span>
            </div>
          );
        })}
      </div>

      {isRoute && visiblePhases >= 3 && (
        <div className="ai-thinking-fact" key={factIndex}>
          <span className="material-symbols-outlined" style={{ fontSize: "13px", color: "#10b981" }}>
            lightbulb
          </span>
          <span>{QUICK_FACTS[factIndex]}</span>
        </div>
      )}
    </div>
  );
}
