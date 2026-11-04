"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getStoredSession } from "../lib/cognito";
import { useAuth } from "../lib/auth-context";
import { useWS } from "../lib/ws-context";
import { FullPagePromotion } from "../components/auth-gate";
import "./messages.css";

import type {
  ChatMessage,
  ChatConversation,
  TravelerContact,
  GroupTopicRoute,
} from "../features/messaging/types";
import { DEFAULT_TRAVELER_CONTACTS, PRESET_GROUP_ROUTES } from "../features/messaging/mock-data";
import { PageHeader, PageShell } from "../components/ui";

export default function MessagesPage() {
  const { user, isAuthenticated: authOk, isLoading: authLoading } = useAuth();
  const { on: wsOn, send: wsSend } = useWS();
  const [_mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activeUserName, setActiveUserName] = useState("Gezgin");
  const [activeUserHandle, setActiveUserHandle] = useState("gezgin");
  const [activeFilter, setActiveFilter] = useState<"all" | "groups" | "direct" | "archive">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChatId, setActiveChatId] = useState("");
  const [mobilePane, setMobilePane] = useState<"list" | "chat" | "details">("list");
  useEffect(() => {
    if (activeChatId) setMobilePane("chat");
  }, [activeChatId]);
  const [inputText, setInputText] = useState("");
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  // Privacy Filter State: "friends" | "everyone"
  const [messagePrivacy, setMessagePrivacy] = useState<"friends" | "everyone">(() => {
    if (typeof window !== "undefined") {
      return (
        (localStorage.getItem("mapsbridge.messagePrivacy") as "friends" | "everyone") || "friends"
      );
    }
    return "friends";
  });

  const [travelerModalTab, setTravelerModalTab] = useState<"friends" | "all">("friends");
  const [travelerSearch, setTravelerSearch] = useState("");

  function handleSelectTravelerToChat(target: TravelerContact) {
    const existing = conversations.find(
      (c) =>
        c.title.toLowerCase() === target.name.toLowerCase() ||
        c.title.toLowerCase() === target.username.toLowerCase(),
    );
    if (existing) {
      setActiveChatId(existing.id);
      setShowNewChatModal(false);
      showToastMessage(`${target.name} ile sohbet açıldı.`);
      return;
    }

    const newDmId = `dm_${target.username.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    const newDm: ChatConversation = {
      id: newDmId,
      type: "direct",
      title: target.name,
      subtitle: target.role,
      lastMessage: "Sohbet başlatıldı.",
      lastTime: "Şimdi",
      avatarIcon: "person",
      messages: [
        {
          id: "init",
          senderName: "Sistem",
          time: "Şimdi",
          isSystemEvent: true,
          text: `@${target.username} ile birebir sohbet başlatıldı.`,
        },
      ],
    };

    setConversations([newDm, ...conversations]);
    setActiveChatId(newDmId);
    setShowNewChatModal(false);
    showToastMessage(`${target.name} ile sohbet başlatıldı.`);
  }

  useEffect(() => {
    const session = getStoredSession();
    if (!session?.email || !session?.token) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("demo") !== "1" && urlParams.get("auth") !== "1") {
        setIsAuthenticated(false);
        setMounted(true);
        return;
      }
    }
    setIsAuthenticated(true);

    // Derive display name and handle from session
    const userHandle = session?.email
      ? session.email
          .split("@")[0]
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "")
      : "gezgin";
    const profileName =
      typeof window !== "undefined" ? localStorage.getItem("mapsbridge.profile.name") : null;
    const displayName = profileName || userHandle || "Gezgin";
    setActiveUserHandle(userHandle);
    setActiveUserName(displayName);

    // Sync direct messages from localStorage (e.g. sent from Topluluk page)
    try {
      const raw = localStorage.getItem("mapsbridge.directMessages");
      if (raw) {
        const storedDMs = JSON.parse(raw);
        if (Array.isArray(storedDMs) && storedDMs.length > 0) {
          setConversations((prev) => {
            const updated = [...prev];
            for (const dm of storedDMs) {
              const partner =
                dm.toUsername === userHandle || dm.toUsername === "gezgin"
                  ? dm.fromUsername
                  : dm.toUsername;
              if (!partner) continue;
              let conv = updated.find((c) => c.title.toLowerCase() === partner.toLowerCase());
              const isOut = dm.fromUsername === userHandle || dm.fromUsername === "gezgin";
              const msgObj: ChatMessage = {
                id: dm.id || "msg-" + Math.random(),
                senderName: isOut ? displayName : partner,
                time: dm.createdAt
                  ? new Date(dm.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Şimdi",
                text: dm.message,
                isOutgoing: isOut,
                readStatus: isOut ? "İletildi" : undefined,
              };
              if (!conv) {
                conv = {
                  id: `dm_${partner.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
                  type: "direct",
                  title: partner,
                  subtitle: "Topluluk Gezgini",
                  lastMessage: dm.message,
                  lastTime: msgObj.time,
                  avatarIcon: "person",
                  messages: [msgObj],
                };
                updated.unshift(conv);
              } else {
                if (!conv.messages.some((m) => m.id === dm.id)) {
                  conv.messages.push(msgObj);
                  conv.lastMessage = dm.message;
                  conv.lastTime = msgObj.time;
                }
              }
            }
            return updated;
          });
        }
      }
    } catch {}

    // Handle ?user= or ?chat= URL query parameter
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const targetUser = urlParams.get("user") || urlParams.get("to") || urlParams.get("chat");
      if (targetUser) {
        const cleanTarget = targetUser.replace(/^@/, "").trim();
        setConversations((prev) => {
          const existing = prev.find(
            (c) => c.id === cleanTarget || c.title.toLowerCase() === cleanTarget.toLowerCase(),
          );
          if (existing) {
            setActiveChatId(existing.id);
            return prev;
          }
          const newDmId = `dm_${cleanTarget.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
          const newDm: ChatConversation = {
            id: newDmId,
            type: "direct",
            title: cleanTarget,
            subtitle: "Topluluk Gezgini",
            lastMessage: "Sohbet başlatıldı.",
            lastTime: "Şimdi",
            avatarIcon: "person",
            messages: [
              {
                id: "init",
                senderName: "Sistem",
                time: "Şimdi",
                isSystemEvent: true,
                text: `@${cleanTarget} ile seyahat sohbeti başlatıldı.`,
              },
            ],
          };
          setActiveChatId(newDmId);
          return [newDm, ...prev];
        });
      }
    } catch {}

    setMounted(true);
  }, []);

  // Sync auth state from AuthContext once it resolves
  useEffect(() => {
    if (authLoading) return;
    if (authOk && user) {
      setIsAuthenticated(true);
      const handle = user.email
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "");
      const displayName = user.profile?.name || handle || "Gezgin";
      setActiveUserHandle(handle);
      setActiveUserName(displayName);
    }
  }, [authOk, authLoading, user]);

  // WebSocket — receive incoming messages in real-time
  useEffect(() => {
    const unsubscribe = wsOn("message", (data) => {
      const msg = data as {
        threadId?: string;
        messageId?: string;
        senderName?: string;
        text?: string;
      };
      if (!msg.threadId || !msg.text) return;
      const incoming: ChatMessage = {
        id: msg.messageId ?? "ws-" + Date.now(),
        senderName: msg.senderName ?? "Bilinmeyen",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: msg.text,
        isOutgoing: false,
        readStatus: "Alındı",
      };
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === msg.threadId
            ? {
                ...conv,
                lastMessage: msg.text!,
                lastTime: incoming.time,
                messages: [...conv.messages, incoming],
              }
            : conv,
        ),
      );
    });
    return unsubscribe;
  }, [wsOn]);

  // Modals state
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [newGroupRoute, setNewGroupRoute] = useState("");
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatUser, setNewChatUser] = useState("");
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinName, setPinName] = useState("");
  const [pinNote, setPinNote] = useState("");
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");

  const chatStreamRef = useRef<HTMLDivElement>(null);

  function showToastMessage(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // User conversations initialized cleanly (starts empty unless populated from server or direct messages)
  const [conversations, setConversations] = useState<ChatConversation[]>([]);

  const activeChat = conversations.find((c) => c.id === activeChatId) || conversations[0] || null;

  // Scroll to bottom on message updates
  useEffect(() => {
    if (chatStreamRef.current) {
      chatStreamRef.current.scrollTop = chatStreamRef.current.scrollHeight;
    }
  }, [activeChat?.messages]);

  // Send message action
  function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim() || !activeChat) return;

    const newMsg: ChatMessage = {
      id: "msg-" + Date.now(),
      senderName: activeUserName,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: inputText.trim(),
      isOutgoing: true,
      readStatus: activeChat.type === "group" ? "Tüm grup okudu" : "İletildi",
    };

    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id === activeChatId) {
          return {
            ...conv,
            lastMessage: `Siz: ${newMsg.text}`,
            lastTime: newMsg.time,
            messages: [...conv.messages, newMsg],
          };
        }
        return conv;
      }),
    );

    // Save outgoing note to localStorage
    try {
      const raw = localStorage.getItem("mapsbridge.directMessages");
      const list = raw ? JSON.parse(raw) : [];
      list.unshift({
        id: newMsg.id,
        fromUsername: activeUserHandle,
        toUsername: activeChat.title,
        routeTitle: activeChat.routeTag || "Genel",
        message: newMsg.text,
        createdAt: new Date().toISOString(),
        read: true,
      });
      localStorage.setItem("mapsbridge.directMessages", JSON.stringify(list));
    } catch {}

    // Send via WebSocket if connected
    wsSend("sendMessage", {
      threadId: activeChatId,
      text: newMsg.text,
    });

    setInputText("");
  }

  // Create new group handler
  function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupTitle.trim()) return;

    const newConv: ChatConversation = {
      id: "group-" + Date.now(),
      type: "group",
      title: newGroupTitle.trim(),
      routeTag: newGroupRoute ? `Bağlı Rota: ${newGroupRoute.trim()}` : "Yeni Gezi Seferi",
      memberCount: 1,
      lastMessage: "Grup oluşturuldu. Rota planını başlatabilirsiniz.",
      lastTime: "Şimdi",
      avatarIcon: "explore",
      messages: [
        {
          id: "init",
          senderName: "Sistem",
          time: "Şimdi",
          isSystemEvent: true,
          text: `"${newGroupTitle.trim()}" gezi grubu oluşturuldu.`,
        },
      ],
    };

    setConversations([newConv, ...conversations]);
    setActiveChatId(newConv.id);
    setShowNewGroupModal(false);
    setNewGroupTitle("");
    setNewGroupRoute("");
    showToastMessage(`✓ "${newConv.title}" gezi grubu oluşturuldu!`);
  }

  // Create new direct chat handler
  function handleCreateDirectChat(e: React.FormEvent) {
    e.preventDefault();
    if (!newChatUser.trim()) return;

    const newConv: ChatConversation = {
      id: "direct-" + Date.now(),
      type: "direct",
      title: newChatUser.trim(),
      subtitle: "Gezgin Topluluk Üyesi",
      lastMessage: "Sohbet başlatıldı.",
      lastTime: "Şimdi",
      avatarIcon: "person",
      messages: [
        {
          id: "init",
          senderName: "Sistem",
          time: "Şimdi",
          isSystemEvent: true,
          text: `@${newChatUser.trim()} ile güvenli seyahat sohbeti başlatıldı.`,
        },
      ],
    };

    setConversations([newConv, ...conversations]);
    setActiveChatId(newConv.id);
    setShowNewChatModal(false);
    setNewChatUser("");
    showToastMessage(`✓ @${newConv.title} ile sohbet başlatıldı!`);
  }

  // Handle pin drop inside chat
  function handleDropPin(e: React.FormEvent) {
    e.preventDefault();
    if (!pinName.trim()) return;

    const pinMsg: ChatMessage = {
      id: "pin-" + Date.now(),
      senderName: activeUserName,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isOutgoing: true,
      readStatus: "Pinlendi",
      locationPin: {
        title: pinName.trim(),
        note: pinNote.trim() || "Harita üzerinde yeni durak noktası işaretlendi.",
        image:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuAzXXICzl4cH2Ezy9GU08yZQklZbc1EPE4b3v1tNVbDA2iKMxm9gZGj_hcYiBtOW1j_ThXADn4j7ATk5gcr7hiu2LnFFiPBGqNC0aEK69pK1X4Uk03Woj6qHd2G85ZrzwHycd6SSSNQxJ2mPqR7XbfVbOdCztWcgtNgTGEwkA66RXAQ-G8X1sFL1F3_TjOLKKFNbZTyj0q4dgQ6GZyCFlo3wSVQXEGD406EeYN8o5tplrS9Zy6Jl9S5vA",
      },
    };

    setConversations((prev) =>
      prev.map((c) => (c.id === activeChatId ? { ...c, messages: [...c.messages, pinMsg] } : c)),
    );

    setShowPinModal(false);
    setPinName("");
    setPinNote("");
    showToastMessage("📍 Durak pini sohbete paylaşıldı!");
  }

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (activeFilter === "groups" && c.type !== "group") return false;
    if (activeFilter === "direct" && c.type !== "direct") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) || (c.routeTag && c.routeTag.toLowerCase().includes(q))
      );
    }
    return true;
  });

  if (isAuthenticated === false) {
    return (
      <FullPagePromotion
        badgeIcon="💬"
        badgeText="Gezgin Sohbetleri & Koordinasyon"
        heroTitle="Gezgin Topluluğuyla Canlı İletişim Kur"
        heroSubtitle="Gezgin sohbetlerine katılmak, grup seyahatlerinde koordinasyon sağlamak ve harita üzerinden anlık pin paylaşmak için MapsBridge hesabınıza giriş yapın."
        nextUrl="/messages/"
        primaryButtonText="Ücretsiz Kayıt Ol"
        secondaryButtonText="Giriş Yap"
        features={[
          {
            icon: "👥",
            title: "Canlı Gezi Grupları",
            description:
              "Grup seyahatlerinizde katılımcılarla gerçek zamanlı rota ve durak planı paylaşın.",
          },
          {
            icon: "📍",
            title: "Harita Üzerinden Pin Bırakma",
            description:
              "Sohbet içerisine tek tıkla konum, restoran veya buluşma noktası pini gönderin.",
          },
          {
            icon: "🔒",
            title: "Güvenli Gezgin Ağı",
            description: "Yalnızca doğrulanmış seyahat severlerle doğrudan güvenli mesajlaşın.",
          },
          {
            icon: "⚡",
            title: "Canlı Konum ve Radar",
            description: "Aynı şehirdeki gezginlerle anlık buluşma ve etkinlik planları yapın.",
          },
        ]}
      />
    );
  }

  return (
    <PageShell layout="app" className="chat-page-shell">
      <div className="chat-page-root" data-mobile-pane={mobilePane}>
        {/* Main Workspace Area */}
        <div className="chat-main-workspace">
          {/* AC-34: prerender HTML'inde tek h1 (başlık route-registry'den; görsel olarak gizli). */}
          <PageHeader variant="hidden" />
          <div className="chat-main-container">
            {/* 3. 3-Column Messenger Architecture */}
            <nav className="chat-mobile-tabs" aria-label="Mesajlaşma bölümleri">
              <button
                type="button"
                aria-pressed={mobilePane === "list"}
                onClick={() => setMobilePane("list")}
              >
                Mesajlar
              </button>
              <button
                type="button"
                aria-pressed={mobilePane === "chat"}
                onClick={() => setMobilePane("chat")}
              >
                Sohbet
              </button>
              <button
                type="button"
                disabled={!activeChat}
                aria-pressed={mobilePane === "details"}
                onClick={() => {
                  setShowRightSidebar(true);
                  setMobilePane("details");
                }}
              >
                Detaylar
              </button>
            </nav>
            <div className="chat-architecture-grid">
              {/* ================= LEFT COLUMN: CHATS & GROUPS ================= */}
              <aside className="chat-left-col">
                <div className="chat-left-top">
                  <div className="chat-left-header-row">
                    <div className="chat-left-title-box">
                      <h2 className="chat-left-title">Mesajlar</h2>
                      <span className="chat-left-count-badge">{conversations.length} Aktif</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <button
                        type="button"
                        className="chat-btn-new-group"
                        style={{ padding: "0.3rem 0.65rem", fontSize: "11px", gap: "3px" }}
                        title="Yeni Mesaj / Gezgin Seç"
                        onClick={() => setShowNewChatModal(true)}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                          person_add
                        </span>
                        <span>+ Mesaj Yaz</span>
                      </button>
                      <button
                        type="button"
                        className="chat-icon-btn"
                        title="Yeni Grup Seferi Aç"
                        onClick={() => setShowNewGroupModal(true)}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "18px", color: "var(--color-text-brand)" }}
                        >
                          group_add
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Privacy Filter Switcher: Sadece Arkadaşlarım / Herkes */}
                  <div className="chat-privacy-box">
                    <div className="chat-privacy-title-row">
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span className="material-symbols-outlined">
                          {messagePrivacy === "friends" ? "lock" : "public"}
                        </span>
                        Mesajlaşma İzni
                      </span>
                      <span
                        style={{
                          fontSize: "10.5px",
                          color: "var(--color-brand)",
                          fontWeight: 600,
                        }}
                      >
                        {messagePrivacy === "friends" ? "Sadece Arkadaşlar" : "Herkese Açık"}
                      </span>
                    </div>
                    <div className="chat-privacy-pills">
                      <button
                        type="button"
                        className={`chat-privacy-btn ${messagePrivacy === "friends" ? "active" : ""}`}
                        onClick={() => {
                          setMessagePrivacy("friends");
                          if (typeof window !== "undefined")
                            localStorage.setItem("mapsbridge.messagePrivacy", "friends");
                          showToastMessage("Mesajlaşma İzni: Sadece Arkadaşlarım mesaj atabilir.");
                        }}
                        title="Yalnızca arkadaş listenizdeki gezginler size mesaj gönderebilir"
                      >
                        <span className="material-symbols-outlined">group</span>
                        <span>Sadece Arkadaşlarım</span>
                      </button>
                      <button
                        type="button"
                        className={`chat-privacy-btn ${messagePrivacy === "everyone" ? "active" : ""}`}
                        onClick={() => {
                          setMessagePrivacy("everyone");
                          if (typeof window !== "undefined")
                            localStorage.setItem("mapsbridge.messagePrivacy", "everyone");
                          showToastMessage("Mesajlaşma İzni: Herkes mesaj atabilir.");
                        }}
                        title="Tüm MapsBridge gezginleri size mesaj gönderebilir"
                      >
                        <span className="material-symbols-outlined">public</span>
                        <span>Herkes</span>
                      </button>
                    </div>
                  </div>

                  <div className="chat-search-input-wrap">
                    <span className="material-symbols-outlined search-icon">search</span>
                    <input
                      type="text"
                      placeholder="Gezgin veya gezi grubu ara..."
                      className="chat-list-search-input"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="chat-segmented-filter">
                    <button
                      type="button"
                      className={`chat-seg-btn ${activeFilter === "all" ? "active" : ""}`}
                      onClick={() => setActiveFilter("all")}
                    >
                      Tümü ({conversations.length})
                    </button>
                    <button
                      type="button"
                      className={`chat-seg-btn ${activeFilter === "groups" ? "active" : ""}`}
                      onClick={() => setActiveFilter("groups")}
                    >
                      Gruplar ({conversations.filter((c) => c.type === "group").length})
                    </button>
                    <button
                      type="button"
                      className={`chat-seg-btn ${activeFilter === "direct" ? "active" : ""}`}
                      onClick={() => setActiveFilter("direct")}
                    >
                      Birebir ({conversations.filter((c) => c.type === "direct").length})
                    </button>
                    <button
                      type="button"
                      className={`chat-seg-btn ${activeFilter === "archive" ? "active" : ""}`}
                      onClick={() => setActiveFilter("archive")}
                      title="Arşiv"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                        archive
                      </span>
                    </button>
                  </div>
                </div>

                {/* Chat Conversation List */}
                <div className="chat-list-scroll">
                  {filteredConversations.length === 0 ? (
                    <div
                      style={{
                        padding: "2.5rem 1rem",
                        textAlign: "center",
                        color: "var(--color-border-control)",
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "32px", marginBottom: "8px", opacity: 0.6 }}
                      >
                        chat_bubble_outline
                      </span>
                      <h4
                        style={{
                          margin: "0 0 4px",
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "var(--color-text-brand)",
                        }}
                      >
                        {searchQuery ? "Sohbet Bulunamadı" : "Henüz Mesajınız Yok"}
                      </h4>
                      <p style={{ margin: 0, fontSize: "11px", lineHeight: "1.4" }}>
                        {searchQuery
                          ? "Farklı bir arama terimi deneyin."
                          : "Topluluktan bir kaşifle sohbet başlatın veya grup açın."}
                      </p>
                      {!searchQuery && (
                        <button
                          type="button"
                          onClick={() => setShowNewChatModal(true)}
                          style={{
                            marginTop: "0.75rem",
                            padding: "6px 14px",
                            borderRadius: "8px",
                            background: "var(--color-text-brand)",
                            color: "var(--color-on-primary)",
                            fontSize: "11.5px",
                            fontWeight: 700,
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          + Sohbet Başlat
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredConversations.map((conv) => {
                      const isSelected = conv.id === activeChatId;
                      return (
                        <div
                          key={conv.id}
                          className={`chat-item-card ${isSelected ? "active" : ""}`}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setActiveChatId(conv.id);
                              setMobilePane("chat");
                            }
                          }}
                          onClick={() => {
                            setActiveChatId(conv.id);
                            setMobilePane("chat");
                          }}
                        >
                          <div className="chat-item-avatar-wrap">
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: "22px" }}
                            >
                              {conv.avatarIcon}
                            </span>
                            {conv.memberCount && (
                              <span className="chat-item-member-count">{conv.memberCount}</span>
                            )}
                          </div>

                          <div className="chat-item-content">
                            <div className="chat-item-row-top">
                              <span className="chat-item-name">{conv.title}</span>
                              <span className="chat-item-time">{conv.lastTime}</span>
                            </div>

                            {conv.routeTag && (
                              <div className="chat-item-route-tag">
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: "12px" }}
                                >
                                  push_pin
                                </span>
                                <span>{conv.routeTag}</span>
                              </div>
                            )}
                            {conv.subtitle && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  color: "var(--color-brand)",
                                  display: "block",
                                }}
                              >
                                {conv.subtitle}
                              </span>
                            )}

                            <p className="chat-item-snippet">{conv.lastMessage}</p>
                          </div>

                          <div className="chat-item-right-badges">
                            {conv.pinned && (
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: "14px", color: "var(--color-text-accent)" }}
                              >
                                push_pin
                              </span>
                            )}
                            {conv.unreadCount && (
                              <span className="chat-unread-badge">
                                {conv.unreadCount}
                                <span className="ui-visually-hidden"> okunmamış mesaj</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </aside>

              {/* ================= MIDDLE COLUMN: LIVE CHAT STREAM ================= */}
              <section className="chat-middle-col">
                {!activeChat ? (
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "2.5rem 1.5rem",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        width: "64px",
                        height: "64px",
                        borderRadius: "18px",
                        background: "var(--color-surface-brand)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: "1rem",
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "32px", color: "var(--color-text-brand)" }}
                      >
                        forum
                      </span>
                    </div>
                    <h3
                      style={{
                        margin: "0 0 6px",
                        fontSize: "16px",
                        fontWeight: 700,
                        color: "var(--color-text-brand)",
                      }}
                    >
                      Aktif Bir Sohbet Seçilmedi
                    </h3>
                    <p
                      style={{
                        margin: "0 0 1.25rem",
                        fontSize: "13px",
                        color: "var(--color-brand)",
                        maxWidth: "340px",
                        lineHeight: "1.5",
                      }}
                    >
                      Sol taraftaki listeden bir gezgin veya seyahat grubu seçin ya da yeni bir
                      sohbet başlatarak rotalarınızı koordine edin.
                    </p>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        className="chat-btn-new-group"
                        onClick={() => setShowNewChatModal(true)}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                          chat
                        </span>
                        <span>Yeni Sohbet Başlat</span>
                      </button>
                      <button
                        type="button"
                        className="chat-btn-map-split"
                        onClick={() => setShowNewGroupModal(true)}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                          group_add
                        </span>
                        <span>Grup Aç</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Header */}
                    <div className="chat-middle-header">
                      <div className="chat-middle-header-left">
                        <div className="chat-middle-header-icon">
                          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                            {activeChat.avatarIcon}
                          </span>
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <h2 className="chat-middle-header-title">{activeChat.title}</h2>
                            {activeChat.type === "group" && (
                              <span
                                style={{
                                  padding: "0.15rem 0.5rem",
                                  borderRadius: "9999px",
                                  background: "var(--color-surface-brand)",
                                  color: "var(--color-brand)",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  letterSpacing: "0.04em",
                                }}
                              >
                                ÖZEL GRUP
                              </span>
                            )}
                          </div>
                          <div className="chat-middle-header-sub">
                            {activeChat.type === "group" ? (
                              <>
                                <span className="chat-active-count">
                                  <span
                                    style={{
                                      width: "6px",
                                      height: "6px",
                                      borderRadius: "50%",
                                      background: "var(--color-accent)",
                                    }}
                                  />
                                  {activeChat.memberCount || 0} Gezgin Aktif
                                </span>
                                <span>•</span>
                                <span style={{ color: "var(--color-text-brand)", fontWeight: 700 }}>
                                  {activeChat.routeInfo?.code
                                    ? `Bağlı Rota: ${activeChat.routeInfo.code}`
                                    : "Aktif Rota Masası"}
                                </span>
                              </>
                            ) : (
                              <span>Çevrimiçi • MapsBridge Doğrulanmış Gezgin</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="chat-middle-header-actions">
                        <Link
                          href={`/maps/?route=${encodeURIComponent(activeChat.title)}`}
                          className="chat-btn-live-map"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                            travel_explore
                          </span>
                          <span>Canlı Harita</span>
                        </Link>

                        <button
                          type="button"
                          className="chat-icon-btn"
                          title="Grupta Ara"
                          onClick={() => showToastMessage("Mesaj arama alanı açıldı.")}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                            search
                          </span>
                        </button>

                        <button
                          type="button"
                          className="chat-icon-btn"
                          title="Rota Detay Paneli"
                          onClick={() => {
                            if (window.matchMedia("(max-width: 1023px)").matches) {
                              setShowRightSidebar(true);
                              setMobilePane("details");
                            } else setShowRightSidebar(!showRightSidebar);
                          }}
                          style={{
                            background: showRightSidebar
                              ? "var(--color-surface-brand)"
                              : "var(--color-surface-tint)",
                            color: "var(--color-brand)",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                            info
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Sticky Pinned Alert — only shown for group chats with a pinned message */}
                    {activeChat.type === "group" && activeChat.pinned && (
                      <div className="chat-pinned-alert">
                        <div className="chat-pinned-left">
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "18px", color: "var(--color-text-accent)" }}
                          >
                            push_pin
                          </span>
                          <strong
                            style={{
                              fontSize: "11px",
                              color: "var(--color-text-brand)",
                              letterSpacing: "0.04em",
                            }}
                          >
                            SABİTLENEN BULUŞMA:
                          </strong>
                          <p className="chat-pinned-text">
                            {activeChat.pinnedText || activeChat.routeTag || "Sabitlenmiş mesaj"}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="chat-pinned-action"
                          onClick={() => showToastMessage("Konum harita masasında gösterildi.")}
                        >
                          Haritada Gör
                        </button>
                      </div>
                    )}

                    {/* Chat Stream Scrollable Area */}
                    <div
                      ref={chatStreamRef}
                      className="chat-stream-scroll"
                      role="log"
                      aria-live="polite"
                      aria-label="Mesajlar"
                    >
                      <div className="chat-date-separator">
                        <span className="chat-date-pill">
                          Bugün,{" "}
                          {new Date().toLocaleDateString("tr-TR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      {activeChat.messages.map((msg) => {
                        if (msg.isSystemEvent) {
                          return (
                            <div key={msg.id} className="chat-system-event-line">
                              <span className="chat-system-event-pill">
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: "14px", color: "var(--color-brand)" }}
                                >
                                  add_location_alt
                                </span>
                                <span>{msg.text}</span>
                              </span>
                            </div>
                          );
                        }

                        const isOut = !!msg.isOutgoing;
                        return (
                          <div key={msg.id} className={`chat-msg-row ${isOut ? "outgoing" : ""}`}>
                            <div className={`chat-msg-avatar ${isOut ? "owner" : ""}`}>
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: "18px" }}
                              >
                                {isOut ? "person" : "hiking"}
                              </span>
                            </div>

                            <div className="chat-msg-content-wrap">
                              <div
                                className="chat-msg-meta-line"
                                style={{ justifyContent: isOut ? "flex-end" : "flex-start" }}
                              >
                                <span className="chat-msg-sender">{msg.senderName}</span>
                                {msg.senderRole && (
                                  <span
                                    className={`chat-msg-role-tag ${msg.senderRole.includes("PRO") ? "pro" : ""}`}
                                  >
                                    {msg.senderRole}
                                  </span>
                                )}
                                <span className="chat-msg-time">{msg.time}</span>
                              </div>

                              {/* Normal Text Message Bubble */}
                              {msg.text && (
                                <div className={`chat-bubble ${isOut ? "outgoing" : "incoming"}`}>
                                  {msg.text}
                                </div>
                              )}

                              {/* Rich Shared Route Card */}
                              {msg.routeEmbed && (
                                <div className="chat-route-embed-card">
                                  <div className="chat-route-embed-header">
                                    <span className="chat-route-embed-badge">
                                      <span
                                        className="material-symbols-outlined"
                                        style={{
                                          fontSize: "16px",
                                          color: "var(--color-text-accent)",
                                        }}
                                      >
                                        explore
                                      </span>
                                      Paylaşılan Resmi Rota
                                    </span>
                                    <span
                                      style={{
                                        padding: "0.15rem 0.5rem",
                                        borderRadius: "9999px",
                                        background: "var(--color-text-brand)",
                                        color: "var(--color-on-primary)",
                                        fontSize: "10px",
                                        fontWeight: 700,
                                      }}
                                    >
                                      {msg.routeEmbed.code}
                                    </span>
                                  </div>

                                  <div className="chat-route-embed-body">
                                    <div
                                      className="chat-route-embed-img"
                                      style={{ backgroundImage: `url('${msg.routeEmbed.image}')` }}
                                    >
                                      <span
                                        style={{
                                          position: "absolute",
                                          bottom: "4px",
                                          left: "6px",
                                          fontSize: "10px",
                                          color: "var(--color-on-primary)",
                                          fontWeight: 700,
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "2px",
                                        }}
                                      >
                                        <span
                                          className="material-symbols-outlined"
                                          style={{ fontSize: "12px" }}
                                        >
                                          photo_camera
                                        </span>
                                        {msg.routeEmbed.stopsCount} Durak
                                      </span>
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <h3 className="chat-route-embed-title">
                                        {msg.routeEmbed.title}
                                      </h3>
                                      <p className="chat-route-embed-desc">{msg.routeEmbed.desc}</p>
                                      <div className="chat-route-embed-chips">
                                        <span className="chat-route-chip">
                                          <span
                                            className="material-symbols-outlined"
                                            style={{ fontSize: "12px" }}
                                          >
                                            schedule
                                          </span>
                                          {msg.routeEmbed.duration}
                                        </span>
                                        <span className="chat-route-chip">
                                          <span
                                            className="material-symbols-outlined"
                                            style={{ fontSize: "12px" }}
                                          >
                                            straighten
                                          </span>
                                          {msg.routeEmbed.distance}
                                        </span>
                                        <span
                                          className="chat-route-chip"
                                          style={{
                                            background: "var(--color-surface-brand)",
                                            fontWeight: 700,
                                          }}
                                        >
                                          <span
                                            className="material-symbols-outlined"
                                            style={{
                                              fontSize: "12px",
                                              color: "var(--color-text-accent)",
                                            }}
                                          >
                                            altitude
                                          </span>
                                          {msg.routeEmbed.difficulty}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="chat-route-embed-actions">
                                    <Link
                                      href="/maps/"
                                      style={{
                                        flex: 1,
                                        padding: "0.5rem 0.75rem",
                                        borderRadius: "9999px",
                                        background: "var(--color-brand-hover)",
                                        color: "var(--color-on-primary)",
                                        fontSize: "12px",
                                        fontWeight: 600,
                                        textAlign: "center",
                                        textDecoration: "none",
                                      }}
                                    >
                                      Harita Masasında Aç
                                    </Link>
                                    <button
                                      type="button"
                                      style={{
                                        padding: "0.5rem 0.75rem",
                                        borderRadius: "9999px",
                                        background: "var(--color-surface-tint)",
                                        color: "var(--color-text-brand)",
                                        fontSize: "12px",
                                        fontWeight: 600,
                                        border: "none",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "3px",
                                      }}
                                      onClick={() =>
                                        showToastMessage("✓ Rota kütüphane havuzunuza eklendi!")
                                      }
                                    >
                                      <span
                                        className="material-symbols-outlined"
                                        style={{ fontSize: "16px" }}
                                      >
                                        bookmark_add
                                      </span>
                                      <span>Havuzuma Kaydet</span>
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Location Pin Drop Card */}
                              {msg.locationPin && (
                                <div className="chat-location-drop-card">
                                  <div
                                    className="chat-location-map-thumb"
                                    style={{ backgroundImage: `url('${msg.locationPin.image}')` }}
                                  >
                                    <div className="chat-location-pin-circle">
                                      <span
                                        className="material-symbols-outlined"
                                        style={{ fontSize: "18px" }}
                                      >
                                        location_on
                                      </span>
                                    </div>
                                    <span
                                      style={{
                                        position: "absolute",
                                        top: "6px",
                                        left: "6px",
                                        padding: "0.15rem 0.45rem",
                                        borderRadius: "9999px",
                                        background:
                                          "color-mix(in srgb, var(--color-surface-inverse) 85%, transparent)",
                                        color: "var(--color-on-primary)",
                                        fontSize: "9px",
                                        fontWeight: 700,
                                      }}
                                    >
                                      CANLI PİN
                                    </span>
                                  </div>

                                  <div style={{ padding: "0.5rem" }}>
                                    <strong
                                      style={{
                                        fontSize: "13px",
                                        color: "var(--color-text-brand)",
                                        display: "block",
                                      }}
                                    >
                                      {msg.locationPin.title}
                                    </strong>
                                    <p
                                      style={{
                                        fontSize: "12px",
                                        color: "var(--color-text-muted)",
                                        margin: "3px 0 0",
                                      }}
                                    >
                                      "{msg.locationPin.note}"
                                    </p>
                                    <button
                                      type="button"
                                      style={{
                                        width: "100%",
                                        marginTop: "0.5rem",
                                        padding: "0.45rem",
                                        borderRadius: "8px",
                                        background: "var(--color-surface-tint)",
                                        color: "var(--color-brand)",
                                        fontSize: "12px",
                                        fontWeight: 600,
                                        border: "none",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "4px",
                                      }}
                                      onClick={() =>
                                        showToastMessage(
                                          "Yol tarifi Google Haritalar üzerinden başlatılıyor...",
                                        )
                                      }
                                    >
                                      <span
                                        className="material-symbols-outlined"
                                        style={{ fontSize: "15px" }}
                                      >
                                        navigation
                                      </span>
                                      <span>Yol Tarifi Al</span>
                                    </button>
                                  </div>
                                </div>
                              )}

                              {msg.readStatus && (
                                <div className="chat-msg-read-status">
                                  <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: "13px" }}
                                  >
                                    done_all
                                  </span>
                                  <span>{msg.readStatus}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Chat Input Bar */}
                    <div className="chat-input-footer">
                      <div className="chat-quick-attachment-pills">
                        <button
                          type="button"
                          className="chat-attach-pill"
                          onClick={() => setShowPinModal(true)}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "16px", color: "var(--color-text-accent)" }}
                          >
                            add_location
                          </span>
                          <span>Durak Pinle</span>
                        </button>

                        <button
                          type="button"
                          className="chat-attach-pill"
                          onClick={() => {
                            setInputText("Harita masamdaki KP-302 rotasını ekibe paylaşıyorum 🗺️");
                          }}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "16px", color: "var(--color-brand)" }}
                          >
                            polyline
                          </span>
                          <span>Rota Paylaş</span>
                        </button>

                        <button
                          type="button"
                          className="chat-attach-pill"
                          onClick={() =>
                            showToastMessage("GPX / Fotoğraf yükleme penceresi açıldı.")
                          }
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "16px", color: "var(--color-border-control)" }}
                          >
                            photo_camera
                          </span>
                          <span>Fotoğraf / GPX</span>
                        </button>

                        <button
                          type="button"
                          className="chat-attach-pill"
                          onClick={() => {
                            setInputText("Buluşma saati: 05:30 ⏰");
                          }}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "16px", color: "var(--color-border-control)" }}
                          >
                            event
                          </span>
                          <span>Zaman Ekle</span>
                        </button>
                      </div>

                      <form onSubmit={handleSendMessage} className="chat-input-controls-row">
                        <button
                          type="button"
                          className="chat-icon-btn"
                          title="Emoji Ekle"
                          onClick={() => setInputText((prev) => prev + " 📍")}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                            sentiment_satisfied
                          </span>
                        </button>

                        <input
                          type="text"
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          placeholder={`${activeChat.title} ekibine mesaj yaz veya koordinat bırak...`}
                          className="chat-text-input"
                        />

                        <button
                          type="button"
                          className="chat-icon-btn"
                          title="Sesli Not"
                          onClick={() => showToastMessage("Ses kaydı dinleniyor...")}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                            mic
                          </span>
                        </button>

                        <button type="submit" className="chat-send-btn" title="Gönder">
                          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                            send
                          </span>
                        </button>
                      </form>
                    </div>
                  </>
                )}
              </section>

              {/* ================= RIGHT COLUMN: TRAVEL GROUP & ROUTE DETAILS ================= */}
              {showRightSidebar && activeChat && (
                <aside className="chat-right-col">
                  {activeChat.type === "direct"
                    ? /* ── KİŞİSEL SOHBET: GEZGİN PROFİLİ (ROTA VE DURAK GÖSTERİLMEZ) ── */
                      (() => {
                        const cleanName = activeChat.title.replace(/^@/, "");
                        const contact = DEFAULT_TRAVELER_CONTACTS.find(
                          (t) =>
                            t.username.toLowerCase() === cleanName.toLowerCase() ||
                            t.name.toLowerCase() === cleanName.toLowerCase(),
                        ) || {
                          id: activeChat.id,
                          name: cleanName,
                          username: cleanName.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                          initial: (cleanName.charAt(0) || "G").toUpperCase(),
                          role: activeChat.subtitle || "Topluluk Gezgini",
                          isFriend: messagePrivacy === "friends",
                          online: true,
                          interests: ["Doğa", "Kültür", "Fotoğraf"],
                          bio: "MapsBridge gezgini. Seyahat rotaları ve yeni keşifler üzerine sohbet ediyor.",
                        };

                        return (
                          <div className="chat-personal-profile-wrap">
                            {/* 1. Gezgin Profil Başlığı */}
                            <div className="chat-personal-header-card">
                              <div className="chat-personal-avatar-box">
                                {contact.initial}
                                {contact.online && <span className="chat-personal-online-beacon" />}
                              </div>
                              <h3 className="chat-personal-name">{contact.name}</h3>
                              <span className="chat-personal-handle">@{contact.username}</span>
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--color-text-muted)",
                                  marginTop: "4px",
                                }}
                              >
                                {contact.role}
                              </span>

                              {contact.isFriend ? (
                                <span className="chat-friend-badge">
                                  <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: "14px" }}
                                  >
                                    verified
                                  </span>
                                  <span>Onaylı Arkadaş</span>
                                </span>
                              ) : (
                                <span
                                  className="chat-friend-badge"
                                  style={{
                                    background:
                                      "color-mix(in srgb, var(--color-brand) 10%, transparent)",
                                    color: "var(--color-brand)",
                                    borderColor:
                                      "color-mix(in srgb, var(--color-brand) 30%, transparent)",
                                  }}
                                >
                                  <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: "14px" }}
                                  >
                                    public
                                  </span>
                                  <span>Topluluk Gezgini</span>
                                </span>
                              )}
                            </div>

                            {/* 2. Gezgin Biyografi */}
                            <div className="chat-right-section">
                              <h4 className="chat-right-section-title">Gezgin Hakkında</h4>
                              <p
                                style={{
                                  fontSize: "12px",
                                  color: "var(--color-text-muted)",
                                  margin: 0,
                                  lineHeight: 1.5,
                                }}
                              >
                                {contact.bio}
                              </p>
                            </div>

                            {/* 3. İlgi Alanları & Seyahat Tarzı */}
                            <div className="chat-right-section">
                              <h4 className="chat-right-section-title">İlgi Alanları &amp; Tarz</h4>
                              <div className="chat-interest-tags-wrap">
                                {contact.interests.map((tag, idx) => (
                                  <span key={idx} className="chat-interest-pill">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* 4. Mesajlaşma Gizlilik Rozeti */}
                            <div className="chat-right-section">
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  fontSize: "11px",
                                  color: "var(--color-brand)",
                                  background: "var(--color-surface-tint)",
                                  padding: "0.5rem 0.65rem",
                                  borderRadius: "8px",
                                }}
                              >
                                <span className="material-symbols-outlined">
                                  {messagePrivacy === "friends" ? "lock" : "chat"}
                                </span>
                                <span>
                                  {messagePrivacy === "friends"
                                    ? "Sadece Arkadaşlarım modu aktif. Birebir mesajınız korumalı."
                                    : "Açık iletişim modu aktif."}
                                </span>
                              </div>
                            </div>

                            {/* 5. Eylemler */}
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.5rem",
                                marginTop: "auto",
                                paddingTop: "0.5rem",
                              }}
                            >
                              <Link
                                href={`/${contact.username}/`}
                                className="chat-btn-map-split"
                                style={{ justifyContent: "center", textDecoration: "none" }}
                              >
                                <span className="material-symbols-outlined">account_circle</span>
                                <span>Gezgin Profilini İncele</span>
                              </Link>
                              <button
                                type="button"
                                className="chat-attach-pill"
                                style={{ justifyContent: "center" }}
                                onClick={() =>
                                  showToastMessage(
                                    `${contact.name} için bildirimler sessize alındı.`,
                                  )
                                }
                              >
                                <span className="material-symbols-outlined">notifications_off</span>
                                <span>Bildirimleri Kapat</span>
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    : /* ── GRUP SOHBETİ: DİNAMİK ROTA, DURAKLAR & GRUP DETAYLARI ── */
                      (() => {
                        const lower = (
                          activeChat.title +
                          " " +
                          (activeChat.routeTag || "")
                        ).toLowerCase();
                        let topicRoute: GroupTopicRoute = PRESET_GROUP_ROUTES.kapadokya;
                        if (
                          lower.includes("likya") ||
                          lower.includes("yürüyüş") ||
                          lower.includes("fethiye") ||
                          lower.includes("trekking")
                        ) {
                          topicRoute = PRESET_GROUP_ROUTES.likya;
                        } else if (
                          lower.includes("ege") ||
                          lower.includes("urla") ||
                          lower.includes("gurme") ||
                          lower.includes("izmir")
                        ) {
                          topicRoute = PRESET_GROUP_ROUTES.ege;
                        }

                        const routeCode = activeChat.routeInfo?.code || topicRoute.code;
                        const routeName = activeChat.routeInfo?.name || topicRoute.name;
                        const routeStats = activeChat.routeInfo?.stats || topicRoute.stats;
                        const coverImg = activeChat.coverImage || topicRoute.coverImage;
                        const waypoints = activeChat.waypoints || topicRoute.waypoints;

                        return (
                          <>
                            {/* Group Hero Cover */}
                            <div
                              className="chat-right-hero-card"
                              style={{ backgroundImage: `url('${coverImg}')` }}
                            >
                              <div className="chat-right-hero-overlay" data-surface="inverse" />
                              <div style={{ position: "relative", zIndex: 2 }}>
                                <span
                                  style={{
                                    padding: "0.15rem 0.5rem",
                                    borderRadius: "9999px",
                                    background: "var(--color-accent)",
                                    color: "var(--color-surface-inverse)",
                                    fontSize: "9px",
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                  }}
                                >
                                  Aktif Gezi Masası
                                </span>
                                <h3
                                  style={{
                                    margin: "4px 0 2px",
                                    fontSize: "15px",
                                    fontWeight: 700,
                                    color: "var(--color-on-primary)",
                                  }}
                                >
                                  {activeChat.title}
                                </h3>
                                <span
                                  style={{ fontSize: "11px", color: "var(--color-surface-brand)" }}
                                >
                                  {activeChat.memberCount || activeChat.members?.length || 0} Gezgin
                                  • Canlı Sefer
                                </span>
                              </div>
                            </div>

                            {/* Section 1: Linked Route Module (Dynamic) */}
                            <div className="chat-right-section">
                              <div className="chat-right-section-title-row">
                                <h4 className="chat-right-section-title">Bağlı Rota &amp; Sefer</h4>
                                <span
                                  style={{
                                    padding: "0.1rem 0.4rem",
                                    borderRadius: "4px",
                                    background: "var(--color-surface-brand)",
                                    color: "var(--color-brand)",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                  }}
                                >
                                  {routeCode}
                                </span>
                              </div>

                              <div className="chat-linked-route-box">
                                <div style={{ minWidth: 0 }}>
                                  <strong
                                    style={{
                                      fontSize: "12.5px",
                                      color: "var(--color-text-brand)",
                                      display: "block",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {routeName}
                                  </strong>
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      color: "var(--color-text-muted)",
                                    }}
                                  >
                                    {routeStats}
                                  </span>
                                </div>
                                <Link
                                  href="/maps/"
                                  style={{
                                    width: "32px",
                                    height: "32px",
                                    borderRadius: "50%",
                                    background: "var(--color-surface)",
                                    color: "var(--color-text-brand)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    textDecoration: "none",
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                                    flexShrink: 0,
                                  }}
                                  title="Harita Masasında İncele"
                                >
                                  <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: "16px" }}
                                  >
                                    north_east
                                  </span>
                                </Link>
                              </div>
                            </div>

                            {/* Section 2: Group Members Stack */}
                            <div className="chat-right-section">
                              <div className="chat-right-section-title-row">
                                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                  <h4 className="chat-right-section-title">Grup Üyeleri</h4>
                                  <span
                                    style={{
                                      padding: "0.1rem 0.35rem",
                                      borderRadius: "9999px",
                                      background: "var(--color-surface-tint)",
                                      fontSize: "10px",
                                      fontWeight: 700,
                                    }}
                                  >
                                    {activeChat.members?.length || 0}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    color: "var(--color-brand)",
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                  }}
                                  onClick={() => setShowAddMemberModal(true)}
                                >
                                  + Üye Ekle
                                </button>
                              </div>

                              <div className="chat-members-list">
                                {(
                                  activeChat.members || [
                                    {
                                      name: activeUserName,
                                      role: "Siz",
                                      initial: activeUserName
                                        .split(" ")
                                        .map((w) => w[0])
                                        .join("")
                                        .substring(0, 2)
                                        .toUpperCase(),
                                      online: true,
                                      isUser: true,
                                    },
                                  ]
                                ).map((mem, i) => (
                                  <div key={i} className="chat-member-row">
                                    <div className="chat-member-left">
                                      <div className="chat-member-avatar">
                                        {mem.initial}
                                        {mem.online && <span className="chat-member-online-dot" />}
                                      </div>
                                      <div style={{ minWidth: 0 }}>
                                        <strong
                                          style={{
                                            fontSize: "12.5px",
                                            color: "var(--color-text)",
                                            display: "block",
                                          }}
                                        >
                                          {mem.name}
                                        </strong>
                                        <span
                                          style={{
                                            fontSize: "10px",
                                            color: "var(--color-text-muted)",
                                          }}
                                        >
                                          {mem.role}
                                        </span>
                                      </div>
                                    </div>

                                    {mem.isOwner && (
                                      <span
                                        className="material-symbols-outlined"
                                        style={{
                                          fontSize: "16px",
                                          color: "var(--color-text-accent)",
                                        }}
                                        title="Rehber Lider"
                                      >
                                        verified
                                      </span>
                                    )}
                                    {mem.isUser && (
                                      <span
                                        style={{
                                          fontSize: "10px",
                                          fontWeight: 700,
                                          color: "var(--color-brand)",
                                        }}
                                      >
                                        PRO
                                      </span>
                                    )}
                                    {!mem.isOwner && !mem.isUser && (
                                      <button
                                        type="button"
                                        style={{
                                          width: "24px",
                                          height: "24px",
                                          borderRadius: "50%",
                                          background: "transparent",
                                          border: "none",
                                          color: "var(--color-border-control)",
                                          cursor: "pointer",
                                        }}
                                        title="Birebir Yaz"
                                        onClick={() => {
                                          const targetUser = DEFAULT_TRAVELER_CONTACTS.find(
                                            (t) => t.name.toLowerCase() === mem.name.toLowerCase(),
                                          ) || {
                                            id:
                                              "dm_" +
                                              mem.name.toLowerCase().replace(/[^a-z0-9]/g, "_"),
                                            name: mem.name,
                                            username: mem.name
                                              .toLowerCase()
                                              .replace(/[^a-z0-9_]/g, ""),
                                            initial: mem.initial,
                                            role: mem.role,
                                            isFriend: true,
                                            online: mem.online,
                                            interests: ["Gezi"],
                                            bio: "Grup katılımcısı.",
                                          };
                                          handleSelectTravelerToChat(targetUser);
                                        }}
                                      >
                                        <span
                                          className="material-symbols-outlined"
                                          style={{ fontSize: "14px" }}
                                        >
                                          chat
                                        </span>
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Section 3: Shared Route Waypoints & Pins (Dynamic to Group) */}
                            <div className="chat-right-section">
                              <div className="chat-right-section-title-row">
                                <h4 className="chat-right-section-title">
                                  Sabit Duraklar &amp; Pinler
                                </h4>
                                <span
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    color: "var(--color-brand)",
                                  }}
                                >
                                  {waypoints.length} Durak
                                </span>
                              </div>

                              <div className="chat-waypoints-list">
                                {waypoints.map((wp) => (
                                  <div
                                    key={wp.num}
                                    className="chat-waypoint-item"
                                    onClick={() =>
                                      showToastMessage(
                                        `Durak haritada vurgulandı: #${wp.num} ${wp.title}`,
                                      )
                                    }
                                  >
                                    <div className="chat-waypoint-left">
                                      <span className="chat-waypoint-num">{wp.num}</span>
                                      <div style={{ minWidth: 0 }}>
                                        <strong
                                          style={{
                                            fontSize: "12px",
                                            color: "var(--color-text-brand)",
                                            display: "block",
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                          }}
                                        >
                                          {wp.title}
                                        </strong>
                                        <span
                                          style={{
                                            fontSize: "11px",
                                            color: "var(--color-text-muted)",
                                          }}
                                        >
                                          {wp.sub}
                                        </span>
                                      </div>
                                    </div>
                                    <span
                                      className="material-symbols-outlined"
                                      style={{
                                        fontSize: "15px",
                                        color: "var(--color-border-control)",
                                      }}
                                    >
                                      near_me
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Section 4: Actions */}
                            <div
                              style={{
                                marginTop: "auto",
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.25rem",
                                paddingTop: "0.5rem",
                              }}
                            >
                              <Link
                                href="/maps/"
                                className="chat-btn-map-split"
                                style={{ justifyContent: "center", textDecoration: "none" }}
                              >
                                <span className="material-symbols-outlined">map</span>
                                <span>Harita Masasında Aç</span>
                              </Link>
                              <button
                                type="button"
                                className="chat-attach-pill"
                                style={{ justifyContent: "center" }}
                                onClick={() =>
                                  showToastMessage("Grup bildirimleri sessize alındı.")
                                }
                              >
                                <span className="material-symbols-outlined">notifications_off</span>
                                <span>Grup Bildirimlerini Kapat</span>
                              </button>
                            </div>
                          </>
                        );
                      })()}
                </aside>
              )}
            </div>
          </div>
        </div>
        {/* Toast Notification */}
        {toast && (
          <div data-surface="inverse" className="chat-toast" role="status">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "18px", color: "var(--color-link-inverse)" }}
            >
              check_circle
            </span>
            <span>{toast}</span>
          </div>
        )}

        {/* Modal 1: Yeni Grup / Sefer Aç */}
        {showNewGroupModal && (
          <div className="chat-modal-backdrop" onClick={() => setShowNewGroupModal(false)}>
            <div className="chat-modal-window" onClick={(e) => e.stopPropagation()}>
              <div className="chat-modal-header">
                <h3
                  style={{
                    margin: 0,
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "var(--color-text-brand)",
                  }}
                >
                  Yeni Gezi Grubu & Seferi Başlat
                </h3>
                <button
                  type="button"
                  className="chat-icon-btn"
                  onClick={() => setShowNewGroupModal(false)}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <form onSubmit={handleCreateGroup}>
                <div className="chat-modal-body">
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "12px",
                        fontWeight: 700,
                        marginBottom: "4px",
                      }}
                    >
                      Grup / Sefer Adı
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Örn: Roma & Floransa Sanat Rotası Ekibi"
                      value={newGroupTitle}
                      onChange={(e) => setNewGroupTitle(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.65rem 0.85rem",
                        borderRadius: "10px",
                        border: "1px solid var(--color-border-strong)",
                        fontSize: "13px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "12px",
                        fontWeight: 700,
                        marginBottom: "4px",
                      }}
                    >
                      Bağlı Rota Kodu (Opsiyonel)
                    </label>
                    <input
                      type="text"
                      placeholder="Örn: RM-408 veya #LKY-26"
                      value={newGroupRoute}
                      onChange={(e) => setNewGroupRoute(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.65rem 0.85rem",
                        borderRadius: "10px",
                        border: "1px solid var(--color-border-strong)",
                        fontSize: "13px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
                <div className="chat-modal-footer">
                  <button
                    type="button"
                    className="chat-btn-map-split"
                    onClick={() => setShowNewGroupModal(false)}
                  >
                    İptal
                  </button>
                  <button type="submit" className="chat-btn-new-group">
                    Grubu Kur & Aç
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Gezgin Seç & Mesaj Başlat (Sadece Arkadaşlarım / Herkes Filtreli) */}
        {showNewChatModal && (
          <div className="chat-modal-backdrop" onClick={() => setShowNewChatModal(false)}>
            <div className="chat-modal-window" onClick={(e) => e.stopPropagation()}>
              <div className="chat-modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                    person_search
                  </span>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "15px",
                      fontWeight: 700,
                      color: "var(--color-text-brand)",
                    }}
                  >
                    Gezgin Seç &amp; Mesaj Gönder
                  </h3>
                </div>
                <button
                  type="button"
                  className="chat-icon-btn"
                  onClick={() => setShowNewChatModal(false)}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="chat-modal-body">
                {/* Privacy Setting Indicator in Modal */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--color-surface-tint)",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "10px",
                    border: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span className="material-symbols-outlined">
                      {messagePrivacy === "friends" ? "lock" : "public"}
                    </span>
                    <span style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      {messagePrivacy === "friends"
                        ? "Sadece Arkadaşlarım Modu Aktif"
                        : "Herkese Açık Mesajlaşma Aktif"}
                    </span>
                  </div>
                  <button
                    type="button"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--color-text-accent)",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      const next = messagePrivacy === "friends" ? "everyone" : "friends";
                      setMessagePrivacy(next);
                      if (typeof window !== "undefined")
                        localStorage.setItem("mapsbridge.messagePrivacy", next);
                      showToastMessage(
                        `Mesajlaşma İzni: ${next === "friends" ? "Sadece Arkadaşlarım" : "Herkes"}`,
                      );
                    }}
                  >
                    Değiştir ↻
                  </button>
                </div>

                {/* Search & Tabs */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div className="chat-search-input-wrap" style={{ margin: 0 }}>
                    <span className="material-symbols-outlined search-icon">search</span>
                    <input
                      type="text"
                      placeholder="İsim veya kullanıcı adına göre ara..."
                      className="chat-list-search-input"
                      value={travelerSearch}
                      onChange={(e) => setTravelerSearch(e.target.value)}
                    />
                  </div>

                  <div className="chat-privacy-pills">
                    <button
                      type="button"
                      className={`chat-privacy-btn ${travelerModalTab === "friends" ? "active" : ""}`}
                      onClick={() => setTravelerModalTab("friends")}
                    >
                      <span className="material-symbols-outlined">group</span>
                      <span>
                        Arkadaşlarım ({DEFAULT_TRAVELER_CONTACTS.filter((c) => c.isFriend).length})
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`chat-privacy-btn ${travelerModalTab === "all" ? "active" : ""}`}
                      onClick={() => setTravelerModalTab("all")}
                    >
                      <span className="material-symbols-outlined">public</span>
                      <span>Tüm Gezginler ({DEFAULT_TRAVELER_CONTACTS.length})</span>
                    </button>
                  </div>
                </div>

                {/* Traveler List */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    maxHeight: "260px",
                    overflowY: "auto",
                    paddingRight: "2px",
                  }}
                >
                  {DEFAULT_TRAVELER_CONTACTS.filter((t) => {
                    if (travelerModalTab === "friends" && !t.isFriend) return false;
                    if (travelerSearch.trim()) {
                      const q = travelerSearch.toLowerCase();
                      return (
                        t.name.toLowerCase().includes(q) ||
                        t.username.toLowerCase().includes(q) ||
                        t.role.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  }).map((traveler) => (
                    <div key={traveler.id} className="chat-traveler-card">
                      <div className="chat-traveler-card-left">
                        <div className="chat-traveler-avatar-sm">
                          {traveler.initial}
                          {traveler.online && (
                            <span
                              className="chat-personal-online-beacon"
                              style={{ width: "10px", height: "10px", borderWidth: "1.5px" }}
                            />
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <strong style={{ fontSize: "13px", color: "var(--color-text-brand)" }}>
                              {traveler.name}
                            </strong>
                            {traveler.isFriend && (
                              <span
                                style={{
                                  fontSize: "9.5px",
                                  fontWeight: 700,
                                  padding: "1px 5px",
                                  borderRadius: "9999px",
                                  background:
                                    "color-mix(in srgb, var(--color-accent) 15%, transparent)",
                                  color: "var(--color-on-surface-brand)",
                                }}
                              >
                                Arkadaş
                              </span>
                            )}
                          </div>
                          <span
                            style={{
                              fontSize: "11px",
                              color: "var(--color-text-muted)",
                              display: "block",
                            }}
                          >
                            @{traveler.username} • {traveler.role}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="chat-btn-direct-msg"
                        onClick={() => handleSelectTravelerToChat(traveler)}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                          chat
                        </span>
                        <span>Mesaj Yaz</span>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Manual input fallback */}
                <div
                  style={{
                    borderTop: "1px solid var(--color-border-subtle)",
                    paddingTop: "0.75rem",
                  }}
                >
                  <form
                    onSubmit={handleCreateDirectChat}
                    style={{ display: "flex", gap: "0.5rem" }}
                  >
                    <input
                      type="text"
                      placeholder="Veya farklı kullanıcı adı (@gezgin)..."
                      value={newChatUser}
                      onChange={(e) => setNewChatUser(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "0.45rem 0.75rem",
                        borderRadius: "8px",
                        border: "1px solid var(--color-border-subtle)",
                        fontSize: "12px",
                        background: "var(--color-surface-tint)",
                        outline: "none",
                      }}
                    />
                    <button
                      type="submit"
                      className="chat-btn-new-group"
                      style={{ padding: "0.45rem 0.85rem", fontSize: "11.5px" }}
                    >
                      Başlat
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal 3: Durak Pinle */}
        {showPinModal && (
          <div className="chat-modal-backdrop" onClick={() => setShowPinModal(false)}>
            <div className="chat-modal-window" onClick={(e) => e.stopPropagation()}>
              <div className="chat-modal-header">
                <h3
                  style={{
                    margin: 0,
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "var(--color-text-brand)",
                  }}
                >
                  Haritaya Yeni Durak Pinle
                </h3>
                <button
                  type="button"
                  className="chat-icon-btn"
                  onClick={() => setShowPinModal(false)}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <form onSubmit={handleDropPin}>
                <div className="chat-modal-body">
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "12px",
                        fontWeight: 700,
                        marginBottom: "4px",
                      }}
                    >
                      Durak / Nokta Adı
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Örn: Uçhisar Kalesi Gün Batımı Seyir Terası"
                      value={pinName}
                      onChange={(e) => setPinName(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.65rem 0.85rem",
                        borderRadius: "10px",
                        border: "1px solid var(--color-border-strong)",
                        fontSize: "13px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "12px",
                        fontWeight: 700,
                        marginBottom: "4px",
                      }}
                    >
                      Ekibe İpucu / Not
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Burası kalabalıktan uzak ve rüzgar almıyor, buluşma için ideal."
                      value={pinNote}
                      onChange={(e) => setPinNote(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.65rem 0.85rem",
                        borderRadius: "10px",
                        border: "1px solid var(--color-border-strong)",
                        fontSize: "13px",
                        boxSizing: "border-box",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>
                </div>
                <div className="chat-modal-footer">
                  <button
                    type="button"
                    className="chat-btn-map-split"
                    onClick={() => setShowPinModal(false)}
                  >
                    İptal
                  </button>
                  <button type="submit" className="chat-btn-new-group">
                    Durak Pinini Paylaş
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 4: Üye Ekle */}
        {showAddMemberModal && (
          <div className="chat-modal-backdrop" onClick={() => setShowAddMemberModal(false)}>
            <div className="chat-modal-window" onClick={(e) => e.stopPropagation()}>
              <div className="chat-modal-header">
                <h3
                  style={{
                    margin: 0,
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "var(--color-text-brand)",
                  }}
                >
                  Gezi Grubuna Üye Davet Et
                </h3>
                <button
                  type="button"
                  className="chat-icon-btn"
                  onClick={() => setShowAddMemberModal(false)}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  showToastMessage(`✓ ${newMemberEmail || "Yeni gezgin"} gruba davet edildi!`);
                  setShowAddMemberModal(false);
                  setNewMemberEmail("");
                }}
              >
                <div className="chat-modal-body">
                  <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0 }}>
                    Grup davet kodu: <strong>#KPD-772</strong>. Bu kodu paylaşabilir veya doğrudan
                    kullanıcı davet edebilirsiniz.
                  </p>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "12px",
                        fontWeight: 700,
                        marginBottom: "4px",
                      }}
                    >
                      Kullanıcı Adı veya E-posta
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Örn: selin veya selin@example.com"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.65rem 0.85rem",
                        borderRadius: "10px",
                        border: "1px solid var(--color-border-strong)",
                        fontSize: "13px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
                <div className="chat-modal-footer">
                  <button
                    type="button"
                    className="chat-btn-map-split"
                    onClick={() => setShowAddMemberModal(false)}
                  >
                    İptal
                  </button>
                  <button type="submit" className="chat-btn-new-group">
                    Davet Gönder
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
