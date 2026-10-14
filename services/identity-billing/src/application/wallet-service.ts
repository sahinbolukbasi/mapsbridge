import type { CreditAdjustmentCommand } from "../domain/types.js";

export {
  BillingError,
  wallet,
  subscription,
  initializeTrial,
  grantCredits,
  reserveAI,
  authorizeAI,
  finishAI,
  aiUsage,
} from "../../../../infra/lambda/src/billing/store.js";

export { read } from "../../../../infra/lambda/src/shared/data.js";

export class WalletService {
  static readonly WELCOME_CREDITS = 5;
  static readonly DAILY_REQUEST_LIMIT = 20;
  static readonly CREDIT_COSTS = { clarify: 0, chat: 1, route: 5 } as const;

  public static isValidCreditAdjustment(command: CreditAdjustmentCommand): boolean {
    return (
      Number.isSafeInteger(command.amount) &&
      command.amount !== 0 &&
      Math.abs(command.amount) <= 10000 &&
      /^[a-zA-Z0-9_-]{16,80}$/.test(command.idempotencyKey)
    );
  }
}
