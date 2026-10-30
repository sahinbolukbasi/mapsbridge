// Yönetim API handler yanıt tipleri (design §8.3 "Yanıt" sütunu). Ham DynamoDB satırı dönen
// uçlar `AdminRow` (şema-esnek) olarak tiplenir; görünüm modelleri mappers.ts'tedir.
import type { AdminPermission, EndpointId } from "./endpoints";

export type StaffRole = "admin" | "moderator" | "support";

/** Şema-esnek ham kayıt (PK/SK + handler'ın eklediği alanlar). */
export type AdminRow = Record<string, unknown> & { PK?: string; SK?: string };

export type AdminSession = {
  userId: string;
  role: StaffRole;
  permissions: AdminPermission[];
  paymentsConfigured: boolean;
  userManagement: boolean;
};

export type AdminUserRaw = {
  userId: string;
  username?: string;
  email?: string;
  name?: string;
  role?: string;
  suspended?: boolean;
  suspendReason?: string;
  createdAt?: string;
  tier?: string;
  routesCount?: number;
};

export type AdminUserDetail = {
  user: {
    userId: string;
    username?: string;
    email?: string;
    name?: string;
    phone?: string;
    emailVerified?: boolean;
    enabled?: boolean;
    status?: string;
    createdAt?: string;
    groups?: string[];
    notes?: string;
    version?: number;
  };
  wallet?: { credits?: number; frozen?: boolean };
  subscription?: { tier?: string; status?: string; [k: string]: unknown };
  routes?: AdminRow[];
  usage?: Array<{ requestId?: string; status?: string; cost?: number; createdAt?: string }>;
};

export type AdminPaymentRaw = {
  id: string;
  status: string;
  /** kuruş */
  amount: number;
  currency?: string;
  createdAt?: string;
  paymentIntentId?: string;
  userId?: string;
  packId?: string;
  [k: string]: unknown;
};

export type AdminReport = {
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
};

export type AdminShare = {
  id: string;
  type: "route" | "location";
  owner?: string;
  address?: string;
  createdAt?: string;
  expiresAt?: number;
  status: "active" | "expired" | "revoked";
};

export type AdminProfile = {
  id: string;
  owner?: string;
  name?: string;
  published?: boolean;
  status?: string;
  version?: number;
};

export type AdminAuditLog = {
  auditId: string;
  actorSub: string;
  action: string;
  targetId: string;
  reason: string;
  details?: Record<string, unknown>;
  createdAt: string;
};

export type TokenUsageOk = {
  period: { from: string; to: string };
  totalRequests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  completedPlans: number;
  failures: number;
  successRate: number;
  activeModels: string[];
  source?: string;
  namespace?: string;
};
export type TokenUsageUnavailable = {
  note: string;
  totalInvocations: null;
  estimatedTokensMonth: null;
  activeModels: [];
  quotaUtilizationPct: null;
};

export type AdminReleaseCandidate = {
  id?: string;
  model: string;
  promptVersion: string;
  metrics?: Record<string, number>;
  qualityGate: "passed" | "blocked";
  status?: string;
  proposedAt?: string;
};
export type AdminRelease = {
  version: number;
  active: (AdminReleaseCandidate & { publishedAt?: string }) | null;
  candidate: AdminReleaseCandidate | null;
  previousActive?: AdminReleaseCandidate | null;
  status: string;
};

export type AdminPlan = {
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
};

export type AdminCreditPack = {
  id: string;
  title: string;
  description: string;
  credits: number;
  bonusCredits: number;
  priceTry: number;
  unitPriceTry: number;
  popular?: boolean;
  enabled: boolean;
  stripeProductId?: string;
  totalPurchases: number;
};

export type AdminStripeConfig = {
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
};

export type AdminSystemConfig = {
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  routeCreationEnabled?: boolean;
  sharesEnabled?: boolean;
  version?: number;
  updatedAt?: string;
  reason?: string;
};

export type AdminModuleConfig = {
  mapEnabled: boolean;
  aiEnabled: boolean;
  communityEnabled: boolean;
  messagingEnabled: boolean;
  updatedBy?: string;
  version?: number;
};

export type AdminServiceHealth = { status: string; latencyMs?: number; [k: string]: unknown };

export type AdminAgent = {
  id: string;
  name: string;
  description?: string;
  wired: boolean;
  enabled: boolean;
  capabilities?: string[];
};

export type AdminAiControl = {
  enabled: boolean;
  defaultModel: string;
  disabledModels: string[];
  version: number;
};

/** Uç nokta → yanıt gövdesi. adminRequest<Id> dönüş tipini buradan alır. */
export interface AdminResponses {
  session: { session: AdminSession };
  metrics: {
    metrics: {
      totalUsers: number;
      activeSubscriptions: number;
      totalGuides: number;
      todayPayments: number;
      timestamp: string;
    };
  };
  realtime: { realtime: Record<string, unknown> & { note?: string } };
  systemHealth: {
    health: {
      status: string;
      timestamp: string;
      environment: string;
      region: string;
      services: Record<string, AdminServiceHealth>;
    };
  };
  "users.list": { users: AdminUserRaw[]; count: number; nextCursor: string | null };
  "users.detail": AdminUserDetail;
  "users.suspend": { status: "suspended"; userId: string; reason: string; suspendedAt: string };
  "users.unsuspend": { status: "active"; userId: string; unsuspendedAt: string };
  "users.profile": { status: "updated" };
  "users.sessions": { status: "revoked" };
  "users.role": { status: "updated"; role: string };
  "users.credits": { status: "applied"; credits?: number; duplicate?: boolean };
  "users.wallet": { status: "updated" };
  "users.subscription": { status: "updated" };
  "users.grantCredits": { status: "granted"; userId: string; credits: number; reason: string };
  "users.refund": { status: string; refundId: string; amount: number; reason: string };
  payments: { payments: AdminPaymentRaw[]; count: number };
  finance: {
    finance: {
      totalRevenueTRY: number;
      totalTransactions: number;
      failedTransactions: number;
      monthlyRevenue: Array<{ month: string; amount: number }>;
      currency: string;
    };
  };
  subscriptions: { subscriptions: AdminRow[] };
  creditStats: { stats: Record<string, unknown> };
  plans: { plans: AdminPlan[] };
  "plans.update": { status: "updated"; plan: AdminPlan };
  creditPacks: { packs: AdminCreditPack[] };
  "creditPacks.update": { status: "updated"; pack: AdminCreditPack };
  stripeConfig: { stripe: AdminStripeConfig };
  "stripeConfig.update": { status: "updated"; stripe: AdminStripeConfig };
  reports: { reports: AdminReport[]; count: number };
  "reports.resolve": {
    status: "dismissed" | "resolved";
    reportId: string;
    action: string;
    resolvedAt: string;
  };
  routes: { routes: AdminRow[]; count: number };
  "routes.action": {
    status: "success";
    routeId: string;
    action: string;
    reason: string;
    timestamp: string;
  };
  "routes.details": { status: "updated" };
  shares: { shares: AdminShare[] };
  "shares.revoke": { status: "revoked" };
  profiles: { profiles: AdminProfile[] };
  "profiles.moderate": { status: "updated" };
  content: { content: AdminRow[] };
  "content.create": { content: AdminRow };
  "content.update": { content: AdminRow };
  tickets: { tickets: AdminRow[] };
  "tickets.update": { ticket: AdminRow };
  announcements: { announcements: AdminRow[] };
  "announcements.save": { announcement: AdminRow };
  systemConfig: { config: AdminSystemConfig };
  "systemConfig.update": { config: AdminSystemConfig };
  moduleConfig: { moduleConfig: AdminModuleConfig };
  "moduleConfig.update": { status: "updated"; moduleConfig: AdminModuleConfig };
  auditLogs: { logs: AdminAuditLog[]; count: number };
  usage: {
    usage: Array<{
      id: string;
      userId?: string;
      status?: string;
      credits?: number;
      createdAt?: string;
    }>;
  };
  tokenUsage: { usage: TokenUsageOk | TokenUsageUnavailable };
  aiOperations: {
    control: AdminAiControl;
    runtime: { primaryModel: string; models: string[]; observedAt?: string } | null;
    events: AdminRow[];
    truncated?: boolean;
    observedAt: string;
  };
  "ai.control": { control: AdminAiControl };
  aiAgents: {
    agents: AdminAgent[];
    version: number;
    policy?: Record<string, unknown>;
    observedAt: string;
  };
  "aiAgents.config": { agents: AdminAgent[]; version: number };
  aiTraining: {
    records: AdminRow[];
    truncated?: boolean;
    policy: {
      automaticTraining: false;
      requiresHumanReview: boolean;
      retentionDays: number;
      piiMaskedBeforeQueue: boolean;
    };
    observedAt: string;
  };
  "aiTraining.review": { success: boolean; id: string; action: string };
  aiTrainingJobs: { jobs: AdminRow[]; region: string; observedAt: string };
  "aiTraining.fineTune": {
    jobArn: string;
    jobName: string;
    recordCount: number;
    trainKey: string;
    region: string;
  };
  aiRelease: {
    release: AdminRelease;
    thresholds: Record<string, number>;
    policy?: Record<string, unknown>;
    observedAt: string;
  };
  "aiRelease.propose": { release: AdminRelease; qualityGate: "passed" | "blocked" };
  "aiRelease.publish": { release: AdminRelease };
  "aiRelease.rollback": { release: AdminRelease };
  agentcoreStatus: {
    observedAt: string;
    region: string;
    gateway?: Record<string, unknown>;
    memory?: Record<string, unknown>;
    worker?: Record<string, unknown>;
  };
  "analytics.devices": { devices: Record<string, unknown> };
  "analytics.aiTopics": { aiAnalytics: Record<string, unknown> };
  "analytics.community": { community: Record<string, unknown> };
  "analytics.subscriptions": { subscriptions: Record<string, unknown> };
}

// Her uç noktanın yanıt tipi olduğunu derleme anında garanti eder.
type _AllCovered = { [K in EndpointId]: AdminResponses[K] };
export type AdminResponse<Id extends EndpointId> = _AllCovered[Id];
