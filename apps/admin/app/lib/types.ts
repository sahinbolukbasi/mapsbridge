export type AdminRole = "SUPER_ADMIN" | "admin" | "moderator" | "support";

export interface AdminUser {
  sub: string;
  email: string;
  name: string;
  role: AdminRole;
  mfaEnabled: boolean;
  avatarUrl?: string;
  lastLogin: string;
}

export interface AdminSession {
  token: string;
  user: AdminUser;
  expiresAt: number;
}

export type ActiveAdminTab =
  | "dashboard"
  | "subscriptions"
  | "ai-agentcore"
  | "users"
  | "campaigns"
  | "logs-errors";

// Telemetry & Metrics
export interface AnalyticsData {
  realtime: {
    total: number;
    web: number;
    ios: number;
    android: number;
  };
  dau: {
    total: number;
    web: number;
    ios: number;
    android: number;
  };
  mau: {
    total: number;
    web: number;
    ios: number;
    android: number;
  };
  financials: {
    totalRevenueTry: number;
    mrrTry: number;
    activeSubscriptions: number;
    totalCreditsCirculating: number;
    totalCreditsSpentToday: number;
    llmCostTodayUsd: number;
    netProfitMargin: number;
  };
  systemHealth: {
    apiLatencyMs: number;
    bedrockLatencyMs: number;
    errorRatePercent: number;
    sqsDlqCount: number;
    lambdaStatus: "operational" | "degraded" | "down";
    dynamoStatus: "operational" | "degraded" | "down";
  };
}

// Polar Subscriptions & Credit Ledger
export interface PolarStatus {
  connected: boolean;
  environment: string;
  organizationId: string;
  organizationName: string;
  webhookConfigured: boolean;
  cliAvailable: boolean;
  productsCount: number;
  products: {
    id: string;
    name: string;
    type: "subscription" | "pack";
    price: string;
    credits: number;
  }[];
}

export interface CreditTransaction {
  txId: string;
  userId: string;
  amount: number;
  type: "grant" | "deduct" | "purchase" | "refund" | "promo" | "route_consumption";
  balanceAfter: number;
  reason: string;
  adminActor?: string;
  createdAt: string;
}

export interface PolarWebhookEvent {
  eventId: string;
  eventType: string;
  customerEmail?: string;
  amount?: number;
  currency?: string;
  status: "processed" | "failed" | "ignored";
  summary: string;
  createdAt: string;
}

// AI AgentCore & Harness
export interface AIAgentCoreConfig {
  prompts: {
    systemPrompt: string;
    conciergeGreeting: string;
    behaviorGuidelines: string;
    questionFlow: string;
  };
  routing: {
    fastModel: string;
    routingModel: string;
    postRouteHarnessModel: string;
    temperature: number;
    maxTokens: number;
  };
  tools: {
    placesSearch: boolean;
    weatherCheck: boolean;
    transitDirections: boolean;
    esimLookup: boolean;
    hotelLookup: boolean;
  };
  vectorDb: {
    indexName: string;
    status: "active" | "syncing" | "error";
    totalVectors: number;
    lastSyncedAt: string;
  };
  updatedAt: string;
  updatedBy: string;
}

export interface AIFeedbackRecord {
  id: string;
  routeId: string;
  userId: string;
  destination: string;
  rating: "positive" | "negative";
  feedbackText?: string;
  customChipsText?: string; // from "Diğer..."
  createdAt: string;
}

// Users Management
export interface UserListItem {
  id: string;
  email: string;
  name: string;
  platform: "web" | "ios" | "android";
  subscriptionTier: "free" | "explorer" | "pro" | "agency";
  credits: number;
  totalSpentTry: number;
  routesCount: number;
  isSuspended: boolean;
  createdAt: string;
  lastActiveAt: string;
  documents?: {
    id: string;
    type: "flight_ticket" | "hotel_booking" | "visa" | "other";
    fileName: string;
    fileSize: string;
    isUsed: boolean;
    uploadedAt: string;
  }[];
}

// Campaigns & Notifications
export interface Campaign {
  campaignId: string;
  title: string;
  body: string;
  actionUrl?: string;
  channel: "all" | "web" | "mobile";
  targetSegment: "all" | "free" | "inactive_7d" | "international";
  status: "draft" | "scheduled" | "sent";
  scheduledAt?: string;
  sentAt?: string;
  stats: {
    sent: number;
    opened: number;
    clicked: number;
  };
  createdAt: string;
  createdBy: string;
}

// System Errors
export interface SystemErrorRecord {
  errorId: string;
  source: "web" | "mobile" | "api" | "ai";
  severity: "critical" | "warning" | "info";
  message: string;
  stack?: string;
  endpoint?: string;
  userId?: string;
  status: "open" | "resolved";
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  createdAt: string;
}

// Audit Logs
export interface AuditLogRecord {
  auditId: string;
  actorSub: string;
  action: string;
  targetId: string;
  reason: string;
  details?: Record<string, unknown>;
  createdAt: string;
}
