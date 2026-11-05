import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
} from "react-native";
import { tripStore, TripStop } from "../services/tripStore";
import { storage } from "../services/storage";
import {
  aiService,
  routeService,
  generateUUID,
  type MobileConversationState,
} from "../services/api";
import { agentService, TravelAgent, LanguagePhrase } from "../services/agentService";
import type { RichAgentCard } from "../services/agentOrchestrator";
import {
  RobotIcon,
  SparkIcon,
  MapIcon,
  DirectionsIcon,
  BookmarkIcon,
  CameraIcon,
  MicIcon,
  WalkIcon,
  HotelIcon,
  CarIcon,
  FoodIcon,
  TranslateIcon,
  AlertCircleIcon,
} from "../components/Icons";
import { ScreenTourModal } from "../components/ScreenTourModal";
import * as ImagePicker from "expo-image-picker";

import { ModalFrame, motion, Screen } from "../ui";
import { tokens, withAlpha } from "../theme";
interface AIScreenProps {
  onOpenMap: () => void;
  onOpenProfile?: () => void;
}

interface ChatMessageItem {
  id: string;
  sender: "user" | "bot";
  text: string;
  time: string;
  agentCards?: RichAgentCard[];
  /** Focus-aware chips from backend (§12.2); falls back to clarification quickOptions */
  quickOptions?: Array<{ label: string; prompt: string }>;
  /** Feasibility warnings to display inline below the message */
  feasibilityWarnings?: string[];
  /** Visible assumptions made by the model this turn */
  assumptions?: string[];
  routePlan?: {
    title: string;
    dayTitle: string;
    stops: { time: string; name: string; desc: string; walk: string }[];
    totalKm: string;
    totalWalkTime: string;
    coverImage: string;
    stopPills: string[];
    stopsData: TripStop[];
  };
}

const THINKING_STEPS = [
  "Seyahat isteğin analiz ediliyor...",
  "AWS Bedrock ajanları devreye alınıyor...",
  "Destinasyon verileri sorgulanıyor...",
  "Rota zikzaksız optimize ediliyor...",
  "Vizyon, bütçe ve tempo dengeleniyor...",
  "Yanıt hazırlanıyor...",
];

function ThinkingBubble({ status }: { status: string }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (dot: Animated.Value, delay: number) =>
      motion.loop(
        motion.sequence([
          motion.delay(delay),
          motion.animate(dot, 1, {
            duration: 300,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          motion.animate(dot, 0, {
            duration: 300,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          motion.delay(600 - delay),
        ]),
      );
    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 200);
    const a3 = pulse(dot3, 400);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotStyle = (dot: Animated.Value) => ({
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: tokens.color.accent,
    marginHorizontal: 2,
    opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
    transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
  });

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Animated.View style={dotStyle(dot1)} />
        <Animated.View style={dotStyle(dot2)} />
        <Animated.View style={dotStyle(dot3)} />
      </View>
      <Text
        maxFontSizeMultiplier={tokens.font.maxScale.body}
        style={{ color: tokens.color.textSubtle, fontSize: 12, fontStyle: "italic", flex: 1 }}
        numberOfLines={1}
      >
        {status}
      </Text>
    </View>
  );
}

const INITIAL_MESSAGES: ChatMessageItem[] = [
  {
    id: "welcome",
    sender: "bot",
    time: "",
    text: "Nereye gitmek istiyorsun? Seyahatini birlikte planlayabilir veya aklındaki soruyla başlayabiliriz.",
  },
];

export function AIScreen({ onOpenMap }: AIScreenProps) {
  const [messages, setMessages] = useState<ChatMessageItem[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [_orchestrationStatus, setOrchestrationStatus] = useState<string>("");
  const [showRouteLoaderModal, setShowRouteLoaderModal] = useState(false);
  const [loadedRouteDetails, setLoadedRouteDetails] = useState<{
    title: string;
    stops: TripStop[];
    flight?: string;
    transport?: string;
    hotel?: string;
    meals?: string[];
  } | null>(null);
  const [showAgentsModal, setShowAgentsModal] = useState(false);
  const [agents, setAgents] = useState<TravelAgent[]>([]);
  const [_selectedAgent, setSelectedAgent] = useState<TravelAgent | null>(null);
  const [_phrases, setPhrases] = useState<LanguagePhrase[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  // ── Conversation & context state ─────────────────────────────────────────
  const [conversationId, setConversationId] = useState(`conv-${Date.now()}`);
  const [messageHistory, setMessageHistory] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [pastConversations, setPastConversations] = useState<
    Array<{ id: string; title: string; date: string; messages: ChatMessageItem[] }>
  >([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [_isRecordingVoice, _setIsRecordingVoice] = useState<boolean>(false);
  const sending = useRef(false);
  const pendingTurn = useRef<{ text: string; requestId: string; trainingConsent: boolean } | null>(
    null,
  );
  const [trainingConsent, setTrainingConsent] = useState(false);
  const [detectedCity, setDetectedCity] = useState<string | undefined>(undefined);
  /** Persisted between turns so backend can track answered slots and active focus */
  const [conversationState, setConversationState] = useState<MobileConversationState | undefined>(
    undefined,
  );
  const [thinkingStepIndex, setThinkingStepIndex] = useState(0);

  const nowTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const AI_CONVERSATIONS_KEY = "mb_ai_conversations";
  const MAX_STORED_CONVERSATIONS = 20;

  // Cycle through thinking step labels while isTyping is true
  useEffect(() => {
    if (!isTyping) {
      setThinkingStepIndex(0);
      return;
    }
    const id = setInterval(() => {
      setThinkingStepIndex((prev) => (prev + 1) % THINKING_STEPS.length);
    }, 1800);
    return () => clearInterval(id);
  }, [isTyping]);

  // Scroll to bottom whenever typing indicator appears
  useEffect(() => {
    if (isTyping) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [isTyping]);

  // Load persisted past conversations on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await storage.getItem(AI_CONVERSATIONS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setPastConversations(parsed.slice(0, MAX_STORED_CONVERSATIONS));
          }
        }
      } catch (err) {
        console.warn("[AIScreen] Failed to load conversation history:", err);
      }
    })();
  }, []);

  // Persist past conversations whenever they change
  useEffect(() => {
    if (pastConversations.length === 0) return;
    const toStore = pastConversations.slice(0, MAX_STORED_CONVERSATIONS);
    storage.setItem(AI_CONVERSATIONS_KEY, JSON.stringify(toStore)).catch((err) => {
      console.warn("[AIScreen] Failed to save conversation history:", err);
    });
  }, [pastConversations]);

  // Load agents and sync active conversation from backend on mount
  useEffect(() => {
    setAgents(agentService.getAgents());
    setPhrases(agentService.getAllPhrases());

    async function syncBackendSession() {
      try {
        const latest = await aiService.getLatestSession();
        if (
          latest?.conversation &&
          Array.isArray(latest.conversation.messages) &&
          latest.conversation.messages.length > 0
        ) {
          const conv = latest.conversation;
          const activeConvId = latest.latestConversationId || latest.conversationId;
          if (activeConvId) setConversationId(activeConvId);

          const syncedMessages: ChatMessageItem[] = (conv.messages ?? []).map(
            (m: { role: string; content: string }, idx: number) => ({
              id: `sync-${idx}`,
              sender: m.role === "user" ? "user" : "bot",
              text: m.content,
              time: "Senkronize",
            }),
          );

          if (conv.route && (conv.route.stops?.length ?? 0) > 0) {
            const r = conv.route;
            const botStops: TripStop[] = (r.stops ?? []).map(
              (
                s: {
                  id?: string;
                  name: string;
                  category?: string;
                  day?: number;
                  timeSlot?: string;
                  suggestedDuration?: string;
                  duration?: string;
                  address?: string;
                  lat?: number;
                  lng?: number;
                },
                idx: number,
              ) => ({
                id: s.id || `stop-${idx}`,
                name: s.name,
                category: s.category || "TARİHİ YER",
                time: `${s.day || 1}. gün · ${s.timeSlot || "Sıra " + (idx + 1)}`,
                duration: s.suggestedDuration || s.duration || "Süre belirtilmedi",
                address: s.address || "",
                lat: s.lat ?? 0,
                lng: s.lng ?? 0,
              }),
            );

            const lastBot = syncedMessages.filter((m) => m.sender === "bot").pop();
            if (lastBot) {
              lastBot.routePlan = {
                title: r.title || `${r.destination} Rotası`,
                dayTitle: `${r.estimatedDays || 1} Günlük ${r.destination || ""} Planı`,
                stops: botStops.map((bs) => ({
                  time: bs.time,
                  name: bs.name,
                  desc: bs.category,
                  walk: "",
                })),
                totalKm: "Mesafe hesaplanmadı",
                totalWalkTime: "Yürüyüş süresi hesaplanmadı",
                coverImage:
                  "https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=600&auto=format&fit=crop&q=80",
                stopPills: botStops.map((bs) => bs.name.slice(0, 14)),
                stopsData: botStops,
              };
            }
            // Sync with local tripStore
            tripStore.loadRouteFromExternal(r.title || `${r.destination} Rotası`, botStops);
          }

          if (syncedMessages.length > 0) {
            setMessages(syncedMessages);
          }
        }
      } catch (err) {
        console.warn("[AIScreen] Session sync check failed:", err);
      }
    }
    syncBackendSession();
  }, []);

  // ── Start new chat — truly reset everything ───────────────────────────────
  const handleNewChat = useCallback(() => {
    if (sending.current) return;
    pendingTurn.current = null;

    // Archive current chat if it has messages
    setMessages((prevMsgs) => {
      if (prevMsgs.length > 1) {
        const firstUserText = prevMsgs.find((m) => m.sender === "user")?.text || "Seyahat Sohbeti";
        setPastConversations((prevHistory) => [
          {
            id: conversationId,
            title: firstUserText.length > 28 ? `${firstUserText.slice(0, 28)}...` : firstUserText,
            date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            messages: prevMsgs,
          },
          ...prevHistory.filter((h) => h.id !== conversationId),
        ]);
      }
      return prevMsgs;
    });

    const newConvId = `conv-${Date.now()}`;
    setConversationId(newConvId);
    setMessageHistory([]);
    setTrainingConsent(false);
    setDetectedCity(undefined);
    setLoadedRouteDetails(null);
    setInputText("");
    setConversationState(undefined);

    const welcomeMsg: ChatMessageItem = {
      id: `bot-welcome-${Date.now()}`,
      sender: "bot",
      text: "Merhaba! MapsBridge Seyahat Asistanına hoş geldiniz.\n\nKişiselleştirilmiş, zikzaksız seyahat rotaları üretiyorum. Aşağıdaki popüler planlardan birine dokunabilir veya gitmek istediğiniz şehri yazabilirsiniz:",
      time: nowTime(),
      quickOptions: [
        {
          label: "Roma 2 Günlük Tarih & Lezzet",
          prompt:
            "Roma için 2 günlük yürüyerek gezilebilecek, lezzet duraklı ve zikzaksız bir rota hazırla",
        },
        {
          label: "Paris Sanat & Butik Turu",
          prompt: "Paris için 3 günlük Louvre, Montmartre ve yerel kafe duraklı bir plan hazırla",
        },
        {
          label: "İstanbul Boğaz & Tarihi Yarımada",
          prompt: "İstanbul için 1 günlük Sultanahmet, Galata ve Karaköy lezzet rotası hazırla",
        },
        {
          label: "Barselona Gaudi & Sahil",
          prompt:
            "Barselona için 2 günlük Sagrada Familia, Park Güell ve sahil yürüyüşü rotası planla",
        },
        { label: "Roma Acil Durum Ajanı", prompt: "Roma'da pasaportumu kaybettim ne yapmalıyım?" },
      ],
    };
    setMessages([welcomeMsg]);

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 150);
  }, [conversationId]);

  // Active Camera attachment
  const handleAttachPhoto = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const userImgMsg: ChatMessageItem = {
          id: `user-img-${Date.now()}`,
          sender: "user",
          text: "📷 [Fotoğraf Eklendi]: Bu mekan hakkında bana detaylı bilgi verir misin ve seyahat rotama eklemeli miyim?",
          time: nowTime(),
        };
        setMessages((prev) => [...prev, userImgMsg]);
        handleSendPrompt("Görseldeki mekan ve gezi detayları hakkında bilgi ver");
      }
    } catch {
      Alert.alert("Fotoğraf", "Fotoğraf galerisi açılamadı.");
    }
  };

  const handleToggleVoice = () => {
    Alert.alert("Sesli Asistan", "Sesli komut özelliği yakında kullanıma açılacak.");
  };

  // Add stop details (flight, transport, hotel, meals)
  const handleAddRouteDetail = (type: "flight" | "transport" | "hotel" | "meals") => {
    if (!loadedRouteDetails) return;

    const prompts: Record<string, string> = {
      flight: "Uçak bileti bilgisi girin (örn: TK1234, 15:30, İstanbul-Roma)",
      transport: "Ulaşım bilgisi girin (örn: Havaist, taksi, araç kiralama)",
      hotel: "Otel bilgisi girin (örn: Hotel Artis, Via Rasella, 180€/gece)",
      meals: "Yemek rezervasyonu girin (örn: Da Enzo, 19:30, 4 kişi)",
    };

    Alert.prompt(
      prompts[type],
      "",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Kaydet",
          onPress: (value: string | undefined) => {
            if (value) {
              setLoadedRouteDetails((prev) => {
                if (!prev) return null;
                if (type === "meals") {
                  return { ...prev, meals: [...(prev.meals || []), value] };
                }
                return { ...prev, [type]: value };
              });
            }
          },
        },
      ],
      "plain-text",
    );
  };

  // Optimize loaded route
  const handleOptimizeLoadedRoute = () => {
    tripStore.optimizeRoute();
    const updatedRoute = tripStore.getActiveRoute();
    setLoadedRouteDetails((prev) => (prev ? { ...prev, stops: updatedRoute.stops } : null));
    Alert.alert("Rota Optimize Edildi", "Durak sırası en kısa yürüme mesafesine göre düzenlendi.");
  };

  const handleSendPrompt = async (promptText: string) => {
    const text = promptText.trim();
    if (!text || sending.current) return;
    sending.current = true;

    const userMsg: ChatMessageItem = {
      id: `user-${Date.now()}`,
      sender: "user",
      text,
      time: nowTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsTyping(true);

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      setOrchestrationStatus("İsteğin ve sohbet geçmişin değerlendiriliyor...");
      const turn =
        pendingTurn.current?.text === text
          ? pendingTurn.current
          : { text, requestId: generateUUID(), trainingConsent };
      pendingTurn.current = turn;
      const res = await aiService.ask(text, {
        conversationId,
        history: messageHistory.slice(-6),
        trainingConsent: turn.trainingConsent,
        requestId: turn.requestId,
        conversationState,
      });
      pendingTurn.current = null;
      setTrainingConsent(false);
      setMessageHistory((previous) => [
        ...previous,
        { role: "user", content: text },
        { role: "assistant", content: res.answer },
      ]);

      // Persist updated conversation state for next turn (slot tracking + focus continuity)
      if (res.conversationState) {
        setConversationState(res.conversationState);
      }

      // Apply itinerary mutations to tripStore
      if (res.itineraryActions && res.itineraryActions.length > 0) {
        for (const action of res.itineraryActions) {
          if (action.action === "remove" && action.placeId) {
            tripStore.removeStop(action.placeId);
          } else if (action.action === "reorder" && action.newOrder) {
            // Translate ID-order array to index swaps by applying each position sequentially
            action.newOrder.forEach((id, targetIdx) => {
              const currentIdx = tripStore.getActiveRoute().stops.findIndex((s) => s.id === id);
              if (currentIdx !== -1 && currentIdx !== targetIdx) {
                tripStore.reorderStops(currentIdx, targetIdx);
              }
            });
          }
          // add/move_to_day handled when route plan card loads into tripStore
        }
      }

      // Update detected city from focus if available
      if (res.currentFocus?.placeLabel) {
        setDetectedCity(res.currentFocus.placeLabel);
      } else if (res.currentFocus?.scope === "trip" && !detectedCity) {
        // keep previous detectedCity
      }

      const combinedCards: RichAgentCard[] = [];

      // 1. Bedrock Transit & Stay Sub-Agent
      if (res.stayAndTransit) {
        const bullets: string[] = [];
        if (res.stayAndTransit.lodgingSummary)
          bullets.push(`• ${res.stayAndTransit.lodgingSummary}`);
        if (res.stayAndTransit.transitSummary)
          bullets.push(`• ${res.stayAndTransit.transitSummary}`);
        if (res.stayAndTransit.neighborhoodTips)
          bullets.push(`• ${res.stayAndTransit.neighborhoodTips}`);
        if (bullets.length > 0) {
          combinedCards.push({
            title: "Konaklama & Ulaşım (Bedrock)",
            emoji: "",
            bullets,
          });
        }
      }

      // 2. Bedrock Local Discovery & Food Sub-Agent
      if (res.discovery) {
        const bullets: string[] = [];
        if (res.discovery.foodHighlights) bullets.push(`• ${res.discovery.foodHighlights}`);
        if (res.discovery.hiddenGems) bullets.push(`• ${res.discovery.hiddenGems}`);
        if (res.discovery.culturalTips) bullets.push(`• ${res.discovery.culturalTips}`);
        if (bullets.length > 0) {
          combinedCards.push({
            title: "Keşif & Lezzetler (Bedrock)",
            emoji: "",
            bullets,
          });
        }
      }

      // 3. Bedrock Emergency & Safety Sub-Agent
      if (res.emergency) {
        const bullets: string[] = [];
        if (res.emergency.emergencyNumbers) bullets.push(`• ${res.emergency.emergencyNumbers}`);
        if (res.emergency.embassy) bullets.push(`• ${res.emergency.embassy}`);
        if (bullets.length > 0) {
          combinedCards.push({
            title: "Güvenlik & Konsolosluk",
            emoji: "",
            bullets,
          });
        }
      }

      // 4. Flight Prices (Travelpayouts cache)
      if (
        res.flightPrices &&
        res.flightPrices.source !== "unavailable" &&
        res.flightPrices.deals.length > 0
      ) {
        const now = new Date().toISOString();
        const validDeals = res.flightPrices.deals.filter((d) => d.expiresAt > now);
        if (validDeals.length > 0) {
          const bullets: string[] = [
            `En ucuz: ${validDeals[0].price} ${validDeals[0].currency}${validDeals[0].departureMonth ? " — " + validDeals[0].departureMonth : ""}`,
          ];
          if (validDeals.length > 1) bullets.push(`+${validDeals.length - 1} daha fazla seçenek`);
          bullets.push(res.flightPrices.note);
          combinedCards.push({ title: "Uçuş Fiyatları (Travelpayouts)", emoji: "", bullets });
        }
      }

      // 5. Travel Advisory (FCDO)
      if (res.travelAdvisory) {
        const levelEmoji =
          res.travelAdvisory.level === "normal"
            ? ""
            : res.travelAdvisory.level === "some_risk"
              ? " ⚠️"
              : res.travelAdvisory.level === "avoid_non_essential"
                ? " 🟠"
                : " 🔴";
        const bullets: string[] = [
          `Düzey: ${res.travelAdvisory.levelLabel}${levelEmoji}`,
          res.travelAdvisory.summary.slice(0, 200),
        ];
        if (res.travelAdvisory.changeNote)
          bullets.push(`Son değişiklik: ${res.travelAdvisory.changeNote}`);
        bullets.push(res.travelAdvisory.disclaimer);
        combinedCards.push({
          title: `Seyahat Tavsiyesi — ${res.travelAdvisory.country}`,
          emoji: "",
          bullets,
        });
      }

      // 6. Bedrock Agents Execution Status Badge
      if (res.agentsInvolved && res.agentsInvolved.length > 0) {
        const agentList = res.agentsInvolved.map((a) => a.agentName).join(" • ");
        combinedCards.push({
          title: "AWS Bedrock Agent Core",
          emoji: "",
          bullets: [
            `Çalıştırılan Ajanlar: ${agentList}`,
            `Model: ${res.modelUsed || "Bedrock Supervisor"}`,
          ],
        });
      }

      let routePlanData: ChatMessageItem["routePlan"] | undefined;
      if (res.isRoutePlan && res.stops && res.stops.length > 0) {
        const botStops: TripStop[] = res.stops.map((s, idx) => ({
          id: s.id || `ai-${Date.now()}-${idx}`,
          name: s.name,
          category: s.category || "TARİHİ YER",
          time: `${s.day || 1}. gün · ${s.timeSlot || "Sıra " + (idx + 1)}`,
          duration: s.duration || "Süre belirtilmedi",
          address: s.address || "",
          lat: s.lat,
          lng: s.lng,
        }));
        routePlanData = {
          title: res.routeTitle || `${detectedCity || "Seyahat"} — Akıllı Rota`,
          dayTitle: `${res.estimatedDays || 1} Günlük ${detectedCity || ""} Planı`,
          stops: botStops.map((bs) => ({
            time: bs.time,
            name: bs.name,
            desc: bs.category,
            walk: "",
          })),
          totalKm:
            typeof res.totalDistanceKm === "number"
              ? `${res.totalDistanceKm.toFixed(1)} km (kuş uçuşu)`
              : "Mesafe hesaplanmadı",
          totalWalkTime: "Yürüyüş süresi hesaplanmadı",
          coverImage:
            "https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=600&auto=format&fit=crop&q=80",
          stopPills: botStops.map((bs) => bs.name.slice(0, 14)),
          stopsData: botStops,
        };

        // Synchronize immediately with TripStore so map view reflects the AI route
        tripStore.loadRouteFromExternal(routePlanData.title, botStops);

        // Save to backend routes API
        routeService.createRoute(routePlanData.title, res.stops).catch((e: unknown) => {
          console.warn("[AIScreen] Background route save note:", e);
        });
      }

      // Chip priority: backend suggestedChips > clarification quickOptions > suggestedQuestions
      const quickOptions: Array<{ label: string; prompt: string }> | undefined =
        res.suggestedChips && res.suggestedChips.length > 0
          ? res.suggestedChips.slice(0, 4).map((c) => ({ label: c.label, prompt: c.prompt }))
          : res.clarification?.quickOptions && res.clarification.quickOptions.length > 0
            ? res.clarification.quickOptions.map((opt) =>
                typeof opt === "string" ? { label: opt, prompt: opt } : opt,
              )
            : res.suggestedQuestions && res.suggestedQuestions.length > 0
              ? res.suggestedQuestions.map((q) => ({ label: q, prompt: q }))
              : undefined;

      // Collect feasibility error/warning messages for inline display
      const feasibilityWarnings: string[] | undefined =
        res.feasibility && !res.feasibility.isValid && res.feasibility.issues.length > 0
          ? res.feasibility.issues
              .filter((i) => i.severity === "error" || i.severity === "warning")
              .map((i) => i.message)
          : undefined;

      const botMsg: ChatMessageItem = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: res.answer,
        time: nowTime(),
        routePlan: routePlanData,
        agentCards: combinedCards.length > 0 ? combinedCards : undefined,
        quickOptions,
        feasibilityWarnings:
          feasibilityWarnings && feasibilityWarnings.length > 0 ? feasibilityWarnings : undefined,
        assumptions: res.assumptions && res.assumptions.length > 0 ? res.assumptions : undefined,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      if (err?.status && err.status < 500 && ![408, 409].includes(err.status))
        pendingTurn.current = null;
      const errMsg: ChatMessageItem = {
        id: `bot-err-${Date.now()}`,
        sender: "bot",
        text:
          err?.message ||
          "Yanıt alınamadı. Aynı mesajı tekrar göndererek sonucu kontrol edebilirsin.",
        time: nowTime(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      sending.current = false;
      setIsTyping(false);
      setOrchestrationStatus("");
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleOpenRouteOnMap = (routePlan: ChatMessageItem["routePlan"]) => {
    if (!routePlan) return;
    tripStore.loadRouteFromExternal(routePlan.title, routePlan.stopsData);
    onOpenMap();
  };

  const handleSaveRouteToPlan = (routePlan: ChatMessageItem["routePlan"]) => {
    if (!routePlan) return;
    tripStore.loadRouteFromExternal(routePlan.title, routePlan.stopsData);
    Alert.alert(
      "Seyahat Masasına Kaydedildi",
      `"${routePlan.title}" Planım sekmesine ve seyahat masanıza başarıyla aktarıldı!`,
    );
  };

  return (
    <Screen style={styles.container}>
      {/* Single Unified Redesigned Header */}
      <View style={styles.aiSimpleHeader}>
        <View style={styles.aiIdentityRow}>
          {/* Back / Burger Menu Button for Past Conversations */}
          <TouchableOpacity
            style={styles.historyDrawerBtn}
            onPress={() => setShowHistoryModal(true)}
            activeOpacity={0.7}
          >
            <Text
              maxFontSizeMultiplier={tokens.font.maxScale.body}
              style={styles.historyDrawerIcon}
            >
              ☰
            </Text>
          </TouchableOpacity>

          <View style={styles.aiAvatarWrap}>
            <RobotIcon size={20} color={tokens.color.successStrong} />
          </View>
          <View>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.aiName}>
              MapsBridge AI
            </Text>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.aiMinimalSub}>
              Seyahat Asistanı
            </Text>
          </View>
        </View>

        {/* Right-aligned New Chat Button - No other icons next to it */}
        <TouchableOpacity
          style={styles.newChatHeaderBtn}
          onPress={handleNewChat}
          activeOpacity={0.7}
        >
          <Text
            maxFontSizeMultiplier={tokens.font.maxScale.body}
            style={styles.newChatHeaderBtnText}
          >
            + Yeni Sohbet
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Chat Message Stream - Quick suggestions removed per user request */}
        <ScrollView
          ref={scrollRef}
          style={styles.chatScroll}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => {
            const isUser = msg.sender === "user";

            if (isUser) {
              return (
                <View key={msg.id} style={styles.userMsgWrapper}>
                  <View style={styles.userBubble}>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.userText}>
                      {msg.text}
                    </Text>
                  </View>
                  <View style={styles.metaTimeRow}>
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={styles.metaTimeText}
                    >
                      {msg.time}
                    </Text>
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={{ fontSize: 11, color: tokens.color.accent }}
                    >
                      ✓✓
                    </Text>
                  </View>
                </View>
              );
            }

            return (
              <View key={msg.id} style={styles.botMsgWrapper}>
                {/* Bot Label */}
                <View style={styles.botHeaderRow}>
                  <View style={styles.sparkleWrap}>
                    <SparkIcon size={12} color={tokens.color.accent} />
                  </View>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.botLabel}>
                    MAPSBRIDGE ATELIER BOT
                  </Text>
                </View>

                {/* Bot Content Box */}
                <View style={styles.botCard}>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.botIntroText}
                  >
                    {msg.text}
                  </Text>

                  {/* Route Plan Structured Details */}
                  {msg.routePlan && (
                    <View style={styles.routeStructureBox}>
                      <View style={styles.routeStructureHead}>
                        <Text
                          maxFontSizeMultiplier={tokens.font.maxScale.body}
                          style={styles.routeStructureTitle}
                        >
                          {msg.routePlan.dayTitle}
                        </Text>
                        <View style={styles.zigzagBadge}>
                          <Text
                            maxFontSizeMultiplier={tokens.font.maxScale.compact}
                            style={styles.zigzagBadgeText}
                          >
                            ZİKZAKSIZ
                          </Text>
                        </View>
                      </View>

                      {/* Stops sequencing list */}
                      <View style={styles.routeStopsSequence}>
                        {msg.routePlan.stops.map((st, sIdx) => (
                          <View key={sIdx} style={styles.seqItemWrap}>
                            <View style={styles.seqItemRow}>
                              <View style={styles.seqBullet} />
                              <View style={{ flex: 1 }}>
                                <Text
                                  maxFontSizeMultiplier={tokens.font.maxScale.body}
                                  style={styles.seqTimeTitle}
                                >
                                  {st.time} • {st.name}
                                </Text>
                                <Text
                                  maxFontSizeMultiplier={tokens.font.maxScale.body}
                                  style={styles.seqDesc}
                                >
                                  {st.desc}
                                </Text>
                              </View>
                            </View>

                            {st.walk ? (
                              <View style={styles.seqWalkRow}>
                                <WalkIcon size={12} color={tokens.color.successStrong} />
                                <Text
                                  maxFontSizeMultiplier={tokens.font.maxScale.body}
                                  style={styles.seqWalkText}
                                >
                                  {st.walk}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        ))}
                      </View>

                      {/* Distance & Time summary ribbon */}
                      <View style={styles.statsRibbon}>
                        <Text
                          maxFontSizeMultiplier={tokens.font.maxScale.body}
                          style={styles.ribbonItem}
                        >
                          Mesafe: {msg.routePlan.totalKm}
                        </Text>
                        <Text
                          maxFontSizeMultiplier={tokens.font.maxScale.body}
                          style={styles.ribbonItem}
                        >
                          Yürüme: {msg.routePlan.totalWalkTime}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Visual Route Preview Card */}
                  {msg.routePlan && (
                    <View style={styles.previewCard}>
                      <View style={styles.previewImageWrap}>
                        <Image
                          source={{ uri: msg.routePlan.coverImage }}
                          style={styles.previewImage}
                          resizeMode="cover"
                        />
                        <View style={styles.previewBadge}>
                          <Text
                            maxFontSizeMultiplier={tokens.font.maxScale.compact}
                            style={styles.previewBadgeText}
                          >
                            CANLI ROTA ÖNİZLEMESİ
                          </Text>
                        </View>
                        <View style={styles.previewOverlayText}>
                          <Text
                            maxFontSizeMultiplier={tokens.font.maxScale.body}
                            style={styles.previewTitle}
                          >
                            {msg.routePlan.title}
                          </Text>
                          <Text
                            maxFontSizeMultiplier={tokens.font.maxScale.body}
                            style={styles.previewSub}
                          >
                            {msg.routePlan.stops.length} optimize durak • 0 zikzak
                          </Text>
                        </View>
                      </View>

                      {/* Stop Pills */}
                      <View style={styles.previewPillsRow}>
                        {msg.routePlan.stopPills.map((pill, pIdx) => (
                          <View key={pIdx} style={styles.previewPill}>
                            <View style={styles.pNumCircle}>
                              <Text
                                maxFontSizeMultiplier={tokens.font.maxScale.body}
                                style={styles.pNumText}
                              >
                                {pIdx + 1}
                              </Text>
                            </View>
                            <Text
                              maxFontSizeMultiplier={tokens.font.maxScale.body}
                              style={styles.pText}
                              numberOfLines={1}
                            >
                              {pill}
                            </Text>
                          </View>
                        ))}
                      </View>

                      {/* Working Action CTAs */}
                      <View style={styles.previewCtaStack}>
                        <TouchableOpacity
                          style={styles.openMapBtn}
                          onPress={() => handleOpenRouteOnMap(msg.routePlan)}
                          activeOpacity={0.8}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                            }}
                          >
                            <DirectionsIcon size={14} color={tokens.color.textBrand} />
                            <Text
                              maxFontSizeMultiplier={tokens.font.maxScale.body}
                              style={styles.openMapText}
                            >
                              Haritada Aç & Düzenle
                            </Text>
                          </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.savePlanBtn}
                          onPress={() => handleSaveRouteToPlan(msg.routePlan)}
                          activeOpacity={0.8}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                            }}
                          >
                            <BookmarkIcon size={14} color={tokens.color.successStrong} />
                            <Text
                              maxFontSizeMultiplier={tokens.font.maxScale.body}
                              style={styles.savePlanText}
                            >
                              Seyahat Masama Kaydet
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Sub-Agent Cards */}
                  {msg.agentCards && msg.agentCards.length > 0 && (
                    <View style={{ marginTop: 12, gap: 10 }}>
                      {msg.agentCards.map((card, cIdx) => (
                        <View
                          key={cIdx}
                          style={{
                            backgroundColor: tokens.color.surfaceInverseStrong,
                            borderWidth: 1,
                            borderColor: tokens.color.onAccent,
                            borderRadius: 12,
                            padding: 12,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                              marginBottom: 6,
                            }}
                          >
                            <SparkIcon size={14} color={tokens.color.accent} />
                            <Text
                              maxFontSizeMultiplier={tokens.font.maxScale.body}
                              style={{
                                color: tokens.color.neutral200,
                                fontWeight: "700",
                                fontSize: 13,
                              }}
                            >
                              {card.title}
                            </Text>
                          </View>
                          {card.bullets.map((b, bIdx) => (
                            <Text
                              maxFontSizeMultiplier={tokens.font.maxScale.body}
                              key={bIdx}
                              style={{
                                color: tokens.color.neutral400,
                                fontSize: 12,
                                lineHeight: 18,
                                marginTop: 2,
                              }}
                            >
                              {b}
                            </Text>
                          ))}
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Feasibility warnings (§11.1) */}
                  {msg.feasibilityWarnings && msg.feasibilityWarnings.length > 0 && (
                    <View
                      style={{
                        marginTop: 10,
                        backgroundColor: withAlpha(tokens.color.warningIcon, 0.1),
                        borderLeftWidth: 3,
                        borderLeftColor: tokens.color.warningIcon,
                        borderRadius: 8,
                        padding: 10,
                      }}
                    >
                      <Text
                        maxFontSizeMultiplier={tokens.font.maxScale.body}
                        style={{
                          color: tokens.color.warningIcon,
                          fontSize: 12,
                          fontWeight: "700",
                          marginBottom: 4,
                        }}
                      >
                        ⚠ Plan Uyarıları
                      </Text>
                      {msg.feasibilityWarnings.map((w, wIdx) => (
                        <Text
                          maxFontSizeMultiplier={tokens.font.maxScale.body}
                          key={wIdx}
                          style={{
                            color: tokens.color.warningBorder,
                            fontSize: 11,
                            lineHeight: 16,
                            marginTop: 2,
                          }}
                        >
                          • {w}
                        </Text>
                      ))}
                    </View>
                  )}

                  {/* Visible assumptions (§7) */}
                  {msg.assumptions && msg.assumptions.length > 0 && (
                    <View
                      style={{
                        marginTop: 8,
                        backgroundColor: withAlpha(tokens.dataPalette.indigo, 0.08),
                        borderLeftWidth: 3,
                        borderLeftColor: tokens.dataPalette.indigo,
                        borderRadius: 8,
                        padding: 10,
                      }}
                    >
                      <Text
                        maxFontSizeMultiplier={tokens.font.maxScale.body}
                        style={{
                          color: tokens.dataPalette.indigo,
                          fontSize: 11,
                          fontWeight: "700",
                          marginBottom: 3,
                        }}
                      >
                        ℹ Varsayımlar
                      </Text>
                      {msg.assumptions.map((a, aIdx) => (
                        <Text
                          maxFontSizeMultiplier={tokens.font.maxScale.body}
                          key={aIdx}
                          style={{
                            color: tokens.color.infoBorder,
                            fontSize: 11,
                            lineHeight: 16,
                            marginTop: 2,
                          }}
                        >
                          • {a}
                        </Text>
                      ))}
                    </View>
                  )}

                  {/* Focus-aware context chips / Quick Options */}
                  {msg.quickOptions && msg.quickOptions.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                      {msg.quickOptions.map((opt, oIdx) => (
                        <TouchableOpacity
                          key={oIdx}
                          style={{
                            backgroundColor: withAlpha(tokens.color.accent, 0.12),
                            borderWidth: 1,
                            borderColor: tokens.color.accent,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 16,
                          }}
                          onPress={() => handleSendPrompt(opt.prompt)}
                          activeOpacity={0.7}
                        >
                          <Text
                            maxFontSizeMultiplier={tokens.font.maxScale.body}
                            style={{ color: tokens.color.accent, fontSize: 12, fontWeight: "600" }}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Feedback / Meta */}
                  <View style={styles.botFooterRow}>
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={styles.engineVersion}
                    >
                      AWS Bedrock & Agent Core • MapsBridge Engine v2.4
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}

          {isTyping && (
            <View style={styles.botMsgWrapper}>
              <View style={styles.botHeaderRow}>
                <View style={styles.sparkleWrap}>
                  <SparkIcon size={12} color={tokens.color.accent} />
                </View>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.botLabel}>
                  MAPSBRIDGE ATELIER BOT
                </Text>
              </View>
              <View style={[styles.botCard, { paddingVertical: 14 }]}>
                <ThinkingBubble status={THINKING_STEPS[thinkingStepIndex]} />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Input Area */}
        <View style={styles.inputAreaWrapper}>
          <View style={styles.inputPillBox}>
            <TouchableOpacity
              style={styles.inputActionIcon}
              onPress={handleAttachPhoto}
              accessibilityLabel="Fotoğraf Ekle"
            >
              <CameraIcon size={18} color={tokens.color.successStrong} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.inputActionIcon}
              onPress={handleToggleVoice}
              accessibilityLabel="Sesle Konuş"
            >
              <MicIcon size={18} color={tokens.color.successStrong} />
            </TouchableOpacity>

            <TextInput
              placeholder="Seyahat hayalini yaz (örn: Kyoto 4 gün)..."
              placeholderTextColor={tokens.color.textSubtle}
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => handleSendPrompt(inputText)}
              maxLength={2000}
              returnKeyType="send"
            />

            <TouchableOpacity
              style={styles.sendBtn}
              onPress={() => handleSendPrompt(inputText)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Gönder"
              accessibilityHint="Tercih soruları ücretsiz · Sohbet 1 kredi · Rota oluşturma / düzenleme 5 kredi"
            >
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.sendBtnText}>
                ➔
              </Text>
            </TouchableOpacity>
          </View>
          {/* S22 (web ile parite): mesaj başı maliyet sunucuda belirlenir, gönder düğmesinde sabit
              kredi rozeti yok; işlem başı maliyetler not olarak gösterilir. */}
          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.costNote}>
            Tercih soruları ücretsiz · Sohbet 1 kredi · Rota oluşturma / düzenleme 5 kredi
          </Text>
        </View>
      </KeyboardAvoidingView>

      {/* Route Loader Modal */}
      <ModalFrame
        visible={showRouteLoaderModal}
        variant="bottomSheet"
        animation="slide"
        onRequestClose={() => setShowRouteLoaderModal(false)}
        style={styles.routeLoaderBackdrop}
      >
        <View style={styles.routeLoaderCard}>
          <View style={styles.routeLoaderHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <DirectionsIcon size={16} color={tokens.color.textBrand} />
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={styles.routeLoaderTitle}
              >
                Rotamı Düzenle
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowRouteLoaderModal(false)} activeOpacity={0.7}>
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={styles.routeLoaderClose}
              >
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          {loadedRouteDetails && (
            <ScrollView style={styles.routeLoaderContent}>
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={styles.routeLoaderRouteTitle}
              >
                {loadedRouteDetails.title}
              </Text>
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.compact}
                style={styles.routeLoaderStopCount}
              >
                {loadedRouteDetails.stops.length} durak
              </Text>

              {/* Add Details Buttons */}
              <View style={styles.routeDetailButtons}>
                <TouchableOpacity
                  style={styles.routeDetailBtn}
                  onPress={() => handleAddRouteDetail("flight")}
                >
                  <DirectionsIcon size={18} color={tokens.color.successStrong} />
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.routeDetailBtnText}
                  >
                    Uçak
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.routeDetailBtn}
                  onPress={() => handleAddRouteDetail("transport")}
                >
                  <CarIcon size={18} color={tokens.color.successStrong} />
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.routeDetailBtnText}
                  >
                    Ulaşım
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.routeDetailBtn}
                  onPress={() => handleAddRouteDetail("hotel")}
                >
                  <HotelIcon size={18} color={tokens.color.successStrong} />
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.routeDetailBtnText}
                  >
                    Otel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.routeDetailBtn}
                  onPress={() => handleAddRouteDetail("meals")}
                >
                  <FoodIcon size={18} color={tokens.color.successStrong} />
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.routeDetailBtnText}
                  >
                    Yemek
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Added Details Display */}
              {loadedRouteDetails.flight && (
                <View style={styles.addedDetailItem}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <DirectionsIcon size={12} color={tokens.color.successStrong} />
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={styles.addedDetailLabel}
                    >
                      Uçak
                    </Text>
                  </View>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.addedDetailValue}
                  >
                    {loadedRouteDetails.flight}
                  </Text>
                </View>
              )}
              {loadedRouteDetails.transport && (
                <View style={styles.addedDetailItem}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <CarIcon size={12} color={tokens.color.successStrong} />
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={styles.addedDetailLabel}
                    >
                      Ulaşım
                    </Text>
                  </View>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.addedDetailValue}
                  >
                    {loadedRouteDetails.transport}
                  </Text>
                </View>
              )}
              {loadedRouteDetails.hotel && (
                <View style={styles.addedDetailItem}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <HotelIcon size={12} color={tokens.color.successStrong} />
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={styles.addedDetailLabel}
                    >
                      Otel
                    </Text>
                  </View>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.addedDetailValue}
                  >
                    {loadedRouteDetails.hotel}
                  </Text>
                </View>
              )}
              {loadedRouteDetails.meals && loadedRouteDetails.meals.length > 0 && (
                <View style={styles.addedDetailItem}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <FoodIcon size={12} color={tokens.color.successStrong} />
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={styles.addedDetailLabel}
                    >
                      Yemekler
                    </Text>
                  </View>
                  {loadedRouteDetails.meals.map((meal, idx) => (
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      key={idx}
                      style={styles.addedDetailValue}
                    >
                      • {meal}
                    </Text>
                  ))}
                </View>
              )}

              {/* Optimize Button */}
              <TouchableOpacity
                style={styles.optimizeRouteBtn}
                onPress={handleOptimizeLoadedRoute}
                activeOpacity={0.8}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <SparkIcon size={16} color={tokens.color.onPrimary} />
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.optimizeRouteBtnText}
                  >
                    Rotayı Optimize Et
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Open on Map Button */}
              <TouchableOpacity
                style={styles.openMapBtn}
                onPress={() => {
                  setShowRouteLoaderModal(false);
                  onOpenMap();
                }}
                activeOpacity={0.8}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <MapIcon size={16} color={tokens.color.textBrand} />
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.openMapText}
                  >
                    Haritada Gör
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </ModalFrame>

      {/* Agents Modal */}
      <ModalFrame
        visible={showAgentsModal}
        variant="bottomSheet"
        animation="slide"
        onRequestClose={() => setShowAgentsModal(false)}
        style={styles.agentsBackdrop}
      >
        <View style={styles.agentsCard}>
          <View style={styles.agentsHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <RobotIcon size={16} color={tokens.color.textBrand} />
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.agentsTitle}>
                Seyahat Agentleri
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowAgentsModal(false)} activeOpacity={0.7}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.agentsClose}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.agentsContent}>
            {/* Active Agents */}
            <Text
              maxFontSizeMultiplier={tokens.font.maxScale.body}
              style={styles.agentsSectionTitle}
            >
              Aktif Agentler
            </Text>
            {agents
              .filter((a) => a.isActive)
              .map((agent) => (
                <TouchableOpacity
                  key={agent.id}
                  style={styles.agentCard}
                  onPress={() => {
                    setSelectedAgent(agent);
                    // Show agent-specific actions
                    Alert.alert(agent.title, agent.description, [
                      { text: "Kapat", style: "cancel" },
                      {
                        text: "Devre Dışı Bırak",
                        style: "destructive",
                        onPress: () => {
                          agentService.toggleAgent(agent.id);
                          setAgents(agentService.getAgents());
                        },
                      },
                    ]);
                  }}
                  activeOpacity={0.8}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: withAlpha(tokens.color.successStrong, 0.1),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <RobotIcon size={20} color={tokens.color.successStrong} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={styles.agentName}
                    >
                      {agent.title}
                    </Text>
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={styles.agentDesc}
                    >
                      {agent.description}
                    </Text>
                    {agent.reminders.length > 0 && (
                      <Text
                        maxFontSizeMultiplier={tokens.font.maxScale.body}
                        style={styles.agentReminders}
                      >
                        {agent.reminders.filter((r) => !r.completed).length} hatırlatma
                      </Text>
                    )}
                  </View>
                  <View style={styles.agentStatusActive} />
                </TouchableOpacity>
              ))}

            {/* Language Phrases Section */}
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6, marginVertical: 10 }}
            >
              <TranslateIcon size={16} color={tokens.color.textBrand} />
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={styles.agentsSectionTitle}
              >
                İngilizce Konuşma Yardımcısı
              </Text>
            </View>
            <View style={styles.phrasesContainer}>
              {["emergency", "transport", "accommodation", "restaurant", "general"].map(
                (category) => (
                  <TouchableOpacity
                    key={category}
                    style={styles.phraseCategoryBtn}
                    onPress={() => {
                      const categoryPhrases = agentService.getPhrasesByCategory(
                        category as LanguagePhrase["category"],
                      );
                      Alert.alert(
                        category.charAt(0).toUpperCase() + category.slice(1),
                        categoryPhrases.map((p) => `${p.phrase}\n→ ${p.translation}`).join("\n\n"),
                        [{ text: "Tamam" }],
                      );
                    }}
                  >
                    <View style={{ marginBottom: 4 }}>
                      {category === "emergency" && (
                        <AlertCircleIcon size={18} color={tokens.color.danger} />
                      )}
                      {category === "transport" && (
                        <CarIcon size={18} color={tokens.color.successStrong} />
                      )}
                      {category === "accommodation" && (
                        <HotelIcon size={18} color={tokens.color.accentSky} />
                      )}
                      {category === "restaurant" && (
                        <FoodIcon size={18} color={tokens.color.warningStrong} />
                      )}
                      {category === "general" && (
                        <TranslateIcon size={18} color={tokens.color.successStrong} />
                      )}
                    </View>
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={styles.phraseCategoryText}
                    >
                      {category === "emergency" && "Acil Durum"}
                      {category === "transport" && "Ulaşım"}
                      {category === "accommodation" && "Konaklama"}
                      {category === "restaurant" && "Restoran"}
                      {category === "general" && "Genel"}
                    </Text>
                  </TouchableOpacity>
                ),
              )}
            </View>

            {/* Emergency Contacts Quick Access */}
            <TouchableOpacity
              style={styles.emergencyQuickBtn}
              onPress={() => {
                Alert.alert(
                  "Acil Durum Numaraları",
                  "Polis: 155\nAmbulans: 112\nİtfaiye: 110\nJandarma: 156",
                  [{ text: "Tamam" }],
                );
              }}
            >
              <AlertCircleIcon size={18} color={tokens.color.danger} />
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={styles.emergencyQuickText}
              >
                Acil Durum Numaraları
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </ModalFrame>

      {/* Past Conversations History Modal (Burger Menü) */}
      <ModalFrame
        visible={showHistoryModal}
        variant="bottomSheet"
        animation="slide"
        onRequestClose={() => setShowHistoryModal(false)}
        style={styles.historyModalBackdrop}
      >
        <View style={styles.historyModalCard}>
          <View style={styles.historyModalHeader}>
            <View>
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={styles.historyModalTitle}
              >
                Sohbet Geçmişi
              </Text>
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={styles.historyModalSub}
              >
                Önceki seyahat sohbetlerinize geri dönün
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseCircle}
              onPress={() => setShowHistoryModal(false)}
            >
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={styles.modalCloseCircleText}
              >
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.historyNewChatBtn}
            onPress={() => {
              setShowHistoryModal(false);
              handleNewChat();
            }}
            activeOpacity={0.8}
          >
            <Text
              maxFontSizeMultiplier={tokens.font.maxScale.body}
              style={styles.historyNewChatBtnText}
            >
              + Sıfırdan Yeni Sohbet Başlat
            </Text>
          </TouchableOpacity>

          <ScrollView style={{ maxHeight: 360, marginTop: 12 }}>
            {pastConversations.length === 0 ? (
              <View style={styles.emptyHistoryBox}>
                <Text
                  maxFontSizeMultiplier={tokens.font.maxScale.body}
                  style={styles.emptyHistoryText}
                >
                  Henüz kaydedilmiş önceki sohbet bulunmuyor.
                </Text>
              </View>
            ) : (
              pastConversations.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.historyItemRow}
                  onPress={() => {
                    setConversationId(item.id);
                    setMessages(item.messages);
                    setShowHistoryModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={styles.historyItemTitle}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={styles.historyItemDate}
                    >
                      {item.date} • {item.messages.length} mesaj
                    </Text>
                  </View>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={{ fontSize: 16, color: tokens.color.successStrong, fontWeight: "800" }}
                  >
                    ›
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </ModalFrame>

      <ScreenTourModal screen="ai" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.bg,
  },
  aiSubHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.surfaceTint,
    backgroundColor: withAlpha(tokens.color.bg, 0.95),
  },
  aiIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  aiAvatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tokens.color.surfaceBrand,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  onlineBadge: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: tokens.color.accent,
    position: "absolute",
    bottom: 0,
    right: 0,
    borderWidth: 1.5,
    borderColor: tokens.color.neutral0,
  },
  aiName: {
    fontSize: 14,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  aiSubStatus: {
    fontSize: 11,
    color: tokens.color.link,
  },
  newChatBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: tokens.color.surfaceTint,
  },
  newChatBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: tokens.color.textBrand,
  },
  newChatHeaderBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: tokens.color.primary,
    marginRight: 4,
  },
  newChatHeaderBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: tokens.color.onPrimary,
  },
  suggestionTrackWrapper: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.surfaceTint,
  },
  suggestionTrack: {
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 8,
  },
  sugPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: tokens.color.surface,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sugPillText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: tokens.color.textMuted,
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 16,
  },
  userMsgWrapper: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    flexDirection: "column",
    alignItems: "flex-end",
  },
  userBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderTopRightRadius: 4,
    backgroundColor: tokens.color.brandHover,
    shadowColor: tokens.color.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userText: {
    fontSize: 14,
    color: tokens.color.onPrimary,
    lineHeight: 20,
  },
  metaTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    paddingRight: 4,
  },
  metaTimeText: {
    fontSize: 10,
    color: tokens.color.textSubtle,
  },
  botMsgWrapper: {
    alignSelf: "flex-start",
    width: "100%",
    flexDirection: "column",
  },
  botHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  sparkleWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tokens.color.surfaceBrand,
    alignItems: "center",
    justifyContent: "center",
  },
  botLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: tokens.color.link,
    letterSpacing: 0.8,
  },
  botCard: {
    backgroundColor: tokens.color.surface,
    borderRadius: 20,
    borderTopLeftRadius: 4,
    padding: 16,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  botIntroText: {
    fontSize: 14,
    color: tokens.color.text,
    lineHeight: 21,
  },
  routeStructureBox: {
    backgroundColor: tokens.color.surfaceBrand,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  routeStructureHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  routeStructureTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  zigzagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: tokens.color.accentA20,
  },
  zigzagBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: tokens.color.onAccent,
  },
  routeStopsSequence: {
    gap: 8,
    paddingLeft: 4,
  },
  seqItemWrap: {
    flexDirection: "column",
    gap: 2,
  },
  seqItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  seqBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.color.primary,
    marginTop: 5,
  },
  seqTimeTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: tokens.color.textBrand,
  },
  seqDesc: {
    fontSize: 11,
    color: tokens.color.textMuted,
  },
  seqWalkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 16,
    paddingVertical: 2,
  },
  seqWalkText: {
    fontSize: 10.5,
    color: tokens.color.link,
  },
  statsRibbon: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: tokens.color.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  ribbonItem: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.color.textBrand,
  },
  previewCard: {
    backgroundColor: tokens.color.surfaceTint,
    borderRadius: 16,
    overflow: "hidden",
    gap: 10,
    paddingBottom: 10,
  },
  previewImageWrap: {
    width: "100%",
    height: 120,
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: withAlpha(tokens.color.surface, 0.9),
  },
  previewBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  previewOverlayText: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: tokens.color.onPrimary,
    textShadowColor: withAlpha(tokens.color.black, 0.6),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  previewSub: {
    fontSize: 10.5,
    color: tokens.color.surfaceBrandStrong,
    textShadowColor: withAlpha(tokens.color.black, 0.6),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  previewPillsRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
  },
  previewPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: tokens.color.surface,
    borderRadius: 10,
    padding: 6,
  },
  pNumCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: tokens.color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  pNumText: {
    fontSize: 9,
    fontWeight: "800",
    color: tokens.color.onPrimary,
  },
  pText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: tokens.color.text,
    flex: 1,
  },
  previewCtaStack: {
    paddingHorizontal: 10,
    gap: 6,
  },
  openMapBtn: {
    height: 42,
    borderRadius: 21,
    backgroundColor: tokens.color.brandHover,
    alignItems: "center",
    justifyContent: "center",
  },
  openMapText: {
    fontSize: 13,
    fontWeight: "800",
    color: tokens.color.onPrimary,
  },
  savePlanBtn: {
    height: 38,
    borderRadius: 19,
    backgroundColor: tokens.color.surfaceBrand,
    alignItems: "center",
    justifyContent: "center",
  },
  savePlanText: {
    fontSize: 12,
    fontWeight: "700",
    color: tokens.color.textBrand,
  },
  botFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  feedbackIcons: {
    fontSize: 13,
  },
  engineVersion: {
    fontSize: 9.5,
    color: tokens.color.textSubtle,
  },
  inputAreaWrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: tokens.color.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.surfaceTint,
  },
  costNote: {
    marginTop: 6,
    color: tokens.color.textMuted,
    fontSize: tokens.font.size.xs,
    textAlign: "center",
  },
  inputPillBox: {
    height: 48,
    borderRadius: 24,
    backgroundColor: tokens.color.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  inputActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: tokens.color.text,
    paddingHorizontal: 8,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: tokens.color.brandHover,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnText: {
    fontSize: 14,
    color: tokens.color.onPrimary,
    fontWeight: "800",
  },
  ecoFooterText: {
    fontSize: 10,
    color: tokens.color.textSubtle,
    textAlign: "center",
    marginTop: 6,
  },
  // Simplified Header styles (no profile/search)
  aiSimpleHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.surfaceTint,
    backgroundColor: tokens.color.bg,
  },
  aiHeaderActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.color.surfaceBrand,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  headerActionBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.color.textBrand,
  },
  // Route Loader Modal styles
  routeLoaderBackdrop: {
    flex: 1,
    backgroundColor: withAlpha(tokens.color.black, 0.5),
    justifyContent: "flex-end",
  },
  routeLoaderCard: {
    backgroundColor: tokens.color.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    maxHeight: "80%",
  },
  routeLoaderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  routeLoaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: tokens.color.text,
  },
  routeLoaderClose: {
    fontSize: 20,
    color: tokens.color.textSubtle,
    padding: 4,
  },
  routeLoaderContent: {
    maxHeight: 400,
  },
  routeLoaderRouteTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: tokens.color.neutral800,
    marginBottom: 4,
  },
  routeLoaderStopCount: {
    fontSize: 13,
    color: tokens.color.textSubtle,
    marginBottom: 16,
  },
  routeDetailButtons: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  routeDetailBtn: {
    flex: 1,
    alignItems: "center",
    backgroundColor: tokens.color.bg,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  routeDetailBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.color.textSubtle,
    marginTop: 4,
  },
  addedDetailItem: {
    backgroundColor: tokens.color.bg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  addedDetailLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: tokens.color.textSubtle,
    marginBottom: 4,
  },
  addedDetailValue: {
    fontSize: 13,
    color: tokens.color.neutral800,
  },
  optimizeRouteBtn: {
    backgroundColor: tokens.color.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  optimizeRouteBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: tokens.color.onPrimary,
  },
  // Agents Modal styles
  agentsBackdrop: {
    flex: 1,
    backgroundColor: withAlpha(tokens.color.black, 0.5),
    justifyContent: "flex-end",
  },
  agentsCard: {
    backgroundColor: tokens.color.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    maxHeight: "85%",
  },
  agentsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  agentsTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: tokens.color.text,
  },
  agentsClose: {
    fontSize: 20,
    color: tokens.color.textSubtle,
    padding: 4,
  },
  agentsContent: {
    maxHeight: 500,
  },
  agentsSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.color.textSubtle,
    marginTop: 16,
    marginBottom: 12,
  },
  agentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.color.bg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  agentName: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.color.neutral800,
  },
  agentDesc: {
    fontSize: 12,
    color: tokens.color.textSubtle,
    marginTop: 2,
  },
  agentReminders: {
    fontSize: 11,
    color: tokens.color.accent,
    marginTop: 4,
  },
  agentStatusActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tokens.color.accent,
  },
  // Language Phrases styles
  phrasesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  phraseCategoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.color.surfaceBrand,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  phraseCategoryIcon: {
    fontSize: 16,
  },
  phraseCategoryText: {
    fontSize: 12,
    fontWeight: "700",
    color: tokens.color.textBrand,
  },
  // Emergency Quick Button
  emergencyQuickBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.color.dangerBg,
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: tokens.color.dangerBorder,
    gap: 12,
  },
  emergencyQuickText: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.color.danger,
  },
  // Redesigned AI Header & History Drawer
  historyDrawerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.color.surfaceBrand,
    alignItems: "center",
    justifyContent: "center",
  },
  historyDrawerIcon: {
    fontSize: 18,
    color: tokens.color.textBrand,
    fontWeight: "700",
  },
  aiMinimalSub: {
    fontSize: 11,
    color: tokens.color.successStrong,
    fontWeight: "600",
  },
  // Voice Recording Banner
  voiceRecordingBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.color.dangerBg,
    borderWidth: 1,
    borderColor: tokens.color.dangerBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    gap: 8,
  },
  pulsingRedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tokens.color.dangerSolid,
  },
  voiceRecordingText: {
    flex: 1,
    fontSize: 11.5,
    color: tokens.color.danger,
    fontWeight: "600",
  },
  voiceStopBtn: {
    backgroundColor: tokens.color.dangerSolid,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  voiceStopBtnText: {
    color: tokens.color.onPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  inputActionIconActive: {
    backgroundColor: tokens.color.dangerBg,
  },
  // Past Conversations History Modal
  historyModalBackdrop: {
    flex: 1,
    backgroundColor: withAlpha(tokens.color.black, 0.5),
    justifyContent: "flex-end",
  },
  historyModalCard: {
    backgroundColor: tokens.color.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    maxHeight: "80%",
  },
  historyModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  historyModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: tokens.color.text,
  },
  historyModalSub: {
    fontSize: 12,
    color: tokens.color.textSubtle,
    marginTop: 2,
  },
  modalCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.color.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseCircleText: {
    fontSize: 14,
    color: tokens.color.textSubtle,
    fontWeight: "700",
  },
  historyNewChatBtn: {
    backgroundColor: tokens.color.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  historyNewChatBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: tokens.color.onPrimary,
  },
  emptyHistoryBox: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyHistoryText: {
    fontSize: 13,
    color: tokens.color.neutral400,
    textAlign: "center",
  },
  historyItemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.color.bg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  historyItemTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: tokens.color.neutral800,
    marginBottom: 2,
  },
  historyItemDate: {
    fontSize: 11,
    color: tokens.color.textSubtle,
  },
});
