import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { tripStore, type ActiveRoute, type TripStop } from "../services/tripStore";
import { aiService, generateUUID, type AIAskResponse } from "../services/api";
import { storage } from "../services/storage";
import {
  clearDraft,
  buildGuestSummaryMessage,
  loadDraft,
  type GuestDraft,
} from "../guest/guest-draft";
import { ScreenTourModal } from "../components/ScreenTourModal";
import { RouteLoadingModal } from "../components/RouteLoadingModal";
import {
  Button,
  Card,
  ComposerBar,
  IconButton,
  MessageBubble,
  MessageLog,
  Notice,
  QuestionCard,
  Screen,
  ScreenHeader,
  SegmentedControl,
  StopRow,
  Txt,
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
}
interface PrepCard {
  title: string;
  lines: string[];
  link?: { label: string; url: string };
}

const WELCOME: ChatItem = {
  id: "welcome",
  sender: "bot",
  text: tr("native.ai.welcome"),
};

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

/** Hazırlık sekmesi kartları (I8: affiliate yalnızca burada). Yalnızca sunucudan gelen metin. */
function toPrep(res: AIAskResponse): PrepCard[] {
  const cards: PrepCard[] = [];
  const lines = (...v: Array<string | undefined>) => v.filter((x): x is string => !!x);
  const stay = lines(
    res.stayAndTransit?.lodgingSummary,
    res.stayAndTransit?.transitSummary,
    res.stayAndTransit?.neighborhoodTips,
  );
  if (stay.length) cards.push({ title: tr("native.prep.stay"), lines: stay });
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
  const [tab, setTab] = useState<"chat" | "prep">("chat");
  const [prep, setPrep] = useState<PrepCard[]>([]);
  const [guestDraft, setGuestDraft] = useState<GuestDraft | null>(null);
  const [conversationId, setConversationId] = useState(() => `conv-${Date.now()}`);
  const history = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const sending = useRef(false);
  const pendingTurn = useRef<{ text: string; requestId: string } | null>(null);
  const opened = useRef(new Map<string, ActiveRoute>());

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

  // Sunucudaki son sohbet (bugünkü davranış). Rota otomatik olarak plana YAZILMAZ; kart
  // "Haritada aç" ile açılır (eskiden her açılışta yeni bir rota oluşuyordu).
  useEffect(() => {
    let alive = true;
    aiService
      .getLatestSession()
      .then((latest) => {
        const conv = latest?.conversation;
        if (!alive || !conv?.messages?.length) return;
        const id = latest?.latestConversationId || latest?.conversationId;
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
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const send = useCallback(
    async (raw: string, opts: { fromDraft?: boolean } = {}) => {
      const text = raw.trim();
      if (!text || sending.current) return;
      sending.current = true;
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
        });
        pendingTurn.current = null;
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
        if (opts.fromDraft) {
          await clearDraft(storage);
          setGuestDraft(null);
        }
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        if (err?.status && err.status < 500 && ![408, 409].includes(err.status))
          pendingTurn.current = null;
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-err-${Date.now()}`,
            sender: "bot",
            text:
              err?.status === 402
                ? tr("upgrade.description")
                : err?.message || tr("native.ai.noReply"),
            upgrade: err?.status === 402,
          },
        ]);
      } finally {
        sending.current = false;
        setBusy(false);
        setRouteLoading(false);
      }
    },
    [conversationId],
  );

  const newChat = () => {
    if (sending.current) return;
    pendingTurn.current = null;
    history.current = [];
    setConversationId(`conv-${Date.now()}`);
    setPrep([]);
    setTab("chat");
    setMessages([{ ...WELCOME, id: `welcome-${Date.now()}` }]);
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
          right={<IconButton icon="plus" label={tr("native.ai.newChat")} onPress={newChat} />}
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
          typing={busy}
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
                    </View>
                  </Card>
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
                    onSubmit={(answers) => {
                      const picked = msg.options!.items[Number(answers.server?.[0])];
                      if (picked) send(picked.prompt);
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
          onSubmit={(text) => {
            setTab("chat");
            send(text);
          }}
        />
      </View>
      <RouteLoadingModal visible={routeLoading} onRunInBackground={() => setRouteLoading(false)} />
      <ScreenTourModal screen="ai" />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
