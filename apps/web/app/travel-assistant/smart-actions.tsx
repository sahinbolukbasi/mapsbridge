"use client";

import type { ChatMessage } from "../lib/ai/chat";
import type { UnifiedRoutePlan } from "../lib/ai/types";
import type { Trip } from "../lib/trip/models";

interface SmartAction {
  icon: string;
  label: string;
  prompt: string;
  category: "route" | "food" | "hotel" | "activity" | "edit" | "info";
}

interface SmartActionsProps {
  messages: ChatMessage[];
  route: UnifiedRoutePlan | null;
  currentTrip: Trip | null;
  onAction: (prompt: string) => void;
  busy: boolean;
}

function getDestination(
  route: UnifiedRoutePlan | null,
  trip: Trip | null,
  messages: ChatMessage[],
): string | null {
  if (route?.destination) return route.destination;
  if (trip?.destination) return trip.destination;
  if (trip?.title && !trip.title.includes("Seyahat")) return trip.title;
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return lastUser?.text?.slice(0, 40) || null;
}

function buildActions(
  messages: ChatMessage[],
  route: UnifiedRoutePlan | null,
  trip: Trip | null,
): SmartAction[] {
  const dest = getDestination(route, trip, messages);
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const hasRoute = !!route;
  const hasStays = !!lastAssistant?.stayAndTransit;
  const hasDiscovery = !!lastAssistant?.discovery;
  const msgCount = messages.length;

  if (msgCount === 0) return [];

  const actions: SmartAction[] = [];

  if (hasRoute && dest) {
    actions.push(
      {
        icon: "restaurant",
        label: "Akşam yemeği ekle",
        prompt: `${dest} rotasına akşam için yerel bir restoran ekle`,
        category: "food",
      },
      {
        icon: "coffee",
        label: "Kahve molası ekle",
        prompt: `Rotadaki duraklara yakın butik kahveciler öner ve araya ekle`,
        category: "food",
      },
      {
        icon: "pace",
        label: "Tempoyu gevşet",
        prompt: `Rotayı daha sakin bir tempoya çevir, mola aralarını artır`,
        category: "edit",
      },
      {
        icon: "add_location",
        label: "Gizli nokta ekle",
        prompt: `${dest} için turistlerin bilmediği yerel bir gizli köşe öner ve rotaya ekle`,
        category: "activity",
      },
    );
    if (!hasStays) {
      actions.push({
        icon: "hotel",
        label: "Otel öner",
        prompt: `${dest} rotasına uygun merkezi ve bütçe dostu otel semtleri ve oteller öner`,
        category: "hotel",
      });
    }
    if (!hasDiscovery) {
      actions.push({
        icon: "local_dining",
        label: "Yerel lezzetler",
        prompt: `${dest} şehrinde mutlaka denenmesi gereken yerel yemekler ve restoranlar neler?`,
        category: "food",
      });
    }
    actions.push(
      {
        icon: "nightlife",
        label: "Gece hayatı",
        prompt: `${dest} için akşam/gece aktiviteleri ve barlar öner`,
        category: "activity",
      },
      {
        icon: "photo_camera",
        label: "Fotoğraf noktaları",
        prompt: `${dest} rotasındaki en iyi fotoğraf ve manzara noktalarını listele`,
        category: "activity",
      },
    );
  } else if (dest && msgCount >= 2) {
    actions.push(
      {
        icon: "map",
        label: "Rota oluştur",
        prompt: `${dest} için detaylı bir gezi rotası oluştur`,
        category: "route",
      },
      {
        icon: "restaurant",
        label: "Nerede yenir?",
        prompt: `${dest} şehrinde en iyi yerel restoranlar ve sokak yemekleri neler?`,
        category: "food",
      },
      {
        icon: "hotel",
        label: "Nerede kalınır?",
        prompt: `${dest} için merkezi, güvenli ve bütçe dostu otel bölgeleri ve öneriler`,
        category: "hotel",
      },
      {
        icon: "local_activity",
        label: "Aktiviteler",
        prompt: `${dest} şehrinde yapılabilecek en iyi aktiviteler ve deneyimler neler?`,
        category: "activity",
      },
    );
  } else {
    actions.push(
      {
        icon: "explore",
        label: "Popüler rotalar",
        prompt: "Bu sezon en popüler Avrupa şehir rotalarını öner",
        category: "route",
      },
      {
        icon: "savings",
        label: "Bütçe dostu gezi",
        prompt: "500€ altı bütçeyle 3 günlük bir şehir gezisi planla",
        category: "route",
      },
      {
        icon: "family_restroom",
        label: "Aile gezisi",
        prompt: "Çocuklarla gidilebilecek eğlenceli ve güvenli bir şehir öner",
        category: "route",
      },
      {
        icon: "flight",
        label: "Hafta sonu kaçamağı",
        prompt: "Bu hafta sonu için 2 günlük kısa bir kaçamak planla",
        category: "route",
      },
    );
  }

  return actions.slice(0, 6);
}

export function SmartActions({ messages, route, currentTrip, onAction, busy }: SmartActionsProps) {
  const actions = buildActions(messages, route, currentTrip);

  if (actions.length === 0) return null;

  return (
    <div className="ai-smart-actions">
      <div className="ai-smart-actions-header">
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "14px", color: "var(--color-accent)" }}
        >
          auto_awesome
        </span>
        <span>Hızlı İşlemler</span>
      </div>
      <div className="ai-smart-actions-grid">
        {actions.map((action) => (
          <button
            key={action.prompt}
            type="button"
            className={`ai-smart-action-btn ai-smart-action-${action.category}`}
            onClick={() => onAction(action.prompt)}
            disabled={busy}
            title={action.prompt}
          >
            <span className="material-symbols-outlined ai-smart-action-icon">{action.icon}</span>
            <span className="ai-smart-action-label">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
