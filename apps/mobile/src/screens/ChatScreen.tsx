import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { tripStore, type TripStop } from "../services/tripStore";
import { authService } from "../services/api";
import { chatStore, type ChatBubbleItem, type ChatContact } from "../services/chatStore";
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
  Screen,
  ScreenHeader,
  TextField,
  Txt,
  useBackHandler,
} from "../ui";
import { tr } from "../i18n/ui";
import { fontFamily, tokens } from "../theme";

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
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let alive = true;
    authService.getSession().then((s) => {
      if (alive && s?.email) setMe(s.email.split("@")[0]);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return contacts;
    return contacts.filter((c) => `${c.name} ${c.username}`.toLocaleLowerCase("tr-TR").includes(q));
  }, [contacts, query]);

  const startNew = async () => {
    const handle = newUser.trim().replace(/^@/, "");
    if (!/[a-z0-9]/i.test(handle)) {
      setNewError(tr("messages.newChat.required"));
      return;
    }
    const { contact } = await chatStore.startOrGetDirectThread({ name: handle, handle });
    setNewOpen(false);
    setNewUser("");
    setNewError(undefined);
    setActive(contact);
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
            subtitle={active.username}
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
              <View key={m.id} style={styles.msg}>
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
                <Txt
                  variant="caption"
                  tone="subtle"
                  style={m.isOutgoing ? styles.timeOut : undefined}
                >
                  {m.time}
                </Txt>
              </View>
            ))
          )}
        </MessageLog>
        <View style={styles.composer}>
          <ComposerBar
            placeholder={tr("messages.composer")}
            label={tr("messages.composer")}
            onSubmit={(text) =>
              chatStore.sendMessage(active.id, { text, senderId: "me", senderName: me })
            }
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
      </Screen>
    );
  }

  return (
    <Screen
      header={
        <ScreenHeader
          title={tr("messages.title")}
          right={
            <IconButton icon="plus" label={tr("messages.new")} onPress={() => setNewOpen(true)} />
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
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Txt variant="heading" header>
              {query.trim() ? tr("messages.empty.search") : tr("messages.empty.title")}
            </Txt>
            <Txt variant="small" tone="muted">
              {query.trim() ? tr("messages.empty.searchBody") : tr("messages.empty.body")}
            </Txt>
            {!query.trim() ? (
              <Button label={tr("messages.new")} onPress={() => setNewOpen(true)} />
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
        <View style={styles.form}>
          <TextField
            label={tr("messages.newChat.user")}
            value={newUser}
            onChangeText={(text) => {
              setNewUser(text);
              if (newError) setNewError(undefined);
            }}
            error={newError}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={40}
          />
          <Button label={tr("messages.newChat.start")} size="lg" onPress={startNew} />
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
  empty: { gap: tokens.space["3"], paddingVertical: tokens.space["8"] },
  row: { flexDirection: "row", alignItems: "center", gap: tokens.space["3"] },
  flex: { flex: 1, gap: tokens.space["1"] },
  msg: { gap: tokens.space["1"] },
  timeOut: { textAlign: "right" },
  cardBody: { gap: tokens.space["2"] },
  composer: {
    padding: tokens.space["3"],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.border,
    backgroundColor: tokens.color.composerBg,
  },
  form: { padding: tokens.space["5"], gap: tokens.space["4"] },
});
