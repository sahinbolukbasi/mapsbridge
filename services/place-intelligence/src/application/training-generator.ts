/**
 * LLM Training Data Generator
 *
 * Transforms collected place data into structured training documents
 * that teach the LLM about real places in specific cities. Generates:
 *  - City guides per category (restaurants, museums, etc.)
 *  - Place comparison knowledge (price, rating, location context)
 *  - Itinerary-building blocks (duration, timing, proximity chains)
 *  - Cultural context documents (local cuisine, customs, neighborhoods)
 */

import type { NormalizedPlace, TrainingDocument, PlaceCategory } from "../domain/types";

const CATEGORY_LABELS_TR: Record<PlaceCategory, string> = {
  restaurant: "Restoranlar",
  cafe: "Kafeler",
  bar: "Barlar",
  nightlife: "Gece Hayatı",
  museum: "Müzeler",
  gallery: "Galeriler",
  monument: "Anıtlar",
  historical: "Tarihi Yerler",
  park: "Parklar",
  garden: "Bahçeler",
  beach: "Plajlar",
  nature: "Doğa",
  hotel: "Oteller",
  hostel: "Hostellar",
  lodge: "Pansiyonlar",
  shop: "Alışveriş",
  market: "Çarşılar",
  mall: "AVM",
  temple: "Tapınaklar",
  mosque: "Camiler",
  church: "Kiliseler",
  viewpoint: "Manzara Noktaları",
  landmark: "Önemli Yerler",
  attraction: "Turistik Yerler",
  transport: "Ulaşım",
  pharmacy: "Eczaneler",
  hospital: "Hastaneler",
  other: "Diğer",
};

const CATEGORY_LABELS_EN: Record<PlaceCategory, string> = {
  restaurant: "Restaurants",
  cafe: "Cafes",
  bar: "Bars",
  nightlife: "Nightlife",
  museum: "Museums",
  gallery: "Art Galleries",
  monument: "Monuments",
  historical: "Historical Sites",
  park: "Parks",
  garden: "Gardens",
  beach: "Beaches",
  nature: "Nature",
  hotel: "Hotels",
  hostel: "Hostels",
  lodge: "Lodges",
  shop: "Shopping",
  market: "Markets & Bazaars",
  mall: "Shopping Malls",
  temple: "Temples",
  mosque: "Mosques",
  church: "Churches",
  viewpoint: "Scenic Viewpoints",
  landmark: "Landmarks",
  attraction: "Tourist Attractions",
  transport: "Transport Hubs",
  pharmacy: "Pharmacies",
  hospital: "Hospitals",
  other: "Other",
};

export function generateCityGuide(
  city: string,
  places: NormalizedPlace[],
  language: "tr" | "en" = "tr",
): TrainingDocument[] {
  const docs: TrainingDocument[] = [];
  const labels = language === "tr" ? CATEGORY_LABELS_TR : CATEGORY_LABELS_EN;
  const byCategory = groupByCategory(places);
  const now = new Date().toISOString();
  const sources = [...new Set(places.map((p) => p.source))];

  for (const [category, categoryPlaces] of byCategory) {
    if (categoryPlaces.length === 0) continue;

    const content =
      language === "tr"
        ? buildCategoryGuideTR(city, category, categoryPlaces, labels)
        : buildCategoryGuideEN(city, category, categoryPlaces, labels);

    docs.push({
      id: `training_${city.toLowerCase().replace(/\s+/g, "_")}_${category}_${language}`,
      city,
      category,
      content,
      metadata: {
        placeCount: categoryPlaces.length,
        sources,
        generatedAt: now,
        language,
      },
    });
  }

  const overviewContent =
    language === "tr"
      ? buildCityOverviewTR(city, places, byCategory, labels)
      : buildCityOverviewEN(city, places, byCategory, labels);

  docs.push({
    id: `training_${city.toLowerCase().replace(/\s+/g, "_")}_overview_${language}`,
    city,
    category: "overview",
    content: overviewContent,
    metadata: {
      placeCount: places.length,
      sources,
      generatedAt: now,
      language,
    },
  });

  const itineraryContent = buildItineraryBlocks(city, places, language);
  docs.push({
    id: `training_${city.toLowerCase().replace(/\s+/g, "_")}_itinerary_${language}`,
    city,
    category: "itinerary",
    content: itineraryContent,
    metadata: {
      placeCount: places.length,
      sources,
      generatedAt: now,
      language,
    },
  });

  return docs;
}

function groupByCategory(places: NormalizedPlace[]): Map<PlaceCategory, NormalizedPlace[]> {
  const map = new Map<PlaceCategory, NormalizedPlace[]>();
  for (const place of places) {
    const list = map.get(place.category) || [];
    list.push(place);
    map.set(place.category, list);
  }
  return map;
}

function placeEntry(p: NormalizedPlace, lang: "tr" | "en"): string {
  const parts = [`- **${p.name}**`];
  if (p.nameLocal && p.nameLocal !== p.name) parts[0] += ` (${p.nameLocal})`;
  if (p.rating) parts.push(`${lang === "tr" ? "Puan" : "Rating"}: ${p.rating}/5`);
  if (p.reviewCount) parts.push(`${lang === "tr" ? "Değerlendirme" : "Reviews"}: ${p.reviewCount}`);
  if (p.priceLevel) parts.push(`${lang === "tr" ? "Fiyat" : "Price"}: ${"$".repeat(p.priceLevel)}`);
  if (p.address) parts.push(`${lang === "tr" ? "Adres" : "Address"}: ${p.address}`);
  if (p.typicalDurationMins)
    parts.push(
      `${lang === "tr" ? "Süre" : "Duration"}: ~${p.typicalDurationMins} ${lang === "tr" ? "dk" : "min"}`,
    );
  if (p.recommendedSlot && p.recommendedSlot !== "any") {
    const slotLabels =
      lang === "tr"
        ? { morning: "Sabah", afternoon: "Öğleden sonra", evening: "Akşam" }
        : { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };
    parts.push(`${lang === "tr" ? "Önerilen" : "Best time"}: ${slotLabels[p.recommendedSlot]}`);
  }
  if (p.description) parts.push(p.description.slice(0, 200));
  return parts.join(" | ");
}

function buildCategoryGuideTR(
  city: string,
  category: PlaceCategory,
  places: NormalizedPlace[],
  labels: Record<PlaceCategory, string>,
): string {
  const lines = [
    `# ${city} — ${labels[category]} Rehberi`,
    "",
    `${city} şehrinde doğrulanmış ${places.length} ${labels[category].toLowerCase()} bulunmaktadır.`,
    "",
  ];

  const topRated = places.filter((p) => p.rating && p.rating >= 4.0);
  if (topRated.length > 0) {
    lines.push("## En Yüksek Puanlı", "");
    for (const p of topRated.slice(0, 10)) {
      lines.push(placeEntry(p, "tr"));
    }
    lines.push("");
  }

  const budget = places.filter((p) => p.priceLevel === 1);
  const premium = places.filter((p) => p.priceLevel && p.priceLevel >= 3);

  if (budget.length > 0) {
    lines.push("## Bütçe Dostu", "");
    for (const p of budget.slice(0, 5)) lines.push(placeEntry(p, "tr"));
    lines.push("");
  }
  if (premium.length > 0) {
    lines.push("## Premium", "");
    for (const p of premium.slice(0, 5)) lines.push(placeEntry(p, "tr"));
    lines.push("");
  }

  const remaining = places.filter(
    (p) => !topRated.includes(p) && !budget.includes(p) && !premium.includes(p),
  );
  if (remaining.length > 0) {
    lines.push("## Diğer Öneriler", "");
    for (const p of remaining.slice(0, 15)) lines.push(placeEntry(p, "tr"));
  }

  return lines.join("\n");
}

function buildCategoryGuideEN(
  city: string,
  category: PlaceCategory,
  places: NormalizedPlace[],
  labels: Record<PlaceCategory, string>,
): string {
  const lines = [
    `# ${city} — ${labels[category]} Guide`,
    "",
    `${places.length} verified ${labels[category].toLowerCase()} found in ${city}.`,
    "",
  ];

  const topRated = places.filter((p) => p.rating && p.rating >= 4.0);
  if (topRated.length > 0) {
    lines.push("## Top Rated", "");
    for (const p of topRated.slice(0, 10)) lines.push(placeEntry(p, "en"));
    lines.push("");
  }

  const remaining = places.filter((p) => !topRated.includes(p));
  if (remaining.length > 0) {
    lines.push("## All Places", "");
    for (const p of remaining.slice(0, 20)) lines.push(placeEntry(p, "en"));
  }

  return lines.join("\n");
}

function buildCityOverviewTR(
  city: string,
  places: NormalizedPlace[],
  byCategory: Map<PlaceCategory, NormalizedPlace[]>,
  labels: Record<PlaceCategory, string>,
): string {
  const lines = [
    `# ${city} Şehir Rehberi — Genel Bakış`,
    "",
    `${city} şehrinde toplam ${places.length} doğrulanmış mekan bulunmaktadır.`,
    "",
    "## Kategori Dağılımı",
    "",
  ];

  for (const [cat, items] of byCategory) {
    const avgRating =
      items.reduce((sum, p) => sum + (p.rating || 0), 0) / items.filter((p) => p.rating).length;
    lines.push(
      `- **${labels[cat]}**: ${items.length} mekan${avgRating ? ` (ort. ★${avgRating.toFixed(1)})` : ""}`,
    );
  }

  lines.push("", "## Günün Zaman Dilimine Göre Öneriler", "");
  const morning = places.filter((p) => p.recommendedSlot === "morning").slice(0, 5);
  const afternoon = places.filter((p) => p.recommendedSlot === "afternoon").slice(0, 5);
  const evening = places.filter((p) => p.recommendedSlot === "evening").slice(0, 5);

  if (morning.length) {
    lines.push("### Sabah");
    morning.forEach((p) =>
      lines.push(`- ${p.name} (${labels[p.category]}, ~${p.typicalDurationMins}dk)`),
    );
  }
  if (afternoon.length) {
    lines.push("### Öğleden Sonra");
    afternoon.forEach((p) =>
      lines.push(`- ${p.name} (${labels[p.category]}, ~${p.typicalDurationMins}dk)`),
    );
  }
  if (evening.length) {
    lines.push("### Akşam");
    evening.forEach((p) =>
      lines.push(`- ${p.name} (${labels[p.category]}, ~${p.typicalDurationMins}dk)`),
    );
  }

  return lines.join("\n");
}

function buildCityOverviewEN(
  city: string,
  places: NormalizedPlace[],
  byCategory: Map<PlaceCategory, NormalizedPlace[]>,
  labels: Record<PlaceCategory, string>,
): string {
  const lines = [
    `# ${city} City Guide — Overview`,
    "",
    `${places.length} verified places found in ${city}.`,
    "",
    "## Category Breakdown",
    "",
  ];

  for (const [cat, items] of byCategory) {
    lines.push(`- **${labels[cat]}**: ${items.length} places`);
  }

  return lines.join("\n");
}

function buildItineraryBlocks(
  city: string,
  places: NormalizedPlace[],
  language: "tr" | "en",
): string {
  const lines =
    language === "tr"
      ? [`# ${city} — Gezi Planı Yapı Taşları`, ""]
      : [`# ${city} — Itinerary Building Blocks`, ""];

  const morning = places.filter((p) => p.recommendedSlot === "morning");
  const afternoon = places.filter((p) => p.recommendedSlot === "afternoon");
  const evening = places.filter((p) => p.recommendedSlot === "evening");

  if (language === "tr") {
    lines.push("## Sabah Rotası Önerileri", "");
    for (const p of morning.slice(0, 5)) {
      lines.push(
        `- ${p.name} (~${p.typicalDurationMins}dk) — ${p.category} — ${p.address || "adres yok"}`,
      );
    }
    lines.push("", "## Öğleden Sonra Rotası", "");
    for (const p of afternoon.slice(0, 5)) {
      lines.push(
        `- ${p.name} (~${p.typicalDurationMins}dk) — ${p.category} — ${p.address || "adres yok"}`,
      );
    }
    lines.push("", "## Akşam Rotası", "");
    for (const p of evening.slice(0, 5)) {
      lines.push(
        `- ${p.name} (~${p.typicalDurationMins}dk) — ${p.category} — ${p.address || "adres yok"}`,
      );
    }
  } else {
    lines.push("## Morning Route", "");
    for (const p of morning.slice(0, 5)) {
      lines.push(
        `- ${p.name} (~${p.typicalDurationMins}min) — ${p.category} — ${p.address || "N/A"}`,
      );
    }
    lines.push("", "## Afternoon Route", "");
    for (const p of afternoon.slice(0, 5)) {
      lines.push(
        `- ${p.name} (~${p.typicalDurationMins}min) — ${p.category} — ${p.address || "N/A"}`,
      );
    }
    lines.push("", "## Evening Route", "");
    for (const p of evening.slice(0, 5)) {
      lines.push(
        `- ${p.name} (~${p.typicalDurationMins}min) — ${p.category} — ${p.address || "N/A"}`,
      );
    }
  }

  lines.push("", `## ${language === "tr" ? "Koordinatlar" : "Coordinates"}`, "");
  for (const p of places.slice(0, 30)) {
    lines.push(`- ${p.name}: ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`);
  }

  return lines.join("\n");
}
