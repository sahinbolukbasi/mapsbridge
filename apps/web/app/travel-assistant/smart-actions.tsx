"use client";

import type { ChatMessage } from "../lib/ai/chat";
import type { UnifiedRoutePlan } from "../lib/ai/types";
import type { Trip } from "../lib/trip/models";
import { Icon, type IconName } from "../components/ui";
import { useLocale } from "../lib/locale-context";
import { fill, type Translate } from "./studio-format";

interface SmartAction {
  icon: IconName;
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
  t: Translate,
): string | null {
  if (route?.destination) return route.destination;
  if (trip?.destination) return trip.destination;
  // Varsayılan gezi adı ("Seyahat Rotası" / çevirisi) hedef sayılmaz.
  if (
    trip?.title &&
    !trip.title.includes("Seyahat") &&
    trip.title !== t("studio.trip.defaultTitle", "Seyahat Rotası")
  )
    return trip.title;
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return lastUser?.text?.slice(0, 40) || null;
}

function buildActions(
  messages: ChatMessage[],
  route: UnifiedRoutePlan | null,
  trip: Trip | null,
  t: Translate,
): SmartAction[] {
  const dest = getDestination(route, trip, messages, t);
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const hasRoute = !!route;
  const hasStays = !!lastAssistant?.stayAndTransit;
  const hasDiscovery = !!lastAssistant?.discovery;
  const msgCount = messages.length;

  if (msgCount === 0) return [];

  const a = (
    icon: IconName,
    id: string,
    label: string,
    prompt: string,
    category: SmartAction["category"],
  ): SmartAction => ({
    icon,
    label: t(`studio.smart.${id}`, label),
    prompt: fill(t(`studio.smart.${id}.prompt`, prompt), { dest: dest ?? "" }),
    category,
  });
  const actions: SmartAction[] = [];

  if (hasRoute && dest) {
    actions.push(
      a(
        "food",
        "dinner",
        "Akşam yemeği ekle",
        "{dest} rotasına akşam için yerel bir restoran ekle",
        "food",
      ),
      a(
        "food",
        "coffee",
        "Kahve molası ekle",
        "Rotadaki duraklara yakın butik kahveciler öner ve araya ekle",
        "food",
      ),
      a(
        "walk",
        "pace",
        "Tempoyu gevşet",
        "Rotayı daha sakin bir tempoya çevir, mola aralarını artır",
        "edit",
      ),
      a(
        "locate",
        "gem",
        "Gizli nokta ekle",
        "{dest} için turistlerin bilmediği yerel bir gizli köşe öner ve rotaya ekle",
        "activity",
      ),
    );
    if (!hasStays) {
      actions.push(
        a(
          "bed",
          "hotel",
          "Otel öner",
          "{dest} rotasına uygun merkezi ve bütçe dostu otel semtleri ve oteller öner",
          "hotel",
        ),
      );
    }
    if (!hasDiscovery) {
      actions.push(
        a(
          "food",
          "local",
          "Yerel lezzetler",
          "{dest} şehrinde mutlaka denenmesi gereken yerel yemekler ve restoranlar neler?",
          "food",
        ),
      );
    }
    actions.push(
      a(
        "sparkle",
        "nightlife",
        "Gece hayatı",
        "{dest} için akşam/gece aktiviteleri ve barlar öner",
        "activity",
      ),
      a(
        "camera",
        "photo",
        "Fotoğraf noktaları",
        "{dest} rotasındaki en iyi fotoğraf ve manzara noktalarını listele",
        "activity",
      ),
    );
  } else if (dest && msgCount >= 2) {
    actions.push(
      a("map", "route", "Rota oluştur", "{dest} için detaylı bir gezi rotası oluştur", "route"),
      a(
        "food",
        "eat",
        "Nerede yenir?",
        "{dest} şehrinde en iyi yerel restoranlar ve sokak yemekleri neler?",
        "food",
      ),
      a(
        "bed",
        "stay",
        "Nerede kalınır?",
        "{dest} için merkezi, güvenli ve bütçe dostu otel bölgeleri ve öneriler",
        "hotel",
      ),
      a(
        "compass",
        "activities",
        "Aktiviteler",
        "{dest} şehrinde yapılabilecek en iyi aktiviteler ve deneyimler neler?",
        "activity",
      ),
    );
  } else {
    actions.push(
      a(
        "compass",
        "popular",
        "Popüler rotalar",
        "Bu sezon en popüler Avrupa şehir rotalarını öner",
        "route",
      ),
      a(
        "coin",
        "budget",
        "Bütçe dostu gezi",
        "500€ altı bütçeyle 3 günlük bir şehir gezisi planla",
        "route",
      ),
      a(
        "users",
        "family",
        "Aile gezisi",
        "Çocuklarla gidilebilecek eğlenceli ve güvenli bir şehir öner",
        "route",
      ),
      a(
        "plane",
        "weekend",
        "Hafta sonu kaçamağı",
        "Bu hafta sonu için 2 günlük kısa bir kaçamak planla",
        "route",
      ),
    );
  }

  return actions.slice(0, 6);
}

export function SmartActions({ messages, route, currentTrip, onAction, busy }: SmartActionsProps) {
  const { t } = useLocale();
  const actions = buildActions(messages, route, currentTrip, t);

  if (actions.length === 0) return null;

  return (
    <div className="as-studio-actions">
      <p className="as-studio-actions__title" id="as-studio-actions-title">
        <Icon name="sparkle" size={16} />
        {t("studio.smart.title", "Hızlı işlemler")}
      </p>
      <ul className="as-studio-actions__list" aria-labelledby="as-studio-actions-title">
        {actions.map((action) => (
          <li key={action.prompt}>
            <button
              type="button"
              className="as-studio-action"
              data-category={action.category}
              onClick={() => onAction(action.prompt)}
              disabled={busy}
              title={action.prompt}
            >
              <Icon name={action.icon} size={16} />
              <span>{action.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
