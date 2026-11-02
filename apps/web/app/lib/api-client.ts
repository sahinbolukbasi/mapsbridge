/**
 * MapsBridge Centralized API Client (Zero-Idle Serverless Architecture)
 * - Automatic Cognito JWT Bearer token injection
 * - Silent token refresh on 401
 * - Direct-to-S3 Pre-signed Media Uploads (0 Lambda runtime cost for large files)
 * - Offline-first fallback resiliency
 */

import { getStoredSession, refreshSession, isTokenExpired } from "./cognito";

export const API_ENDPOINT = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://0duy2hfjd2.execute-api.eu-central-1.amazonaws.com"
).replace(/\/$/, "");

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
  skipAuth?: boolean;
}

export interface ApiResponseError {
  status: number;
  message: string;
  code?: string;
  upgradeUrl?: string;
}

/**
 * Base fetcher with JWT injection, automatic retry on token expiry, and timeout
 */
export async function apiFetch<T>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
  const { timeoutMs = 12000, skipAuth = false, headers: customHeaders, ...fetchOptions } = options;

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_ENDPOINT}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...((customHeaders as Record<string, string>) || {}),
  };

  if (!skipAuth) {
    let session = getStoredSession();
    if (session?.token && typeof isTokenExpired === "function" && isTokenExpired(session.token)) {
      try {
        const refreshed = await refreshSession();
        if (refreshed?.token) {
          session = { token: refreshed.token, email: session.email };
        }
      } catch (refreshErr) {
        if (typeof window !== "undefined" && window.dispatchEvent) {
          window.dispatchEvent(
            new CustomEvent("mapsbridge:token-refresh-failed", { detail: { error: refreshErr } }),
          );
        }
      }
    }
    if (session?.token) {
      headers["Authorization"] = `Bearer ${session.token}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error("İstek zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edin.");
    }
    throw new Error("Sunucuya erişilemedi. Çevrimdışı modda çalışılıyor.");
  }

  // Handle 401 Unauthorized (attempt token refresh once)
  if (response.status === 401 && !skipAuth) {
    const refreshed = await refreshSession();
    const fallback = getStoredSession();
    const newToken = refreshed?.token || fallback?.token;
    if (newToken && headers["Authorization"] !== `Bearer ${newToken}`) {
      headers["Authorization"] = `Bearer ${newToken}`;
      try {
        response = await fetch(url, {
          ...fetchOptions,
          headers,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        // The authenticated retry may have committed a mutation before the
        // connection failed. Do not report the original 401 as its outcome.
        throw new Error("Sunucu yanıtı alınamadı. İşlemin sonucunu tekrar kontrol edin.");
      }
    } else if (!refreshed?.token) {
      // Don't sign out on a failed refresh — the token may still be valid
      // for requests that aren't caught by isTokenExpired (e.g. Google access tokens).
      // The UI auth guard will handle showing the login prompt when needed.
      window.dispatchEvent(new CustomEvent("mapsbridge:session-expired"));
    }
  }

  if (!response.ok) {
    let errorData: { error?: string; code?: string; upgradeUrl?: string } | null;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: response.statusText };
    }

    const apiError: ApiResponseError = {
      status: response.status,
      message: errorData?.error || `İşlem başarısız oldu (${response.status})`,
      code: errorData?.code,
      upgradeUrl: errorData?.upgradeUrl,
    };
    throw apiError;
  }

  // Check if response is empty (e.g. 204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

// ─── Route Domain Services ──────────────────────────────────────────────────

export interface RouteStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category?: string;
  address?: string;
  day?: number;
  note?: string;
  photos?: string[];
  suggestedDuration?: number;
}

export interface RouteEntity {
  routeId: string;
  name: string;
  stops: RouteStop[];
  days?: Record<string, unknown>[];
  isPublic?: boolean;
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
}

export const routesApi = {
  async list(): Promise<{ routes: RouteEntity[] }> {
    return apiFetch<{ routes: RouteEntity[] }>("/routes");
  },

  async get(id: string): Promise<RouteEntity> {
    return apiFetch<RouteEntity>(`/routes/${encodeURIComponent(id)}`);
  },

  async create(data: {
    name: string;
    stops: RouteStop[];
    days?: Record<string, unknown>[];
    isPublic?: boolean;
    tier?: string;
  }): Promise<{ routeId: string; name: string }> {
    return apiFetch<{ routeId: string; name: string }>("/routes", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async update(
    id: string,
    data: {
      name?: string;
      stops?: RouteStop[];
      days?: Record<string, unknown>[];
      isPublic?: boolean;
    },
  ): Promise<{ routeId: string; status: string }> {
    return apiFetch<{ routeId: string; status: string }>(`/routes/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<{ status: string }> {
    return apiFetch<{ status: string }>(`/routes/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async share(
    id: string,
    expiresInHours = 48,
  ): Promise<{ shareCode: string; expiresAt: number; url: string }> {
    return apiFetch<{ shareCode: string; expiresAt: number; url: string }>(
      `/routes/${encodeURIComponent(id)}/share`,
      {
        method: "POST",
        body: JSON.stringify({ expiresInHours }),
      },
    );
  },

  async readShare(code: string): Promise<unknown> {
    return apiFetch<unknown>(`/shares/${encodeURIComponent(code.trim())}`, { skipAuth: true });
  },

  async getOsrmRoute(
    profile: "driving" | "walking" | "cycling",
    coordinatesStr: string,
  ): Promise<unknown> {
    return apiFetch<unknown>(
      `/routes/osrm/${profile}?coords=${encodeURIComponent(coordinatesStr)}`,
      {
        skipAuth: true,
      },
    );
  },
};

// ─── Pre-signed S3 Media Upload Service ──────────────────────────────────────

export interface PresignUploadResponse {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
  expiresInSeconds: number;
}

export const mediaApi = {
  /**
   * Request a 5-minute pre-signed S3 PUT URL
   */
  async getPresignedUpload(
    fileName: string,
    contentType: string,
    category: "avatars" | "route-covers" | "traveler-photos" = "traveler-photos",
  ): Promise<PresignUploadResponse> {
    const params = new URLSearchParams({ fileName, contentType, category });
    return apiFetch<PresignUploadResponse>(`/media/presign-upload?${params.toString()}`);
  },

  /**
   * Directly uploads a file to S3 using a pre-signed URL (zero Lambda compute cost)
   */
  async uploadDirectlyToS3(
    file: File,
    category: "avatars" | "route-covers" | "traveler-photos" = "traveler-photos",
  ): Promise<string> {
    const presign = await this.getPresignedUpload(file.name, file.type, category);

    const uploadResponse = await fetch(presign.uploadUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type,
      },
      signal: AbortSignal.timeout(30000), // 30s upload timeout
    });

    if (!uploadResponse.ok) {
      throw new Error(`Medya yükleme başarısız oldu (${uploadResponse.status}).`);
    }

    return presign.publicUrl;
  },
};

// ─── Chat Domain Services ───────────────────────────────────────────────────

export interface ChatThreadSummary {
  threadId: string;
  title?: string;
  participants: string[];
  lastMessageAt: string;
}

export interface ChatMessageItem {
  id: string;
  senderId: string;
  senderName?: string;
  content: string;
  timestamp: string;
  routeEmbed?: unknown;
  locationPin?: unknown;
}

export const chatApi = {
  async listThreads(): Promise<{ threads: ChatThreadSummary[] }> {
    return apiFetch<{ threads: ChatThreadSummary[] }>("/chat/threads");
  },

  async createThread(
    participants: string[],
    initialMessage?: string,
  ): Promise<{ threadId: string }> {
    return apiFetch<{ threadId: string }>("/chat/threads", {
      method: "POST",
      body: JSON.stringify({ participants, initialMessage }),
    });
  },

  async getMessages(
    threadId: string,
    limit = 50,
    cursor?: string,
  ): Promise<{ messages: ChatMessageItem[]; nextCursor?: string }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return apiFetch<{ messages: ChatMessageItem[]; nextCursor?: string }>(
      `/chat/threads/${encodeURIComponent(threadId)}/messages?${params.toString()}`,
    );
  },

  async sendMessage(
    threadId: string,
    content: string,
    embeds?: { routeEmbed?: unknown; locationPin?: unknown },
  ): Promise<{ messageId: string; timestamp: string }> {
    return apiFetch<{ messageId: string; timestamp: string }>(
      `/chat/threads/${encodeURIComponent(threadId)}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ content, ...embeds }),
      },
    );
  },
};

// ─── Admin Domain Services ──────────────────────────────────────────────────

export interface AdminMetrics {
  totalUsers: number;
  activeSubscriptions: number;
  totalGuides: number;
  todayPayments: number;
  timestamp: string;
}

export interface AdminUserItem {
  PK?: string;
  SK?: string;
  sub?: string;
  userId?: string;
  email?: string;
  name?: string;
  role?: string;
  suspended?: boolean;
  suspendedAt?: string;
  suspendReason?: string;
  createdAt?: string;
  routesCount?: number;
  tier?: string;
}

export interface AdminFinanceData {
  totalRevenueTRY: number;
  totalTransactions: number;
  failedTransactions: number;
  monthlyRevenue: Array<{ month: string; amount: number }>;
  currency: string;
}

export interface AdminPaymentItem {
  PK?: string;
  SK?: string;
  id?: string;
  paymentIntentId?: string;
  userId?: string;
  amount: number;
  status: "succeeded" | "pending" | "failed" | "refunded";
  type?: string;
  createdAt: string;
  reason?: string;
}

export interface AdminServiceHealth {
  status: string;
  latencyMs?: number;
  table?: string;
  poolId?: string;
  model?: string;
  engine?: string;
  provider?: string;
  protocol?: string;
}

export interface AdminSystemHealthData {
  status: "operational" | "degraded" | "outage";
  timestamp: string;
  environment: string;
  region: string;
  services: Record<string, AdminServiceHealth>;
}

export interface AdminReportItem {
  PK?: string;
  SK?: string;
  reportId: string;
  reporterSub?: string;
  contentType: "route" | "message" | "user" | "post";
  contentId: string;
  reason: string;
  status: "pending" | "resolved" | "dismissed";
  createdAt: string;
  resolvedAt?: string;
  resolutionAction?: string;
  resolutionNotes?: string;
}

export interface AdminAuditItem {
  PK?: string;
  SK?: string;
  auditId: string;
  actorSub: string;
  action: string;
  targetId: string;
  reason: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface AdminTokenUsage {
  note: string;
  totalInvocations: number;
  estimatedTokensMonth: number;
  activeModels: Array<{ modelId: string; name: string; calls: number; avgLatencyMs: number }>;
  quotaUtilizationPct: number;
}

export interface AdminModuleConfig {
  mapEnabled: boolean;
  aiEnabled: boolean;
  communityEnabled: boolean;
  messagingEnabled: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface AdminCreditStats {
  totalCreditsGranted: number;
  totalCreditsConsumed: number;
  totalCreditsRemaining: number;
  activeWallets: number;
  averageBalancePerUser: number;
  dailyConsumption: Array<{ date: string; consumed: number; granted: number }>;
  byModule: {
    ai_chat: number;
    ai_deep_trip: number;
    ai_stay_dining: number;
    route_optimize: number;
  };
  topConsumers: Array<{ userId: string; email?: string; consumed: number; tier: string }>;
  planDistribution: Array<{ tier: string; userCount: number; avgCredits: number }>;
}

export interface AdminStripeConfig {
  connected: boolean;
  mode: "test" | "live" | "unconfigured";
  publishableKey?: string;
  webhookConfigured: boolean;
  webhookUrl?: string;
  lastWebhookAt?: string;
  supportedCurrencies: string[];
  defaultCurrency: string;
  taxEnabled: boolean;
  version: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface AdminPlanConfig {
  id: string;
  name: string;
  tagline: string;
  badge?: string;
  monthlyPriceTry: number;
  yearlyPriceTry: number;
  monthlyCredits: number;
  color: string;
  highlight?: boolean;
  enabled: boolean;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  activeSubscribers: number;
}

export interface AdminCreditPackConfig {
  id: string;
  title: string;
  credits: number;
  bonusCredits: number;
  priceTry: number;
  unitPriceTry: number;
  description: string;
  popular?: boolean;
  badge?: string;
  enabled: boolean;
  stripeProductId?: string;
  totalPurchases: number;
}

export const adminApi = {
  async getMetrics(): Promise<{ metrics: AdminMetrics }> {
    return apiFetch<{ metrics: AdminMetrics }>("/admin/metrics");
  },

  async listUsers(params?: {
    limit?: number;
    cursor?: string;
  }): Promise<{ users: AdminUserItem[]; count: number; nextCursor?: string | null }> {
    const search = new URLSearchParams();
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.cursor) search.set("cursor", params.cursor);
    const qs = search.toString();
    return apiFetch<{ users: AdminUserItem[]; count: number; nextCursor?: string | null }>(
      `/admin/users${qs ? `?${qs}` : ""}`,
    );
  },

  async suspendUser(
    userId: string,
    reason: string,
  ): Promise<{ status: string; userId: string; reason: string }> {
    return apiFetch<{ status: string; userId: string; reason: string }>(
      `/admin/users/${encodeURIComponent(userId)}/suspend`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
      },
    );
  },

  async unsuspendUser(
    userId: string,
    reason: string,
  ): Promise<{ status: string; userId: string; reason: string }> {
    return apiFetch<{ status: string; userId: string; reason: string }>(
      `/admin/users/${encodeURIComponent(userId)}/unsuspend`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
      },
    );
  },

  async getFinance(): Promise<{ finance: AdminFinanceData }> {
    return apiFetch<{ finance: AdminFinanceData }>("/admin/finance");
  },

  async listPayments(params?: {
    limit?: number;
    status?: string;
  }): Promise<{ payments: AdminPaymentItem[]; count: number }> {
    const search = new URLSearchParams();
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.status) search.set("status", params.status);
    const qs = search.toString();
    return apiFetch<{ payments: AdminPaymentItem[]; count: number }>(
      `/admin/payments${qs ? `?${qs}` : ""}`,
    );
  },

  async refundPayment(
    userId: string,
    paymentIntentId: string,
    reason: string,
  ): Promise<{ status: string; refundId: string; amount: number }> {
    return apiFetch<{ status: string; refundId: string; amount: number }>(
      `/admin/users/${encodeURIComponent(userId)}/refund`,
      {
        method: "POST",
        body: JSON.stringify({ paymentIntentId, reason }),
      },
    );
  },

  async getTokenUsage(): Promise<{ usage: AdminTokenUsage }> {
    return apiFetch<{ usage: AdminTokenUsage }>("/admin/token-usage");
  },

  async getSystemHealth(): Promise<{ health: AdminSystemHealthData }> {
    return apiFetch<{ health: AdminSystemHealthData }>("/admin/system-health");
  },

  async listReports(status?: string): Promise<{ reports: AdminReportItem[]; count: number }> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiFetch<{ reports: AdminReportItem[]; count: number }>(`/admin/reports${qs}`);
  },

  async resolveReport(
    reportId: string,
    action: "dismiss" | "hide_content" | "suspend_user",
    notes: string,
  ): Promise<{ status: string; reportId: string; action: string }> {
    return apiFetch<{ status: string; reportId: string; action: string }>(
      `/admin/reports/${encodeURIComponent(reportId)}/resolve`,
      {
        method: "POST",
        body: JSON.stringify({ action, notes }),
      },
    );
  },

  async getAuditLogs(limit = 50): Promise<{ logs: AdminAuditItem[]; count: number }> {
    return apiFetch<{ logs: AdminAuditItem[]; count: number }>(`/admin/audit-logs?limit=${limit}`);
  },

  async getRealtimeTelemetry(): Promise<{ realtime: unknown }> {
    return apiFetch<{ realtime: unknown }>("/admin/realtime");
  },

  async listAdminRoutes(limit = 50): Promise<{ routes: Record<string, unknown>[]; count: number }> {
    return apiFetch<{ routes: Record<string, unknown>[]; count: number }>(
      `/admin/routes?limit=${limit}`,
    );
  },

  async routeAction(
    routeId: string,
    action: "approve" | "feature" | "suspend",
    reason?: string,
  ): Promise<{ status: string; routeId: string; action: string }> {
    return apiFetch<{ status: string; routeId: string; action: string }>(
      `/admin/routes/${encodeURIComponent(routeId)}/action`,
      {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      },
    );
  },

  async getSystemConfig(): Promise<{
    config: {
      maintenanceMode: boolean;
      reason?: string;
      version?: number;
      maintenanceMessage?: string;
      routeCreationEnabled?: boolean;
      sharesEnabled?: boolean;
      moduleConfig?: AdminModuleConfig;
    };
  }> {
    return apiFetch("/admin/system-config");
  },

  async updateSystemConfig(values: Record<string, unknown>): Promise<{ status: string }> {
    return apiFetch<{ status: string }>("/admin/system-config", {
      method: "POST",
      body: JSON.stringify(values),
    });
  },

  async getModuleConfig(): Promise<{ moduleConfig: AdminModuleConfig }> {
    return apiFetch<{ moduleConfig: AdminModuleConfig }>("/admin/module-config");
  },

  async updateModuleConfig(
    config: Partial<AdminModuleConfig>,
    reason: string,
  ): Promise<{ status: string; moduleConfig: AdminModuleConfig }> {
    return apiFetch<{ status: string; moduleConfig: AdminModuleConfig }>("/admin/module-config", {
      method: "POST",
      body: JSON.stringify({ ...config, reason }),
    });
  },

  async getCreditStats(): Promise<{ stats: AdminCreditStats }> {
    return apiFetch<{ stats: AdminCreditStats }>("/admin/credit-stats");
  },

  async getStripeConfig(): Promise<{ stripe: AdminStripeConfig }> {
    return apiFetch<{ stripe: AdminStripeConfig }>("/admin/stripe-config");
  },

  async updateStripeConfig(
    config: Partial<AdminStripeConfig> & { reason: string },
  ): Promise<{ status: string; stripe: AdminStripeConfig }> {
    return apiFetch<{ status: string; stripe: AdminStripeConfig }>("/admin/stripe-config", {
      method: "POST",
      body: JSON.stringify(config),
    });
  },

  async getPlans(): Promise<{ plans: AdminPlanConfig[] }> {
    return apiFetch<{ plans: AdminPlanConfig[] }>("/admin/plans");
  },

  async updatePlan(
    planId: string,
    updates: Partial<AdminPlanConfig> & { reason: string },
  ): Promise<{ status: string; plan: AdminPlanConfig }> {
    return apiFetch<{ status: string; plan: AdminPlanConfig }>(
      `/admin/plans/${encodeURIComponent(planId)}`,
      {
        method: "POST",
        body: JSON.stringify(updates),
      },
    );
  },

  async getCreditPacks(): Promise<{ packs: AdminCreditPackConfig[] }> {
    return apiFetch<{ packs: AdminCreditPackConfig[] }>("/admin/credit-packs");
  },

  async updateCreditPack(
    packId: string,
    updates: Partial<AdminCreditPackConfig> & { reason: string },
  ): Promise<{ status: string; pack: AdminCreditPackConfig }> {
    return apiFetch<{ status: string; pack: AdminCreditPackConfig }>(
      `/admin/credit-packs/${encodeURIComponent(packId)}`,
      {
        method: "POST",
        body: JSON.stringify(updates),
      },
    );
  },
};
