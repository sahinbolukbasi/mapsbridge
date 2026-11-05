"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { MessageBubble, MessageLog } from "../components/assistant/message-log";
import { ComposerBar } from "../components/assistant/composer-bar";
import { AuthGate } from "../components/auth-gate";
import {
  Avatar,
  Button,
  EmptyState,
  Field,
  Icon,
  IconButton,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  PageShell,
  SegmentedControl,
  cx,
} from "../components/ui";
import {
  CONVERSATION_FILTERS,
  DIRECT_MESSAGES_KEY,
  cleanHandle,
  conversationsFromDirectMessages,
  directConversationId,
  filterConversations,
  type ConversationFilter,
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
 * uydurulmaz (I1). Immersive chrome: footer yok; klavye açıkken alt menü SiteChrome'da gizlenir.
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
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);

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
    () => filterConversations(conversations, filter, query),
    [conversations, filter, query],
  );
  const active = conversations.find((c) => c.id === activeId) ?? null;

  function open(id: string) {
    setActiveId(id);
    setPane("thread");
  }

  function send(text: string) {
    if (!active) return;
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

  function startGroup(title: string, route: string) {
    const conv: ChatConversation = {
      id: `group-${Date.now()}`,
      type: "group",
      title,
      routeTag: route || undefined,
      lastMessage: "",
      lastTime: clock(),
      messages: [
        {
          id: "init",
          senderName: "",
          time: clock(),
          isSystemEvent: true,
          text: t("messages.group.created", "“{name}” grubu oluşturuldu.").replace("{name}", title),
        },
      ],
    };
    setConversations((prev) => [conv, ...prev]);
    open(conv.id);
    setNewGroupOpen(false);
  }

  if (authed === false) return <AuthGate variant="page" reason="messages" next={NEXT} />;

  if (authed === null) {
    return (
      <PageShell layout="app" className="msg-page">
        <PageHeader variant="hidden" />
        <LoadingState label={t("messages.loading", "Mesajlar yükleniyor…")} />
      </PageShell>
    );
  }

  const groupsCount = conversations.filter((c) => c.type === "group").length;

  return (
    <PageShell layout="app" className="msg-page">
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
              <IconButton
                icon="users"
                label={t("messages.newGroup", "Yeni grup")}
                size="sm"
                variant="ghost"
                onClick={() => setNewGroupOpen(true)}
              />
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
          <SegmentedControl<ConversationFilter>
            label={t("messages.filter", "Sohbet türü")}
            value={filter}
            onChange={setFilter}
            options={[
              { value: CONVERSATION_FILTERS[0], label: t("messages.filter.all", "Tümü") },
              {
                value: CONVERSATION_FILTERS[1],
                label: `${t("messages.filter.groups", "Gruplar")} ${groupsCount}`,
              },
              {
                value: CONVERSATION_FILTERS[2],
                label: `${t("messages.filter.direct", "Birebir")} ${conversations.length - groupsCount}`,
              },
            ]}
          />
          {visible.length === 0 ? (
            <EmptyState
              icon="message"
              level={3}
              title={
                query
                  ? t("messages.empty.search", "Sohbet bulunamadı")
                  : t("messages.empty.title", "Henüz mesajın yok")
              }
              description={
                query
                  ? t("messages.empty.searchBody", "Farklı bir arama dene.")
                  : t("messages.empty.body", "Bir gezgine yazarak ya da grup açarak başla.")
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
                      <span className="msg-item__title">
                        {c.type === "group" && <Icon name="users" size={16} />}
                        {c.title}
                      </span>
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
                  <p className="msg-thread__sub">
                    {active.type === "group"
                      ? active.routeTag || t("messages.groupLabel", "Gezi grubu")
                      : `@${active.title}`}
                  </p>
                </div>
              </div>
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
                      {!m.isOutgoing && active.type === "group" && m.senderName && (
                        <span className="msg-bubble__sender">{m.senderName}</span>
                      )}
                      <span className="msg-bubble__text">{m.text}</span>
                      {m.time && <span className="msg-bubble__time">{m.time}</span>}
                    </MessageBubble>
                  ),
                )}
              </MessageLog>
              <ComposerBar
                className="msg-thread__composer"
                placeholder={t("messages.composer", "Mesaj yaz")}
                maxLength={2000}
                value={draft}
                onChange={setDraft}
                onSubmit={send}
              />
            </>
          ) : (
            <EmptyState
              icon="message"
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
      <NewGroupModal
        open={newGroupOpen}
        onClose={() => setNewGroupOpen(false)}
        onCreate={startGroup}
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

function NewGroupModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string, route: string) => void;
}) {
  const { t } = useLocale();
  const [title, setTitle] = useState("");
  const [route, setRoute] = useState("");
  const [error, setError] = useState<string | null>(null);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError(t("messages.newGroup.required", "Grup adı yaz."));
      return;
    }
    onCreate(title.trim(), route.trim());
    setTitle("");
    setRoute("");
    setError(null);
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("messages.newGroup", "Yeni grup")}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("ui.cancel", "İptal")}
          </Button>
          <Button type="submit" form="msg-new-group">
            {t("messages.newGroup.create", "Grubu oluştur")}
          </Button>
        </>
      }
    >
      <form id="msg-new-group" className="msg-form" onSubmit={submit} noValidate>
        <Field label={t("messages.newGroup.name", "Grup adı")} error={error} required>
          {(ids) => (
            <Input
              {...ids}
              value={title}
              maxLength={80}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
            />
          )}
        </Field>
        <Field
          label={t("messages.newGroup.route", "Bağlı rota")}
          optionalLabel={t("ui.optional", "isteğe bağlı")}
        >
          {(ids) => (
            <Input
              {...ids}
              value={route}
              maxLength={80}
              onChange={(e) => setRoute(e.target.value)}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}
