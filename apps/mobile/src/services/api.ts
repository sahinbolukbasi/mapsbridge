import { storage } from "./storage";

// Canlı API Gateway. Derleme anında EXPO_PUBLIC_API_BASE_URL ile ezilir (app.config.ts
// extra.apiBaseUrl aynı değeri taşır). Eski varsayılan host NXDOMAIN veriyordu (diagnosis LB §8).
export const LIVE_API_BASE = "https://pwi1j8mq0j.execute-api.eu-central-1.amazonaws.com";
export const API_BASE = (
  (typeof process !== "undefined" ? process.env.EXPO_PUBLIC_API_BASE_URL : undefined) ||
  LIVE_API_BASE
).replace(/\/$/, "");
const COGNITO_REGION = "eu-central-1";
const COGNITO_CLIENT_ID = "62t35qsehl3o9cdc6i4mg01tqt";
const COGNITO_ENDPOINT = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`;

export interface UserSession {
  token: string;
  email: string;
  name?: string;
}

export interface RouteStop {
  id: string;
  name: string;
  category?: string;
  lat: number;
  lng: number;
  address?: string;
  duration?: string;
  day?: number;
  timeSlot?: string;
}

export interface RouteEntity {
  routeId: string;
  name: string;
  stops: RouteStop[];
  createdAt?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
}

// ─── Cognito Low-Level Requester ─────────────────────────────────────────────
async function cognitoRequest(target: string, body: Record<string, unknown>) {
  const response = await fetch(COGNITO_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify({ ClientId: COGNITO_CLIENT_ID, ...body }),
  });
  const data = await response.json();
  if (!response.ok) {
    const errorType = data.__type || "";
    const msg = data.message || "İşlem tamamlanamadı.";
    if (
      errorType.includes("NotAuthorizedException") ||
      msg.includes("Incorrect username or password")
    ) {
      throw new Error("E-posta veya şifre hatalı. Lütfen tekrar deneyin.");
    }
    if (errorType.includes("UserNotFoundException")) {
      throw new Error("Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.");
    }
    if (errorType.includes("CodeMismatchException")) {
      throw new Error("Doğrulama kodu hatalı.");
    }
    if (errorType.includes("ExpiredCodeException")) {
      throw new Error("Doğrulama kodunun süresi dolmuş. Lütfen yeniden talep edin.");
    }
    throw new Error(msg);
  }
  return data;
}

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Auth Services ───────────────────────────────────────────────────────────
export const authService = {
  async signIn(email: string, pass: string): Promise<UserSession> {
    const cleanEmail = email.trim().toLowerCase();
    const data = await cognitoRequest("InitiateAuth", {
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: cleanEmail, PASSWORD: pass },
    });
    const result = data.AuthenticationResult;
    if (!result?.AccessToken) {
      throw new Error("Giriş başarısız. Oturum anahtarı alınamadı.");
    }
    const session: UserSession = {
      token: result.AccessToken,
      email: cleanEmail,
      name: cleanEmail.split("@")[0],
    };
    await storage.setItem("mb_token", session.token);
    await storage.setItem("mb_email", session.email);
    await storage.setItem("mb_last_activity", Date.now().toString());
    if (session.name) await storage.setItem("mb_name", session.name);
    // Persist refresh token for silent re-auth (never expires unless revoked)
    if (result.RefreshToken) {
      await storage.setItem("mb_refresh_token", result.RefreshToken);
    }
    return session;
  },

  async signUp(email: string, pass: string, name: string, phone: string = "+905550000000") {
    const cleanEmail = email.trim().toLowerCase();
    return cognitoRequest("SignUp", {
      Username: cleanEmail,
      Password: pass,
      UserAttributes: [
        { Name: "email", Value: cleanEmail },
        { Name: "name", Value: name.trim() },
        { Name: "phone_number", Value: phone.trim() },
      ],
    });
  },

  async confirmSignUp(email: string, code: string) {
    return cognitoRequest("ConfirmSignUp", {
      Username: email.trim().toLowerCase(),
      ConfirmationCode: code.trim(),
    });
  },

  async forgotPassword(email: string) {
    return cognitoRequest("ForgotPassword", {
      Username: email.trim().toLowerCase(),
    });
  },

  async confirmForgotPassword(email: string, code: string, newPass: string) {
    return cognitoRequest("ConfirmForgotPassword", {
      Username: email.trim().toLowerCase(),
      ConfirmationCode: code.trim(),
      Password: newPass,
    });
  },

  async getSession(): Promise<UserSession | null> {
    const token = await storage.getItem("mb_token");
    const email = await storage.getItem("mb_email");
    const name = await storage.getItem("mb_name");
    if (!token || !email) return null;
    return { token, email, name: name || email.split("@")[0] };
  },

  async refreshToken(): Promise<string | null> {
    const refreshToken = await storage.getItem("mb_refresh_token");
    if (!refreshToken) return null;

    try {
      const response = await fetch(COGNITO_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/x-amz-json-1.1",
          "x-amz-target": "AWSCognitoIdentityProviderService.InitiateAuth",
        },
        body: JSON.stringify({
          AuthFlow: "REFRESH_TOKEN_AUTH",
          ClientId: COGNITO_CLIENT_ID,
          AuthParameters: { REFRESH_TOKEN: refreshToken },
        }),
      });

      if (!response.ok) {
        console.warn("[authService] Refresh token request rejected with status:", response.status);
        return null;
      }

      const data = await response.json();
      const newToken = data.AuthenticationResult?.AccessToken;
      if (newToken) {
        await storage.setItem("mb_token", newToken);
        await storage.setItem("mb_last_activity", Date.now().toString());
        return newToken;
      }
    } catch (e) {
      console.warn("[authService] Refresh token failed:", e);
    }
    return null;
  },

  async signOut(): Promise<void> {
    await storage.removeItem("mb_token");
    await storage.removeItem("mb_email");
    await storage.removeItem("mb_name");
    await storage.removeItem("mb_refresh_token");
    await storage.removeItem("mb_last_activity");
  },
};

// ─── Backend API Client ──────────────────────────────────────────────────────
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const session = await authService.getSession();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  try {
    let response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Attempt silent token refresh once
      const refreshedToken = await authService.refreshToken();
      if (refreshedToken) {
        headers["Authorization"] = `Bearer ${refreshedToken}`;
        response = await fetch(`${API_BASE}${endpoint}`, {
          ...options,
          headers,
        });
      } else {
        console.warn(
          "[apiRequest] 401 response and token refresh unavailable. Preserving local session.",
        );
        throw new Error(
          "Oturum anahtarınız güncellenemedi. Lütfen internet bağlantınızı kontrol edin.",
        );
      }
    }

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("Bu işlem için yetkiniz bulunmuyor.");
      }
      if (response.status === 429) {
        throw new Error("Çok fazla istek gönderildi. Lütfen biraz bekleyin.");
      }

      const err = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(err.error || `İstek başarısız (${response.status})`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error("İnternet bağlantısı yok. Lütfen bağlantınızı kontrol edin.");
    }
    throw error;
  }
}

// ─── Synchronized Routes API ────────────────────────────────────────────────
export const routeService = {
  async listRoutes(): Promise<RouteEntity[]> {
    try {
      const data = await apiRequest<{ routes: RouteEntity[] }>("/routes");
      if (data?.routes) {
        await storage.setItem("cached_routes", JSON.stringify(data.routes));
        return data.routes;
      }
    } catch {
      // Offline fallback: load from cached routes
      const cached = await storage.getItem("cached_routes");
      if (cached) return JSON.parse(cached);
    }
    return [];
  },

  async createRoute(name: string, stops: RouteStop[]): Promise<RouteEntity> {
    const payload = {
      name,
      stops: stops.map((s, i) => ({
        id: s.id || `stop-${Date.now()}-${i}`,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        category: s.category || "Gezi",
        address: s.address || "",
      })),
      isPublic: true,
    };
    const res = await apiRequest<{ routeId: string; name: string }>("/routes", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return {
      routeId: res.routeId,
      name: res.name || name,
      stops,
      createdAt: new Date().toISOString(),
    };
  },

  async getRoute(id: string): Promise<RouteEntity> {
    return apiRequest<RouteEntity>(`/routes/${encodeURIComponent(id)}`);
  },

  async updateRoute(
    id: string,
    name: string,
    stops: RouteStop[],
  ): Promise<{ routeId: string; status: string }> {
    return apiRequest<{ routeId: string; status: string }>(`/routes/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ name, stops }),
    });
  },

  async deleteRoute(id: string): Promise<{ status: string }> {
    return apiRequest<{ status: string }>(`/routes/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
};

// ─── AI Assistant Service (AWS Bedrock & Agent Core) ─────────────────────────
export interface AISubAgentExecution {
  agentId: string;
  agentName: string;
  icon: string;
  status: "completed" | "skipped" | "failed";
  durationMs?: number;
}

// Mirrors apps/web/app/lib/ai/context-chips.ts ContextChip
export interface AIContextChip {
  id: string;
  label: string;
  prompt: string;
  icon?: string;
  scope?: "trip" | "day" | "place" | "topic";
}

// Subset of apps/web/app/lib/ai/types.ts FeasibilityIssue
export interface AIFeasibilityIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  day?: number;
  suggestedFix?: string;
}

export interface AIFeasibilityReport {
  isValid: boolean;
  score: number;
  issues: AIFeasibilityIssue[];
}

// Mirrors apps/web/app/lib/ai/itinerary-actions.ts ItineraryActionPayload
export interface AIItineraryAction {
  action: "add" | "remove" | "reorder" | "move_to_day" | "pin" | "unpin";
  placeId?: string;
  placeName?: string;
  day?: number;
  toDay?: number;
  newOrder?: string[];
}

// Mirrors apps/web/app/lib/ai/focus-manager.ts ThreadFocus
export interface AIThreadFocus {
  scope: "trip" | "day" | "place" | "topic";
  dayNumber?: number;
  placeId?: string;
  placeLabel?: string;
  turn: number;
}

// Simplified ConversationState to carry between turns (mirrors web ConversationState)
export interface MobileConversationState {
  version: number;
  answeredSlots?: Array<{ slot: string; value: unknown; turn: number }>;
  focus?: AIThreadFocus;
  turn?: number;
  // Opaque context blob echoed back from backend — never modified by mobile
  context?: Record<string, unknown>;
  profile?: Record<string, unknown>;
}

export interface AIAskContext {
  requestId?: string;
  trainingConsent?: boolean;
  conversationId?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  /** Full conversation state from previous turn — enables slot tracking and focus continuity */
  conversationState?: MobileConversationState;
  city?: string;
  intent?: string;
  userLocation?: { lat: number; lng: number };
}

export interface AIAskResponse {
  answer: string;
  responseMode?: "clarify" | "chat" | "route";
  provider?: string;
  modelUsed?: string;
  stops?: RouteStop[];
  isRoutePlan?: boolean;
  routeTitle?: string;
  estimatedDays?: number;
  totalDistanceKm?: number;
  agentsInvolved?: AISubAgentExecution[];
  stayAndTransit?: {
    lodgingSummary?: string;
    transitSummary?: string;
    neighborhoodTips?: string;
  };
  discovery?: {
    foodHighlights?: string;
    hiddenGems?: string;
    culturalTips?: string;
  };
  emergency?: {
    emergencyNumbers?: string;
    embassy?: string;
  };
  flightPrices?: {
    destination: string;
    deals: Array<{
      origin: string;
      destination: string;
      price: number;
      currency: string;
      departureMonth?: string;
      affiliateLink: string;
      expiresAt: string;
    }>;
    cheapestPrice?: number;
    cheapestCurrency?: string;
    note: string;
    source: "travelpayouts_cache" | "unavailable";
    checkedAt: string;
  };
  travelAdvisory?: {
    country: string;
    countrySlug: string;
    level: "normal" | "some_risk" | "avoid_non_essential" | "avoid";
    levelLabel: string;
    summary: string;
    lastChecked: string;
    changeNote?: string;
    sourceUrl: string;
    disclaimer: string;
  };
  clarification?: {
    isUnderspecified?: boolean;
    message?: string;
    guidingQuestions?: string[];
    quickOptions?: Array<string | { label: string; prompt: string }>;
  };
  /** Focus-aware action chips from backend (§12.2) — prefer over clarification.quickOptions */
  suggestedChips?: AIContextChip[];
  /** Itinerary mutations the model applied this turn (§12.5) */
  itineraryActions?: AIItineraryAction[];
  /** Active conversation focus echoed back from backend */
  currentFocus?: AIThreadFocus;
  /** Feasibility issues for the current plan (§11.1) */
  feasibility?: AIFeasibilityReport;
  /** Updated conversation state — must be passed back on next turn */
  conversationState?: MobileConversationState;
  /** Trip profile extracted so far */
  tripProfile?: Record<string, unknown>;
  /** Visible assumptions the model made when filling missing info */
  assumptions?: string[];
  suggestedQuestions?: string[];
  creditsUsed?: number;
  remainingCredits?: number;
  conversationId?: string;
}

export const aiService = {
  async ask(prompt: string, context?: AIAskContext): Promise<AIAskResponse> {
    const conversationId = context?.conversationId || generateUUID();
    const requestId = context?.requestId || generateUUID();

    // Prepare history conforming to backend requirements (max 6 items, valid role & string content)
    const history = (context?.history || [])
      .slice(-6)
      .filter(
        (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
      )
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));

    const body: Record<string, unknown> = {
      prompt: prompt.slice(0, 2000),
      requestId,
      conversationId,
      conversationHistory: history,
      trainingConsent: context?.trainingConsent === true,
      ...(context?.userLocation ? { userLocation: context.userLocation } : {}),
      // Pass full conversation state so backend can track answered slots and focus
      ...(context?.conversationState ? { conversationState: context.conversationState } : {}),
    };

    const session = await authService.getSession();
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    };

    let res = await fetch(`${API_BASE}/ai/route-planner`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    // Handle 401 silent retry
    if (res.status === 401) {
      const refreshedToken = await authService.refreshToken();
      if (refreshedToken) {
        headers["Authorization"] = `Bearer ${refreshedToken}`;
        res = await fetch(`${API_BASE}/ai/route-planner`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
      }
    }

    if (res.ok) {
      const json = await res.json();
      const routeData = json.route;
      const stops: RouteStop[] = (routeData?.stops || []).map(
        (s: Record<string, any>, idx: number) => ({
          id: s.id || `stop-${idx}`,
          name: s.name,
          category: s.category || "Gezi",
          lat: s.lat,
          lng: s.lng,
          address: s.address || "",
          duration: s.suggestedDuration || s.duration,
          day: s.day,
          timeSlot: s.timeSlot,
        }),
      );

      const isRoute = json.responseMode === "route";
      if (
        isRoute &&
        (!stops.length ||
          stops.some(
            (s) =>
              !Number.isFinite(s.lat) ||
              Math.abs(s.lat) > 90 ||
              !Number.isFinite(s.lng) ||
              Math.abs(s.lng) > 180,
          ))
      ) {
        throw new Error("Rota koordinatları doğrulanamadı.");
      }
      const orchestratorAnswer =
        json.orchestratorSummary || json.answer || json.text || "Seyahat planınız oluşturuldu.";

      return {
        answer: orchestratorAnswer,
        responseMode: json.responseMode || (isRoute ? "route" : "chat"),
        provider: json.provider || "aws_bedrock",
        modelUsed: json.modelUsed,
        stops,
        isRoutePlan: isRoute,
        routeTitle:
          routeData?.title || `${routeData?.destination || context?.city || "Seyahat"} Rotası`,
        estimatedDays: routeData?.estimatedDays || 1,
        totalDistanceKm: routeData?.totalDistanceKm,
        agentsInvolved: json.agentsInvolved || [],
        stayAndTransit: json.stayAndTransit,
        discovery: json.discovery,
        emergency: json.emergency,
        flightPrices: json.flightPrices,
        travelAdvisory: json.travelAdvisory,
        clarification: json.clarification,
        suggestedQuestions: json.suggestedQuestions || json.clarification?.guidingQuestions || [],
        creditsUsed: json.billing?.cost ?? json.cost,
        remainingCredits: json.billing?.credits,
        conversationId,
      };
    } else {
      const errJson = await res.json().catch(() => ({}));
      throw Object.assign(new Error(errJson.error || "AI yanıtı alınamadı."), {
        status: res.status,
        code: errJson.code,
      });
    }
  },

  async getLatestSession(): Promise<{
    conversation?: {
      messages?: Array<{ role: string; content: string }>;
      route?: {
        title?: string;
        destination?: string;
        estimatedDays?: number;
        stops?: Array<{
          id?: string;
          name: string;
          category?: string;
          day?: number;
          timeSlot?: string;
          suggestedDuration?: string;
          duration?: string;
          address?: string;
          lat?: number;
          lng?: number;
        }>;
      };
    };
    latestConversationId?: string;
    conversationId?: string;
  } | null> {
    try {
      return await apiRequest("/ai/route-planner");
    } catch (e) {
      console.warn("[aiService] getLatestSession error:", e);
      return null;
    }
  },

  async getSession(convId: string): Promise<{
    conversation?: {
      messages?: Array<{ role: string; content: string }>;
      route?: {
        title?: string;
        destination?: string;
        estimatedDays?: number;
        stops?: Array<{
          id?: string;
          name: string;
          category?: string;
          day?: number;
          timeSlot?: string;
          suggestedDuration?: string;
          duration?: string;
          address?: string;
          lat?: number;
          lng?: number;
        }>;
      };
    };
    latestConversationId?: string;
    conversationId?: string;
  } | null> {
    try {
      return await apiRequest(`/ai/route-planner?conversationId=${encodeURIComponent(convId)}`);
    } catch (e) {
      console.warn("[aiService] getSession error:", e);
      return null;
    }
  },
};

// ─── Messaging / Chat Service ───────────────────────────────────────────────
export const chatService = {
  async getMessages(): Promise<ChatMessage[]> {
    try {
      const data = await apiRequest<{ messages: Record<string, string>[] }>(
        "/chat/threads/default/messages",
      );
      if (data?.messages?.length) {
        return data.messages.map((m) => ({
          id: m.id || m.messageId || `msg-${Math.random()}`,
          senderId: m.senderId || "user",
          senderName: m.senderName || "Gezgin",
          content: m.content || "",
          timestamp: m.timestamp || new Date().toISOString(),
        }));
      }
    } catch {}

    // Local cached or default messages
    return [
      {
        id: "1",
        senderId: "support",
        senderName: "MapsBridge Ekibi",
        content:
          "Hoş geldiniz! Rotalarınızı arkadaşlarınızla paylaşabilir veya birlikte seyahat planlayabilirsiniz.",
        timestamp: "14:30",
      },
      {
        id: "2",
        senderId: "arda",
        senderName: "Arda (Gezgin)",
        content: "Karaköy ve Galata rotasını denedim, gün batımında kule manzarası harika!",
        timestamp: "15:10",
      },
    ];
  },

  async sendMessage(content: string): Promise<ChatMessage> {
    const session = await authService.getSession();
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: session?.email || "user",
      senderName: session?.name || "Ben",
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    try {
      await apiRequest("/chat/threads/default/messages", {
        method: "POST",
        body: JSON.stringify({ content }),
      });
    } catch {}

    return newMsg;
  },
};

// ─── Mesaj istekleri (Increment 1.14, M1/M2) ────────────────────────────────
// Durum kodu ve sunucu `code` alanı korunur (apiRequest yalnız metin döndürür); istek kapısı
// hataları (404 USER_NOT_FOUND, 409 REQUEST_PENDING, 403 REQUEST_CLOSED) arayüzde gösterilir.
export type ChatApiError = { status: number; code?: string; message: string };
async function chatCall<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const session = await authService.getSession();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      },
    });
  } catch {
    throw { status: 0, message: "İnternet bağlantısı yok." } satisfies ChatApiError;
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok)
    throw {
      status: res.status,
      code: body.code,
      message: body.error || `İstek başarısız (${res.status})`,
    } satisfies ChatApiError;
  return body as T;
}
export type ServerChatThread = {
  threadId: string;
  otherParticipant?: string;
  lastMessageAt?: string;
  request?: { status?: string; from?: string; to?: string };
};
export const chatRequestApi = {
  listThreads: () => chatCall<{ threads?: ServerChatThread[] }>("/chat/threads"),
  createThread: (participantId: string, initialMessage?: string) =>
    chatCall<{ threadId: string }>("/chat/threads", {
      method: "POST",
      body: JSON.stringify({ participantId, initialMessage }),
    }),
  sendMessage: (threadId: string, content: string) =>
    chatCall<{ timestamp: string }>(`/chat/threads/${encodeURIComponent(threadId)}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
  respondRequest: (threadId: string, action: "accept" | "decline" | "block") =>
    chatCall<{ request: string }>(`/chat/threads/${encodeURIComponent(threadId)}/request`, {
      method: "POST",
      body: JSON.stringify({ action }),
    }),
};
// ─── Plan kataloğu (design §7.1, karar S2) ───────────────────────────────────
// Web /pricing/ ile aynı uç: GET /revenuecat/plans (oturumsuz). Ham gövde döner; doğrulama
// src/billing/catalog.ts parseCatalog'dadır. Fiyat yalnızca buradan gösterilir.
export const CATALOG_TIMEOUT_MS = 8000;
export const billingService = {
  async getPlans(): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS);
    try {
      const res = await fetch(`${API_BASE}/revenuecat/plans`, { signal: controller.signal });
      if (!res.ok) throw new Error(`Katalog yüklenemedi (${res.status})`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  },
};

// ─── AI Training & Point Interaction Telemetry ──────────────────────────────
export interface MapInteractionEvent {
  id: string;
  lat: number;
  lng: number;
  name?: string;
  category?: string;
  action: "map_click" | "pin_select" | "route_add" | "search";
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export const trainingService = {
  async recordMapInteraction(event: Omit<MapInteractionEvent, "id" | "timestamp">): Promise<void> {
    const payload: MapInteractionEvent = {
      id: generateUUID(),
      timestamp: new Date().toISOString(),
      ...event,
    };

    // 1. Locally persist dataset for model training buffer
    try {
      const stored = await storage.getItem("mb_training_interactions");
      const list: MapInteractionEvent[] = stored ? JSON.parse(stored) : [];
      list.push(payload);
      if (list.length > 1000) list.shift();
      await storage.setItem("mb_training_interactions", JSON.stringify(list));
    } catch {}

    // 2. Dispatch to backend AI telemetry pipeline only if user has given consent
    const telemetryConsent = await storage.getItem("mb_telemetry_consent");
    if (telemetryConsent !== "true") return;

    try {
      fetch(`${API_BASE}/ai/telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "point_interaction",
          datasetVersion: "v2.4",
          payload,
        }),
      }).catch(() => {});
    } catch {}
  },

  async getRecordedInteractions(): Promise<MapInteractionEvent[]> {
    try {
      const stored = await storage.getItem("mb_training_interactions");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },
};
