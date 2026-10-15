import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Image,
  KeyboardAvoidingView,
  Alert,
  StatusBar,
} from "react-native";
import { tripStore } from "../services/tripStore";
import { authService } from "../services/api";
import { chatStore, ChatContact, ChatBubbleItem, RouteEmbedData } from "../services/chatStore";
import {
  ChatIcon,
  SearchIcon,
  EditIcon,
  MapIcon,
  PinIcon,
  CalendarIcon,
  BalloonIcon,
  MountainIcon,
} from "../components/Icons";

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
    tripStore.loadRouteFromExternal(route.title, route.stopsData as any);
    Alert.alert(
      "🗺️ Masama Klonlandı",
      `"${route.title}" rotası ve ${route.stopsData.length} durak seyahat masanıza başarıyla aktarıldı!`,
    );
  };

  const handleInspectRouteOnMap = (route: RouteEmbedData) => {
    tripStore.loadRouteFromExternal(route.title, route.stopsData as any);
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
            { width: size, height: size, borderRadius: size / 2, backgroundColor: "#059669" },
          ]}
        >
          <BalloonIcon size={size * 0.48} color="#ffffff" />
        </View>
      );
    }

    if (contact.id.includes("likya")) {
      return (
        <View
          style={[
            styles.avatarFallbackBase,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: "#0f766e" },
          ]}
        >
          <MountainIcon size={size * 0.48} color="#ffffff" />
        </View>
      );
    }

    return (
      <View
        style={[
          styles.avatarFallbackBase,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: "#047857" },
        ]}
      >
        <Text style={[styles.avatarFallbackLetter, { fontSize: size * 0.38 }]}>
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
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#faf8ff" />

        {/* Top Header */}
        <View style={styles.inboxHeader}>
          <View style={styles.inboxHeaderLeft}>
            {onGoBack && (
              <TouchableOpacity style={styles.inboxBackBtn} onPress={onGoBack} activeOpacity={0.7}>
                <Text style={styles.inboxBackBtnIcon}>‹</Text>
                <Text style={styles.inboxBackBtnLabel}>Geri</Text>
              </TouchableOpacity>
            )}

            <View style={{ marginLeft: onGoBack ? 4 : 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.inboxHeaderTitle}>Gezgin Sohbetleri</Text>
                <View style={styles.liveNetworkPill}>
                  <View style={styles.livePulseDot} />
                  <Text style={styles.liveNetworkText}>CANLI</Text>
                </View>
              </View>
              <Text style={styles.inboxHeaderSub}>
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
              <SearchIcon size={16} color="#64748b" />
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Gezgin veya sohbet ara..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Text style={{ fontSize: 14, color: "#94a3b8", paddingHorizontal: 4 }}>✕</Text>
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
            <Text
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
            <Text
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
            <Text
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
                <ChatIcon size={28} color="#059669" />
              </View>
              <Text style={styles.emptyInboxTitle}>Henüz mesajınız yok</Text>
              <Text style={styles.emptyInboxSub}>
                Keşfet akışındaki gezginlerin veya rehberlerin profiline girip "Mesaj Gönder"
                butonuna basarak anında sohbet başlatabilirsiniz!
              </Text>
              {onGoBack && (
                <TouchableOpacity style={styles.exploreLinkBtn} onPress={onGoBack}>
                  <Text style={styles.exploreLinkBtnText}>← Keşfet'e Göz At</Text>
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
                      <Text style={styles.cardName} numberOfLines={1}>
                        {contact.name}
                      </Text>
                      <Text style={styles.cardTime}>{contact.lastMessageTime}</Text>
                    </View>

                    <Text style={styles.cardRole} numberOfLines={1}>
                      {contact.role}
                    </Text>

                    <Text
                      style={[styles.cardSnippet, hasUnread && styles.cardSnippetUnread]}
                      numberOfLines={1}
                    >
                      {contact.lastMessageSnippet}
                    </Text>
                  </View>

                  {hasUnread && (
                    <View style={styles.cardBadgeWrap}>
                      <View style={styles.cardBadge}>
                        <Text style={styles.cardBadgeText}>{contact.unreadCount}</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ==========================================
  // VIEW 2: BİRE BİR / GRUP SOHBET DETAYI
  // ==========================================
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

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
          <Text style={styles.detailBackIcon}>‹</Text>
        </TouchableOpacity>

        {activeContact && (
          <View style={styles.detailUserWrap}>
            {renderContactAvatar(activeContact, 38)}
            <View style={{ marginLeft: 10, flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={styles.detailUserName} numberOfLines={1}>
                  {activeContact.name}
                </Text>
                {activeContact.online && <View style={styles.onlinePillDot} />}
              </View>
              <Text style={styles.detailUserSub} numberOfLines={1}>
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
              <Text style={styles.emptyMessagesTitle}>Sohbet Başladı 👋</Text>
              <Text style={styles.emptyMessagesSub}>
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
                            <MapIcon size={14} color="#059669" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.embedRouteTitle} numberOfLines={1}>
                              {item.routeEmbed.title}
                            </Text>
                            <Text style={styles.embedRouteSub}>
                              {item.routeEmbed.days} • {item.routeEmbed.stopsCount} Durak
                            </Text>
                          </View>
                        </View>

                        <View style={styles.embedRouteActions}>
                          <TouchableOpacity
                            style={styles.embedActionBtn}
                            onPress={() => handleCloneRouteToDesk(item.routeEmbed!)}
                          >
                            <Text style={styles.embedActionBtnText}>Masama Klonla</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.embedActionBtn, styles.embedActionBtnSecondary]}
                            onPress={() => handleInspectRouteOnMap(item.routeEmbed!)}
                          >
                            <Text style={styles.embedActionBtnTextSecondary}>Haritada Gör →</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* Text Message */}
                    {item.text ? (
                      <Text
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
                      <Text
                        style={[
                          styles.bubbleTime,
                          isMe ? styles.bubbleTimeMe : styles.bubbleTimeThem,
                        ]}
                      >
                        {item.time}
                      </Text>
                      {isMe && <Text style={styles.readCheck}>✓✓</Text>}
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
            placeholderTextColor="#94a3b8"
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
            <Text style={styles.sendBtnText}>Gönder</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8faf9",
  },
  inboxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
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
    color: "#0f172a",
    lineHeight: 28,
  },
  inboxBackBtnLabel: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "600",
    marginLeft: 2,
  },
  inboxHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  liveNetworkPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  liveNetworkText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#047857",
  },
  inboxHeaderSub: {
    fontSize: 12,
    color: "#64748b",
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
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
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
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterPillActive: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  filterPillTextActive: {
    color: "#ffffff",
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
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  conversationCardUnread: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
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
    backgroundColor: "#10b981",
    borderWidth: 2,
    borderColor: "#ffffff",
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
    color: "#0f172a",
  },
  cardTime: {
    fontSize: 11,
    color: "#94a3b8",
  },
  cardRole: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "600",
    marginBottom: 2,
  },
  cardSnippet: {
    fontSize: 12,
    color: "#64748b",
  },
  cardSnippetUnread: {
    color: "#0f172a",
    fontWeight: "700",
  },
  cardBadgeWrap: {
    marginLeft: 8,
  },
  cardBadge: {
    backgroundColor: "#059669",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cardBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#ffffff",
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
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  emptyInboxTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  emptyInboxSub: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  exploreLinkBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: "#059669",
    borderRadius: 12,
  },
  exploreLinkBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },

  // ── Detail View Styles ──
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  detailBackBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  detailBackIcon: {
    fontSize: 28,
    color: "#0f172a",
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
    color: "#0f172a",
  },
  onlinePillDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10b981",
  },
  detailUserSub: {
    fontSize: 11,
    color: "#64748b",
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
    color: "#0f172a",
    marginBottom: 6,
  },
  emptyMessagesSub: {
    fontSize: 13,
    color: "#64748b",
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
    backgroundColor: "#059669",
    borderBottomRightRadius: 4,
  },
  bubbleBoxThem: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
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
    color: "#ffffff",
  },
  bubbleTextThem: {
    color: "#0f172a",
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
    color: "rgba(255,255,255,0.7)",
  },
  bubbleTimeThem: {
    color: "#94a3b8",
  },
  readCheck: {
    fontSize: 9,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "800",
  },
  embedRouteCard: {
    backgroundColor: "#ecfdf5",
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#a7f3d0",
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
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  embedRouteTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#065f46",
  },
  embedRouteSub: {
    fontSize: 11,
    color: "#047857",
  },
  embedRouteActions: {
    flexDirection: "row",
    gap: 6,
  },
  embedActionBtn: {
    flex: 1,
    backgroundColor: "#059669",
    borderRadius: 8,
    paddingVertical: 5,
    alignItems: "center",
  },
  embedActionBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
  },
  embedActionBtnSecondary: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  embedActionBtnTextSecondary: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    gap: 8,
  },
  inputField: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0f172a",
    maxHeight: 90,
  },
  sendBtn: {
    backgroundColor: "#059669",
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
    color: "#ffffff",
  },
  avatarFallbackBase: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackLetter: {
    color: "#ffffff",
    fontWeight: "800",
  },
});
