/**
 * Typed Destination Brief — the "local expertise" layer.
 * Stores curated, provenance-tracked judgment about a destination.
 * Populated at build time; model reads but never overwrites.
 * Every field carries a SourcedField wrapper for CC BY-SA / FCDO attribution.
 */

export type ConfidenceLevel = "verified" | "likely" | "unverified";

export interface SourcedField<T> {
  value: T;
  /** e.g. "wikivoyage:Lisbon" | "fcdo:portugal" | "manual:curator" */
  source: string;
  /** "CC BY-SA 4.0" | "OGL v3" | "proprietary" */
  license: string;
  /** Renderable HTML attribution. Required for CC BY-SA derivatives. */
  attributionHtml: string;
  retrievedAt: string; // ISO 8601
  confidence: ConfidenceLevel;
  /** Mark knowns unknowns explicitly — do NOT fill with model guesses. */
  note?: string;
}

// ── Sub-types ─────────────────────────────────────────────────────────────────

export interface NeighborhoodBrief {
  name: string;
  /** One sharp paragraph — specific, not copyable to another city. */
  character: string;
  bestFor: string[]; // ["locals", "nightlife", "families", "digital_nomads", "design"]
  bestVisitTime?: string;
  accommodationSuitable: boolean;
  walkableFromCenter: boolean;
}

export interface TimingRule {
  subject: string; // venue name or category
  rule: string; // "Pazartesi kapalı", "Öğle 14-17 arası kapalı"
  type: "closed_day" | "best_time" | "avoid_time" | "queue_warning" | "seasonal";
  severity: "blocks_visit" | "degrades_experience" | "fyi";
}

export interface RookieMistake {
  mistake: string;
  correction: string;
}

export interface OverratedWithAlternative {
  overrated: string;
  why: string;
  alternative: string;
  alternativeNote?: string;
}

export interface NicheAngle {
  category:
    | "running"
    | "water_sports"
    | "padel"
    | "cycling"
    | "food_specialty"
    | "art_gallery"
    | "coworking"
    | "photography"
    | "local_market";
  description: string;
  highlights: string[];
}

export interface HighDemandVenue {
  name: string;
  leadTimeDays: number; // how far ahead to book
  method: string; // "Official site: sagradafamilia.org"
  note?: string;
}

// ── Root ──────────────────────────────────────────────────────────────────────

export interface DestinationBrief {
  id: string; // "istanbul" | "barcelona" | "paris"
  level: "city" | "neighborhood";
  name: string;
  nameLocal?: string; // "İstanbul" / "Barcelona" / "Paris"
  countryCode: string; // ISO 3166-1 alpha-2

  cityRhythm: SourcedField<{
    wakeUpTime: string; // "08:00"
    lunchTime: string; // "13:00-15:00"
    dinnerTime: string; // "21:00-23:00"
    siestaExists: boolean;
    nightlifeStartsAt?: string;
    closingDayNote?: string;
    additionalNotes?: string[];
  }>;

  neighborhoods: SourcedField<NeighborhoodBrief[]>;

  gettingAround: SourcedField<{
    transitCardName?: string;
    transitCardAcquisition?: string;
    taxiVsApp: string;
    walkability: "high" | "medium" | "low";
    hillsWarning?: string;
    airportTransferSummary: string;
    carRecommended: boolean;
    carNote?: string;
    ferryNote?: string;
  }>;

  rookieMistakes: SourcedField<RookieMistake[]>;

  overratedWithAlternatives: SourcedField<OverratedWithAlternative[]>;

  timingRules: SourcedField<TimingRule[]>;

  reservationNorms: SourcedField<{
    highDemandVenues: HighDemandVenue[];
    generalNote: string;
  }>;

  seasonality: SourcedField<{
    peakMonths: number[];
    offPeakMonths: number[];
    byMonth: Partial<Record<string, string>>;
    seasonalClosures?: string;
  }>;

  practical: SourcedField<{
    tippingNorm: string;
    plugType: string;
    tapWaterSafe: boolean;
    cashVsCard: string;
    dressCodes?: string;
    emergencyNumbers: { police: string; ambulance: string; general: string };
    currency: string;
    paymentNote?: string;
  }>;

  safetyNotes: SourcedField<{
    generalLevel: "safe" | "moderate_caution" | "elevated_caution";
    specificNotes: string[];
    originBiasNote?: string;
  }>;

  localCalendar: SourcedField<
    Array<{
      date: string; // "MM-DD" or "YYYY-MM-DD"
      name: string;
      type: "public_holiday" | "festival" | "closure_period";
      impact: string;
    }>
  >;

  nicheAngles: SourcedField<NicheAngle[]>;

  schemaVersion: "1.0";
  lastCuratedAt: string; // ISO 8601
  curatedBy: "agent_pipeline" | "manual" | "agent_then_curated";
}
