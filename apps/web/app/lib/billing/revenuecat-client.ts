import { apiFetch } from "../api-client";
import { CheckoutPayload, CheckoutResult } from "./billing-types";

export async function createRevenueCatCheckout(payload: CheckoutPayload): Promise<CheckoutResult> {
  try {
    const session = await apiFetch<{ url: string }>("/revenuecat/checkout", {
      method: "POST",
      body: JSON.stringify({
        targetId: payload.targetId,
        mode: payload.mode,
      }),
    });
    const url = new URL(session.url);
    if (url.protocol !== "https:") throw new Error("Ödeme adresi doğrulanamadı.");
    return {
      success: true,
      message: "Güvenli ödeme sayfasına yönlendiriliyorsunuz.",
      stripeRedirectUrl: url.href,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Ödeme başlatılamadı. Hesabınıza kredi eklenmedi.",
    };
  }
}

export async function verifyRevenueCatPurchase(): Promise<void> {
  await apiFetch("/revenuecat/verify", { method: "POST", body: "{}" });
}
