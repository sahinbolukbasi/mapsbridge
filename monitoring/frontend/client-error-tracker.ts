/**
 * MapsBridge Frontend Monitoring - Client Error Tracker
 * Automatically catches and transmits unhandled exceptions and promise rejections.
 */

export interface ClientErrorLog {
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  url: string;
  userAgent: string;
  timestamp: number;
}

export function initClientErrorTracking(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event: ErrorEvent) => {
    const payload: ClientErrorLog = {
      message: event.message || "Unknown client error",
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    };
    sendErrorTelemetry(payload);
  });

  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    const payload: ClientErrorLog = {
      message: event.reason?.message || String(event.reason) || "Unhandled promise rejection",
      stack: event.reason?.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    };
    sendErrorTelemetry(payload);
  });
}

function sendErrorTelemetry(payload: ClientErrorLog): void {
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    navigator.sendBeacon("/api/telemetry/errors", blob);
  }
}
