import type {
  UnifiedRoutePlan,
  NearbyPin,
  StayAndTransitInfo,
  LocalDiscoveryInfo,
  EmergencyInfo,
  FlightPriceInfo,
  TravelAdvisoryInfo,
  RouteStop,
} from "./types";

export interface QuickReplyOption {
  label: string;
  prompt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  decisionSummary?: string[];
  route?: UnifiedRoutePlan;
  nearbyPins?: NearbyPin[];
  stayAndTransit?: StayAndTransitInfo;
  discovery?: LocalDiscoveryInfo;
  emergency?: EmergencyInfo;
  flightPrices?: FlightPriceInfo;
  travelAdvisory?: TravelAdvisoryInfo;
  quickReplies?: Array<string | QuickReplyOption>;
  actions?: Array<{ type: string; payload: any }>;
}

export function conversationHistory(messages: ChatMessage[]) {
  return messages.slice(-6).map(message => ({
    role: message.role,
    content: `${message.text}${message.route ? `\nRota: ${message.route.destination}; ${message.route.estimatedDays} gün; ${message.route.stops.map((stop: RouteStop) => `${stop.day}. gün: ${stop.name}`).join('; ')}` : ''}`.slice(0, 1500)
  }));
}

export function planText(route: UnifiedRoutePlan) {
  return [
    route.title,
    route.destination,
    route.summary,
    ...Array.from({ length: route.estimatedDays }, (_, i) => `${i + 1}. Gün\n${route.stops.filter((stop: RouteStop) => stop.day === i + 1).map((stop: RouteStop) => `• ${stop.name} — ${stop.suggestedDuration}\n${stop.description}`).join('\n\n')}`)
  ].join('\n\n');
}

export function shouldRecheckRequest(error: { status?: number; code?: string } | null | undefined): boolean {
  return !error?.status || [408, 500, 502, 503, 504].includes(error.status) || error.code === 'REQUEST_IN_PROGRESS';
}
