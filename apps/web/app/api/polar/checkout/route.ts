import { NextRequest, NextResponse } from "next/server";
import { createPolar } from "@polar-sh/sdk/2026-10";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const _token = authHeader.replace(/^Bearer /, "").trim();

    let body: { targetId?: string; mode?: string; cycle?: string } = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
    }

    const { targetId } = body;
    if (!targetId) {
      return NextResponse.json({ error: "Paket seçimi gereklidir." }, { status: 400 });
    }

    const origin = req.nextUrl.origin || "https://mapsbridge.com";
    const secretToken = process.env.POLAR_ACCESS_TOKEN;
    const polarEnv = process.env.POLAR_ENVIRONMENT === "production" ? "production" : "sandbox";

    if (!secretToken) {
      // Keys will be provided by user at the end: fallback for dev/sandbox preview
      const fallbackUrl = `${origin}/checkout?success=true&product=${encodeURIComponent(targetId)}&simulated=polar`;
      return NextResponse.json({
        url: fallbackUrl,
        checkoutId: `polar_mock_${Date.now()}`,
        polarRedirectUrl: fallbackUrl,
        stripeRedirectUrl: fallbackUrl,
      });
    }

    const polar = createPolar({
      accessToken: secretToken,
      environment: polarEnv,
    });

    const checkout = await polar.checkouts.create({
      products: [targetId],
      metadata: {
        targetId,
        mode: body.mode || "subscription",
      },
      success_url: `${origin}/checkout?success=true&checkout_id={CHECKOUT_ID}`,
      return_url: `${origin}/checkout`,
    });

    return NextResponse.json({
      url: checkout.url,
      checkoutId: checkout.id,
      polarRedirectUrl: checkout.url,
      stripeRedirectUrl: checkout.url,
    });
  } catch (err: unknown) {
    console.error("[Polar Next.js Checkout] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ödeme başlatılamadı." },
      { status: 500 },
    );
  }
}
