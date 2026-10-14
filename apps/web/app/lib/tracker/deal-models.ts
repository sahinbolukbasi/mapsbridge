/**
 * MapsBridge Deal & Ticket Tracker Models
 */

export type TrackerType = 'flight' | 'hotel';
export type TrackerStatus = 'active' | 'triggered' | 'paused' | 'expired';

export interface DealItem {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  currency: string;
  provider: string;
  bookingUrl?: string;
  highlights: string[];
  foundAt: string;
}

export interface TrackerJob {
  id: string;
  userId: string;
  userEmail: string;
  type: TrackerType;
  title: string;
  origin?: string;
  destination: string;
  dates?: string;
  targetPrice?: number;
  currency: string;
  status: TrackerStatus;
  lastCheckedAt?: string;
  currentBestPrice?: number;
  notificationSent?: boolean;
  dealsFound: DealItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTrackerRequest {
  type: TrackerType;
  title?: string;
  origin?: string;
  destination: string;
  dates?: string;
  targetPrice?: number;
  userEmail?: string;
}

export interface SystemCapacityMetrics {
  activeTrackersCount: number;
  supportedConcurrentUsers: number;
  cacheHitRatePercent: number;
  queueStatus: 'healthy' | 'degraded' | 'overloaded';
  averageExecutionLatencyMs: number;
  circuitBreakerStatus: 'closed' | 'open' | 'half-open';
}
