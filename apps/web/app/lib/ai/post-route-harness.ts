import type {
  UnifiedRoutePlan,
  TripProfile,
  FlightPriceInfo,
  StayAndTransitInfo,
  PostRouteHarness,
} from "./types";
import type { TripContext } from "./planning";
import type { TravelPreferences } from "./preferences";
import { getDestinationBrief } from "../destination/index";
import { normalizeText } from "./planning";

const TURKISH_DESTINATIONS = [
  "istanbul",
  "ankara",
  "izmir",
  "antalya",
  "kapadokya",
  "nevsehir",
  "bodrum",
  "mugla",
  "fethiye",
  "marmaris",
  "datca",
  "kas",
  "alanya",
  "bursa",
  "eskisehir",
  "gaziantep",
  "sanliurfa",
  "mardin",
  "trabzon",
  "rize",
  "artvin",
  "kars",
  "van",
  "adana",
  "mersin",
  "hatay",
  "konya",
  "kayseri",
  "canakkale",
  "bozcaada",
  "ayvalik",
  "cesme",
  "alacati",
  "urlaub",
  "urla",
  "sapanca",
  "abant",
  "bolu",
  "sinop",
  "samsun",
  "amasya",
  "safranbolu",
  "edirne",
  "pamukkale",
  "denizli",
  "kusadasi",
  "didim",
  "turkiye",
  "turkey",
];

export function isInternationalDestination(destination?: string): boolean {
  if (!destination || !destination.trim()) return false;
  const norm = normalizeText(destination);
  if (TURKISH_DESTINATIONS.some((city) => norm.includes(city))) {
    return false;
  }
  return true;
}

export function detectTripType(
  profile: TripProfile,
  context: TripContext,
): "business" | "short_break" | "leisure" {
  const combined = normalizeText(
    [
      ...(profile.constraints || []),
      ...(context.constraints || []),
      ...(profile.interests?.general || []),
      ...(context.interests || []),
    ].join(" "),
  );
  if (/\b(?:is seyahati|is gezisi|toplanti|fuar|konferans|kongre)\b/u.test(combined)) {
    return "business";
  }
  const days = profile.duration_days || context.days || 0;
  if (days >= 1 && days <= 2) {
    return "short_break";
  }
  return "leisure";
}

export function extractUserAndTripTags(
  profile: TripProfile,
  context: TripContext,
  preferences?: TravelPreferences,
  route?: UnifiedRoutePlan,
): string[] {
  const tags = new Set<string>();
  const dest = route?.destination || profile.destination || context.destination;
  const international = isInternationalDestination(dest);
  const tripType = detectTripType(profile, context);

  tags.add(`trip_type:${tripType}`);
  tags.add(international ? "scope:international" : "scope:domestic");

  if (dest) {
    tags.add(`dest:${normalizeText(dest).replace(/[^a-z0-9]+/g, "_").slice(0, 32)}`);
  }

  const pace = profile.pace || preferences?.pace;
  if (pace) tags.add(`pace:${normalizeText(String(pace)).slice(0, 20)}`);

  const budget = profile.budget?.level || preferences?.budget;
  if (budget && budget !== "unspecified") {
    tags.add(`budget:${normalizeText(String(budget)).slice(0, 20)}`);
  }

  const allInterests = [
    ...(profile.interests?.food || []),
    ...(profile.interests?.culture || []),
    ...(profile.interests?.sports || []),
    ...(profile.interests?.general || []),
    ...(context.interests || []),
    ...(preferences?.interests || []),
  ];
  for (const item of allInterests.slice(0, 8)) {
    const clean = normalizeText(item).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (clean.length >= 2) tags.add(`interest:${clean.slice(0, 24)}`);
  }

  for (const c of profile.constraints || []) {
    const clean = normalizeText(c).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (clean.length >= 2) tags.add(`constraint:${clean.slice(0, 24)}`);
  }
  if (preferences?.travelStyle) {
    tags.add(`style:${normalizeText(preferences.travelStyle).slice(0, 20)}`);
  }

  return Array.from(tags).slice(0, 16);
}

export function buildPostRouteHarness(options: {
  route: UnifiedRoutePlan;
  profile: TripProfile;
  context: TripContext;
  preferences?: TravelPreferences;
  flightPrices?: FlightPriceInfo | null;
  stayAndTransit?: StayAndTransitInfo;
}): PostRouteHarness {
  const { route, profile, context, preferences, flightPrices, stayAndTransit } = options;
  const dest = route.destination || profile.destination || context.destination || "Hedef Şehir";
  const isInternational = isInternationalDestination(dest);
  const tripType = detectTripType(profile, context);
  const userTags = extractUserAndTripTags(profile, context, preferences, route);
  const brief = getDestinationBrief(dest);

  // Extract primary stop clusters / areas from the route stops
  const dayFirstStops = new Map<number, string>();
  for (const stop of route.stops) {
    if (!dayFirstStops.has(stop.day)) {
      dayFirstStops.set(stop.day, stop.name);
    }
  }
  const anchorStops = Array.from(dayFirstStops.values()).slice(0, 3);
  const recommendedAreas =
    stayAndTransit?.recommendedAreas && stayAndTransit.recommendedAreas.length > 0
      ? stayAndTransit.recommendedAreas.slice(0, 3)
      : anchorStops.length > 0
        ? [`${anchorStops[0]} çevresi (Merkez)`, ...anchorStops.slice(1).map((s) => `${s} aksı`)]
        : [`${dest} Şehir Merkezi`];

  const lodgingPref = profile.lodging_type?.[0] || "hotel";
  const lodgingLabel =
    lodgingPref === "boutique"
      ? "Butik Otel"
      : lodgingPref === "apartment"
        ? "Apart / Daire"
        : lodgingPref === "hostel"
          ? "Hostel"
          : lodgingPref === "resort"
            ? "Resort"
            : tripType === "business"
              ? "İş Oteli (Merkezi)"
              : "Merkezi Otel";

  const accommodation = {
    title: "Otel ve Konaklama Planı",
    summary:
      tripType === "business"
        ? `Toplantı ve akşam duraklarına kolay erişim için ${recommendedAreas[0]} bölgesinde hızlı Wi-Fi ve ulaşım bağlantılı ${lodgingLabel.toLowerCase()} önerilir.`
        : `Günlük durak kümelerine yürüme ve toplu taşıma mesafesinde kalmak için ${recommendedAreas.join(", ")} bölgeleri en verimli konaklama noktalarıdır.`,
    recommendedAreas,
    lodgingType: lodgingLabel,
    actionPrompt: `${dest} rotamdaki duraklara yakın ${lodgingLabel.toLowerCase()} ve konaklama bölgelerini detaylandır.`,
  };

  const hasFlightNote =
    flightPrices && flightPrices.source !== "unavailable" && flightPrices.note
      ? flightPrices.note
      : undefined;

  const intercityTransport = {
    title: isInternational ? "Uçak ve Şehirlerarası Ulaşım" : "Uçak ve Otobüs Bileti Seçenekleri",
    mode: (isInternational ? "flight" : "flight_and_bus") as
      | "flight_and_bus"
      | "flight"
      | "bus_or_train",
    flightSummary: hasFlightNote
      ? `${hasFlightNote}. Havalimanından ilk günkü ${anchorStops[0] || "merkez"} durağına doğrudan transfer planlanabilir.`
      : `${dest} için gidiş-dönüş uçak bileti alternatifleri ve havalimanı-merkez transfer bağlantıları kontrol edilebilir.`,
    busOrTrainSummary: isInternational
      ? `Bölgesel hızlı tren veya şehirlerarası otobüs hatları ile çevre şehirlere bağlantı sağlanabilir.`
      : `${dest} merkez otogar / hızlı tren garı üzerinden otobüs veya tren bileti ile ekonomik ve esnek ulaşım mümkündür.`,
    ...(hasFlightNote ? { cheapestFlightNote: hasFlightNote } : {}),
    actionPrompt: isInternational
      ? `${dest} için uçak bileti ve havalimanından şehir merkezine ulaşım seçeneklerini göster.`
      : `${dest} için uçak bileti, otobüs bileti ve gar/havalimanı transfer seçeneklerini karşılaştır.`,
  };

  const cardRecommendation =
    stayAndTransit?.cityCardRecommendation ||
    brief?.gettingAround?.value?.transitCardName ||
    `${dest} günlük/haftalık toplu taşıma kartı veya temassız ulaşım`;

  const cityTransit = {
    title: "Şehir İçi Ulaşım & Günlük Geçişler",
    summary: `Rotadaki ${route.estimatedDays} günlük duraklar coğrafi yakınlığa göre kümelendi. Aynı gün içindeki duraklar arası yürüyüş ve kısa toplu taşıma ile minimum sürede geçilebilir.`,
    cardRecommendation,
    clusterTransferNote:
      anchorStops.length > 1
        ? `Gün başlangıç noktaları (${anchorStops.join(" → ")}) arasında metro/tramvay veya yerel otobüs hatlarını kullanabilirsin.`
        : `${anchorStops[0] || dest} çevresindeki duraklar birbirine yürüme mesafesinde sıralandı.`,
    actionPrompt: `${dest} rotamdaki duraklar arasında şehir içi ulaşım (metro, otobüs, ulaşım kartı) nasıl sağlanır?`,
  };

  const carRecommended =
    brief?.gettingAround?.value?.carRecommended ??
    (profile.needs?.car_rental === true || !isInternational);

  const carRental = {
    recommended: Boolean(carRecommended),
    title: "Araç Kiralama Değerlendirmesi",
    summary: carRecommended
      ? `${dest} ve çevresindeki koy/doğa veya uzak duraklara esnek erişim için havalimanı/merkez teslim araç kiralama uygundur.`
      : `${dest} merkezinde trafik ve park yoğunluğu nedeniyle şehir içi günlerde toplu taşıma/yürüyüş daha hızlıdır; yalnızca şehir dışı günübirlik geçişlerde araç önerilir.`,
    actionPrompt: `${dest} seyahatim için araç kiralama seçeneklerini ve teslim noktalarını göster.`,
  };

  const esim = isInternational
    ? {
        required: true,
        title: "Yurt Dışı e-SIM & Bağlantı Hazırlığı",
        summary: `${dest} yurt dışı seyahatinde harita navigasyonu, dijital biletler ve çeviri için uçuş öncesi e-SIM tanımlaman veya uluslararası dolaşım paketini açman önerilir.`,
        tips: [
          `Uçuş öncesi ${dest} kapsama alanı olan yerel/bölgesel e-SIM QR kodunu telefonuna ekle.`,
          "İnişte veri dolaşımını (Data Roaming) yalnızca e-SIM hattı için aktif et.",
          "Çevrimdışı harita ve bilet PDF'lerini Belgeler alanına yedekle.",
        ],
        actionPrompt: `${dest} seyahati için yurt dışı e-SIM kullanımı, internet paketi ve bağlantı ipuçlarını anlat.`,
      }
    : undefined;

  return {
    destination: dest,
    tripType,
    isInternational,
    userTags,
    accommodation,
    intercityTransport,
    cityTransit,
    carRental,
    ...(esim ? { esim } : {}),
  };
}
