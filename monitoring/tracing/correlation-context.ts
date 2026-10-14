/**
 * MapsBridge Distributed Tracing - Correlation Context
 * Ensures x-correlation-id propagation across Microservices, Lambda handlers, and EventBridge.
 */

export interface TracingContext {
  correlationId: string;
  userId?: string;
  sourceService: string;
  timestamp: number;
}

export function extractOrGenerateCorrelationId(headers?: Record<string, string | undefined>): string {
  if (headers) {
    const existing =
      headers["x-correlation-id"] ||
      headers["X-Correlation-Id"] ||
      headers["x-request-id"] ||
      headers["x-amzn-trace-id"];
    if (existing && existing.trim()) {
      return existing.trim();
    }
  }

  // Generate standard UUID v4 equivalent
  return `mb-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

export function createTraceHeaders(context: TracingContext): Record<string, string> {
  return {
    "x-correlation-id": context.correlationId,
    "x-source-service": context.sourceService,
    "x-origin-timestamp": String(context.timestamp),
  };
}
