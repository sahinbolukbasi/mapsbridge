import type { TripProfile } from "../types";
import { runFoodAgent, type FoodAgentOutput } from "./food-agent";
import { runCarRentalAgent, type CarRentalAgentOutput } from "./car-rental-agent";
import { runCityTransitAgent, type CityTransitAgentOutput } from "./city-transit-agent";
import { runCityIntelAgent, type CityIntelAgentOutput } from "./city-intel-agent";
import { runHotelDealAgent, type HotelDealOutput } from "./hotel-deal-agent";
import { runFlightAgent, type FlightAgentOutput } from "./flight-agent";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentDispatchResult {
  agentId: string;
  agentName: string;
  icon: string;
  status: "completed" | "failed" | "timeout" | "skipped";
  durationMs: number;
  data?: unknown;
  summaryNote?: string;
}

export interface DispatchOptions {
  request: string;
  destination: string;
  profile: TripProfile;
  mode: "chat" | "route";
  enabledAgents: Set<string>;
  timeoutMs: number;
  startedAt: number;
}

// ---------------------------------------------------------------------------
// Agent registry — metadata + relevance patterns
// ---------------------------------------------------------------------------

interface AgentEntry {
  id: string;
  name: string;
  icon: string;
  pattern: RegExp;
  /** If true, the agent is always dispatched in route mode (when enabled). */
  alwaysInRoute: boolean;
}

const AGENT_REGISTRY: AgentEntry[] = [
  {
    id: "food",
    name: "Gastronomi Uzmanı",
    icon: "🍽️",
    pattern:
      /yemek|restoran|kahve|lezzet|mutfak|nerede yiyelim|açlık|breakfast|lunch|dinner|cafe/iu,
    alwaysInRoute: true,
  },
  {
    id: "car-rental",
    name: "Araç Kiralama Uzmanı",
    icon: "🚗",
    pattern: /araç|araba|kiralama|kiralık|ehliyet|sürüş|rent.*car|driving/iu,
    alwaysInRoute: false,
  },
  {
    id: "city-transit",
    name: "Şehir İçi Ulaşım Uzmanı",
    icon: "🚇",
    pattern: /metro|otobüs|tramvay|toplu taşıma|ulaşım kartı|bilet|tren|bus|subway/iu,
    alwaysInRoute: true,
  },
  {
    id: "city-intel",
    name: "Şehir İstihbaratı",
    icon: "🌐",
    pattern: /güvenlik|hava durumu|sezon|ne zaman gidilir|nasıl bir şehir|genel bilgi|overview/iu,
    alwaysInRoute: false,
  },
  {
    id: "hotel-deal",
    name: "Otel Fırsat Takipçisi",
    icon: "🏨",
    pattern: /otel|konaklama|hotel|nerede kal|airbnb|hostel|booking/iu,
    alwaysInRoute: false,
  },
  {
    id: "flight",
    name: "Uçuş ve Havalimanı Uzmanı",
    icon: "✈️",
    pattern: /uçuş|uçak|bilet|havayolu|flight|nasıl giderim/iu,
    alwaysInRoute: false,
  },
];

// ---------------------------------------------------------------------------
// Simple query detection — prevents unnecessary fan-out
// ---------------------------------------------------------------------------

/**
 * Returns true when the request is too short or trivially simple to warrant
 * dispatching background sub-agents, even in route mode.
 * Examples: greetings, single-word inputs, acknowledgements.
 */
function isSimpleQuery(request: string): boolean {
  const trimmed = request.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount < 4) return true;
  return /^(merhaba|selam|hi|hello|hey|tamam|ok|teşekkür|thanks?|evet|hayır|güzel|anladım|harika)[.,!?]*$/iu.test(
    trimmed,
  );
}

// ---------------------------------------------------------------------------
// Relevance detection
// ---------------------------------------------------------------------------

function detectRelevantAgents(
  request: string,
  mode: "chat" | "route",
  enabledAgents: Set<string>,
): AgentEntry[] {
  const simple = isSimpleQuery(request);

  return AGENT_REGISTRY.filter((entry) => {
    // Must be enabled via feature flags
    if (!enabledAgents.has(entry.id)) return false;

    // In route mode, always include agents marked alwaysInRoute —
    // but skip them when the request is a simple/trivial query to avoid fan-out.
    if (mode === "route" && entry.alwaysInRoute && !simple) return true;

    // Otherwise check if the request text matches the agent's pattern
    return entry.pattern.test(request);
  });
}

// ---------------------------------------------------------------------------
// Individual agent runner wrappers (normalise signatures)
// ---------------------------------------------------------------------------

type AgentRunner = (
  destination: string,
  profile: TripProfile,
  timeoutMs: number,
) => Promise<{ data: unknown; durationMs: number }>;

function wrapFood(destination: string, profile: TripProfile, timeoutMs: number) {
  return runFoodAgent(destination, profile, timeoutMs).then((r) => ({
    data: r.output as unknown,
    durationMs: r.durationMs,
  }));
}

function wrapCarRental(destination: string, profile: TripProfile, timeoutMs: number) {
  return runCarRentalAgent(destination, profile, timeoutMs).then((r) => ({
    data: r.output as unknown,
    durationMs: r.durationMs,
  }));
}

function wrapCityTransit(destination: string, profile: TripProfile, timeoutMs: number) {
  return runCityTransitAgent(destination, profile, timeoutMs).then((r) => ({
    data: r.output as unknown,
    durationMs: r.durationMs,
  }));
}

function wrapCityIntel(destination: string, profile: TripProfile, timeoutMs: number) {
  return runCityIntelAgent(destination, profile, timeoutMs).then((r) => ({
    data: r.output as unknown,
    durationMs: r.durationMs,
  }));
}

function wrapHotelDeal(destination: string, profile: TripProfile, timeoutMs: number) {
  const dates =
    profile.dates?.start && profile.dates?.end
      ? `${profile.dates.start} - ${profile.dates.end}`
      : undefined;
  return runHotelDealAgent(destination, dates, profile, timeoutMs).then((r) => ({
    data: r.output as unknown,
    durationMs: r.durationMs,
  }));
}

function wrapFlight(destination: string, profile: TripProfile, timeoutMs: number) {
  return runFlightAgent(destination, profile, timeoutMs).then((r) => ({
    data: r.output as unknown,
    durationMs: r.durationMs,
  }));
}

const RUNNERS: Record<string, AgentRunner> = {
  food: wrapFood,
  "car-rental": wrapCarRental,
  "city-transit": wrapCityTransit,
  "city-intel": wrapCityIntel,
  "hotel-deal": wrapHotelDeal,
  flight: wrapFlight,
};

// ---------------------------------------------------------------------------
// Timeout helper
// ---------------------------------------------------------------------------

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error("Agent timeout");
      err.name = "TimeoutError";
      reject(err);
    }, ms);

    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

export async function dispatchSubAgents(opts: DispatchOptions): Promise<AgentDispatchResult[]> {
  const { request, destination, profile, mode, enabledAgents, timeoutMs, startedAt } = opts;

  const relevant = detectRelevantAgents(request, mode, enabledAgents);

  if (relevant.length === 0) {
    return [];
  }

  // Calculate remaining time budget for sub-agents
  const elapsed = Date.now() - startedAt;
  const remainingMs = Math.max(0, timeoutMs - elapsed);

  if (remainingMs < 500) {
    // Not enough time to run any sub-agent
    return relevant.map((entry) => ({
      agentId: entry.id,
      agentName: entry.name,
      icon: entry.icon,
      status: "skipped" as const,
      durationMs: 0,
      summaryNote: "Zaman butcesi yetersiz, agent atlandı.",
    }));
  }

  // Per-agent timeout: share the remaining budget, capped at 5000ms per agent
  const perAgentTimeout = Math.min(5000, remainingMs);

  // Launch all relevant agents in parallel
  const promises = relevant.map(async (entry): Promise<AgentDispatchResult> => {
    const runner = RUNNERS[entry.id];
    if (!runner) {
      return {
        agentId: entry.id,
        agentName: entry.name,
        icon: entry.icon,
        status: "skipped",
        durationMs: 0,
        summaryNote: "Runner bulunamadı.",
      };
    }

    const agentStart = Date.now();
    try {
      const result = await withTimeout(
        runner(destination, profile, perAgentTimeout),
        perAgentTimeout,
      );
      return {
        agentId: entry.id,
        agentName: entry.name,
        icon: entry.icon,
        status: "completed",
        durationMs: result.durationMs,
        data: result.data,
      };
    } catch (error) {
      const isTimeout =
        error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      return {
        agentId: entry.id,
        agentName: entry.name,
        icon: entry.icon,
        status: isTimeout ? "timeout" : "failed",
        durationMs: Date.now() - agentStart,
        summaryNote: isTimeout
          ? "Agent zaman aşımına uğradı."
          : `Agent hatası: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`,
      };
    }
  });

  const results = await Promise.allSettled(promises);

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    // Should not happen since individual promises handle their own errors,
    // but guard defensively.
    return {
      agentId: relevant[i].id,
      agentName: relevant[i].name,
      icon: relevant[i].icon,
      status: "failed" as const,
      durationMs: Date.now() - startedAt,
      summaryNote: "Beklenmeyen dispatch hatası.",
    };
  });
}
