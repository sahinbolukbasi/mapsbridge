import { NextRequest, NextResponse } from "next/server";
// @ts-ignore
import { createPolar } from "@polar-sh/sdk/2026-10";

export async function POST(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin || "https://mapsbridge.com";
    const secretToken = process.env.POLAR_ACCESS_TOKEN;
    const polarEnv = process.env.POLAR_ENVIRONMENT === "production" ? "production" : "sandbox";

    if (!secretToken) {
      return NextResponse.json({
        url: `${origin}/checkout`,
      });
    }

    const polar = createPolar({
      accessToken: secretToken,
      environment: polarEnv,
    });

    const session = await polar.customerSessions.create({
      external_customer_id: "anonymous",
    });

    return NextResponse.json({
      url: session.customer_portal_url,
    });
  } catch (err: unknown) {
    console.error("[Polar Customer Portal] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Portal açılamadı." },
      { status: 500 },
    );
  }
}
