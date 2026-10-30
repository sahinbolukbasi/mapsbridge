import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Image,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { tripStore, TripStop } from "../services/tripStore";
import { authService } from "../services/api";
import { chatStore, ChatContact, ChatBubbleItem, RouteEmbedData } from "../services/chatStore";
import {
  ChatIcon,
  SearchIcon,
  MapIcon,
  BalloonIcon,
  MountainIcon,
} from "../components/Icons";

import { Screen } from "../ui";
import { tokens, withAlpha } from "../theme";
interface ChatScreenProps {
  onGoBack?: () => void;
  onOpenMap?: () => void;
  initialThreadId?: string;
  initialContact?: ChatContact;
  initialViewMode?: "list" | "detail";
}

export function ChatScreen({
  onGoBack,
  onOpenMap,
  initialThreadId,
  initialContact,
  initialViewMode = "list",
}: ChatScreenProps) {
  const [viewMode, setViewMode] = useState<"list" | "detail">(
    initialContact || initialThreadId || initialViewMode === "detail" ? "detail" : "list",
  );
  const [contacts, setContacts] = useState<ChatContact[]>(initialContact ? [initialContact] : []);
  const [activeContact, setActiveContact] = useState<ChatContact | null>(initialContact || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilterTab, setActiveFilterTab] = useState<"all" | "direct" | "groups">("all");

  // Active Thread Message State
  const [messages, setMessages] = useState<ChatBubbleItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [activeUsername, setActiveUsername] = useState("gezgin");

  const scrollRef = useRef<ScrollView>(null);

  // ── Load Threads & User Session ───────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const session = await authService.getSession();
      if (session?.email) {
        setActiveUsername(session.email.split("@")[0]);
      }

      const threads = await chatStore.getThreads();
      if (initialContact && !threads.some((t) => t.id === initialContact.id)) {
        setContacts([initialContact, ...threads]);
      } else {
        setContacts(threads);
      }

      if (initialThreadId && !activeContact) {
        const found = threads.find((t) => t.id === initialThreadId);
        if (found) {
          setActiveContact(found);
          setViewMode("detail");
        }
      }
    }
    init();

    const unsubThreads = chatStore.subscribeThreads((updated) => {
      setContacts(updated);
    });

    return () => unsubThreads();
  }, [initialThreadId, initialContact]);

  // ── Load Messages For Active Thread ───────────────────────────────────────
  useEffect(() => {
    if (!activeContact) return;

    chatStore.getMessages(activeContact.id).then((msgs) => {
      setMessages(msgs);
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      }, 50);
    });

    const unsubMessages = chatStore.subscribeMessages(activeContact.id, (updated) => {
      setMessages(updated);
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 50);
    });

    return () => unsubMessages();
  }, [activeContact]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleOpenConversation = (contact: ChatContact) => {
    setActiveContact(contact);
    setViewMode("detail");
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeContact) return;
    const text = inputText.trim();
    setInputText("");

    await chatStore.sendMessage(activeContact.id, {
      text,
      senderId: "me",
      senderName: activeUsername,
    });
  };

  const handleCloneRouteToDesk = (route: RouteEmbedData) => {
    tripStore.loadRouteFromExternal(route.title, route.stopsData as unknown as TripStop[]);
    Alert.alert(
      "🗺️ Masama Klonlandı",
      `"${route.title}" rotası ve ${route.stopsData.length} durak seyahat masanıza başarıyla aktarıldı!`,
    );
  };

  const handleInspectRouteOnMap = (route: RouteEmbedData) => {
    tripStore.loadRouteFromExternal(route.title, route.stopsData as unknown as TripStop[]);
    if (onOpenMap) onOpenMap();
  };

  const renderContactAvatar = (contact: ChatContact, size = 46) => {
    if (contact.avatarUrl) {
      return (
        <Image
          source={{ uri: contact.avatarUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      );
    }

    if (contact.id.includes("kpd")) {
      return (
        <View
          style={[
            styles.avatarFallbackBase,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: tokens.color.successStrong },
          ]}
        >
          <BalloonIcon size={size * 0.48} color={tokens.color.onPrimary} />
        </View>
      );
    }

    if (contact.id.includes("likya")) {
      return (
        <View
          style={[
            styles.avatarFallbackBase,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: tokens.color.brand },
          ]}
        >
          <MountainIcon size={size * 0.48} color={tokens.color.onPrimary} />
        </View>
      );
    }

    return (
      <View
        style={[
          styles.avatarFallbackBase,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: tokens.color.success },
        ]}
      >
        <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={[styles.avatarFallbackLetter, { fontSize: size * 0.38 }]}>
          {contact.avatarText || contact.name.slice(0, 2).toUpperCase()}
        </Text>
      </View>
    );
  };

  const filteredContacts = contacts.filter((c) => {
    if (activeFilterTab === "direct" && c.isGroup) return false;
    if (activeFilterTab === "groups" && !c.isGroup) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchRole = c.role.toLowerCase().includes(q);
      const matchSnippet = c.lastMessageSnippet.toLowerCase().includes(q);
      return matchName || matchRole || matchSnippet;
    }
    return true;
  });

  const directCount = contacts.filter((c) => !c.isGroup).length;
  const groupsCount = contacts.filter((c) => c.isGroup).length;

  // ==========================================
  // VIEW 1: SOHBETLER / GELEN KUTUSU LİSTESİ
  // ==========================================
  if (viewMode === "list") {
    return (
      <Screen style={styles.container}>
        {/* Top Header */}
        <View style={styles.inboxHeader}>
          <View style={styles.inboxHeaderLeft}>
            {onGoBack && (
              <TouchableOpacity style={styles.inboxBackBtn} onPress={onGoBack} activeOpacity={0.7}>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.inboxBackBtnIcon}>‹</Text>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.inboxBackBtnLabel}>Geri</Text>
              </TouchableOpacity>
            )}

            <View style={{ marginLeft: onGoBack ? 4 : 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.inboxHeaderTitle}>Gezgin Sohbetleri</Text>
                <View style={styles.liveNetworkPill}>
                  <View style={styles.livePulseDot} />
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.liveNetworkText}>CANLI</Text>
                </View>
              </View>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.inboxHeaderSub}>
                {contacts.length > 0
                  ? `${contacts.length} Aktif Bağlantı`
                  : "Gezgin mesajlaşma ağı"}
              </Text>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchBox}>
            <View style={{ marginRight: 6 }}>
              <SearchIcon size={16} color={tokens.color.textSubtle} />
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Gezgin veya sohbet ara..."
              placeholderTextColor={tokens.color.neutral400}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ fontSize: 14, color: tokens.color.neutral400, paddingHorizontal: 4 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Segmented Filter Pills */}
        <View style={styles.filterPillsRow}>
          <TouchableOpacity
            style={[styles.filterPill, activeFilterTab === "all" && styles.filterPillActive]}
            onPress={() => setActiveFilterTab("all")}
            activeOpacity={0.8}
          >
            <Text maxFontSizeMultiplier={tokens.font.maxScale.compact}
              style={[
                styles.filterPillText,
                activeFilterTab === "all" && styles.filterPillTextActive,
              ]}
            >
              Tümü ({contacts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, activeFilterTab === "direct" && styles.filterPillActive]}
            onPress={() => setActiveFilterTab("direct")}
            activeOpacity={0.8}
          >
            <Text maxFontSizeMultiplier={tokens.font.maxScale.compact}
              style={[
                styles.filterPillText,
                activeFilterTab === "direct" && styles.filterPillTextActive,
              ]}
            >
              Birebir ({directCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, activeFilterTab === "groups" && styles.filterPillActive]}
            onPress={() => setActiveFilterTab("groups")}
            activeOpacity={0.8}
          >
            <Text maxFontSizeMultiplier={tokens.font.maxScale.compact}
              style={[
                styles.filterPillText,
                activeFilterTab === "groups" && styles.filterPillTextActive,
              ]}
            >
              Gruplar ({groupsCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Conversations List */}
        <ScrollView
          style={styles.inboxList}
          contentContainerStyle={styles.inboxListContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredContacts.length === 0 ? (
            <View style={styles.emptyInboxContainer}>
              <View style={styles.emptyIconCircle}>
                <ChatIcon size={28} color={tokens.color.successStrong} />
              </View>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.emptyInboxTitle}>Henüz mesajınız yok</Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.emptyInboxSub}>
                Topluluk akışındaki gezginlerin veya rehberlerin profiline girip "Mesaj Gönder"
                butonuna basarak anında sohbet başlatabilirsiniz!
              </Text>
              {onGoBack && (
                <TouchableOpacity style={styles.exploreLinkBtn} onPress={onGoBack}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.exploreLinkBtnText}>← Topluluğa Göz At</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredContacts.map((contact) => {
              const hasUnread = contact.unreadCount > 0;
              return (
                <TouchableOpacity
                  key={contact.id}
                  style={[styles.conversationCard, hasUnread && styles.conversationCardUnread]}
                  onPress={() => handleOpenConversation(contact)}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardAvatarCol}>
                    {renderContactAvatar(contact, 48)}
                    {contact.online && <View style={styles.cardOnlineDot} />}
                  </View>

                  <View style={styles.cardCenterCol}>
                    <View style={styles.cardTopRow}>
                      <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.cardName} numberOfLines={1}>
                        {contact.name}
                      </Text>
                      <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.cardTime}>{contact.lastMessageTime}</Text>
                    </View>

                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.cardRole} numberOfLines={1}>
                      {contact.role}
                    </Text>

                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={[styles.cardSnippet, hasUnread && styles.cardSnippetUnread]}
                      numberOfLines={1}
                    >
                      {contact.lastMessageSnippet}
                    </Text>
                  </View>

                  {hasUnread && (
                    <View style={styles.cardBadgeWrap}>
                      <View style={styles.cardBadge}>
                        <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.cardBadgeText}>{contact.unreadCount}</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </Screen>
    );
  }

  // ==========================================
  // VIEW 2: BİRE BİR / GRUP SOHBET DETAYI
  // ==========================================
  return (
    <Screen style={styles.container} background="surface">
      {/* Detail Header Bar */}
      <View style={styles.detailHeader}>
        <TouchableOpacity
          style={styles.detailBackBtn}
          onPress={() => {
            if (contacts.length > 0) {
              setViewMode("list");
            } else if (onGoBack) {
              onGoBack();
            } else {
              setViewMode("list");
            }
          }}
          activeOpacity={0.7}
        >
          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.detailBackIcon}>‹</Text>
        </TouchableOpacity>

        {activeContact && (
          <View style={styles.detailUserWrap}>
            {renderContactAvatar(activeContact, 38)}
            <View style={{ marginLeft: 10, flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.detailUserName} numberOfLines={1}>
                  {activeContact.name}
                </Text>
                {activeContact.online && <View style={styles.onlinePillDot} />}
              </View>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.detailUserSub} numberOfLines={1}>
                {activeContact.role}
              </Text>
            </View>
          </View>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
        style={{ flex: 1 }}
      >
        {/* Messages Stream */}
        <ScrollView
          ref={scrollRef}
          style={styles.messagesScroll}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyMessagesWrap}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.emptyMessagesTitle}>Sohbet Başladı 👋</Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.emptyMessagesSub}>
                {activeContact?.name} kullanıcısına ilk mesajınızı gönderin ve seyahat rotalarınızı
                paylaşın!
              </Text>
            </View>
          ) : (
            messages.map((item) => {
              const isMe = item.isOutgoing;
              return (
                <View
                  key={item.id}
                  style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}
                >
                  {!isMe && activeContact && (
                    <View style={styles.bubbleAvatarCol}>
                      {renderContactAvatar(activeContact, 28)}
                    </View>
                  )}

                  <View
                    style={[
                      styles.bubbleBox,
                      isMe ? styles.bubbleBoxMe : styles.bubbleBoxThem,
                      item.routeEmbed && styles.bubbleBoxWithRoute,
                    ]}
                  >
                    {/* Route Attachment Card */}
                    {item.routeEmbed && (
                      <View style={styles.embedRouteCard}>
                        <View style={styles.embedRouteTopRow}>
                          <View style={styles.embedRouteIconBadge}>
                            <MapIcon size={14} color={tokens.color.successStrong} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.embedRouteTitle} numberOfLines={1}>
                              {item.routeEmbed.title}
                            </Text>
                            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.embedRouteSub}>
                              {item.routeEmbed.days} • {item.routeEmbed.stopsCount} Durak
                            </Text>
                          </View>
                        </View>

                        <View style={styles.embedRouteActions}>
                          <TouchableOpacity
                            style={styles.embedActionBtn}
                            onPress={() => handleCloneRouteToDesk(item.routeEmbed!)}
                          >
                            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.embedActionBtnText}>Masama Klonla</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.embedActionBtn, styles.embedActionBtnSecondary]}
                            onPress={() => handleInspectRouteOnMap(item.routeEmbed!)}
                          >
                            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.embedActionBtnTextSecondary}>Haritada Gör →</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* Text Message */}
                    {item.text ? (
                      <Text maxFontSizeMultiplier={tokens.font.maxScale.body}
                        style={[
                          styles.bubbleText,
                          isMe ? styles.bubbleTextMe : styles.bubbleTextThem,
                        ]}
                      >
                        {item.text}
                      </Text>
                    ) : null}

                    {/* Message Meta (Time & Read status) */}
                    <View style={styles.bubbleMetaRow}>
                      <Text maxFontSizeMultiplier={tokens.font.maxScale.body}
                        style={[
                          styles.bubbleTime,
                          isMe ? styles.bubbleTimeMe : styles.bubbleTimeThem,
                        ]}
                      >
                        {item.time}
                      </Text>
                      {isMe && <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.readCheck}>✓✓</Text>}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.inputField}
            placeholder="Mesajınızı yazın..."
            placeholderTextColor={tokens.color.neutral400}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />

          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={handleSendMessage}
            disabled={!inputText.trim()}
            activeOpacity={0.8}
          >
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.sendBtnText}>Gönder</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.bg,
  },
  inboxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: tokens.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
  },
  inboxHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  inboxBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 10,
    paddingVertical: 4,
  },
  inboxBackBtnIcon: {
    fontSize: 26,
    color: tokens.color.text,
    lineHeight: 28,
  },
  inboxBackBtnLabel: {
    fontSize: 14,
    color: tokens.color.text,
    fontWeight: "600",
    marginLeft: 2,
  },
  inboxHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: tokens.color.text,
    letterSpacing: -0.3,
  },
  liveNetworkPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: tokens.color.surfaceBrand,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.color.successBorder,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.color.accent,
  },
  liveNetworkText: {
    fontSize: 9,
    fontWeight: "800",
    color: tokens.color.success,
  },
  inboxHeaderSub: {
    fontSize: 12,
    color: tokens.color.textSubtle,
    marginTop: 2,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.color.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.color.border,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: tokens.color.text,
  },
  filterPillsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  filterPillActive: {
    backgroundColor: tokens.color.successStrong,
    borderColor: tokens.color.successStrong,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: tokens.color.textSubtle,
  },
  filterPillTextActive: {
    color: tokens.color.onPrimary,
    fontWeight: "700",
  },
  inboxList: {
    flex: 1,
  },
  inboxListContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  conversationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.color.surface,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: tokens.color.border,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  conversationCardUnread: {
    backgroundColor: tokens.color.surfaceBrand,
    borderColor: tokens.color.successBorder,
  },
  cardAvatarCol: {
    position: "relative",
    marginRight: 12,
  },
  cardOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: tokens.color.accent,
    borderWidth: 2,
    borderColor: tokens.color.neutral0,
  },
  cardCenterCol: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  cardName: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.color.text,
  },
  cardTime: {
    fontSize: 11,
    color: tokens.color.neutral400,
  },
  cardRole: {
    fontSize: 11,
    color: tokens.color.successStrong,
    fontWeight: "600",
    marginBottom: 2,
  },
  cardSnippet: {
    fontSize: 12,
    color: tokens.color.textSubtle,
  },
  cardSnippetUnread: {
    color: tokens.color.text,
    fontWeight: "700",
  },
  cardBadgeWrap: {
    marginLeft: 8,
  },
  cardBadge: {
    backgroundColor: tokens.color.successStrong,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cardBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: tokens.color.onPrimary,
  },
  emptyInboxContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: tokens.color.surfaceBrand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: tokens.color.successBorder,
  },
  emptyInboxTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: tokens.color.text,
    marginBottom: 6,
  },
  emptyInboxSub: {
    fontSize: 13,
    color: tokens.color.textSubtle,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  exploreLinkBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: tokens.color.successStrong,
    borderRadius: 12,
  },
  exploreLinkBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: tokens.color.onPrimary,
  },

  // ── Detail View Styles ──
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: tokens.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
  },
  detailBackBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  detailBackIcon: {
    fontSize: 28,
    color: tokens.color.text,
    lineHeight: 30,
  },
  detailUserWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginLeft: 4,
  },
  detailUserName: {
    fontSize: 15,
    fontWeight: "700",
    color: tokens.color.text,
  },
  onlinePillDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: tokens.color.accent,
  },
  detailUserSub: {
    fontSize: 11,
    color: tokens.color.textSubtle,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  emptyMessagesWrap: {
    alignItems: "center",
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyMessagesTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: tokens.color.text,
    marginBottom: 6,
  },
  emptyMessagesSub: {
    fontSize: 13,
    color: tokens.color.textSubtle,
    textAlign: "center",
    lineHeight: 18,
  },
  bubbleRow: {
    flexDirection: "row",
    marginBottom: 12,
    maxWidth: "85%",
  },
  bubbleRowMe: {
    alignSelf: "flex-end",
    flexDirection: "row-reverse",
  },
  bubbleRowThem: {
    alignSelf: "flex-start",
  },
  bubbleAvatarCol: {
    marginRight: 8,
    alignSelf: "flex-end",
  },
  bubbleBox: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleBoxMe: {
    backgroundColor: tokens.color.successStrong,
    borderBottomRightRadius: 4,
  },
  bubbleBoxThem: {
    backgroundColor: tokens.color.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  bubbleBoxWithRoute: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bubbleText: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  bubbleTextMe: {
    color: tokens.color.onPrimary,
  },
  bubbleTextThem: {
    color: tokens.color.text,
  },
  bubbleMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 4,
  },
  bubbleTime: {
    fontSize: 10,
  },
  bubbleTimeMe: {
    color: withAlpha(tokens.color.onPrimary, 0.7),
  },
  bubbleTimeThem: {
    color: tokens.color.neutral400,
  },
  readCheck: {
    fontSize: 9,
    color: withAlpha(tokens.color.onPrimary, 0.8),
    fontWeight: "800",
  },
  embedRouteCard: {
    backgroundColor: tokens.color.surfaceBrand,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: tokens.color.successBorder,
  },
  embedRouteTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  embedRouteIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: tokens.color.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tokens.color.successBorder,
  },
  embedRouteTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: tokens.color.onSurfaceBrand,
  },
  embedRouteSub: {
    fontSize: 11,
    color: tokens.color.success,
  },
  embedRouteActions: {
    flexDirection: "row",
    gap: 6,
  },
  embedActionBtn: {
    flex: 1,
    backgroundColor: tokens.color.successStrong,
    borderRadius: 8,
    paddingVertical: 5,
    alignItems: "center",
  },
  embedActionBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.color.onPrimary,
  },
  embedActionBtnSecondary: {
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.successBorder,
  },
  embedActionBtnTextSecondary: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.color.successStrong,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: tokens.color.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
    gap: 8,
  },
  inputField: {
    flex: 1,
    backgroundColor: tokens.color.surfaceSunken,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: tokens.color.text,
    maxHeight: 90,
  },
  sendBtn: {
    backgroundColor: tokens.color.successStrong,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: tokens.color.onPrimary,
  },
  avatarFallbackBase: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackLetter: {
    color: tokens.color.onPrimary,
    fontWeight: "800",
  },
});
