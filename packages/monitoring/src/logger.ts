/**
 * Enhanced Monitoring and Logging
 * Comprehensive monitoring for MapsBridge services
 */

import { createLogger, transports, format } from "winston";
import { PerformanceObserver } from "perf_hooks";

// Create logger with multiple transports
export const logger = createLogger({
  level: "info",
  format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
    new transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: "50m",
      maxFiles: 5,
    }),
    new transports.File({
      filename: "logs/combined.log",
      maxsize: "50m",
      maxFiles: 5,
    }),
  ],
});

// Performance monitoring
export class PerformanceMonitor {
  private observer: PerformanceObserver;

  constructor() {
    this.observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === "measure") {
          logger.info(`Performance Measure: ${entry.name}`, {
            duration: entry.duration,
            startTime: entry.startTime,
            endTime: entry.startTime + entry.duration,
          });
        }
      });
    });
    this.observer.observe({ entryTypes: ["measure"] });
  }

  // Start performance measurement
  startMeasure(name: string) {
    performance.mark(`${name}-start`);
  }

  // End performance measurement
  endMeasure(name: string) {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    performance.clearMarks(`${name}-start`);
    performance.clearMarks(`${name}-end`);
  }

  // Monitor memory usage
  monitorMemory() {
    const usage = process.memoryUsage();
    logger.debug("Memory Usage", {
      rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(usage.external / 1024 / 1024)} MB`,
    });
  }
}

// Global error handler
export function setupGlobalErrorHandler() {
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", error);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  });
}

// API response logging
export function logApiResponse(
  endpoint: string,
  statusCode: number,
  duration: number,
  userId?: string,
) {
  logger.info("API Request", {
    endpoint,
    statusCode,
    duration,
    userId,
    timestamp: new Date().toISOString(),
  });
}

// Security event logging
export function logSecurityEvent(event: string, details: any = {}) {
  logger.warn("Security Event", {
    event,
    details,
    timestamp: new Date().toISOString(),
  });
}

// Resource usage monitoring
export function monitorResources() {
  setInterval(() => {
    const cpuUsage = process.cpuUsage();
    const memory = process.memoryUsage();

    logger.debug("System Resources", {
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      memory: {
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
      },
      timestamp: new Date().toISOString(),
    });
  }, 30000); // Every 30 seconds
}
