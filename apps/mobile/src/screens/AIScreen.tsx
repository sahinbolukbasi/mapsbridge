import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { tripStore, type ActiveRoute, type TripStop } from "../services/tripStore";
import {
  aiService,
  authService,
  generateUUID,
  type AIAskResponse,
  type MobileConversationState,
} from "../services/api";
import { storage } from "../services/storage";
import { documentStore } from "../services/documentStore";
import {
  clearDraft,
  buildGuestSummaryMessage,
  loadDraft,
  type GuestDraft,
} from "../guest/guest-draft";
import { ScreenTourModal } from "../components/ScreenTourModal";
import { RouteLoadingModal } from "../components/RouteLoadingModal";
import { ThinkingSteps } from "../components/ThinkingSteps";
import { thinkingIsRoute } from "../ui/logic/thinking-phases";
import {
  Button,
  Card,
  ComposerBar,
  ConfirmDialog,
  EmptyState,
  Icon,
  IconButton,
  MessageBubble,
  MessageLog,
  ModalFrame,
  Notice,
  QuestionCard,
  Screen,
  ScreenHeader,
  SegmentedControl,
  Skeleton,
  StopRow,
  Txt,
  useToast,
  type CardQuestions,
} from "../ui";
import { tr } from "../i18n/ui";
import { stopDay } from "../trip/days";
import { tokens } from "../theme";
import { GuestDraftSummary } from "./GuestAssistantView";
import { categoryIcon } from "../trip/category";

// Oturumlu asistan (design §5.5 J1/J3/J4, §6.1, §6.6; kararlar S10, S22; I3/I8/I10):
// - Gönder düğmesi kredi rozeti taşımaz; işlem başı maliyet girişin altında not (S22).
// - QuestionCard yalnızca sunucunun döndürdüğü yapılandırılmış seçeneklerden (clarification
//   quickOptions); seçenek yoksa kart çizilmez (I10). İstemci kredi hesaplamaz.
// - Misafir taslağı (mapsbridge.guestDraft.v1) girişten sonra özet + "Taslak rotamı oluştur ·
//   5 kredi" olarak görünür; OTOMATİK ücretli çağrı yapılmaz, kullanıcı dokununca gider.
// - Hazırlık içeriği (konaklama/ulaşım/keşif/güvenlik/uçuş fiyatları, affiliate) yalnızca ayrı
//   "Hazırlık" sekmesinde (I8); rota önerilerinin içinde değil.
// - Kredi yetersizse (402) "Planları karşılaştır" native Planlar'ı açar (J4).
export interface AIScreenProps {
  /** Cihaz sahibi (ownerFromEmail): misafir taslağı yalnızca onu ilk açan hesaba geçer. */
  owner: string;
  onOpenMap: () => void;
  onOpenPlans: () => void;
}

interface RoutePlan {
  title: string;
  stops: TripStop[];
  days: number[];
}
interface ChatItem {
  id: string;
  sender: "user" | "bot";
  text: string;
  route?: RoutePlan;
  options?: { question: string; items: Array<{ label: string; prompt: string }> };
  warnings?: string[];
  assumptions?: string[];
  upgrade?: boolean;
  /** Zaman aşımı / bağlantı hatası: aynı metin aynı requestId ile yeniden gönderilir. */
  retry?: string;
}
interface PrepCard {
  title: string;
  lines: string[];
  link?: { label: string; url: string };
  actionPrompt?: string;
}

const WELCOME: ChatItem = {
  id: "welcome",
  sender: "bot",
  text: tr("native.ai.welcome"),
};

function buildPersonalizedWelcome(displayName?: string): ChatItem {
  const clean = (displayName || "").trim();
  return {
    id: `welcome-${Date.now()}`,
    sender: "bot",
    text: clean && clean !== "guest" ? `Merhaba ${clean}, nasıl yardımcı olabilirim?` : tr("native.ai.welcome"),
  };
}

const dayOf = (stop: TripStop): number => stopDay(stop, 1);

function toStops(res: AIAskResponse): TripStop[] {
  return (res.stops ?? []).map((s, idx) => ({
    id: s.id || `ai-${Date.now()}-${idx}`,
    name: s.name,
    category: s.category || tr("native.ai.defaultCategory"),
    time: `${s.day || 1}. gün${s.timeSlot ? ` · ${s.timeSlot}` : ""}`,
    duration: s.duration || "",
    address: s.address || "",
    lat: s.lat,
    lng: s.lng,
  }));
}

function toOptions(res: AIAskResponse): ChatItem["options"] {
  const raw = res.clarification?.quickOptions ?? [];
  const items = raw
    .map((o) => (typeof o === "string" ? { label: o, prompt: o } : o))
    .filter((o) => o && o.label && o.prompt);
  if (items.length < 2) return undefined;
  return {
    question:
      res.clarification?.guidingQuestions?.[0] ||
      res.clarification?.message ||
      tr("assistant.question.pick"),
    items: items.slice(0, 4),
  };
}

/** Hazırlık sekmesi kartları (I8: affiliate ve Post-Route AgentCore Harness burada). */
function toPrep(res: AIAskResponse): PrepCard[] {
  const cards: PrepCard[] = [];
  const lines = (...v: Array<string | undefined>) => v.filter((x): x is string => !!x);
  const harness = res.postRouteHarness;
  if (harness) {
    cards.push({
      title: harness.accommodation.title,
      lines: lines(
        harness.accommodation.summary,
        `Önerilen Bölgeler: ${harness.accommodation.recommendedAreas.join(", ")}`,
        `Tercih Tipi: ${harness.accommodation.lodgingType}`,
      ),
      actionPrompt: harness.accommodation.actionPrompt,
    });
    cards.push({
      title: harness.intercityTransport.title,
      lines: lines(
        harness.intercityTransport.flightSummary,
        harness.intercityTransport.busOrTrainSummary,
      ),
      actionPrompt: harness.intercityTransport.actionPrompt,
    });
    cards.push({
      title: harness.cityTransit.title,
      lines: lines(
        harness.cityTransit.summary,
        `Ulaşım Kartı: ${harness.cityTransit.cardRecommendation}`,
        harness.cityTransit.clusterTransferNote,
      ),
      actionPrompt: harness.cityTransit.actionPrompt,
    });
    cards.push({
      title: harness.carRental.title,
      lines: lines(harness.carRental.summary),
      actionPrompt: harness.carRental.actionPrompt,
    });
    if (harness.esim?.required) {
      cards.push({
        title: harness.esim.title,
        lines: lines(harness.esim.summary, ...harness.esim.tips),
        actionPrompt: harness.esim.actionPrompt,
      });
    }
    if (harness.userTags.length) {
      cards.push({
        title: "Kişisel Profil & Seyahat Etiketleri (AgentCore Vector DB)",
        lines: [harness.userTags.join(" · ")],
      });
    }
  }
  const stay = lines(
    res.stayAndTransit?.lodgingSummary,
    res.stayAndTransit?.transitSummary,
    res.stayAndTransit?.neighborhoodTips,
  );
  if (stay.length && !harness) cards.push({ title: tr("native.prep.stay"), lines: stay });
  const disc = lines(
    res.discovery?.foodHighlights,
    res.discovery?.hiddenGems,
    res.discovery?.culturalTips,
  );
  if (disc.length) cards.push({ title: tr("native.prep.discover"), lines: disc });
  const safety = lines(res.emergency?.emergencyNumbers, res.emergency?.embassy);
  if (safety.length) cards.push({ title: tr("native.prep.safety"), lines: safety });
  if (res.travelAdvisory) {
    const a = res.travelAdvisory;
    cards.push({
      title: tr("native.prep.advisory", { country: a.country }),
      lines: lines(
        tr("native.prep.level", { level: a.levelLabel }),
        a.summary.slice(0, 280),
        a.changeNote,
        a.disclaimer,
      ),
      link: a.sourceUrl ? { label: tr("native.prep.source"), url: a.sourceUrl } : undefined,
    });
  }
  const now = new Date().toISOString();
  const deals =
    res.flightPrices && res.flightPrices.source !== "unavailable"
      ? res.flightPrices.deals.filter((d) => d.expiresAt > now)
      : [];
  if (res.flightPrices && deals.length) {
    const d = deals[0];
    cards.push({
      title: tr("ai.prepAffiliateTitle"),
      lines: lines(
        `${d.origin} → ${d.destination}: ${d.price} ${d.currency}${d.departureMonth ? ` · ${d.departureMonth}` : ""}`,
        res.flightPrices.note,
      ),
      link: d.affiliateLink ? { label: tr("native.prep.offer"), url: d.affiliateLink } : undefined,
    });
  }
  return cards;
}

export function AIScreen({ owner, onOpenMap, onOpenPlans }: AIScreenProps) {
  const [messages, setMessages] = useState<ChatItem[]>([WELCOME]);
  const [busy, setBusy] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [thinkingRoute, setThinkingRoute] = useState(false);
  const toast = useToast();
  const [tab, setTab] = useState<"chat" | "prep">("chat");
  const [prep, setPrep] = useState<PrepCard[]>([]);
  const [guestDraft, setGuestDraft] = useState<GuestDraft | null>(null);
  const [conversationId, setConversationId] = useState(() => `conv-${Date.now()}`);
  // G5: geçmiş sohbetler sayfası (açık/kapalı + liste + yükleniyor).
  const [historyOpen, setHistoryOpen] = useState(false);
  const [routePickerOpen, setRoutePickerOpen] = useState(false);
  const [confirmDeleteHistoryId, setConfirmDeleteHistoryId] = useState<string | "all" | null>(null);
  const [historyItems, setHistoryItems] = useState<
    Array<{ conversationId: string; destination: string | null; updatedAt: string | null }>
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [userDisplayName, setUserDisplayName] = useState<string>(() =>
    owner && owner !== "guest" ? owner.split("@")[0] : "",
  );
  const [routeFeedback, setRouteFeedback] = useState<Record<string, "up" | "down">>({});
  const history = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const conversationStateRef = useRef<MobileConversationState | undefined>(undefined);
  const sending = useRef(false);
  const pendingTurn = useRef<{ text: string; requestId: string } | null>(null);
  const opened = useRef(new Map<string, ActiveRoute>());

  useEffect(() => {
    let alive = true;
    authService
      .getSession()
      .then((sess) => {
        if (!alive || !sess?.name) return;
        setUserDisplayName(sess.name);
        setMessages((prev) =>
          prev.length === 1 && prev[0].id.startsWith("welcome")
            ? [buildPersonalizedWelcome(sess.name)]
            : prev,
        );
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [owner]);

  // Girişten sonra misafir taslağı (hesap yalıtımlı; otomatik istek yok).
  useEffect(() => {
    let alive = true;
    loadDraft(storage, owner, Date.now())
      .then((d) => {
        if (alive && d && d.q) setGuestDraft(d);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [owner]);

  // G5: bir sohbeti (son ya da seçilen geçmiş) mesaj + rota + geçmişe uygular. Rota otomatik
  // plana YAZILMAZ; kart "Haritada aç" ile açılır. getLatestSession ve getSession aynı şekli döner.
  const applyConversation = useCallback(
    (
      conv: NonNullable<Awaited<ReturnType<typeof aiService.getLatestSession>>>["conversation"],
      id?: string,
    ) => {
      if (!conv?.messages?.length) return;
      if (id) setConversationId(id);
      const synced: ChatItem[] = conv.messages.map((m, idx) => ({
        id: `sync-${idx}`,
        sender: m.role === "user" ? "user" : "bot",
        text: m.content,
      }));
      const r = conv.route;
      if (r?.stops?.length) {
        const stops: TripStop[] = r.stops
          .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
          .map((s, idx) => ({
            id: s.id || `stop-${idx}`,
            name: s.name,
            category: s.category || tr("native.ai.defaultCategory"),
            time: `${s.day || 1}. gün${s.timeSlot ? ` · ${s.timeSlot}` : ""}`,
            duration: s.suggestedDuration || s.duration || "",
            address: s.address || "",
            lat: s.lat as number,
            lng: s.lng as number,
          }));
        const lastBot = [...synced].reverse().find((m) => m.sender === "bot");
        if (lastBot && stops.length)
          lastBot.route = {
            title:
              r.title || tr("native.ai.routeTitle", { destination: r.destination ?? "" }).trim(),
            stops,
            days: [...new Set(stops.map(dayOf))],
          };
      }
      history.current = conv.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
        .slice(-6);
      setMessages(synced);
    },
    [],
  );
  // Sunucudaki son sohbet (bugünkü davranış).
  useEffect(() => {
    let alive = true;
    aiService
      .getLatestSession()
      .then((latest) => {
        if (!alive) return;
        if (latest?.userDisplayName) {
          setUserDisplayName(latest.userDisplayName);
          setMessages((prev) =>
            prev.length === 1 && prev[0].id.startsWith("welcome")
              ? [buildPersonalizedWelcome(latest.userDisplayName)]
              : prev,
          );
        }
        applyConversation(
          latest?.conversation,
          latest?.latestConversationId || latest?.conversationId,
        );
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [applyConversation]);

  const send = useCallback(
    async (raw: string, opts: { fromDraft?: boolean } = {}) => {
      const text = raw.trim();
      if (!text || sending.current) return;
      sending.current = true;
      // Sadece tüm sorular tamamlanıp gerçek rota oluşturma aşamasına geçildiğinde rota yükleme animasyonu gösterilir;
      // normal sohbet ve soru-cevap (Q&A) aşamasında yalnızca 3 nokta animasyonu görünür.
      const prevCtx = conversationStateRef.current?.context;
      const isRouteGenerationReady =
        opts.fromDraft === true ||
        /gün\s*gün\s*seyahat\s*rotamı\s*oluştur|rotayı\s*(?:oluştur|hazırla)|hemen\s*oluştur/iu.test(
          text,
        ) ||
        (Boolean(prevCtx?.destination) &&
          Boolean(prevCtx?.days) &&
          thinkingIsRoute(text.length, messages.length));
      setThinkingRoute(isRouteGenerationReady);
      setBusy(true);
      if (opts.fromDraft) setRouteLoading(true);
      setMessages((prev) => [...prev, { id: `user-${Date.now()}`, sender: "user", text }]);
      try {
        // Aynı metnin yeniden denenmesi aynı requestId'yi taşır (sunucu idempotency).
        const turn =
          pendingTurn.current?.text === text
            ? pendingTurn.current
            : { text, requestId: generateUUID() };
        pendingTurn.current = turn;
        const res = await aiService.ask(text, {
          conversationId,
          history: history.current.slice(-6),
          requestId: turn.requestId,
          trainingConsent: false,
          conversationState: conversationStateRef.current,
        });
        pendingTurn.current = null;
        if (res.conversationState) {
          conversationStateRef.current = res.conversationState;
        }
        history.current = [
          ...history.current,
          { role: "user" as const, content: text },
          { role: "assistant" as const, content: res.answer },
        ].slice(-6);
        const stops = res.isRoutePlan ? toStops(res) : [];
        const item: ChatItem = {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: res.answer,
          route: stops.length
            ? {
                title: res.routeTitle || tr("planner.edit.trip"),
                stops,
                days: [...new Set(stops.map(dayOf))],
              }
            : undefined,
          options: toOptions(res),
          warnings: res.feasibility?.issues?.map((i) => i.message).filter(Boolean),
          assumptions: res.assumptions?.length ? res.assumptions : undefined,
        };
        const nextPrep = toPrep(res);
        if (nextPrep.length) setPrep(nextPrep);
        setMessages((prev) => [...prev, item]);
        if (item.route) {
          const plan = item.route;
          toast.show({
            tone: "success",
            title: tr("studio.ready.title"),
            message: plan.title,
            action: { label: tr("home.lastTrip.open"), onPress: () => openRoute(item.id, plan) },
          });
        }
        if (opts.fromDraft) {
          await clearDraft(storage);
          setGuestDraft(null);
        }
      } catch (error: unknown) {
        const err = error as { status?: number; code?: string; message?: string };
        if (err?.status && err.status < 500 && ![408, 409].includes(err.status))
          pendingTurn.current = null;
        const retryable = err?.code === "AI_TIMEOUT" || err?.code === "AI_UNREACHABLE";
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-err-${Date.now()}`,
            sender: "bot",
            text:
              err?.status === 402
                ? tr("upgrade.description")
                : err?.code === "AI_TIMEOUT"
                  ? tr("studio.err.timeoutRetry")
                  : err?.code === "AI_UNREACHABLE"
                    ? tr("studio.err.unreachable")
                    : err?.message || tr("native.ai.noReply"),
            upgrade: err?.status === 402,
            retry: retryable ? text : undefined,
          },
        ]);
      } finally {
        sending.current = false;
        setBusy(false);
        setRouteLoading(false);
      }
    },
    // openRoute/toast yalnız ref ve kararlı API okur.
    [conversationId, messages.length],
  );

  const newChat = () => {
    if (sending.current) return;
    pendingTurn.current = null;
    history.current = [];
    conversationStateRef.current = undefined;
    setConversationId(`conv-${Date.now()}`);
    setPrep([]);
    setTab("chat");
    setMessages([buildPersonalizedWelcome(userDisplayName)]);
  };

  const clearHistory = () => {
    setConfirmDeleteHistoryId("all");
  };

  const deleteHistoryItem = (id: string) => {
    setConfirmDeleteHistoryId(id);
  };

  const openHistory = useCallback(() => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    aiService
      .listConversations()
      .then((items) => setHistoryItems(items))
      .catch(() => setHistoryItems([]))
      .finally(() => setHistoryLoading(false));
  }, []);
  const loadConversation = useCallback(
    (id: string) => {
      setHistoryOpen(false);
      aiService
        .getSession(id)
        .then((sess) => {
          if (sess?.conversation?.messages?.length) {
            setPrep([]);
            setTab("chat");
            applyConversation(sess.conversation, id);
          } else {
            toast.show({ tone: "warning", message: tr("native.ai.history.empty") });
          }
        })
        .catch(() => toast.show({ tone: "danger", message: tr("ui.unexpectedError") }));
    },
    [applyConversation, toast],
  );

  const pickAndAttachDocument = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        const asset = res.assets[0];
        const fileName = asset.fileName || "Seyahat Belgesi";
        await documentStore.addDocument({
          title: fileName.replace(/\.[^/.]+$/, ""),
          category: "ticket",
          fileName: fileName,
          fileUri: asset.uri,
          validDate: new Date().toISOString().split("T")[0],
          status: "upcoming",
          notes: "AI Asistan sohbetinden otomatik kaydedildi",
        });
        toast.show({
          tone: "info",
          message: "Belge 'Seyahat Belgelerim' bölümüne kaydedildi.",
        });
        setTab("chat");
        send(`Yüklediğim seyahat belgesi (${fileName}) hakkında detayları çıkarabilir misin?`);
      }
    } catch (e) {
      console.warn("Document attach error:", e);
    }
  };
  const openRoute = (msgId: string, plan: RoutePlan) => {
    const existing = opened.current.get(msgId);
    if (existing && tripStore.getAllRoutes().includes(existing)) {
      tripStore.switchActiveRoute(existing.id);
    } else {
      opened.current.set(msgId, tripStore.createRoute(plan.title, plan.stops));
    }
    onOpenMap();
  };

  const lastBotId = [...messages].reverse().find((m) => m.sender === "bot")?.id;
  const announcement = [...messages].reverse().find((m) => m.sender === "bot")?.text;

  return (
    <Screen
      keyboardAvoiding
      header={
        <ScreenHeader
          title={tr("nav.ai")}
          right={
            <View style={styles.headerActions}>
              <IconButton icon="clock" label={tr("native.ai.history.open")} onPress={openHistory} />
              <IconButton icon="plus" label={tr("native.ai.newChat")} onPress={newChat} />
            </View>
          }
        />
      }
    >
      {prep.length ? (
        <View style={styles.tabs}>
          <SegmentedControl
            label={tr("native.ai.viewLabel")}
            options={[
              { value: "chat", label: tr("assistant.log.label") },
              { value: "prep", label: tr("ai.prepTab") },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>
      ) : null}
      {tab === "prep" ? (
        <ScrollView contentContainerStyle={styles.prep}>
          {prep.map((card) => (
            <Card key={card.title} variant="bordered">
              <View style={styles.cardBody}>
                <Txt variant="heading" header>
                  {card.title}
                </Txt>
                {card.lines.map((line) => (
                  <Txt key={line} variant="small" tone="muted">
                    {line}
                  </Txt>
                ))}
                {card.actionPrompt ? (
                  <Button
                    label="Asistana Sor & Planla"
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      setTab("chat");
                      send(card.actionPrompt!);
                    }}
                  />
                ) : null}
                {card.link ? (
                  <Button
                    label={card.link.label}
                    variant="secondary"
                    size="sm"
                    onPress={() => Linking.openURL(card.link!.url).catch(() => undefined)}
                  />
                ) : null}
              </View>
            </Card>
          ))}
        </ScrollView>
      ) : (
        <MessageLog
          label={tr("assistant.log.label")}
          busy={busy}
          typing={busy && !thinkingRoute && !routeLoading}
          announcement={announcement}
        >
          {messages.map((msg) =>
            msg.sender === "user" ? (
              <MessageBubble key={msg.id} role="user">
                {msg.text}
              </MessageBubble>
            ) : (
              <View key={msg.id} style={styles.botBlock}>
                <MessageBubble role="assistant">{msg.text}</MessageBubble>
                {msg.warnings?.length ? (
                  <Notice tone="warning">{msg.warnings.join(" ")}</Notice>
                ) : null}
                {msg.assumptions?.length ? (
                  <Txt variant="caption" tone="muted">
                    {tr("native.ai.assumptions", { list: msg.assumptions.join(" · ") })}
                  </Txt>
                ) : null}
                {msg.route ? (
                  <Card variant="bordered">
                    <View style={styles.cardBody}>
                      <Txt variant="heading" header>
                        {msg.route.title}
                      </Txt>
                      <Txt variant="caption" tone="muted">
                        {tr("trip.day.stops", { n: msg.route.stops.length })}
                      </Txt>
                      {msg.route.stops.slice(0, 5).map((s, i) => (
                        <StopRow
                          key={s.id}
                          index={i + 1}
                          day={dayOf(s)}
                          name={s.name}
                          category={categoryIcon(s.category)}
                          categoryLabel={s.category}
                        />
                      ))}
                      <Button
                        label={tr("home.lastTrip.open")}
                        onPress={() => openRoute(msg.id, msg.route!)}
                      />
                      <View style={styles.inlineConfirmRow}>
                        <Button
                          label={routeFeedback[msg.id] === "up" ? "Beğenildi ✓" : "👍 Rotayı Beğendim"}
                          variant={routeFeedback[msg.id] === "up" ? "primary" : "secondary"}
                          size="sm"
                          onPress={() => {
                            setRouteFeedback((prev) => ({ ...prev, [msg.id]: "up" }));
                            toast.show({
                              tone: "success",
                              message: "Geri bildiriminiz tercih profilinize kaydedildi.",
                            });
                          }}
                        />
                        <Button
                          label="✏️ Geri Bildirim & Düzenle"
                          variant="ghost"
                          size="sm"
                          onPress={() => {
                            setRouteFeedback((prev) => ({ ...prev, [msg.id]: "down" }));
                            send(
                              `"${msg.route!.title}" rotam üzerinde geri bildirimim var: durakları ve gün dağılımını birlikte revize edelim.`,
                            );
                          }}
                        />
                      </View>
                    </View>
                  </Card>
                ) : null}
                {msg.retry && msg.id === lastBotId ? (
                  <Button
                    label={tr("ui.retry")}
                    variant="secondary"
                    disabled={busy}
                    onPress={() => send(msg.retry!)}
                  />
                ) : null}
                {msg.upgrade ? (
                  <Button label={tr("upgrade.compare")} variant="secondary" onPress={onOpenPlans} />
                ) : null}
                {msg.options && msg.id === lastBotId ? (
                  <QuestionCard
                    questions={
                      [
                        {
                          id: "server",
                          text: msg.options.question,
                          mode: "single",
                          options: msg.options.items.map((o, i) => ({
                            id: String(i),
                            label: o.label,
                          })),
                        },
                      ] as unknown as CardQuestions
                    }
                    disabled={busy}
                    onSubmit={(answers, labels) => {
                      const ans = answers.server?.[0] || "";
                      if (ans.startsWith("custom:")) {
                        send(ans.slice(7));
                        return;
                      }
                      const picked = msg.options!.items[Number(ans)];
                      if (picked) send(picked.prompt);
                      else if (labels.length) send(labels.join(", "));
                    }}
                  />
                ) : null}
              </View>
            ),
          )}
          {guestDraft ? (
            <GuestDraftSummary
              draft={guestDraft}
              busy={busy}
              onCreate={() => send(buildGuestSummaryMessage(guestDraft), { fromDraft: true })}
              secondary={
                <Button
                  label={tr("guest.resume.discard")}
                  variant="ghost"
                  onPress={() => {
                    clearDraft(storage);
                    setGuestDraft(null);
                  }}
                />
              }
            />
          ) : null}
          {busy && !routeLoading && thinkingRoute ? (
            <ThinkingSteps isRoute={thinkingRoute} />
          ) : null}
          {prep.length && tab === "chat" ? (
            <Button label={tr("ai.prepLink")} variant="ghost" onPress={() => setTab("prep")} />
          ) : null}
        </MessageLog>
      )}
      <View style={styles.composer}>
        <ComposerBar
          placeholder={tr("assistant.composer.placeholder")}
          label={tr("assistant.composer.label")}
          note={tr("assistant.composer.costNote")}
          busy={busy}
          leading={
            <View style={styles.composerLeading}>
              <IconButton
                icon="plus"
                label={tr("native.ai.routePicker.title")}
                onPress={() => setRoutePickerOpen(true)}
              />
              <IconButton
                icon="image"
                label={"Belge Yükle"}
                onPress={pickAndAttachDocument}
              />
            </View>
          }
          onSubmit={(text) => {
            setTab("chat");
            send(text);
          }}
        />
      </View>
      <RouteLoadingModal visible={routeLoading} onRunInBackground={() => setRouteLoading(false)} />
      <ModalFrame
        visible={historyOpen}
        variant="sheet"
        title={tr("native.ai.history.title")}
        onRequestClose={() => setHistoryOpen(false)}
      >
        <ScrollView contentContainerStyle={styles.historyBody}>
          {historyLoading ? (
            <Skeleton variant="list-row" count={4} />
          ) : historyItems.length === 0 ? (
            <EmptyState icon="inbox" title={tr("native.ai.history.none")} />
          ) : (
            <>
              {confirmDeleteHistoryId === "all" ? (
                <Card variant="bordered">
                  <View style={styles.inlineConfirmRow}>
                    <Txt variant="caption" tone="danger" style={{ flex: 1 }}>
                      {tr("native.ai.history.clearConfirmBody")}
                    </Txt>
                    <Button
                      label={tr("community.post.delete")}
                      variant="danger"
                      size="sm"
                      onPress={() => {
                        setHistoryItems([]);
                        newChat();
                        setConfirmDeleteHistoryId(null);
                        toast.show({ tone: "info", message: tr("assistant.history.cleared") });
                      }}
                    />
                    <Button
                      label={tr("ui.cancel")}
                      variant="ghost"
                      size="sm"
                      onPress={() => setConfirmDeleteHistoryId(null)}
                    />
                  </View>
                </Card>
              ) : (
                <Button
                  label={tr("assistant.history.clearAll")}
                  variant="secondary"
                  size="sm"
                  onPress={clearHistory}
                />
              )}
              {historyItems.map((c) => (
                <Card key={c.conversationId} variant="bordered">
                  <View style={styles.historyRow}>
                    <Pressable
                      style={styles.historyText}
                      onPress={() => loadConversation(c.conversationId)}
                    >
                      <Txt variant="label" numberOfLines={1}>
                        {c.destination || tr("native.ai.history.untitled")}
                      </Txt>
                      {c.updatedAt ? (
                        <Txt variant="caption" tone="muted">
                          {new Date(c.updatedAt).toLocaleDateString("tr-TR")}
                        </Txt>
                      ) : null}
                    </Pressable>
                    {confirmDeleteHistoryId === c.conversationId ? (
                      <View style={styles.inlineConfirmRow}>
                        <Button
                          label={tr("community.post.delete")}
                          variant="danger"
                          size="sm"
                          onPress={() => {
                            const id = c.conversationId;
                            setHistoryItems((prev) =>
                              prev.filter((item) => item.conversationId !== id),
                            );
                            if (conversationId === id) {
                              newChat();
                            }
                            setConfirmDeleteHistoryId(null);
                            toast.show({ tone: "info", message: tr("assistant.history.deleted") });
                          }}
                        />
                        <Button
                          label={tr("ui.cancel")}
                          variant="ghost"
                          size="sm"
                          onPress={() => setConfirmDeleteHistoryId(null)}
                        />
                      </View>
                    ) : (
                      <IconButton
                        icon="trash"
                        label={tr("studio.sessions.delete")}
                        onPress={() => deleteHistoryItem(c.conversationId)}
                      />
                    )}
                  </View>
                </Card>
              ))}
            </>
          )}
        </ScrollView>
      </ModalFrame>

      <ModalFrame
        visible={routePickerOpen}
        variant="sheet"
        title={tr("native.ai.routePicker.title")}
        onRequestClose={() => setRoutePickerOpen(false)}
      >
        <ScrollView
          contentContainerStyle={styles.routePickerList}
          keyboardShouldPersistTaps="handled"
        >
          <Txt variant="caption" tone="muted">
            {tr("native.ai.routePicker.subtitle")}
          </Txt>
          {tripStore.getAllRoutes().length === 0 ? (
            <EmptyState icon="route" title={tr("planner.trips.empty")} />
          ) : (
            tripStore.getAllRoutes().map((r) => (
              <Card
                key={r.id}
                variant="bordered"
                label={r.name}
                onPress={() => {
                  setRoutePickerOpen(false);
                  const stopNames = r.stops.map((s) => s.name).join(", ");
                  const prompt = `"${r.name}" rotam hakkında konuşmak istiyorum.${stopNames ? ` Duraklar: ${stopNames}.` : ""} Bu rota için bana ne gibi önerilerde bulunabilirsin?`;
                  setTab("chat");
                  send(prompt);
                }}
              >
                <View style={styles.routePickerRow}>
                  <View style={styles.routePickerText}>
                    <Txt variant="label" numberOfLines={1}>
                      {r.name}
                    </Txt>
                    <Txt variant="caption" tone="muted">
                      {tr("trip.day.stops", { n: r.stops.length })}
                    </Txt>
                  </View>
                  <Icon name="chevron" size={16} color={tokens.color.textMuted} />
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      </ModalFrame>

      <ScreenTourModal screen="ai" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: "row", alignItems: "center", gap: tokens.space["1"] },
  composerLeading: { flexDirection: "row", alignItems: "center", gap: tokens.space["1"] },
  inlineConfirmRow: { flexDirection: "row", alignItems: "center", gap: tokens.space["2"] },
  historyBody: { padding: tokens.space["4"], gap: tokens.space["2"] },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.space["2"],
  },
  historyText: { flex: 1, gap: tokens.space["1"] },
  routePickerList: { padding: tokens.space["4"], gap: tokens.space["3"] },
  routePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.space["2"],
  },
  routePickerText: { flex: 1, gap: tokens.space["1"] },
  tabs: { paddingHorizontal: tokens.space["4"], paddingTop: tokens.space["3"] },
  prep: { padding: tokens.space["4"], gap: tokens.space["3"] },
  cardBody: { gap: tokens.space["2"] },
  botBlock: { gap: tokens.space["2"] },
  composer: {
    padding: tokens.space["3"],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.border,
    backgroundColor: tokens.color.composerBg,
  },
});
