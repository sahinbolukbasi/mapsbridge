"use client";

import type { ChatMessage } from "../lib/ai/chat";
import type { UnifiedRoutePlan } from "../lib/ai/types";
import { Icon, type IconName } from "../components/ui";
import { useLocale } from "../lib/locale-context";
import { fill, type Translate } from "./studio-format";

interface FollowupChip {
  icon: IconName;
  label: string;
  prompt: string;
}

function extractFollowups(
  message: ChatMessage,
  _route: UnifiedRoutePlan | null,
  t: Translate,
): FollowupChip[] {
  const chips: FollowupChip[] = [];
  const text = message.text.toLowerCase();

  if (message.quickReplies && message.quickReplies.length > 0) {
    return [];
  }

  const chip = (
    icon: IconName,
    id: string,
    label: string,
    prompt: string,
    values: Record<string, string | number> = {},
  ): FollowupChip => ({
    icon,
    label: fill(t(`studio.follow.${id}`, label), values),
    prompt: fill(t(`studio.follow.${id}.prompt`, prompt), values),
  });

  if (message.route) {
    const r = message.route;
    const dest = r.destination || "";
    const days = r.estimatedDays || 1;
    const stops = r.stops?.length || 0;

    chips.push(
      chip(
        "food",
        "routeFood",
        "{dest} lezzetleri",
        "{dest} rotasındaki her gün için yerel restoran ve yemek önerileri ekle",
        { dest },
      ),
      chip(
        "bed",
        "routeHotel",
        "Otel semti öner",
        "{dest} için {days} gecelik merkezi ve bütçe dostu konaklama semtleri ve otel öner",
        { dest, days },
      ),
      chip(
        "clock",
        "routePace",
        "Tempoyu değiştir",
        "Rotayı daha rahat bir tempoya çevir, molalar ekle ve yürüyüş mesafelerini azalt",
      ),
    );

    if (stops > 4) {
      chips.push(
        chip(
          "minus",
          "routeFewer",
          "Daha az durak",
          "Rota çok yoğun, en önemli durakları bırakıp gerisini çıkar",
        ),
      );
    }
    if (days < 3) {
      chips.push(
        chip(
          "plus",
          "routeMoreDay",
          "1 gün daha ekle",
          "Rotaya 1 gün daha ekle, yeni duraklar ve aktiviteler öner",
        ),
      );
    }
    chips.push(
      chip(
        "sparkle",
        "routeEvening",
        "Akşam planı",
        "{dest} için akşam yemeği sonrası bar, rooftop veya canlı müzik planı öner",
        { dest },
      ),
    );

    return chips.slice(0, 4);
  }

  if (message.stayAndTransit) {
    chips.push(
      chip(
        "coin",
        "stayCheaper",
        "Daha ucuz seçenek",
        "Daha bütçe dostu otel ve hostel alternatifleri öner",
      ),
      chip(
        "landmark",
        "stayArea",
        "Farklı semt",
        "Başka bir semtte konaklama seçeneklerini karşılaştır",
      ),
      chip(
        "map",
        "stayRoute",
        "Rotayı göster",
        "Şimdi bu konaklama bilgisiyle günlük rota oluştur",
      ),
    );
    return chips.slice(0, 3);
  }

  if (message.discovery) {
    chips.push(
      chip("plus", "discAdd", "Rotaya ekle", "Bu keşif noktalarını mevcut rotama ekle"),
      chip(
        "food",
        "discFood",
        "Detaylı yemek",
        "Bu restoranların menü tavsiyeleri, fiyat aralığı ve rezervasyon bilgisi ver",
      ),
      chip(
        "clock",
        "discTime",
        "Zaman planla",
        "Bu keşif noktaları için hangi gün ve saatlerde gitmem gerektiğini planla",
      ),
    );
    return chips.slice(0, 3);
  }

  if (text.includes("otel") || text.includes("konaklama") || text.includes("hotel")) {
    chips.push(
      chip(
        "map",
        "hotelRoute",
        "Rota da oluştur",
        "Bu otel bölgesine göre günlük yürüyüş rotası oluştur",
      ),
      chip(
        "coin",
        "hotelCheaper",
        "Daha ucuzu?",
        "Daha bütçe dostu alternatif oteller ve hosteller öner",
      ),
    );
  } else if (text.includes("restoran") || text.includes("yemek") || text.includes("lezzet")) {
    chips.push(
      chip("plus", "foodAdd", "Rotaya ekle", "Bu restoranları gezi rotama sırala ve ekle"),
      chip("food", "foodCoffee", "Kahve de ekle", "Yakınlardaki en iyi kahvecileri de öner"),
    );
  } else if (text.includes("müze") || text.includes("tarihi") || text.includes("sanat")) {
    chips.push(
      chip(
        "clock",
        "museumTickets",
        "Bilet ve saat",
        "Bu müzelerin bilet fiyatları, ücretsiz günleri ve en uygun ziyaret saatlerini ver",
      ),
      chip(
        "food",
        "museumFood",
        "Yakın restoran",
        "Bu müzelere yürüme mesafesinde iyi restoranlar öner",
      ),
    );
  } else {
    chips.push(
      chip(
        "map",
        "toRoute",
        "Bunu rotaya çevir",
        "Bu bilgilere göre detaylı bir gezi rotası oluştur",
      ),
      chip("help", "detail", "Daha detay", "Bu konuda daha detaylı bilgi ve pratik ipuçları ver"),
      chip("compass", "alt", "Alternatif öner", "Farklı ve alternatif seçenekler de öner"),
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
  const { t } = useLocale();
  const chips = extractFollowups(message, route, t);

  if (chips.length === 0) return null;

  return (
    <ul className="as-studio-followups" aria-label={t("studio.follow.label", "Önerilen devam")}>
      {chips.map((c) => (
        <li key={c.prompt}>
          <button
            type="button"
            className="as-studio-action"
            onClick={() => onAction(c.prompt)}
            disabled={busy}
          >
            <Icon name={c.icon} size={16} />
            <span>{c.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
