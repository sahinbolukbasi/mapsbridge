/**
 * Route Templates — §12.7
 *
 * Each RouteType has its own question flow, physical constraints,
 * and feasibility overrides. Pattern-based detection converts free
 * Turkish text into a concrete RouteType.
 */

// ---------------------------------------------------------------------------
// Route type taxonomy
// ---------------------------------------------------------------------------

export type RouteType =
  | "seyahat" // multi-day trip (default)
  | "gunluk_gezi" // city day trip
  | "kahve_turu" // third-wave coffee tour
  | "yemek_rotasi" // food route
  | "muze_sanat" // museum / art
  | "fotograf" // photography route
  | "yuruyus_parka" // hiking / nature
  | "kosu_bisiklet" // running / cycling
  | "gece_hayati" // nightlife
  | "alisveris" // shopping
  | "cocukla_gun" // family with kids
  | "tarihi_tema"; // historical theme

/** Turkish display labels for each route type. */
export const ROUTE_TYPE_LABELS: Record<RouteType, string> = {
  seyahat: "Seyahat",
  gunluk_gezi: "Günlük Gezi",
  kahve_turu: "Kahve Turu",
  yemek_rotasi: "Yemek Rotası",
  muze_sanat: "Müze & Sanat",
  fotograf: "Fotoğraf Rotası",
  yuruyus_parka: "Yürüyüş & Doğa",
  kosu_bisiklet: "Koşu & Bisiklet",
  gece_hayati: "Gece Hayatı",
  alisveris: "Alışveriş",
  cocukla_gun: "Çocukla Gün",
  tarihi_tema: "Tarihi Tema",
};

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

/** A single guided question the assistant will ask the user. */
export interface QuestionSlot {
  /** Internal key used for state tracking */
  key: string;
  /** Question text shown to the user (Turkish) */
  question: string;
  /** Optional quick-pick options */
  quickOptions?: { label: string; value: unknown }[];
  required?: boolean;
}

/** Physical and logistical constraints for a route type. */
export interface RouteConstraints {
  /** Maximum number of stops */
  maxStops?: number;
  /** Route is on foot only — no vehicle transit */
  walkingOnly?: boolean;
  /** Specialty / curated-quality venues required (e.g. specialty coffee) */
  specialtyRequired?: boolean;
  /** All stops must be indoors */
  indoorOnly?: boolean;
  /** Outdoor stops preferred */
  outdoorPreferred?: boolean;
  /** Maximum total hours for the route */
  maxDurationHours?: number;
  /** Route is designed for families with children */
  kidsAllowed?: boolean;
  /** Route only makes sense at night */
  nightOnly?: boolean;
  /** Earliest start hour (24h) */
  minStartHour?: number;
  /** Latest end hour (24h, can be next-day: e.g. 4 means 04:00) */
  maxEndHour?: number;
}

/** Overrides the default feasibility thresholds for a given route type. */
export interface FeasibilityOverrides {
  /** Acceptable stops per day range */
  stopsPerDay?: { min: number; max: number };
  /** Acceptable visit duration per stop (minutes) */
  durationPerStopMin?: { min: number; max: number };
  /** Max transit time between consecutive stops (minutes) */
  transitBetweenStopsMax?: number;
  /** Total active hours target for a day */
  totalDayHours?: number;
}

/** Full template for a route type. */
export interface RouteTemplate {
  type: RouteType;
  label: string;
  questions: QuestionSlot[];
  constraints: RouteConstraints;
  feasibilityOverrides: FeasibilityOverrides;
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

const TEMPLATES: Record<RouteType, RouteTemplate> = {
  seyahat: {
    type: "seyahat",
    label: ROUTE_TYPE_LABELS.seyahat,
    questions: [
      {
        key: "destination",
        question: "Nereye gitmek istiyorsun?",
        required: true,
        quickOptions: [
          { label: "Paris", value: "Paris" },
          { label: "Roma", value: "Roma" },
          { label: "Tokyo", value: "Tokyo" },
          { label: "Barselona", value: "Barselona" },
        ],
      },
      {
        key: "durationDays",
        question: "Kaç gün seyahat edeceksin?",
        required: true,
        quickOptions: [
          { label: "3 gün", value: 3 },
          { label: "5 gün", value: 5 },
          { label: "7 gün", value: 7 },
          { label: "10+ gün", value: 10 },
        ],
      },
      {
        key: "interests",
        question: "Ne tür aktiviteler ilgini çeker?",
        quickOptions: [
          { label: "Yemek & Kafe", value: ["food", "cafe"] },
          { label: "Kültür & Tarih", value: ["culture", "history"] },
          { label: "Doğa & Spor", value: ["nature", "sport"] },
          { label: "Her şeyden biraz", value: ["mixed"] },
        ],
      },
      {
        key: "budget",
        question: "Bütçe tercihin nedir?",
        quickOptions: [
          { label: "Ekonomik", value: "budget" },
          { label: "Orta", value: "mid" },
          { label: "Lüks", value: "luxury" },
        ],
      },
    ],
    constraints: {},
    feasibilityOverrides: {
      stopsPerDay: { min: 3, max: 7 },
      durationPerStopMin: { min: 30, max: 180 },
      transitBetweenStopsMax: 30,
      totalDayHours: 10,
    },
  },

  gunluk_gezi: {
    type: "gunluk_gezi",
    label: ROUTE_TYPE_LABELS.gunluk_gezi,
    questions: [
      {
        key: "destination",
        question: "Hangi şehri gezmek istiyorsun?",
        required: true,
      },
      {
        key: "interests",
        question: "Günde ne görmek istersin?",
        quickOptions: [
          { label: "Simgesel yerler", value: ["landmarks"] },
          { label: "Yerel mahalleler", value: ["neighborhoods"] },
          { label: "Müzeler", value: ["museums"] },
          { label: "Yemek & Kafe", value: ["food", "cafe"] },
        ],
      },
      {
        key: "pace",
        question: "Tempon nasıl olsun?",
        quickOptions: [
          { label: "Rahat", value: "relaxed" },
          { label: "Dengeli", value: "moderate" },
          { label: "Yoğun", value: "fast" },
        ],
      },
      {
        key: "startTime",
        question: "Saba kaçta başlamak istersin?",
        quickOptions: [
          { label: "08:00", value: "08:00" },
          { label: "09:00", value: "09:00" },
          { label: "10:00", value: "10:00" },
        ],
      },
    ],
    constraints: {
      maxStops: 8,
      maxDurationHours: 12,
    },
    feasibilityOverrides: {
      stopsPerDay: { min: 4, max: 8 },
      durationPerStopMin: { min: 30, max: 120 },
      transitBetweenStopsMax: 20,
      totalDayHours: 10,
    },
  },

  kahve_turu: {
    type: "kahve_turu",
    label: ROUTE_TYPE_LABELS.kahve_turu,
    questions: [
      {
        key: "destination",
        question: "Hangi şehirde kahve turu yapmak istiyorsun?",
        required: true,
      },
      {
        key: "coffeePreference",
        question: "Kahve tercihin ne yönde?",
        quickOptions: [
          { label: "Espresso bazlı", value: "espresso" },
          { label: "Filter kahve", value: "filter" },
          { label: "Her ikisi", value: "both" },
        ],
      },
      {
        key: "maxStops",
        question: "Kaç duraklı bir tur istiyorsun?",
        quickOptions: [
          { label: "3 durak", value: 3 },
          { label: "4 durak", value: 4 },
          { label: "5 durak", value: 5 },
          { label: "6 durak", value: 6 },
        ],
      },
      {
        key: "mobility",
        question: "Ulaşım nasıl olsun?",
        quickOptions: [
          { label: "Yürüyerek", value: "walking" },
          { label: "Toplu taşıma", value: "transit" },
        ],
      },
    ],
    constraints: {
      maxStops: 6,
      walkingOnly: false,
      specialtyRequired: true,
    },
    feasibilityOverrides: {
      stopsPerDay: { min: 3, max: 6 },
      durationPerStopMin: { min: 20, max: 60 },
      transitBetweenStopsMax: 15,
      totalDayHours: 4,
    },
  },

  yemek_rotasi: {
    type: "yemek_rotasi",
    label: ROUTE_TYPE_LABELS.yemek_rotasi,
    questions: [
      {
        key: "destination",
        question: "Nerede yemek turu yapacaksın?",
        required: true,
      },
      {
        key: "cuisineType",
        question: "Ne tür mutfak tercih edersin?",
        quickOptions: [
          { label: "Yerel mutfak", value: "local" },
          { label: "Street food", value: "street_food" },
          { label: "Fine dining", value: "fine_dining" },
          { label: "Karışık", value: "mixed" },
        ],
      },
      {
        key: "mealTime",
        question: "Öğle mi, akşam mı?",
        quickOptions: [
          { label: "Öğle", value: "lunch" },
          { label: "Akşam", value: "dinner" },
          { label: "Her ikisi", value: "both" },
        ],
      },
      {
        key: "budget",
        question: "Kişi başı bütçen?",
        quickOptions: [
          { label: "€20 altı", value: "budget" },
          { label: "€20-50", value: "mid" },
          { label: "€50+", value: "luxury" },
        ],
      },
    ],
    constraints: {
      maxStops: 5,
    },
    feasibilityOverrides: {
      stopsPerDay: { min: 2, max: 5 },
      durationPerStopMin: { min: 60, max: 150 },
      transitBetweenStopsMax: 20,
      totalDayHours: 6,
    },
  },

  muze_sanat: {
    type: "muze_sanat",
    label: ROUTE_TYPE_LABELS.muze_sanat,
    questions: [
      {
        key: "destination",
        question: "Hangi şehirde müze / sanat rotası planlıyorsun?",
        required: true,
      },
      {
        key: "artType",
        question: "Ne tür sanat ilgini çeker?",
        quickOptions: [
          { label: "Antik / Arkeoloji", value: "ancient" },
          { label: "Resim / Heykel", value: "fine_art" },
          { label: "Çağdaş sanat", value: "contemporary" },
          { label: "Bilim / Doğa tarihi", value: "science" },
        ],
      },
      {
        key: "accessibility",
        question: "Erişilebilirlik gereksinimleri var mı?",
        quickOptions: [
          { label: "Yok", value: false },
          { label: "Tekerlekli sandalye erişimi", value: true },
        ],
      },
      {
        key: "budget",
        question: "Bilet bütçen?",
        quickOptions: [
          { label: "Ücretsiz tercih", value: "free" },
          { label: "€10 altı", value: "low" },
          { label: "€10+", value: "standard" },
        ],
      },
    ],
    constraints: {
      maxStops: 3,
      indoorOnly: true,
    },
    feasibilityOverrides: {
      stopsPerDay: { min: 1, max: 3 },
      durationPerStopMin: { min: 90, max: 240 },
      transitBetweenStopsMax: 25,
      totalDayHours: 8,
    },
  },

  fotograf: {
    type: "fotograf",
    label: ROUTE_TYPE_LABELS.fotograf,
    questions: [
      {
        key: "destination",
        question: "Fotoğraf rotası için şehir?",
        required: true,
      },
      {
        key: "subjects",
        question: "Ne tür kareler arıyorsun?",
        quickOptions: [
          { label: "Mimari", value: "architecture" },
          { label: "Sokak / İnsan", value: "street" },
          { label: "Doğa / Manzara", value: "landscape" },
          { label: "Gece / Uzun pozlama", value: "night" },
        ],
      },
      {
        key: "timeOfDay",
        question: "En iyi ışık zamanı?",
        quickOptions: [
          { label: "Sabah altın saati", value: "golden_hour_morning" },
          { label: "Gün batımı", value: "golden_hour_evening" },
          { label: "Gündüz", value: "midday" },
          { label: "Gece", value: "night" },
        ],
      },
      {
        key: "mobility",
        question: "Ulaşım tercihin?",
        quickOptions: [
          { label: "Yürüyerek", value: "walking" },
          { label: "Araç ile", value: "car" },
        ],
      },
    ],
    constraints: {
      outdoorPreferred: true,
    },
    feasibilityOverrides: {
      stopsPerDay: { min: 4, max: 8 },
      durationPerStopMin: { min: 30, max: 90 },
      transitBetweenStopsMax: 20,
      totalDayHours: 8,
    },
  },

  yuruyus_parka: {
    type: "yuruyus_parka",
    label: ROUTE_TYPE_LABELS.yuruyus_parka,
    questions: [
      {
        key: "region",
        question: "Hangi bölge veya parkta yürüyüş yapmak istiyorsun?",
        required: true,
      },
      {
        key: "difficulty",
        question: "Zorluk seviyesi?",
        quickOptions: [
          { label: "Kolay (düz, asfalt)", value: "easy" },
          { label: "Orta (hafif tırmanış)", value: "moderate" },
          { label: "Zor (dağ parkuru)", value: "hard" },
        ],
      },
      {
        key: "durationHours",
        question: "Ne kadar süre yürümek istersin?",
        quickOptions: [
          { label: "1-2 saat", value: 2 },
          { label: "3-4 saat", value: 4 },
          { label: "Tam gün", value: 8 },
        ],
      },
      {
        key: "transportation",
        question: "Nasıl ulaşacaksın?",
        quickOptions: [
          { label: "Araçlı", value: "car" },
          { label: "Toplu taşıma", value: "transit" },
        ],
      },
    ],
    constraints: {
      outdoorPreferred: true,
      walkingOnly: true,
    },
    feasibilityOverrides: {
      stopsPerDay: { min: 1, max: 3 },
      durationPerStopMin: { min: 120, max: 360 },
      transitBetweenStopsMax: 45,
      totalDayHours: 8,
    },
  },

  kosu_bisiklet: {
    type: "kosu_bisiklet",
    label: ROUTE_TYPE_LABELS.kosu_bisiklet,
    questions: [
      {
        key: "city",
        question: "Hangi şehirde koşmak / bisiklet sürmek istiyorsun?",
        required: true,
      },
      {
        key: "activityType",
        question: "Aktivite türü?",
        quickOptions: [
          { label: "Sabah koşusu", value: "run" },
          { label: "Bisiklet turu", value: "cycling" },
          { label: "İkisi de", value: "both" },
        ],
      },
      {
        key: "distanceKm",
        question: "Hedef mesafe?",
        quickOptions: [
          { label: "5 km", value: 5 },
          { label: "10 km", value: 10 },
          { label: "20 km", value: 20 },
          { label: "30+ km", value: 30 },
        ],
      },
      {
        key: "pace",
        question: "Tempo?",
        quickOptions: [
          { label: "Rahat", value: "easy" },
          { label: "Orta", value: "moderate" },
          { label: "Yarışma temposu", value: "race" },
        ],
      },
    ],
    constraints: {
      outdoorPreferred: true,
    },
    feasibilityOverrides: {
      stopsPerDay: { min: 1, max: 3 },
      durationPerStopMin: { min: 30, max: 180 },
      transitBetweenStopsMax: 10,
      totalDayHours: 4,
    },
  },

  gece_hayati: {
    type: "gece_hayati",
    label: ROUTE_TYPE_LABELS.gece_hayati,
    questions: [
      {
        key: "destination",
        question: "Hangi şehirde gece hayatı rotası planlıyorsun?",
        required: true,
      },
      {
        key: "vibe",
        question: "Ne tür bir gece hayatı arıyorsun?",
        quickOptions: [
          { label: "Kokteyller & Bar", value: "cocktail_bar" },
          { label: "Canlı müzik", value: "live_music" },
          { label: "Elektronik / Kulüp", value: "club" },
          { label: "Sakin & Wine bar", value: "wine_bar" },
        ],
      },
      {
        key: "budget",
        question: "Gece bütçen?",
        quickOptions: [
          { label: "€30 altı", value: "budget" },
          { label: "€30-70", value: "mid" },
          { label: "€70+", value: "luxury" },
        ],
      },
      {
        key: "startTime",
        question: "Geceye ne zaman başlamak istiyorsun?",
        quickOptions: [
          { label: "21:00", value: "21:00" },
          { label: "22:00", value: "22:00" },
          { label: "23:00", value: "23:00" },
        ],
      },
    ],
    constraints: {
      nightOnly: true,
      minStartHour: 21,
      maxEndHour: 4,
      maxStops: 5,
    },
    feasibilityOverrides: {
      stopsPerDay: { min: 2, max: 5 },
      durationPerStopMin: { min: 60, max: 180 },
      transitBetweenStopsMax: 15,
      totalDayHours: 6,
    },
  },

  alisveris: {
    type: "alisveris",
    label: ROUTE_TYPE_LABELS.alisveris,
    questions: [
      {
        key: "destination",
        question: "Hangi şehirde alışveriş yapmak istiyorsun?",
        required: true,
      },
      {
        key: "categories",
        question: "Ne alışverişi yapacaksın?",
        quickOptions: [
          { label: "Moda & Kıyafet", value: "fashion" },
          { label: "Yerel ürünler", value: "local_goods" },
          { label: "Antika & Vintage", value: "antique" },
          { label: "Elektronik", value: "electronics" },
        ],
      },
      {
        key: "budget",
        question: "Toplam alışveriş bütçen?",
        quickOptions: [
          { label: "€100 altı", value: "budget" },
          { label: "€100-300", value: "mid" },
          { label: "€300+", value: "high" },
        ],
      },
      {
        key: "duration",
        question: "Kaç saat ayırabilirsin?",
        quickOptions: [
          { label: "2 saat", value: 2 },
          { label: "4 saat", value: 4 },
          { label: "Tam gün", value: 8 },
        ],
      },
    ],
    constraints: {
      maxDurationHours: 8,
    },
    feasibilityOverrides: {
      stopsPerDay: { min: 2, max: 6 },
      durationPerStopMin: { min: 30, max: 120 },
      transitBetweenStopsMax: 15,
      totalDayHours: 6,
    },
  },

  cocukla_gun: {
    type: "cocukla_gun",
    label: ROUTE_TYPE_LABELS.cocukla_gun,
    questions: [
      {
        key: "destination",
        question: "Hangi şehirde çocuklarla gün planlıyorsun?",
        required: true,
      },
      {
        key: "kidsAges",
        question: "Çocukların yaşları?",
        quickOptions: [
          { label: "0-3 yaş", value: "toddler" },
          { label: "4-8 yaş", value: "child" },
          { label: "9-12 yaş", value: "preteen" },
          { label: "Karışık yaşlar", value: "mixed" },
        ],
      },
      {
        key: "interests",
        question: "Çocuklar ne sever?",
        quickOptions: [
          { label: "Parklar & Oyun alanları", value: "parks" },
          { label: "Müzeler & Bilim", value: "museums" },
          { label: "Hayvanat bahçesi / Akvaryum", value: "animals" },
          { label: "Eğlence merkezi", value: "entertainment" },
        ],
      },
      {
        key: "pace",
        question: "Tempo?",
        quickOptions: [
          { label: "Çok rahat", value: "relaxed" },
          { label: "Orta", value: "moderate" },
        ],
      },
    ],
    constraints: {
      kidsAllowed: true,
      maxStops: 5,
      maxDurationHours: 8,
    },
    feasibilityOverrides: {
      stopsPerDay: { min: 2, max: 4 },
      durationPerStopMin: { min: 60, max: 180 },
      transitBetweenStopsMax: 20,
      totalDayHours: 7,
    },
  },

  tarihi_tema: {
    type: "tarihi_tema",
    label: ROUTE_TYPE_LABELS.tarihi_tema,
    questions: [
      {
        key: "destination",
        question: "Hangi şehirde tarihi rota planlıyorsun?",
        required: true,
      },
      {
        key: "period",
        question: "Hangi dönem ilgini çekiyor?",
        quickOptions: [
          { label: "Antik Çağ", value: "ancient" },
          { label: "Ortaçağ", value: "medieval" },
          { label: "Osmanlı / İslam", value: "ottoman" },
          { label: "Modern Tarih", value: "modern" },
        ],
      },
      {
        key: "depth",
        question: "Derinlik seviyesi?",
        quickOptions: [
          { label: "Yüzeysel (görsel)", value: "surface" },
          { label: "Orta (kısa açıklamalar)", value: "medium" },
          { label: "Derin (rehberli içerik)", value: "deep" },
        ],
      },
      {
        key: "mobility",
        question: "Yürüyüş mesafesi tolere edilebilir mi?",
        quickOptions: [
          { label: "Az yürüyüş", value: "minimal" },
          { label: "Orta", value: "moderate" },
          { label: "Çok yürüyüş tamam", value: "extensive" },
        ],
      },
    ],
    constraints: {},
    feasibilityOverrides: {
      stopsPerDay: { min: 2, max: 5 },
      durationPerStopMin: { min: 60, max: 150 },
      transitBetweenStopsMax: 25,
      totalDayHours: 8,
    },
  },
};

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Returns the full RouteTemplate for the given type.
 */
export function getRouteTemplate(type: RouteType): RouteTemplate {
  return TEMPLATES[type];
}

/**
 * Pattern-based detection of route type from a free-text Turkish message.
 * Falls back to 'seyahat' when no pattern matches.
 */
export function detectRouteType(message: string): RouteType {
  const m = message.toLowerCase();

  if (/kahve|coffee|espresso|specialty|3\.\s*dalga|üçüncü dalga/u.test(m)) {
    return "kahve_turu";
  }
  if (/yemek\s+tur|restoran\s+tur|gastro|lezzet\s+tur|food\s+tour/u.test(m)) {
    return "yemek_rotasi";
  }
  if (/müze|galeri|sanat\s+rotası|sergi/u.test(m)) {
    return "muze_sanat";
  }
  if (/fotoğraf\s+rotası|fotoğraf\s+turu|photo\s+tour|çekim\s+rotası/u.test(m)) {
    return "fotograf";
  }
  if (/yürüyüş|hiking|trekking|doğa\s+yürüyüşü|parkur/u.test(m)) {
    return "yuruyus_parka";
  }
  if (/koşu|bisiklet|cycling|running|maraton/u.test(m)) {
    return "kosu_bisiklet";
  }
  if (/gece\s+hayatı|bar\s+rotası|kulüp|nightlife/u.test(m)) {
    return "gece_hayati";
  }
  if (/alışveriş|shopping|mağaza|çarşı/u.test(m)) {
    return "alisveris";
  }
  if (/çocukla|aile\s+rotası|kids|family\s+trip/u.test(m)) {
    return "cocukla_gun";
  }
  if (/tarihi\s+rota|tarihi\s+tur|osmanlı\s+rotası|antik\s+rota/u.test(m)) {
    return "tarihi_tema";
  }
  if (/günlük\s+gezi|tek\s+günlük|day\s+trip|şehir\s+turu/u.test(m)) {
    return "gunluk_gezi";
  }

  return "seyahat";
}
