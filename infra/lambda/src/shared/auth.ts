import { createRemoteJWKSet, jwtVerify } from "jose";

// Cached at module scope — reused across warm Lambda invocations
const googleJWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const appleJWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export interface VerifiedUser {
  sub: string;
  originalSub?: string;
  email?: string;
  isAdmin: boolean;
  emailVerified: boolean;
  staffRole?: "admin" | "moderator" | "support";
}

function deterministicEmailHash(email: string): string {
  const clean = email.trim().toLowerCase();
  let h1 = 0xdeadbeef,
    h2 = 0x41c64e6d;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const part1 = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(12, "0");
  const part2 = (4294967296 * (2097151 & h1) + (h2 >>> 0)).toString(16).padStart(12, "0");
  return `u_${(part1 + part2).slice(0, 24)}`;
}

export function canonicalUserIdFromEmail(email: string): string {
  return deterministicEmailHash(email);
}

export async function verifiedUserId(token: unknown): Promise<string | null> {
  const user = await getVerifiedUser(token);
  return user ? user.sub : null;
}

/**
 * GetUser verifies the access token with Cognito or verified federated/social tokens (Google, Apple).
 * If email is present, user identity is canonicalized to ensure Email, Google, and Apple logins
 * for the same email share the exact same user account, routes, and data.
 */
export async function getVerifiedUser(token: unknown): Promise<VerifiedUser | null> {
  if (typeof token !== "string" || !token || token.length > 8192) {
    return null;
  }

  const region = process.env.AWS_REGION;
  const poolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;

  if (!region || !poolId || !clientId) {
    return null;
  }

  // 1. Parse token claims if JWT
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    return null;
  }

  let claims: any;
  try {
    claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!claims || typeof claims !== "object") {
    return null;
  }

  if (typeof claims.sub !== "string" || !claims.sub.trim()) {
    return null;
  }

  const nowSec = Math.floor(Date.now() / 1000);

  // Check exp
  if (typeof claims.exp !== "number" || Number.isNaN(claims.exp) || claims.exp <= nowSec) {
    return null;
  }

  // Check nbf
  if (claims.nbf !== undefined) {
    if (typeof claims.nbf !== "number" || Number.isNaN(claims.nbf) || claims.nbf > nowSec) {
      return null;
    }
  }

  // 2. Social / Federated token verification (Google or Apple)
  const rawIss = String(claims.iss || "");
  const isGoogle = rawIss.includes("accounts.google.com");
  const isApple = rawIss.includes("appleid.apple.com");

  if (isGoogle || isApple) {
    // Cryptographically verify the signature before trusting any claim
    const jwks = isGoogle ? googleJWKS : appleJWKS;
    try {
      const verifyOpts: { issuer: string; audience?: string } = { issuer: rawIss };
      if (isGoogle && process.env.GOOGLE_CLIENT_ID) {
        verifyOpts.audience = process.env.GOOGLE_CLIENT_ID;
      }
      await jwtVerify(token, jwks, verifyOpts);
    } catch {
      return null;
    }

    if (typeof claims.email === "string" && claims.email.includes("@")) {
      const cleanEmail = claims.email.trim().toLowerCase();
      const socialEmailVerified =
        claims.email_verified === true || claims.email_verified === "true";

      // Look up existing Cognito account with this email to merge accounts.
      // If an email/password account already exists with the same email, use its
      // Cognito UUID so Google/Apple and email logins share the same DynamoDB records.
      try {
        const { CognitoIdentityProviderClient, ListUsersCommand } =
          await import("@aws-sdk/client-cognito-identity-provider");
        const cognito = new CognitoIdentityProviderClient({
          region,
          requestHandler: { requestTimeout: 4000 } as any,
        });
        const result = await cognito.send(
          new ListUsersCommand({
            UserPoolId: poolId,
            Filter: `email = "${cleanEmail.replace(/"/g, "")}"`,
            Limit: 1,
          }),
        );
        const cognitoUser = result.Users?.[0];
        if (cognitoUser?.Attributes) {
          const sub = cognitoUser.Attributes.find((a) => a.Name === "sub")?.Value;
          const role = cognitoUser.Attributes.find((a) => a.Name === "custom:role")?.Value;
          const emailVerifiedAttr =
            cognitoUser.Attributes.find((a) => a.Name === "email_verified")?.Value === "true";
          if (sub) {
            // Check suspension
            if (process.env.DYNAMODB_TABLE) {
              const { DynamoDBClient, GetItemCommand } = await import("@aws-sdk/client-dynamodb");
              const { unmarshall } = await import("@aws-sdk/util-dynamodb");
              const ddb = new DynamoDBClient({ region });
              const acct = await ddb.send(
                new GetItemCommand({
                  TableName: process.env.DYNAMODB_TABLE,
                  Key: { PK: { S: `USER#${sub}` }, SK: { S: "META" } },
                  ConsistentRead: true,
                  ProjectionExpression: "suspended",
                }),
              );
              if (acct.Item && unmarshall(acct.Item).suspended === true) return null;
            }
            // For social logins the Google/Apple JWT has no cognito:groups —
            // fall back to custom:role attribute set on the Cognito user record.
            const isAdmin = role === "admin";
            return {
              sub,
              originalSub: claims.sub,
              email: cleanEmail,
              isAdmin,
              emailVerified: socialEmailVerified || emailVerifiedAttr,
              ...(isAdmin ? { staffRole: "admin" as const } : {}),
            };
          }
        }
      } catch {
        // Cognito lookup failed — fall through to email-hash sub
      }

      // No existing Cognito account: use email hash as a stable sub for this social user.
      // JWT signature was already verified above — a valid signed Google/Apple token proves
      // the user authenticated with that provider, so treat as email-verified regardless of
      // whether the email_verified claim is present (Apple often omits it).
      const canonicalSub = canonicalUserIdFromEmail(cleanEmail);
      return {
        sub: canonicalSub,
        originalSub: claims.sub,
        email: cleanEmail,
        isAdmin: false,
        emailVerified: true,
      };
    }
    return null;
  }

  // 3. Cognito Access Token verification
  const domain = region.startsWith("cn-") ? "amazonaws.com.cn" : "amazonaws.com";
  const expectedIss = `https://cognito-idp.${region}.${domain}/${poolId}`;

  if (
    claims.iss !== expectedIss ||
    claims.client_id !== clientId ||
    claims.token_use !== "access"
  ) {
    return null;
  }

  const endpoint = `https://cognito-idp.${region}.${domain}`;

  try {
    const response = await fetch(`${endpoint}/`, {
      method: "POST",
      headers: {
        "content-type": "application/x-amz-json-1.1",
        "x-amz-target": "AWSCognitoIdentityProviderService.GetUser",
      },
      body: JSON.stringify({ AccessToken: token }),
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });

    if (response.ok) {
      const user = (await response.json()) as {
        Username?: string;
        UserAttributes?: Array<{ Name?: string; Value?: string } | null>;
      };
      if (Array.isArray(user?.UserAttributes)) {
        const sub = user.UserAttributes.find((a) => a?.Name === "sub")?.Value;
        if (typeof sub === "string" && sub === claims.sub) {
          const role = user.UserAttributes.find((a) => a?.Name === "custom:role")?.Value;
          const rawEmail = user.UserAttributes.find((a) => a?.Name === "email")?.Value;
          const email = rawEmail ? rawEmail.trim().toLowerCase() : undefined;
          const emailVerified =
            user.UserAttributes.find((a) => a?.Name === "email_verified")?.Value === "true";

          const effectiveSub = sub;

          // Check suspension on effectiveSub
          if (process.env.DYNAMODB_TABLE) {
            const { DynamoDBClient, GetItemCommand } = await import("@aws-sdk/client-dynamodb");
            const { unmarshall } = await import("@aws-sdk/util-dynamodb");
            const ddb = new DynamoDBClient({ region });
            const account = await ddb.send(
              new GetItemCommand({
                TableName: process.env.DYNAMODB_TABLE,
                Key: { PK: { S: `USER#${effectiveSub}` }, SK: { S: "META" } },
                ConsistentRead: true,
                ProjectionExpression: "suspended",
              }),
            );
            if (account.Item && unmarshall(account.Item).suspended === true) return null;
          }

          const groups: string[] = Array.isArray(claims["cognito:groups"])
            ? claims["cognito:groups"]
            : [];
          const isAdmin = process.env.ADMIN_GROUP_NAME
            ? groups.includes(process.env.ADMIN_GROUP_NAME)
            : role === "admin";
          const staffRole: "admin" | "moderator" | "support" | undefined = isAdmin
            ? "admin"
            : undefined;

          return {
            sub: effectiveSub,
            email,
            isAdmin,
            emailVerified,
            ...(staffRole ? { staffRole } : {}),
          };
        }
      }
    }
  } catch (e) {
    console.error("[auth] Cognito GetUser failed:", (e as Error).message);
  }

  return null;
}
