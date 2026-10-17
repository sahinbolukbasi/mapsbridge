/**
 * Conversation Flow Manager
 *
 * Tracks the current "sub-topic stage" of the conversation so the AI
 * can have a natural progression before surfacing affiliate pricing.
 *
 * Flow per topic:
 *   hotel:       discovery → needs → recommendation → pricing
 *   flight:      origin_check → date_gather → recommendation → pricing
 *   car_rental:  need_check → pickup_gather → recommendation → pricing
 *   destination: exploring → narrowing → decided
 *   planning:    context → draft → refinement → complete
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FlowTopic = "hotel" | "flight" | "car_rental" | "destination" | "planning" | "none";

export type HotelStage = "discovery" | "needs" | "recommendation" | "pricing";
export type FlightStage = "origin_check" | "date_gather" | "recommendation" | "pricing";
export type CarStage = "need_check" | "pickup_gather" | "recommendation" | "pricing";
export type DestinationStage = "exploring" | "narrowing" | "decided";
export type PlanningStage = "context" | "draft" | "refinement" | "complete";

export type TopicStage =
  | HotelStage
  | FlightStage
  | CarStage
  | DestinationStage
  | PlanningStage
  | "none";

export interface ConversationFlow {
  activeTopic: FlowTopic;
  stage: TopicStage;
  /** How many AI turns have been in this topic (before surfacing pricing) */
  turnsInTopic: number;
  /** Slots gathered within this topic */
  gathered: Partial<{
    hotelLocation: string;
    hotelBudget: string;
    hotelCheckIn: string;
    hotelCheckOut: string;
    hotelStyle: string;
    flightOrigin: string;
    flightDepartDate: string;
    flightReturnDate: string;
    carPickupDate: string;
    carDropoffDate: string;
    carLocation: string;
  }>;
  /** Topics that have already surfaced affiliate pricing this session (don't repeat) */
  pricedTopics: FlowTopic[];
  /** Destinations mentioned by the user in this session */
  sessionDestinations: string[];
}

export const EMPTY_FLOW: ConversationFlow = {
  activeTopic: "none",
  stage: "none",
  turnsInTopic: 0,
  gathered: {},
  pricedTopics: [],
  sessionDestinations: [],
};

// ---------------------------------------------------------------------------
// Topic detection patterns
// ---------------------------------------------------------------------------

const HOTEL_PATTERN =
  /\b(otel|konaklama|hotel|kal(?:acağım|mak|malı)|nerede\s*kal|oda|hostel|apart(?:man)?|suite|airbnb|booking)\b/iu;

const FLIGHT_PATTERN =
  /\b(uçuş|uçak|bilet|havayolu|flight|uç(?:mak|acağım|malıyım)|nasıl\s*(?:gideceğim|gidebilirim)|bilet\s*fiyat)\b/iu;

const CAR_PATTERN =
  /\b(araba\s*kiralama|araç\s*kiralama|kiralık\s*araç|rent\s*(?:a\s*)?car|araba|araç|oto)\b/iu;

const DESTINATION_PATTERN =
  /\b(nereye\s*gitsem|nereyi\s*önerirsin|hangi\s*şehir|destinasyon|seyahat\s*(?:fikri|önerisi)|where\s*should\s*i\s*go|suggest.*destination)\b/iu;

// ---------------------------------------------------------------------------
// Slot extraction from user message
// ---------------------------------------------------------------------------

function extractHotelSlots(
  text: string,
): Partial<ConversationFlow["gathered"]> {
  const slots: Partial<ConversationFlow["gathered"]> = {};

  // Budget
  if (/ekonomik|ucuz|bütçeli|budget|cheap/iu.test(text)) slots.hotelBudget = "budget";
  else if (/lüks|luxury|5\s*yıldız|five.?star/iu.test(text)) slots.hotelBudget = "luxury";
  else if (/orta|mid|dengeli/iu.test(text)) slots.hotelBudget = "mid";

  // Hotel style
  if (/butik/iu.test(text)) slots.hotelStyle = "boutique";
  else if (/resort|tatil\s*köyü/iu.test(text)) slots.hotelStyle = "resort";
  else if (/hostel/iu.test(text)) slots.hotelStyle = "hostel";
  else if (/apart/iu.test(text)) slots.hotelStyle = "apartment";

  // Dates via ISO or Turkish month pattern
  const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/g);
  if (isoMatch?.[0]) slots.hotelCheckIn = isoMatch[0];
  if (isoMatch?.[1]) slots.hotelCheckOut = isoMatch[1];

  return slots;
}

function extractFlightSlots(
  text: string,
): Partial<ConversationFlow["gathered"]> {
  const slots: Partial<ConversationFlow["gathered"]> = {};

  // Origin hints ("İstanbul'dan", "from Istanbul")
  const fromMatch = text.match(/(?:İstanbul|Istanbul|Ankara|Antalya|İzmir|Izmir)\s*['']?dan|from\s+(Istanbul|Ankara|Antalya)/iu);
  if (fromMatch) {
    const city = fromMatch[0].replace(/['']?dan|from\s*/iu, "").trim();
    const iata: Record<string, string> = { istanbul: "IST", ankara: "ESB", antalya: "AYT", izmir: "ADB" };
    const key = city.toLowerCase();
    if (iata[key]) slots.flightOrigin = iata[key];
  }

  const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/g);
  if (isoMatch?.[0]) slots.flightDepartDate = isoMatch[0];
  if (isoMatch?.[1]) slots.flightReturnDate = isoMatch[1];

  return slots;
}

// ---------------------------------------------------------------------------
// Flow transition logic
// ---------------------------------------------------------------------------

/**
 * Process a new user message and return the updated conversation flow.
 * This is called before the AI generates a response so the supervisor
 * can decide whether to surface affiliate cards.
 */
export function advanceFlow(
  current: ConversationFlow,
  userMessage: string,
  aiResponseText?: string,
  destination?: string,
): ConversationFlow {
  const next = { ...current, gathered: { ...current.gathered } };

  // Track destination mentions
  if (destination && !next.sessionDestinations.includes(destination.toLowerCase())) {
    next.sessionDestinations = [...next.sessionDestinations, destination.toLowerCase()];
  }

  // Detect topic shift
  const detectedTopic = detectTopic(userMessage);

  if (detectedTopic !== "none" && detectedTopic !== current.activeTopic) {
    // Topic switch — reset stage
    next.activeTopic = detectedTopic;
    next.turnsInTopic = 1;
    next.stage = initialStage(detectedTopic);
  } else if (detectedTopic === current.activeTopic && detectedTopic !== "none") {
    // Continuing in same topic
    next.turnsInTopic = current.turnsInTopic + 1;
    next.stage = advanceStage(current, userMessage, aiResponseText);
  } else if (detectedTopic === "none" && current.activeTopic !== "none") {
    // User continues in active topic implicitly
    next.turnsInTopic = current.turnsInTopic + 1;
    next.stage = advanceStage(current, userMessage, aiResponseText);
  }

  // Extract slots for active topic
  if (next.activeTopic === "hotel") {
    Object.assign(next.gathered, extractHotelSlots(userMessage));
  } else if (next.activeTopic === "flight") {
    Object.assign(next.gathered, extractFlightSlots(userMessage));
  }

  return next;
}

function detectTopic(text: string): FlowTopic {
  if (HOTEL_PATTERN.test(text)) return "hotel";
  if (FLIGHT_PATTERN.test(text)) return "flight";
  if (CAR_PATTERN.test(text)) return "car_rental";
  if (DESTINATION_PATTERN.test(text)) return "destination";
  return "none";
}

function initialStage(topic: FlowTopic): TopicStage {
  switch (topic) {
    case "hotel": return "discovery";
    case "flight": return "origin_check";
    case "car_rental": return "need_check";
    case "destination": return "exploring";
    case "planning": return "context";
    default: return "none";
  }
}

function advanceStage(
  current: ConversationFlow,
  userMessage: string,
  aiResponseText?: string,
): TopicStage {
  // Stage advancement rules per topic
  switch (current.activeTopic) {
    case "hotel": {
      const s = current.stage as HotelStage;
      // After discovery, move to needs if user gave some preference
      if (s === "discovery" && current.turnsInTopic >= 1) return "needs";
      if (s === "needs" && current.turnsInTopic >= 2) return "recommendation";
      // Move to pricing after AI has made a recommendation (≥3 turns)
      if (s === "recommendation" && current.turnsInTopic >= 3) return "pricing";
      return s;
    }
    case "flight": {
      const s = current.stage as FlightStage;
      if (s === "origin_check" && current.turnsInTopic >= 1) return "date_gather";
      if (s === "date_gather" && current.turnsInTopic >= 2) return "recommendation";
      if (s === "recommendation" && current.turnsInTopic >= 3) return "pricing";
      return s;
    }
    case "car_rental": {
      const s = current.stage as CarStage;
      if (s === "need_check" && current.turnsInTopic >= 1) return "pickup_gather";
      if (s === "pickup_gather" && current.turnsInTopic >= 2) return "recommendation";
      if (s === "recommendation" && current.turnsInTopic >= 3) return "pricing";
      return s;
    }
    case "destination": {
      const s = current.stage as DestinationStage;
      if (s === "exploring" && current.turnsInTopic >= 2) return "narrowing";
      if (s === "narrowing" && current.turnsInTopic >= 3) return "decided";
      return s;
    }
    default:
      return current.stage;
  }
}

// ---------------------------------------------------------------------------
// Should surface pricing?
// ---------------------------------------------------------------------------

/**
 * Returns true when the conversation has naturally progressed to the point
 * where showing affiliate pricing makes sense (not too early, not too late).
 */
export function shouldSurfacePricing(flow: ConversationFlow): boolean {
  if (flow.pricedTopics.includes(flow.activeTopic)) return false; // already shown

  switch (flow.activeTopic) {
    case "hotel":
      return flow.stage === "pricing" || (flow.stage === "recommendation" && flow.turnsInTopic >= 3);
    case "flight":
      return flow.stage === "pricing" || (flow.stage === "recommendation" && flow.turnsInTopic >= 3);
    case "car_rental":
      return flow.stage === "pricing" || (flow.stage === "recommendation" && flow.turnsInTopic >= 3);
    default:
      return false;
  }
}

/**
 * Mark a topic's pricing as already surfaced (prevents duplicate cards).
 */
export function markPriced(flow: ConversationFlow, topic: FlowTopic): ConversationFlow {
  if (flow.pricedTopics.includes(topic)) return flow;
  return { ...flow, pricedTopics: [...flow.pricedTopics, topic] };
}

// ---------------------------------------------------------------------------
// Context prompt injection
// ---------------------------------------------------------------------------

/**
 * Generates a short context snippet for the system prompt about the user's
 * past destinations and current flow stage.
 * Used in AdvisorPromptBuilder to enrich every request.
 */
export function flowToPromptSnippet(
  flow: ConversationFlow,
  pastDestinations: string[],
): string {
  const parts: string[] = [];

  // Past trips reference
  if (pastDestinations.length > 0) {
    const recent = pastDestinations.slice(-3).join(", ");
    parts.push(`[Kullanıcının geçmiş seyahat ilgisi: ${recent}]`);
  }

  // Current topic stage context
  if (flow.activeTopic !== "none") {
    const stageLabels: Record<string, string> = {
      discovery: "otel araştırma başlangıcı",
      needs: "otel ihtiyaçları netleşiyor",
      recommendation: "otel önerisi aşaması",
      pricing: "otel fiyatı göster",
      origin_check: "uçuş çıkış noktası sorgulanıyor",
      date_gather: "uçuş tarihleri toplanıyor",
      exploring: "destinasyon keşfi",
      narrowing: "destinasyon daraltılıyor",
      decided: "destinasyon seçildi",
      need_check: "araç kiralama ihtiyacı sorgulanıyor",
      pickup_gather: "teslim alma bilgileri toplanıyor",
    };
    const label = stageLabels[flow.stage] || flow.stage;
    parts.push(`[Konuşma akışı: ${flow.activeTopic} / ${label} — ${flow.turnsInTopic}. tur]`);
  }

  // Gathered slot summary
  const g = flow.gathered;
  const slots = [
    g.hotelBudget && `otel bütçesi: ${g.hotelBudget}`,
    g.hotelStyle && `otel tipi: ${g.hotelStyle}`,
    g.hotelCheckIn && `giriş tarihi: ${g.hotelCheckIn}`,
    g.flightOrigin && `uçuş çıkış: ${g.flightOrigin}`,
    g.flightDepartDate && `uçuş tarihi: ${g.flightDepartDate}`,
    g.carPickupDate && `araç teslim: ${g.carPickupDate}`,
  ].filter(Boolean);
  if (slots.length) parts.push(`[Toplanan bilgiler: ${slots.join(", ")}]`);

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Follow-up question generators (contextual, non-repetitive)
// ---------------------------------------------------------------------------

export interface FlowQuickReply {
  label: string;
  message: string;
  topic: FlowTopic;
}

/**
 * Returns contextual quick reply buttons based on current flow stage.
 * These are shown below the AI response to guide the conversation naturally.
 */
export function getFlowQuickReplies(
  flow: ConversationFlow,
  destination?: string,
): FlowQuickReply[] {
  const dest = destination || flow.sessionDestinations.slice(-1)[0] || "destinasyon";

  switch (flow.activeTopic) {
    case "hotel":
      if (flow.stage === "discovery") {
        return [
          { label: "Şehir merkezi", message: `${dest} şehir merkezinde otel istiyorum`, topic: "hotel" },
          { label: "Sahil / plaj", message: `${dest}'da plaja yakın otel arıyorum`, topic: "hotel" },
          { label: "Butik otel", message: `${dest} butik otel önerir misin?`, topic: "hotel" },
        ];
      }
      if (flow.stage === "needs" || flow.stage === "recommendation") {
        return [
          { label: "Bütçe sınırım var", message: `${dest} için ekonomik otel seçenekleri neler?`, topic: "hotel" },
          { label: "Aile için uygun", message: `Çocukla ${dest}'a gidiyorum, hangi otel uygun?`, topic: "hotel" },
          { label: "Fiyatları gör", message: `${dest} otel fiyatlarını göster`, topic: "hotel" },
        ];
      }
      break;

    case "flight":
      if (flow.stage === "origin_check") {
        return [
          { label: "İstanbul'dan", message: `İstanbul'dan ${dest}'a uçuş`, topic: "flight" },
          { label: "En ucuz ay", message: `${dest}'a uçmanın en ucuz ayı hangisi?`, topic: "flight" },
          { label: "Direkt uçuş", message: `${dest}'a direkt uçuş var mı?`, topic: "flight" },
        ];
      }
      if (flow.stage === "date_gather" || flow.stage === "recommendation") {
        return [
          { label: "Bu hafta sonu", message: `Bu hafta sonu ${dest} uçuş fiyatları nasıl?`, topic: "flight" },
          { label: "Gelecek ay", message: `Gelecek ay ${dest}'a bilet araştırıyorum`, topic: "flight" },
          { label: "Fiyatları karşılaştır", message: `${dest} uçuş fiyatlarını göster`, topic: "flight" },
        ];
      }
      break;

    case "car_rental":
      return [
        { label: "Havalimanından al", message: `${dest} havalimanından araç kiralayacağım`, topic: "car_rental" },
        { label: "Kaç gün?", message: `${dest}'da 5 günlük araç kiralama ne kadar?`, topic: "car_rental" },
        { label: "Seçenekleri gör", message: `${dest} araç kiralama seçeneklerini göster`, topic: "car_rental" },
      ];

    case "destination":
      return [
        { label: "Daha sessiz bir yer", message: "Daha az kalabalık alternatif destinasyon önerir misin?", topic: "destination" },
        { label: "Bütçeme uygun", message: "Bütçeme uygun destinasyon alternatifleri neler?", topic: "destination" },
        { label: "Bu destinasyonu seç", message: `${dest}'a gitmeye karar verdim, rota yapalım mı?`, topic: "destination" },
      ];

    default:
      // When there's a destination but no specific topic
      if (destination) {
        return [
          { label: "Rota oluştur", message: `${dest} için gezi rotası yap`, topic: "planning" },
          { label: "Uçuş fiyatı", message: `${dest} uçuş biletleri ne kadar?`, topic: "flight" },
          { label: "Otel öner", message: `${dest} için otel öner`, topic: "hotel" },
        ];
      }
  }
  return [];
}
