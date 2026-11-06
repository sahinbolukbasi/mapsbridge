"use client";
// Oturumlu gezi asistanı (FEAT-013: Kartograf yüzeyi). Görünüm primitive'lerle (Icon, Button,
// IconButton, Tabs, SegmentedControl, Alert, EmptyState) ve studio.css ile çizilir; tüm
// kullanıcı metinleri t() üzerinden (I11). Sunucu kredi zinciri değişmez: istemci kredi
// hesaplamaz, gönder düğmesi sabit rozet taşımaz (S22), işlem başı not girişin altındadır.
// Affiliate yalnız taslak panelinin Hazırlık sekmesinde, PrepPanel ile (I8).
import { useEffect, useRef, useState } from "react";
import { AuthGate } from "../components/auth-gate";
import { openUpgradeModal } from "../components/upgrade-modal";
import { getStoredSession, refreshSession, isTokenExpired } from "../lib/cognito";
import { apiFetch } from "../lib/api-client";
import { userStorage } from "../lib/user-storage";
import {
  isRoutePlan,
  type MultiAgentResponse,
  type UnifiedRoutePlan,
  type StayAndTransitInfo,
  type LocalDiscoveryInfo,
  type EmergencyInfo,
  type FlightPriceInfo,
  type TravelAdvisoryInfo,
} from "../lib/ai/types";
import type { TripContext } from "../lib/ai/planning";
import { planText, shouldRecheckRequest, type ChatMessage } from "../lib/ai/chat";
import { routeToTrip } from "../lib/trip/workspace-store";
import { PLANNER_TRIPS_KEY, readPlannerStore, writePlannerStore } from "../lib/trip/planner-store";
import { tripToMarkdown, saveTripMarkdown } from "../lib/trip/trip-markdown";
import { DAY_COLORS, type Trip, type Pin, type PinCategory } from "../lib/trip/models";
import { interactionTracker } from "../lib/analytics/tracker";
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Icon,
  IconButton,
  LoadingState,
  PageHeader,
  PageShell,
  SegmentedControl,
  Tabs,
  buttonClassName,
  type AlertTone,
  type SegmentOption,
} from "../components/ui";
import { useLocale } from "../lib/locale-context";
import { ComposerBar } from "../components/assistant/composer-bar";
import { MessageBubble, MessageLog } from "../components/assistant/message-log";
import { QuestionCard } from "../components/assistant/question-card";
import { clampQuestions } from "../components/assistant/logic/question-limits";
import {
  clearDraft,
  buildGuestSummaryMessage,
  loadDraft,
  type GuestDraft,
} from "../lib/guest/guest-draft";
import { GuestAssistant, GuestDraftSummary, guestStorage } from "./guest-assistant";
import "./assistant.css";
import "./studio.css";
import { AssistantMessage } from "./assistant-message";
import { ThinkingSteps, sseStatusToLivePhase, type LivePhase } from "./thinking-steps";
import { SmartActions } from "./smart-actions";
import { ContextualFollowups } from "./contextual-followups";
import { PrepPanel } from "./prep-panel";
import { pickPrepContext } from "./prep-context";
import { StudioWelcome } from "./studio-welcome";
import {
  DraftAdvisory,
  DraftDiscovery,
  DraftEmergency,
  DraftStay,
  DraftStops,
  type PlaceInput,
} from "./draft-sections";
import { ROUTE_STYLES, type RouteStyleKey } from "./studio-starters";
import { dateLocale, daysLabel, fill, stopsLabel, type Translate } from "./studio-format";
import { extractDestinationFromText } from "../lib/affiliate/travelpayouts";
import { useUserMemory } from "../lib/ai/user-memory-hook";
import {
  advanceFlow,
  shouldSurfacePricing,
  getFlowQuickReplies,
  EMPTY_FLOW,
  type ConversationFlow,
  type FlowQuickReply,
} from "../lib/ai/conversation-flow";

const STORAGE_KEY = "mapsbridge.ai.sessions.v5";
/** İşlem başı kredi notu (S22): kenar kartı ve sohbet girişi aynı metni gösterir. */
const CREDIT_NOTE_TR =
  "Tercih soruları ücretsiz · Sohbet 1 kredi · Rota oluşturma / düzenleme 5 kredi";
interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  route: UnifiedRoutePlan | null;
  context?: TripContext;
  pendingRequest?: Pending;
  stayAndTransit?: StayAndTransitInfo | null;
  discovery?: LocalDiscoveryInfo | null;
  emergency?: EmergencyInfo | null;
  flightPrices?: FlightPriceInfo | null;
  travelAdvisory?: TravelAdvisoryInfo | null;
}
interface Wallet {
  credits: number;
  usage?: {
    dailyLimit: number;
    requestsToday: number;
    resetsAt: string;
    costs: { clarify: number; chat: number; route: number };
  };
}
interface Pending {
  prompt: string;
  requestId: string;
  conversationId: string;
  trainingConsent?: boolean;
}
type DraftTab = "route" | "stay" | "discovery" | "emergency" | "flights" | "advisory";
const newSession = (): Session => ({
  id: crypto.randomUUID(),
  title: "New trip",
  messages: [],
  route: null,
});

function creditsLabel(t: Translate, n: number): string {
  return fill(
    n === 1 ? t("studio.quota.credits.one", "{n} kredi") : t("studio.quota.credits", "{n} kredi"),
    {
      n,
    },
  );
}

/** Uçuş fiyatları (yalnız Hazırlık sekmesinde, PrepPanel'in flightBlock'u olarak; I8). */
function FlightPrices({ info }: { info: FlightPriceInfo | null | undefined }) {
  const { t, locale } = useLocale();
  if (!info)
    return (
      <p className="as-studio__muted">
        {t(
          "studio.flight.none",
          "Uçuş fiyatı bilgisi bu rota için mevcut değil. Rota oluştururken otomatik kontrol edilir.",
        )}
      </p>
    );
  if (info.source === "unavailable")
    return (
      <div className="as-studio-card">
        <p className="as-studio__muted">{info.note}</p>
      </div>
    );
  return (
    <div className="as-studio-section">
      <div className="as-studio-card as-studio-card--tint">
        <p className="as-studio-section__title">
          <Icon name="plane" size={16} />
          {t("studio.flight.title", "Uçuş fiyatları")}
        </p>
        <p className="as-studio__meta">
          Travelpayouts · {new Date(info.checkedAt).toLocaleDateString(dateLocale(locale))}
        </p>
        <p className="as-studio-card__text">{info.note}</p>
      </div>
      {info.deals.length > 0 && (
        <ul className="as-studio-cards">
          {info.deals.map((deal, idx) => (
            <li key={idx}>
              <a
                href={deal.affiliateLink}
                target="_blank"
                rel="noopener noreferrer"
                className="as-studio-deal"
              >
                <span className="as-studio-deal__route">
                  <strong>
                    {deal.origin} → {deal.destination}
                  </strong>
                  {deal.departureMonth && (
                    <span className="as-studio__meta">{deal.departureMonth}</span>
                  )}
                </span>
                <span className="as-studio-deal__price">
                  <strong>
                    {deal.currency} {deal.price}
                  </strong>
                  <span className="as-studio-deal__cta">
                    {t("studio.flight.search", "Bilet ara")}
                    <Icon name="arrow" size={16} />
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {info.deals[0] && (
        <a
          href={info.deals[0].affiliateLink}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClassName("primary", "md", true)}
        >
          <Icon name="plane" size={16} />
          <span>{t("studio.flight.compare", "Tüm uçuşları karşılaştır")}</span>
        </a>
      )}
      <p className="as-studio__meta">
        {t(
          "studio.flight.disclaimer",
          "Travelpayouts üzerinden arama yapılır. Fiyatlar değişkendir.",
        )}
      </p>
    </div>
  );
}

export default function AIPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState("");
  const [ready, setReady] = useState(false);
  const [trainingConsent, setTrainingConsent] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const speech = useRef<SpeechRecognition | null>(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [notice, setNotice] = useState("");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [authModal, setAuthModal] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelWide, setPanelWide] = useState(false);
  const [day, setDay] = useState(1);
  const [draftTab, setDraftTab] = useState<DraftTab>("route");
  const [mobileTab, setMobileTab] = useState<"chat" | "draft">("chat");
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [routeMode, setRouteMode] = useState<RouteStyleKey>("classic");
  const [streamText, setStreamText] = useState("");
  const [streamPhase, setStreamPhase] = useState<LivePhase | null>(null);
  const [retryAvailable, setRetryAvailable] = useState(false);
  // ?resume=1 (J1 adım 6): kayıt öncesi misafir taslağı. Otomatik ücretli istek YOK.
  const [resumeDraft, setResumeDraft] = useState<GuestDraft | null>(null);
  const lastPromptRef = useRef<string>("");
  const pending = useRef<Pending | null>(null);
  const inFlight = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSendRef = useRef<string | null>(null);
  const session = sessions.find((s) => s.id === activeId) || null;
  const route = session?.route && isRoutePlan(session.route) ? session.route : null;
  const { memory, learnFromPrompt, buildContextString, clearMemory } = useUserMemory();
  const [conversationFlow, setConversationFlow] = useState<ConversationFlow>(EMPTY_FLOW);
  const { t, locale } = useLocale();
  // I8 (§9.1): affiliate yüzeyleri yalnız taslak panelinin Hazırlık bölümünde (prep-panel.tsx).
  const prepContext = pickPrepContext({
    route,
    messages: session?.messages ?? [],
    surfacePricing: shouldSurfacePricing(conversationFlow),
    extractDestination: extractDestinationFromText,
  });
  const draftHeadingRef = useRef<HTMLHeadingElement>(null);
  const openPrep = () => {
    setPanelOpen(true);
    setMobileTab("draft");
    if (route) setDraftTab("flights");
    window.setTimeout(() => draftHeadingRef.current?.focus(), 0);
  };

  // Affiliate click analytics
  useEffect(() => {
    function onAffiliateClick(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      apiFetch("/routes/telemetry", {
        method: "POST",
        body: JSON.stringify({
          events: [{ type: "affiliate_click", ...detail, ts: Date.now() }],
        }),
      }).catch(() => {});
    }
    window.addEventListener("mapsbridge:affiliate_click", onAffiliateClick);
    return () => window.removeEventListener("mapsbridge:affiliate_click", onAffiliateClick);
  }, []);

  async function copyMessageText(msgId: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 2200);
    } catch {
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 2200);
    }
  }

  function deleteSession(id: string) {
    if (inFlight.current) return;
    const remaining = sessions.filter((s) => s.id !== id);
    setSessions(remaining);
    if (activeId === id) {
      setActiveId(remaining[0]?.id || "");
      pending.current = remaining[0]?.pendingRequest || null;
    }
    try {
      userStorage.setItem(STORAGE_KEY, JSON.stringify(remaining.slice(0, 15)));
    } catch {
      // ignore
    }
  }

  function refreshCurrentTrip() {
    if (typeof window === "undefined") return;
    try {
      const raw = readPlannerStore(PLANNER_TRIPS_KEY);
      if (raw) {
        const trips = JSON.parse(raw);
        if (Array.isArray(trips) && trips.length > 0) {
          const tripIdParam = new URLSearchParams(window.location.search).get("tripId");
          const target =
            (tripIdParam ? (trips as Trip[]).find((t) => t.id === tripIdParam) : null) ||
            (trips as Trip[])[0];
          setCurrentTrip(target || null);
          return;
        }
      }
    } catch {
      // ignore
    }
    setCurrentTrip(null);
  }

  function addPlaceToActiveTrip(place: PlaceInput) {
    if (typeof window === "undefined") return;
    try {
      const raw = readPlannerStore(PLANNER_TRIPS_KEY);
      let trips: Trip[] = raw ? (JSON.parse(raw) as Trip[]) : [];
      if (!Array.isArray(trips)) trips = [];

      const dayOne = t("studio.trip.day1", "1. Gün");
      let trip = currentTrip ? trips.find((x) => x.id === currentTrip.id) : trips[0];
      if (!trip) {
        trip = {
          id: `trip-${crypto.randomUUID().slice(0, 8)}`,
          title: place.isHotel
            ? fill(t("studio.trip.hotelTitle", "{name} Konaklamalı Gezi"), { name: place.label })
            : t("studio.trip.defaultTitle", "Seyahat Rotası"),
          destination: place.address || place.label,
          transportMode: "walking",
          days: [{ dayIndex: 1, label: dayOne, color: DAY_COLORS[1], pins: [] }],
          pins: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // Trip tipinde opsiyonel alanlar var; runtime'da gereken tüm zorunlu
          // alanlar yukarıda set edildi. unknown üzerinden güvenli dönüşüm.
        } as unknown as Trip;
        trips.push(trip!);
      }

      const newPin: Pin = {
        id: `pin-${crypto.randomUUID().slice(0, 8)}`,
        tripId: trip!.id,
        label: place.label,
        address: place.address || place.label,
        lat: place.lat ?? 41.0082,
        lng: place.lng ?? 28.9784,
        category: place.isHotel ? "otel" : (place.category as PinCategory) || "genel",
        dayIndex: 1,
        order: (trip!.days?.[0]?.pins?.length || 0) + 1,
        group: place.isHotel
          ? t("studio.trip.groupStay", "Konaklama")
          : t("studio.trip.groupSuggestions", "Öneriler"),
        visited: false,
        durationMinutes: place.durationMinutes || (place.isHotel ? 120 : 60),
        note:
          place.note ||
          (place.isHotel
            ? t("studio.trip.noteHotel", "AI Asistan tarafından önerilen otel")
            : t("studio.trip.noteStop", "AI Asistan tarafından eklendi")),
      };

      if (!trip!.days || trip!.days.length === 0) {
        trip!.days = [{ dayIndex: 1, label: dayOne, color: DAY_COLORS[1], pins: [newPin] }];
      } else {
        if (!trip!.days[0].pins) trip!.days[0].pins = [];
        trip!.days[0].pins.push(newPin);
      }
      trip!.updatedAt = new Date().toISOString();

      if (!writePlannerStore(PLANNER_TRIPS_KEY, JSON.stringify(trips)))
        throw new Error(
          t("studio.err.storage", "Değişiklik kaydedilemedi. Depolama alanını kontrol edin."),
        );
      saveTripMarkdown(trip!.id, tripToMarkdown(trip!));
      setCurrentTrip({ ...trip! });

      interactionTracker.logPinAddToRoute({
        label: newPin.label,
        category: newPin.category,
        tripId: trip!.id,
        dayIndex: newPin.dayIndex,
        isHotel: place.isHotel,
        source: "ai_recommendation",
      });

      setNotice(
        fill(
          place.isHotel
            ? t(
                "studio.notice.addedHotel",
                "“{name}” otel olarak rotana eklendi ve .md manifestosuna işlendi.",
              )
            : t(
                "studio.notice.addedStop",
                "“{name}” durak olarak rotana eklendi ve .md manifestosuna işlendi.",
              ),
          { name: place.label },
        ),
      );
    } catch (e: unknown) {
      setError(
        fill(t("studio.err.addPlace", "Rotaya eklenirken hata: {message}"), {
          message: e instanceof Error ? e.message : String(e),
        }),
      );
    }
  }

  useEffect(() => () => speech.current?.abort(), []);
  async function refreshWallet() {
    try {
      setWallet(await apiFetch<Wallet>("/stripe/wallet"));
    } catch {
      /* Keep last successful wallet until a new read succeeds. */
    }
  }
  useEffect(() => {
    try {
      const raw = userStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        const valid = parsed
          .filter((s) => s && typeof s.id === "string" && Array.isArray(s.messages))
          .map((s) => ({ ...s, route: isRoutePlan(s.route) ? s.route : null }));
        setSessions(valid);
        setActiveId(valid[0]?.id || "");
        pending.current = valid[0]?.pendingRequest || null;
        if (pending.current)
          setError(
            t(
              "studio.err.pendingStored",
              "Önceki isteğin sonucu bekleniyor. Aynı isteği tekrar kontrol edebilirsin.",
            ),
          );
      }
    } catch {
      setError(
        t("studio.err.historyRead", "Sohbet geçmişi okunamadı. Yeni bir sohbet başlatabilirsin."),
      );
    }
    refreshCurrentTrip();
    if (new URLSearchParams(window.location.search).get("resume") === "1") {
      const guestDraft = loadDraft(guestStorage(), Date.now());
      if (guestDraft && (guestDraft.q || Object.keys(guestDraft.answers).length > 0))
        setResumeDraft(guestDraft);
    }
    const query = new URLSearchParams(window.location.search).get("q");
    let draft = "";
    try {
      draft = sessionStorage.getItem("mb:draft-assistant-message") || "";
      if (draft) sessionStorage.removeItem("mb:draft-assistant-message");
    } catch {
      // sessionStorage erişilemezse taslak yok sayılır
    }
    // Öncelik: URL ?q= (paylaşılabilir) > kayıt duvarı öncesi saklanan taslak.
    const seed = (query || draft).slice(0, 2000);
    if (seed) {
      setInput(seed);
      // ?q= ile gelen giriş yapmış kullanıcı: isteğini otomatik başlat (tekrar Enter gerekmesin).
      if (query) autoSendRef.current = query.slice(0, 2000);
    }
    const stored = getStoredSession();
    if (stored?.token) {
      if (isTokenExpired(stored.token)) {
        refreshSession().then((refreshed) => {
          if (refreshed?.token) {
            setIsAuthenticated(true);
            void refreshWallet();
          } else {
            setIsAuthenticated(false);
          }
        });
      } else {
        setIsAuthenticated(true);
        void refreshWallet();
      }
    } else {
      setIsAuthenticated(false);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && getStoredSession()?.token) {
      try {
        userStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 15)));
      } catch {
        setNotice(t("studio.notice.saveFailed", "Sohbet bu cihazda kaydedilemedi."));
      }
    }
  }, [sessions, ready]);
  useEffect(() => {
    if (!ready) return;
    const pending = autoSendRef.current;
    if (!pending) return;
    autoSendRef.current = null;
    // send() kendi auth kontrolünü yapar: giriş yoksa taslağı koruyup modal açar.
    void send(false, pending);
  }, [ready]);
  function startNew() {
    if (inFlight.current) return;
    const next = newSession();
    setSessions((s) => [next, ...s]);
    setActiveId(next.id);
    setPanelOpen(false);
    setMobileTab("chat");
    setError("");
    setErrorCode("");
    setNotice("");
    pending.current = null;
    setInput("");
    setConversationFlow(EMPTY_FLOW);
  }
  function select(id: string) {
    if (inFlight.current) return;
    setActiveId(id);
    setPanelOpen(false);
    setMobileTab("chat");
    setDay(1);
    setError("");
    setErrorCode("");
    setNotice("");
    setConversationFlow(EMPTY_FLOW);
    pending.current = sessions.find((s) => s.id === id)?.pendingRequest || null;
    if (pending.current)
      setError(t("studio.err.pendingSession", "Bu sohbette sonuç bekleyen bir istek var."));
  }
  /** true: sunucu yanıtı başarıyla işlendi (resume taslağı ancak o zaman silinir). */
  async function send(retry = false, customPrompt?: string): Promise<boolean> {
    if (inFlight.current) return false;
    const promptToSend = (customPrompt !== undefined ? customPrompt : input).trim();
    if (!retry && !promptToSend) return false;

    let stored = getStoredSession();
    if (!stored?.token || isTokenExpired(stored.token)) {
      const refreshed = await refreshSession();
      if (refreshed?.token) {
        stored = getStoredSession();
        setIsAuthenticated(true);
      }
    }
    if (!stored?.token) {
      if (promptToSend && !input) setInput(promptToSend);
      setNotice(
        t(
          "studio.notice.signIn",
          "Sohbete devam etmek için lütfen giriş yapın. Sorunuz hazır bekliyor.",
        ),
      );
      setAuthModal(true);
      return false;
    }
    if (retry && !pending.current) return false;
    if (!retry && pending.current) {
      setError(t("studio.err.checkPending", "Önce bekleyen isteği tekrar kontrol et."));
      return false;
    }
    let target = session;
    if (!target) {
      target = newSession();
      setSessions((s) => [target!, ...s]);
      setActiveId(target.id);
    }
    const manifesto = currentTrip ? tripToMarkdown(currentTrip) : undefined;
    const behavioralContext = interactionTracker.getPredictiveAIPrompt();
    const userMemoryContext = buildContextString(memory);
    // Append past destinations in a format supervisor.ts can extract
    const destMemoryLine = memory?.destinations?.length
      ? `destinations: ${memory.destinations.slice(-5).join(", ")}`
      : "";
    const combinedManifesto = [manifesto, behavioralContext, userMemoryContext, destMemoryLine]
      .filter(Boolean)
      .join("\n\n---\n\n");
    // Learn from this prompt to improve future context
    learnFromPrompt(promptToSend);
    const request =
      retry && pending.current
        ? pending.current
        : {
            prompt: promptToSend,
            routeMode,
            requestId: crypto.randomUUID(),
            conversationId: target.id,
            trainingConsent,
            tripManifestoMarkdown: combinedManifesto || undefined,
            conversationFlow:
              conversationFlow.activeTopic !== "none"
                ? {
                    activeTopic: conversationFlow.activeTopic,
                    stage: conversationFlow.stage,
                    gathered: conversationFlow.gathered,
                  }
                : undefined,
          };
    if (!retry) {
      const message: ChatMessage = { id: crypto.randomUUID(), role: "user", text: promptToSend };
      setSessions((s) =>
        s.map((x) =>
          x.id === request.conversationId
            ? {
                ...x,
                title: x.messages.length ? x.title : promptToSend.slice(0, 35),
                messages: [...x.messages, message],
              }
            : x,
        ),
      );
      setInput("");
    }
    pending.current = request;
    setSessions((s) =>
      s.map((x) => (x.id === request.conversationId ? { ...x, pendingRequest: request } : x)),
    );
    inFlight.current = true;
    setBusy(true);
    setError("");
    setErrorCode("");
    setNotice("");
    try {
      const STREAM_URL = process.env.NEXT_PUBLIC_AI_STREAM_URL || "";
      let result: MultiAgentResponse & {
        billing?: { credits: number; cost: number };
        cost?: number;
      };
      if (STREAM_URL) {
        // Stream dene; iş-hatası olmayan bir sebeple (ağ, 5xx, boş gövde, stream
        // kapanması) başarısız olursa çalışan /ai/route-planner yoluna düş. Böylece
        // stream endpoint'i sorunluyken chat tamamen ölmez. İş hataları
        // (401/402/403/409/429 ve AI_DISABLED/REQUEST_IN_PROGRESS) fallback'e düşmez.
        const runStream = async () => {
          const session = getStoredSession();
          let resp: Response;
          try {
            resp = await fetch(STREAM_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
              },
              body: JSON.stringify(request),
              signal: AbortSignal.timeout(38000),
            });
          } catch (fetchErr: unknown) {
            // fetch'in attığı TypeError genelde CORS/preflight reddi, ağ kesintisi ya
            // da timeout'tur — HTTP status'u yoktur. Kullanıcıya anlamlı kod ver.
            const aborted =
              (fetchErr as { name?: string })?.name === "AbortError" ||
              (fetchErr as { name?: string })?.name === "TimeoutError";
            throw Object.assign(
              new Error(
                aborted
                  ? t("studio.err.timeout", "AI yanıtı zaman aşımına uğradı.")
                  : t(
                      "studio.err.unreachable",
                      "AI servisine ulaşılamadı (bağlantı/erişim engellendi).",
                    ),
              ),
              { code: aborted ? "AI_TIMEOUT" : "AI_UNREACHABLE" },
            );
          }
          if (!resp.ok || !resp.body)
            throw Object.assign(new Error(`Stream failed (${resp.status})`), {
              status: resp.status,
            });
          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          let accumulated = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              try {
                const ev = JSON.parse(line.slice(6));
                if (ev.type === "token") {
                  accumulated += ev.text;
                  setStreamText(accumulated);
                } else if (ev.type === "status") {
                  setStreamPhase(sseStatusToLivePhase(ev.phase || "", ev.message));
                } else if (ev.type === "complete") return ev.result;
                else if (ev.type === "error")
                  throw Object.assign(new Error(ev.message || "Stream error"), {
                    code: ev.code,
                    status:
                      ev.code === "UNAUTHORIZED"
                        ? 401
                        : ev.code === "EMAIL_NOT_VERIFIED"
                          ? 403
                          : ev.code === "WALLET_FROZEN"
                            ? 403
                            : ev.code === "INSUFFICIENT_CREDITS"
                              ? 402
                              : ev.code === "USER_DAILY_LIMIT" || ev.code === "SERVICE_DAILY_LIMIT"
                                ? 429
                                : ev.code === "AI_DISABLED"
                                  ? 503
                                  : ev.code === "REQUEST_IN_PROGRESS"
                                    ? 409
                                    : 503,
                  });
              } catch (parseErr) {
                if ((parseErr as { status?: unknown }).status) throw parseErr;
              }
            }
          }
          throw new Error(t("studio.err.streamClosed", "Yanıt tamamlanamadı, akış kapandı."));
        };
        // Buffered fallback: stream (Function URL) erişilemezse API Gateway /ai/chat
        // üzerinden tek-seferlik (streaming'siz) yanıt al. Org politikası public
        // Function URL'i engellediğinde chat yine de çalışır. İş hataları fallback'e düşmez.
        const runBuffered = async () => {
          return (await apiFetch("/ai/chat", {
            method: "POST",
            body: JSON.stringify(request),
          })) as typeof result;
        };
        const isBusinessError = (e: unknown) => {
          const s = (e as { status?: number })?.status;
          return s === 401 || s === 402 || s === 403 || s === 409 || s === 429;
        };
        try {
          result = await runStream();
        } catch (streamErr: unknown) {
          if (isBusinessError(streamErr)) throw streamErr;
          // bağlantı/erişim/5xx → buffered API Gateway yoluna düş
          result = await runBuffered();
        }
        setStreamText("");
        setStreamPhase(null);
      } else {
        // Stream URL yok → doğrudan buffered API Gateway /ai/chat.
        result = (await apiFetch("/ai/chat", {
          method: "POST",
          body: JSON.stringify(request),
        })) as typeof result;
      }
      setTrainingConsent(false);
      if (!result.orchestratorSummary?.trim() || (result.route && !isRoutePlan(result.route)))
        throw Error(t("studio.err.incomplete", "Yanıt tamamlanamadı."));
      const detectedDest = !result.route
        ? extractDestinationFromText(result.orchestratorSummary)
        : undefined;

      // Advance conversation flow after each AI response
      const updatedFlow = advanceFlow(
        conversationFlow,
        promptToSend,
        result.orchestratorSummary,
        detectedDest || result.tripContext?.destination,
      );
      setConversationFlow(updatedFlow);

      // Use flow-aware quick replies when available, else fall back to generic ones
      const flowReplies: FlowQuickReply[] = !result.clarification?.quickOptions?.length
        ? getFlowQuickReplies(updatedFlow, detectedDest || result.tripContext?.destination)
        : [];
      const travelQuickReplies =
        flowReplies.length > 0
          ? flowReplies.map((r) => ({ label: r.label, prompt: r.message }))
          : detectedDest && !result.clarification?.quickOptions?.length
            ? [
                {
                  label: fill(t("studio.quick.route", "{dest} rotası planla"), {
                    dest: detectedDest,
                  }),
                  prompt: fill(t("studio.quick.route.prompt", "{dest} için rota planı oluştur"), {
                    dest: detectedDest,
                  }),
                },
                {
                  label: t("studio.quick.flights", "Uçuş fiyatları?"),
                  prompt: fill(
                    t("studio.quick.flights.prompt", "{dest} uçuş biletleri ne kadar?"),
                    { dest: detectedDest },
                  ),
                },
                {
                  label: t("studio.quick.hotels", "Otel önerileri?"),
                  prompt: fill(t("studio.quick.hotels.prompt", "{dest} otel tavsiyeleri ver"), {
                    dest: detectedDest,
                  }),
                },
              ]
            : undefined;

      const message: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: result.orchestratorSummary,
        ...(result.decisionSummary?.length ? { decisionSummary: result.decisionSummary } : {}),
        ...(result.clarification?.quickOptions?.length
          ? { quickReplies: result.clarification.quickOptions }
          : travelQuickReplies
            ? { quickReplies: travelQuickReplies }
            : {}),
        ...(result.route
          ? {
              route: result.route,
              stayAndTransit: result.stayAndTransit,
              discovery: result.discovery,
              emergency: result.emergency,
              flightPrices: result.flightPrices,
              travelAdvisory: result.travelAdvisory,
            }
          : {}),
        ...(result.nearbyPins?.length ? { nearbyPins: result.nearbyPins } : {}),
      };

      setSessions((s) =>
        s.map((x) =>
          x.id === request.conversationId
            ? {
                ...x,
                pendingRequest: undefined,
                context: result.tripContext || x.context,
                route: result.route || (result.responseMode === "chat" ? x.route : null),
                stayAndTransit:
                  result.stayAndTransit ||
                  (result.responseMode === "chat" ? x.stayAndTransit : null),
                discovery:
                  result.discovery || (result.responseMode === "chat" ? x.discovery : null),
                emergency:
                  result.emergency || (result.responseMode === "chat" ? x.emergency : null),
                flightPrices:
                  result.flightPrices || (result.responseMode === "chat" ? x.flightPrices : null),
                travelAdvisory:
                  result.travelAdvisory ||
                  (result.responseMode === "chat" ? x.travelAdvisory : null),
                messages: [...x.messages, message],
              }
            : x,
        ),
      );
      if (result.route) {
        setDay(1);
        setDraftTab("route");
        setPanelOpen(true);
      } else if (result.responseMode !== "chat") {
        setPanelOpen(false);
        setMobileTab("chat");
      }

      const cost = result.billing?.cost ?? result.cost ?? 0;
      setNotice(
        cost
          ? fill(
              cost === 1
                ? t("studio.notice.cost.one", "{n} kredi kullanıldı.")
                : t("studio.notice.cost", "{n} kredi kullanıldı."),
              { n: cost },
            )
          : t("studio.notice.free", "Danışmanlık ve sorular ücretsizdir."),
      );
      if (result.billing) setWallet((w) => ({ ...w, credits: result.billing!.credits }));
      pending.current = null;
      void refreshWallet();
      return true;
    } catch (e: unknown) {
      const err = e as { code?: string; status?: number; message?: string };
      const code: string = err?.code || "";
      setErrorCode(code);
      if (err?.status === 401 || code === "UNAUTHORIZED") {
        const refreshed = await refreshSession();
        if (refreshed?.token) {
          setError("");
          setErrorCode("");
          setNotice(
            t("studio.notice.sessionRefreshed", "Oturum yenilendi, isteğiniz gönderiliyor..."),
          );
          inFlight.current = false;
          setBusy(false);
          return send(false, promptToSend);
        } else {
          // Kod yoksa da giriş eylemi gösterilsin (metin çevrildiği için metne bakılamaz).
          setErrorCode("UNAUTHORIZED");
          setError(
            t("studio.err.sessionExpired", "Oturum süreniz doldu. Lütfen tekrar giriş yapın."),
          );
          setInput(promptToSend);
          setAuthModal(true);
        }
      } else if (code === "EMAIL_NOT_VERIFIED") {
        setError(
          t(
            "studio.err.emailNotVerified",
            "AI asistanı kullanmak için e-postanızı onaylamanız gerekiyor. Giriş ekranından onay maili gönderebilirsiniz.",
          ),
        );
      } else if (code === "WALLET_FROZEN") {
        setError(
          t(
            "studio.err.walletFrozen",
            "Kredi hesabınız geçici olarak durduruldu. Detay için destek ekibine ulaşın.",
          ),
        );
      } else if (code === "INSUFFICIENT_CREDITS" || err?.status === 402) {
        setError(
          err?.message || t("studio.err.insufficient", "Bu işlem için yeterli krediniz yok."),
        );
        openUpgradeModal(
          err?.message || t("studio.err.insufficientShort", "Krediniz yetersiz."),
          undefined,
          "ai_credits_depleted",
        );
      } else if (code === "USER_DAILY_LIMIT") {
        setError(
          t(
            "studio.err.dailyLimit",
            "Bugünlük 20 mesaj sınırına ulaştınız. Sayaç her gece saat 03:00'te (Türkiye saati) sıfırlanır.",
          ),
        );
      } else if (code === "SERVICE_DAILY_LIMIT") {
        setError(
          t(
            "studio.err.serviceLimit",
            "Servis kapasitesi şu an yoğun. Birkaç dakika sonra tekrar deneyin.",
          ),
        );
        setRetryAvailable(true);
        lastPromptRef.current = promptToSend;
      } else if (code === "AI_DISABLED") {
        setError(
          t(
            "studio.err.maintenance",
            "AI asistanı şu an bakımda. Kısa süre içinde tekrar kullanılabilir olacak.",
          ),
        );
      } else if (code === "REQUEST_IN_PROGRESS") {
        setError(
          t(
            "studio.err.inProgress",
            "Önceki isteğin sonucu bekleniyor. Sonuç gelince otomatik gösterilecek.",
          ),
        );
        setRetryAvailable(true);
      } else if (
        shouldRecheckRequest(err) ||
        err?.status === 408 ||
        ((err?.status ?? 0) >= 500 && code !== "AI_RESULT_UNCONFIRMED")
      ) {
        setError(
          t(
            "studio.err.connection",
            "Bağlantı sorunu oluştu. İsteğiniz kaydedildi, tekrar deneyin.",
          ),
        );
        setRetryAvailable(true);
        lastPromptRef.current = promptToSend;
      } else if (code === "AI_UNREACHABLE" || err?.status === 403) {
        setError(
          t(
            "studio.err.blocked",
            "AI servisine şu anda erişilemiyor (erişim engellendi). Bu geçici bir sunucu/ağ ayarı sorunudur, kredinizle ilgili değildir. Lütfen birazdan tekrar deneyin; sorun sürerse destek ekibine bildirin.",
          ),
        );
        setRetryAvailable(true);
        lastPromptRef.current = promptToSend;
      } else if (code === "AI_TIMEOUT") {
        setError(
          t("studio.err.timeoutRetry", "AI yanıtı zaman aşımına uğradı. Lütfen tekrar deneyin."),
        );
        setRetryAvailable(true);
        lastPromptRef.current = promptToSend;
      } else {
        setError(
          err?.message || t("studio.err.generic", "Yanıt alınamadı. Tekrar deneyebilirsin."),
        );
        setRetryAvailable(false);
      }
      setSessions((s) =>
        s.map((x) => (x.id === request.conversationId ? { ...x, route: null } : x)),
      );
      setPanelOpen(false);
      setMobileTab("chat");
      if (!shouldRecheckRequest(err)) {
        pending.current = null;
        setSessions((s) =>
          s.map((x) => (x.id === request.conversationId ? { ...x, pendingRequest: undefined } : x)),
        );
        if (!input) setInput(request.prompt);
      }
      void refreshWallet();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
    return false;
  }
  // Misafir taslağı yalnızca kullanıcı dokununca sıradan bir kullanıcı mesajı olarak gider; kredi
  // sunucuda bugünkü gibi ayrılır/iade edilir. Taslak yalnızca başarılı yanıttan sonra silinir.
  async function createFromDraft() {
    if (!resumeDraft || !resumeDraft.q || busy) return;
    const ok = await send(false, buildGuestSummaryMessage(resumeDraft, t));
    if (ok) {
      clearDraft(guestStorage());
      setResumeDraft(null);
    }
  }
  function discardDraft() {
    clearDraft(guestStorage());
    setResumeDraft(null);
  }
  function showRoute(value: UnifiedRoutePlan, message: ChatMessage) {
    setSessions((s) =>
      s.map((x) =>
        x.id === activeId
          ? {
              ...x,
              route: value,
              stayAndTransit: message.stayAndTransit || null,
              discovery: message.discovery || null,
              emergency: message.emergency || null,
            }
          : x,
      ),
    );
    setDay(1);
    setPanelOpen(true);
    setMobileTab("draft");
  }
  function openMap() {
    if (!route) return;
    try {
      const raw = readPlannerStore(PLANNER_TRIPS_KEY);
      const trips = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(trips))
        throw Error(
          t("studio.err.mapRead", "Harita kayıtları okunamadı; mevcut veriler değiştirilmedi."),
        );
      const tripId = `ai-${activeId}`;
      const trip = routeToTrip(route, tripId);
      if (
        !writePlannerStore(
          PLANNER_TRIPS_KEY,
          JSON.stringify([...trips.filter((x) => x.id !== tripId), trip]),
        )
      )
        throw Error(t("studio.err.mapTransfer", "Rota aktarılamadı."));
      window.location.assign(`/maps/?tripId=${encodeURIComponent(tripId)}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("studio.err.mapTransfer", "Rota aktarılamadı."));
    }
  }
  function dictate() {
    type SpeechRecognitionCtor = new () => SpeechRecognition;
    const win = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Recognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Recognition) {
      setNotice(
        t(
          "studio.notice.noSpeech",
          "Bu tarayıcı sesli girişi desteklemiyor. Mesajını yazarak gönderebilirsin.",
        ),
      );
      return;
    }
    if (listening) {
      speech.current?.stop();
      return;
    }
    const recognition = new Recognition();
    speech.current = recognition;
    recognition.lang = locale === "en" ? "en-US" : "tr-TR";
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event: SpeechRecognitionEvent) =>
      setInput((old) => `${old} ${event.results[0][0].transcript}`.trim().slice(0, 2000));
    recognition.onerror = () => {
      setListening(false);
      setNotice(t("studio.notice.micError", "Ses alınamadı. Mikrofon iznini kontrol et."));
    };
    recognition.start();
  }
  function addMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const where = fill(t("studio.composer.myLocation", "(Konumum: {lat}, {lng})"), {
          lat: pos.coords.latitude.toFixed(4),
          lng: pos.coords.longitude.toFixed(4),
        });
        setInput((prev) => `${prev} ${where}`);
      },
      () => setNotice(t("studio.composer.locationDenied", "Konum izni alınamadı.")),
    );
  }
  function download() {
    if (!route) return;
    const url = URL.createObjectURL(
      new Blob([planText(route)], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = t("studio.download.filename", "seyahat-plani.txt");
    a.click();
    URL.revokeObjectURL(url);
  }
  async function copy() {
    if (!route) return;
    try {
      await navigator.clipboard.writeText(planText(route));
      setNotice(t("studio.notice.planCopied", "Plan kopyalandı."));
    } catch {
      setError(t("studio.err.planCopy", "Plan kopyalanamadı."));
    }
  }
  /** Öneri/hızlı işlem: girişi doldurur ve mevcut send() ile gönderir (önceki davranış). */
  function pick(prompt: string) {
    setInput(prompt);
    void send(false, prompt);
  }

  if (isAuthenticated === null) {
    return (
      <PageShell layout="app" className="as-studio-shell">
        {/* AC-34: prerender HTML'inde tek h1 (başlık route-registry'den; görsel olarak gizli). */}
        <PageHeader variant="hidden" />
        <div className="as-studio-loading">
          <LoadingState label={t("studio.loading", "Asistan yükleniyor…")} />
        </div>
      </PageShell>
    );
  }

  if (!isAuthenticated) {
    // Misafir asistan (design §6.1): ağ çağrısı yok, kredi durumu yok; tur 3'te AuthGate.
    return <GuestAssistant />;
  }

  const isAuthError =
    errorCode === "UNAUTHORIZED" ||
    (errorCode === "" && (error.includes("giriş") || error.includes("Oturum")));
  const isCreditLow = errorCode === "INSUFFICIENT_CREDITS";
  const isWalletFrozen = errorCode === "WALLET_FROZEN";
  const isEmailVerify = errorCode === "EMAIL_NOT_VERIFIED";
  const isDailyLimit = errorCode === "USER_DAILY_LIMIT";
  const isServiceLimit = errorCode === "SERVICE_DAILY_LIMIT";
  const isMaintenance = errorCode === "AI_DISABLED";
  const errorTone: AlertTone = isCreditLow
    ? "warning"
    : isEmailVerify || isDailyLimit || isServiceLimit || isMaintenance
      ? "info"
      : "danger";
  const showRetry =
    retryAvailable ||
    (!isAuthError &&
      !isEmailVerify &&
      !isCreditLow &&
      !isWalletFrozen &&
      !isDailyLimit &&
      Boolean(pending.current));
  const lastMessage = session?.messages[session.messages.length - 1];
  const selectedStyle = ROUTE_STYLES.find((s) => s.key === routeMode) ?? ROUTE_STYLES[1];
  const styleOption = (style: (typeof ROUTE_STYLES)[number]): SegmentOption<RouteStyleKey> => ({
    value: style.key,
    label: (
      <span className="as-studio__style-option">
        <Icon name={style.icon} size={16} />
        {t(...style.label)}
      </span>
    ),
  });
  const advisoryWarn = Boolean(
    session?.travelAdvisory?.level && session.travelAdvisory.level !== "normal",
  );

  return (
    <PageShell layout="app" className="as-studio-shell">
      {/* AC-34: tek h1 "Seyahat asistanı" (registry, görsel olarak gizli); marka satırı <p>. */}
      <PageHeader variant="hidden" />
      <div className="as-studio-frame">
        <div className="as-studio__switch">
          <SegmentedControl
            label={t("studio.view.label", "Görünüm")}
            value={mobileTab}
            onChange={(v) => {
              setMobileTab(v);
              setPanelOpen(v === "draft");
            }}
            options={[
              { value: "chat", label: t("studio.view.chat", "Sohbet") },
              {
                value: "draft",
                label: route
                  ? `${t("studio.view.route", "Rota")} · ${stopsLabel(t, route.stops.length)}`
                  : t("studio.view.route", "Rota"),
              },
            ]}
          />
        </div>
        <div
          className="as-studio"
          data-panel={panelOpen ? "open" : "closed"}
          data-wide={panelWide ? "true" : undefined}
          data-view={mobileTab}
        >
          <aside
            className="as-studio__sessions"
            aria-label={t("studio.sessions.label", "Sohbetler")}
          >
            <Button
              variant="primary"
              fullWidth
              iconStart={<Icon name="plus" size={16} />}
              onClick={startNew}
              disabled={busy}
            >
              {t("studio.new", "Yeni seyahat planla")}
            </Button>
            <div className="as-studio__sessions-head">
              <p className="as-studio__eyebrow">{t("studio.sessions.title", "Sohbet geçmişi")}</p>
              {sessions.length > 0 && (
                <span className="as-studio__meta">
                  {fill(t("studio.sessions.count", "{n} kayıt"), { n: sessions.length })}
                </span>
              )}
            </div>
            {sessions.length ? (
              <ul className="as-studio-history">
                {sessions.map((s, idx) => {
                  const active = s.id === activeId;
                  const title = s.messages.length
                    ? s.title
                    : t("studio.sessions.untitled", "Yeni gezi");
                  return (
                    <li
                      key={s.id}
                      className="as-studio-history__item"
                      data-active={active || undefined}
                    >
                      <button
                        type="button"
                        disabled={busy}
                        className="as-studio-history__open"
                        aria-current={active ? "true" : undefined}
                        onClick={() => select(s.id)}
                      >
                        <Icon name={active ? "message" : "clock"} size={16} />
                        <span className="as-studio-history__title">{title}</span>
                        <span className="as-studio-history__code">
                          {s.id.slice(0, 2).toUpperCase()}-{(idx + 1).toString().padStart(3, "0")}
                        </span>
                      </button>
                      <IconButton
                        icon="trash"
                        size="sm"
                        label={`${t("studio.sessions.delete", "Sohbeti sil")}: ${title}`}
                        onClick={() => deleteSession(s.id)}
                      />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="as-studio__muted">
                {t("studio.sessions.empty", "Birlikte ilk gezini planlayalım.")}
              </p>
            )}
            <div className="as-studio__quota" data-surface="default">
              <p className="as-studio__quota-title">
                {wallet
                  ? creditsLabel(t, wallet.credits)
                  : t("studio.quota.fallback", "Seyahat danışmanın")}
              </p>
              <p className="as-studio__meta">{t("assistant.composer.costNote", CREDIT_NOTE_TR)}</p>
              {wallet?.usage && (
                <p className="as-studio__meta">
                  {fill(
                    t(
                      "studio.quota.usage",
                      "Bugün {used} / {limit} mesaj denemesi. Yenilenme: {time}.",
                    ),
                    {
                      used: wallet.usage.requestsToday,
                      limit: wallet.usage.dailyLimit,
                      time: new Date(wallet.usage.resetsAt).toLocaleTimeString(dateLocale(locale), {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                    },
                  )}
                </p>
              )}
            </div>
          </aside>

          <section
            className="as-studio__chat"
            aria-label={t("studio.chat.label", "Seyahat sohbeti")}
          >
            <div className="as-studio__head">
              <span className="as-studio__avatar">
                <Icon name="sparkle" size={20} />
              </span>
              <div className="as-studio__head-text">
                <p className="as-studio__title">{t("studio.head.title", "MapsBridge AI")}</p>
                <p className="as-studio__sub">
                  <span className="as-studio__online" aria-hidden="true" />
                  {t("studio.head.sub", "Seyahat asistanın hazır")}
                </p>
              </div>
              <div className="as-studio__head-actions">
                <span className="as-studio__new-mobile">
                  <Button
                    variant="secondary"
                    size="sm"
                    iconStart={<Icon name="plus" size={16} />}
                    onClick={startNew}
                    disabled={busy}
                  >
                    {t("studio.newShort", "Yeni")}
                  </Button>
                </span>
                <IconButton
                  icon="route"
                  label={
                    panelOpen
                      ? t("studio.panel.collapse", "Sohbeti büyüt")
                      : t("studio.panel.open", "Rota panelini aç")
                  }
                  expanded={panelOpen}
                  controls="route-draft"
                  onClick={() => {
                    setPanelOpen(!panelOpen);
                    setMobileTab(panelOpen ? "chat" : "draft");
                  }}
                />
              </div>
            </div>

            {session?.context && (
              <ul
                className="as-studio__chips"
                aria-label={t("studio.context.label", "Gezi tercihleri")}
              >
                {session.context.destination && (
                  <li>
                    <Badge tone="neutral">{session.context.destination}</Badge>
                  </li>
                )}
                {session.context.days && (
                  <li>
                    <Badge tone="neutral">{daysLabel(t, session.context.days)}</Badge>
                  </li>
                )}
                {session.context.interests?.map((i) => (
                  <li key={i}>
                    <Badge tone="neutral">{i}</Badge>
                  </li>
                ))}
              </ul>
            )}
            {(memory.interests.length > 0 ||
              memory.destinations.length > 0 ||
              memory.budgetHabit) && (
              <div
                className="as-studio__memory"
                role="group"
                aria-label={t("studio.memory.label", "Kullanıcı hafızası")}
              >
                <Icon name="user" size={16} />
                <span className="as-studio__memory-title">
                  {t("studio.memory.title", "Seni tanıyorum:")}
                </span>
                {memory.destinations.slice(-2).map((d) => (
                  <Badge key={d} tone="highlight">
                    {d}
                  </Badge>
                ))}
                {memory.interests.slice(-3).map((i) => (
                  <Badge key={i} tone="highlight">
                    {i}
                  </Badge>
                ))}
                {memory.budgetHabit && (
                  <Badge tone="highlight">
                    {memory.budgetHabit === "budget"
                      ? t("studio.memory.budget.budget", "ekonomik")
                      : memory.budgetHabit === "luxury"
                        ? t("studio.memory.budget.luxury", "lüks")
                        : t("studio.memory.budget.mid", "orta bütçe")}
                  </Badge>
                )}
                <Button
                  variant="link"
                  size="sm"
                  onClick={clearMemory}
                  aria-label={t("studio.memory.resetLabel", "Hafızayı sıfırla")}
                >
                  {t("studio.memory.reset", "Sıfırla")}
                </Button>
              </div>
            )}
            {!session?.messages.length && !resumeDraft && !busy ? (
              // Boş sohbet: karşılama kendi kaydırma alanında, başından görünür (MessageLog sona
              // kaydırır). İlk mesajla birlikte MessageLog'a geçilir.
              <div className="as-studio__welcome-scroll">
                <StudioWelcome busy={busy} onPick={pick} />
              </div>
            ) : (
              <MessageLog
                className="as-studio__log"
                label={t("assistant.log.label", "Sohbet")}
                busy={busy}
                typing={
                  busy &&
                  (streamText ? (
                    <div className="as-studio__stream" role="status">
                      {streamText}
                      <span className="as-studio__cursor" aria-hidden="true">
                        ▋
                      </span>
                    </div>
                  ) : (
                    <div className="as-studio__typing" role="status">
                      <ThinkingSteps
                        isRoute={input.length > 20 || (session?.messages.length || 0) >= 2}
                        livePhase={streamPhase}
                      />
                    </div>
                  ))
                }
              >
                {resumeDraft && (
                  <div className="as-resume">
                    <GuestDraftSummary
                      draft={resumeDraft}
                      busy={busy}
                      onCreate={() => void createFromDraft()}
                      // Misafir kartıyla aynı kural (FEAT-006 review #2): yer yoksa özet gönderilmez.
                      blockedReason={
                        resumeDraft.q
                          ? undefined
                          : t(
                              "guest.summary.needPlace",
                              "Taslak için önce nereye gitmek istediğini yaz.",
                            )
                      }
                      secondary={
                        <Button variant="ghost" onClick={discardDraft} disabled={busy}>
                          {t("guest.resume.discard", "Taslağı sil")}
                        </Button>
                      }
                    />
                  </div>
                )}
                {session?.messages.map((m) => (
                  <MessageBubble key={m.id} role={m.role === "user" ? "user" : "assistant"}>
                    {m.role === "assistant" ? <AssistantMessage text={m.text} /> : m.text}

                    {/* Mesaj araçları: kopyala, rotayı incele, haritada aç. */}
                    {m.role === "assistant" && (
                      <div className="as-studio-msg__actions">
                        <Button
                          variant="ghost"
                          size="sm"
                          iconStart={
                            <Icon name={copiedMsgId === m.id ? "check" : "copy"} size={16} />
                          }
                          onClick={() => copyMessageText(m.id, m.text)}
                        >
                          {copiedMsgId === m.id
                            ? t("studio.msg.copied", "Kopyalandı")
                            : t("studio.msg.copy", "Kopyala")}
                        </Button>
                        {m.route && isRoutePlan(m.route) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            iconStart={<Icon name="map" size={16} />}
                            onClick={() => showRoute(m.route!, m)}
                          >
                            {`${t("studio.msg.review", "Rotayı incele")} · ${stopsLabel(t, m.route.stops.length)}`}
                          </Button>
                        )}
                        {currentTrip && (
                          <Button
                            variant="ghost"
                            size="sm"
                            href={`/maps/?tripId=${currentTrip.id}`}
                            iconStart={<Icon name="external" size={16} />}
                          >
                            {t("studio.msg.openMap", "Haritada aç")}
                          </Button>
                        )}
                      </div>
                    )}

                    {m.role === "assistant" &&
                      m.decisionSummary &&
                      m.decisionSummary.length > 0 && (
                        <div className="as-studio-msg__why">
                          <p className="as-studio-msg__why-title">
                            <Icon name="compass" size={16} />
                            {t("studio.msg.why", "Bu seçimi neden yaptım?")}
                          </p>
                          <ul className="as-studio-msg__why-list">
                            {m.decisionSummary.map((item, index) => (
                              <li key={index}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {m.role === "assistant" && m.route && isRoutePlan(m.route) && (
                      <>
                        <div className="as-studio-msg__route">
                          <span>
                            {m.route.title} · {stopsLabel(t, m.route.stops.length)}
                          </span>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => showRoute(m.route!, m)}
                          >
                            {t("studio.msg.showRoute", "Rotayı göster")}
                          </Button>
                        </div>
                        <Button variant="link" onClick={openPrep}>
                          {t(
                            "ai.prepLink",
                            "Hazırlık sekmesinde uçuş ve konaklama seçeneklerini görün",
                          )}
                        </Button>
                      </>
                    )}

                    {m.role === "assistant" &&
                      !m.route &&
                      shouldSurfacePricing(conversationFlow) &&
                      (() => {
                        const dest = extractDestinationFromText(m.text);
                        return dest ? (
                          <Button variant="link" onClick={openPrep}>
                            {t(
                              "ai.prepLink",
                              "Hazırlık sekmesinde uçuş ve konaklama seçeneklerini görün",
                            )}
                          </Button>
                        ) : null;
                      })()}

                    {/* I3/I10: yalnız son asistan turundaki yapılandırılmış hızlı yanıtlar
                      (sunucu clarification.quickOptions ya da akış yanıtları) QuestionCard
                      olur; 2–4 seçenek yoksa kart render edilmez. */}
                    {m.role === "assistant" &&
                      !busy &&
                      m === lastMessage &&
                      (() => {
                        const replies = m.quickReplies ?? [];
                        const qs = clampQuestions([
                          {
                            id: `qr-${m.id}`,
                            text: t("assistant.question.pick", "Bir seçenek seç"),
                            mode: "single",
                            options: replies.map((qr, i) => ({
                              id: String(i),
                              label: typeof qr === "string" ? qr : qr.label,
                            })),
                          },
                        ]).questions;
                        if (qs.length === 0) return null;
                        return (
                          <QuestionCard
                            questions={qs}
                            onSubmit={(answers) => {
                              const picked = replies[Number(answers[`qr-${m.id}`]?.[0])];
                              if (picked === undefined) return;
                              const prompt = typeof picked === "string" ? picked : picked.prompt;
                              pick(prompt);
                            }}
                            note={
                              <Button
                                variant="link"
                                size="sm"
                                onClick={() => {
                                  setTimeout(() => textareaRef.current?.focus(), 50);
                                }}
                              >
                                {t("assistant.question.other", "Kendi cevabını yaz")}
                              </Button>
                            }
                          />
                        );
                      })()}

                    {/* Contextual follow-ups from AI response */}
                    {m.role === "assistant" && m === lastMessage && (
                      <ContextualFollowups message={m} route={route} onAction={pick} busy={busy} />
                    )}

                    {m.role === "assistant" && m.nearbyPins && m.nearbyPins.length > 0 && (
                      <div className="as-studio-msg__nearby">
                        <p className="as-studio-msg__why-title">
                          <Icon name="locate" size={16} />
                          {t("studio.nearby.title", "Yakındaki mekanlar")}
                        </p>
                        <ul className="as-studio-msg__nearby-list">
                          {m.nearbyPins.map((pin) => (
                            <li key={pin.id} className="as-studio-msg__nearby-item">
                              <Button
                                variant="secondary"
                                size="sm"
                                iconStart={<Icon name="message" size={16} />}
                                title={pin.description}
                                onClick={() =>
                                  pick(
                                    fill(t("studio.nearby.ask", "Rotaya {name} durağını ekle"), {
                                      name: pin.name,
                                    }),
                                  )
                                }
                              >
                                {`${pin.name} (${pin.suggestedDuration})`}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                iconStart={<Icon name="plus" size={16} />}
                                title={t(
                                  "studio.nearby.addHint",
                                  "Bu durağı doğrudan seyahat planına ekle",
                                )}
                                aria-label={`${t("studio.nearby.add", "Rotaya ekle")}: ${pin.name}`}
                                onClick={() =>
                                  addPlaceToActiveTrip({
                                    label: pin.name,
                                    address: pin.description,
                                    lat: pin.lat,
                                    lng: pin.lng,
                                    note: pin.description,
                                  })
                                }
                              >
                                {t("studio.nearby.add", "Rotaya ekle")}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </MessageBubble>
                ))}
              </MessageLog>
            )}
            <div className="as-studio__composer">
              {error && (
                <div className="as-studio__error" data-code={errorCode || undefined}>
                  <Alert
                    tone={errorTone}
                    live="assertive"
                    action={
                      <div className="as-studio__error-actions">
                        {isAuthError && (
                          <Button size="sm" onClick={() => setAuthModal(true)}>
                            {t("studio.err.action.signIn", "Giriş yap")}
                          </Button>
                        )}
                        {isEmailVerify && (
                          <Button size="sm" onClick={() => setAuthModal(true)}>
                            {t("studio.err.action.account", "Hesabıma git")}
                          </Button>
                        )}
                        {isCreditLow && (
                          <Button
                            size="sm"
                            onClick={() =>
                              openUpgradeModal(error, undefined, "ai_credits_depleted")
                            }
                          >
                            {t("studio.err.action.buy", "Kredi satın al")}
                          </Button>
                        )}
                        {isDailyLimit && (
                          <Button
                            size="sm"
                            onClick={() =>
                              openUpgradeModal(
                                t(
                                  "studio.err.upgradeDaily",
                                  "Günlük mesaj sınırını Pro ile kaldırın; kota her gece sıfırlanır.",
                                ),
                                "subscriptions",
                                "ai_daily_quota",
                              )
                            }
                          >
                            {t("studio.err.action.pro", "Pro'ya geç")}
                          </Button>
                        )}
                        {showRetry && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            iconStart={<Icon name="refresh" size={16} />}
                            onClick={() => {
                              setRetryAvailable(false);
                              setError("");
                              setErrorCode("");
                              const p = lastPromptRef.current || pending.current?.prompt;
                              if (p) void send(false, p);
                              else void send(true);
                            }}
                          >
                            {t("studio.err.action.retry", "Tekrar dene")}
                          </Button>
                        )}
                        <IconButton
                          icon="x"
                          size="sm"
                          label={t("studio.err.action.dismiss", "Kapat")}
                          onClick={() => {
                            setError("");
                            setErrorCode("");
                            setRetryAvailable(false);
                          }}
                        />
                      </div>
                    }
                  >
                    {error}
                  </Alert>
                </div>
              )}
              {notice && (
                <p className="as-studio__notice" role="status">
                  {notice}
                </p>
              )}

              <SmartActions
                messages={session?.messages || []}
                route={route}
                currentTrip={currentTrip}
                onAction={pick}
                busy={busy}
              />
              <div className="as-studio__style">
                <SegmentedControl
                  label={t("studio.style.label", "Rota tarzı")}
                  value={routeMode}
                  onChange={setRouteMode}
                  options={[
                    styleOption(ROUTE_STYLES[0]),
                    styleOption(ROUTE_STYLES[1]),
                    styleOption(ROUTE_STYLES[2]),
                  ]}
                />
                <p className="as-studio__meta">
                  {`${t(...selectedStyle.hint)}. ${t(
                    "studio.style.note",
                    "Rota tarzı seçimi yalnızca bu isteği etkiler; kalıcı tercihlerini değiştirmez.",
                  )}`}
                </p>
              </div>

              <ComposerBar
                value={input}
                onChange={setInput}
                inputRef={textareaRef}
                maxLength={2000}
                // S22: mesaj başı maliyet sunucuda belirlenir (netleştirme 0, sohbet 1, rota 5) ve
                // istemcide önceden bilinmez; sabit rozet yok, işlem başı maliyetler notta.
                note={t("assistant.composer.costNote", CREDIT_NOTE_TR)}
                busy={busy}
                label={t("assistant.composer.label", "Asistana mesaj")}
                placeholder={t(
                  "assistant.composer.placeholder",
                  "Bir durak ekle, rotayı değiştir veya soru sor...",
                )}
                onSubmit={(text) => void send(false, text)}
                leading={
                  <>
                    <IconButton
                      icon="locate"
                      label={t("studio.composer.location", "Konumumu ekle")}
                      onClick={addMyLocation}
                    />
                    <IconButton
                      icon="mic"
                      pressed={listening}
                      disabled={busy}
                      label={
                        listening
                          ? t("studio.composer.dictateStop", "Sesli girişi durdur")
                          : t("studio.composer.dictate", "Sesli mesaj yazdır")
                      }
                      onClick={dictate}
                    />
                  </>
                }
              />

              <div className="as-studio__wallet">
                <Icon name="coin" size={16} />
                <span>
                  {wallet
                    ? creditsLabel(t, wallet.credits)
                    : t("studio.wallet.free", "Ücretsiz danışmanlık")}
                </span>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() =>
                    openUpgradeModal(
                      t(
                        "studio.wallet.topUpReason",
                        "Yapay zeka seyahat asistanı için kredi yükleyin",
                      ),
                    )
                  }
                >
                  {t("studio.wallet.topUp", "Kredi yükle")}
                </Button>
              </div>
            </div>
          </section>

          {panelOpen && (
            <aside
              id="route-draft"
              className="as-studio__draft"
              aria-label={t("studio.draft.label", "Oluşturulan rota")}
            >
              <div className="as-studio__draft-head">
                <h2 ref={draftHeadingRef} tabIndex={-1} className="as-studio__draft-title">
                  {t("studio.draft.label", "Oluşturulan rota")}
                </h2>
                <div className="as-studio__head-actions">
                  <span className="as-studio__panel-resize">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={
                        panelWide
                          ? t("studio.draft.narrow", "Rota panelini küçült")
                          : t("studio.draft.widen", "Rota panelini büyüt")
                      }
                      onClick={() => setPanelWide(!panelWide)}
                    >
                      {panelWide
                        ? t("studio.draft.narrowShort", "Küçült")
                        : t("studio.draft.widenShort", "Büyüt")}
                    </Button>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconStart={<Icon name="x" size={16} />}
                    aria-label={t("studio.draft.closeLabel", "Rota panelini kapat")}
                    onClick={() => {
                      setPanelOpen(false);
                      setMobileTab("chat");
                    }}
                  >
                    {t("studio.draft.close", "Kapat")}
                  </Button>
                </div>
              </div>
              {!route ? (
                <div className="as-studio__draft-body">
                  <EmptyState
                    icon="map"
                    level={3}
                    title={t("studio.draft.empty.title", "Henüz rota yok")}
                    description={t(
                      "studio.draft.empty.text",
                      "Tercihlerini konuştuktan sonra oluşturduğumuz rota burada görünecek.",
                    )}
                  />
                  {prepContext.kind === "strip" && <PrepPanel context={prepContext} />}
                </div>
              ) : (
                <div className="as-studio__draft-body">
                  <div className="as-studio__route-head">
                    <h3 className="as-studio__route-title">{route.title}</h3>
                    <p className="as-studio__meta">
                      {route.destination} · {daysLabel(t, route.estimatedDays)} ·{" "}
                      {stopsLabel(t, route.stops.length)}
                    </p>
                    <p className="as-studio__muted">{route.summary}</p>
                  </div>
                  <Tabs
                    wrap
                    label={t("studio.draft.tabs", "Taslak bölümleri")}
                    value={draftTab}
                    onChange={(id) => setDraftTab(id as DraftTab)}
                    items={[
                      {
                        id: "route",
                        label: (
                          <>
                            <Icon name="map" size={16} />
                            {t("studio.tab.stops", "Duraklar")}
                          </>
                        ),
                        panel: <DraftStops route={route} day={day} onDay={setDay} />,
                      },
                      {
                        id: "stay",
                        label: (
                          <>
                            <Icon name="bed" size={16} />
                            {t("studio.tab.stay", "Konaklama")}
                          </>
                        ),
                        panel: (
                          <DraftStay
                            info={session?.stayAndTransit}
                            onAsk={setInput}
                            onAddPlace={addPlaceToActiveTrip}
                          />
                        ),
                      },
                      {
                        id: "discovery",
                        label: (
                          <>
                            <Icon name="compass" size={16} />
                            {t("studio.tab.discovery", "Keşif")}
                          </>
                        ),
                        panel: (
                          <DraftDiscovery
                            info={session?.discovery}
                            onAsk={setInput}
                            onAddPlace={addPlaceToActiveTrip}
                          />
                        ),
                      },
                      {
                        id: "flights",
                        label: (
                          <>
                            <Icon name="plane" size={16} />
                            {t("ai.prepTab", "Hazırlık")}
                          </>
                        ),
                        badge: session?.flightPrices?.cheapestPrice ? (
                          <span className="as-studio__tab-meta">
                            {`· ${session.flightPrices.cheapestCurrency} ${session.flightPrices.cheapestPrice}`}
                          </span>
                        ) : undefined,
                        panel: (
                          <PrepPanel
                            context={prepContext}
                            flightBlock={<FlightPrices info={session?.flightPrices} />}
                          />
                        ),
                      },
                      {
                        id: "advisory",
                        label: (
                          <>
                            <Icon name="info" size={16} />
                            {t("studio.tab.advisory", "Tavsiye")}
                          </>
                        ),
                        badge: advisoryWarn ? (
                          <Icon
                            name="alert"
                            size={16}
                            className="as-studio__tab-warn"
                            label={t("studio.tab.advisoryWarn", "Uyarı var")}
                          />
                        ) : undefined,
                        panel: <DraftAdvisory info={session?.travelAdvisory} />,
                      },
                      {
                        id: "emergency",
                        label: (
                          <>
                            <Icon name="shield" size={16} />
                            {t("studio.tab.safety", "Güvenlik")}
                          </>
                        ),
                        panel: <DraftEmergency info={session?.emergency} />,
                      },
                    ]}
                  />
                  <div className="as-studio__draft-foot">
                    <p className="as-studio__muted">
                      {t(
                        "studio.draft.footerNote",
                        "Değişiklik için sohbete yaz: “İkinci güne kahve ekle” veya “Daha sakin olsun”.",
                      )}
                    </p>
                    <Button
                      variant="primary"
                      fullWidth
                      iconStart={<Icon name="map" size={16} />}
                      onClick={openMap}
                    >
                      {t("studio.msg.openMap", "Haritada aç")}
                    </Button>
                    <div className="as-studio__head-actions">
                      <Button
                        variant="secondary"
                        size="sm"
                        iconStart={<Icon name="copy" size={16} />}
                        onClick={copy}
                      >
                        {t("studio.draft.copy", "Planı kopyala")}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        iconStart={<Icon name="download" size={16} />}
                        onClick={download}
                      >
                        {t("studio.draft.download", "Metin olarak indir")}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
      <AuthGate
        variant="sheet"
        reason="ai"
        next="/travel-assistant/"
        open={authModal}
        onClose={() => setAuthModal(false)}
      />
    </PageShell>
  );
}
