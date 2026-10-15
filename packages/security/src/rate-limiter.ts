/**
 * Rate Limiter Middleware
 * Implements sliding window rate limiting using DynamoDB
 * Supports per-user, per-IP, and per-endpoint limiting
 */

import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix: string; // DynamoDB key prefix (USER# or IP#)
  key: string; // User ID or IP address
  endpoint?: string; // Optional: per-endpoint limiting
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  current: number;
}

export class RateLimiter {
  private ddb: DynamoDBClient;
  private tableName: string;

  constructor(region: string = process.env.AWS_REGION || "us-east-1") {
    this.ddb = new DynamoDBClient({ region });
    this.tableName = process.env.DYNAMODB_TABLE || "";
    if (!this.tableName) {
      throw new Error("DYNAMODB_TABLE environment variable is required");
    }
  }

  /**
   * Check if request is within rate limit
   */
  async checkLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Create composite key for endpoint-specific limiting
    const sk = config.endpoint
      ? `RATELIMIT#${config.endpoint}#${Math.floor(now / config.windowMs)}`
      : `RATELIMIT#${Math.floor(now / config.windowMs)}`;

    const pk = `${config.keyPrefix}${config.key}`;

    try {
      // Atomically increment counter and get current value
      const result = await this.ddb.send(
        new UpdateItemCommand({
          TableName: this.tableName,
          Key: marshall({ PK: pk, SK: sk }),
          UpdateExpression: `
          ADD #count :increment
          SET #ttl = :ttl, #window = :window
        `,
          ExpressionAttributeNames: {
            "#count": "requestCount",
            "#ttl": "ttl",
            "#window": "windowStart",
          },
          ExpressionAttributeValues: marshall({
            ":increment": 1,
            ":ttl": Math.floor((now + config.windowMs + 60000) / 1000), // TTL with 1min buffer
            ":window": windowStart,
          }),
          ReturnValues: "ALL_NEW",
        }),
      );

      const data = unmarshall(result.Attributes || {});
      const currentCount = data.requestCount || 0;
      const windowStartTime = data.windowStart || windowStart;

      // If we're in a new window, reset the count
      const isNewWindow = windowStartTime < now - config.windowMs;
      if (isNewWindow) {
        // Delete old window and start fresh
        await this.ddb.send(
          new UpdateItemCommand({
            TableName: this.tableName,
            Key: marshall({ PK: pk, SK: sk }),
            UpdateExpression: "SET #count = :one, #window = :now",
            ExpressionAttributeNames: { "#count": "requestCount", "#window": "windowStart" },
            ExpressionAttributeValues: marshall({ ":one": 1, ":now": now }),
          }),
        );

        return {
          allowed: true,
          remaining: config.maxRequests - 1,
          resetAt: now + config.windowMs,
          current: 1,
        };
      }

      const allowed = currentCount <= config.maxRequests;
      const remaining = Math.max(0, config.maxRequests - currentCount);

      return {
        allowed,
        remaining,
        resetAt: windowStartTime + config.windowMs,
        current: currentCount,
      };
    } catch (error) {
      console.error("[RateLimiter] Error:", error);
      // Fail open: allow request if rate limiter fails
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: now + config.windowMs,
        current: 0,
      };
    }
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getLimitStatus(config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now();
    const sk = config.endpoint
      ? `RATELIMIT#${config.endpoint}#${Math.floor(now / config.windowMs)}`
      : `RATELIMIT#${Math.floor(now / config.windowMs)}`;

    const pk = `${config.keyPrefix}${config.key}`;

    try {
      const result = await this.ddb.send(
        new GetItemCommand({
          TableName: this.tableName,
          Key: marshall({ PK: pk, SK: sk }),
          ProjectionExpression: "requestCount, windowStart",
        }),
      );

      if (!result.Item) {
        return {
          allowed: true,
          remaining: config.maxRequests,
          resetAt: now + config.windowMs,
          current: 0,
        };
      }

      const data = unmarshall(result.Item);
      const currentCount = data.requestCount || 0;
      const windowStartTime = data.windowStart || now - config.windowMs;
      const isNewWindow = windowStartTime < now - config.windowMs;

      if (isNewWindow) {
        return {
          allowed: true,
          remaining: config.maxRequests,
          resetAt: now + config.windowMs,
          current: 0,
        };
      }

      const allowed = currentCount < config.maxRequests;
      const remaining = Math.max(0, config.maxRequests - currentCount);

      return {
        allowed,
        remaining,
        resetAt: windowStartTime + config.windowMs,
        current: currentCount,
      };
    } catch (error) {
      console.error("[RateLimiter] Get status error:", error);
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: now + config.windowMs,
        current: 0,
      };
    }
  }
}

/**
 * Factory function to create rate limiter middleware for Lambda handlers
 */
export function createRateLimitMiddleware(options: {
  windowMs: number;
  maxRequests: number;
  keyPrefix: "USER" | "IP";
  endpoint?: string;
  skipSuccessful?: boolean;
}) {
  const rateLimiter = new RateLimiter();

  return async (event: any, context: any, next: Function) => {
    const key =
      options.keyPrefix === "USER" ? event.verifiedUser?.sub : event.requestContext?.http?.sourceIp;

    if (!key) {
      // Skip rate limiting if no key available
      return next();
    }

    const result = await rateLimiter.checkLimit({
      windowMs: options.windowMs,
      maxRequests: options.maxRequests,
      keyPrefix: `${options.keyPrefix}#`,
      key,
      endpoint: options.endpoint,
    });

    // Add rate limit headers to response
    context.rateLimit = {
      limit: options.maxRequests,
      remaining: result.remaining,
      reset: Math.floor(result.resetAt / 1000),
    };

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      throw {
        statusCode: 429,
        headers: {
          "retry-after": retryAfter.toString(),
          "x-ratelimit-limit": options.maxRequests.toString(),
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": context.rateLimit.reset.toString(),
        },
        body: JSON.stringify({
          error: "Too many requests",
          message: `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
        }),
      };
    }

    return next();
  };
}

export default RateLimiter;
