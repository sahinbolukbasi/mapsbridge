"use client";

import type { ChatMessage } from "../lib/ai/chat";
import type { UnifiedRoutePlan } from "../lib/ai/types";

interface FollowupChip {
  icon: string;
  label: string;
  prompt: string;
}

function extractFollowups(message: ChatMessage, route: UnifiedRoutePlan | null): FollowupChip[] {
  const chips: FollowupChip[] = [];
  const text = message.text.toLowerCase();

  if (message.quickReplies && message.quickReplies.length > 0) {
    return [];
  }

  if (message.route) {
    const r = message.route;
    const dest = r.destination || "";
    const days = r.estimatedDays || 1;
    const stops = r.stops?.length || 0;

    chips.push(
      {
        icon: "restaurant",
        label: `${dest} lezzetleri`,
        prompt: `${dest} rotasındaki her gün için yerel restoran ve yemek önerileri ekle`,
      },
      {
        icon: "hotel",
        label: "Otel semti öner",
        prompt: `${dest} için ${days} gecelik merkezi ve bütçe dostu konaklama semtleri ve otel öner`,
      },
      {
        icon: "schedule",
        label: "Tempoyu değiştir",
        prompt: "Rotayı daha rahat bir tempoya çevir, molalar ekle ve yürüyüş mesafelerini azalt",
      },
    );

    if (stops > 4) {
      chips.push({
        icon: "remove_circle",
        label: "Daha az durak",
        prompt: "Rota çok yoğun, en önemli durakları bırakıp gerisini çıkar",
      });
    }
    if (days < 3) {
      chips.push({
        icon: "add_circle",
        label: "1 gün daha ekle",
        prompt: `Rotaya 1 gün daha ekle, yeni duraklar ve aktiviteler öner`,
      });
    }
    chips.push({
      icon: "nightlife",
      label: "Akşam planı",
      prompt: `${dest} için akşam yemeği sonrası bar, rooftop veya canlı müzik planı öner`,
    });

    return chips.slice(0, 4);
  }

  if (message.stayAndTransit) {
    chips.push(
      {
        icon: "compare",
        label: "Daha ucuz seçenek",
        prompt: "Daha bütçe dostu otel ve hostel alternatifleri öner",
      },
      {
        icon: "location_city",
        label: "Farklı semt",
        prompt: "Başka bir semtte konaklama seçeneklerini karşılaştır",
      },
      {
        icon: "map",
        label: "Rotayı göster",
        prompt: "Şimdi bu konaklama bilgisiyle günlük rota oluştur",
      },
    );
    return chips.slice(0, 3);
  }

  if (message.discovery) {
    chips.push(
      {
        icon: "add_location",
        label: "Rotaya ekle",
        prompt: "Bu keşif noktalarını mevcut rotama ekle",
      },
      {
        icon: "restaurant",
        label: "Detaylı yemek",
        prompt: "Bu restoranların menü tavsiyeleri, fiyat aralığı ve rezervasyon bilgisi ver",
      },
      {
        icon: "schedule",
        label: "Zaman planla",
        prompt: "Bu keşif noktaları için hangi gün ve saatlerde gitmem gerektiğini planla",
      },
    );
    return chips.slice(0, 3);
  }

  if (text.includes("otel") || text.includes("konaklama") || text.includes("hotel")) {
    chips.push(
      {
        icon: "map",
        label: "Rota da oluştur",
        prompt: "Bu otel bölgesine göre günlük yürüyüş rotası oluştur",
      },
      {
        icon: "savings",
        label: "Daha ucuzu?",
        prompt: "Daha bütçe dostu alternatif oteller ve hosteller öner",
      },
    );
  } else if (text.includes("restoran") || text.includes("yemek") || text.includes("lezzet")) {
    chips.push(
      {
        icon: "add_location",
        label: "Rotaya ekle",
        prompt: "Bu restoranları gezi rotama sırala ve ekle",
      },
      { icon: "coffee", label: "Kahve de ekle", prompt: "Yakınlardaki en iyi kahvecileri de öner" },
    );
  } else if (text.includes("müze") || text.includes("tarihi") || text.includes("sanat")) {
    chips.push(
      {
        icon: "schedule",
        label: "Bilet ve saat",
        prompt: "Bu müzelerin bilet fiyatları, ücretsiz günleri ve en uygun ziyaret saatlerini ver",
      },
      {
        icon: "restaurant",
        label: "Yakın restoran",
        prompt: "Bu müzelere yürüme mesafesinde iyi restoranlar öner",
      },
    );
  } else {
    chips.push(
      {
        icon: "map",
        label: "Bunu rotaya çevir",
        prompt: "Bu bilgilere göre detaylı bir gezi rotası oluştur",
      },
      {
        icon: "help",
        label: "Daha detay",
        prompt: "Bu konuda daha detaylı bilgi ve pratik ipuçları ver",
      },
      {
        icon: "explore",
        label: "Alternatif öner",
        prompt: "Farklı ve alternatif seçenekler de öner",
      },
    );
  }

  return chips.slice(0, 3);
}

interface ContextualFollowupsProps {
  message: ChatMessage;
  route: UnifiedRoutePlan | null;
  onAction: (prompt: string) => void;
  busy: boolean;
}

export function ContextualFollowups({ message, route, onAction, busy }: ContextualFollowupsProps) {
  const chips = extractFollowups(message, route);

  if (chips.length === 0) return null;

  return (
    <div className="ai-contextual-followups">
      {chips.map((chip) => (
        <button
          key={chip.prompt}
          type="button"
          className="ai-contextual-chip"
          onClick={() => onAction(chip.prompt)}
          disabled={busy}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
            {chip.icon}
          </span>
          <span>{chip.label}</span>
        </button>
      ))}
    </div>
  );
}
