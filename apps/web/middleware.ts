// Server-side route protection — active in SSR (Lambda) mode only.
// Static export mode: route protection is handled by the CloudFront spa_router function
// which checks mb_session cookie before serving /desk /profile /messages /ai paths.
//
// To activate: remove `output: "export"` from next.config.ts and deploy via OpenNext.

import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/desk", "/profile", "/messages", "/ai"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  const session = request.cookies.get("mb_session")?.value;
  if (!session) {
    const loginUrl = new URL("/login/", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/desk/:path*", "/profile/:path*", "/messages/:path*", "/ai/:path*"],
};
