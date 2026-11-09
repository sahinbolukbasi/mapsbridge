import type { TravelPreferences } from "./preferences";
export interface TravelerProfileContext {
  userEmail: string;
  username?: string;
  savedAddressesCount?: number;
  favoriteCategories?: string[];
  visitedCountries?: string[];
  wishlistCountries?: string[];
  pastRouteThemes?: string[];
  travelStyle?: "cultural" | "foodie" | "adventure" | "budget" | "luxury" | "balanced";
}

export interface RouteStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  day: number;
  description: string;
  suggestedDuration: string;
  category?: string;
  address?: string;
  timeSlot?: "morning" | "afternoon" | "evening" | "night";
  estimatedMinutes?: number;
  distanceToNextKm?: number;
}

export interface UnifiedRoutePlan {
  title: string;
  summary: string;
  estimatedDays: number;
  theme: string;
  destination: string;
  stops: RouteStop[];
  /** S4 gün bütçesi (≥%20 tampon) için deterministik olarak çıkarılan duraklar. */
  droppedStops?: { id: string; name: string; day: number }[];
}

export interface StayOption {
  name: string;
  type: "hotel" | "hostel" | "airbnb_area" | "boutique";
  area: string;
  priceLevel: "$" | "$$" | "$$$" | "$$$$";
  description: string;
  pros: string[];
}

export interface TransitTip {
  title: string;
  type: "airport_transfer" | "metro_bus" | "city_pass" | "taxi_rideshare" | "general";
  description: string;
  estimatedCost?: string;
}

export interface StayAndTransitInfo {
  recommendedAreas: string[];
  stays: StayOption[];
  transitTips: TransitTip[];
  cityCardRecommendation?: string;
}

export interface LocalGem {
  name: string;
  category: "food" | "cafe" | "viewpoint" | "shopping" | "hidden_spot";
  description: string;
  highlight: string;
  addressOrArea?: string;
}

export interface LocalDiscoveryInfo {
  specialties: string[];
  gems: LocalGem[];
  cultureTips: string[];
}

export interface TurkishEmbassyConsulate {
  title: string;
  address: string;
  phone: string;
  emergencyHotline: string;
  email?: string;
  workingHours?: string;
}

export interface LocalEmergencyNumbers {
  police: string;
  ambulance: string;
  fire: string;
  generalEmergency: string;
}

export interface EmergencyInfo {
  destinationCountry: string;
  turkishEmbassyConsulate: TurkishEmbassyConsulate;
  localEmergencyNumbers: LocalEmergencyNumbers;
  safetyAndPassportTips: string[];
}

export interface SubAgentExecution {
  agentId: "context" | "route" | "transit" | "discovery" | "emergency" | "search";
  agentName: string;
  icon: string;
  status: "completed" | "skipped" | "fallback" | "partial" | "failed" | "timeout";
  durationMs: number;
  summaryNote?: string;
}

export interface NearbyPin {
  id: string;
  name: string;
  category: string;
  description: string;
  lat: number;
  lng: number;
  suggestedDuration: string;
}

export interface PromptClarification {
  isUnderspecified: boolean;
  message: string;
  guidingQuestions: string[];
  quickOptions: { label: string; prompt: string }[];
  nearbyPins: NearbyPin[];
}

export interface TravelerInfo {
  adults?: number;
  children?: number;
  pets?: boolean;
}

export interface TripDates {
  start?: string;
  end?: string;
  flexible?: boolean;
}

export interface TripBudget {
  currency?: string;
  total?: number;
  level?: "budget" | "mid" | "luxury" | "unspecified";
}

export interface TripInterests {
  food?: string[];
  sports?: string[];
  culture?: string[];
  general?: string[];
}

export interface TripNeeds {
  flights?: boolean;
  car_rental?: boolean;
  local_transit?: boolean;
}

export interface TripProfile {
  destination?: string;
  dates?: TripDates;
  duration_days?: number;
  travelers?: TravelerInfo;
  budget?: TripBudget;
  interests: TripInterests;
  constraints?: string[];
  pace?: "relaxed" | "moderate" | "fast" | "unspecified";
  lodging_type?: Array<"hotel" | "hostel" | "apartment" | "boutique" | "resort">;
  needs?: TripNeeds;
  completeness: number;
}

export interface BlockTransit {
  mode: "walking" | "subway" | "bus" | "taxi";
  minutes: number;
}

export interface DayBlock {
  time: string;
  type: "cafe" | "restaurant" | "museum" | "park" | "hotel" | "activity" | "transit" | "viewpoint";
  place_id: string;
  name: string;
  why: string;
  transit?: BlockTransit;
  est_cost?: number;
  alt?: string;
  /** HH:MM closing time for last-entry rule (§11.1) */
  closingTime?: string;
  /** Minimum recommended visit duration in minutes (§11.1) */
  minVisitMinutes?: number;
  /** Days of week when closed, lowercase English e.g. ["monday","tuesday"] (§11.1) */
  closedDays?: string[];
  /** WGS-84 latitude for geographic coherence check (§11.1) */
  lat?: number;
  /** WGS-84 longitude for geographic coherence check (§11.1) */
  lng?: number;
}

export interface DayPlan {
  date: string;
  weather_note: string;
  blocks: DayBlock[];
}

export interface BudgetSummary {
  total: number;
  currency: string;
  by_category?: Record<string, number>;
}

export interface StructuredTripPlan {
  trip_id: string;
  days: DayPlan[];
  budget_summary: BudgetSummary;
  sources: string[];
}

export interface FeasibilityIssue {
  severity: "error" | "warning";
  day?: number;
  blockIndex?: number;
  code:
    | "TIME_OVERLAP"
    | "TRANSIT_INSUFFICIENT"
    | "EXCESSIVE_DURATION"
    | "BUDGET_EXCEEDED"
    | "MISSING_WEATHER_ALT"
    | "UNKNOWN_PLACE"
    | "LAST_ENTRY_VIOLATION"
    | "MIN_VISIT_DURATION"
    | "MEAL_GAP"
    | "WALKING_BUDGET"
    | "CLOSED_DAY"
    | "GEO_INCOHERENCE";
  message: string;
  suggestedFix?: string;
}

export interface FeasibilityReport {
  isValid: boolean;
  score: number;
  issues: FeasibilityIssue[];
  totalPlannedHours: number;
  estimatedCostTotal: number;
}

export interface MultiAgentResponse {
  promptVersion?: string;
  responseMode?: "clarify" | "chat" | "route";
  tripContext?: import("./planning").TripContext;
  tripProfile?: TripProfile;
  research?: import("./place-research").PlaceResearch;
  conversationState?: import("./planning").ConversationState;
  retrievalStatus?: "disabled" | "available" | "empty" | "unavailable";
  /** Grounding ölçümü (Faz 1 görev 4): kanıt birleştirme sayıları. recordAIOperation'a taşınır. */
  evidenceCounts?: { remote: number; local: number; merged: number };
  sources?: import("./retrieval").TravelSource[];
  /** Citation coverage only; it does not claim that every model statement is factual. */
  sourceCoverage?: { requested: number; resolved: number; ratio: number };
  preferenceUpdates?: TravelPreferences;
  orchestratorSummary: string;
  /** User-safe rationale; never contains raw model reasoning blocks. */
  decisionSummary?: string[];
  /** Visible assumptions made when filling missing info (§7) */
  assumptions?: string[];
  /** Intent classification result for telemetry (§6) */
  intentClassification?: import("./intent-classifier").ClassifiedIntent;
  /** TripState change events for this turn (§2.1) */
  tripStateEvents?: import("./trip-state").TripStateEvent[];
  agentsInvolved: SubAgentExecution[];
  route?: UnifiedRoutePlan;
  structuredPlan?: StructuredTripPlan;
  feasibility?: FeasibilityReport;
  stayAndTransit?: StayAndTransitInfo;
  discovery?: LocalDiscoveryInfo;
  emergency?: EmergencyInfo;
  flightPrices?: FlightPriceInfo;
  travelAdvisory?: TravelAdvisoryInfo;
  clarification?: PromptClarification;
  nearbyPins?: NearbyPin[];
  /** Faz C — affiliate deep link cards (flights, hotels, car, insurance, activities). */
  affiliateCards?: import("../affiliate/types").AffiliateCard[];
  /** Faz 2 — focus-aware context chips (§12.2). Max 4 per turn; never static. */
  suggestedChips?: import("./context-chips").ContextChip[];
  /** Faz 2 — itinerary mutations requested by the model this turn (§12.5). */
  itineraryActions?: import("./itinerary-actions").ItineraryActionPayload[];
  /** Faz 2 — active focus for this turn (§12.1). Persisted to ConversationState. */
  currentFocus?: import("./focus-manager").ThreadFocus;
  provider: "aws_bedrock" | "intelligent_synthesizer";
  modelUsed?: string;
  /**
   * Kararlı AI hata kodu (ör. CONTEXT_TOO_LARGE). Yalnızca kurtarma gerektiren durumlarda
   * doldurulur; handler bunu istemciye taşır ki belirsiz 503 yerine net mesaj gösterilsin.
   */
  errorCode?: string;
}

export interface ConversationFlowSnapshot {
  activeTopic: string;
  stage: string;
  gathered?: Record<string, string | undefined>;
}

export interface MultiAgentRequestPayload {
  routeMode?: "calm" | "classic" | "explorer";
  personalMemories?: Array<{ id: string; text: string; kind: string }>;
  conversationState?: import("./planning").ConversationState;
  researchDestination?: string;
  preferences?: TravelPreferences;
  prompt: string;
  userEmail?: string;
  userLocation?: { lat: number; lng: number };
  profileContext?: TravelerProfileContext;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  tripManifestoMarkdown?: string;
  conversationFlow?: ConversationFlowSnapshot;
}

export interface FlightDeal {
  origin: string;
  destination: string;
  price: number;
  currency: string;
  departureMonth?: string;
  affiliateLink: string;
  expiresAt: string;
}

export interface FlightPriceInfo {
  destination: string;
  deals: FlightDeal[];
  cheapestPrice?: number;
  cheapestCurrency?: string;
  /** e.g. "İstanbul'dan Paris'e €89'dan itibaren" */
  note: string;
  source: "travelpayouts_cache" | "unavailable";
  checkedAt: string;
  affiliateLinkBase?: string;
}

export type AdvisoryLevel = "normal" | "some_risk" | "avoid_non_essential" | "avoid";

export interface TravelAdvisoryInfo {
  country: string;
  countrySlug: string;
  level: AdvisoryLevel;
  levelLabel: string;
  summary: string;
  lastChecked: string;
  changeNote?: string;
  sourceUrl: string;
  disclaimer: string;
}

export function isRoutePlan(value: unknown): value is UnifiedRoutePlan {
  if (!value || typeof value !== "object") return false;
  const route = value as UnifiedRoutePlan;
  return (
    typeof route.title === "string" &&
    !!route.title.trim() &&
    typeof route.summary === "string" &&
    typeof route.theme === "string" &&
    typeof route.destination === "string" &&
    !!route.destination.trim() &&
    Number.isInteger(route.estimatedDays) &&
    route.estimatedDays > 0 &&
    route.estimatedDays <= 30 &&
    Array.isArray(route.stops) &&
    route.stops.length > 0 &&
    route.stops.length <= 100 &&
    route.stops.every(
      (stop) =>
        !!stop &&
        typeof stop.id === "string" &&
        !!stop.id.trim() &&
        typeof stop.name === "string" &&
        typeof stop.description === "string" &&
        typeof stop.suggestedDuration === "string" &&
        Number.isFinite(stop.lat) &&
        Math.abs(stop.lat) <= 90 &&
        Number.isFinite(stop.lng) &&
        Math.abs(stop.lng) <= 180 &&
        Number.isInteger(stop.day) &&
        stop.day >= 1 &&
        stop.day <= route.estimatedDays,
    )
  );
}
