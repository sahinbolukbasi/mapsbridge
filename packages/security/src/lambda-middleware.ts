/**
 * Lambda Middleware Wrappers
 *
 * Higher-order functions that wrap Lambda handlers with cross-cutting concerns
 * such as rate limiting and authentication. Designed to work with API Gateway v2
 * (HTTP API) events but self-contained so this package has no dependency on the
 * infra layer.
 */

import { RateLimiter } from "./rate-limiter";

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

/** Minimal representation of an API Gateway v2 (HTTP API) event. */
export interface LambdaEvent {
  headers?: Record<string, string | undefined>;
  body?: string | null;
  rawPath?: string;
  requestContext: {
    http: { method: string; path: string; sourceIp: string };
    requestId: string;
    authorizer?: { jwt?: { claims?: Record<string, string> } };
  };
  /** Auth context attached by the `withAuth` middleware. */
  authContext?: { userId: string; token: string; [key: string]: unknown };
  [key: string]: unknown;
}

/** Standard Lambda proxy-integration response. */
export interface LambdaResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/** A Lambda handler function. */
export type LambdaHandler = (event: LambdaEvent, context?: unknown) => Promise<LambdaResponse>;

/** A middleware is a function that wraps a handler and returns a new handler. */
export type Middleware = (handler: LambdaHandler) => LambdaHandler;

// ---------------------------------------------------------------------------
// withRateLimit
// ---------------------------------------------------------------------------

/** Options for the {@link withRateLimit} middleware. */
export interface RateLimitOptions {
  /** Time window in milliseconds. @default 60_000 (1 minute) */
  windowMs?: number;
  /** Maximum requests allowed per window. @default 100 */
  maxRequests?: number;
  /**
   * Extract the rate-limit key from the event.
   * Defaults to the source IP (`event.requestContext.http.sourceIp`).
   */
  keyExtractor?: (event: LambdaEvent) => string;
  /** Optional endpoint identifier for per-endpoint limiting. */
  endpoint?: string;
  /**
   * When `true`, requests are allowed through if the rate limiter itself
   * throws an error (e.g. DynamoDB is unreachable).
   * @default true
   */
  failOpen?: boolean;
}

/**
 * Wrap a Lambda handler with sliding-window rate limiting backed by DynamoDB.
 *
 * @example
 * ```ts
 * export const handler = withRateLimit(baseHandler, {
 *   windowMs: 60_000,
 *   maxRequests: 50,
 *   endpoint: "POST /api/messages",
 * });
 * ```
 */
export function withRateLimit(
  handler: LambdaHandler,
  options: RateLimitOptions = {},
): LambdaHandler {
  const {
    windowMs = 60_000,
    maxRequests = 100,
    keyExtractor = (event: LambdaEvent) => event.requestContext.http.sourceIp,
    endpoint,
    failOpen = true,
  } = options;

  const rateLimiter = new RateLimiter();

  return async (event: LambdaEvent, context?: unknown): Promise<LambdaResponse> => {
    const key = keyExtractor(event);

    let allowed = true;
    let remaining = maxRequests;
    let resetAt = Date.now() + windowMs;

    try {
      const result = await rateLimiter.checkLimit({
        windowMs,
        maxRequests,
        keyPrefix: "IP#",
        key,
        endpoint,
      });

      allowed = result.allowed;
      remaining = result.remaining;
      resetAt = result.resetAt;
    } catch (error) {
      console.error("[withRateLimit] Rate limiter error:", error);
      if (!failOpen) {
        return {
          statusCode: 500,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ error: "Internal server error" }),
        };
      }
      // failOpen: fall through with defaults (allowed = true)
    }

    const rateLimitHeaders: Record<string, string> = {
      "x-ratelimit-limit": maxRequests.toString(),
      "x-ratelimit-remaining": remaining.toString(),
      "x-ratelimit-reset": Math.floor(resetAt / 1000).toString(),
    };

    if (!allowed) {
      const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
      return {
        statusCode: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": retryAfter.toString(),
          ...rateLimitHeaders,
        },
        body: JSON.stringify({
          error: "Too many requests",
          message: `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
        }),
      };
    }

    const response = await handler(event, context);

    // Merge rate-limit headers into the successful response.
    response.headers = { ...response.headers, ...rateLimitHeaders };

    return response;
  };
}

// ---------------------------------------------------------------------------
// withAuth
// ---------------------------------------------------------------------------

/** A function that verifies a bearer token and returns user info or `null`. */
export type VerifyTokenFn = (
  token: string,
) => Promise<{ userId: string; [key: string]: unknown } | null>;

/** Options for the {@link withAuth} middleware. */
export interface AuthOptions {
  /**
   * Extract the bearer token from the event.
   * Defaults to reading the `Authorization` header and stripping the `Bearer ` prefix.
   */
  tokenExtractor?: (event: LambdaEvent) => string | null;
  /**
   * Verify the token and return user information.
   * Must be provided -- there is no default implementation because this
   * package does not depend on the auth layer.
   */
  verifyToken: VerifyTokenFn;
  /**
   * Optional custom handler invoked when the request is unauthorized.
   * If not provided a standard 401 JSON response is returned.
   */
  onUnauthorized?: (event: LambdaEvent) => Promise<LambdaResponse> | LambdaResponse;
}

/**
 * Default token extractor: reads the `Authorization` header and strips the
 * `Bearer ` prefix. Header lookup is case-insensitive.
 */
function defaultTokenExtractor(event: LambdaEvent): string | null {
  const headers = event.headers ?? {};

  // API Gateway may normalise header names to lower-case, but we handle both.
  const authHeader = headers["authorization"] ?? headers["Authorization"] ?? null;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice(7);
}

/**
 * Wrap a Lambda handler with bearer-token authentication.
 *
 * On success the verified user information is attached to the event as
 * `event.authContext` so downstream handlers can access `event.authContext.userId`.
 *
 * @example
 * ```ts
 * export const handler = withAuth(baseHandler, {
 *   verifyToken: async (token) => {
 *     const userId = await verifiedUserId(token);
 *     return userId ? { userId } : null;
 *   },
 * });
 * ```
 */
export function withAuth(handler: LambdaHandler, options: AuthOptions): LambdaHandler {
  const { tokenExtractor = defaultTokenExtractor, verifyToken, onUnauthorized } = options;

  return async (event: LambdaEvent, context?: unknown): Promise<LambdaResponse> => {
    const token = tokenExtractor(event);

    if (!token) {
      if (onUnauthorized) {
        return onUnauthorized(event);
      }
      return {
        statusCode: 401,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Unauthorized", message: "Missing bearer token" }),
      };
    }

    const user = await verifyToken(token);

    if (!user) {
      if (onUnauthorized) {
        return onUnauthorized(event);
      }
      return {
        statusCode: 401,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Unauthorized", message: "Invalid or expired token" }),
      };
    }

    // Attach auth context to the event for downstream handlers.
    event.authContext = { ...user, userId: user.userId, token };

    return handler(event, context);
  };
}

// ---------------------------------------------------------------------------
// compose
// ---------------------------------------------------------------------------

/**
 * Compose multiple middleware wrappers into a single wrapper.
 *
 * Middlewares are applied **right-to-left** so the first middleware in the
 * argument list is the outermost wrapper (executed first on the way in, last
 * on the way out) -- the same order as mathematical function composition.
 *
 * @example
 * ```ts
 * const secured = compose(
 *   (h) => withRateLimit(h, { maxRequests: 50 }),
 *   (h) => withAuth(h, { verifyToken }),
 * );
 *
 * export const handler = secured(baseHandler);
 * // Equivalent to: withRateLimit(withAuth(baseHandler, ...), ...)
 * ```
 */
export function compose(...middlewares: Middleware[]): Middleware {
  if (middlewares.length === 0) {
    return (handler) => handler;
  }

  return (handler: LambdaHandler): LambdaHandler =>
    middlewares.reduceRight<LambdaHandler>((wrapped, middleware) => middleware(wrapped), handler);
}
