/**
 * MapsBridge Frontend Monitoring - Core Web Vitals Reporter
 * Tracks real-user experience metrics (LCP, FID, CLS, INP, TTFB).
 */

export interface MetricPayload {
  name: "LCP" | "FID" | "CLS" | "INP" | "TTFB";
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
  id: string;
  url: string;
  timestamp: number;
}

export function reportWebVitals(metric: MetricPayload): void {
  // Log locally in development
  if (process.env.NODE_ENV !== "production") {
     
    console.debug(`[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`);
    return;
  }

  // Beacon to telemetry endpoint in production
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([JSON.stringify(metric)], { type: "application/json" });
    navigator.sendBeacon("/api/telemetry/web-vitals", blob);
  }
}
