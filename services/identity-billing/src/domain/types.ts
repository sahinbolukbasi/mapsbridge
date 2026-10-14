import type { UserProfileDto, SubscriptionTier } from "@mapsbridge/contracts";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  emailVerified: boolean;
  roles: Array<"admin" | "moderator" | "support" | "user">;
}

export interface CreditAdjustmentCommand {
  userId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
  operatorId?: string;
}

export interface StripeCheckoutCommand {
  userId: string;
  productId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface UserSubscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: "active" | "canceled" | "past_due" | "trialing";
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
}
