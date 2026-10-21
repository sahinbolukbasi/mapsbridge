import { NextResponse, NextRequest } from "next/server";
import { communityStore } from "../../../../../server/community-store";
import { getCorsHeaders, authenticateRequest } from "../../../middleware/auth";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const corsHeaders = getCorsHeaders(request);
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  let username = searchParams.get("username") || undefined;
  const auth = await authenticateRequest(request, corsHeaders);
  if (!(auth instanceof NextResponse)) {
    username = username || auth.username;
  }

  const post = communityStore.getById(id, username);
  if (!post) {
    return NextResponse.json(
      { error: "Gönderi bulunamadı." },
      { status: 404, headers: corsHeaders },
    );
  }

  return NextResponse.json({ success: true, post }, { headers: corsHeaders });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const corsHeaders = getCorsHeaders(request);
  const auth = await authenticateRequest(request, corsHeaders);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  // Ownership check — only the post author may edit it.
  const existing = communityStore.getById(id);
  if (!existing) {
    return NextResponse.json(
      { error: "Güncellenecek gönderi bulunamadı." },
      { status: 404, headers: corsHeaders },
    );
  }
  if (existing.authorUsername !== auth.username) {
    return NextResponse.json(
      { error: "Bu gönderiyi düzenleme yetkiniz yok." },
      { status: 403, headers: corsHeaders },
    );
  }

  try {
    const updates = await request.json();
    const updated = communityStore.update(id, updates);

    if (!updated) {
      return NextResponse.json(
        { error: "Güncellenecek gönderi bulunamadı." },
        { status: 404, headers: corsHeaders },
      );
    }

    return NextResponse.json({ success: true, post: updated }, { headers: corsHeaders });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sunucu hatası" },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const corsHeaders = getCorsHeaders(request);
  const auth = await authenticateRequest(request, corsHeaders);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  // Ownership check — only the post author may delete it.
  const existing = communityStore.getById(id);
  if (!existing) {
    return NextResponse.json(
      { error: "Silinecek gönderi bulunamadı." },
      { status: 404, headers: corsHeaders },
    );
  }
  if (existing.authorUsername !== auth.username) {
    return NextResponse.json(
      { error: "Bu gönderiyi silme yetkiniz yok." },
      { status: 403, headers: corsHeaders },
    );
  }

  const deleted = communityStore.delete(id);

  if (!deleted) {
    return NextResponse.json(
      { error: "Silinecek gönderi bulunamadı." },
      { status: 404, headers: corsHeaders },
    );
  }

  return NextResponse.json(
    { success: true, message: "Gönderi silindi." },
    { headers: corsHeaders },
  );
}
