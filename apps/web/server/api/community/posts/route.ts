import { NextResponse, NextRequest } from "next/server";
import { communityStore } from "../../../../server/community-store";
import { getCorsHeaders, authenticateRequest } from "../../middleware/auth";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  const { searchParams } = new URL(request.url);

  // GET is open, but optionally use auth for personalized results
  let username = searchParams.get("username") || undefined;
  const auth = await authenticateRequest(request, corsHeaders);
  if (!(auth instanceof NextResponse)) {
    username = username || auth.username;
  }

  const posts = communityStore.getAll(username);

  return NextResponse.json(
    { success: true, posts, count: posts.length },
    { headers: corsHeaders }
  );
}

const MAX_CONTENT_LENGTH = 2000;

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  const auth = await authenticateRequest(request, corsHeaders);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    if (!body || !body.content || !body.content.trim()) {
      return NextResponse.json(
        { error: "Paylaşım metni zorunludur." },
        { status: 400, headers: corsHeaders }
      );
    }

    if (body.content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `Paylaşım metni en fazla ${MAX_CONTENT_LENGTH} karakter olabilir.` },
        { status: 400, headers: corsHeaders }
      );
    }

    // Whitelist allowed fields — never trust client-supplied authorUsername or verified status.
    const post = communityStore.create({
      content: body.content,
      authorDisplayName: typeof body.authorDisplayName === "string" ? body.authorDisplayName.slice(0, 80) : undefined,
      tags: Array.isArray(body.tags) ? (body.tags as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 10) : [],
      hashtags: Array.isArray(body.hashtags) ? (body.hashtags as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 10) : [],
      locationTag: typeof body.locationTag === "string" ? body.locationTag.slice(0, 100) : undefined,
      category: typeof body.category === "string" ? body.category.slice(0, 50) : undefined,
      // `verified` is never accepted from the client; community-store defaults it to false.
      authorUsername: auth.username,
    });

    return NextResponse.json(
      { success: true, post },
      { status: 201, headers: corsHeaders }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Sunucu hatası" },
      { status: 500, headers: corsHeaders }
    );
  }
}
