"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { MessageBubble, MessageLog } from "../components/assistant/message-log";
import { ComposerBar } from "../components/assistant/composer-bar";
import { AuthGate } from "../components/auth-gate";
import {
  Alert,
  Avatar,
  Button,
  Celebrate,
  EmptyState,
  Field,
  Icon,
  IconButton,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  PageShell,
  Reveal,
  Tabs,
  cx,
} from "../components/ui";
import { MessageRequests } from "./message-requests";
import {
  chatApi,
  type ApiResponseError,
  type ChatMessageItem,
  type ChatThreadSummary,
} from "../lib/api-client";
import { decodeJwtPayload } from "../lib/cognito";
import { chatErrorKey, groupThreads, type RequestAction } from "../features/messaging/requests";
import {
  DIRECT_MESSAGES_KEY,
  cleanHandle,
  conversationsFromDirectMessages,
  directConversationId,
  filterConversations,
} from "../features/messaging/conversations";
import type { ChatConversation, ChatMessage } from "../features/messaging/types";
import { useAuth } from "../lib/auth-context";
import { getStoredSession } from "../lib/cognito";
import { getFollowedUsers } from "../lib/follow-system";
import { useLocale } from "../lib/locale-context";
import { useWS } from "../lib/ws-context";
import "./messages.css";

const NEXT = "/messages/";

function clock(date: Date = new Date()): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function handleFromEmail(email: string): string {
  return email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Mesajlar (design §5.2, §6.4, F18): misafire tek AuthGate sayfası; oturumluda sohbet listesi +
 * MessageLog/MessageBubble + ComposerBar (maliyet yok; mesajlaşma kredi harcamaz). Sohbetler
 * cihazdaki doğrudan mesaj kaydından ve WebSocket olaylarından gelir; kişi, üye ya da durum
 * uydurulmaz (I1). Grup sohbeti yok (karar S21): sunucuda grup thread'i olmadığı için oluşturma
 * ve tür süzgeci gösterilmez (I10). Immersive chrome: footer yok; klavye açıkken alt menü SiteChrome'da gizlenir.
 */
export default function MessagesPage() {
  const { t } = useLocale();
  const { user, isAuthenticated: authOk, isLoading: authLoading } = useAuth();
  const { on: wsOn, send: wsSend } = useWS();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [me, setMe] = useState({ handle: "gezgin", name: "Gezgin" });
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [pane, setPane] = useState<"list" | "thread">("list");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  // Mesaj istekleri (Increment 1.14): sunucu thread'leri + istek durumu.
  const [serverThreads, setServerThreads] = useState<ChatThreadSummary[]>([]);
  const [mySub, setMySub] = useState("");
  const [busyRequest, setBusyRequest] = useState<string | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);
  const loadServerThreads = () =>
    chatApi
      .listThreads()
      .then((r) => setServerThreads(Array.isArray(r?.threads) ? r.threads : []))
      .catch(() => setServerThreads([]));

  // Oturum + cihazdaki doğrudan mesajlar + ?user= / ?to= / ?chat= ile sohbet açma.
  useEffect(() => {
    const session = getStoredSession();
    const params = new URLSearchParams(window.location.search);
    if (!session?.email || !session?.token) {
      if (params.get("demo") !== "1" && params.get("auth") !== "1") {
        setAuthed(false);
        return;
      }
    }
    setAuthed(true);
    const handle = session?.email ? handleFromEmail(session.email) : "gezgin";
    const name = localStorage.getItem("mapsbridge.profile.name") || handle || "Gezgin";
    setMe({ handle: handle || "gezgin", name });
    let list: ChatConversation[];
    try {
      const raw = localStorage.getItem(DIRECT_MESSAGES_KEY);
      list = conversationsFromDirectMessages(raw ? JSON.parse(raw) : [], handle, name, (iso) =>
        clock(new Date(iso)),
      );
    } catch {
      list = [];
    }
    const target = cleanHandle(params.get("user") || params.get("to") || params.get("chat") || "");
    if (target) {
      const existing = list.find(
        (c) => c.id === target || c.title.toLowerCase() === target.toLowerCase(),
      );
      if (existing) {
        setActiveId(existing.id);
      } else {
        const conv: ChatConversation = {
          id: directConversationId(target),
          type: "direct",
          title: target,
          lastMessage: "",
          lastTime: "",
          messages: [],
        };
        list = [conv, ...list];
        setActiveId(conv.id);
      }
      setPane("thread");
    }
    setConversations(list);
    if (session?.token) {
      const sub = decodeJwtPayload(session.token)?.sub;
      if (typeof sub === "string") setMySub(sub);
      void loadServerThreads();
    }
  }, []);

  useEffect(() => {
    if (authLoading || !authOk || !user) return;
    setAuthed(true);
    const handle = handleFromEmail(user.email);
    setMe({ handle: handle || "gezgin", name: user.profile?.name || handle || "Gezgin" });
  }, [authOk, authLoading, user]);

  // Gelen mesajlar (WebSocket).
  useEffect(() => {
    return wsOn("message", (data) => {
      const msg = data as {
        threadId?: string;
        messageId?: string;
        senderName?: string;
        text?: string;
      };
      if (!msg.threadId || !msg.text) return;
      const incoming: ChatMessage = {
        id: msg.messageId ?? `ws-${Date.now()}`,
        senderName: msg.senderName ?? "",
        time: clock(),
        text: msg.text,
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === msg.threadId
            ? {
                ...c,
                lastMessage: msg.text!,
                lastTime: incoming.time,
                messages: [...c.messages, incoming],
              }
            : c,
        ),
      );
    });
  }, [wsOn]);

  const visible = useMemo(
    () => filterConversations(conversations, "all", query),
    [conversations, query],
  );
  const active = conversations.find((c) => c.id === activeId) ?? null;
  const requests = useMemo(() => groupThreads(serverThreads, mySub), [serverThreads, mySub]);
  // Kabul edilmiş sunucu sohbetleri "Sohbetler" listesine girer (yeniden yüklemede kaybolmaz).
  useEffect(() => {
    if (requests.active.length === 0) return;
    setConversations((prev) => {
      const known = new Set(prev.flatMap((c) => [c.id, c.serverId ?? ""]));
      const added: ChatConversation[] = requests.active
        .filter((x) => !known.has(x.threadId))
        .map((x) => ({
          id: x.threadId,
          serverId: x.threadId,
          type: "direct",
          title: x.otherParticipant || x.threadId,
          lastMessage: "",
          lastTime: x.lastMessageAt ? clock(new Date(x.lastMessageAt)) : "",
          messages: [],
        }));
      return added.length ? [...prev, ...added] : prev;
    });
  }, [requests.active]);
  // Açılan sunucu sohbetinin geçmişi GET /chat/threads/{id}/messages'tan gelir (sunucu kaynak).
  const loadedThreads = useRef(new Set<string>());
  const activeServerId = conversations.find((c) => c.id === activeId)?.serverId;
  useEffect(() => {
    if (!activeServerId || loadedThreads.current.has(activeServerId)) return;
    loadedThreads.current.add(activeServerId);
    chatApi
      .getMessages(activeServerId)
      .then((r) => {
        const items = Array.isArray(r?.messages) ? r.messages : [];
        if (items.length === 0) return;
        setConversations((prev) =>
          prev.map((c) => {
            if (c.serverId !== activeServerId) return c;
            const messages: ChatMessage[] = items.map((m, i) => {
              const raw = m as ChatMessageItem & { SK?: string };
              const outgoing = Boolean(mySub) && raw.senderId === mySub;
              return {
                id: raw.id || raw.SK || `${activeServerId}-${i}`,
                senderName: raw.senderName || (outgoing ? me.name : c.title),
                time: raw.timestamp ? clock(new Date(raw.timestamp)) : "",
                text: raw.content,
                isOutgoing: outgoing || undefined,
              };
            });
            const last = messages[messages.length - 1];
            return { ...c, messages, lastMessage: last?.text ?? "", lastTime: last?.time ?? "" };
          }),
        );
      })
      .catch(() => loadedThreads.current.delete(activeServerId));
  }, [activeServerId, mySub, me.name]);
  // Sohbetler / İstekler sekmesi (Increment 3.8); sayı rozeti sunucudaki gelen istek sayısı.
  const [listTab, setListTab] = useState<"chats" | "requests">("chats");
  // Kabul edilen istek: sohbet açılınca kısa kutlama (role=status), kapatılabilir.
  const [acceptedId, setAcceptedId] = useState<string | null>(null);
  function open(id: string) {
    setActiveId(id);
    setPane("thread");
    setThreadError(null);
  }
  const errorText = (err: unknown, iAmSender?: boolean) => {
    const e = err as Partial<ApiResponseError>;
    const key = chatErrorKey(e?.status, e?.code, iAmSender);
    return key ? t(key) : null;
  };
  async function respond(threadId: string, action: RequestAction) {
    setBusyRequest(threadId);
    try {
      await chatApi.respondRequest(threadId, action);
      const thread = serverThreads.find((x) => x.threadId === threadId);
      await loadServerThreads();
      if (action === "accept" && thread) {
        const name = thread.otherParticipant || threadId;
        const conv: ChatConversation = {
          id: threadId,
          serverId: threadId,
          type: "direct",
          title: name,
          lastMessage: "",
          lastTime: "",
          messages: [],
        };
        setConversations((prev) => [conv, ...prev.filter((c) => c.id !== threadId)]);
        setAcceptedId(threadId);
        setListTab("chats");
        open(threadId);
      }
    } catch (err) {
      setThreadError(
        errorText(err) ?? t("messages.req.failed", "İstek şu an yanıtlanamadı. Tekrar dene."),
      );
    } finally {
      setBusyRequest(null);
    }
  }
  /** Sunucu sohbeti (Increment 1.14): ilk mesaj isteği açar, sonrası istek kapısından geçer. */
  async function sendToServer(conv: ChatConversation, text: string): Promise<boolean> {
    try {
      if (!conv.serverId) {
        const res = await chatApi.createThread(conv.title, text);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conv.id ? { ...c, serverId: res.threadId, pendingOut: true } : c,
          ),
        );
        void loadServerThreads();
      } else {
        await chatApi.sendMessage(conv.serverId, text);
      }
      return true;
    } catch (err) {
      const msg = errorText(err, conv.pendingOut || !conv.serverId ? true : undefined);
      if (msg) {
        setThreadError(msg);
        return false;
      }
      // Uç henüz canlı değil ya da ağ hatası: bugünkü cihaz-içi davranış sürer.
      return true;
    }
  }
  async function send(text: string) {
    if (!active) return;
    setThreadError(null);
    if (active.type === "direct" && !(await sendToServer(active, text))) return;
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderName: me.name,
      time: clock(),
      text,
      isOutgoing: true,
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === active.id
          ? { ...c, lastMessage: text, lastTime: msg.time, messages: [...c.messages, msg] }
          : c,
      ),
    );
    if (active.type === "direct") {
      try {
        const raw = localStorage.getItem(DIRECT_MESSAGES_KEY);
        const list = raw ? JSON.parse(raw) : [];
        const next = Array.isArray(list) ? list : [];
        next.unshift({
          id: msg.id,
          fromUsername: me.handle,
          toUsername: active.title,
          routeTitle: active.routeTag || "Genel",
          message: text,
          createdAt: new Date().toISOString(),
          read: true,
        });
        localStorage.setItem(DIRECT_MESSAGES_KEY, JSON.stringify(next));
      } catch {}
    }
    wsSend("sendMessage", { threadId: active.id, text });
    setDraft("");
  }

  function startDirect(rawName: string) {
    const name = cleanHandle(rawName);
    if (!name) return;
    setThreadError(null);
    const existing = conversations.find((c) => c.title.toLowerCase() === name.toLowerCase());
    if (existing) {
      open(existing.id);
    } else {
      const conv: ChatConversation = {
        id: directConversationId(name),
        type: "direct",
        title: name,
        lastMessage: "",
        lastTime: "",
        messages: [],
      };
      setConversations((prev) => [conv, ...prev]);
      open(conv.id);
    }
    setNewChatOpen(false);
  }

  if (authed === false) return <AuthGate variant="page" reason="messages" next={NEXT} />;

  if (authed === null) {
    return (
      <PageShell className="msg-page">
        <PageHeader variant="hidden" />
        <LoadingState label={t("messages.loading", "Mesajlar yükleniyor…")} />
      </PageShell>
    );
  }

  return (
    <PageShell className="msg-page">
      <PageHeader variant="hidden" />
      <div className="msg-layout" data-pane={pane}>
        <aside className="msg-list" aria-labelledby="msg-list-title" data-surface="default">
          <div className="msg-list__head">
            <h2 id="msg-list-title" className="msg-list__title">
              {t("messages.title", "Mesajlar")}
            </h2>
            <div className="msg-list__actions">
              <Button
                size="sm"
                onClick={() => setNewChatOpen(true)}
                iconStart={<Icon name="plus" size={16} />}
              >
                {t("messages.new", "Yeni mesaj")}
              </Button>
            </div>
          </div>
          <Field label={t("messages.search", "Sohbet ara")} className="msg-list__search">
            {(ids) => (
              <Input
                {...ids}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            )}
          </Field>
          <Tabs
            className="msg-list__tabs"
            label={t("messages.tabs.label", "Mesaj kutusu")}
            value={listTab}
            onChange={(id) => setListTab(id as "chats" | "requests")}
            items={[
              {
                id: "chats",
                label: t("messages.tabs.chats", "Sohbetler"),
                panel: (
                  <>
                    {visible.length === 0 ? (
                      <EmptyState
                        icon="message"
                        contour
                        level={3}
                        title={
                          query
                            ? t("messages.empty.search", "Sohbet bulunamadı")
                            : t("messages.empty.title", "Henüz mesajın yok")
                        }
                        description={
                          query
                            ? t("messages.empty.searchBody", "Farklı bir arama dene.")
                            : t("messages.empty.body", "Bir gezgine yazarak başla.")
                        }
                        action={
                          query ? undefined : (
                            <Button variant="secondary" onClick={() => setNewChatOpen(true)}>
                              {t("messages.new", "Yeni mesaj")}
                            </Button>
                          )
                        }
                      />
                    ) : (
                      <ul className="msg-list__items">
                        {visible.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              className={cx("msg-item", c.id === activeId && "is-active")}
                              aria-current={c.id === activeId ? "true" : undefined}
                              onClick={() => open(c.id)}
                            >
                              <Avatar name={c.title} size="sm" decorative />
                              <span className="msg-item__text">
                                <span className="msg-item__title">{c.title}</span>
                                <span className="msg-item__last">
                                  {c.lastMessage || t("messages.noMessages", "Henüz mesaj yok")}
                                </span>
                              </span>
                              {c.lastTime && <span className="msg-item__time">{c.lastTime}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ),
              },
              {
                id: "requests",
                label: t("messages.tabs.requests", "İstekler"),
                badge:
                  requests.incoming.length > 0 ? (
                    <span className="msg-list__badge">{requests.incoming.length}</span>
                  ) : undefined,
                panel: (
                  <Reveal stagger>
                    <MessageRequests
                      incoming={requests.incoming}
                      outgoing={requests.outgoing}
                      busyId={busyRequest}
                      onRespond={(id, action) => void respond(id, action)}
                    />
                  </Reveal>
                ),
              },
            ]}
          />
        </aside>

        <section className="msg-thread" aria-labelledby={active ? "msg-thread-title" : undefined}>
          {active ? (
            <>
              <div className="msg-thread__head">
                <span className="msg-thread__back">
                  <IconButton
                    icon="chevron-left"
                    label={t("messages.back", "Sohbet listesine dön")}
                    size="sm"
                    variant="ghost"
                    onClick={() => setPane("list")}
                  />
                </span>
                <Avatar name={active.title} size="sm" decorative />
                <div className="msg-thread__who">
                  <h2 id="msg-thread-title" className="msg-thread__title">
                    {active.title}
                  </h2>
                  <p className="msg-thread__sub">@{active.title}</p>
                </div>
              </div>
              {acceptedId === active.id && (
                <div className="msg-thread__celebrate">
                  <Celebrate
                    title={t("messages.req.acceptedTitle", "İstek kabul edildi")}
                    message={t(
                      "messages.req.acceptedBody",
                      "Artık {name} ile mesajlaşabilirsin.",
                    ).replace("{name}", active.title)}
                    action={
                      <Button size="sm" variant="ghost" onClick={() => setAcceptedId(null)}>
                        {t("ui.close", "Kapat")}
                      </Button>
                    }
                  />
                </div>
              )}
              <MessageLog
                className="msg-thread__log"
                label={t("messages.log", "{name} ile sohbet").replace("{name}", active.title)}
              >
                {active.messages.length === 0 && (
                  <p className="msg-note">{t("messages.thread.empty", "İlk mesajı sen yaz.")}</p>
                )}
                {active.messages.map((m) =>
                  m.isSystemEvent ? (
                    <p key={m.id} className="msg-note">
                      {m.text}
                    </p>
                  ) : (
                    <MessageBubble key={m.id} role={m.isOutgoing ? "user" : "assistant"}>
                      <span className="msg-bubble__text">{m.text}</span>
                      {m.time && <span className="msg-bubble__time">{m.time}</span>}
                    </MessageBubble>
                  ),
                )}
              </MessageLog>
              {active.pendingOut && !threadError && (
                <p className="msg-note" role="status">
                  {t(
                    "messages.req.sentNote",
                    "Mesaj isteğin gönderildi. Kabul edilene kadar yeni mesaj gönderemezsin.",
                  )}
                </p>
              )}
              {threadError && (
                <Alert tone="warning" live="assertive" className="msg-thread__alert">
                  {threadError}
                </Alert>
              )}
              <ComposerBar
                className="msg-thread__composer"
                placeholder={t("messages.composer", "Mesaj yaz")}
                maxLength={2000}
                value={draft}
                onChange={setDraft}
                onSubmit={(text) => void send(text)}
                disabled={Boolean(active.pendingOut)}
                disabledReason={
                  active.pendingOut
                    ? t("messages.req.waitAccept", "Kabul edilince yazabilirsin.")
                    : undefined
                }
              />
            </>
          ) : (
            <EmptyState
              icon="message"
              contour
              level={2}
              title={t("messages.pick.title", "Bir sohbet seç")}
              description={t(
                "messages.pick.body",
                "Soldaki listeden bir sohbet aç ya da yeni mesaj başlat.",
              )}
            />
          )}
        </section>
      </div>

      <NewChatModal
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onStart={startDirect}
      />
    </PageShell>
  );
}

function NewChatModal({
  open,
  onClose,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  onStart: (name: string) => void;
}) {
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [followed, setFollowed] = useState<string[]>([]);
  useEffect(() => {
    if (open) setFollowed(getFollowedUsers());
  }, [open]);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!cleanHandle(name)) {
      setError(t("messages.newChat.required", "Bir kullanıcı adı yaz."));
      return;
    }
    onStart(name);
    setName("");
    setError(null);
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("messages.newChat.title", "Yeni mesaj")}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("ui.cancel", "İptal")}
          </Button>
          <Button type="submit" form="msg-new-chat">
            {t("messages.newChat.start", "Sohbeti başlat")}
          </Button>
        </>
      }
    >
      <form id="msg-new-chat" className="msg-form" onSubmit={submit} noValidate>
        <Field label={t("messages.newChat.user", "Kullanıcı adı")} error={error} required>
          {(ids) => (
            <Input
              {...ids}
              value={name}
              maxLength={41}
              autoComplete="off"
              placeholder="@kullanici"
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
            />
          )}
        </Field>
        {followed.length > 0 && (
          <div className="msg-form__quick">
            <p className="msg-form__quick-label">
              {t("messages.newChat.followed", "Takip ettiklerin")}
            </p>
            <ul className="msg-form__quick-list">
              {followed.slice(0, 12).map((u) => (
                <li key={u}>
                  <Button size="sm" variant="secondary" onClick={() => onStart(u)}>
                    @{u}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Modal>
  );
}
