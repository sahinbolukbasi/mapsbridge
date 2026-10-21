/**
 * MapsBridge User Interaction & Behavioral Telemetry Tracker
 *
 * Logs all user engagement: pin clicks, place inspections, searches,
 * category filters, and route additions.
 * Used as the primary data source for AI recommendations, predictive routing,
 * and personalized travel guidance.
 */

export type InteractionType =
  | "pin_click"
  | "place_view"
  | "place_search"
  | "category_filter"
  | "pin_add_to_route"
  | "route_optimize"
  | "manifesto_download"
  | "manifesto_copy";

export interface UserInteractionEvent {
  id: string;
  type: InteractionType;
  timestamp: number;
  dateStr: string;
  payload: Record<string, unknown>;
  sessionDurationSec?: number;
}

export interface BehavioralProfile {
  topCategories: Array<{ category: string; count: number; percentage: number }>;
  favoriteCategory: string;
  totalInteractions: number;
  recentPlaces: string[];
  destinationsFocused: string[];
  lastActive: string;
}

const STORAGE_KEY = "mapsbridge.interaction_logs.v1";
const MAX_LOCAL_EVENTS = 1000;
const SESSION_START = Date.now();

class InteractionTracker {
  private queue: UserInteractionEvent[] = [];
  private syncTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.loadQueue();
      // Auto flush on window unload
      window.addEventListener("beforeunload", () => this.flushToServer());
    }
  }

  private loadQueue(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.queue = JSON.parse(raw);
      }
    } catch {}
  }

  private saveQueue(): void {
    if (typeof window === "undefined") return;
    try {
      // Keep only the most recent MAX_LOCAL_EVENTS
      if (this.queue.length > MAX_LOCAL_EVENTS) {
        this.queue = this.queue.slice(-MAX_LOCAL_EVENTS);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch {}
  }

  /**
   * Log a general interaction event
   */
  public track(type: InteractionType, payload: Record<string, unknown>): void {
    const event: UserInteractionEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      timestamp: Date.now(),
      dateStr: new Date().toISOString(),
      payload,
      sessionDurationSec: Math.floor((Date.now() - SESSION_START) / 1000),
    };

    this.queue.push(event);
    this.saveQueue();

    // Trigger debounced batch upload to server
    this.scheduleSync();
  }

  /**
   * Log when a user clicks a pin on the map or in the sidebar
   */
  public logPinClick(pin: {
    id: string;
    label: string;
    category?: string;
    address?: string;
    lat?: number;
    lng?: number;
    tripId?: string;
    dayIndex?: number;
  }): void {
    this.track("pin_click", {
      pinId: pin.id,
      label: pin.label,
      category: pin.category || "genel",
      address: pin.address || "",
      coordinates: pin.lat && pin.lng ? [pin.lat, pin.lng] : undefined,
      tripId: pin.tripId,
      dayIndex: pin.dayIndex,
    });
  }

  /**
   * Log when a user views place details
   */
  public logPlaceView(place: {
    label: string;
    placeId?: string;
    category?: string;
    source?: "map_pin" | "search_result" | "ai_recommendation";
    viewDurationMs?: number;
  }): void {
    this.track("place_view", {
      label: place.label,
      placeId: place.placeId,
      category: place.category || "genel",
      source: place.source || "map_pin",
      durationMs: place.viewDurationMs,
    });
  }

  /**
   * Log place searches
   */
  public logPlaceSearch(query: string, resultCount = 0): void {
    this.track("place_search", { query, resultCount });
  }

  /**
   * Log category chip selection
   */
  public logCategoryFilter(category: string): void {
    this.track("category_filter", { category });
  }

  /**
   * Log adding a pin to a trip route
   */
  public logPinAddToRoute(place: {
    label: string;
    category?: string;
    tripId?: string;
    dayIndex?: number;
    isHotel?: boolean;
    source?: string;
  }): void {
    this.track("pin_add_to_route", {
      label: place.label,
      category: place.category || "genel",
      tripId: place.tripId,
      dayIndex: place.dayIndex || 1,
      isHotel: Boolean(place.isHotel),
      source: place.source || "user_action",
    });
  }

  /**
   * Log manifesto download or copy
   */
  public logManifestoAction(tripId: string, action: "copy" | "download"): void {
    this.track(action === "download" ? "manifesto_download" : "manifesto_copy", { tripId });
  }

  /**
   * Returns all logged interactions
   */
  public getHistory(): UserInteractionEvent[] {
    return [...this.queue];
  }

  /**
   * Generates a behavioral profile for AI prediction and recommendation personalization
   */
  public getBehavioralProfile(): BehavioralProfile {
    const categoryCounts: Record<string, number> = {};
    const recentPlacesSet = new Set<string>();
    const destinationsSet = new Set<string>();

    for (const evt of this.queue) {
      const cat = evt.payload?.category;
      if (cat) {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      }
      const label = evt.payload?.label;
      if (label) {
        recentPlacesSet.add(label);
      }
      const dest = evt.payload?.destination || evt.payload?.city;
      if (dest) {
        destinationsSet.add(dest);
      }
    }

    const total = Object.values(categoryCounts).reduce((a, b) => a + b, 0) || 1;
    const sortedCategories = Object.entries(categoryCounts)
      .map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    return {
      topCategories: sortedCategories,
      favoriteCategory: sortedCategories[0]?.category || "genel",
      totalInteractions: this.queue.length,
      recentPlaces: Array.from(recentPlacesSet).slice(-15),
      destinationsFocused: Array.from(destinationsSet).slice(-5),
      lastActive: this.queue[this.queue.length - 1]?.dateStr || new Date().toISOString(),
    };
  }

  /**
   * Generates a concise context prompt string to pass to Bedrock AI
   */
  public getPredictiveAIPrompt(): string {
    const profile = this.getBehavioralProfile();
    if (profile.totalInteractions === 0) return "";

    const cats = profile.topCategories
      .slice(0, 3)
      .map((c) => `${c.category} (%${c.percentage})`)
      .join(", ");
    const places = profile.recentPlaces.slice(-5).join(", ");

    return `[KULLANICI DAVRANIŞ PROFİLİ]: Kullanıcının en çok etkileşime girdiği ilgi alanları: ${cats || "Genel"}. Son incelediği mekanlar: ${places || "Yok"}. Önerileri bu eğilimlere göre kişiselleştir.`;
  }

  /**
   * Syncs telemetry batch to backend API
   */
  private scheduleSync(): void {
    if (this.syncTimer) return;
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      void this.flushToServer();
    }, 10000); // Batch every 10 seconds
  }

  public async flushToServer(): Promise<void> {
    if (typeof window === "undefined" || this.queue.length === 0) return;
    try {
      const recentBatch = this.queue.slice(-25);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      try {
        const raw = localStorage.getItem("mapsbridge.session.v1");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.token) {
            headers["Authorization"] = `Bearer ${parsed.token}`;
          }
        }
      } catch {}

      await fetch("/routes/telemetry", {
        method: "POST",
        headers,
        body: JSON.stringify({ events: recentBatch }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }
}

export const interactionTracker = new InteractionTracker();
