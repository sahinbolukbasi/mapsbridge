import { apiFetch } from "../api-client";
import { getStoredSession } from "../cognito";
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
 * Canlı Polar Hosted Checkout Bağlantıları (Maps Bridge — TR / US / EU Çoklu Pazar)
 */
export const POLAR_LIVE_CHECKOUT_LINKS: Record<string, string> = {
  explorer:
    process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL_EXPLORER ||
    "https://buy.polar.sh/polar_cl_1YnWOZCCN94R9gaownJcFaKj8bnekRZl8nKm20FyTQO",
  pro:
    process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL_PRO ||
    "https://buy.polar.sh/polar_cl_TitGKcwxcS7AtB2jTsmHW99kQc7sudzdd5gXP0rAve0",
  agency:
    process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL_AGENCY ||
    "https://buy.polar.sh/polar_cl_E0BpkvdYR74Fp0ye6i7m6mD1LQ4GJDZNDDCEw0f3Vc2",
  "pack-30":
    process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL_PACK_30 ||
    "https://buy.polar.sh/polar_cl_wpo0KNVyrThYAbhR8Iouc7mMBIGpfSNxQDsMW2nTfCh",
  "pack-starter":
    process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL_PACK_30 ||
    "https://buy.polar.sh/polar_cl_wpo0KNVyrThYAbhR8Iouc7mMBIGpfSNxQDsMW2nTfCh",
  "pack-100":
    process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL_PACK_100 ||
    "https://buy.polar.sh/polar_cl_qkvFdsPgPCAhOZu9GpLOhMJeULcO0hSEXqreE0D94hc",
  "pack-popular":
    process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL_PACK_100 ||
    "https://buy.polar.sh/polar_cl_qkvFdsPgPCAhOZu9GpLOhMJeULcO0hSEXqreE0D94hc",
  "pack-300":
    process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL_PACK_300 ||
    "https://buy.polar.sh/polar_cl_WH0IZVT4tIRlcxlftSnlyJbBFcjCTT4apO47w1stp5H",
  "pack-master":
    process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL_PACK_300 ||
    "https://buy.polar.sh/polar_cl_WH0IZVT4tIRlcxlftSnlyJbBFcjCTT4apO47w1stp5H",
  "pack-pro":
    process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL_PACK_PRO ||
    "https://buy.polar.sh/polar_cl_ay9kL24efjStvQzBnMy574uaOcnUbqjg7zyGw2M28th",
};

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
    // Gerçek tarayıcıda /polar/checkout uç noktası henüz yanıt vermiyorsa doğrudan canlı Polar Hosted Checkout bağlantısına yönlendir
    const isLiveBrowser =
      typeof window !== "undefined" && Boolean(window.location?.hostname);
    const directLink = POLAR_LIVE_CHECKOUT_LINKS[payload.targetId];
    if (isLiveBrowser && directLink) {
      try {
        const checkoutUrl = new URL(directLink);
        const session = getStoredSession();
        if (session?.email) {
          checkoutUrl.searchParams.set("customer_email", session.email);
        }
        return {
          success: true,
          message: "Polar güvenli ödeme sayfasına yönlendiriliyorsunuz.",
          stripeRedirectUrl: checkoutUrl.href,
          polarRedirectUrl: checkoutUrl.href,
          transactionId: `polar_live_${payload.targetId}`,
        };
      } catch {}
    }

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

