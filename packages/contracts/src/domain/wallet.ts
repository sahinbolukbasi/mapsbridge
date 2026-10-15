import {
  InsufficientCreditsException,
  ValidationException,
  ForbiddenException,
} from "./exceptions";
import { BILLING_COST, SubscriptionTier } from "../index";

export interface WalletProps {
  sub: string;
  credits: number;
  welcomeClaimed: boolean;
  tier?: SubscriptionTier;
  status?: string;
  reservedCredits?: number;
}

/**
 * CreditWallet Aggregate Root
 * Enforces credit invariants, trial entitlement, reservation and deduction rules.
 */
export class CreditWallet {
  private readonly _sub: string;
  private _credits: number;
  private _welcomeClaimed: boolean;
  private _tier: SubscriptionTier;
  private _status: string;
  private _reservedCredits: number;

  constructor(props: WalletProps) {
    if (!props.sub || typeof props.sub !== "string") {
      throw new ValidationException("User subject (sub) is required for CreditWallet.");
    }
    if (props.credits < 0) {
      throw new ValidationException("Wallet credit balance cannot be negative.");
    }
    this._sub = props.sub;
    this._credits = props.credits;
    this._welcomeClaimed = Boolean(props.welcomeClaimed);
    this._tier = props.tier || "free";
    this._status = props.status || "active";
    this._reservedCredits = Math.max(0, props.reservedCredits || 0);
  }

  get sub(): string {
    return this._sub;
  }

  get credits(): number {
    return this._credits;
  }

  get welcomeClaimed(): boolean {
    return this._welcomeClaimed;
  }

  get tier(): SubscriptionTier {
    return this._tier;
  }

  get status(): string {
    return this._status;
  }

  get reservedCredits(): number {
    return this._reservedCredits;
  }

  public isSuspended(): boolean {
    return this._status === "suspended";
  }

  public canAfford(cost: number): boolean {
    if (this.isSuspended()) return false;
    if (cost <= 0) return true;
    return this._credits >= cost;
  }

  /**
   * Reserves credits for an in-flight operation (e.g. AI generation).
   */
  public reserve(cost: number): void {
    if (this.isSuspended()) {
      throw new ForbiddenException("Suspended account cannot reserve credits.");
    }
    if (cost < 0) {
      throw new ValidationException("Reservation cost cannot be negative.");
    }
    if (!this.canAfford(cost)) {
      throw new InsufficientCreditsException(cost, this._credits);
    }
    this._credits -= cost;
    this._reservedCredits += cost;
  }

  /**
   * Settles a previously reserved credit amount or final cost difference.
   */
  public settle(actualCost: number, reservedAmount: number): void {
    if (this._reservedCredits < reservedAmount) {
      throw new ValidationException("Settlement exceeds reserved amount.");
    }
    this._reservedCredits -= reservedAmount;
    const diff = reservedAmount - actualCost;
    if (diff > 0) {
      // Refund difference back to balance
      this._credits += diff;
    } else if (diff < 0) {
      // Additional deduction needed
      const extraCost = -diff;
      if (this._credits < extraCost) {
        throw new InsufficientCreditsException(extraCost, this._credits);
      }
      this._credits -= extraCost;
    }
  }

  /**
   * Directly deducts credits without prior reservation.
   */
  public deductCredits(cost: number): void {
    if (this.isSuspended()) {
      throw new ForbiddenException("Suspended account cannot spend credits.");
    }
    if (cost < 0) {
      throw new ValidationException("Deduction cost cannot be negative.");
    }
    if (cost === 0) return;
    if (!this.canAfford(cost)) {
      throw new InsufficientCreditsException(cost, this._credits);
    }
    this._credits -= cost;
  }

  /**
   * Adds credits (e.g. from Stripe checkout or manual adjustment).
   */
  public addCredits(amount: number): void {
    if (amount <= 0) {
      throw new ValidationException("Added credit amount must be greater than zero.");
    }
    this._credits += amount;
  }

  /**
   * Atomically claims the welcome trial gift (default 5 credits).
   */
  public claimWelcomeGift(amount: number = BILLING_COST.WELCOME_CREDITS): void {
    if (this._welcomeClaimed) {
      return; // Idempotent: do nothing if already claimed
    }
    this.addCredits(amount);
    this._welcomeClaimed = true;
  }

  public toDto() {
    return {
      sub: this._sub,
      credits: this._credits,
      welcomeClaimed: this._welcomeClaimed,
      tier: this._tier,
      status: this._status,
    };
  }
}
