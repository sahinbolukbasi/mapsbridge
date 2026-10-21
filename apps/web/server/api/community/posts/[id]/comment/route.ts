import { NextResponse, NextRequest } from "next/server";
import { communityStore } from "../../../../../../server/community-store";
import { getCorsHeaders, authenticateRequest } from "../../../../middleware/auth";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const corsHeaders = getCorsHeaders(request);
  const auth = await authenticateRequest(request, corsHeaders);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const body = await request.json();
    if (!body || !body.text || !body.text.trim()) {
      return NextResponse.json(
        { error: "Yorum metni zorunludur." },
        { status: 400, headers: corsHeaders },
      );
    }

    if (body.text.length > 500) {
      return NextResponse.json(
        { error: "Yorum metni en fazla 500 karakter olabilir." },
        { status: 400, headers: corsHeaders },
      );
    }

    const comment = communityStore.addComment(id, {
      username: auth.username,
      // displayName comes from the client but is cosmetic only (username is the authority);
      // truncate to prevent oversized payloads.
      displayName: typeof body.displayName === "string" ? body.displayName.slice(0, 80) : undefined,
      text: body.text.trim(),
    });

    if (!comment) {
      return NextResponse.json(
        { error: "Gönderi bulunamadı." },
        { status: 404, headers: corsHeaders },
      );
    }

    return NextResponse.json({ success: true, comment }, { status: 201, headers: corsHeaders });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sunucu hatası" },
      { status: 500, headers: corsHeaders },
    );
  }
}
