// Handler yanıtı → görünüm modeli (design §8.1 M1–M4, §8.8 madde 6). Saf; React yok.
import type {
  AdminPaymentRaw,
  AdminRelease,
  AdminRow,
  AdminUserRaw,
  TokenUsageOk,
  TokenUsageUnavailable,
} from "./types";

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export type UserView = {
  id: string;
  name: string;
  email: string;
  role: string;
  tier: string;
  suspended: boolean;
  suspendReason: string;
  createdAt: string;
  routesCount: number;
};

/**
 * Handler tüm Scan sayfalarını birleştirip tam liste döner (nextCursor:null, M2). Mapper sayfalama
 * alanına bakmaz; her satırı görünüm modeline çevirir ve yinelenen userId'leri birleştirir.
 */
export function mapUsers(res: { users: AdminUserRaw[] }): UserView[] {
  const byId = new Map<string, AdminUserRaw>();
  for (const u of res.users ?? []) {
    if (!u?.userId) continue;
    byId.set(u.userId, { ...byId.get(u.userId), ...u });
  }
  return [...byId.values()].map((u) => ({
    id: u.userId,
    name: str(u.name) || str(u.username),
    email: str(u.email),
    role: str(u.role) || "user",
    tier: str(u.tier) || "free",
    suspended: u.suspended === true,
    suspendReason: str(u.suspendReason),
    createdAt: str(u.createdAt),
    routesCount: num(u.routesCount),
  }));
}

export type TokenUsageView =
  ({ kind: "ok" } & TokenUsageOk) | { kind: "unavailable"; note: string };

/** M1: başarı ve "henüz bağlanmadı" şekilleri ayrımlı birleşime çevrilir. */
export function mapTokenUsage(res: {
  usage: TokenUsageOk | TokenUsageUnavailable;
}): TokenUsageView {
  const u = res.usage as Partial<TokenUsageOk & TokenUsageUnavailable>;
  if (u && typeof u.totalRequests === "number") return { kind: "ok", ...(u as TokenUsageOk) };
  return { kind: "unavailable", note: str(u?.note) || "Token kullanım verisi henüz bağlanmadı." };
}

export type PaymentView = {
  id: string;
  status: string;
  /** TL (kuruş / 100) */
  amountTry: number;
  currency: string;
  createdAt: string;
  paymentIntentId: string;
  userId: string;
  packId: string;
  refundable: boolean;
};

export function mapPayments(res: { payments: AdminPaymentRaw[] }): PaymentView[] {
  return (res.payments ?? []).map((p) => ({
    id: str(p.id),
    status: str(p.status),
    amountTry: Math.round(num(p.amount)) / 100,
    currency: (str(p.currency) || "try").toUpperCase(),
    createdAt: str(p.createdAt),
    paymentIntentId: str(p.paymentIntentId),
    userId: str(p.userId),
    packId: str(p.packId),
    refundable: p.status === "succeeded" && Boolean(p.paymentIntentId) && Boolean(p.userId),
  }));
}

export type TicketView = AdminRow & {
  id: string;
  subject: string;
  status: string;
  priority: string;
  version: number;
  messages: AdminRow[];
};

/** Talep kimliği: `id` yoksa PK "TICKET#<id>"den türetilir. */
export function mapTickets(res: { tickets: AdminRow[] }): TicketView[] {
  return (res.tickets ?? []).map((t) => ({
    ...t,
    id: str(t.id) || str(t.PK).slice(7),
    subject: str(t.subject),
    status: str(t.status) || "open",
    priority: str(t.priority) || "normal",
    version: num(t.version),
    messages: Array.isArray(t.messages) ? (t.messages as AdminRow[]) : [],
  }));
}

export type SubscriptionView = AdminRow & {
  userId: string;
  tier: string;
  status: string;
  cancelAtPeriodEnd: boolean;
};

export function mapSubscriptions(res: { subscriptions: AdminRow[] }): SubscriptionView[] {
  return (res.subscriptions ?? []).map((s) => ({
    ...s,
    userId: str(s.PK).replace(/^USER#/, ""),
    tier: str(s.tier),
    status: str(s.status),
    cancelAtPeriodEnd: s.cancelAtPeriodEnd === true,
  }));
}

export type ShareView = {
  id: string;
  type: "route" | "location";
  owner: string;
  address: string;
  createdAt: string;
  expiresAt: string;
  status: "active" | "expired" | "revoked";
  revocable: boolean;
};

export function mapShares(res: {
  shares: Array<{
    id: string;
    type: "route" | "location";
    owner?: string;
    address?: string;
    createdAt?: string;
    expiresAt?: number;
    status: "active" | "expired" | "revoked";
  }>;
}): ShareView[] {
  return (res.shares ?? []).map((s) => ({
    id: s.id,
    type: s.type,
    owner: str(s.owner),
    address: str(s.address),
    createdAt: str(s.createdAt),
    expiresAt: typeof s.expiresAt === "number" ? new Date(s.expiresAt * 1000).toISOString() : "",
    status: s.status,
    revocable: s.status === "active",
  }));
}

export type ReleaseView = {
  release: AdminRelease;
  /** Aday kalite kapısını geçtiyse yayınla görünür (I10). */
  canPublish: boolean;
  /** Önceki aktif sürüm varsa geri al görünür (I10). */
  canRollback: boolean;
};

export function mapRelease(res: { release: AdminRelease }): ReleaseView {
  const release = res.release;
  return {
    release,
    canPublish: release?.candidate?.qualityGate === "passed",
    canRollback: Boolean(release?.previousActive),
  };
}
