"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { FullPagePromotion } from "../components/auth-gate";
import { HeaderNav } from "../components/header-nav";
import { getStoredSession } from "../lib/cognito";
import { userStorage } from "../lib/user-storage";
import { billingService } from "../lib/billing/billing-service";
import { webSocialSync } from "../lib/social-sync";
import { SoftIcon, SoftBadge } from "../components/soft-icon";
import { EditPostModalWeb } from "../features/community";
import type { CommunityPost } from "../features/community/types";
import "./profile.css";

const DEFAULT_PANORAMIC_COVER =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDTc8C7y216cNhYVun67c1dQAQCYruzM64RWHw44AeECZKUlMYFy2BsIHfwU6-V0zxgT44lEfPZa3GmGYDUIDxkOrtonBJGDHzrNLvyOpToIF8xPDu9WmExhjeSOTQXnUS2s0eIzJXHqjHQwXt5EsZ97-rmxCzi_0dMOHHTaYcTkchmwC2yDxBpc6AOHWJdhD1P4BgTX8eY62qvHLJGGBC724h5yeydozucbvhXuB51u_TDFd-tC-Lr7g";

const DEFAULT_AVATAR_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCQdOMegHKRlkwubsFEMHDlXU8mVoZKUlXw7A0Quos1oSmZCSZEg30fAB4aMRnCI9q8UEUkdzonH9DUfJ3dTRjIPGpEsvmdB7q2Hrn_b98XcVBeB1CNFBlpaQM33IpQEZ9Bj2TQCR_rWOyCdeIsnX_hZXhb7z1nrWj53EXbHiVov_Hx5WO-_ikQRe6lEE_jnkFjZlEF1WXEue5BMqYbUXVJqoHBc--0mvHvT89fTCsu0mllchVOc6h24A";

export type MainTab = "routes" | "posts" | "pool" | "collections" | "analytics" | "sales" | "activity";
// Active tabs: routes, posts, pool, analytics, activity (collections/sales kept for type compat)
export type RouteFilter = "all" | "published" | "drafts" | "onsale";

interface SavedPoint {
  id: string;
  title: string;
  address?: string;
  lat?: number;
  lng?: number;
  group?: string;
  category?: string;
  notes?: string;
  order?: number;
}

interface CollectionItem {
  id: string;
  title: string;
  count: number;
  icon?: string;
  description?: string;
}

interface NotificationItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  type: "system" | "community" | "trip";
  icon: string;
  unread: boolean;
}

export default function ProfilePage() {
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");

  // Profile Information
  const [fullName, setFullName] = useState<string>("Gezgin");
  const [username, setUsername] = useState<string>("gezgin");
  const [userAvatar, setUserAvatar] = useState<string>(DEFAULT_AVATAR_IMAGE);
  const [coverPhoto, setCoverPhoto] = useState<string>(DEFAULT_PANORAMIC_COVER);
  const [travelBio, setTravelBio] = useState<string>("");

  // Tabs & Filters
  const [activeMainTab, setActiveMainTab] = useState<MainTab>("routes");
  const [activeFilter, setActiveFilter] = useState<RouteFilter>("all");
  const [poolCategoryFilter, setPoolCategoryFilter] = useState<string>("all");

  // Data Stores
  const [savedTrips, setSavedTrips] = useState<any[]>([]);
  const [savedPins, setSavedPins] = useState<SavedPoint[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Community Posts Sync
  const [allPosts, setAllPosts] = useState<CommunityPost[]>([]);
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);

  // Feedback & Wallet
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [walletCredits, setWalletCredits] = useState<number>(() => billingService.getWallet().credits);
  const [subscriptionTier, setSubscriptionTier] = useState<string>(() => billingService.getWallet().subscriptionTier);

  useEffect(() => {
    const session = getStoredSession();
    if (!session?.email || !session?.token) {
      const urlParams = new URLSearchParams(window.location.search);
      setIsAuthenticated(false);
      setMounted(true);
      return;
    }
    setIsAuthenticated(true);
    if (session?.email) {
      setUserEmail(session.email);
      const emailPrefix = session.email.split("@")[0] || "";
      const derivedName = emailPrefix
        ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)
        : "Gezgin";
      setFullName((prev) => (prev === "Gezgin" || !prev ? derivedName : prev));
      setUsername((prev) => (prev === "gezgin" || !prev ? emailPrefix.toLowerCase() : prev));
    }

    // Load saved avatar & cover
    const savedAvatar = userStorage.getItem("mapsbridge.userAvatar");
    if (savedAvatar) setUserAvatar(savedAvatar);

    const savedCover = userStorage.getItem("mapsbridge.userCoverPhoto");
    if (savedCover) setCoverPhoto(savedCover);

    // Load details
    try {
      const stored = userStorage.getItem("mapsbridge.userProfileDetails");
      if (stored) {
        const d = JSON.parse(stored);
        if (d.fullName) setFullName(d.fullName);
        else if (d.firstName) setFullName(`${d.firstName} ${d.lastName || ""}`.trim());
        if (d.username) setUsername(d.username);
        if (d.bio) setTravelBio(d.bio);
      }
    } catch {}

    // Load user trips
    try {
      const tripsRaw = userStorage.getItem("mapsbridge.travelPlanner");
      if (tripsRaw) {
        const parsed = JSON.parse(tripsRaw);
        if (Array.isArray(parsed?.trips)) {
          const validTrips = parsed.trips.filter((t: any) => t.pins && t.pins.length > 0);
          setSavedTrips(validTrips);
        }
      }
    } catch {}

    // Load user pins/points from adreskopru.savedAddresses or mapsbridge.generalPins
    try {
      let loadedPins: SavedPoint[] = [];
      const addrRaw = userStorage.getItem("adreskopru.savedAddresses");
      if (addrRaw) {
        const parsed = JSON.parse(addrRaw);
        if (Array.isArray(parsed)) loadedPins = parsed;
      }
      if (loadedPins.length === 0) {
        const pinsRaw = userStorage.getItem("mapsbridge.generalPins");
        if (pinsRaw) {
          const parsedPins = JSON.parse(pinsRaw);
          if (Array.isArray(parsedPins)) loadedPins = parsedPins;
        }
      }
      setSavedPins(loadedPins);
    } catch {}

    // Load collections
    try {
      const colRaw = userStorage.getItem("mapsbridge.collections");
      if (colRaw) {
        const parsed = JSON.parse(colRaw);
        if (Array.isArray(parsed)) setCollections(parsed);
      } else {
        const defaultCollections: CollectionItem[] = [
          {
            id: "col-1",
            title: "Favori Duraklarım",
            count: 0,
            icon: "favorite",
            description: "En sık ziyaret edilen ve favorilere eklenen özel noktalar.",
          },
          {
            id: "col-2",
            title: "Günübirlik Keşifler",
            count: 0,
            icon: "weekend",
            description: "Hafta sonu doğa ve kaçamak güzergahları.",
          },
          {
            id: "col-3",
            title: "Gurme & Kafe Rehberi",
            count: 0,
            icon: "restaurant",
            description: "Şehir içi denenmesi gereken lezzet durakları.",
          },
        ];
        setCollections(defaultCollections);
        userStorage.setItem("mapsbridge.collections", JSON.stringify(defaultCollections));
      }
    } catch {}

    // Load notifications
    try {
      const notifRaw = userStorage.getItem("mapsbridge.notifications");
      if (notifRaw) {
        const parsedNotifs = JSON.parse(notifRaw);
        if (Array.isArray(parsedNotifs)) setNotifications(parsedNotifs);
      } else {
        const initialNotifs: NotificationItem[] = [
          {
            id: "notif-1",
            title: "Gezgin Masasına Hoş Geldiniz!",
            desc: "MapsBridge seyahat masanız hazır. Harita üzerinden noktalar kaydedip rotalarınızı çizebilirsiniz.",
            time: "Bugün",
            type: "system",
            icon: "explore",
            unread: true,
          },
          {
            id: "notif-2",
            title: "AI Seyahat Asistanı Aktif",
            desc: "Yapay zeka rehberiniz ile tek tıkla çok günlük seyahat planları ve gezi durakları oluşturabilirsiniz.",
            time: "Dün",
            type: "system",
            icon: "smart_toy",
            unread: true,
          },
          {
            id: "notif-3",
            title: "Topluluğa Katıldınız",
            desc: "Gezginler topluluğunda rota paylaşımı ve keşif özellikleri hesabınız için aktif edildi.",
            time: "3 gün önce",
            type: "community",
            icon: "group",
            unread: false,
          },
        ];
        setNotifications(initialNotifs);
        userStorage.setItem("mapsbridge.notifications", JSON.stringify(initialNotifs));
      }
    } catch {}

    if (session?.token) {
      void billingService.refreshWallet().then((w) => {
      setWalletCredits(w.credits);
      setSubscriptionTier(w.subscriptionTier);
    }).catch(() => {});
    }
    const handleWallet = () => {
      const w = billingService.getWallet();
      setWalletCredits(w.credits);
      setSubscriptionTier(w.subscriptionTier);
    };
    window.addEventListener("mapsbridge:wallet_updated", handleWallet);

    setMounted(true);
    return () => window.removeEventListener("mapsbridge:wallet_updated", handleWallet);
  }, []);

  // Community Posts & Profile Sync
  useEffect(() => {
    setAllPosts(webSocialSync.getPosts());
    const unsubPosts = webSocialSync.subscribePosts((posts) => {
      setAllPosts(posts);
    });
    const unsubProfile = webSocialSync.subscribeProfile((p) => {
      if (p.fullName) setFullName(p.fullName);
      if (p.username) setUsername(p.username);
      if (p.avatarUrl) setUserAvatar(p.avatarUrl);
      if (p.coverPhotoUrl) setCoverPhoto(p.coverPhotoUrl);
      if (p.bio) setTravelBio(p.bio);
    });
    return () => {
      unsubPosts();
      unsubProfile();
    };
  }, []);

  const handleEditUserPost = (
    postId: string,
    updates: {
      content?: string;
      category?: string;
      locationTag?: string;
      hashtags?: string[];
    }
  ) => {
    webSocialSync.editPost(postId, updates);
    showToast("✓ Paylaşımınız güncellendi!");
  };

  const handleDeleteUserPost = (postId: string) => {
    if (!window.confirm("Bu paylaşımı silmek istediğinize emin misiniz?")) return;
    webSocialSync.deletePost(postId);
    showToast("✓ Paylaşımınız silindi.");
  };

  const userPosts = allPosts.filter(
    (p) =>
      p.authorUsername === username ||
      p.authorDisplayName === fullName
  );

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }

  function handleCopyProfileLink() {
    const url = `https://mapsbridge.com/@${username || "gezgin"}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    showToast("✓ Profil bağlantısı kopyalandı!");
    setTimeout(() => setCopiedLink(false), 2000);
  }

  // Delete Trip
  function handleDeleteTrip(tripId: string) {
    if (!window.confirm("Bu rotayı profilinizden silmek istediğinize emin misiniz?")) return;
    const updated = savedTrips.filter((t) => t.id !== tripId);
    setSavedTrips(updated);
    try {
      const tripsRaw = userStorage.getItem("mapsbridge.travelPlanner");
      if (tripsRaw) {
        const parsed = JSON.parse(tripsRaw);
        parsed.trips = updated;
        userStorage.setItem("mapsbridge.travelPlanner", JSON.stringify(parsed));
      }
    } catch {}
    showToast("Rota başarıyla silindi.");
  }

  // Delete Pin from Pool
  function handleDeletePin(pinId: string) {
    const updated = savedPins.filter((p) => p.id !== pinId);
    setSavedPins(updated);
    try {
      userStorage.setItem("adreskopru.savedAddresses", JSON.stringify(updated));
    } catch {}
    showToast("Nokta havuzdan kaldırıldı.");
  }

  // Add Collection
  function handleCreateCollection() {
    const name = window.prompt("Yeni Koleksiyon Başlığı:");
    if (!name || !name.trim()) return;
    const newCol: CollectionItem = {
      id: `col-${Date.now()}`,
      title: name.trim(),
      count: 0,
      icon: "folder_special",
      description: "Özel seçilmiş seyahat durakları ve rota koleksiyonu.",
    };
    const updated = [newCol, ...collections];
    setCollections(updated);
    userStorage.setItem("mapsbridge.collections", JSON.stringify(updated));
    showToast(`"${name.trim()}" koleksiyonu oluşturuldu.`);
  }

  // Delete Collection
  function handleDeleteCollection(colId: string) {
    const updated = collections.filter((c) => c.id !== colId);
    setCollections(updated);
    userStorage.setItem("mapsbridge.collections", JSON.stringify(updated));
    showToast("Koleksiyon kaldırıldı.");
  }

  // Mark all notifications read
  function handleMarkAllNotifsRead() {
    const updated = notifications.map((n) => ({ ...n, unread: false }));
    setNotifications(updated);
    userStorage.setItem("mapsbridge.notifications", JSON.stringify(updated));
    showToast("Tüm bildirimler okundu olarak işaretlendi.");
  }

  const unreadNotifCount = notifications.filter((n) => n.unread).length;

  // Filtered trips
  const filteredTrips = savedTrips.filter((t) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "drafts") return true; // all local trips are drafts
    if (activeFilter === "published") return false;
    if (activeFilter === "onsale") return false;
    return true;
  });

  // Unique categories in pool
  const poolCategories = Array.from(
    new Set(savedPins.map((p) => p.category || p.group || "Genel").filter(Boolean))
  );

  const filteredPins = savedPins.filter((p) => {
    if (poolCategoryFilter === "all") return true;
    const cat = p.category || p.group || "Genel";
    return cat.toLowerCase() === poolCategoryFilter.toLowerCase();
  });

  // Total pins in trips + pool
  const totalTripPinsCount = savedTrips.reduce((acc, t) => acc + (t.pins?.length || 0), 0);

  if (isAuthenticated === false) {
    return (
      <FullPagePromotion
        badgeIcon="👤"
        badgeText="Kaşif Portföyü & Yönetim Paneli"
        heroTitle="Kişisel Seyahat Profilinize Hoş Geldiniz"
        heroSubtitle="Rotalarınızı yönetmek, seyahat havuzunuzu incelemek ve toplulukla etkileşimde bulunmak için lütfen hesabınıza giriş yapın veya ücretsiz üye olun."
        nextUrl="/profile/"
        primaryButtonText="Ücretsiz Kayıt Ol"
        secondaryButtonText="Giriş Yap"
        features={[
          {
            icon: "🗺️",
            title: "Yayınlanan & Taslak Rotalar",
            description: "Oluşturduğunuz tüm seyahat planlarını tek merkezden yönetin ve haritada açın.",
          },
          {
            icon: "📍",
            title: "Havuzdaki Durak & Pinler",
            description: "Haritadan kaydettiğiniz tüm noktaları organize edin ve rotalara dahil edin.",
          },
          {
            icon: "📈",
            title: "Gezgin İstatistikleri & Gelir",
            description: "Keşif mesafenizi, durak etkileşimlerinizi ve rota satış durumunuzu izleyin.",
          },
          {
            icon: "📁",
            title: "Tematik Koleksiyonlar",
            description: "Duraklarınızı kategorilere ayırarak özel seyahat albümleri oluşturun.",
          },
        ]}
      />
    );
  }

  return (
    <div className="stitch-main-profile-root">
      {/* Unified Global Header */}
      <HeaderNav />

      {/* Hero Background */}
      <div className="profile-hero-bg" />

      {/* Main Container */}
      <main className="stitch-profile-container">
        {/* Compact Profile Header */}
        <div className="stitch-profile-header-card" style={{ marginTop: "0.75rem" }}>
          <div className="stitch-profile-header-top">
            <div className="stitch-identity-col">
              <div className="stitch-avatar-large-wrap">
                <div className="stitch-avatar-large-box">
                  {userAvatar ? (
                    <img src={userAvatar} alt={fullName} />
                  ) : (
                    (fullName || "A").charAt(0)
                  )}
                </div>
              </div>

              <div className="stitch-identity-info">
                <div className="stitch-name-status-row">
                  <h1 className="stitch-user-fullname">{fullName || "Gezgin"}</h1>
                  <span className="stitch-user-handle-tag">@{username || "gezgin"}</span>
                  {(savedTrips.length > 0 || subscriptionTier !== "free") && (
                    <span className="stitch-route-leader-badge">
                      <span className="stitch-pulse-dot"></span>
                      <span>
                        {savedTrips.length > 0
                          ? "DOĞRULANMIŞ ROTA LİSTESİ"
                          : subscriptionTier === "agency"
                          ? "TUR LİDERİ"
                          : "PRO"}
                      </span>
                    </span>
                  )}
                </div>

                {travelBio && <p className="stitch-user-bio-text">{travelBio}</p>}

                <div className="stitch-stats-badges-row">
                  <div className="stitch-stat-pill">
                    <span>{savedTrips.length}</span>
                    <span style={{ color: "var(--sb-text-muted)" }}>Rota</span>
                  </div>
                  <div className="stitch-stat-divider" />
                  <div className="stitch-stat-pill">
                    <span>{savedPins.length}</span>
                    <span style={{ color: "var(--sb-text-muted)" }}>Mekan</span>
                  </div>
                  <div className="stitch-stat-divider" />
                  <div className="stitch-stat-pill">
                    <span>{walletCredits}</span>
                    <span style={{ color: "var(--sb-text-muted)" }}>Kredi</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="stitch-profile-actions-bar">
              <Link href="/profile/edit/" className="stitch-action-btn-neutral">
                <span className="material-symbols-outlined text-[18px]">edit</span>
                <span>Profili Düzenle</span>
              </Link>

              <button
                type="button"
                className="stitch-action-btn-neutral"
                onClick={handleCopyProfileLink}
                title="Profil bağlantısını kopyala"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {copiedLink ? "done" : "share"}
                </span>
                <span>{copiedLink ? "Kopyalandı" : "Paylaş"}</span>
              </button>

              <Link href="/desk/" className="stitch-action-btn-primary">
                <span className="material-symbols-outlined text-[18px]">visibility</span>
                <span>Ön İzleme</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Clean Workspace - Tabs & Content */}
        <div className="stitch-workspace-columns">
          <div className="stitch-routes-workspace">
            {/* Tab Navigation */}
            <div className="stitch-tabs-bar">
              <button
                type="button"
                className={`stitch-workspace-tab ${activeMainTab === "routes" ? "active" : ""}`}
                onClick={() => setActiveMainTab("routes")}
              >
                <span className="material-symbols-outlined text-[18px]">map</span>
                <span>Rotalar ({savedTrips.length})</span>
              </button>

              <button
                type="button"
                className={`stitch-workspace-tab ${activeMainTab === "posts" ? "active" : ""}`}
                onClick={() => setActiveMainTab("posts")}
              >
                <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
                <span>Paylaşımlar ({userPosts.length})</span>
              </button>

              <button
                type="button"
                className={`stitch-workspace-tab ${activeMainTab === "pool" ? "active" : ""}`}
                onClick={() => setActiveMainTab("pool")}
              >
                <span className="material-symbols-outlined text-[18px]">bookmark</span>
                <span>Kayıtlı Mekanlar ({savedPins.length})</span>
              </button>

              <button
                type="button"
                className={`stitch-workspace-tab ${activeMainTab === "analytics" ? "active" : ""}`}
                onClick={() => setActiveMainTab("analytics")}
              >
                <span className="material-symbols-outlined text-[18px]">bar_chart</span>
                <span>İstatistik</span>
              </button>

              <button
                type="button"
                className={`stitch-workspace-tab ${activeMainTab === "activity" ? "active" : ""}`}
                onClick={() => setActiveMainTab("activity")}
              >
                <span className="material-symbols-outlined text-[18px]">notifications</span>
                {unreadNotifCount > 0 && <span className="stitch-tab-badge">{unreadNotifCount}</span>}
              </button>
            </div>

            {/* TAB: ROTALARIM */}
            {activeMainTab === "routes" && (
              <>
                <div className="stitch-filter-bar">
                  <div className="stitch-filter-chips">
                    <button
                      type="button"
                      className={`stitch-filter-chip ${activeFilter === "all" ? "active" : ""}`}
                      onClick={() => setActiveFilter("all")}
                    >
                      Tümü ({savedTrips.length})
                    </button>
                    <button
                      type="button"
                      className={`stitch-filter-chip ${activeFilter === "published" ? "active" : ""}`}
                      onClick={() => setActiveFilter("published")}
                    >
                      Yayınlananlar
                    </button>
                    <button
                      type="button"
                      className={`stitch-filter-chip ${activeFilter === "drafts" ? "active" : ""}`}
                      onClick={() => setActiveFilter("drafts")}
                    >
                      Taslaklar ({savedTrips.length})
                    </button>
                    <button
                      type="button"
                      className={`stitch-filter-chip ${activeFilter === "onsale" ? "active" : ""}`}
                      onClick={() => setActiveFilter("onsale")}
                    >
                      Satışta
                    </button>
                  </div>
                  <div className="stitch-filter-actions">
                    <Link href="/desk/" className="stitch-btn-add-quick">
                      <span className="material-symbols-outlined text-[16px]">flight_takeoff</span>
                      <span>Hızlı Rota Ekle</span>
                    </Link>
                  </div>
                </div>

                <div className="stitch-route-cards-list">
                  {filteredTrips.length === 0 ? (
                    <div className="stitch-empty-state-box">
                      <span className="material-symbols-outlined stitch-empty-icon">explore</span>
                      <div>
                        <h4 className="stitch-empty-title">
                          {activeFilter === "published"
                            ? "Henüz Yayınlanan Rota Yok"
                            : activeFilter === "onsale"
                            ? "Henüz Satışta Olan Rota Yok"
                            : "Henüz Kayıtlı Bir Rota Yok"}
                        </h4>
                        <p className="stitch-empty-desc">
                          Seyahat masanızda yeni duraklar ekleyerek kendi rotanızı çizebilir veya AI
                          Seyahat Asistanı ile saniyeler içinde kişiselleştirilmiş bir gezi taslağı
                          oluşturabilirsiniz.
                        </p>
                      </div>
                      <div className="stitch-empty-actions">
                        <Link href="/desk/" className="stitch-btn-add-quick" style={{ padding: "0.55rem 1.1rem" }}>
                          <span className="material-symbols-outlined text-[16px]">add</span>
                          <span>Seyahat Masasında Rota Oluştur</span>
                        </Link>
                        <Link
                          href="/ai/"
                          className="stitch-btn-add-quick"
                          style={{
                            padding: "0.55rem 1.1rem",
                            background: "rgba(16, 185, 129, 0.15)",
                            borderColor: "rgba(16, 185, 129, 0.35)",
                            color: "#34d399",
                          }}
                        >
                          <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                          <span>AI Asistan ile Planla</span>
                        </Link>
                      </div>
                    </div>
                  ) : (
                    filteredTrips.map((trip) => {
                      const pinCount = trip.pins?.length || 0;
                      const dayCount = trip.days?.length || 1;
                      return (
                        <div key={trip.id} className="stitch-route-card">
                          <div className="stitch-route-thumb-wrap">
                            <div
                              style={{
                                width: "100%",
                                height: "100%",
                                minHeight: "130px",
                                background: "linear-gradient(135deg, #0d9488 0%, #1e293b 100%)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <span
                                className="material-symbols-outlined text-white"
                                style={{ fontSize: "36px", opacity: 0.8 }}
                              >
                                map
                              </span>
                            </div>
                            <div className="stitch-thumb-badge draft">
                              <span className="material-symbols-outlined text-[14px]">edit_document</span>
                              <span>TASLAK</span>
                            </div>
                          </div>

                          <div className="stitch-route-info-col">
                            <div className="flex flex-col gap-1.5">
                              <div className="stitch-route-meta-top">
                                <div className="stitch-route-duration-pill">
                                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                                  <span>
                                    {dayCount} GÜN · {pinCount} DURAK
                                  </span>
                                </div>
                              </div>

                              <h3 className="stitch-route-title">{trip.title || "Adsız Gezi Rotası"}</h3>
                              <p className="stitch-route-desc">
                                {trip.destination || "Belirlenmiş seyahat planı ve kişisel duraklar."}
                              </p>
                            </div>

                            <div className="stitch-route-actions-bottom">
                              <div className="stitch-route-btn-group">
                                <Link
                                  href={`/desk/?trip=${encodeURIComponent(trip.id)}`}
                                  className="stitch-route-btn primary"
                                >
                                  <span className="material-symbols-outlined text-[16px]">edit</span>
                                  <span>Düzenle</span>
                                </Link>
                                <Link
                                  href={`/desk/?trip=${encodeURIComponent(trip.id)}`}
                                  className="stitch-route-btn"
                                >
                                  <span className="material-symbols-outlined text-[16px]">map</span>
                                  <span>Haritada Aç</span>
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTrip(trip.id)}
                                  className="stitch-route-btn"
                                  title="Rotayı Sil"
                                  style={{ color: "#ef4444" }}
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </div>
                              <span className="text-xs text-muted">Kişisel gezi</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {/* TAB: PAYLAŞIMLARIM & TOPLULUK */}
            {activeMainTab === "posts" && (
              <div className="stitch-posts-workspace" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", padding: "0.5rem 0" }}>
                  <div>
                    <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <SoftIcon name="send" size={20} />
                      <span>Seyahat Hikayeleri &amp; Paylaşımlarım</span>
                      <SoftBadge variant="emerald">{userPosts.length} Paylaşım</SoftBadge>
                    </h2>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "var(--stitch-text-muted, #94a3b8)" }}>
                      Topluluk akışında yayınlanan seyahat notlarınız, rotalarınız ve fotoğraflı anılarınız.
                    </p>
                  </div>
                  <Link
                    href="/community/"
                    className="stitch-action-btn-primary"
                    style={{ textDecoration: "none", fontSize: "0.85rem", padding: "0.5rem 0.9rem" }}
                  >
                    <SoftIcon name="plus" size={16} />
                    <span>Toplulukta Paylaş</span>
                  </Link>
                </div>

                {userPosts.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3.5rem 1rem", background: "rgba(255,255,255,0.02)", borderRadius: "1rem", border: "1px dashed rgba(255,255,255,0.08)" }}>
                    <div style={{ display: "inline-flex", padding: "1rem", borderRadius: "999px", background: "rgba(16, 185, 129, 0.1)", marginBottom: "0.75rem" }}>
                      <SoftIcon name="send" size={32} />
                    </div>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 600, margin: "0 0 0.5rem" }}>Henüz bir deneyim paylaşmadınız</h3>
                    <p style={{ fontSize: "0.85rem", color: "#94a3b8", maxWidth: "420px", margin: "0 auto 1.25rem" }}>
                      Gezdiğiniz yerleri, favori rotalarınızı ve seyahat ipuçlarınızı MapsBridge topluluğuyla paylaşarak diğer gezginlere ilham verin.
                    </p>
                    <Link
                      href="/community/"
                      className="stitch-action-btn-primary"
                      style={{ textDecoration: "none", display: "inline-flex" }}
                    >
                      <SoftIcon name="compass" size={16} />
                      <span>İlk Deneyiminizi Paylaşın</span>
                    </Link>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {userPosts.map((post) => (
                      <article
                        key={post.id}
                        style={{
                          background: "var(--stitch-card-bg, rgba(30, 41, 59, 0.45))",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          borderRadius: "1rem",
                          padding: "1.25rem",
                          backdropFilter: "blur(12px)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <img
                              src={post.authorAvatar || userAvatar || DEFAULT_AVATAR_IMAGE}
                              alt={post.authorDisplayName}
                              style={{ width: "40px", height: "40px", borderRadius: "999px", objectFit: "cover" }}
                            />
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{post.authorDisplayName}</span>
                                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>@{post.authorUsername}</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", color: "#94a3b8" }}>
                                <span>{post.createdAt}</span>
                                {post.locationTag && (
                                  <>
                                    <span>•</span>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem" }}>
                                      <SoftIcon name="map-pin" size={12} />
                                      <span>{post.locationTag}</span>
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            {post.category && <SoftBadge variant="emerald">{post.category}</SoftBadge>}
                            <button
                              type="button"
                              onClick={() => setEditingPost(post)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.35rem",
                                padding: "0.4rem 0.75rem",
                                borderRadius: "0.5rem",
                                background: "rgba(255, 255, 255, 0.06)",
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                color: "#e2e8f0",
                                fontSize: "0.8rem",
                                cursor: "pointer",
                                transition: "all 0.2s",
                              }}
                              title="Paylaşımı Düzenle"
                            >
                              <SoftIcon name="edit" size={14} />
                              <span>Düzenle</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUserPost(post.id)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.35rem",
                                padding: "0.4rem 0.65rem",
                                borderRadius: "0.5rem",
                                background: "rgba(239, 68, 68, 0.1)",
                                border: "1px solid rgba(239, 68, 68, 0.2)",
                                color: "#fca5a5",
                                fontSize: "0.8rem",
                                cursor: "pointer",
                                transition: "all 0.2s",
                              }}
                              title="Paylaşımı Sil"
                            >
                              <SoftIcon name="trash" size={14} />
                              <span>Sil</span>
                            </button>
                          </div>
                        </div>

                        <p style={{ margin: "0.5rem 0 0.75rem", fontSize: "0.95rem", lineHeight: 1.5, color: "#f1f5f9", whiteSpace: "pre-wrap" }}>
                          {post.content}
                        </p>

                        {post.image && (
                          <div style={{ margin: "0.75rem 0", borderRadius: "0.75rem", overflow: "hidden", maxHeight: "360px" }}>
                            <img src={post.image} alt="Seyahat Görseli" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                        )}

                        {post.hashtags && post.hashtags.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", margin: "0.5rem 0" }}>
                            {post.hashtags.map((tag, idx) => (
                              <SoftBadge key={idx} variant="slate">{tag.startsWith("#") ? tag : `#${tag}`}</SoftBadge>
                            ))}
                          </div>
                        )}

                        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: "0.8rem", color: "#94a3b8" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                            <SoftIcon name="heart" size={14} />
                            <span>{post.likesCount} beğeni</span>
                          </span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                            <SoftIcon name="chat" size={14} />
                            <span>{post.comments?.length || 0} yorum</span>
                          </span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                            <SoftIcon name="sparkles" size={14} />
                            <span>{post.viewsCount || 0} görüntülenme</span>
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: HAVUZDAKİ NOKTALAR */}
            {activeMainTab === "pool" && (
              <div className="stitch-pool-section">
                <div className="stitch-filter-bar">
                  <div className="stitch-filter-chips">
                    <button
                      type="button"
                      className={`stitch-filter-chip ${poolCategoryFilter === "all" ? "active" : ""}`}
                      onClick={() => setPoolCategoryFilter("all")}
                    >
                      Tümü ({savedPins.length})
                    </button>
                    {poolCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={`stitch-filter-chip ${
                          poolCategoryFilter.toLowerCase() === cat.toLowerCase() ? "active" : ""
                        }`}
                        onClick={() => setPoolCategoryFilter(cat)}
                      >
                        {cat} ({savedPins.filter((p) => (p.category || p.group || "Genel").toLowerCase() === cat.toLowerCase()).length})
                      </button>
                    ))}
                  </div>

                  <div className="stitch-filter-actions">
                    <Link href="/desk/" className="stitch-btn-add-quick">
                      <span className="material-symbols-outlined text-[16px]">add_location</span>
                      <span>Haritada Nokta Ekle</span>
                    </Link>
                  </div>
                </div>

                {filteredPins.length === 0 ? (
                  <div className="stitch-empty-state-box">
                    <span className="material-symbols-outlined stitch-empty-icon">pin_drop</span>
                    <div>
                      <h4 className="stitch-empty-title">Havuzda Kayıtlı Nokta Yok</h4>
                      <p className="stitch-empty-desc">
                        Seyahat masasında keşfettiğiniz veya aradığınız konumları &quot;Kaydet&quot; butonu
                        ile bu havuza ekleyebilir, ardından tek dokunuşla seyahat rotalarınıza dahil
                        edebilirsiniz.
                      </p>
                    </div>
                    <div className="stitch-empty-actions">
                      <Link href="/desk/" className="stitch-btn-add-quick" style={{ padding: "0.55rem 1.1rem" }}>
                        <span className="material-symbols-outlined text-[16px]">explore</span>
                        <span>Harita Masasında Nokta Keşfet</span>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="stitch-pool-grid">
                    {filteredPins.map((pin) => {
                      const categoryName = pin.category || pin.group || "Genel Durak";
                      const mapLink =
                        pin.lat && pin.lng
                          ? `/desk/?lat=${pin.lat}&lng=${pin.lng}&zoom=16`
                          : `/desk/`;

                      return (
                        <div key={pin.id} className="stitch-pool-card">
                          <div className="stitch-pool-card-header">
                            <span className="stitch-pool-category-badge">
                              <span className="material-symbols-outlined text-[14px]">place</span>
                              <span>{categoryName}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeletePin(pin.id)}
                              className="stitch-pool-delete-btn"
                              title="Noktayı Havuzdan Kaldır"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </div>

                          <h4 className="stitch-pool-card-title">{pin.title || "Adsız Durak"}</h4>
                          <p className="stitch-pool-card-address">
                            {pin.address ||
                              (pin.lat && pin.lng
                                ? `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`
                                : "Kişisel havuz noktası")}
                          </p>
                          {pin.notes && <p className="stitch-pool-card-notes">{pin.notes}</p>}

                          <div className="stitch-pool-card-footer">
                            <Link href={mapLink} className="stitch-route-btn primary" style={{ width: "100%", justifyContent: "center" }}>
                              <span className="material-symbols-outlined text-[16px]">near_me</span>
                              <span>Haritada Göster</span>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: KOLEKSİYONLAR */}
            {activeMainTab === "collections" && (
              <div className="stitch-collections-section">
                <div className="stitch-filter-bar">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[20px]">
                      folder_special
                    </span>
                    <span className="text-sm font-semibold text-main">
                      Kayıtlı Albümler ve Tematik Listeler ({collections.length})
                    </span>
                  </div>

                  <div className="stitch-filter-actions">
                    <button
                      type="button"
                      onClick={handleCreateCollection}
                      className="stitch-btn-add-quick"
                    >
                      <span className="material-symbols-outlined text-[16px]">create_new_folder</span>
                      <span>Yeni Koleksiyon</span>
                    </button>
                  </div>
                </div>

                <div className="stitch-collections-grid">
                  {collections.map((col) => (
                    <div key={col.id} className="stitch-collection-card">
                      <div className="stitch-collection-top">
                        <div className="stitch-collection-icon-wrap">
                          <span className="material-symbols-outlined text-[26px]">
                            {col.icon || "folder"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteCollection(col.id)}
                          className="stitch-pool-delete-btn"
                          title="Koleksiyonu Sil"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>

                      <h4 className="stitch-collection-title">{col.title}</h4>
                      <p className="stitch-collection-desc">
                        {col.description || "Tematik olarak derlenmiş seyahat durakları."}
                      </p>

                      <div className="stitch-collection-footer">
                        <span className="stitch-collection-count-pill">
                          <span className="material-symbols-outlined text-[14px]">pin_drop</span>
                          <span>{col.count} Durak / Rota</span>
                        </span>
                        <Link
                          href={`/desk/?collection=${encodeURIComponent(col.title)}`}
                          className="stitch-route-btn"
                        >
                          <span className="material-symbols-outlined text-[16px]">folder_open</span>
                          <span>Aç</span>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: İSTATİSTİK & ANALİTİK */}
            {activeMainTab === "analytics" && (
              <div className="stitch-analytics-section">
                {/* 4 Clean Metric Cards */}
                <div className="stitch-analytics-cards-grid">
                  <div className="stitch-analytics-metric-card">
                    <div className="stitch-metric-icon-wrap">
                      <span className="material-symbols-outlined">explore</span>
                    </div>
                    <div className="stitch-analytics-metric-info">
                      <span className="stitch-analytics-value">0 km</span>
                      <span className="stitch-analytics-label">Toplam Keşif Kaydı</span>
                    </div>
                  </div>

                  <div className="stitch-analytics-metric-card">
                    <div className="stitch-metric-icon-wrap">
                      <span className="material-symbols-outlined">place</span>
                    </div>
                    <div className="stitch-analytics-metric-info">
                      <span className="stitch-analytics-value">
                        {savedPins.length + totalTripPinsCount}
                      </span>
                      <span className="stitch-analytics-label">Kayıtlı Durak & Pin</span>
                    </div>
                  </div>

                  <div className="stitch-analytics-metric-card">
                    <div className="stitch-metric-icon-wrap">
                      <span className="material-symbols-outlined">visibility</span>
                    </div>
                    <div className="stitch-analytics-metric-info">
                      <span className="stitch-analytics-value">0</span>
                      <span className="stitch-analytics-label">Profil & Rota Görüntülenme</span>
                    </div>
                  </div>

                  <div className="stitch-analytics-metric-card">
                    <div className="stitch-metric-icon-wrap">
                      <span className="material-symbols-outlined">smart_toy</span>
                    </div>
                    <div className="stitch-analytics-metric-info">
                      <span className="stitch-analytics-value">{walletCredits} Kredi</span>
                      <span className="stitch-analytics-label">Kalan AI Asistan Kredisi</span>
                    </div>
                  </div>
                </div>

                {/* Activity Visualizer & Badges */}
                <div className="stitch-analytics-visual-grid">
                  <div className="stitch-analytics-card">
                    <div className="stitch-analytics-card-header">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-secondary text-[20px]">
                          bar_chart
                        </span>
                        <h4 className="font-bold text-main text-base">Haftalık Keşif ve Planlama Aktivitesi</h4>
                      </div>
                      <span className="text-xs text-muted font-medium">Son 7 Gün</span>
                    </div>

                    <div style={{ textAlign: "center", padding: "2rem 1rem", color: "#94a3b8" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "32px", opacity: 0.4, display: "block", margin: "0 auto 8px" }}>
                        bar_chart
                      </span>
                      <p style={{ margin: 0, fontSize: "13px" }}>
                        Henüz yeterli aktivite verisi oluşmadı. Rota ve durak ekledikçe istatistikleriniz burada görünecek.
                      </p>
                    </div>
                  </div>

                  <div className="stitch-analytics-card">
                    <div className="stitch-analytics-card-header">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-secondary text-[20px]">
                          military_tech
                        </span>
                        <h4 className="font-bold text-main text-base">Gezgin Rozetleri & Seviye</h4>
                      </div>
                      <span className="text-xs font-bold text-emerald-accent">Seviye 1 Keşifçi</span>
                    </div>

                    <div className="stitch-badges-list">
                      <div className={`stitch-badge-item ${savedTrips.length > 0 ? "active" : ""}`}>
                        <div className={`stitch-badge-icon ${savedTrips.length > 0 ? "gold" : ""}`} style={savedTrips.length === 0 ? { opacity: 0.4 } : {}}>
                          <span className="material-symbols-outlined text-[18px]">verified</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-main">Doğrulanmış Rota Lideri</span>
                          <span className="text-xs text-muted">
                            {savedTrips.length > 0
                              ? "Kişisel profili ve gezi kayıtları onaylandı."
                              : "İlk rotanı oluşturarak bu rozeti kazan."}
                          </span>
                        </div>
                      </div>

                      <div className={`stitch-badge-item ${(savedPins.length + totalTripPinsCount) >= 10 ? "active" : ""}`}>
                        <div className={`stitch-badge-icon ${(savedPins.length + totalTripPinsCount) >= 10 ? "mint" : ""}`} style={(savedPins.length + totalTripPinsCount) < 10 ? { opacity: 0.4 } : {}}>
                          <span className="material-symbols-outlined text-[18px]">explore</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-main">Pusula Kaşifi</span>
                          <span className="text-xs text-muted">
                            {(savedPins.length + totalTripPinsCount) >= 10
                              ? "10'dan fazla durak ve seyahat rotası kaydedildi."
                              : `${savedPins.length + totalTripPinsCount}/10 durak kaydedildi. Devam et!`}
                          </span>
                        </div>
                      </div>

                      <div className="stitch-badge-item">
                        <div className="stitch-badge-icon" style={{ opacity: 0.4 }}>
                          <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-main">AI Destekli Seyyah</span>
                          <span className="text-xs text-muted">AI Asistanı kullanarak bu rozeti kazanabilirsin.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: ROTA SATIŞLARIM */}
            {activeMainTab === "sales" && (
              <div className="stitch-sales-section">
                {/* Sales Overview Cards */}
                <div className="stitch-analytics-cards-grid">
                  <div className="stitch-analytics-metric-card">
                    <div className="stitch-metric-icon-wrap">
                      <span className="material-symbols-outlined">payments</span>
                    </div>
                    <div className="stitch-analytics-metric-info">
                      <span className="stitch-analytics-value">₺0,00</span>
                      <span className="stitch-analytics-label">Toplam Satış Geliri</span>
                    </div>
                  </div>

                  <div className="stitch-analytics-metric-card">
                    <div className="stitch-metric-icon-wrap">
                      <span className="material-symbols-outlined">shopping_cart_checkout</span>
                    </div>
                    <div className="stitch-analytics-metric-info">
                      <span className="stitch-analytics-value">0 Adet</span>
                      <span className="stitch-analytics-label">Başarılı Sipariş</span>
                    </div>
                  </div>

                  <div className="stitch-analytics-metric-card">
                    <div className="stitch-metric-icon-wrap">
                      <span className="material-symbols-outlined">percent</span>
                    </div>
                    <div className="stitch-analytics-metric-info">
                      <span className="stitch-analytics-value">%10</span>
                      <span className="stitch-analytics-label">Platform Komisyonu</span>
                    </div>
                  </div>

                  <div className="stitch-analytics-metric-card">
                    <div className="stitch-metric-icon-wrap">
                      <span className="material-symbols-outlined">account_balance_wallet</span>
                    </div>
                    <div className="stitch-analytics-metric-info">
                      <span className="stitch-analytics-value">₺0,00</span>
                      <span className="stitch-analytics-label">Çekilebilir Bakiye</span>
                    </div>
                  </div>
                </div>

                {/* Creator Marketplace Box */}
                <div className="stitch-empty-state-box" style={{ background: "rgba(30, 77, 62, 0.08)" }}>
                  <span className="material-symbols-outlined stitch-empty-icon" style={{ color: "var(--sb-mint-glow)" }}>
                    storefront
                  </span>
                  <div>
                    <h4 className="stitch-empty-title">Rotanızı Gezgin Pazarında Satışa Çıkarın</h4>
                    <p className="stitch-empty-desc">
                      Kendi keşfettiğiniz gizli durakları, yürüyüş patikalarını ve yerel gastronomi
                      önerilerini içeren rotalarınızı MapsBridge pazarında satışa sunarak ek gelir
                      elde edebilirsiniz.
                    </p>
                  </div>
                  <div className="stitch-empty-actions">
                    <Link href="/desk/" className="stitch-btn-add-quick" style={{ padding: "0.55rem 1.1rem" }}>
                      <span className="material-symbols-outlined text-[16px]">add_business</span>
                      <span>Yeni Rotayı Satışa Ekle</span>
                    </Link>
                    <Link
                      href="/profile/edit/?tab=odeme"
                      className="stitch-btn-add-quick"
                      style={{
                        padding: "0.55rem 1.1rem",
                        background: "transparent",
                        borderColor: "rgba(255, 255, 255, 0.2)",
                        color: "var(--sb-text-main)",
                      }}
                    >
                      <span className="material-symbols-outlined text-[16px]">account_balance</span>
                      <span>Ödeme & Banka Bilgileri</span>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: SON ETKİLEŞİMLER & BİLDİRİMLER */}
            {activeMainTab === "activity" && (
              <div className="stitch-activity-section">
                <div className="stitch-filter-bar">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[20px]">
                      notifications_active
                    </span>
                    <span className="text-sm font-semibold text-main">
                      Bildirim ve Etkileşim Akışı ({notifications.length})
                    </span>
                  </div>

                  {notifications.some((n) => n.unread) && (
                    <button
                      type="button"
                      onClick={handleMarkAllNotifsRead}
                      className="stitch-btn-add-quick"
                    >
                      <span className="material-symbols-outlined text-[16px]">done_all</span>
                      <span>Tümünü Okundu İşaretle</span>
                    </button>
                  )}
                </div>

                <div className="stitch-activity-card">
                  {notifications.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#94a3b8" }}>
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "36px", opacity: 0.4, display: "block", margin: "0 auto 8px" }}
                      >
                        notifications_none
                      </span>
                      Henüz yeni bir etkileşim veya bildiriminiz bulunmuyor.
                    </div>
                  ) : (
                    <div className="stitch-activity-items-list">
                      {notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`stitch-activity-item ${notif.unread ? "unread" : ""}`}
                        >
                          <div className="stitch-activity-left">
                            <div className={`stitch-activity-icon-box ${notif.unread ? "gold" : ""}`}>
                              <span className="material-symbols-outlined text-[18px]">
                                {notif.icon}
                              </span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-main">{notif.title}</span>
                                {notif.unread && <span className="stitch-unread-indicator-dot" />}
                              </div>
                              <p className="stitch-activity-text">{notif.desc}</p>
                            </div>
                          </div>
                          <span className="stitch-activity-time">{notif.time}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Edit Post Modal */}
      {editingPost && (
        <EditPostModalWeb
          post={editingPost}
          isOpen={true}
          onClose={() => setEditingPost(null)}
          onSave={handleEditUserPost}
          onDelete={handleDeleteUserPost}
        />
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="stitch-toast-notification">
          <span className="material-symbols-outlined text-mint-glow text-[20px]">info</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
