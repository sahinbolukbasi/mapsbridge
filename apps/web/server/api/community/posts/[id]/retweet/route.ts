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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const corsHeaders = getCorsHeaders(request);
  const auth = await authenticateRequest(request, corsHeaders);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const post = communityStore.retweet(id, auth.username);
    if (!post) {
      return NextResponse.json(
        { error: "Gönderi bulunamadı." },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { success: true, post },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Sunucu hatası" },
      { status: 500, headers: corsHeaders }
    );
  }
}
