/**
 * Advisor prompt builder — assembles the dynamic system prompt at request time.
 * Combines: base prompt + destination brief + proactive alerts + phase state.
 * Called by the chat handler before invoking Bedrock.
 */

import type { TripPhase } from "../trip/domain";
import { buildDestinationContext } from "./destination-context";
import { formatAlertsForPrompt, type ProactiveAlert } from "./proactive-rules";
import { CHAT_STREAM_PROMPT, ANSWER_PROMPT } from "./prompts";
import { buildVisaContext } from "../visa/formatter";

export interface AdvisorPromptOptions {
  mode: "stream" | "json";
  destination?: string; // "istanbul" | "barcelona" | "paris"
  travelDate?: string;
  interests?: string[];
  phase?: TripPhase;
  questionBudgetRemaining?: number;
  visibleAssumptions?: string[];
  proactiveAlerts?: ProactiveAlert[];
  /** Rendered preferences summary, e.g. "Tempo: sakin, Bütçe: orta, Vegan" */
  preferencesSummary?: string;
  /** Passport ISO-2 for visa rule injection (default "TR"). */
  passportIso2?: string;
  /** Current user location injected during in_trip phase. */
  currentLocation?: { lat: number; lng: number; label?: string };
  /** Anonymized session ref for audit log. */
  sessionRef?: string;
  /** Conversation flow snippet from conversation-flow.ts, injected for stage-aware behavior. */
  flowSnippet?: string;
  /** Past destination names from UserMemoryData.destinations. */
  pastDestinations?: string[];
}

/**
 * Build the complete system prompt for this request.
 * Base prompt + destination context + alerts + phase header.
 */
export function buildAdvisorSystemPrompt(opts: AdvisorPromptOptions): string {
  const base = opts.mode === "stream" ? CHAT_STREAM_PROMPT : ANSWER_PROMPT;
  const parts: string[] = [base];

  // Destination brief injection
  if (opts.destination) {
    const ctx = buildDestinationContext({
      destinationId: opts.destination,
      travelDate: opts.travelDate,
      interests: opts.interests,
    });
    if (ctx) parts.push(ctx);
  }

  // Visa / entry rule injection (Faz D — §9.2)
  // Injected when: destination known AND phase is orient/constrain/draft/prepare
  const visaPhases: Array<TripPhase | undefined> = [
    "orient",
    "constrain",
    "draft",
    "prepare",
    undefined,
  ];
  if (opts.destination && visaPhases.includes(opts.phase)) {
    const visaCtx = buildVisaContext({
      destinationId: opts.destination,
      passportIso2: opts.passportIso2 ?? "TR",
      surface: opts.phase === "prepare" ? "prepare_phase" : "chat",
      sessionRef: opts.sessionRef,
    });
    if (visaCtx) parts.push(visaCtx);
  }

  // Proactive alerts
  if (opts.proactiveAlerts?.length) {
    parts.push(formatAlertsForPrompt(opts.proactiveAlerts));
  }

  // Past destinations memory injection ("daha önce X'e gitmiştin" style references)
  if (opts.pastDestinations?.length) {
    const recent = opts.pastDestinations.slice(-3).join(", ");
    parts.push(`[KULLANICININ GEÇMİŞ SEYAHAT İLGİSİ: ${recent}. Bu bilgiyi doğal referans için kullan — aynı soruyu ikinci kez sorma.]`);
  }

  // Conversation flow snippet (stage-aware behavior hints)
  if (opts.flowSnippet) {
    parts.push(opts.flowSnippet);
  }

  // Phase-aware behaviour header (includes in-trip location if set)
  parts.push(buildPhaseHeader(opts));

  return parts.join("\n");
}

function buildPhaseHeader(opts: AdvisorPromptOptions): string {
  const lines: string[] = [];

  if (opts.phase) {
    const phaseDesc: Record<TripPhase, string> = {
      orient:
        "Destinasyon biliniyor, kısıtlar henüz netleşmedi. Şehri bildiğini göster, en fazla 2 soru sor, taslak sun.",
      constrain: "Tarih/kişi/tempo netleşiyor. Hatırlanan tercihler varsayılan olarak dolduruldu.",
      draft: "İlk plan oluşturuldu. Gerekçeli sun, gerçekçilik itirazlarını yap.",
      refine: "Düzenleme döngüsü. Her değişiklikte etkilenen diğer öğeleri yeniden çöz.",
      prepare: "Seyahat öncesi hazırlık: vize/pasaport, rezervasyon, pratik bilgi.",
      in_trip: "Kullanıcı seyahatte. Cevaplar kısa. Bağlam: şu an, buradan. Sapma normaldir.",
      post_trip: "Seyahat bitti. Hafif geri bildirim topla: 'Bugün en iyisi neydi?'",
    };
    lines.push(`\nMEVCUT FAZ: ${opts.phase.toUpperCase()} — ${phaseDesc[opts.phase]}`);
  }

  if (typeof opts.questionBudgetRemaining === "number") {
    lines.push(`SORU BÜTÇESİ: ${opts.questionBudgetRemaining} soru hakkın kaldı.`);
  }

  if (opts.visibleAssumptions?.length) {
    lines.push(
      "GÖRÜNÜR VARSAYIMLAR (kullanıcıya göster, düzeltme imkânı ver):\n" +
        opts.visibleAssumptions.map((a) => `- ${a}`).join("\n"),
    );
  }

  if (opts.preferencesSummary) {
    lines.push(`KULLANICI TERCİHLERİ: ${opts.preferencesSummary}`);
  }

  // In-trip: inject current location if provided (Faz D)
  if (opts.phase === "in_trip" && opts.currentLocation) {
    const locLabel = opts.currentLocation.label
      ? opts.currentLocation.label
      : `${opts.currentLocation.lat.toFixed(4)}, ${opts.currentLocation.lng.toFixed(4)}`;
    lines.push(
      `KULLANICININ ANLIKI KONUMU: ${locLabel}\n` +
        `Bu faz için kurallar: cevaplar kısa ve doğrudan. Yakın öneriler önce. ` +
        `Sapma normaldir — planı savunma, alternatif bul.`,
    );
  }

  return lines.join("\n");
}

/** Derive a human-readable preferences summary from user prefs object. */
export function buildPreferencesSummary(prefs: {
  pace?: string;
  budget?: string;
  travelStyle?: string;
  interests?: string[];
  constraints?: string[];
  travelers?: { adults?: number; children?: number; pets?: boolean };
  dates?: { start?: string; end?: string; flexible?: boolean; description?: string };
  lodging_type?: string[];
  needs?: { flights?: boolean; car_rental?: boolean };
}): string {
  const parts: string[] = [];
  if (prefs.pace) parts.push(`Tempo: ${prefs.pace}`);
  if (prefs.budget && prefs.budget !== "unspecified") {
    const budgetLabel: Record<string, string> = { budget: "Ekonomik", mid: "Orta", luxury: "Lüks" };
    parts.push(`Bütçe: ${budgetLabel[prefs.budget] || prefs.budget}`);
  }
  if (prefs.travelStyle) parts.push(`Stil: ${prefs.travelStyle}`);
  if (prefs.interests?.length) parts.push(`İlgi: ${prefs.interests.slice(0, 3).join(", ")}`);
  if (prefs.constraints?.length) parts.push(prefs.constraints.slice(0, 2).join(", "));
  if (prefs.travelers) {
    const { adults = 0, children = 0, pets } = prefs.travelers;
    const total = adults + children;
    if (total > 0) {
      let label = `${total} kişi`;
      if (children > 0) label += ` (${children} çocuk)`;
      if (pets) label += " + evcil hayvan";
      parts.push(label);
    }
  }
  if (prefs.dates?.start) parts.push(`Tarih: ${prefs.dates.start.slice(0, 7)}`);
  else if (prefs.dates?.description) parts.push(`Tarih: ${prefs.dates.description}`);
  if (prefs.lodging_type?.length) {
    const lodgingLabel: Record<string, string> = {
      hotel: "Otel",
      hostel: "Hostel",
      apartment: "Apart",
      boutique: "Butik otel",
      resort: "Resort",
    };
    parts.push(`Konaklama: ${lodgingLabel[prefs.lodging_type[0]] || prefs.lodging_type[0]}`);
  }
  if (prefs.needs?.flights) parts.push("Uçuş aranıyor");
  return parts.join(" | ");
}
