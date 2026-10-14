import { SubscriptionTier, SUBSCRIPTION_TIERS } from "../index";
import { ValidationException } from "./exceptions";

export type SubscriptionStatus = "active" | "cancelled" | "past_due" | "expired" | "trial";

export interface SubscriptionProps {
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

/**
 * Subscription Domain Aggregate
 * Controls subscription lifecycle, limits, and capabilities.
 */
export class Subscription {
  private readonly _userId: string;
  private _tier: SubscriptionTier;
  private _status: SubscriptionStatus;
  private _currentPeriodEnd?: string;
  private _cancelAtPeriodEnd: boolean;

  constructor(props: SubscriptionProps) {
    if (!props.userId?.trim()) {
      throw new ValidationException("Subscription userId is required.");
    }
    this._userId = props.userId.trim();
    this._tier = props.tier || SUBSCRIPTION_TIERS.FREE;
    this._status = props.status || "trial";
    this._currentPeriodEnd = props.currentPeriodEnd;
    this._cancelAtPeriodEnd = Boolean(props.cancelAtPeriodEnd);
  }

  get userId(): string {
    return this._userId;
  }

  get tier(): SubscriptionTier {
    return this._tier;
  }

  get status(): SubscriptionStatus {
    return this._status;
  }

  get currentPeriodEnd(): string | undefined {
    return this._currentPeriodEnd;
  }

  get cancelAtPeriodEnd(): boolean {
    return this._cancelAtPeriodEnd;
  }

  public isActive(): boolean {
    return this._status === "active" || this._status === "trial";
  }

  /**
   * Free tier limits route creation to 3 saved routes.
   */
  public canCreateRoute(currentSavedRoutesCount: number): boolean {
    if (this._tier === SUBSCRIPTION_TIERS.FREE) {
      return currentSavedRoutesCount < 3;
    }
    return true;
  }

  public getMonthlyCreditAllowance(): number {
    switch (this._tier) {
      case SUBSCRIPTION_TIERS.EXPLORER:
        return 100;
      case SUBSCRIPTION_TIERS.PRO:
        return 500;
      case SUBSCRIPTION_TIERS.AGENCY:
        return 2500;
      case SUBSCRIPTION_TIERS.FREE:
      default:
        return 0;
    }
  }

  public hasPriorityModelAccess(): boolean {
    return this._tier === SUBSCRIPTION_TIERS.PRO || this._tier === SUBSCRIPTION_TIERS.AGENCY;
  }

  public cancel(atPeriodEnd = true): void {
    if (atPeriodEnd) {
      this._cancelAtPeriodEnd = true;
    } else {
      this._status = "cancelled";
    }
  }

  public renew(newPeriodEnd: string): void {
    this._status = "active";
    this._cancelAtPeriodEnd = false;
    this._currentPeriodEnd = newPeriodEnd;
  }

  public upgradeTier(newTier: SubscriptionTier): void {
    this._tier = newTier;
    this._status = "active";
  }
}
