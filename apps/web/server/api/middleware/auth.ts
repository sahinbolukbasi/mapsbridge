import { NextRequest, NextResponse } from "next/server";
// jose is a workspace-level dependency available via npm workspaces hoisting
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – jose is hoisted from the monorepo root node_modules
import { createRemoteJWKSet, jwtVerify } from "jose";

const ALLOWED_ORIGINS = [
  "https://mapsbridge.com",
  "https://www.mapsbridge.com",
  "http://localhost:3000",
  "http://localhost:3001",
];

export const CORS_HEADERS_BASE = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    ...CORS_HEADERS_BASE,
    "Access-Control-Allow-Origin": allowedOrigin,
  };
}

// ---------------------------------------------------------------------------
// JWT verification via Cognito JWKS – cryptographic signature check.
// Falls back to a non-verifying decode ONLY in non-production when the user
// pool is not configured (e.g. running unit tests without real Cognito creds).
// ---------------------------------------------------------------------------

const COGNITO_REGION =
  process.env.COGNITO_REGION ||
  process.env.NEXT_PUBLIC_COGNITO_REGION ||
  "eu-central-1";

const COGNITO_USER_POOL_ID =
  process.env.COGNITO_USER_POOL_ID ||
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ||
  "";

const JWKS_URI = COGNITO_USER_POOL_ID
  ? `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`
  : "";

// Lazily created so the module can be imported without side-effects.
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJWKS() {
  if (!JWKS_URI) return null;
  if (!jwksCache) {
    jwksCache = createRemoteJWKSet(new URL(JWKS_URI));
  }
  return jwksCache;
}

/**
 * Verify a JWT using Cognito's public JWKS endpoint.
 * Returns the decoded payload on success, null on any failure.
 */
async function verifyJwt(token: string): Promise<Record<string, unknown> | null> {
  const jwks = getJWKS();
  if (!jwks) {
    // JWKS not configured – only allow in non-production for local dev/testing.
    if (process.env.NODE_ENV === "production") {
      console.error("[auth] COGNITO_USER_POOL_ID not set; refusing all tokens in production.");
      return null;
    }
    return decodeJwtPayloadUnsafe(token);
  }
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`,
    });
    return payload as Record<string, unknown>;
  } catch {
    // Token invalid, expired, wrong issuer, or signature mismatch.
    return null;
  }
}

/**
 * Decode-only (no signature check) – used exclusively for local dev when
 * JWKS is not configured. MUST NOT be used in production.
 */
function decodeJwtPayloadUnsafe(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, "=");
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export interface AuthResult {
  username: string;
  email: string;
}

/**
 * Validate the Authorization: Bearer <token> header.
 * Cryptographically verifies the JWT against Cognito's JWKS, checks expiry,
 * and extracts user identity.
 * Returns the AuthResult on success, or a 401 NextResponse on failure.
 */
export async function authenticateRequest(
  request: NextRequest,
  corsHeaders: Record<string, string>
): Promise<AuthResult | NextResponse> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Yetkilendirme gerekli. Authorization: Bearer <token> header eksik." },
      { status: 401, headers: corsHeaders }
    );
  }

  const token = authHeader.slice(7);
  const payload = await verifyJwt(token);

  if (!payload) {
    return NextResponse.json(
      { error: "Geçersiz veya süresi dolmuş token." },
      { status: 401, headers: corsHeaders }
    );
  }

  // jwtVerify already validates `exp`; this is a belt-and-suspenders check
  // for the dev decode-only path.
  if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
    return NextResponse.json(
      { error: "Token süresi dolmuş. Lütfen tekrar giriş yapın." },
      { status: 401, headers: corsHeaders }
    );
  }

  const email = (payload.email as string) || "";
  const sub = (payload.sub as string) || "";
  const username =
    (payload["cognito:username"] as string) ||
    email.split("@")[0]?.replace(/[^a-z0-9_]/g, "") ||
    sub;

  if (!email && !sub) {
    return NextResponse.json(
      { error: "Token geçersiz: kullanıcı bilgisi bulunamadı." },
      { status: 401, headers: corsHeaders }
    );
  }

  return { username, email };
}
