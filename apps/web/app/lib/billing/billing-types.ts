// ============================================================
// MapsBridge Billing & Monetization Types
// ============================================================

export type SubscriptionTierId = "free" | "explorer" | "pro" | "agency";
export type BillingCycle = "monthly" | "yearly";

export interface PlanFeature {
  text: string;
  included: boolean;
  highlight?: boolean;
}

export interface SubscriptionPlan {
  id: SubscriptionTierId;
  name: string;
  tagline: string;
  badge?: string;
  monthlyPriceTry: number;
  yearlyPriceTry: number; // Discounted monthly price when billed yearly
  monthlyCredits: number;
  features: PlanFeature[];
  highlight?: boolean;
  color: string;
}

export interface CreditPackage {
  id: string;
  title: string;
  credits: number;
  bonusCredits: number;
  priceTry: number;
  popular?: boolean;
  badge?: string;
  unitPriceTry: number;
  description: string;
}

export interface WalletData {
  welcomeGift?: { credits: number; grantedAt: string };
  credits: number;
  subscriptionTier: SubscriptionTierId;
  subscriptionCycle: BillingCycle;
  subscriptionRenewsAt?: string;
  creatorEarningsTry: number;
  creatorPendingPayoutTry: number;
  totalWithdrawnTry: number;
  payoutIban?: string;
  payoutAccountHolder?: string;
}

export type TransactionType =
  | "credit_purchase"
  | "subscription_payment"
  | "ai_usage"
  | "route_export"
  | "route_sale_earning"
  | "payout_request";

export interface BillingTransaction {
  id: string;
  date: string;
  type: TransactionType;
  description: string;
  amountTry?: number;
  creditsDelta?: number;
  status: "completed" | "pending" | "failed";
  invoiceUrl?: string;
}

export interface CheckoutPayload {
  mode: "subscription" | "credit_pack";
  targetId: string; // tier id or credit package id
  cycle?: BillingCycle;
}

// AICreditAction is now exported from @mapsbridge/contracts
export type { AICreditAction } from "@mapsbridge/contracts";

export interface BillingDetails {
  invoiceType: "individual" | "corporate";
  fullNameOrCompany: string;
  taxOrIdNumber: string;
  taxOffice?: string;
  address: string;
  city: string;
  country: string;
}

export interface MarketplaceRouteItem {
  id: string;
  title: string;
  creatorName: string;
  creatorEmail: string;
  priceTry: number;
  description: string;
  destination: string;
  estimatedDays: number;
  stopsCount: number;
  isPurchased?: boolean;
}

export interface CheckoutResult {
  success: boolean;
  message: string;
  creditsAdded?: number;
  newBalance?: number;
  newTier?: SubscriptionTierId;
  transactionId?: string;
  stripeRedirectUrl?: string;
}
