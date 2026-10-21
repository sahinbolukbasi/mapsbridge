import type { default as StripeType } from "stripe";
import { resolveEnvSecret } from "../shared/http";
import { BillingError } from "./store";
let client: StripeType | undefined;
export async function stripeClient(): Promise<StripeType> {
  if (client) return client;
  const key = await resolveEnvSecret(process.env.STRIPE_SECRET_KEY);
  if (!/^sk_(test|live)_/.test(key) || key.includes("placeholder"))
    throw new BillingError(503, "PAYMENTS_UNAVAILABLE", "Ödeme servisi yapılandırılmadı.");
  const Stripe = (await import("stripe")).default;
  client = new Stripe(key, {
    apiVersion: "2025-02-24.acacia",
    timeout: 8000,
    maxNetworkRetries: 1,
  });
  return client;
}
