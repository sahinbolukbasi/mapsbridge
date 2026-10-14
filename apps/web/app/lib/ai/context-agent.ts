import { TravelerProfileContext } from "./types";

export interface ContextAnalysisResult {
  personaSummary: string;
  inferredStyle: string;
  preferredThemes: string[];
  recommendationDirective: string;
}

/**
 * Context & Profile Sub-Agent
 * Analyzes the traveler's stored profile, saved map places, and past destinations
 * to synthesize an individualized travel persona.
 */
export function analyzeTravelerContext(context?: TravelerProfileContext): ContextAnalysisResult {
  if (!context) {
    return {
      personaSummary: "Standart keşif odaklı gezgin profili",
      inferredStyle: "balanced",
      preferredThemes: ["Genel Şehir Turu", "Tarih", "Popüler Cazibe Merkezleri"],
      recommendationDirective: "Dengeli, hem ikonik noktaları hem de lezzet duraklarını barındıran zengin bir rota hazırla.",
    };
  }

  const themes: string[] = [];
  const categories = context.favoriteCategories || [];

  if (categories.includes("tarih") || categories.includes("kultur")) {
    themes.push("Tarih & Miras");
  }
  if (categories.includes("lezzet") || categories.includes("gurme")) {
    themes.push("Gastronomi & Yerel Tatlar");
  }
  if (categories.includes("doga") || categories.includes("manzara")) {
    themes.push("Doğa & Panoramik Manzara");
  }
  if (categories.includes("fotograf")) {
    themes.push("Fotoğrafçılık Noktaları");
  }

  if (themes.length === 0) {
    themes.push("Kültür & Şehir Keşfi");
  }

  let inferredStyle = context.travelStyle || "balanced";
  let styleDesc = "dengeli ve konforlu";

  if (inferredStyle === "cultural") styleDesc = "tarihi ve kültürel derinliği önceleyen";
  if (inferredStyle === "foodie") styleDesc = "otantik mutfak ve sokak lezzetlerine tutkun";
  if (inferredStyle === "adventure") styleDesc = "dinamik, yürüyüşü ve keşfi seven";
  if (inferredStyle === "budget") styleDesc = "bütçe dostu, toplu taşıma ve yerel alternatifleri kullanan";
  if (inferredStyle === "luxury") styleDesc = "prestijli ve konfor odaklı";

  const savedCount = context.savedAddressesCount || 0;
  const personaSummary = `${context.username ? `@${context.username}` : "Kullanıcı"} — ${savedCount > 0 ? `${savedCount} kayıtlı pini olan, ` : ""}${styleDesc} bir gezgin profili.`;

  const directive = `Kullanıcı ${themes.join(", ")} temalarına öncelik veriyor. Rota ve önerilerde bu ilgi alanlarına yönelik mekanlara ağırlık ver.`;

  return {
    personaSummary,
    inferredStyle,
    preferredThemes: themes,
    recommendationDirective: directive,
  };
}
