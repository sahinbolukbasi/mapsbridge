/**
 * Stripe Webhook Security Middleware
 * Validates Stripe webhook signatures to prevent replay attacks
 * Implements signature verification per Stripe best practices
 */

import { createHmac } from "crypto";
import { resolveEnvSecret } from "../shared/http";
import { BillingError } from "./store";

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
}

export interface VerifiedWebhook {
  event: StripeWebhookEvent;
  signature: string;
  timestamp: number;
}

export class StripeWebhookValidator {
  private secret: string | null = null;

  constructor() {}

  /**
   * Initialize validator with Stripe webhook secret
   */
  async initialize(): Promise<void> {
    if (this.secret) return;
    
    const secretKey = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secretKey) {
      throw new BillingError(503, 'STRIPE_NOT_CONFIGURED', 'Stripe webhook secret not configured');
    }

    // Resolve SSM secret if prefixed with "secret:"
    this.secret = secretKey.startsWith('secret:') 
      ? await resolveEnvSecret(secretKey)
      : secretKey;

    // Validate webhook secret format
    if (!/^whsec_[A-Za-z0-9]+$/.test(this.secret)) {
      throw new BillingError(500, 'INVALID_WEBHOOK_SECRET', 'Invalid Stripe webhook secret format');
    }
  }

  /**
   * Verify Stripe webhook signature
   * @param payload Raw request body
   * @param signature Signature from Stripe-Signature header
   * @returns Verified webhook event
   */
  async verify(payload: string, signature: string): Promise<VerifiedWebhook> {
    await this.initialize();
    
    if (!signature) {
      throw new BillingError(401, 'MISSING_SIGNATURE', 'Stripe signature header is missing');
    }

    const signatureParts = this.parseSignature(signature);
    const expectedSignature = this.computeSignature(payload, signatureParts.timestamp);

    // Timing-safe comparison
    if (!this.timingSafeCompare(expectedSignature, signatureParts.v1)) {
      throw new BillingError(401, 'INVALID_SIGNATURE', 'Stripe signature verification failed');
    }

    // Check timestamp tolerance (default: 5 minutes)
    const tolerance = parseInt(process.env.STRIPE_SIGNATURE_TOLERANCE || '300');
    const now = Math.floor(Date.now() / 1000);
    
    if (Math.abs(now - signatureParts.timestamp) > tolerance) {
      throw new BillingError(401, 'TIMESTAMP_OUT_OF_RANGE', 'Webhook timestamp is outside tolerance');
    }

    // Parse payload as event
    let event: StripeWebhookEvent;
    try {
      event = JSON.parse(payload);
    } catch (error) {
      throw new BillingError(400, 'INVALID_PAYLOAD', 'Unable to parse webhook payload');
    }

    // Validate event structure
    if (!event.id || !event.type || !event.data?.object) {
      throw new BillingError(400, 'INVALID_EVENT', 'Invalid webhook event structure');
    }

    return {
      event,
      signature,
      timestamp: signatureParts.timestamp,
    };
  }

  /**
   * Parse Stripe signature header
   * Format: t=1234567890,v1=signature_hex,v0=deprecated_signature_hex
   */
  private parseSignature(signature: string): { timestamp: number; v1: string; v0?: string } {
    const parts: Record<string, string> = {};
    
    for (const part of signature.split(',')) {
      const [key, value] = part.split('=', 2);
      if (key && value) {
        parts[key] = value;
      }
    }

    if (!parts.t || !parts.v1) {
      throw new BillingError(401, 'MALFORMED_SIGNATURE', 'Stripe signature header is malformed');
    }

    const timestamp = parseInt(parts.t);
    if (!Number.isInteger(timestamp) || timestamp < 0) {
      throw new BillingError(401, 'INVALID_TIMESTAMP', 'Invalid signature timestamp');
    }

    return {
      timestamp,
      v1: parts.v1,
      v0: parts.v0,
    };
  }

  /**
   * Compute expected signature using Stripe's algorithm
   */
  private computeSignature(payload: string, timestamp: number): string {
    if (!this.secret) {
      throw new Error('Stripe webhook secret not initialized');
    }

    const signedPayload = `${timestamp}.${payload}`;
    return createHmac('sha256', this.secret)
      .update(signedPayload, 'utf8')
      .digest('hex');
  }

  /**
   * Timing-safe string comparison to prevent timing attacks
   */
  private timingSafeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return diff === 0;
  }

  /**
   * Middleware factory for Lambda handlers
   */
  static createMiddleware() {
    const validator = new StripeWebhookValidator();

    return async (event: any, context: any, next: Function) => {
      const signature = event.headers?.["stripe-signature"] || event.headers?.["Stripe-Signature"];
      const payload = event.body;

      if (!payload) {
        throw new BillingError(400, 'MISSING_PAYLOAD', 'Webhook payload is missing');
      }

      try {
        const verified = await validator.verify(payload, signature);
        
        // Add verified event to context
        context.stripe = {
          event: verified.event,
          signature: verified.signature,
          timestamp: verified.timestamp,
        };

        return next();
      } catch (error) {
        console.error("[StripeWebhookValidator] Verification failed:", error);
        throw error;
      }
    };
  }
}

/**
 * Utility to validate webhook event types
 */
export class StripeWebhookEventValidator {
  static isCheckoutCompleted(event: StripeWebhookEvent): boolean {
    return event.type === "checkout.session.completed";
  }

  static isPaymentSucceeded(event: StripeWebhookEvent): boolean {
    return event.type === "payment_intent.succeeded";
  }

  static isInvoicePaid(event: StripeWebhookEvent): boolean {
    return event.type === "invoice.payment_succeeded";
  }

  static isCustomerSubscriptionUpdated(event: StripeWebhookEvent): boolean {
    return event.type === "customer.subscription.updated";
  }

  static isCustomerSubscriptionDeleted(event: StripeWebhookEvent): boolean {
    return event.type === "customer.subscription.deleted";
  }

  /**
   * Validate event contains required data
   */
  static validateEventData(event: StripeWebhookEvent, requiredFields: string[]): boolean {
    const object = event.data.object;
    return requiredFields.every(field => {
      const keys = field.split(".");
      let current = object;
      for (const key of keys) {
        if (current?.[key] === undefined) return false;
        current = current[key];
      }
      return true;
    });
  }
}

export default StripeWebhookValidator;