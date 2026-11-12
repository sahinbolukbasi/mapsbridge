import { NextRequest, NextResponse } from "next/server";
import { processPolarWebhook } from "../../../lib/billing/polar-webhook";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  const result = await processPolarWebhook(rawBody, headers);
  return NextResponse.json(result.body, { status: result.status });
}

