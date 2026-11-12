import { apiFetch } from "../api-client";
import { CheckoutPayload, CheckoutResult } from "./billing-types";

export interface PolarConfig {
  environment: "sandbox" | "production";
}

export function getPolarConfig(): PolarConfig {
  const isProd = process.env.POLAR_ENVIRONMENT === "production" || process.env.NEXT_PUBLIC_POLAR_ENVIRONMENT === "production";
  return {
    environment: isProd ? "production" : "sandbox",
  };
}

/**
 * Creates a Polar checkout session via authenticated API.
 * Returns the hosted checkout URL on polar.sh.
 */
export async function createPolarCheckout(payload: CheckoutPayload): Promise<CheckoutResult> {
  try {
    const session = await apiFetch<{ url: string; checkoutId?: string }>("/polar/checkout", {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({
        targetId: payload.targetId,
        mode: payload.mode,
        cycle: payload.cycle || "monthly",
      }),
    });

    const url = new URL(session.url);
    if (url.protocol !== "https:") {
      throw new Error("Ödeme adresi doğrulanamadı.");
    }

    return {
      success: true,
      message: "Polar güvenli ödeme sayfasına yönlendiriliyorsunuz.",
      stripeRedirectUrl: url.href,
      polarRedirectUrl: url.href,
      transactionId: session.checkoutId,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message:
        err instanceof Error ? err.message : "Ödeme başlatılamadı. Hesabınıza kredi eklenmedi.",
    };
  }
}

/**
 * Opens the Polar self-service Customer Portal for managing active subscriptions.
 */
export async function openPolarCustomerPortal(): Promise<string> {
  const data = await apiFetch<{ url: string }>("/polar/portal", {
    method: "POST",
    body: "{}",
  });
  const url = new URL(data.url);
  if (url.protocol !== "https:") {
    throw new Error("Müşteri portal adresi doğrulanamadı.");
  }
  return url.href;
}

export async function verifyPolarPurchase(): Promise<void> {
  // Triggers wallet refresh or verification
  await apiFetch("/polar/wallet", { method: "GET" }).catch(() => null);
}

