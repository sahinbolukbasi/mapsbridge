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

// AI AgentCore & Harness + Isolated AI Lab
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
    tier1FastIntakeModel?: string;
    tier2StandardChatModel?: string;
    tier3PrimaryRouteModel?: string;
    tier4DeepReplanningModel?: string;
    temperature: number;
    maxTokens: number;
  };
  agentCore?: {
    memoryEnabled: boolean;
    episodicReflectionEnabled: boolean;
    longTermPreferenceTtlDays: number;
    sessionContextTtlDays: number;
    harnessStages: Array<{
      id: string;
      order: number;
      name: string;
      deterministic: boolean;
      timeoutMs: number;
      description: string;
    }>;
    memoryNamespaces: Array<{
      id: string;
      namespaceTemplate: string;
      ttlDays: number;
      strategy: string;
      description: string;
    }>;
  };
  subAgents?: Array<{
    id: string;
    name: string;
    domain: string;
    defaultTier: string;
    wired: boolean;
    enabledByDefault: boolean;
    timeoutMs: number;
    description: string;
    tools: string[];
    guardrails: string[];
  }>;
  tools: {
    placesSearch: boolean;
    weatherCheck: boolean;
    transitDirections: boolean;
    esimLookup: boolean;
    hotelLookup: boolean;
    curatedCityIntel?: boolean;
    principalAxisClustering?: boolean;
    chronoSpatial2Opt?: boolean;
  };
  vectorDb: {
    indexName: string;
    status: "active" | "syncing" | "error";
    totalVectors: number;
    lastSyncedAt: string;
    embeddingModelId?: string;
    dimensions?: number;
  };
  isolatedLab?: {
    environment: string;
    autonomousMode24x7: boolean;
    daemons: Array<{
      id: string;
      name: string;
      scheduleCron: string;
      intervalMinutes: number;
      enabled: boolean;
      tier: string;
      targetLambdaOrWorker: string;
      description: string;
      lastHeartbeatAt?: string;
      status: "running" | "idle" | "degraded" | "paused";
      metrics: {
        cyclesCompleted24h: number;
        itemsProcessed24h: number;
        avgCycleDurationMs: number;
        successRate: number;
      };
    }>;
    vectorDb: {
      provider: string;
      embeddingModelId: string;
      dimensions: number;
      namespaces: Array<{
        namespace: string;
        description: string;
        embeddingModelId: string;
        dimensions: number;
        metric: string;
        documentCount: number;
        freshnessScore: number;
        lastIndexedAt: string;
        autoSyncEnabled: boolean;
      }>;
    };
    rag: {
      enabled: boolean;
      hybridSearchEnabled: boolean;
      vectorWeight: number;
      lexicalBm25Weight: number;
      geoProximityWeight: number;
      topK: number;
      minSimilarityThreshold: number;
      strictSourceAttribution: boolean;
      autoFreshnessSweepHours: number;
    };
    fineTuning: {
      enabled: boolean;
      autoCurateFromThumbsUp: boolean;
      autoCurateFromGoldenEval: boolean;
      piiScrubbingEnforced: boolean;
      targetBaseModelId: string;
      trainingMethod: "SFT" | "DPO" | "DISTILLATION";
      minQualityScoreThreshold: number;
      s3DatasetBucketPrefix: string;
      lastExportedAt?: string;
      curatedSampleCount: number;
    };
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

