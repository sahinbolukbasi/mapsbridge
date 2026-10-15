import { retrieveTravelEvidence } from "./retrieval";
import { bundledEvidence, mergeEvidence } from "./bundled-evidence";
import { invokeBedrockJSON, invokeBedrockChatStream, invokeIntakeJSON } from "./bedrock-client";
import {
  isRoutePlan,
  type MultiAgentRequestPayload,
  type MultiAgentResponse,
  type UnifiedRoutePlan,
  type RouteStop,
  type StayAndTransitInfo,
  type LocalDiscoveryInfo,
  type EmergencyInfo,
  type SubAgentExecution,
  type NearbyPin,
} from "./types";
import { sanitizePreferences } from "./preferences";
import {
  cleanContext,
  mergeContext,
  missingContext,
  cleanTripProfile,
  contextToProfile,
  mergeTripProfile,
  generateConciergeQuestion,
  calculateTripCompleteness,
  type TripContext,
} from "./planning";
import {
  tripProfileToState,
  tripStateToProfile,
  mergeTripState,
  getNextQuestion,
  stateToContextPrompt,
  computeStateDiff,
  type TripState,
  type AnsweredSlot,
  type TripStateEvent,
} from "./trip-state";
import { classifyIntent, type ClassifiedIntent } from "./intent-classifier";
import { researchPlaces, type PlaceResearch, type ResearchedPlace } from "./place-research";
import { callFlightSearchTool, callAdvisoryTool } from "./agentcore-gateway";
import type { FlightPriceInfo, TravelAdvisoryInfo } from "./types";
import {
  updateFocus,
  defaultFocus,
  focusToPromptSnippet,
  resolveAnaphora,
  type ThreadFocus,
} from "./focus-manager";
import { generateContextChips } from "./context-chips";
import {
  parseItineraryToolCalls,
  assertMutationConsistency,
  buildConfirmationMessage,
  type ItineraryActionPayload,
} from "./itinerary-actions";

import { runTransitStayAgent } from "./sub-agents/transit-stay-agent";
import { runDiscoveryAgent } from "./sub-agents/discovery-agent";
import { runEmergencyAgent } from "./sub-agents/emergency-agent";
import { dispatchSubAgents, type AgentDispatchResult } from "./sub-agents/dispatcher";
import { readEnabledAIAgents } from "../../../../../infra/lambda/src/shared/ai-operations";

import { validateTopicSafety, validateTravelScope } from "./guardrails";
import { INTAKE_PROMPT, INTAKE_SCHEMA, answerSchema, PROMPT_VERSION } from "./prompts";
import { buildAdvisorSystemPrompt, buildPreferencesSummary } from "./advisor-prompt-builder";
import { buildTripAffiliateBundle } from "../affiliate/travelpayouts";
import { buildCuratedActivityCards } from "../affiliate/getyourguide";
import { isExpired, type AffiliateCard } from "../affiliate/types";
import { boundedHistory } from "./model-history";
import { routeEdit, validateRouteEdit } from "./route-edit";

function safeDecisionSummary(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/gu, " ").trim())
    .filter((item) => item.length > 0 && item.length <= 240)
    .filter(
      (item) =>
        !/(?:chain\s+of\s+thought|hidden\s+reasoning|internal\s+reasoning|düşünce\s+zinciri|gizli\s+(?:reasoning|düşünce)|ham\s+(?:reasoning|düşünce))/iu.test(
          item,
        ),
    )
    .slice(0, 3);
}

export async function runMultiAgentSupervisor(
  payload: MultiAgentRequestPayload,
  beforePaidGeneration?: (cost: 1 | 5) => Promise<void>,
  onStreamToken?: (text: string) => void,
): Promise<MultiAgentResponse> {
  const started = Date.now();
  const [request, currentTripOptions] = payload.prompt.split("\nTercihler:");
  const previous = payload.conversationState;
  const conversation = boundedHistory(previous?.messages || payload.conversationHistory || []);
  const base = cleanContext(previous?.context);
  const baseProfile = previous?.profile
    ? cleanTripProfile(previous.profile)
    : contextToProfile(base);

  // 1. Topic Safety & Prompt Injection Check
  const safety = validateTopicSafety(request);
  if (!safety.isSafe) {
    const refusal =
      safety.reason || "İstek güvenlik ve içerik politikalarını ihlal eden kalıplar içeriyor.";
    return {
      provider: "aws_bedrock",
      modelUsed: "guardrail",
      responseMode: "clarify",
      orchestratorSummary: refusal,
      agentsInvolved: [
        {
          agentId: "context",
          agentName: "Güvenlik Denetçisi",
          icon: "🛡️",
          status: "completed",
          durationMs: Date.now() - started,
        },
      ],
      preferenceUpdates: {},
      tripContext: base,
      tripProfile: baseProfile,
      promptVersion: PROMPT_VERSION,
      sources: [],
      retrievalStatus: "disabled",
      conversationState: {
        version: (previous?.version || 0) + 1,
        context: base,
        profile: baseProfile,
        messages: boundedHistory([
          ...conversation,
          { role: "user", content: request },
          { role: "assistant", content: refusal },
        ]),
      },
    };
  }

  // 2. Strict Travel Domain Scope Check
  const scope = validateTravelScope(request);
  if (!scope.isTravelRelated) {
    const refusal =
      scope.refusalMessage ||
      "Ben MapsBridge seyahat asistanıyım. Yalnızca seyahat rotaları, konaklama, yerel lezzetler ve şehir keşifleri konularında size yardımcı olabilirim.";
    return {
      provider: "aws_bedrock",
      modelUsed: "guardrail",
      responseMode: "clarify",
      orchestratorSummary: refusal,
      agentsInvolved: [
        {
          agentId: "context",
          agentName: "Seyahat Kapsam Denetçisi",
          icon: "🗺️",
          status: "completed",
          durationMs: Date.now() - started,
        },
      ],
      preferenceUpdates: {},
      tripContext: base,
      tripProfile: baseProfile,
      promptVersion: PROMPT_VERSION,
      sources: [],
      retrievalStatus: "disabled",
      conversationState: {
        version: (previous?.version || 0) + 1,
        context: base,
        profile: baseProfile,
        messages: boundedHistory([
          ...conversation,
          { role: "user", content: request },
          { role: "assistant", content: refusal },
        ]),
      },
    };
  }

  const decision = await invokeIntakeJSON<any>(
    JSON.stringify({
      request,
      routeMode: payload.routeMode,
      currentTripOptions,
      previousContext: base,
      discussedDestination: previous?.discussedDestination,
      currentRoute: previous?.route
        ? {
            destination: previous.route.destination,
            days: previous.route.estimatedDays,
            stops: previous.route.stops.map((s) => ({ id: s.id, name: s.name, day: s.day })),
          }
        : undefined,
      preferences: sanitizePreferences(payload.preferences),
      profile: baseProfile,
      activeTripManifesto: payload.tripManifestoMarkdown
        ? payload.tripManifestoMarkdown.slice(0, 3000)
        : undefined,
    }),
    {
      systemPrompt: INTAKE_PROMPT,
      history: conversation,
      maxTokens: 1300,
      temperature: 0,
      timeoutMs: 7500,
      schema: INTAKE_SCHEMA,
    },
  );
  if (
    !decision.success ||
    !decision.data ||
    !["clarify", "chat", "plan"].includes(decision.data.action)
  ) {
    const fallbackMessage =
      /^(merhaba|selam|selamlar|günaydın|iyi\s+(günler|akşamlar)|hey|hi|hello|teşekkür|sağ\s*ol)\b/iu.test(
        request.trim(),
      )
        ? "Merhaba! Seyahat rotası, şehir keşfi, konaklama veya yerel lezzetler konusunda yardımcı olabilirim. Nereye gitmek istiyorsun?"
        : "Sohbet bağlamını şu anda güvenilir biçimde çözümleyemedim. Lütfen isteğini biraz daha kısa ve açık yazarak tekrar dener misin?";
    return {
      provider: "aws_bedrock",
      modelUsed: decision.model || "intake-fallback",
      responseMode: "clarify",
      orchestratorSummary: fallbackMessage,
      decisionSummary: [
        "İstek güvenilir biçimde çözümlenemedi.",
        "Doğrulanmamış rota veya öneri üretilmedi.",
      ],
      agentsInvolved: [
        {
          agentId: "context",
          agentName: "Seyahat danışmanı",
          icon: "🗺️",
          status: "fallback",
          durationMs: Date.now() - started,
          summaryNote: "Intake yanıtı doğrulanamadı.",
        },
      ],
      preferenceUpdates: {},
      tripContext: base,
      tripProfile: baseProfile,
      promptVersion: PROMPT_VERSION,
      sources: [],
      retrievalStatus: "unavailable",
      conversationState: {
        version: (previous?.version || 0) + 1,
        context: base,
        profile: baseProfile,
        messages: boundedHistory([
          ...conversation,
          { role: "user", content: request },
          { role: "assistant", content: fallbackMessage },
        ]),
      },
    };
  }
  const context = mergeContext(base, decision.data, request);
  const tripProfile = mergeTripProfile(baseProfile, decision.data, request);
  if (context.destination) tripProfile.destination = context.destination;
  if (context.days) tripProfile.duration_days = context.days;
  tripProfile.completeness = calculateTripCompleteness(tripProfile);

  // Phase 1: TripState tracking
  const previousTripState = previous?.profile
    ? tripProfileToState(previous.profile)
    : tripProfileToState(contextToProfile(base));
  const currentTripState = tripProfileToState(tripProfile);
  const stateEvents = computeStateDiff(previousTripState, currentTripState);

  // Phase 1: AnsweredSlots — accumulate across turns so the same slot is never asked twice (§2.1)
  const previousAnsweredSlots: AnsweredSlot[] = previous?.answeredSlots ?? [];
  const newSlotKeys = new Set(previousAnsweredSlots.map((s) => s.key));
  const mergedAnsweredSlots: AnsweredSlot[] = [...previousAnsweredSlots];
  for (const event of stateEvents) {
    if (!newSlotKeys.has(event.field)) {
      newSlotKeys.add(event.field);
      mergedAnsweredSlots.push({
        key: event.field,
        value: event.newValue,
        answeredAt: event.createdAt,
        source: "stated",
      });
    }
  }

  // Phase 2 (§12.1): Focus management — update focus for this turn
  const currentTurn = (previous?.turn ?? 0) + 1;
  const previousFocus: ThreadFocus = previous?.focus ?? defaultFocus(currentTurn);
  const resolvedRequest = resolveAnaphora(request, previousFocus);
  const currentFocus = updateFocus({
    message: resolvedRequest,
    previousFocus,
    turn: currentTurn,
  });

  // Phase 2: Intent classification for adaptive reasoning
  const intent = classifyIntent(resolvedRequest, !!previous?.route, !!context.destination);

  // Phase 2: Extract assumptions from intake
  const assumptions: string[] = Array.isArray(decision.data.assumptions)
    ? decision.data.assumptions.filter((a: unknown) => typeof a === "string")
    : [];

  const permanent = /her seyahat|her zaman|genelde|daima|kalıcı|tercihim/iu.test(request);
  const preferences = permanent ? sanitizePreferences(decision.data.preferenceUpdates) : {};
  const missing = missingContext(context);
  const noRoute =
    /rota(?:mı|yı)?\s+(?:çizmeden|istemiyorum|değiştirme)|plan(?:ımı|ı)?\s+(?:istemiyorum|değiştirme)/iu.test(
      request,
    );
  const planning =
    !noRoute &&
    (decision.data.action === "plan" ||
      decision.data.action === "clarify" ||
      (context.planningRequested && decision.data.action !== "chat"));
  const edit = routeEdit(decision.data.edit, request, previous?.route);
  const stateContext =
    !planning && previous?.route
      ? context.destination === base.destination
        ? { ...base, constraints: context.constraints }
        : base
      : context;
  const complete = (
    result: Partial<MultiAgentResponse>,
    route?: UnifiedRoutePlan,
  ): MultiAgentResponse => {
    const summary = result.orchestratorSummary || "";
    const storedRoute = route || previous?.route;
    const agentsInvolved = result.agentsInvolved || [
      {
        agentId: "context" as const,
        agentName: "Seyahat danışmanı",
        icon: "🗺️",
        status: "completed" as const,
        durationMs: Date.now() - started,
      },
    ];
    // §12.2 — generate focus-aware chips for this turn
    const suggestedChips = generateContextChips(currentFocus, currentTripState, tripProfile);
    return {
      provider: "aws_bedrock",
      modelUsed: decision.model,
      agentsInvolved,
      preferenceUpdates: preferences,
      tripContext: stateContext,
      tripProfile,
      promptVersion: PROMPT_VERSION,
      ...result,
      orchestratorSummary: summary,
      currentFocus,
      suggestedChips,
      conversationState: {
        version: (previous?.version || 0) + 1,
        context: stateContext,
        profile: tripProfile,
        answeredSlots: mergedAnsweredSlots,
        focus: currentFocus,
        turn: currentTurn,
        ...(context.destination ? { discussedDestination: context.destination } : {}),
        ...(storedRoute ? { route: storedRoute } : {}),
        messages: boundedHistory([
          ...conversation,
          { role: "user" as const, content: request },
          { role: "assistant" as const, content: summary },
        ]),
      },
    };
  };
  if (/şu an|güncel|canlı/iu.test(request) && /fiyat|açık|kapalı|menü|puan/iu.test(request)) {
    return complete({
      responseMode: "clarify",
      orchestratorSummary:
        "Canlı fiyat, menü ve açık/kapalı durumu kontrolü yapamıyorum; bu yüzden kesin fiyat veya şu anda açık işletme listesi veremem. Gezi için yer adı, adres ve konum araştırabilirim. İlgini çeken mutfağı veya semti söyle, buna göre bir keşif rotası hazırlayalım.",
      sources: [],
      retrievalStatus: "disabled",
    });
  }
  if (planning && missing.length) {
    const concierge = generateConciergeQuestion(tripProfile);
    const summary = concierge.question;
    return complete({
      responseMode: "clarify",
      orchestratorSummary: summary,
      sources: [],
      retrievalStatus: "disabled",
      clarification: {
        isUnderspecified: true,
        message: summary,
        guidingQuestions: [concierge.question],
        quickOptions: concierge.quickOptions,
        nearbyPins: [],
      },
    });
  }
  if (planning && context.destination && (!context.interests || context.interests.length === 0)) {
    context.interests = ["kültür", "öne çıkanlar", "lezzet"];
  }
  const mode = planning && missing.length === 0 ? "route" : "chat";
  const currentRoute =
    previous?.route && (mode === "chat" || previous.route.destination === context.destination)
      ? previous.route
      : undefined;
  await beforePaidGeneration?.(mode === "route" ? 5 : 1);
  const researchPromise =
    mode === "route"
      ? researchPlaces(
          context,
          Array.isArray(decision.data.queries)
            ? decision.data.queries.filter((q: any) => typeof q === "string")
            : [],
        )
      : Promise.resolve(undefined);
  const dest = context.destination || "";
  const flightPromise: Promise<FlightPriceInfo | null> =
    mode === "route" && dest
      ? callFlightSearchTool(dest)
          .then((r) => r as FlightPriceInfo | null)
          .catch(() => null)
      : Promise.resolve(null);
  const advisoryPromise: Promise<TravelAdvisoryInfo | null> = dest
    ? callAdvisoryTool(dest)
        .then((r) => r as TravelAdvisoryInfo | null)
        .catch(() => null)
    : Promise.resolve(null);
  const [research, remoteEvidence, flightPrices, travelAdvisory] = await Promise.all([
    researchPromise,
    retrieveTravelEvidence({
      ...payload,
      prompt: `${dest}: ${request} ${context.interests.join(", ")}`,
      conversationHistory: [],
      researchDestination: context.destination,
    }),
    flightPromise,
    advisoryPromise,
  ]);
  const evidence = mergeEvidence(
    remoteEvidence,
    bundledEvidence({ ...payload, researchDestination: context.destination }),
  );
  // Only same-destination stored, previously researched stops can be retained on edit.
  if (research && currentRoute) {
    for (const stop of currentRoute.stops) {
      if (!research.places.some((p) => p.id === stop.id))
        research.places.push({
          id: stop.id,
          name: stop.name,
          lat: stop.lat,
          lng: stop.lng,
          address: stop.address || "",
          category: stop.category || "Gezi",
          checkedAt: (stop as any).checkedAt || research.checkedAt,
        });
    }
  }
  if (mode === "route" && (!research || research.places.length < (context.days || 1)))
    return complete({
      responseMode: "clarify",
      orchestratorSummary: `${context.destination} için ${context.days} günlük gezi tercihlerini kaydettim, ancak yeterli gerçek durak bilgisi alınamadı. Uydurma bir rota vermek istemiyorum. Aynı planı yeniden aramamı isteyebilir veya belirli bir semt söyleyebilirsin.`,
      sources: [],
      retrievalStatus: evidence.status,
    });
  const modelRoute = currentRoute
    ? {
        ...currentRoute,
        stops: currentRoute.stops.map((s) => ({
          ...s,
          ...(research
            ? { id: undefined, placeId: `P${research.places.findIndex((p) => p.id === s.id) + 1}` }
            : {}),
        })),
      }
    : undefined;
  // Build compact flight hint for the model — only verified prices from Travelpayouts
  const flightHint =
    flightPrices && flightPrices.source !== "unavailable" && flightPrices.cheapestPrice
      ? {
          cheapestPrice: flightPrices.cheapestPrice,
          currency: flightPrices.cheapestCurrency || "EUR",
          note: flightPrices.note,
          affiliateLink: flightPrices.affiliateLinkBase,
          deals: (flightPrices.deals || [])
            .slice(0, 2)
            .map((d: any) => ({ price: d.price, month: d.departureMonth, link: d.affiliateLink })),
        }
      : null;
  const input = {
    mode,
    routeMode: payload.routeMode,
    request,
    context,
    personalMemories: payload.personalMemories,
    currentTripOptions,
    preferences: sanitizePreferences(payload.preferences),
    profile: tripProfile,
    userLocation: payload.userLocation,
    currentRoute: modelRoute,
    editContract: edit,
    places: research?.places.map((p, i) => ({ ...p, id: `P${i + 1}` })),
    travelEvidence: evidence.passages,
    activeTripManifesto: payload.tripManifestoMarkdown
      ? payload.tripManifestoMarkdown.slice(0, 4000)
      : undefined,
    ...(flightHint ? { flightData: flightHint } : {}),
    ...(travelAdvisory && travelAdvisory.level
      ? {
          advisoryData: {
            level: travelAdvisory.level,
            levelLabel: travelAdvisory.levelLabel,
            summary: travelAdvisory.summary?.slice(0, 300),
          },
        }
      : {}),
  };
  const destId = (context.destination || "").toLowerCase().replace(/\s+/g, "");
  const prefsSummary = buildPreferencesSummary({
    pace: tripProfile.pace,
    budget: tripProfile.budget?.level,
    travelStyle: (tripProfile as any).travelStyle,
    interests: context.interests,
    constraints: context.constraints,
    travelers: tripProfile.travelers,
    dates: tripProfile.dates,
    lodging_type: tripProfile.lodging_type,
    needs: tripProfile.needs,
  });
  const tripStatePrompt =
    stateToContextPrompt(currentTripState, mergedAnsweredSlots) +
    "\n" +
    focusToPromptSnippet(currentFocus);
  const answerSystemPrompt =
    buildAdvisorSystemPrompt({
      mode: "json",
      destination: destId || undefined,
      interests: context.interests,
      preferencesSummary: prefsSummary || undefined,
      visibleAssumptions: assumptions.length ? assumptions : undefined,
    }) +
    `\n${tripStatePrompt}\nKarar özeti:\n- Ham düşünce zincirini veya gizli reasoning içeriğini asla döndürme.\n- decisionSummary alanında en fazla üç kısa, kullanıcıya faydalı gerekçe ver.\n- Gerekçeler yalnızca doğrulanmış profil, açık istek, araştırma sonuçları ve rota kısıtlarına dayanmalı.\n- Alanı boş bırakmak yerine rota/yanıt seçimini açıklayan kısa maddeler üret.\n- Intent sınıfı: ${intent.intentClass} — reasoning bütçesi: ${intent.reasoningBudget}.`;
  const streamSystemPrompt =
    buildAdvisorSystemPrompt({
      mode: "stream",
      destination: destId || undefined,
      interests: context.interests,
      preferencesSummary: prefsSummary || undefined,
      visibleAssumptions: assumptions.length ? assumptions : undefined,
    }) + `\n${tripStatePrompt}`;

  // Faz C — Build affiliate cards synchronously (URL generation, no async)
  let affiliateCards: AffiliateCard[] | undefined;
  if (destId) {
    try {
      const checkIn = tripProfile.dates?.start ? new Date(tripProfile.dates.start) : undefined;
      const checkOut = tripProfile.dates?.end ? new Date(tripProfile.dates.end) : undefined;
      const bundle = buildTripAffiliateBundle({
        destination: destId,
        checkIn,
        checkOut,
        adults: tripProfile.travelers?.adults,
      });
      const activityCards = buildCuratedActivityCards(destId);
      // isExpired guard: filter any card that carries a stale price (should not happen for
      // link-only cards, but defensive check for future cached-price cards)
      affiliateCards = [
        bundle.flight,
        bundle.hotel,
        bundle.carRental,
        bundle.insurance,
        ...activityCards,
      ].filter((c) => !isExpired(c));
    } catch {
      // Affiliate card generation is non-critical — never fail the main response
    }
  }

  const generate = (repair?: string) => {
    if (mode === "chat" && !repair && onStreamToken) {
      return invokeBedrockChatStream(JSON.stringify(input), {
        systemPrompt: streamSystemPrompt,
        history: conversation,
        maxTokens: 1600,
        temperature: 0.2,
        timeoutMs: Math.max(1000, Math.min(18000, 24500 - (Date.now() - started))),
        onToken: onStreamToken,
      }).then((r) => ({
        success: r.success,
        data: { orchestratorSummary: r.text, decisionSummary: [], citedSourceIds: [] },
        model: r.model,
      }));
    }
    return invokeBedrockJSON<any>(
      JSON.stringify({
        ...input,
        ...(repair
          ? {
              repair: {
                reason: repair,
                instruction:
                  "Önceki aday doğrulanamadı. Bu hatayı gidererek yanıtı ve tam rotayı yeniden üret.",
              },
            }
          : {}),
      }),
      {
        systemPrompt: answerSystemPrompt,
        history: conversation,
        maxTokens: mode === "route" ? Math.min(4200, 1400 + (context.days || 1) * 450) : 1600,
        temperature: 0.2,
        timeoutMs: Math.max(1000, Math.min(18000, 24500 - (Date.now() - started))),
        schema: answerSchema(mode === "route"),
        thinking: mode === "route",
      },
    );
  };
  let output = await generate();
  let route: UnifiedRoutePlan | undefined;
  const validate = () => {
    if (
      !output.success ||
      !output.data ||
      typeof output.data.orchestratorSummary !== "string" ||
      !output.data.orchestratorSummary.trim()
    )
      throw Error("Sohbet yanıtı tamamlanamadı.");
    // Only reject prices that didn't come from verified flightData
    const responseText = JSON.stringify(output.data);
    const priceMatch = responseText.match(
      /(?:\d[\d.,– -]*\s*(?:TL|USD|EUR|JPY|₺|€|¥)|[$₺€¥£]\s*\d)/iu,
    );
    if (priceMatch) {
      const verifiedPrices = flightHint
        ? [
            String(flightHint.cheapestPrice),
            ...(flightHint.deals || []).map((d: any) => String(d.price)),
          ]
        : [];
      const rawNum = priceMatch[0].replace(/[^0-9]/g, "");
      if (!verifiedPrices.includes(rawNum))
        throw Error("Doğrulanmamış fiyat içeren yanıt reddedildi.");
    }
    if (mode === "route") {
      route = buildResearchedRoute(output.data.route, context, research!);
      validateRouteEdit(route, currentRoute, edit);
    }
  };
  try {
    validate();
  } catch (error) {
    if (Date.now() - started > 18500) {
      return complete(
        {
          responseMode: "clarify",
          orchestratorSummary:
            mode === "route"
              ? `${context.destination || "Bu seyahat"} için güvenilir bir rota yanıtı doğrulayamadım. Mevcut planını değiştirmedim; lütfen aynı isteği tekrar dene.`
              : "Yanıtı güvenilir biçimde doğrulayamadım. Lütfen isteğini tekrar dener misin?",
          decisionSummary: [
            "Yanıt doğrulama süresi aşıldı.",
            "Doğrulanmamış bilgi veya rota sunulmadı.",
          ],
          sources: [],
          retrievalStatus: evidence.status,
          ...(previous?.route ? { route: previous.route } : {}),
          clarification: {
            isUnderspecified: false,
            message: "İsteğini tekrar gönderebilirsin.",
            guidingQuestions: [],
            quickOptions: [],
            nearbyPins: [],
          },
        },
        previous?.route,
      );
    }
    try {
      output = await generate(error instanceof Error ? error.message : "Yanıt biçimi geçersiz.");
      validate();
    } catch {
      return complete(
        {
          responseMode: "clarify",
          orchestratorSummary:
            mode === "route"
              ? `${context.destination || "Bu seyahat"} için güvenilir bir rota yanıtı oluşturamadım. Mevcut planını değiştirmedim; lütfen aynı isteği tekrar dene.`
              : "Yanıtı güvenilir biçimde oluşturamadım. Lütfen isteğini biraz daha açık yazarak tekrar dener misin?",
          decisionSummary: [
            "Model yanıtı doğrulanamadı.",
            "Doğrulanmamış bilgi veya rota sunulmadı.",
          ],
          sources: [],
          retrievalStatus: evidence.status,
          ...(previous?.route ? { route: previous.route } : {}),
          clarification: {
            isUnderspecified: false,
            message: "İsteğini tekrar gönderebilirsin.",
            guidingQuestions: [],
            quickOptions: [],
            nearbyPins: [],
          },
        },
        previous?.route,
      );
    }
  }
  const cited = Array.isArray(output.data.citedSourceIds) ? output.data.citedSourceIds : [];
  const sources = evidence.passages
    .filter((p) => cited.includes(p.id))
    .map(({ text, ...source }) => source);
  const requestedSourceIds = cited.filter((id: unknown): id is string => typeof id === "string");
  const sourceCoverage = {
    requested: requestedSourceIds.length,
    resolved: sources.length,
    ratio: requestedSourceIds.length
      ? Math.round((sources.length / requestedSourceIds.length) * 100) / 100
      : evidence.passages.length
        ? 0
        : 1,
  };
  const sourceNote = sources.length
    ? "\n\nKaynaklar:\n" +
      sources
        .map((s) => `[${s.title.replace(/[\[\]\r\n]/g, "")}](${s.url.replace(/\)/g, "%29")})`)
        .join("\n")
    : "";

  let stayAndTransit: StayAndTransitInfo | undefined;
  let discovery: LocalDiscoveryInfo | undefined;
  let emergency: EmergencyInfo | undefined;
  const involved: SubAgentExecution[] = [
    {
      agentId: "context",
      agentName: "Seyahat danışmanı",
      icon: "🗺️",
      status: "completed",
      durationMs: Date.now() - started,
    },
  ];

  const agentDest = context.destination;
  if (agentDest && Date.now() - started < 23500) {
    try {
      const enabledAgents = await readEnabledAIAgents();
      const isTransitOrStay = /konaklama|otel|nerede kal|ulaşım|apart|hostel/iu.test(request);
      const isDiscovery =
        /yerel keşif|gizli köşe|kültürel ipuç|ne yenir|restoran|lezzet|kafe/iu.test(request);
      const isEmergency =
        mode === "route" ||
        /acil|yardım|hastane|polis|doktor|güvenlik|kayıp|pasaport|tehlike/iu.test(request);

      // Phase 3: Dispatch additional domain agents in parallel
      const dispatchPromise = intent.shouldFanOut
        ? dispatchSubAgents({
            request,
            destination: agentDest,
            profile: tripProfile,
            mode,
            enabledAgents,
            timeoutMs: Math.min(4500, 25000 - (Date.now() - started)),
            startedAt: started,
          }).catch(() => [] as AgentDispatchResult[])
        : Promise.resolve([] as AgentDispatchResult[]);

      const [transitRes, discoveryRes] = await Promise.allSettled([
        isTransitOrStay && enabledAgents.has("transit")
          ? runTransitStayAgent(request, agentDest, Math.min(4500, 25000 - (Date.now() - started)))
          : Promise.resolve(undefined),
        isDiscovery && enabledAgents.has("discovery")
          ? runDiscoveryAgent(request, agentDest, Math.min(4500, 25000 - (Date.now() - started)))
          : Promise.resolve(undefined),
      ]);
      const emergencyRes =
        isEmergency && enabledAgents.has("emergency")
          ? runEmergencyAgent(agentDest, request)
          : undefined;

      if (transitRes.status === "fulfilled" && transitRes.value) {
        stayAndTransit = transitRes.value.info;
        involved.push({
          agentId: "transit",
          agentName: "Ulaşım ve Konaklama",
          icon: "🏨",
          status: "completed",
          durationMs: transitRes.value.durationMs,
        });
      } else if (transitRes.status === "rejected") {
        involved.push({
          agentId: "transit",
          agentName: "Ulaşım ve Konaklama",
          icon: "🏨",
          status: classifyAgentFailure(transitRes.reason),
          durationMs: Date.now() - started,
          summaryNote:
            "Yardımcı agent sonucu alınamadı; ana yanıt araştırılmış verilerle sürdürüldü.",
        });
      }
      if (discoveryRes.status === "fulfilled" && discoveryRes.value) {
        discovery = discoveryRes.value.info;
        involved.push({
          agentId: "discovery",
          agentName: "Yerel Keşif & Lezzetler",
          icon: "✨",
          status: "completed",
          durationMs: discoveryRes.value.durationMs,
        });
      } else if (discoveryRes.status === "rejected") {
        involved.push({
          agentId: "discovery",
          agentName: "Yerel Keşif & Lezzetler",
          icon: "✨",
          status: classifyAgentFailure(discoveryRes.reason),
          durationMs: Date.now() - started,
          summaryNote:
            "Yardımcı agent sonucu alınamadı; ana yanıt araştırılmış verilerle sürdürüldü.",
        });
      }
      if (emergencyRes) {
        emergency = emergencyRes.info;
        involved.push({
          agentId: "emergency",
          agentName: "Güvenlik ve Konsolosluk",
          icon: "🛡️",
          status: "completed",
          durationMs: emergencyRes.durationMs,
        });
      }
      // Merge dispatch results into involved agents
      const dispatchResults = await dispatchPromise;
      for (const dr of dispatchResults) {
        if (dr.status !== "skipped") {
          involved.push({
            agentId: dr.agentId as any,
            agentName: dr.agentName,
            icon: dr.icon,
            status: dr.status as any,
            durationMs: dr.durationMs,
            ...(dr.summaryNote ? { summaryNote: dr.summaryNote } : {}),
          });
        }
      }
    } catch (agentErr) {
      console.warn("Sub-agents error:", agentErr instanceof Error ? agentErr.name : "Error");
    }
  }

  let nearbyPins: NearbyPin[] | undefined;
  if (payload.userLocation && research?.places?.length) {
    nearbyPins = findNearbyPlaces(
      payload.userLocation.lat,
      payload.userLocation.lng,
      research.places,
    );
  }

  const decisionSummary = safeDecisionSummary(output.data.decisionSummary);

  // §12.5 — Parse itinerary tool calls from model output
  const rawToolCalls: Array<{ name: string; input: Record<string, unknown> }> = Array.isArray(
    output.data.toolCalls,
  )
    ? output.data.toolCalls
    : [];
  const itineraryActions: ItineraryActionPayload[] = parseItineraryToolCalls(rawToolCalls);

  // §12.5.3 — Consistency guard: if model claims a mutation but no tool call, block delivery
  const finalSummary = output.data.orchestratorSummary.trim() + sourceNote;
  const mutationError = assertMutationConsistency(finalSummary, itineraryActions.length > 0);
  if (mutationError) {
    // Model claimed to add/remove but no tool call was made — return an error prompt
    return complete({
      responseMode: "clarify",
      orchestratorSummary: "İşlemi gerçekleştiremedim. Lütfen tekrar dener misin?",
      sources: [],
      retrievalStatus: "disabled",
    });
  }

  return complete(
    {
      responseMode: mode,
      orchestratorSummary: finalSummary,
      ...(decisionSummary.length ? { decisionSummary } : {}),
      ...(assumptions.length ? { assumptions } : {}),
      sourceCoverage,
      sources,
      retrievalStatus: evidence.status,
      agentsInvolved: involved,
      intentClassification: intent,
      ...(stateEvents.length ? { tripStateEvents: stateEvents } : {}),
      ...(itineraryActions.length ? { itineraryActions } : {}),
      ...(route ? { route } : {}),
      ...(research ? { research } : {}),
      ...(stayAndTransit ? { stayAndTransit } : {}),
      ...(discovery ? { discovery } : {}),
      ...(emergency ? { emergency } : {}),
      ...(flightPrices ? { flightPrices } : {}),
      ...(travelAdvisory ? { travelAdvisory } : {}),
      ...(nearbyPins?.length ? { nearbyPins } : {}),
      ...(affiliateCards?.length ? { affiliateCards } : {}),
      modelUsed: output.model,
    },
    route,
  );
}

function classifyAgentFailure(error: unknown): "failed" | "timeout" {
  const name = error instanceof Error ? error.name : "";
  return name === "TimeoutError" || name === "AbortError" ? "timeout" : "failed";
}

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function findNearbyPlaces(
  userLat: number,
  userLng: number,
  places: ResearchedPlace[],
  maxDistanceKm = 10,
): NearbyPin[] {
  return places
    .map((p) => {
      const distance = haversineDistanceKm(userLat, userLng, p.lat, p.lng);
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        description: `${distance} km mesafede · ${p.address || p.name}`.trim(),
        lat: p.lat,
        lng: p.lng,
        suggestedDuration: p.typicalDurationMins ? `${p.typicalDurationMins} dakika` : "1 saat",
        distanceKm: distance,
      };
    })
    .filter((p) => p.distanceKm <= maxDistanceKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 6)
    .map(({ distanceKm, ...pin }) => pin);
}

export function parseDurationMinutes(durationStr: string): number {
  const s = (durationStr || "").toLowerCase();
  const hourMatch = s.match(/(\d+(?:[.,]\d+)?)\s*(?:saat|sa|hour|hr|h)/i);
  const minMatch = s.match(/(\d+)\s*(?:dakika|dk|min|m)/i);
  let total = 0;
  if (hourMatch) total += Math.round(parseFloat(hourMatch[1].replace(",", ".")) * 60);
  if (minMatch) total += parseInt(minMatch[1], 10);
  return total > 0 ? total : 60;
}

export function sortAndEnrichDayStops(dayStops: RouteStop[]): RouteStop[] {
  if (dayStops.length <= 1) {
    return dayStops.map((s) => ({
      ...s,
      timeSlot: s.timeSlot || "afternoon",
      estimatedMinutes: s.estimatedMinutes || parseDurationMinutes(s.suggestedDuration),
    }));
  }

  // The model's explicit order/time slots and user reorder requests take precedence
  // over a nearest-neighbour heuristic that could move an evening stop to morning.
  const ordered = [...dayStops];

  const total = ordered.length;
  return ordered.map((stop, idx) => {
    const next = ordered[idx + 1];
    const dist = next ? haversineDistanceKm(stop.lat, stop.lng, next.lat, next.lng) : undefined;
    const minutes = stop.estimatedMinutes || parseDurationMinutes(stop.suggestedDuration);
    let slot: "morning" | "afternoon" | "evening" | "night" = "afternoon";
    if (total === 2) {
      slot = idx === 0 ? "morning" : "afternoon";
    } else if (total >= 3) {
      if (idx === 0) slot = "morning";
      else if (idx === total - 1) slot = "evening";
      else slot = "afternoon";
    }
    return {
      ...stop,
      timeSlot: stop.timeSlot || slot,
      estimatedMinutes: minutes,
      ...(dist !== undefined ? { distanceToNextKm: dist } : {}),
    };
  });
}

export function buildResearchedRoute(
  candidate: any,
  context: TripContext,
  research: PlaceResearch,
): UnifiedRoutePlan {
  if (!candidate || !Array.isArray(candidate.stops) || candidate.stops.length > 21)
    throw Error("Rota oluşturulamadı.");
  const estimatedDays = context.days ?? 0;
  if (
    !Number.isInteger(estimatedDays) ||
    estimatedDays < 1 ||
    estimatedDays > 7 ||
    (candidate.estimatedDays !== undefined && candidate.estimatedDays !== estimatedDays)
  )
    throw Error("Geçersiz gün sayısı.");
  const used = new Set<string>();
  const rawStops: RouteStop[] = candidate.stops.map((stop: any) => {
    if (!stop || typeof stop !== "object") throw Error("Geçersiz durak.");
    const place = research.places.find((p, i) => `P${i + 1}` === stop.placeId);
    if (
      !place ||
      used.has(place.id) ||
      !Number.isInteger(stop.day) ||
      stop.day < 1 ||
      stop.day > estimatedDays
    )
      throw Error("Araştırılmamış veya tekrarlı durak.");
    used.add(place.id);
    return {
      id: place.id,
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      address: place.address,
      category: place.category,
      checkedAt: (place as any).checkedAt,
      day: stop.day,
      description: typeof stop.description === "string" ? stop.description.slice(0, 500) : "",
      suggestedDuration:
        typeof stop.suggestedDuration === "string"
          ? stop.suggestedDuration.slice(0, 80)
          : "Süre belirlenmedi",
      estimatedMinutes: place.typicalDurationMins,
      timeSlot:
        stop.timeSlot && ["morning", "afternoon", "evening", "night"].includes(stop.timeSlot)
          ? stop.timeSlot
          : place.recommendedSlot || undefined,
    };
  });

  const enrichedStops: RouteStop[] = [];
  for (let d = 1; d <= estimatedDays; d++) {
    const dayStops = rawStops.filter((s) => s.day === d);
    enrichedStops.push(...sortAndEnrichDayStops(dayStops));
  }

  const route = {
    title: candidate.title,
    summary: candidate.summary,
    theme: candidate.theme,
    destination: context.destination || candidate.destination || "",
    estimatedDays,
    stops: enrichedStops,
  };
  if (
    !isRoutePlan(route) ||
    route.stops.length > 21 ||
    Array.from({ length: route.estimatedDays }, (_, i) => i + 1).some(
      (day) => !enrichedStops.some((s: any) => s.day === day),
    )
  )
    throw Error("Rota doğrulanamadı.");
  return route;
}
