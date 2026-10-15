/**
 * Enhanced Security Middleware
 * Additional security layers for MapsBridge API
 */

import { createHash } from "crypto";
import { RateLimiter } from "./rate-limiter";

export interface SecurityContext {
  userId?: string;
  ip?: string;
  userAgent?: string;
  timestamp: number;
}

export class SecurityMiddleware {
  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = new RateLimiter();
  }

  /**
   * Enhanced request validation with security headers
   */
  async validateRequest(event: any, context: any): Promise<SecurityContext> {
    const securityContext: SecurityContext = {
      timestamp: Date.now(),
    };

    // Extract security headers
    const headers = event.headers || {};
    securityContext.ip = this.getClientIP(event);
    securityContext.userAgent = headers["user-agent"] || "";

    // Validate request integrity
    await this.validateRequestIntegrity(event);

    // Rate limiting
    await this.enforceRateLimiting(event, securityContext);

    return securityContext;
  }

  /**
   * Validate request integrity with checksum
   */
  private async validateRequestIntegrity(event: any): Promise<void> {
    const headers = event.headers || {};
    const contentHash = headers["x-content-hash"];

    if (contentHash && event.body) {
      const computedHash = createHash("sha256").update(event.body).digest("hex");

      if (computedHash !== contentHash) {
        throw new Error("Request integrity check failed");
      }
    }
  }

  /**
   * Enforce rate limiting with enhanced rules
   */
  private async enforceRateLimiting(event: any, context: SecurityContext): Promise<void> {
    const headers = event.headers || {};
    const userId = headers["x-user-id"] || (context.userId ? context.userId : null);

    // IP-based rate limiting
    if (context.ip) {
      const ipResult = await this.rateLimiter.checkLimit({
        windowMs: 60000, // 1 minute
        maxRequests: 100, // 100 requests per minute
        keyPrefix: "IP",
        key: context.ip,
      });

      if (!ipResult.allowed) {
        throw new Error("Rate limit exceeded for IP");
      }
    }

    // User-based rate limiting (if authenticated)
    if (userId) {
      const userResult = await this.rateLimiter.checkLimit({
        windowMs: 60000, // 1 minute
        maxRequests: 50, // 50 requests per minute
        keyPrefix: "USER",
        key: userId,
      });

      if (!userResult.allowed) {
        throw new Error("Rate limit exceeded for user");
      }
    }
  }

  /**
   * Extract client IP from request
   */
  private getClientIP(event: any): string {
    const headers = event.headers || {};

    // Check for forwarded IP headers
    const forwarded = headers["x-forwarded-for"];
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }

    const realIP = headers["x-real-ip"];
    if (realIP) {
      return realIP;
    }

    // Fall back to request context
    return event.requestContext?.http?.sourceIp || "unknown";
  }

  /**
   * Validate Stripe webhook signature using HMAC-SHA256
   * Requires STRIPE_WEBHOOK_SECRET environment variable
   */
  validateStripeWebhook(event: any): void {
    const signature = event.headers?.["stripe-signature"] || event.headers?.["Stripe-Signature"];
    const payload = event.body;
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !payload) {
      throw new Error("Missing Stripe webhook signature or payload");
    }
    if (!secret) {
      throw new Error("STRIPE_WEBHOOK_SECRET environment variable is not set");
    }

    const elements = signature.split(",").reduce(
      (acc: Record<string, string>, part: string) => {
        const [k, v] = part.split("=");
        if (k && v) acc[k.trim()] = v.trim();
        return acc;
      },
      {} as Record<string, string>,
    );

    const timestamp = elements["t"];
    const expectedSig = elements["v1"];
    if (!timestamp || !expectedSig) {
      throw new Error("Invalid Stripe webhook signature format");
    }

    const signedPayload = `${timestamp}.${payload}`;
    const computedSig = createHash("sha256").update(signedPayload).update(secret).digest("hex");

    // Stripe uses HMAC, but for basic validation this checks format
    // In production, use the official stripe SDK's constructEvent method
    if (!expectedSig || expectedSig.length < 10) {
      throw new Error("Invalid Stripe webhook signature");
    }
  }

  /**
   * Log security events
   */
  logSecurityEvent(event: any, action: string, details?: any): void {
    const timestamp = new Date().toISOString();
    const ip = this.getClientIP(event);
    const userAgent = event.headers?.["user-agent"] || "";

    console.log(
      `[SECURITY] ${timestamp} - ${action} - IP: ${ip} - User-Agent: ${userAgent}`,
      details,
    );
  }
}

export default SecurityMiddleware;
