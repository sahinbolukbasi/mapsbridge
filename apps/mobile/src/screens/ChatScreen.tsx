import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { tripStore, type TripStop } from "../services/tripStore";
import {
  authService,
  chatRequestApi,
  type ChatApiError,
  type ServerChatThread,
} from "../services/api";
import {
  chatErrorKey,
  groupThreads,
  jwtSub,
  resolveOutcome,
  type RequestAction,
} from "../ui/logic/chat-requests";
import { spring } from "../ui/motion";
import { chatStore, type ChatBubbleItem, type ChatContact } from "../services/chatStore";
import { PublicProfileView } from "./PublicProfileView";
import {
  Avatar,
  Button,
  Card,
  ComposerBar,
  ConfirmDialog,
  IconButton,
  MessageBubble,
  MessageLog,
  ModalFrame,
  Notice,
  Screen,
  ScreenHeader,
  TextField,
  Txt,
  useBackHandler,
} from "../ui";
import { tr } from "../i18n/ui";
import { fontFamily, tokens } from "../theme";

function SwipeableMessage({
  children,
  onDelete,
  time,
  isOutgoing,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  time: string;
  isOutgoing?: boolean;
}) {
  const panX = useRef(new Animated.Value(0)).current;
  const [swiped, setSwiped] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 15,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          panX.setValue(Math.min(gestureState.dx, 70));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 45) {
          setSwiped(true);
          spring(panX, 60, "press", true).start();
        } else {
          setSwiped(false);
          spring(panX, 0, "press", true).start();
        }
      },
    }),
  ).current;

  return (
    <View style={styles.msgSwipeWrap}>
      {swiped ? (
        <View style={styles.swipeDeleteAction}>
          <IconButton
            icon="trash"
            color={tokens.color.danger}
            label={tr("community.delete.confirm")}
            onPress={() => {
              spring(panX, 0, "press", true).start();
              setSwiped(false);
              onDelete();
            }}
          />
        </View>
      ) : null}
      <Animated.View
        {...panResponder.panHandlers}
        style={[{ transform: [{ translateX: panX }] }, styles.msg]}
      >
        {children}
        <Txt variant="caption" tone="subtle" style={isOutgoing ? styles.timeOut : undefined}>
          {time}
        </Txt>
      </Animated.View>
    </View>
  );
}

// Mesajlar sekmesi (design §5.3, §9 "Mesajlar"; kararlar S10, S21): yalnız birebir sohbet; grup
// oluşturma ya da sohbet türü süzgeci yok (S21). Sohbet listesi → sohbet (MessageLog + ComposerBar).
// Gönderim bugünkü chatStore/chatService çağrılarıyla değişmeden. Uydurma "çevrimiçi" ve "Görüldü"
// durumları gösterilmez (sunucudan gelmiyor). Android geri: sohbetten listeye (useBackHandler).
export interface ChatScreenProps {
  onOpenMap?: () => void;
  /** Topluluk / gezgin profilinden "Mesaj gönder": bu sohbeti açar (`nonce` her istekte değişir). */
  openContact?: { contact: ChatContact; nonce: number };
}

export function ChatScreen({ onOpenMap, openContact }: ChatScreenProps) {
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [active, setActive] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<ChatBubbleItem[]>([]);
  const [query, setQuery] = useState("");
  const [me, setMe] = useState("gezgin");
  const [newOpen, setNewOpen] = useState(false);
  const [newUser, setNewUser] = useState("");
  const [newError, setNewError] = useState<string | undefined>(undefined);
  const [newBusy, setNewBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<ChatContact | null>(null);
  const [msgToDelete, setMsgToDelete] = useState<ChatBubbleItem | null>(null);
  // Mesaj istekleri (Increment 1.14): sunucu thread'leri + kişi → sunucu thread eşlemesi.
  const [mySub, setMySub] = useState("");
  const [serverThreads, setServerThreads] = useState<ServerChatThread[]>([]);
  const [serverIds, setServerIds] = useState<Record<string, { id: string; pendingOut: boolean }>>(
    {},
  );
  const [busyRequest, setBusyRequest] = useState<string | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const loadServerThreads = () =>
    chatRequestApi
      .listThreads()
      .then((r) => setServerThreads(Array.isArray(r?.threads) ? r.threads : []))
      .catch(() => setServerThreads([]));
  const errorText = (err: unknown, iAmSender?: boolean) => {
    const e = err as Partial<ChatApiError>;
    const key = chatErrorKey(e?.status, e?.code, iAmSender);
    return key ? tr(key as Parameters<typeof tr>[0]) : null;
  };
  const requests = useMemo(() => groupThreads(serverThreads, mySub), [serverThreads, mySub]);

  useEffect(() => {
    let alive = true;
    authService.getSession().then((s) => {
      if (alive && s?.email) setMe(s.email.split("@")[0]);
      if (alive && s?.token) {
        setMySub(jwtSub(s.token));
        void loadServerThreads();
      }
    });
    chatStore.getThreads().then((threads) => alive && setContacts(threads));
    const unsub = chatStore.subscribeThreads(setContacts);
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (openContact) setActive(openContact.contact);
  }, [openContact?.nonce]);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    chatStore.getMessages(active.id).then((msgs) => alive && setMessages(msgs));
    const unsub = chatStore.subscribeMessages(active.id, setMessages);
    return () => {
      alive = false;
      unsub();
    };
  }, [active?.id]);

  useBackHandler(!!active, () => setActive(null));
  useEffect(() => setThreadError(null), [active?.id]);
  /** İlk mesaj isteği açar; sonrası sunucu istek kapısından geçer. false: gönderilmedi. */
  const sendToServer = async (contact: ChatContact, text: string): Promise<boolean> => {
    const known = serverIds[contact.id];
    try {
      if (!known) {
        const res = await chatRequestApi.createThread(contact.username || contact.name, text);
        setServerIds((m) => ({ ...m, [contact.id]: { id: res.threadId, pendingOut: true } }));
        void loadServerThreads();
      } else {
        await chatRequestApi.sendMessage(known.id, text);
      }
      return true;
    } catch (err) {
      const msg = errorText(err, !known || known.pendingOut ? true : undefined);
      if (msg) {
        setThreadError(msg);
        return false;
      }
      // Uç henüz canlı değil ya da ağ hatası: bugünkü cihaz-içi davranış sürer.
      return true;
    }
  };
  const respond = async (thread: ServerChatThread, action: RequestAction) => {
    setBusyRequest(thread.threadId);
    setListError(null);
    try {
      await chatRequestApi.respondRequest(thread.threadId, action);
      await loadServerThreads();
      if (action === "accept") {
        const handle = thread.otherParticipant || thread.threadId;
        const { contact } = await chatStore.startOrGetDirectThread({ name: handle, handle });
        setServerIds((m) => ({ ...m, [contact.id]: { id: thread.threadId, pendingOut: false } }));
        setActive(contact);
      }
    } catch (err) {
      setListError(errorText(err) ?? tr("messages.req.failed"));
    } finally {
      setBusyRequest(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return contacts;
    return contacts.filter((c) => `${c.name} ${c.username}`.toLocaleLowerCase("tr-TR").includes(q));
  }, [contacts, query]);

  // F (görev 12): "Mesaj oluştur" ekranı — arama + kişi listesi (foto + ad + "Mesaj at").
  // Mevcut kişi seçilince sohbet doğrudan açılır (sunucu çağrısı yok; ilk mesaj composer'dan
  // gönderilince sendToServer → createThread çalışır). Yazarken username/ad'a göre filtrelenir.
  const newChatContacts = useMemo(() => {
    const q = newUser.trim().replace(/^@/, "").toLocaleLowerCase("tr-TR");
    if (!q) return contacts;
    return contacts.filter((c) =>
      `${c.name} ${c.username}`.toLocaleLowerCase("tr-TR").includes(q),
    );
  }, [contacts, newUser]);

  // Aranan handle mevcut kişilerden biriyle birebir eşleşmiyorsa "yeni kişiye yaz" satırı için.
  const newHandle = newUser.trim().replace(/^@/, "");
  const newHandleValid = /[a-z0-9]/i.test(newHandle);
  const exactMatch = contacts.some(
    (c) => c.username.toLocaleLowerCase("tr-TR") === newHandle.toLocaleLowerCase("tr-TR"),
  );

  const openExisting = (contact: ChatContact) => {
    setNewOpen(false);
    setNewUser("");
    setNewError(undefined);
    setActive(contact);
  };

  /** Yeni kişiye sohbet aç (yerel bekleyen); ilk mesaj composer'dan gidince istek oluşturulur. */
  const startNewTo = async (handle: string, text: string = "") => {
    if (!newHandleValid) {
      setNewError(tr("messages.newChat.required"));
      return;
    }
    if (text === undefined) {
      setNewError(tr("messages.newChat.messageRequired"));
      return;
    }
    setNewBusy(true);
    setNewError(undefined);
    try {
      if (text) {
        const res = await chatRequestApi.createThread(handle, text);
        const { contact } = await chatStore.startOrGetDirectThread({ name: handle, handle });
        setServerIds((m) => ({ ...m, [contact.id]: { id: res.threadId, pendingOut: true } }));
        await chatStore.sendMessage(contact.id, { text, senderId: "me", senderName: me });
        void loadServerThreads();
        setNewOpen(false);
        setNewUser("");
        setActive(contact);
        return;
      }
      const cleanHandle = handle.trim().replace(/^@/, "").toLowerCase();
      const status = await authService.checkUsername(cleanHandle);
      if (status === "available") {
        setNewError(tr("messages.req.userNotFound") || "Kullanıcı bulunamadı.");
        setNewBusy(false);
        return;
      }
      const { contact } = await chatStore.startOrGetDirectThread({
        name: cleanHandle,
        handle: cleanHandle,
      });
      setNewOpen(false);
      setNewUser("");
      setActive(contact);
    } catch (err) {
      const e = err as Partial<ChatApiError>;
      const outcome = resolveOutcome({ status: e?.status, code: e?.code });
      if (outcome === "notFound") {
        setNewError(tr("messages.req.userNotFound"));
      } else {
        setNewError(errorText(err, true) ?? tr("messages.newChat.failed"));
      }
    } finally {
      setNewBusy(false);
    }
  };

  const openRouteEmbed = (title: string, stops: TripStop[]) => {
    tripStore.createRoute(title, stops);
    onOpenMap?.();
  };

  if (active) {
    const last = messages[messages.length - 1];
    return (
      <Screen
        keyboardAvoiding
        header={
          <ScreenHeader
            title={active.name}
            subtitle={active.username ? `@${active.username.replace(/^@/, "")}` : undefined}
            onPressTitle={() => setViewingProfile(active)}
            left={
              <IconButton
                icon="chevron-left"
                label={tr("messages.back")}
                onPress={() => setActive(null)}
              />
            }
            right={
              <IconButton
                icon="trash"
                label={tr("studio.sessions.delete")}
                onPress={() => setConfirmDelete(true)}
              />
            }
          />
        }
      >
        <MessageLog
          label={tr("messages.log").replace("{name}", active.name)}
          announcement={last && !last.isOutgoing ? last.text : undefined}
        >
          {messages.length === 0 ? (
            <Txt variant="small" tone="muted" align="center">
              {tr("messages.thread.empty")}
            </Txt>
          ) : (
            messages.map((m) => (
              <SwipeableMessage
                key={m.id}
                time={m.time}
                isOutgoing={m.isOutgoing}
                onDelete={() => setMsgToDelete(m)}
              >
                {m.text ? (
                  <MessageBubble role={m.isOutgoing ? "user" : "assistant"}>{m.text}</MessageBubble>
                ) : null}
                {m.routeEmbed ? (
                  <Card variant="bordered">
                    <View style={styles.cardBody}>
                      <Txt variant="heading">{m.routeEmbed.title}</Txt>
                      <Txt variant="caption" tone="muted">
                        {tr("trip.day.stops", { n: m.routeEmbed.stopsData.length })}
                      </Txt>
                      <Button
                        label={tr("home.lastTrip.open")}
                        variant="secondary"
                        size="sm"
                        onPress={() =>
                          openRouteEmbed(
                            m.routeEmbed!.title,
                            m.routeEmbed!.stopsData.map((s, i) => ({
                              id: s.id || `stop-${i}`,
                              name: s.name,
                              category: s.category || tr("native.place.defaultCategory"),
                              time: "",
                              duration: s.duration || "",
                              address: s.address || "",
                              lat: s.lat,
                              lng: s.lng,
                            })),
                          )
                        }
                      />
                    </View>
                  </Card>
                ) : null}
              </SwipeableMessage>
            ))
          )}
        </MessageLog>
        {serverIds[active.id]?.pendingOut && !threadError ? (
          <View style={styles.note} accessibilityLiveRegion="polite">
            <Txt variant="small" tone="muted">
              {tr("messages.req.sentNote")}
            </Txt>
          </View>
        ) : null}
        {threadError ? (
          <View style={styles.note} accessibilityRole="alert" accessibilityLiveRegion="assertive">
            <Txt variant="small" tone="danger">
              {threadError}
            </Txt>
          </View>
        ) : null}
        <View style={styles.composer}>
          <ComposerBar
            placeholder={tr("messages.composer")}
            label={tr("messages.composer")}
            onSubmit={async (text) => {
              setThreadError(null);
              if (!(await sendToServer(active, text))) return;
              await chatStore.sendMessage(active.id, { text, senderId: "me", senderName: me });
            }}
          />
        </View>
        <ConfirmDialog
          visible={confirmDelete}
          title={tr("native.chat.deleteTitle")}
          body={tr("native.chat.deleteBody")}
          confirmLabel={tr("community.delete.confirm")}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setConfirmDelete(false);
            await chatStore.deleteThread(active.id);
            setActive(null);
          }}
        />
        <ConfirmDialog
          visible={!!msgToDelete}
          title={"Mesajı Sil"}
          body={"Bu mesajı silmek istediğinize emin misiniz?"}
          confirmLabel={tr("community.delete.confirm")}
          onCancel={() => setMsgToDelete(null)}
          onConfirm={async () => {
            if (active && msgToDelete) {
              await chatStore.deleteMessage(active.id, msgToDelete.id);
              setMessages((prev) => prev.filter((x) => x.id !== msgToDelete.id));
            }
            setMsgToDelete(null);
          }}
        />
        {viewingProfile ? (
          <View style={StyleSheet.absoluteFill}>
            <PublicProfileView
              user={{
                name: viewingProfile.name,
                handle: viewingProfile.username?.replace(/^@/, "") || viewingProfile.name,
                avatar: viewingProfile.avatarUrl,
              }}
              posts={[]}
              onBack={() => setViewingProfile(null)}
            />
          </View>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen
      header={
        <ScreenHeader
          title={tr("messages.title")}
          right={
            // F (görev 11): sağ-üst + belirgin birincil eylem (dolu daire, birincil renk).
            <IconButton
              icon="plus"
              color={tokens.color.buttonPrimaryFg}
              label={tr("messages.new")}
              onPress={() => setNewOpen(true)}
              style={styles.newFab}
            />
          }
        />
      }
    >
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={tr("messages.search")}
          placeholderTextColor={tokens.color.fieldPlaceholder}
          accessibilityLabel={tr("messages.search")}
          maxFontSizeMultiplier={tokens.font.maxScale.body}
          style={[styles.search, { fontFamily: fontFamily("regular") }]}
        />
        {requests.incoming.length > 0 ||
        requests.outgoing.length > 0 ||
        requests.unknown.length > 0 ? (
          <View style={styles.requests} accessibilityRole="summary">
            <Txt variant="heading" header>
              {tr("messages.req.title", { n: requests.incoming.length })}
            </Txt>
            {listError ? (
              <View accessibilityRole="alert">
                <Txt variant="small" tone="danger">
                  {listError}
                </Txt>
              </View>
            ) : null}
            {requests.incoming.map((x) => (
              <Card key={x.threadId} variant="bordered">
                <View style={styles.cardBody}>
                  <Txt variant="label">{x.otherParticipant || tr("messages.req.someone")}</Txt>
                  <View style={styles.actions}>
                    <Button
                      label={tr("messages.req.accept")}
                      size="sm"
                      loading={busyRequest === x.threadId}
                      onPress={() => void respond(x, "accept")}
                    />
                    <Button
                      label={tr("messages.req.decline")}
                      size="sm"
                      variant="secondary"
                      disabled={busyRequest === x.threadId}
                      onPress={() => void respond(x, "decline")}
                    />
                    <Button
                      label={tr("messages.req.block")}
                      size="sm"
                      variant="ghost"
                      disabled={busyRequest === x.threadId}
                      onPress={() => void respond(x, "block")}
                    />
                  </View>
                </View>
              </Card>
            ))}
            {requests.outgoing.map((x) => (
              <Card key={x.threadId} variant="bordered">
                <View style={styles.row}>
                  <Txt variant="label" style={styles.flex}>
                    {x.otherParticipant || tr("messages.req.someone")}
                  </Txt>
                  <Txt variant="caption" tone="muted">
                    {tr("messages.req.pending")}
                  </Txt>
                </View>
              </Card>
            ))}
            {requests.unknown.map((x) => (
              <Card key={x.threadId} variant="bordered">
                <View style={styles.row}>
                  <Txt variant="label" style={styles.flex}>
                    {x.otherParticipant || tr("messages.req.someone")}
                  </Txt>
                  <Txt variant="caption" tone="muted">
                    {tr("messages.req.unknown")}
                  </Txt>
                </View>
              </Card>
            ))}
          </View>
        ) : null}
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Txt variant="heading" header>
              {query.trim() ? tr("messages.empty.search") : tr("messages.empty.title")}
            </Txt>
            <Txt variant="small" tone="muted">
              {query.trim() ? tr("messages.empty.searchBody") : tr("messages.empty.body")}
            </Txt>
            {/* F (görev 11): sohbet yokken tek çağrı "mesajlaşmayı başlat"; sohbet varken
                (filtered dolu) bu blok render edilmez, orta düğme kalkar. */}
            {!query.trim() ? (
              <Button label={tr("messages.start")} onPress={() => setNewOpen(true)} />
            ) : null}
          </View>
        ) : (
          filtered.map((c) => (
            <Card
              key={c.id}
              variant="bordered"
              label={`${c.name}, ${c.lastMessageSnippet}`}
              onPress={() => setActive(c)}
            >
              <View style={styles.row}>
                <Avatar name={c.name} uri={c.avatarUrl} />
                <View style={styles.flex}>
                  <Txt variant="label" numberOfLines={1}>
                    {c.name}
                  </Txt>
                  <Txt variant="caption" tone="muted" numberOfLines={1}>
                    {c.lastMessageSnippet}
                  </Txt>
                </View>
                <Txt variant="caption" tone="subtle">
                  {c.lastMessageTime}
                </Txt>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
      <ModalFrame
        visible={newOpen}
        variant="sheet"
        title={tr("messages.newChat.title")}
        onRequestClose={() => setNewOpen(false)}
      >
        {/* F (görev 12): üstte arama, altında kişiler (foto + ad + en sağda "Mesaj at").
            Yazdıkça username/ad'a göre filtrelenir; eşleşen kişi yoksa "yeni kişiye yaz" satırı. */}
        <View style={styles.form}>
          <TextField
            label={tr("messages.newChat.user")}
            hint={tr("messages.newChat.searchHint")}
            value={newUser}
            onChangeText={(text) => {
              setNewUser(text);
              if (newError) setNewError(undefined);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={40}
          />
          {newError ? (
            <View accessibilityRole="alert">
              <Txt variant="small" tone="danger">
                {newError}
              </Txt>
            </View>
          ) : null}
          {newUser.trim() && newChatContacts.length === 0 ? (
            <Notice tone="danger" title={tr("messages.req.userNotFound")}>
              {tr("messages.req.userNotFound")}
            </Notice>
          ) : null}
          {!newUser.trim() && newChatContacts.length === 0 ? (
            <Txt variant="small" tone="muted">
              {tr("messages.newChat.noContacts")}
            </Txt>
          ) : (
            newChatContacts.map((c) => (
              <Card key={c.id} variant="bordered">
                <View style={styles.row}>
                  <Avatar name={c.name} uri={c.avatarUrl} />
                  <View style={styles.flex}>
                    <Txt variant="label" numberOfLines={1}>
                      {c.name}
                    </Txt>
                    <Txt variant="caption" tone="muted" numberOfLines={1}>
                      {c.username ? `@${c.username}` : ""}
                    </Txt>
                  </View>
                  <IconButton
                    icon="send"
                    label={tr("messages.newChat.sendAction")}
                    onPress={() => openExisting(c)}
                  />
                </View>
              </Card>
            ))
          )}
        </View>
      </ModalFrame>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { padding: tokens.space["4"], gap: tokens.space["3"], paddingBottom: tokens.space["12"] },
  search: {
    minHeight: tokens.touch.min,
    paddingHorizontal: tokens.space["4"],
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    borderColor: tokens.color.fieldBorder,
    backgroundColor: tokens.color.fieldBg,
    color: tokens.color.fieldFg,
    fontSize: tokens.font.size.md,
  },
  newFab: { backgroundColor: tokens.color.buttonPrimaryBg, borderRadius: tokens.radius.full },
  empty: { gap: tokens.space["3"], paddingVertical: tokens.space["8"] },
  row: { flexDirection: "row", alignItems: "center", gap: tokens.space["3"] },
  flex: { flex: 1, gap: tokens.space["1"] },
  msg: { gap: tokens.space["1"], flex: 1 },
  msgSwipeWrap: { position: "relative", width: "100%" },
  swipeDeleteAction: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 50,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  timeOut: { textAlign: "right" },
  cardBody: { gap: tokens.space["2"] },
  composer: {
    padding: tokens.space["3"],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.border,
    backgroundColor: tokens.color.composerBg,
  },
  form: { padding: tokens.space["5"], gap: tokens.space["4"] },
  requests: { gap: tokens.space["2"] },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space["2"] },
  note: { paddingHorizontal: tokens.space["4"], paddingVertical: tokens.space["2"] },
});
