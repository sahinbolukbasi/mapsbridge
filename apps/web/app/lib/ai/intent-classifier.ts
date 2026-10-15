// ---------------------------------------------------------------------------
// Intent Classifier — regex-based, no model call
// ---------------------------------------------------------------------------

export type IntentClass =
  "fact_lookup" | "recommendation" | "planning" | "constraint_change" | "procedural" | "smalltalk";

export interface ClassifiedIntent {
  intentClass: IntentClass;
  reasoningBudget: "low" | "medium" | "high";
  modelTier: 1 | 2 | 3 | 4;
  shouldFanOut: boolean;
  relevantAgents: string[];
}

// ---------------------------------------------------------------------------
// Pattern banks — Turkish + English
// ---------------------------------------------------------------------------

const SMALLTALK_PATTERN =
  /^(merhaba|selam|selamlar|günaydın|iyi\s+(günler|akşamlar|geceler)|hey|hi|hello|teşekkür|sağ\s*ol|thanks|thank\s*you|hoşça\s*kal|bye|görüşürüz)\s*[!?.]*$/iu;

const PLANNING_PATTERN =
  /rota|plan|gezi\s*plan|program|günlük|itinerary|kaç\s*gün|ne\s*zaman\s*gideyim|route|trip\s*plan|schedule|organize/iu;

const CONSTRAINT_CHANGE_PATTERN =
  /bütçe(?:mi|yi)?\s*(?:değiştir|azalt|artır|düşür)|tempo(?:mu|yu)?\s*(?:değiştir|yavaşlat|hızlandır)|tarih(?:ler)?(?:imi|i)?\s*(?:değiştir|güncelle)|budget\s*(?:change|update|lower|raise)|pace\s*(?:change|slow|fast)|change\s*(?:date|budget|pace)|gün\s*sayısını\s*(?:değiştir|azalt|artır)|kişi\s*sayısı/iu;

const PROCEDURAL_PATTERN =
  /vize|pasaport|gümrük|customs|visa|border|konsolosluk|consulate|belge|document|ehliyet|sürücü\s*belgesi|sağlık\s*sigortası|health\s*insurance|aşı|vaccination|giriş\s*koşul/iu;

const FACT_LOOKUP_PATTERN =
  /kaç(?:ta|\s+saat)|saat\s*kaç|ne\s*kadar|fiyat|ücret|açık\s*mı|kapalı\s*mı|nerede(?:dir|\s+bu)|adres|mesafe|how\s*much|price|cost|when\s*does|opening\s*hours|where\s*is|distance|how\s*far/iu;

const RECOMMENDATION_PATTERN =
  /nere(?:ye|de)\s*(?:git|ye|kal|gez)|öner|tavsiye|suggest|recommend|best\s*place|en\s*iyi|favorit|popüler|where\s*should|what\s*should|ne\s*yap(?:ayım|alım|malıyım)|ne\s*gör(?:eyim|meliyim)|hangi/iu;

// ---------------------------------------------------------------------------
// Agent relevance patterns (mirror dispatcher.ts)
// ---------------------------------------------------------------------------

const AGENT_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  {
    id: "food",
    pattern:
      /yemek|restoran|kahve|lezzet|mutfak|nerede yiyelim|açlık|breakfast|lunch|dinner|cafe/iu,
  },
  { id: "car-rental", pattern: /araç|araba|kiralama|kiralık|ehliyet|sürüş|rent.*car|driving/iu },
  {
    id: "city-transit",
    pattern: /metro|otobüs|tramvay|toplu taşıma|ulaşım kartı|bilet|tren|bus|subway/iu,
  },
  {
    id: "city-intel",
    pattern: /güvenlik|hava durumu|sezon|ne zaman gidilir|nasıl bir şehir|genel bilgi|overview/iu,
  },
  { id: "hotel-deal", pattern: /otel|konaklama|hotel|nerede kal|airbnb|hostel|booking/iu },
  { id: "flight", pattern: /uçuş|uçak|bilet|havayolu|flight|nasıl giderim/iu },
  { id: "transit", pattern: /konaklama|otel|nerede kal|ulaşım|apart|hostel/iu },
  {
    id: "discovery",
    pattern: /yerel keşif|gizli köşe|kültürel ipuç|ne yenir|restoran|lezzet|kafe/iu,
  },
  {
    id: "emergency",
    pattern: /acil|yardım|hastane|polis|doktor|güvenlik|kayıp|pasaport|tehlike/iu,
  },
];

function findRelevantAgents(request: string): string[] {
  return AGENT_PATTERNS.filter((a) => a.pattern.test(request)).map((a) => a.id);
}

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

export function classifyIntent(
  request: string,
  hasRoute: boolean,
  hasDestination: boolean,
): ClassifiedIntent {
  const trimmed = request.trim();

  // 1. Smalltalk — greetings, thanks (checked first since it is the most specific)
  if (SMALLTALK_PATTERN.test(trimmed)) {
    return {
      intentClass: "smalltalk",
      reasoningBudget: "low",
      modelTier: 1,
      shouldFanOut: false,
      relevantAgents: [],
    };
  }

  // 2. Constraint change — user modifying existing trip parameters
  if (CONSTRAINT_CHANGE_PATTERN.test(trimmed)) {
    return {
      intentClass: "constraint_change",
      reasoningBudget: "medium",
      modelTier: hasRoute ? 3 : 2,
      shouldFanOut: hasRoute,
      relevantAgents: findRelevantAgents(trimmed),
    };
  }

  // 3. Planning — explicit route/plan request
  if (PLANNING_PATTERN.test(trimmed)) {
    const agents = findRelevantAgents(trimmed);
    // In planning mode, always include core agents if destination is known
    if (hasDestination) {
      for (const core of ["food", "city-transit", "city-intel"]) {
        if (!agents.includes(core)) agents.push(core);
      }
    }
    return {
      intentClass: "planning",
      reasoningBudget: "high",
      modelTier: 3,
      shouldFanOut: true,
      relevantAgents: agents,
    };
  }

  // 4. Procedural — visa, customs, documents
  if (PROCEDURAL_PATTERN.test(trimmed)) {
    const agents = findRelevantAgents(trimmed);
    return {
      intentClass: "procedural",
      reasoningBudget: "medium",
      modelTier: 2,
      shouldFanOut: false,
      relevantAgents: agents.length > 0 ? agents : ["emergency"],
    };
  }

  // 5. Fact lookup — specific questions about hours, prices, rules
  if (FACT_LOOKUP_PATTERN.test(trimmed)) {
    const agents = findRelevantAgents(trimmed);
    return {
      intentClass: "fact_lookup",
      reasoningBudget: "low",
      modelTier: agents.length > 1 ? 2 : 1,
      shouldFanOut: false,
      relevantAgents: agents.slice(0, 1), // single agent for fact lookups
    };
  }

  // 6. Recommendation — "where should I eat?", "what to see?"
  if (RECOMMENDATION_PATTERN.test(trimmed)) {
    const agents = findRelevantAgents(trimmed);
    return {
      intentClass: "recommendation",
      reasoningBudget: "medium",
      modelTier: 2,
      shouldFanOut: agents.length > 1,
      relevantAgents: agents.slice(0, 2), // 1-2 agents for recommendations
    };
  }

  // 7. Fallback — if we have a destination, treat as recommendation; otherwise fact_lookup
  const agents = findRelevantAgents(trimmed);
  if (hasDestination && agents.length > 0) {
    return {
      intentClass: "recommendation",
      reasoningBudget: "medium",
      modelTier: 2,
      shouldFanOut: agents.length > 1,
      relevantAgents: agents.slice(0, 2),
    };
  }

  return {
    intentClass: "fact_lookup",
    reasoningBudget: "low",
    modelTier: 1,
    shouldFanOut: false,
    relevantAgents: agents.slice(0, 1),
  };
}
