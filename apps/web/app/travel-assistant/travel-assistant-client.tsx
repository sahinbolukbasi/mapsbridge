"use client";

import { useEffect, useRef, useState } from "react";
import { AuthActionModal } from "../components/auth-gate";
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
import { tripToMarkdown, saveTripMarkdown } from "../lib/trip/trip-markdown";
import type { Trip, Pin } from "../lib/trip/models";
import { interactionTracker } from "../lib/analytics/tracker";
import { AIPromoLanding } from "./promo-landing";
import { Button, PageHeader, PageShell } from "../components/ui";
import { useLocale } from "../lib/locale-context";
import { DealTrackerPanel } from "../components/tracker/deal-tracker-panel";
import "./assistant.css";
import { AssistantMessage } from "./assistant-message";
import { ThinkingSteps, sseStatusToLivePhase } from "./thinking-steps";
import { SmartActions } from "./smart-actions";
import { ContextualFollowups } from "./contextual-followups";
import { PrepPanel } from "./prep-panel";
import { pickPrepContext } from "./prep-context";
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
const newSession = (): Session => ({
  id: crypto.randomUUID(),
  title: "New trip",
  messages: [],
  route: null,
});

const POPULAR_DESTINATIONS = [
  {
    city: "Roma",
    country: "İtalya",
    flag: "🇮🇹",
    prompt: "Roma'da 3 günlük tarih, sanat ve lezzet odaklı bir rota oluştur",
  },
  {
    city: "Paris",
    country: "Fransa",
    flag: "🇫🇷",
    prompt: "Paris'te 3 günlük kültür, müze ve cafe odaklı bir gezi planla",
  },
  {
    city: "İstanbul",
    country: "Türkiye",
    flag: "🇹🇷",
    prompt: "İstanbul'da 2 günlük butik kahve, galeri ve Boğaz rotası oluştur",
  },
  {
    city: "Barcelona",
    country: "İspanya",
    flag: "🇪🇸",
    prompt: "Barcelona'da 3 günlük Gaudi, sahil ve tapas rotası planla",
  },
  {
    city: "Amsterdam",
    country: "Hollanda",
    flag: "🇳🇱",
    prompt: "Amsterdam'da 2 günlük müze, kanal ve bisiklet rotası oluştur",
  },
  {
    city: "Kapadokya",
    country: "Türkiye",
    flag: "🇹🇷",
    prompt: "Kapadokya'da 2 günlük balon, vadi ve yeraltı şehri rotası oluştur",
  },
  {
    city: "Londra",
    country: "İngiltere",
    flag: "🇬🇧",
    prompt: "Londra'da 3 günlük tarihi yerler, pub ve pazar rotası planla",
  },
  {
    city: "Tokyo",
    country: "Japonya",
    flag: "🇯🇵",
    prompt: "Tokyo'da 4 günlük tapınak, anime, ramen ve teknoloji rotası oluştur",
  },
];

const ACTIVITY_STARTERS = [
  {
    icon: "restaurant",
    label: "Yerel Lezzetler",
    desc: "Otantik restoranlar ve sokak yemekleri",
    prompt: "Gideceğim şehirde mutlaka denenmesi gereken yerel yemekler ve en iyi restoranlar",
  },
  {
    icon: "hotel",
    label: "Otel & Konaklama",
    desc: "Bölge ve bütçe önerileri",
    prompt: "Merkezi, güvenli ve bütçe dostu otel semtleri ve butik otel önerileri",
  },
  {
    icon: "coffee",
    label: "Kahve & Mekan",
    desc: "Sessiz cafeler ve çalışma mekanları",
    prompt: "Şehirde en iyi butik kahveciler, sessiz çalışma mekanları ve atmosferik kafeler",
  },
  {
    icon: "nightlife",
    label: "Gece Hayatı",
    desc: "Barlar, canlı müzik ve rooftop",
    prompt: "Şehrin en iyi gece mekanları, rooftop barları ve canlı müzik noktaları",
  },
  {
    icon: "photo_camera",
    label: "Fotoğraf Rotası",
    desc: "Manzara ve gizli köşeler",
    prompt: "Instagram için en iyi fotoğraf noktaları, gizli köşeler ve gün batımı manzaraları",
  },
  {
    icon: "savings",
    label: "Bütçe Gezisi",
    desc: "500€ altı kompakt tur",
    prompt:
      "500€ altı bütçeyle 3 günlük kompakt bir şehir gezisi planla, ücretsiz aktiviteler dahil",
  },
];

// Quick guides map to exact KB documents — answered with minimal tokens via RAG context.
// Order: vary by month so the selection feels fresh across seasons.
const KB_QUICK_GUIDES = [
  {
    flag: "🇹🇷",
    city: "İstanbul",
    topic: "Semtler",
    prompt: "İstanbul'un semtleri hakkında bilgi ver: Beyoğlu, Kadıköy, Karaköy",
  },
  {
    flag: "🇪🇸",
    city: "Barcelona",
    topic: "Gaudi",
    prompt: "Barcelona'da Gaudí eserleri: Sagrada Família ve Park Güell ziyaret rehberi",
  },
  {
    flag: "🇫🇷",
    city: "Paris",
    topic: "Müzeler",
    prompt: "Paris müzeleri rehberi: Louvre, Orsay ve Paris Müze Kartı",
  },
  {
    flag: "🇯🇵",
    city: "Tokyo",
    topic: "Ulaşım",
    prompt: "Tokyo toplu ulaşım rehberi: JR, metro ve Suica kart nasıl kullanılır?",
  },
  {
    flag: "🇮🇹",
    city: "Roma",
    topic: "Mutfak",
    prompt: "Roma mutfağı: cacio e pepe, carbonara ve pizza al taglio nerede yenir?",
  },
  {
    flag: "🇳🇱",
    city: "Amsterdam",
    topic: "Müzeler",
    prompt: "Amsterdam müzeleri: Rijksmuseum, Van Gogh ve I Amsterdam City Card",
  },
  {
    flag: "🇦🇪",
    city: "Dubai",
    topic: "Pratik",
    prompt: "Dubai seyahati pratik bilgiler: iklim, kıyafet kuralları ve metro rehberi",
  },
  {
    flag: "🇬🇧",
    city: "Londra",
    topic: "Ücretsiz",
    prompt: "Londra'da ücretsiz müzeler: British Museum, Natural History Museum ziyaret rehberi",
  },
  {
    flag: "🇹🇷",
    city: "Antalya",
    topic: "Doğa",
    prompt: "Antalya'da doğa: Düden Şelalesi, Köprülü Kanyon ve Kaş rehberi",
  },
  {
    flag: "🇹🇷",
    city: "İstanbul",
    topic: "Ulaşım",
    prompt: "İstanbul toplu ulaşım rehberi: İstanbulkart, metro, tramvay ve vapur",
  },
  {
    flag: "🇪🇸",
    city: "Barcelona",
    topic: "Yemek",
    prompt: "Barcelona mutfağı: tapas, vermouth kültürü ve La Boqueria pazarı",
  },
  {
    flag: "🇫🇷",
    city: "Paris",
    topic: "Semtler",
    prompt: "Paris semtleri: Marais, Montmartre, Saint-Germain ve Bastille karakterleri",
  },
];

function getSeasonalGuides(count = 6): typeof KB_QUICK_GUIDES {
  const month = new Date().getMonth();
  const offset = (month * 3) % KB_QUICK_GUIDES.length;
  const rotated = [...KB_QUICK_GUIDES.slice(offset), ...KB_QUICK_GUIDES.slice(0, offset)];
  return rotated.slice(0, count);
}

const ROUTE_STYLES = [
  { key: "calm" as const, icon: "🌿", label: "Sakin rota", hint: "Az yürüyüş · uzun molalar" },
  {
    key: "classic" as const,
    icon: "🗺️",
    label: "Klasik rota",
    hint: "Dengeli tempo · temel duraklar",
  },
  {
    key: "explorer" as const,
    icon: "✨",
    label: "Kaşif rota",
    hint: "Yerel noktalar · derin keşif",
  },
];

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
  const [draftTab, setDraftTab] = useState<
    "route" | "stay" | "discovery" | "emergency" | "flights" | "advisory"
  >("route");
  const [mobileTab, setMobileTab] = useState<"chat" | "draft">("chat");
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [showManifestoModal, setShowManifestoModal] = useState(false);
  const [showDealTrackerModal, setShowDealTrackerModal] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [routeMode, setRouteMode] = useState<"calm" | "classic" | "explorer">("classic");
  const [streamText, setStreamText] = useState("");
  const [streamPhase, setStreamPhase] = useState<{ icon: string; label: string } | null>(null);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const lastPromptRef = useRef<string>("");
  const pending = useRef<Pending | null>(null);
  const inFlight = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const session = sessions.find((s) => s.id === activeId) || null;
  const route = session?.route && isRoutePlan(session.route) ? session.route : null;
  const { memory, learnFromPrompt, buildContextString, clearMemory } = useUserMemory();
  const [conversationFlow, setConversationFlow] = useState<ConversationFlow>(EMPTY_FLOW);
  const { t } = useLocale();
  // I8 (§9.1): affiliate yüzeyleri yalnız taslak panelinin Hazırlık bölümünde (prep-panel.tsx).
  const prepContext = pickPrepContext({
    route,
    messages: session?.messages ?? [],
    surfacePricing: shouldSurfacePricing(conversationFlow),
    extractDestination: extractDestinationFromText,
  });
  const draftHeadingRef = useRef<HTMLElement>(null);
  const openPrep = () => {
    setPanelOpen(true);
    setMobileTab("draft");
    if (route) setDraftTab("flights");
    window.setTimeout(() => draftHeadingRef.current?.focus(), 0);
  };
  const prepIcon = t("ai.prepTab", "✈ Hazırlık").split(" ")[0];
  const prepLabel = t("ai.prepTab", "✈ Hazırlık").split(" ").slice(1).join(" ");

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

  function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
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
      const raw = localStorage.getItem("mapsbridge.travelPlanner.v5");
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

  function addPlaceToActiveTrip(place: {
    label: string;
    address?: string;
    lat?: number;
    lng?: number;
    category?: string;
    note?: string;
    durationMinutes?: number;
    isHotel?: boolean;
  }) {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("mapsbridge.travelPlanner.v5");
      let trips: Trip[] = raw ? (JSON.parse(raw) as Trip[]) : [];
      if (!Array.isArray(trips)) trips = [];

      let trip = currentTrip ? trips.find((t) => t.id === currentTrip.id) : trips[0];
      if (!trip) {
        trip = {
          id: `trip-${crypto.randomUUID().slice(0, 8)}`,
          title: place.isHotel ? `${place.label} Konaklamalı Gezi` : "Seyahat Rotası",
          destination: place.address || place.label,
          transportMode: "walking",
          days: [{ dayIndex: 1, label: "1. Gün", color: "#10b981", pins: [] }],
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
        category: place.isHotel
          ? "otel"
          : (place.category as import("../lib/trip/models").PinCategory) || "genel",
        dayIndex: 1,
        order: (trip!.days?.[0]?.pins?.length || 0) + 1,
        group: place.isHotel ? "Konaklama" : "Öneriler",
        visited: false,
        durationMinutes: place.durationMinutes || (place.isHotel ? 120 : 60),
        note:
          place.note ||
          (place.isHotel ? "AI Asistan tarafından önerilen otel" : "AI Asistan tarafından eklendi"),
      };

      if (!trip!.days || trip!.days.length === 0) {
        trip!.days = [{ dayIndex: 1, label: "1. Gün", color: "#10b981", pins: [newPin] }];
      } else {
        if (!trip!.days[0].pins) trip!.days[0].pins = [];
        trip!.days[0].pins.push(newPin);
      }
      trip!.updatedAt = new Date().toISOString();

      localStorage.setItem("mapsbridge.travelPlanner.v5", JSON.stringify(trips));
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
        `✓ "${place.label}" ${place.isHotel ? "otel olarak" : "durak olarak"} rotana eklendi ve .md manifestosuna işlendi!`,
      );
    } catch (e: unknown) {
      setError(`Rotaya eklenirken hata: ${e instanceof Error ? e.message : String(e)}`);
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
          setError("Önceki isteğin sonucu bekleniyor. Aynı isteği tekrar kontrol edebilirsin.");
      }
    } catch {
      setError("Sohbet geçmişi okunamadı. Yeni bir sohbet başlatabilirsin.");
    }
    refreshCurrentTrip();
    const query = new URLSearchParams(window.location.search).get("q");
    if (query) setInput(query.slice(0, 2000));
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
        setNotice("Sohbet bu cihazda kaydedilemedi.");
      }
    }
  }, [sessions, ready]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [session?.messages, busy]);
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
    if (pending.current) setError("Bu sohbette sonuç bekleyen bir istek var.");
  }
  async function send(retry = false, customPrompt?: string) {
    if (inFlight.current) return;
    const promptToSend = (customPrompt !== undefined ? customPrompt : input).trim();
    if (!retry && !promptToSend) return;

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
      setNotice("Sohbete devam etmek için lütfen giriş yapın. Sorunuz hazır bekliyor.");
      setAuthModal(true);
      return;
    }
    if (retry && !pending.current) return;
    if (!retry && pending.current) {
      setError("Önce bekleyen isteği tekrar kontrol et.");
      return;
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
                  ? "AI yanıtı zaman aşımına uğradı."
                  : "AI servisine ulaşılamadı (bağlantı/erişim engellendi).",
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
          throw new Error("Yanıt tamamlanamadı — stream kapandı.");
        };
        // NOT: /ai/route-planner emekli (410 Gone). Tek canlı AI yolu stream'dir.
        // Stream başarısız olursa ölü endpoint'e düşmek rota üretmez; gerçek durumu
        // kullanıcıya göster. İş hataları zaten catch bloğunda ele alınıyor.
        result = await runStream();
        setStreamText("");
        setStreamPhase(null);
      } else {
        // Stream URL yapılandırılmamış. /ai/route-planner 410 döndüğü için ona düşmek
        // anlamsız — net bir yapılandırma hatası fırlat ki sessizce "rota üretmedi"
        // durumuna düşmesin.
        throw Object.assign(
          new Error(
            "AI servisi şu an yapılandırılmadı (stream URL yok). Lütfen daha sonra tekrar deneyin.",
          ),
          { code: "AI_DISABLED", status: 503 },
        );
      }
      setTrainingConsent(false);
      if (!result.orchestratorSummary?.trim() || (result.route && !isRoutePlan(result.route)))
        throw Error("Yanıt tamamlanamadı.");
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
                  label: `${detectedDest} rotası planla`,
                  prompt: `${detectedDest} için rota planı oluştur`,
                },
                { label: "Uçuş fiyatları?", prompt: `${detectedDest} uçuş biletleri ne kadar?` },
                { label: "Otel önerileri?", prompt: `${detectedDest} otel tavsiyeleri ver` },
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
      setNotice(cost ? `${cost} kredi kullanıldı.` : "Danışmanlık ve sorular ücretsizdir.");
      if (result.billing) setWallet((w) => ({ ...w, credits: result.billing!.credits }));
      pending.current = null;
      void refreshWallet();
    } catch (e: unknown) {
      const err = e as { code?: string; status?: number; message?: string };
      const code: string = err?.code || "";
      setErrorCode(code);
      if (err?.status === 401 || code === "UNAUTHORIZED") {
        const refreshed = await refreshSession();
        if (refreshed?.token) {
          setError("");
          setErrorCode("");
          setNotice("Oturum yenilendi, isteğiniz gönderiliyor...");
          inFlight.current = false;
          setBusy(false);
          return send(false, promptToSend);
        } else {
          setError("Oturum süreniz doldu. Lütfen tekrar giriş yapın.");
          setInput(promptToSend);
          setAuthModal(true);
        }
      } else if (code === "EMAIL_NOT_VERIFIED") {
        setError(
          "AI asistanı kullanmak için e-postanızı onaylamanız gerekiyor. Giriş ekranından onay maili gönderebilirsiniz.",
        );
      } else if (code === "WALLET_FROZEN") {
        setError("Kredi hesabınız geçici olarak durduruldu. Detay için destek ekibine ulaşın.");
      } else if (code === "INSUFFICIENT_CREDITS" || err?.status === 402) {
        setError(err?.message || "Bu işlem için yeterli krediniz yok.");
        openUpgradeModal(err?.message || "Krediniz yetersiz.", undefined, "ai_credits_depleted");
      } else if (code === "USER_DAILY_LIMIT") {
        setError(
          "Bugünlük 20 mesaj sınırına ulaştınız. Sayaç her gece saat 03:00'te (Türkiye saati) sıfırlanır.",
        );
      } else if (code === "SERVICE_DAILY_LIMIT") {
        setError("Servis kapasitesi şu an yoğun. Birkaç dakika sonra tekrar deneyin.");
        setRetryAvailable(true);
        lastPromptRef.current = promptToSend;
      } else if (code === "AI_DISABLED") {
        setError("AI asistanı şu an bakımda. Kısa süre içinde tekrar kullanılabilir olacak.");
      } else if (code === "REQUEST_IN_PROGRESS") {
        setError("Önceki isteğin sonucu bekleniyor. Sonuç gelince otomatik gösterilecek.");
        setRetryAvailable(true);
      } else if (
        shouldRecheckRequest(err) ||
        err?.status === 408 ||
        ((err?.status ?? 0) >= 500 && code !== "AI_RESULT_UNCONFIRMED")
      ) {
        setError("Bağlantı sorunu oluştu. İsteğiniz kaydedildi, tekrar deneyin.");
        setRetryAvailable(true);
        lastPromptRef.current = promptToSend;
      } else if (code === "AI_UNREACHABLE" || err?.status === 403) {
        setError(
          "AI servisine şu anda erişilemiyor (erişim engellendi). Bu geçici bir sunucu/ağ ayarı sorunudur, kredinizle ilgili değildir. Lütfen birazdan tekrar deneyin; sorun sürerse destek ekibine bildirin.",
        );
        setRetryAvailable(true);
        lastPromptRef.current = promptToSend;
      } else if (code === "AI_TIMEOUT") {
        setError("AI yanıtı zaman aşımına uğradı. Lütfen tekrar deneyin.");
        setRetryAvailable(true);
        lastPromptRef.current = promptToSend;
      } else {
        setError(err?.message || "Yanıt alınamadı. Tekrar deneyebilirsin.");
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
      const raw = localStorage.getItem("mapsbridge.travelPlanner.v5");
      const trips = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(trips))
        throw Error("Harita kayıtları okunamadı; mevcut veriler değiştirilmedi.");
      const tripId = `ai-${activeId}`;
      const trip = routeToTrip(route, tripId);
      localStorage.setItem(
        "mapsbridge.travelPlanner.v5",
        JSON.stringify([...trips.filter((t) => t.id !== tripId), trip]),
      );
      window.location.assign(`/maps/?tripId=${encodeURIComponent(tripId)}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Rota aktarılamadı.");
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
      setNotice("Bu tarayıcı sesli girişi desteklemiyor. Mesajını yazarak gönderebilirsin.");
      return;
    }
    if (listening) {
      speech.current?.stop();
      return;
    }
    const recognition = new Recognition();
    speech.current = recognition;
    recognition.lang = "tr-TR";
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event: SpeechRecognitionEvent) =>
      setInput((old) => `${old} ${event.results[0][0].transcript}`.trim().slice(0, 2000));
    recognition.onerror = () => {
      setListening(false);
      setNotice("Ses alınamadı. Mikrofon iznini kontrol et.");
    };
    recognition.start();
  }
  function download() {
    if (!route) return;
    const url = URL.createObjectURL(
      new Blob([planText(route)], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "seyahat-plani.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function copy() {
    if (!route) return;
    try {
      await navigator.clipboard.writeText(planText(route));
      setNotice("Plan kopyalandı.");
    } catch {
      setError("Plan kopyalanamadı.");
    }
  }

  if (isAuthenticated === null) {
    return (
      <PageShell layout="app" className="ai-studio-shell">
        <div
          className="ai-studio-root"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            background: "var(--color-neutral-900)",
          }}
        >
          <div
            className="ai-studio-main"
            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {/* AC-34: prerender HTML'inde tek h1 (başlık route-registry'den; görsel olarak gizli). */}
            <PageHeader variant="hidden" />
            <div className="ai-thinking-dot" style={{ width: "2rem", height: "2rem" }} />
          </div>
        </div>
      </PageShell>
    );
  }

  if (!isAuthenticated) {
    return <AIPromoLanding />;
  }

  return (
    <PageShell layout="app" className="ai-studio-shell">
      <div className="ai-studio-root">
        <div className="ai-studio-main">
          {/* AC-34: tek h1 "Seyahat asistanı" (registry, görsel olarak gizli); marka satırı <p>. */}
          <PageHeader variant="hidden" />
          <div className={`ai-studio-workspace ${panelWide ? "ai-panel-wide" : ""}`}>
            <aside className="ai-studio-aside-left" aria-label="Sohbetler">
              <div>
                <button className="ai-new-plan-btn" onClick={startNew} disabled={busy}>
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    add
                  </span>
                  Yeni Seyahat Planla
                </button>
                <div className="ai-section-label-row">
                  <span className="ai-section-label">SOHBET GEÇMİŞİ</span>
                  {sessions.length > 0 && (
                    <span className="ai-section-count">{sessions.length} Kayıt</span>
                  )}
                </div>
                <div className="ai-session-list ai-custom-scrollbar">
                  {sessions.map((s, idx) => (
                    <div key={s.id} className="ai-history-item-wrap">
                      <button
                        disabled={busy}
                        className={`ai-history-item ${s.id === activeId ? "active" : ""}`}
                        onClick={() => select(s.id)}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            flex: 1,
                            overflow: "hidden",
                          }}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{
                              fontSize: "16px",
                              flexShrink: 0,
                              color:
                                s.id === activeId
                                  ? "var(--color-accent)"
                                  : "var(--color-text-subtle)",
                            }}
                          >
                            {s.id === activeId ? "chat_bubble" : "history"}
                          </span>
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {s.title}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            flexShrink: 0,
                            opacity: 0.7,
                            letterSpacing: "0.04em",
                          }}
                        >
                          {s.id.slice(0, 2).toUpperCase()}-{(idx + 1).toString().padStart(3, "0")}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="ai-history-delete-btn"
                        onClick={(e) => deleteSession(s.id, e)}
                        title="Sohbeti Sil"
                        aria-label="Sohbeti Sil"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                          delete
                        </span>
                      </button>
                    </div>
                  ))}
                  {!sessions.length && <p className="ai-muted">Birlikte ilk gezini planlayalım.</p>}
                </div>
              </div>
              <div className="ai-quota-card">
                <strong>{wallet ? `${wallet.credits} kredi` : "Seyahat danışmanın"}</strong>
                <p>
                  Tercih soruları ücretsiz · Sohbet 1 kredi · Rota oluşturma / düzenleme 5 kredi
                </p>
                {wallet?.usage && (
                  <p>
                    Bugün {wallet.usage.requestsToday} / {wallet.usage.dailyLimit} mesaj denemesi.
                    Yenilenme:{" "}
                    {new Date(wallet.usage.resetsAt).toLocaleTimeString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    .
                  </p>
                )}
              </div>
            </aside>
            <section className="ai-studio-chat-section" aria-label="Seyahat sohbeti">
              <div className="ai-chat-header">
                <div className="ai-chat-header-brand">
                  <div className="ai-chat-brand-icon">
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                      neurology
                    </span>
                  </div>
                  <div>
                    <div className="ai-chat-brand-title-row">
                      <p className="ai-chat-title">MapsBridge AI</p>
                      <span className="ai-online-dot" aria-label="Çevrimiçi" />
                    </div>
                    <span className="ai-muted" style={{ fontSize: "11.5px" }}>
                      Seyahat asistanın hazır
                    </span>
                  </div>
                </div>
                <div className="ai-header-actions">
                  <button className="ai-small-btn ai-new-mobile" onClick={startNew} disabled={busy}>
                    Yeni
                  </button>
                  <button
                    className="ai-icon-btn"
                    aria-expanded={panelOpen}
                    aria-controls="route-draft"
                    onClick={() => {
                      setPanelOpen(!panelOpen);
                      setMobileTab(panelOpen ? "chat" : "draft");
                    }}
                    title={panelOpen ? "Sohbeti büyüt" : "Rota panelini aç"}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                      {panelOpen ? "close_fullscreen" : "open_in_full"}
                    </span>
                  </button>
                </div>
              </div>

              {session?.context && (
                <div className="ai-context-strip" aria-label="Gezi tercihleri">
                  {session.context.destination && <span>{session.context.destination}</span>}
                  {session.context.days && <span>{session.context.days} gün</span>}
                  {session.context.interests?.map((i) => (
                    <span key={i}>{i}</span>
                  ))}
                </div>
              )}
              {(memory.interests.length > 0 ||
                memory.destinations.length > 0 ||
                memory.budgetHabit) && (
                <div className="ai-user-memory-strip" aria-label="Kullanıcı hafızası">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "14px", color: "var(--color-accent)" }}
                  >
                    psychology
                  </span>
                  <span style={{ fontWeight: 600, color: "var(--color-success-strong)" }}>
                    Seni tanıyorum:
                  </span>
                  {memory.destinations.slice(-2).map((d) => (
                    <span key={d} className="ai-user-memory-pill">
                      {d}
                    </span>
                  ))}
                  {memory.interests.slice(-3).map((i) => (
                    <span key={i} className="ai-user-memory-pill">
                      {i}
                    </span>
                  ))}
                  {memory.budgetHabit && (
                    <span className="ai-user-memory-pill">
                      {memory.budgetHabit === "budget"
                        ? "ekonomik"
                        : memory.budgetHabit === "luxury"
                          ? "lüks"
                          : "orta bütçe"}
                    </span>
                  )}
                  <button
                    type="button"
                    className="ai-user-memory-clear"
                    onClick={clearMemory}
                    title="Hafızayı sıfırla"
                  >
                    Sıfırla
                  </button>
                </div>
              )}
              <div
                className="ai-chat-feed ai-custom-scrollbar"
                role="log"
                aria-live="polite"
                aria-busy={busy}
              >
                {!session?.messages.length && (
                  <div className="ai-welcome-hub">
                    <div className="ai-welcome-header">
                      <div className="ai-welcome-avatar">
                        <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                          waving_hand
                        </span>
                      </div>
                      <div className="ai-welcome-title-wrap">
                        <h2>İyi günler! Nereye gitmek istersin?</h2>
                        <p>
                          Bir şehir seç veya ne yapmak istediğini söyle — rotanı saniyeler içinde
                          oluşturayım.
                        </p>
                      </div>
                    </div>

                    <div className="ai-welcome-section">
                      <h3 className="ai-welcome-section-title">
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                          flight_takeoff
                        </span>
                        Popüler Destinasyonlar
                      </h3>
                      <div className="ai-destination-grid">
                        {POPULAR_DESTINATIONS.map((d) => (
                          <button
                            key={d.city}
                            type="button"
                            className="ai-destination-chip"
                            onClick={() => {
                              setInput(d.prompt);
                              void send(false, d.prompt);
                            }}
                            disabled={busy}
                          >
                            <span className="ai-destination-flag">{d.flag}</span>
                            <div className="ai-destination-text">
                              <strong>{d.city}</strong>
                              <span>{d.country}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="ai-welcome-section">
                      <h3 className="ai-welcome-section-title">
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                          explore
                        </span>
                        Ne Yapmak İstersin?
                      </h3>
                      <div className="ai-activity-grid">
                        {ACTIVITY_STARTERS.map((a) => (
                          <button
                            key={a.label}
                            type="button"
                            className="ai-activity-card"
                            onClick={() => {
                              setInput(a.prompt);
                              void send(false, a.prompt);
                            }}
                            disabled={busy}
                          >
                            <span className="material-symbols-outlined ai-activity-icon">
                              {a.icon}
                            </span>
                            <div className="ai-activity-text">
                              <strong>{a.label}</strong>
                              <span>{a.desc}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="ai-welcome-section">
                      <h3 className="ai-welcome-section-title">
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                          menu_book
                        </span>
                        Hızlı Rehberler
                      </h3>
                      <div className="ai-kb-guide-grid">
                        {getSeasonalGuides(6).map((g) => (
                          <button
                            key={`${g.city}-${g.topic}`}
                            type="button"
                            className="ai-kb-guide-chip"
                            onClick={() => {
                              setInput(g.prompt);
                              void send(false, g.prompt);
                            }}
                            disabled={busy}
                          >
                            <span className="ai-kb-guide-flag">{g.flag}</span>
                            <div className="ai-kb-guide-text">
                              <strong>{g.city}</strong>
                              <span>{g.topic}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {session?.messages.map((m) => (
                  <div
                    key={m.id}
                    className={m.role === "user" ? "ai-msg-user-container" : "ai-msg-bot-container"}
                  >
                    <div className={m.role === "user" ? "ai-msg-user-bubble" : "ai-msg-bot-bubble"}>
                      {m.role === "assistant" ? (
                        <AssistantMessage text={m.text} />
                      ) : (
                        <p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                          {m.text}
                        </p>
                      )}

                      {/* Bot Mesaj İşlem Araçları (Kopyala, Rotayı Aç) */}
                      {m.role === "assistant" && (
                        <div className="ai-msg-actions-row">
                          <button
                            type="button"
                            className="ai-msg-action-btn"
                            onClick={() => copyMessageText(m.id, m.text)}
                            title="Mesajı Kopyala"
                          >
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: "13px" }}
                            >
                              {copiedMsgId === m.id ? "check" : "content_copy"}
                            </span>
                            <span>{copiedMsgId === m.id ? "Kopyalandı" : "Kopyala"}</span>
                          </button>
                          {m.route && isRoutePlan(m.route) && (
                            <button
                              type="button"
                              className="ai-msg-action-btn"
                              onClick={() => showRoute(m.route!, m)}
                              title="Rotayı Panoda Aç"
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: "13px", color: "var(--color-accent)" }}
                              >
                                map
                              </span>
                              <span>Rotayı İncele ({m.route.stops.length} Durak)</span>
                            </button>
                          )}
                          {currentTrip && (
                            <a
                              href={`/maps/?tripId=${currentTrip.id}`}
                              className="ai-msg-action-btn"
                              title="Haritada İncele"
                              style={{ textDecoration: "none" }}
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: "13px", color: "#0ea5e9" }}
                              >
                                open_in_new
                              </span>
                              <span>Haritada Aç</span>
                            </a>
                          )}
                        </div>
                      )}

                      {m.role === "assistant" &&
                        m.decisionSummary &&
                        m.decisionSummary.length > 0 && (
                          <div
                            style={{
                              marginTop: "0.55rem",
                              padding: "0.55rem 0.7rem",
                              borderRadius: "10px",
                              background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
                              border: "1px solid var(--color-accent-a20)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                color: "var(--color-accent)",
                                marginBottom: "0.25rem",
                              }}
                            >
                              🧭 Bu seçimi neden yaptım?
                            </div>
                            <ul
                              style={{
                                margin: 0,
                                paddingLeft: "1.1rem",
                                fontSize: "12px",
                                lineHeight: 1.45,
                              }}
                            >
                              {m.decisionSummary.map((item, index) => (
                                <li key={index}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                      {m.role === "assistant" && m.route && isRoutePlan(m.route) && (
                        <>
                          <div className="ai-route-sync-card">
                            <span>
                              {m.route.title} · {m.route.stops.length} durak
                            </span>
                            <button className="ai-small-btn" onClick={() => showRoute(m.route!, m)}>
                              Rotayı göster
                            </button>
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

                      {m.role === "assistant" && m.quickReplies && m.quickReplies.length > 0 && (
                        <div
                          style={{
                            marginTop: "0.5rem",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "6px",
                          }}
                        >
                          {m.quickReplies.map((qr, qidx) => {
                            const label = typeof qr === "string" ? qr : qr.label;
                            const prompt = typeof qr === "string" ? qr : qr.prompt;
                            return (
                              <button
                                key={qidx}
                                type="button"
                                className="ai-small-btn"
                                style={{
                                  fontSize: "11.5px",
                                  padding: "3px 9px",
                                  borderRadius: "12px",
                                  background:
                                    "color-mix(in srgb, var(--color-accent-sky-soft) 10%, transparent)",
                                  border: "1px solid rgba(56,189,248,0.3)",
                                  color: "#38bdf8",
                                }}
                                onClick={() => {
                                  setInput(prompt);
                                  void send(false, prompt);
                                }}
                                title="Bu yanıtı seç"
                              >
                                💡 {label}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            className="ai-small-btn"
                            style={{
                              fontSize: "11.5px",
                              padding: "3px 9px",
                              borderRadius: "12px",
                              background:
                                "color-mix(in srgb, var(--color-neutral-400) 8%, transparent)",
                              border:
                                "1px solid color-mix(in srgb, var(--color-neutral-400) 25%, transparent)",
                              color: "#94a3b8",
                            }}
                            onClick={() => {
                              setTimeout(() => textareaRef.current?.focus(), 50);
                            }}
                            title="Kendi cevabını yaz"
                          >
                            ✏️ Diğer
                          </button>
                        </div>
                      )}

                      {/* Contextual follow-ups from AI response */}
                      {m.role === "assistant" &&
                        m === session?.messages[session.messages.length - 1] && (
                          <ContextualFollowups
                            message={m}
                            route={route}
                            onAction={(p) => {
                              setInput(p);
                              void send(false, p);
                            }}
                            busy={busy}
                          />
                        )}

                      {m.role === "assistant" && m.nearbyPins && m.nearbyPins.length > 0 && (
                        <div
                          style={{
                            marginTop: "0.5rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: "var(--color-accent)",
                            }}
                          >
                            📍 Yakındaki Mekanlar:
                          </span>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {m.nearbyPins.map((pin) => (
                              <div
                                key={pin.id}
                                style={{ display: "inline-flex", gap: "3px", alignItems: "center" }}
                              >
                                <button
                                  className="ai-small-btn"
                                  style={{ fontSize: "11px", padding: "3px 7px" }}
                                  onClick={() => {
                                    const q = `Rotaya ${pin.name} durağını ekle`;
                                    setInput(q);
                                    void send(false, q);
                                  }}
                                  title={pin.description}
                                >
                                  💬 {pin.name} ({pin.suggestedDuration})
                                </button>
                                <button
                                  className="ai-action-chip"
                                  style={{ fontSize: "10.5px", padding: "2px 6px" }}
                                  onClick={() =>
                                    addPlaceToActiveTrip({
                                      label: pin.name,
                                      address: pin.description,
                                      lat: pin.lat,
                                      lng: pin.lng,
                                      note: pin.description,
                                    })
                                  }
                                  title="Bu durağı doğrudan seyahat planına ekle"
                                >
                                  ➕ Rotaya Ekle
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {busy && streamText ? (
                  <div className="ai-msg-bot-container">
                    <div
                      className="ai-msg-bot-bubble"
                      role="status"
                      style={{ whiteSpace: "pre-wrap", opacity: 0.92 }}
                    >
                      {streamText}
                      <span className="ai-stream-cursor" aria-hidden="true">
                        ▋
                      </span>
                    </div>
                  </div>
                ) : (
                  busy && (
                    <div className="ai-msg-bot-container">
                      <div className="ai-msg-bot-bubble ai-thinking-bubble" role="status">
                        <ThinkingSteps
                          isRoute={input.length > 20 || (session?.messages.length || 0) >= 2}
                          livePhase={streamPhase}
                        />
                      </div>
                    </div>
                  )
                )}
                <div ref={end} />
              </div>
              <div className="ai-chat-composer-area">
                {error &&
                  (() => {
                    const isAuth =
                      errorCode === "UNAUTHORIZED" ||
                      (errorCode === "" && (error.includes("giriş") || error.includes("Oturum")));
                    const isCreditLow = errorCode === "INSUFFICIENT_CREDITS";
                    const isWalletFrozen = errorCode === "WALLET_FROZEN";
                    const isEmailVerify = errorCode === "EMAIL_NOT_VERIFIED";
                    const isDailyLimit = errorCode === "USER_DAILY_LIMIT";
                    const isServiceLimit = errorCode === "SERVICE_DAILY_LIMIT";
                    const isMaintenance = errorCode === "AI_DISABLED";
                    const iconName =
                      isCreditLow || isWalletFrozen
                        ? "account_balance_wallet"
                        : isEmailVerify
                          ? "mark_email_unread"
                          : isDailyLimit || isServiceLimit
                            ? "timer"
                            : isMaintenance
                              ? "build_circle"
                              : isAuth
                                ? "lock"
                                : "error";
                    const iconColor = isCreditLow
                      ? "#f59e0b"
                      : isWalletFrozen
                        ? "#ef4444"
                        : isEmailVerify || isDailyLimit || isServiceLimit || isMaintenance
                          ? "#6366f1"
                          : "#ef4444";
                    return (
                      <div
                        className="ai-error-banner"
                        role="alert"
                        data-code={errorCode || undefined}
                      >
                        <div className="ai-error-content">
                          <span
                            className="material-symbols-outlined"
                            style={{ color: iconColor, fontSize: "18px" }}
                          >
                            {iconName}
                          </span>
                          <span className="ai-error-text">{error}</span>
                        </div>
                        <div className="ai-error-actions">
                          {isAuth && (
                            <button
                              type="button"
                              className="ai-error-cta-btn"
                              onClick={() => setAuthModal(true)}
                            >
                              Giriş Yap
                            </button>
                          )}
                          {isEmailVerify && (
                            <button
                              type="button"
                              className="ai-error-cta-btn"
                              onClick={() => setAuthModal(true)}
                            >
                              Hesabıma Git
                            </button>
                          )}
                          {isCreditLow && (
                            <button
                              type="button"
                              className="ai-error-cta-btn"
                              onClick={() =>
                                openUpgradeModal(error, undefined, "ai_credits_depleted")
                              }
                            >
                              Kredi Satın Al
                            </button>
                          )}
                          {(retryAvailable ||
                            (!isAuth &&
                              !isEmailVerify &&
                              !isCreditLow &&
                              !isWalletFrozen &&
                              !isDailyLimit &&
                              pending.current)) && (
                            <button
                              disabled={busy}
                              className="ai-error-cta-btn ai-retry-btn"
                              onClick={() => {
                                setRetryAvailable(false);
                                setError("");
                                setErrorCode("");
                                const p = lastPromptRef.current || pending.current?.prompt;
                                if (p) void send(false, p);
                                else void send(true);
                              }}
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: "14px", verticalAlign: "middle" }}
                              >
                                refresh
                              </span>{" "}
                              Tekrar Dene
                            </button>
                          )}
                          <button
                            type="button"
                            className="ai-error-dismiss"
                            onClick={() => {
                              setError("");
                              setErrorCode("");
                              setRetryAvailable(false);
                            }}
                            aria-label="Kapat"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                {notice && (
                  <p className="ai-muted" role="status">
                    {notice}
                  </p>
                )}

                <SmartActions
                  messages={session?.messages || []}
                  route={route}
                  currentTrip={currentTrip}
                  onAction={(p) => {
                    setInput(p);
                    void send(false, p);
                  }}
                  busy={busy}
                />
                <div className="ai-quick-modes-bar" aria-label="Rota tarzı">
                  {ROUTE_STYLES.map((style) => (
                    <button
                      key={style.key}
                      type="button"
                      className="ai-quick-mode-pill"
                      aria-pressed={routeMode === style.key}
                      onClick={() => setRouteMode(style.key)}
                      title={style.hint}
                    >
                      <span>{style.icon}</span>
                      <span>{style.label}</span>
                    </button>
                  ))}
                </div>
                <p className="ai-composer-note">
                  Rota tarzı seçimi yalnızca bu isteği etkiler; kalıcı tercihlerini değiştirmez.
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                  className="ai-input-wrapper ai-input-stitch"
                >
                  <button
                    type="button"
                    className="ai-input-icon-btn"
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            setInput(
                              (prev) =>
                                `${prev} (Konumum: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`,
                            );
                          },
                          () => setNotice("Konum izni alınamadı."),
                        );
                      }
                    }}
                    title="Konumumu Ekle"
                    aria-label="Konumumu Ekle"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                      add_location_alt
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`ai-input-icon-btn ${listening ? "ai-mic-pulsing" : ""}`}
                    onClick={dictate}
                    disabled={busy}
                    aria-label={listening ? "Sesli girişi durdur" : "Sesli mesaj yazdır"}
                    title={listening ? "Dinleniyor... Durdurmak için tıklayın" : "Sesli Mesaj"}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                      {listening ? "mic" : "mic"}
                    </span>
                  </button>
                  <textarea
                    ref={textareaRef}
                    aria-label="Asistana mesaj"
                    value={input}
                    maxLength={2000}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder="Bir durak ekle, rotayı değiştir veya soru sor..."
                    rows={1}
                  />
                  {input.length > 0 && (
                    <button
                      type="button"
                      className="ai-input-clear-btn"
                      onClick={() => setInput("")}
                      title="Metni Temizle"
                      aria-label="Metni Temizle"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                        close
                      </span>
                    </button>
                  )}
                  <button
                    className="ai-send-btn-stitch"
                    disabled={busy || !input.trim()}
                    type="submit"
                  >
                    <span>{busy ? "Hazırlanıyor…" : "Gönder"}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                      send
                    </span>
                  </button>
                </form>

                <div className="ai-composer-footer-bar">
                  <div className="ai-composer-credits-pill">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "15px", color: "var(--color-accent)" }}
                    >
                      bolt
                    </span>
                    <span>{wallet ? `${wallet.credits} Kredi` : "Ücretsiz Danışmanlık"}</span>
                    <button
                      type="button"
                      onClick={() =>
                        openUpgradeModal("Yapay Zeka Seyahat Asistanı için Kredi Yükleyin")
                      }
                      className="ai-buy-credits-link"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        font: "inherit",
                      }}
                    >
                      + Kredi Yükle
                    </button>
                  </div>
                  <div className="ai-composer-disclaimer">
                    <span>
                      ✨ Sorular ve netleştirme ücretsizdir · Rota ve harita entegrasyonu 5 kredi
                    </span>
                  </div>
                </div>
              </div>
            </section>
            {panelOpen && (
              <aside
                id="route-draft"
                className={`ai-studio-aside-right ${mobileTab === "draft" ? "mobile-visible" : ""}`}
                aria-label="Oluşturulan rota"
              >
                <div className="ai-draft-header">
                  <strong ref={draftHeadingRef} tabIndex={-1}>
                    Oluşturulan rota
                  </strong>
                  <div className="ai-header-actions">
                    <button
                      className="ai-small-btn ai-panel-resize"
                      onClick={() => setPanelWide(!panelWide)}
                      aria-label={panelWide ? "Rota panelini küçült" : "Rota panelini büyüt"}
                    >
                      {panelWide ? "Küçült" : "Büyüt"}
                    </button>
                    <button
                      className="ai-small-btn"
                      onClick={() => {
                        setPanelOpen(false);
                        setMobileTab("chat");
                      }}
                      aria-label="Rota panelini kapat"
                    >
                      Kapat
                    </button>
                  </div>
                </div>
                {!route ? (
                  <div className="ai-route-empty">
                    <span className="material-symbols-outlined">map</span>
                    <h2>Henüz rota yok</h2>
                    <p>Tercihlerini konuştuktan sonra oluşturduğumuz rota burada görünecek.</p>
                    {prepContext.kind === "strip" && <PrepPanel context={prepContext} />}
                  </div>
                ) : (
                  <>
                    <div className="ai-route-heading">
                      <h2>{route.title}</h2>
                      <p>
                        {route.destination} · {route.estimatedDays} gün · {route.stops.length} durak
                      </p>
                      <p className="ai-muted">{route.summary}</p>
                    </div>
                    <div
                      className="ai-day-tabs-bar"
                      role="group"
                      aria-label="Taslak bölümleri"
                      style={{ marginBottom: "0.5rem", flexWrap: "wrap", gap: "4px" }}
                    >
                      <button
                        type="button"
                        aria-pressed={draftTab === "route"}
                        className={`ai-day-tab-btn ${draftTab === "route" ? "active" : ""}`}
                        onClick={() => setDraftTab("route")}
                      >
                        🗺️ Duraklar
                      </button>
                      <button
                        type="button"
                        aria-pressed={draftTab === "stay"}
                        className={`ai-day-tab-btn ${draftTab === "stay" ? "active" : ""}`}
                        onClick={() => setDraftTab("stay")}
                      >
                        🏨 Konaklama
                      </button>
                      <button
                        type="button"
                        aria-pressed={draftTab === "discovery"}
                        className={`ai-day-tab-btn ${draftTab === "discovery" ? "active" : ""}`}
                        onClick={() => setDraftTab("discovery")}
                      >
                        ✨ Keşif
                      </button>
                      <button
                        type="button"
                        aria-pressed={draftTab === "flights"}
                        className={`ai-day-tab-btn ${draftTab === "flights" ? "active" : ""}`}
                        onClick={() => setDraftTab("flights")}
                      >
                        <span aria-hidden="true">{prepIcon}</span> {prepLabel}
                        {session?.flightPrices?.cheapestPrice
                          ? ` · ${session.flightPrices.cheapestCurrency} ${session.flightPrices.cheapestPrice}`
                          : ""}
                      </button>
                      <button
                        type="button"
                        aria-pressed={draftTab === "advisory"}
                        className={`ai-day-tab-btn ${draftTab === "advisory" ? "active" : ""}`}
                        onClick={() => setDraftTab("advisory")}
                      >
                        📋 Tavsiye
                        {session?.travelAdvisory?.level && session.travelAdvisory.level !== "normal"
                          ? " ⚠️"
                          : ""}
                      </button>
                      <button
                        type="button"
                        aria-pressed={draftTab === "emergency"}
                        className={`ai-day-tab-btn ${draftTab === "emergency" ? "active" : ""}`}
                        onClick={() => setDraftTab("emergency")}
                      >
                        🛡️ Güvenlik
                      </button>
                    </div>
                    {draftTab === "route" && (
                      <>
                        <div className="ai-day-tabs-bar">
                          {Array.from({ length: route.estimatedDays }, (_, i) => (
                            <button
                              key={i}
                              type="button"
                              aria-pressed={day === i + 1}
                              className={`ai-day-tab-btn ${day === i + 1 ? "active" : ""}`}
                              onClick={() => setDay(i + 1)}
                            >
                              {i + 1}. Gün
                            </button>
                          ))}
                        </div>
                        <div className="ai-timeline-container ai-custom-scrollbar">
                          {route.stops
                            .filter((s) => s.day === day)
                            .map((s, i) => (
                              <article className="ai-stop-row" key={s.id}>
                                <span className="ai-stop-badge-num">{i + 1}</span>
                                <div className="ai-stop-card">
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "baseline",
                                      gap: "0.5rem",
                                    }}
                                  >
                                    <strong>{s.name}</strong>
                                    {s.timeSlot && (
                                      <span
                                        style={{
                                          fontSize: "10.5px",
                                          padding: "2px 6px",
                                          borderRadius: "6px",
                                          backgroundColor: "var(--color-surface-brand)",
                                          color: "var(--color-accent)",
                                          fontWeight: 700,
                                        }}
                                      >
                                        {s.timeSlot === "morning"
                                          ? "🌅 Sabah"
                                          : s.timeSlot === "evening"
                                            ? "🌆 Akşam"
                                            : s.timeSlot === "night"
                                              ? "🌙 Gece"
                                              : "☀️ Öğle"}
                                      </span>
                                    )}
                                  </div>
                                  <span className="ai-muted">{s.address}</span>
                                  <p>{s.description}</p>
                                  <small>Önerilen ziyaret: {s.suggestedDuration}</small>
                                </div>
                                {s.distanceToNextKm !== undefined && (
                                  <div className="ai-travel-interval-badge">
                                    <span>Sonraki durağa kuş uçuşu ~{s.distanceToNextKm} km</span>
                                  </div>
                                )}
                              </article>
                            ))}
                        </div>
                      </>
                    )}
                    {draftTab === "stay" && (
                      <div
                        className="ai-timeline-container ai-custom-scrollbar"
                        style={{ padding: "0.5rem" }}
                      >
                        {!session?.stayAndTransit ? (
                          <p className="ai-muted">
                            Bu rota için ulaşım ve konaklama önerilerini sohbette sorabilirsin.{" "}
                            <button
                              className="ai-small-btn"
                              onClick={() =>
                                setInput(
                                  "Mevcut rotama uygun konaklama bölgeleri ve şehir içi ulaşım seçenekleri öner; rotayı değiştirme.",
                                )
                              }
                            >
                              Sohbette sor
                            </button>
                          </p>
                        ) : (
                          <>
                            <div style={{ marginBottom: "1rem" }}>
                              <h3
                                style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}
                              >
                                📍 Önerilen Konaklama Semtleri
                              </h3>
                              <ul
                                style={{
                                  margin: 0,
                                  paddingLeft: "1.2rem",
                                  fontSize: "12.5px",
                                  color: "var(--mb-text-subtle)",
                                }}
                              >
                                {session.stayAndTransit.recommendedAreas?.map((a, idx) => (
                                  <li key={idx} style={{ marginBottom: "3px" }}>
                                    {a}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div style={{ marginBottom: "1rem" }}>
                              <h3
                                style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}
                              >
                                🏨 Önerilen Otel & Konaklama Tipleri
                              </h3>
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {session.stayAndTransit.stays?.map((stay, idx) => (
                                  <div key={idx} className="ai-stop-card">
                                    <div
                                      style={{ display: "flex", justifyContent: "space-between" }}
                                    >
                                      <strong>{stay.name}</strong>
                                      <span style={{ fontSize: "11px", fontWeight: 700 }}>
                                        {stay.priceLevel} · {stay.type}
                                      </span>
                                    </div>
                                    <span className="ai-muted">{stay.area}</span>
                                    <p style={{ fontSize: "12px", margin: "3px 0" }}>
                                      {stay.description}
                                    </p>
                                    {stay.pros?.length > 0 && (
                                      <small style={{ color: "var(--color-accent)" }}>
                                        ✓ {stay.pros.join(" · ")}
                                      </small>
                                    )}
                                    <div style={{ marginTop: "6px" }}>
                                      <button
                                        type="button"
                                        className="ai-action-chip ai-hotel-chip"
                                        onClick={() =>
                                          addPlaceToActiveTrip({
                                            label: stay.name,
                                            address: stay.area,
                                            isHotel: true,
                                            category: "otel",
                                            note: `${stay.type} · ${stay.priceLevel} - ${stay.description}`,
                                          })
                                        }
                                      >
                                        🏨 Bu Oteli Rotama Kaydet
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h3
                                style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}
                              >
                                🚇 Havalimanı & Şehir İçi Ulaşım
                              </h3>
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                {session.stayAndTransit.transitTips?.map((tip, idx) => (
                                  <div key={idx} className="ai-stop-card">
                                    <strong>{tip.title}</strong>
                                    <p style={{ fontSize: "12px", margin: "3px 0" }}>
                                      {tip.description}
                                    </p>
                                    {tip.estimatedCost && (
                                      <small
                                        style={{
                                          color: "var(--color-surface-inverse)",
                                          fontWeight: 600,
                                        }}
                                      >
                                        Tahmini Ücret: {tip.estimatedCost}
                                      </small>
                                    )}
                                  </div>
                                ))}
                              </div>
                              {session.stayAndTransit.cityCardRecommendation && (
                                <p
                                  style={{
                                    fontSize: "12px",
                                    marginTop: "6px",
                                    padding: "6px",
                                    backgroundColor: "var(--color-surface-brand)",
                                    borderRadius: "6px",
                                    color: "var(--color-surface-inverse)",
                                  }}
                                >
                                  💳 <strong>Kart Önerisi:</strong>{" "}
                                  {session.stayAndTransit.cityCardRecommendation}
                                </p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {draftTab === "discovery" && (
                      <div
                        className="ai-timeline-container ai-custom-scrollbar"
                        style={{ padding: "0.5rem" }}
                      >
                        {!session?.discovery ? (
                          <p className="ai-muted">
                            Yerel lezzetler ve keşif önerilerini sohbette sorabilirsin.{" "}
                            <button
                              className="ai-small-btn"
                              onClick={() =>
                                setInput(
                                  "Mevcut rotamın şehrinde hangi yerel lezzetleri denemeliyim? Rotayı değiştirme.",
                                )
                              }
                            >
                              Sohbette sor
                            </button>
                          </p>
                        ) : (
                          <>
                            <div style={{ marginBottom: "1rem" }}>
                              <h3
                                style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}
                              >
                                🍽️ Mutlaka Tadılması Gereken Spesiyaller
                              </h3>
                              <ul
                                style={{
                                  margin: 0,
                                  paddingLeft: "1.2rem",
                                  fontSize: "12.5px",
                                  color: "var(--mb-text-subtle)",
                                }}
                              >
                                {session.discovery.specialties?.map((s, idx) => (
                                  <li key={idx} style={{ marginBottom: "3px" }}>
                                    {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div style={{ marginBottom: "1rem" }}>
                              <h3
                                style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}
                              >
                                💎 Gizli Köşeler & Otantik Noktalar
                              </h3>
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {session.discovery.gems?.map((gem, idx) => (
                                  <div key={idx} className="ai-stop-card">
                                    <div
                                      style={{ display: "flex", justifyContent: "space-between" }}
                                    >
                                      <strong>{gem.name}</strong>
                                      <span style={{ fontSize: "11px", fontWeight: 600 }}>
                                        {gem.category}
                                      </span>
                                    </div>
                                    <p style={{ fontSize: "12px", margin: "3px 0" }}>
                                      {gem.description}
                                    </p>
                                    <small style={{ color: "var(--color-accent)" }}>
                                      ✨ Özel: {gem.highlight}
                                    </small>
                                    <div style={{ marginTop: "6px" }}>
                                      <button
                                        type="button"
                                        className="ai-action-chip"
                                        onClick={() =>
                                          addPlaceToActiveTrip({
                                            label: gem.name,
                                            category:
                                              (gem.category as import("../lib/trip/models").PinCategory) ||
                                              "aktivite",
                                            note: `${gem.highlight ? gem.highlight + " - " : ""}${gem.description}`,
                                          })
                                        }
                                      >
                                        ➕ Bu Noktayı Rotama Ekle
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h3
                                style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}
                              >
                                💡 Yerel Yaşam & Kültürel İpuçları
                              </h3>
                              <ul
                                style={{
                                  margin: 0,
                                  paddingLeft: "1.2rem",
                                  fontSize: "12.5px",
                                  color: "var(--mb-text-subtle)",
                                }}
                              >
                                {session.discovery.cultureTips?.map((c, idx) => (
                                  <li key={idx} style={{ marginBottom: "3px" }}>
                                    {c}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {draftTab === "flights" && (
                      <div
                        className="ai-timeline-container ai-custom-scrollbar"
                        style={{ padding: "0.5rem" }}
                      >
                        <PrepPanel
                          context={prepContext}
                          flightBlock={
                            !session?.flightPrices ? (
                              <p className="ai-muted">
                                Uçuş fiyatı bilgisi bu rota için mevcut değil. Rota oluştururken
                                otomatik kontrol edilir.
                              </p>
                            ) : session.flightPrices.source === "unavailable" ? (
                              <div className="ai-stop-card">
                                <p className="ai-muted">{session.flightPrices.note}</p>
                              </div>
                            ) : (
                              <>
                                <div
                                  style={{
                                    marginBottom: "0.75rem",
                                    padding: "0.75rem 1rem",
                                    borderRadius: "12px",
                                    background:
                                      "linear-gradient(135deg,color-mix(in srgb, var(--color-accent) 12%, transparent),color-mix(in srgb, var(--color-accent-sky-soft) 8%, transparent))",
                                    border: "1px solid var(--color-accent-a30)",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                      marginBottom: "6px",
                                    }}
                                  >
                                    <span style={{ fontSize: "20px" }}>✈️</span>
                                    <div>
                                      <div
                                        style={{
                                          fontSize: "14px",
                                          fontWeight: 700,
                                          color: "var(--color-accent)",
                                        }}
                                      >
                                        Uçuş Fiyatları
                                      </div>
                                      <div
                                        style={{
                                          fontSize: "11px",
                                          color: "var(--color-text-subtle)",
                                        }}
                                      >
                                        Travelpayouts ·{" "}
                                        {new Date(
                                          session.flightPrices.checkedAt,
                                        ).toLocaleDateString("tr-TR")}
                                      </div>
                                    </div>
                                  </div>
                                  <p
                                    style={{
                                      fontSize: "12px",
                                      margin: 0,
                                      color: "var(--mb-text-subtle)",
                                    }}
                                  >
                                    {session.flightPrices.note}
                                  </p>
                                </div>
                                {session.flightPrices.deals.length > 0 && (
                                  <div
                                    style={{ display: "flex", flexDirection: "column", gap: "8px" }}
                                  >
                                    {session.flightPrices.deals.map((deal, idx) => (
                                      <a
                                        key={idx}
                                        href={deal.affiliateLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ textDecoration: "none", display: "block" }}
                                      >
                                        <div
                                          style={{
                                            padding: "0.75rem 1rem",
                                            borderRadius: "10px",
                                            background:
                                              "color-mix(in srgb, var(--color-accent) 6%, transparent)",
                                            border: "1px solid var(--color-accent-a20)",
                                            cursor: "pointer",
                                            transition: "border-color 0.2s",
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              justifyContent: "space-between",
                                              alignItems: "center",
                                            }}
                                          >
                                            <div>
                                              <strong
                                                style={{
                                                  fontSize: "14px",
                                                  color: "var(--mb-text)",
                                                }}
                                              >
                                                {deal.origin} → {deal.destination}
                                              </strong>
                                              {deal.departureMonth && (
                                                <div
                                                  style={{
                                                    fontSize: "11px",
                                                    color: "var(--mb-text-subtle)",
                                                    marginTop: "2px",
                                                  }}
                                                >
                                                  {deal.departureMonth}
                                                </div>
                                              )}
                                            </div>
                                            <div
                                              style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "flex-end",
                                                gap: "4px",
                                              }}
                                            >
                                              <strong
                                                style={{
                                                  color: "var(--color-accent)",
                                                  fontSize: "18px",
                                                  lineHeight: 1,
                                                }}
                                              >
                                                {deal.currency} {deal.price}
                                              </strong>
                                              <span
                                                style={{
                                                  fontSize: "11px",
                                                  padding: "2px 8px",
                                                  borderRadius: "6px",
                                                  background:
                                                    "color-mix(in srgb, var(--color-accent) 15%, transparent)",
                                                  color: "var(--color-accent)",
                                                  fontWeight: 600,
                                                }}
                                              >
                                                Bilet Ara →
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </a>
                                    ))}
                                  </div>
                                )}
                                {session.flightPrices.deals[0] && (
                                  <a
                                    href={session.flightPrices.deals[0].affiliateLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: "8px",
                                      marginTop: "12px",
                                      padding: "12px",
                                      borderRadius: "12px",
                                      background:
                                        "linear-gradient(135deg,var(--color-accent),var(--color-accent-sky-soft))",
                                      color: "var(--color-on-primary)",
                                      fontWeight: 700,
                                      fontSize: "14px",
                                      textDecoration: "none",
                                      boxShadow: "0 2px 12px var(--color-accent-a30)",
                                    }}
                                  >
                                    ✈️ Tüm Uçuşları Karşılaştır
                                  </a>
                                )}
                                <p
                                  style={{
                                    fontSize: "10px",
                                    color: "var(--color-text-subtle)",
                                    marginTop: "8px",
                                    lineHeight: 1.4,
                                    textAlign: "center",
                                  }}
                                >
                                  Travelpayouts üzerinden arama yapılır. Fiyatlar değişkendir.
                                </p>
                              </>
                            )
                          }
                        />
                      </div>
                    )}

                    {draftTab === "advisory" && (
                      <div
                        className="ai-timeline-container ai-custom-scrollbar"
                        style={{ padding: "0.5rem" }}
                      >
                        {!session?.travelAdvisory ? (
                          <p className="ai-muted">
                            Seyahat tavsiyesi bu destinasyon için mevcut değil.
                          </p>
                        ) : (
                          <>
                            <div
                              style={{
                                marginBottom: "0.75rem",
                                padding: "0.65rem 0.85rem",
                                borderRadius: "10px",
                                background:
                                  session.travelAdvisory.level === "avoid"
                                    ? "rgba(239,68,68,0.1)"
                                    : session.travelAdvisory.level === "avoid_non_essential"
                                      ? "rgba(245,158,11,0.1)"
                                      : session.travelAdvisory.level === "some_risk"
                                        ? "rgba(251,191,36,0.08)"
                                        : "rgba(16,185,129,0.08)",
                                border:
                                  session.travelAdvisory.level === "avoid"
                                    ? "1px solid rgba(239,68,68,0.3)"
                                    : session.travelAdvisory.level === "avoid_non_essential"
                                      ? "1px solid rgba(245,158,11,0.3)"
                                      : session.travelAdvisory.level === "some_risk"
                                        ? "1px solid rgba(251,191,36,0.3)"
                                        : "1px solid rgba(16,185,129,0.2)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 700,
                                  marginBottom: "4px",
                                  color:
                                    session.travelAdvisory.level === "avoid"
                                      ? "#ef4444"
                                      : session.travelAdvisory.level === "avoid_non_essential"
                                        ? "#f59e0b"
                                        : session.travelAdvisory.level === "some_risk"
                                          ? "#fbbf24"
                                          : "var(--color-accent)",
                                }}
                              >
                                {session.travelAdvisory.level === "avoid"
                                  ? "🔴"
                                  : session.travelAdvisory.level === "avoid_non_essential"
                                    ? "🟡"
                                    : session.travelAdvisory.level === "some_risk"
                                      ? "🟠"
                                      : "🟢"}{" "}
                                {session.travelAdvisory.levelLabel}
                              </div>
                              <strong style={{ fontSize: "12px" }}>
                                {session.travelAdvisory.country}
                              </strong>
                            </div>
                            {session.travelAdvisory.summary && (
                              <div className="ai-stop-card" style={{ marginBottom: "8px" }}>
                                <h3
                                  style={{ fontSize: "12px", fontWeight: 700, margin: "0 0 6px" }}
                                >
                                  📋 Özet Tavsiye
                                </h3>
                                <p
                                  style={{
                                    fontSize: "12px",
                                    margin: 0,
                                    lineHeight: 1.5,
                                    color: "var(--mb-text-subtle)",
                                  }}
                                >
                                  {session.travelAdvisory.summary}
                                </p>
                              </div>
                            )}
                            {session.travelAdvisory.changeNote && (
                              <div
                                className="ai-stop-card"
                                style={{
                                  marginBottom: "8px",
                                  background:
                                    "color-mix(in srgb, var(--color-accent-sky-soft) 6%, transparent)",
                                  border: "1px solid rgba(56,189,248,0.2)",
                                }}
                              >
                                <h3
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    margin: "0 0 4px",
                                    color: "#38bdf8",
                                  }}
                                >
                                  🔔 Son Güncelleme
                                </h3>
                                <p
                                  style={{
                                    fontSize: "12px",
                                    margin: 0,
                                    color: "var(--mb-text-subtle)",
                                  }}
                                >
                                  {session.travelAdvisory.changeNote}
                                </p>
                              </div>
                            )}
                            <p
                              style={{
                                fontSize: "10.5px",
                                color: "var(--color-text-subtle)",
                                lineHeight: 1.5,
                                marginTop: "8px",
                              }}
                            >
                              ⚠️ {session.travelAdvisory.disclaimer}
                            </p>
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                marginTop: "8px",
                                flexWrap: "wrap",
                              }}
                            >
                              <a
                                href={session.travelAdvisory.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ai-small-btn"
                                style={{ fontSize: "11px" }}
                              >
                                🇬🇧 FCDO Kaynağı
                              </a>
                              <a
                                href="https://www.mfa.gov.tr/default.tr.mfa"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ai-small-btn"
                                style={{ fontSize: "11px" }}
                              >
                                🇹🇷 T.C. Dışişleri
                              </a>
                            </div>
                            <p
                              style={{
                                fontSize: "10px",
                                color: "var(--color-text-subtle)",
                                marginTop: "6px",
                              }}
                            >
                              Son kontrol:{" "}
                              {new Date(session.travelAdvisory.lastChecked).toLocaleString("tr-TR")}{" "}
                              · Kaynak: FCDO GOV.UK
                            </p>
                          </>
                        )}
                      </div>
                    )}

                    {draftTab === "emergency" && (
                      <div
                        className="ai-timeline-container ai-custom-scrollbar"
                        style={{ padding: "0.5rem" }}
                      >
                        {!session?.emergency ? (
                          <p className="ai-muted">Bu rota için ek güvenlik bilgisi alınamadı.</p>
                        ) : (
                          <>
                            <div style={{ marginBottom: "1rem" }} className="ai-stop-card">
                              <h3
                                style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}
                              >
                                🏛️{" "}
                                {session.emergency.turkishEmbassyConsulate?.title ||
                                  "T.C. Temsilciliği"}
                              </h3>
                              <p style={{ fontSize: "12px", margin: "2px 0" }}>
                                📍 {session.emergency.turkishEmbassyConsulate?.address}
                              </p>
                              <p style={{ fontSize: "12px", margin: "2px 0" }}>
                                📞 Tel: {session.emergency.turkishEmbassyConsulate?.phone}
                              </p>
                              <p
                                style={{
                                  fontSize: "12px",
                                  margin: "2px 0",
                                  color: "#dc2626",
                                  fontWeight: 700,
                                }}
                              >
                                🚨 7/24 Acil Çağrı:{" "}
                                {session.emergency.turkishEmbassyConsulate?.emergencyHotline}
                              </p>
                              {session.emergency.turkishEmbassyConsulate?.workingHours && (
                                <small className="ai-muted">
                                  Çalışma Saatleri:{" "}
                                  {session.emergency.turkishEmbassyConsulate.workingHours}
                                </small>
                              )}
                            </div>
                            <div style={{ marginBottom: "1rem" }}>
                              <h3
                                style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}
                              >
                                🚨 Yerel Acil Numaralar
                              </h3>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr",
                                  gap: "6px",
                                  fontSize: "12px",
                                }}
                              >
                                <div className="ai-stop-card">
                                  <strong>Polis</strong>
                                  <span>{session.emergency.localEmergencyNumbers?.police}</span>
                                </div>
                                <div className="ai-stop-card">
                                  <strong>Ambulans</strong>
                                  <span>{session.emergency.localEmergencyNumbers?.ambulance}</span>
                                </div>
                                <div className="ai-stop-card">
                                  <strong>İtfaiye</strong>
                                  <span>{session.emergency.localEmergencyNumbers?.fire}</span>
                                </div>
                                <div className="ai-stop-card">
                                  <strong>Genel Acil</strong>
                                  <span>
                                    {session.emergency.localEmergencyNumbers?.generalEmergency}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <h3
                                style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}
                              >
                                ⚠️ Pasaport Kaybı ve Güvenlik Protokolü
                              </h3>
                              <ul
                                style={{
                                  margin: 0,
                                  paddingLeft: "1.2rem",
                                  fontSize: "12px",
                                  color: "var(--mb-text-subtle)",
                                }}
                              >
                                {session.emergency.safetyAndPassportTips?.map((tip, idx) => (
                                  <li key={idx} style={{ marginBottom: "4px" }}>
                                    {tip}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    <div className="ai-draft-footer-actions">
                      <p className="ai-muted">
                        Değişiklik için sohbete yaz: “İkinci güne kahve ekle” veya “Daha sakin
                        olsun”.
                      </p>
                      <button className="ai-open-in-map-btn" onClick={openMap}>
                        Haritada aç
                      </button>
                      <div className="ai-header-actions">
                        <button className="ai-small-btn" onClick={copy}>
                          Planı kopyala
                        </button>
                        <button className="ai-small-btn" onClick={download}>
                          Metin olarak indir
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </aside>
            )}
          </div>
        </div>

        {/* Seyahat Manifestosu (.md) Modalı */}
        {showManifestoModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
              backgroundColor: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(4px)",
            }}
          >
            <div
              style={{
                backgroundColor: "var(--color-neutral-900)",
                border: "1px solid color-mix(in srgb, var(--color-neutral-700) 80%, transparent)",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "640px",
                maxHeight: "85vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "1rem 1.5rem",
                  borderBottom: "1px solid var(--color-neutral-800)",
                  backgroundColor: "var(--color-neutral-900)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    className="material-symbols-outlined"
                    style={{ color: "#38bdf8", fontSize: "20px" }}
                  >
                    description
                  </span>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#f8fafc" }}>
                    Seyahat Manifestosu (.md)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowManifestoModal(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "4px",
                    borderRadius: "8px",
                  }}
                  title="Kapat"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    close
                  </span>
                </button>
              </div>

              <div style={{ padding: "1rem 1.5rem", flex: 1, overflowY: "auto" }}>
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 12px 0" }}>
                  AI Asistanımız bu markdown manifestosunu her sorunuzda okuyarak otellerinizi, rota
                  duraklarınızı ve günlerinizi bilir; önerileri buna göre optimize eder.
                </p>
                <pre
                  style={{
                    backgroundColor: "var(--color-neutral-900)",
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid var(--color-neutral-800)",
                    fontSize: "11.5px",
                    fontFamily: "monospace",
                    color: "#e2e8f0",
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                    maxHeight: "45vh",
                    lineHeight: "1.6",
                  }}
                >
                  {currentTrip
                    ? tripToMarkdown(currentTrip)
                    : "# Henüz aktif bir seyahat rotası seçilmedi."}
                </pre>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.85rem 1.5rem",
                  borderTop: "1px solid var(--color-neutral-800)",
                  backgroundColor: "var(--color-neutral-900)",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                {currentTrip && (
                  <a
                    href={`/maps/?tripId=${currentTrip.id}`}
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--color-accent-strong)",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                      map
                    </span>
                    <span>Haritada Düzenle</span>
                  </a>
                )}
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}
                >
                  <button
                    type="button"
                    onClick={async () => {
                      if (!currentTrip) return;
                      await navigator.clipboard.writeText(tripToMarkdown(currentTrip));
                      setNotice("✓ Markdown panoya kopyalandı!");
                    }}
                    className="ai-small-btn"
                    style={{ display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                      content_copy
                    </span>
                    <span>Kopyala</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentTrip) return;
                      const content = tripToMarkdown(currentTrip);
                      const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${(currentTrip.title || "seyahat").toLowerCase().replace(/[^a-z0-9]/gi, "_")}_manifesto.md`;
                      a.click();
                      URL.revokeObjectURL(url);
                      setNotice("✓ Markdown dosyası indirildi!");
                    }}
                    className="ai-send-btn"
                    style={{
                      fontSize: "12px",
                      padding: "0.4rem 0.85rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                      download
                    </span>
                    <span>İndir (.md)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fiyat Takip & Ucuz Bilet/Otel Botu Modalı */}
        {showDealTrackerModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
              backgroundColor: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(4px)",
            }}
          >
            <div style={{ width: "100%", maxWidth: "820px", maxHeight: "90vh", overflowY: "auto" }}>
              <DealTrackerPanel
                initialDestination={currentTrip?.destination || currentTrip?.title || ""}
                onClose={() => setShowDealTrackerModal(false)}
              />
            </div>
          </div>
        )}

        <div className="ai-mobile-switcher">
          <button
            className={`ai-mobile-switch-btn ${mobileTab === "chat" ? "active" : ""}`}
            onClick={() => {
              setMobileTab("chat");
              setPanelOpen(false);
            }}
          >
            Sohbet
          </button>
          <button
            className={`ai-mobile-switch-btn ${mobileTab === "draft" ? "active" : ""}`}
            onClick={() => {
              setMobileTab("draft");
              setPanelOpen(true);
            }}
          >
            Rota {route ? `· ${route.stops.length} durak` : ""}
          </button>
        </div>
        <AuthActionModal
          isOpen={authModal}
          onClose={() => setAuthModal(false)}
          title="Seyahatini birlikte planlayalım"
          subtitle="Sohbet için giriş yap ve e-postanı doğrula."
          featureName="AI seyahat asistanı"
          nextUrl="/travel-assistant/"
        />
      </div>
    </PageShell>
  );
}
