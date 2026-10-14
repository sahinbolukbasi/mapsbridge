import type { UnifiedRoutePlanDto } from "@mapsbridge/contracts";

export interface AIChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

export interface RoutePlanPreferences {
  pace?: "relaxed" | "moderate" | "fast";
  budget?: "budget" | "moderate" | "luxury";
  travelStyle?: string;
  interests?: string[];
}

export interface AIConversationContext {
  conversationId: string;
  userId: string;
  messages: AIChatMessage[];
  preferences: RoutePlanPreferences;
  currentRoute?: UnifiedRoutePlanDto;
  lastActiveTimestamp: number;
}

export interface AIRouteRequest {
  prompt: string;
  conversationId?: string;
  destination?: string;
  days?: number;
  preferences?: RoutePlanPreferences;
}

export interface AIRouteResponse {
  conversationId: string;
  replyText: string;
  routePlan?: UnifiedRoutePlanDto;
  creditsCharged: number;
  requiresClarification: boolean;
}
