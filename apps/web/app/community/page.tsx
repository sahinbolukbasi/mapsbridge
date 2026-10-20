"use client";

import React, { useState, useEffect } from "react";
import { HeaderNav } from "../components/header-nav";
import { AuthActionModal } from "../components/auth-gate";
import { getStoredSession } from "../lib/cognito";
import { getFollowedUsers } from "../lib/follow-system";
import { trackEvent } from "../lib/analytics";
import { webSocialSync } from "../lib/social-sync";
import "./community.css";

import type { CommunityPost } from "../features/community/types";
import { DiscoverTab, NewPostModal, CommunityFooter } from "../features/community";

export type { CommunityPost };

export default function CommunityPage() {
  const [activeUsername, setActiveUsername] = useState("gezgin");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [userSavedRoutes, setUserSavedRoutes] = useState<string[]>([]);
  const [followedTravelerUsernames, setFollowedTravelerUsernames] = useState<string[]>([]);

  // Modals & Panels
  const [showNewPostModal, setShowNewPostModal] = useState(false);

  // Feed tabs
  const [activeTab, setActiveTab] = useState("güncel");

  // Toast & Auth gate
  const [toast, setToast] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authConfig, setAuthConfig] = useState({ title: "", subtitle: "", featureName: "" });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  const toggleFollowUser = (username: string) => {
    setFollowedTravelerUsernames((prev) => {
      const cleanUsername = username.replace("@", "");
      const isFollowing = prev.includes(cleanUsername);
      showToast(isFollowing ? "Takipten çıkarıldı" : "✓ Gezgin takibe alındı");
      return isFollowing ? prev.filter((u) => u !== cleanUsername) : [...prev, cleanUsername];
    });
  };

  const requireAuth = (featureName: string, actionDesc: string, callback?: () => void) => {
    const session = getStoredSession();
    if (!session?.email) {
      setAuthConfig({
        title: `${featureName} İçin Giriş Yapın`,
        subtitle: `${actionDesc} için MapsBridge oturumu açmanız gerekmektedir.`,
        featureName,
      });
      setShowAuthModal(true);
      return false;
    }
    if (callback) callback();
    return true;
  };

  // Load Initial Storage & Subscribe to Changes
  useEffect(() => {
    const session = getStoredSession();
    if (session?.email) {
      const uname = session.email
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "");
      setActiveUsername(uname || "gezgin");
    }

    setPosts(webSocialSync.getPosts());
    const unsubPosts = webSocialSync.subscribePosts((latest) => {
      setPosts(latest);
    });

    try {
      const rawPlanner = localStorage.getItem("mapsbridge.travelPlanner");
      if (rawPlanner) {
        const trips = JSON.parse(rawPlanner);
        if (Array.isArray(trips)) {
          setUserSavedRoutes(trips.map((t: any) => t.title).filter(Boolean));
        }
      }
    } catch {
      // ignore
    }

    setFollowedTravelerUsernames(getFollowedUsers());
    const followHandler = () => setFollowedTravelerUsernames(getFollowedUsers());
    window.addEventListener("mapsbridge:follow-change", followHandler);

    return () => {
      unsubPosts();
      window.removeEventListener("mapsbridge:follow-change", followHandler);
    };
  }, []);

  // ── Central Action: Add to My Trip (Clone Route from Feed) ────
  const handleAddToMyTrip = (route: { title: string; destination?: string; stops?: any[] }) => {
    if (!requireAuth("Seyahate Ekle", "Bu rotayı seyahat planınıza kopyalamak için")) return;

    try {
      const STORAGE_KEY = "mapsbridge.travelPlanner";
      const raw = localStorage.getItem(STORAGE_KEY);
      const trips = raw ? JSON.parse(raw) : [];

      const newTripId = "clone-" + Date.now();
      const stopsData =
        route.stops && route.stops.length > 0
          ? route.stops
          : [
              { label: "1. Durak - Keşif Noktası", lat: 41.8902, lng: 12.4922, category: "tarih" },
              {
                label: "2. Durak - Manzara Seyir",
                lat: 41.8986,
                lng: 12.4769,
                category: "manzara",
              },
            ];

      const clonedPins = stopsData.map((s: any, idx: number) => ({
        id: "pin-" + Date.now() + "-" + idx,
        tripId: newTripId,
        label: s.label || s.name || `Durak ${idx + 1}`,
        address: s.address || s.label || route.destination || "Keşif Noktası",
        lat: s.lat || 41.0,
        lng: s.lng || 29.0,
        category: s.category || "tarih",
        dayIndex: 1,
        order: idx + 1,
        group: route.title,
        visited: false,
        durationMinutes: 60,
      }));

      const newTrip = {
        id: newTripId,
        title: `${route.title} (Klonlandı)`,
        destination: route.destination || "Seyahat Rotası",
        transportMode: "walking",
        isPublic: false,
        days: [
          {
            dayIndex: 1,
            label: "1. Gün",
            color: "#059669",
            subtitle: "Topluluk Rotası",
            pins: clonedPins,
          },
        ],
        groups: [
          {
            id: "genel",
            name: "Genel",
            color: "#059669",
            emoji: "📍",
            pinCount: clonedPins.length,
          },
        ],
        pins: clonedPins,
      };

      trips.unshift(newTrip);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
      trackEvent("route_add_to_trip", { targetTitle: route.title });

      showToast(
        `🗺️ "${route.title}" seyahat planınıza aktarıldı! Harita sekmesinden inceleyebilirsiniz.`,
      );
    } catch {
      showToast("Rota seyahat planına eklenemedi.");
    }
  };

  // ── Post Handlers (Synchronized via webSocialSync) ──────────────
  const handleCreatePost = (data: {
    content: string;
    photo: string | null;
    category: string;
    linkedRoute?: string;
  }) => {
    if (!requireAuth("Paylaşım", "Topluluk akışında seyahat deneyiminizi paylaşmak için")) return;

    let linkedRouteObj = undefined;
    if (data.linkedRoute) {
      linkedRouteObj = {
        title: data.linkedRoute,
        destination: data.linkedRoute,
        stopCount: 4,
        stops: [
          { label: "1. Durak", lat: 41.0082, lng: 28.9784, category: "tarih" },
          { label: "2. Durak", lat: 41.0125, lng: 28.9812, category: "muze" },
        ],
      };
    }

    const newPost = webSocialSync.createPost({
      content: data.content,
      photo: data.photo,
      category: data.category,
      linkedRoute: linkedRouteObj,
    });

    trackEvent("post_view", {
      targetId: newPost.id,
      targetTitle: newPost.content.substring(0, 30),
    });
    setShowNewPostModal(false);
    showToast("✓ Seyahat deneyiminiz topluluk akışında yayınlandı!");
  };

  const handleFastTweet = (data: {
    content: string;
    photo: string | null;
    category: string;
    locationTag?: string;
    hashtags?: string[];
    linkedRoute?: string;
  }) => {
    if (!requireAuth("Paylaşım", "Seyahat deneyiminizi veya rotanızı paylaşmak için")) return;

    let linkedRouteObj = undefined;
    if (data.linkedRoute) {
      linkedRouteObj = {
        title: data.linkedRoute,
        destination: data.linkedRoute,
        stopCount: 4,
        stops: [
          { label: "1. Durak", lat: 41.0082, lng: 28.9784, category: "tarih" },
          { label: "2. Durak", lat: 41.0125, lng: 28.9812, category: "muze" },
        ],
      };
    }

    webSocialSync.createPost({
      content: data.content,
      photo: data.photo,
      category: data.category,
      locationTag: data.locationTag,
      hashtags: data.hashtags,
      linkedRoute: linkedRouteObj,
    });

    showToast("✓ Seyahat paylaşımınız başarıyla yayınlandı!");
  };

  const handleEditPost = (
    postId: string,
    updates: {
      content?: string;
      category?: string;
      locationTag?: string;
      hashtags?: string[];
    },
  ) => {
    if (!requireAuth("Düzenleme", "Paylaşımınızı düzenlemek için")) return;
    const res = webSocialSync.editPost(postId, updates);
    if (res) {
      showToast("✓ Paylaşımınız güncellendi!");
    }
  };

  const handleDeletePost = (postId: string) => {
    if (!requireAuth("Silme", "Paylaşımınızı silmek için")) return;
    webSocialSync.deletePost(postId);
    showToast("✓ Paylaşımınız silindi.");
  };

  const handleAddComment = (postId: string, text: string) => {
    if (!requireAuth("Yorum", "Paylaşıma yanıt vermek için")) return;
    webSocialSync.addComment(postId, text);
    showToast("✓ Yorumunuz paylaşıldı!");
  };

  const handleToggleLike = (postId: string) => {
    if (!requireAuth("Beğeni", "Paylaşımları beğenmek için")) return;
    webSocialSync.toggleLike(postId);
  };

  const handleToggleBookmark = (postId: string) => {
    if (!requireAuth("Kaydet", "Paylaşımları kaydetmek için")) return;
    webSocialSync.toggleBookmark(postId);
  };

  const handleRetweet = (postId: string) => {
    if (!requireAuth("Yeniden Paylaş", "Gönderiyi yeniden paylaşmak için")) return;
    webSocialSync.retweet(postId);
  };

  return (
    <div className="community-page-root">
      <HeaderNav />

      {/* ── HERO BANNER ── */}
      <section className="community-hero">
        <div className="community-hero-inner">
          {/* Top badge row */}
          <div className="hero-top-row">
            <div className="hero-badge">
              <span className="hero-badge-text">MapsBridge Gezginler Topluluğu</span>
              <span className="hero-badge-sep" />
              <span className="hero-badge-live">
                <span className="hero-live-ping" />
                Canlı Seyahat Ağı
              </span>
            </div>
            <span className="hero-active-count">2.400+ Gezgin şu an rotalarda aktif</span>
          </div>

          {/* Headline + CTA */}
          <div className="hero-headline-row">
            <div className="hero-headline-text">
              <h1 className="hero-title">Keşfet, Rota Paylaş &amp; Gezi Arkadaşı Bul</h1>
              <p className="hero-subtitle">
                Gezgin deneyimlerini keşfedin, onaylı seyahat rotalarını paylaşın, grup seyahatleri
                organize edin ve seyahat arkadaşı bulun.
              </p>
            </div>
            <button
              type="button"
              className="hero-share-btn"
              onClick={() => {
                requireAuth("Paylaşım", "Seyahat deneyiminizi paylaşmak için", () => {
                  setShowNewPostModal(true);
                });
              }}
            >
              ✍️ Seyahat Deneyimi Paylaş
            </button>
          </div>

          {/* Filter tabs */}
          <div className="hero-tabs-bar">
            {[
              { key: "güncel", label: "Güncel", badge: "Canlı", live: true },
              { key: "popüler", label: "Popüler", badge: "Trend", live: false },
              { key: "yakınımda", label: "Yakınımda", badge: null, live: false },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`hero-tab${activeTab === tab.key ? " active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {tab.badge && (
                  <span className={`hero-tab-badge${tab.live ? " live" : ""}`}>{tab.badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="community-layout">
        {/* ── MAIN FEED ── */}
        <main className="community-feed-col">
          <DiscoverTab
            posts={posts}
            filter="all"
            activeUsername={activeUsername}
            userSavedRoutes={userSavedRoutes}
            followedUsernames={followedTravelerUsernames}
            onToggleLike={handleToggleLike}
            onToggleBookmark={handleToggleBookmark}
            onRetweet={handleRetweet}
            onAddToMyTrip={handleAddToMyTrip}
            onOpenNewPost={() => {
              requireAuth("Paylaşım", "Seyahat deneyiminizi paylaşmak için", () => {
                setShowNewPostModal(true);
              });
            }}
            onToggleFollow={toggleFollowUser}
            onAddComment={handleAddComment}
            onFastTweet={handleFastTweet}
            onEditPost={handleEditPost}
            onDeletePost={handleDeletePost}
            showToast={showToast}
          />
        </main>

        {/* ── SIDEBAR ── */}
        <aside className="community-sidebar-col">
          <div className="community-sidebar-card">
            <h3 className="community-sidebar-title">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                explore
              </span>
              Kategoriler
            </h3>
            <div className="community-sidebar-cats">
              {[
                { icon: "🏛️", label: "Tarih & Kültür" },
                { icon: "🍽️", label: "Gastronomi" },
                { icon: "🌲", label: "Doğa & Vadi" },
                { icon: "📷", label: "Fotoğrafçılık" },
                { icon: "🎒", label: "Sırt Çantalı" },
                { icon: "🏙️", label: "Şehir Keşfi" },
              ].map((c) => (
                <span key={c.label} className="community-sidebar-cat-pill">
                  {c.icon} {c.label}
                </span>
              ))}
            </div>
          </div>

          <div className="community-sidebar-card">
            <h3 className="community-sidebar-title">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                auto_awesome
              </span>
              Hızlı Bağlantılar
            </h3>
            <nav className="community-sidebar-links">
              <a href="/ai/" className="community-sidebar-link">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  smart_toy
                </span>
                <span>AI Seyahat Asistanı</span>
              </a>
              <a href="/maps/" className="community-sidebar-link">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  map
                </span>
                <span>Seyahat Masası</span>
              </a>
              <a href="/profile/" className="community-sidebar-link">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  person
                </span>
                <span>Profilim</span>
              </a>
            </nav>
          </div>

          <div className="community-sidebar-card community-sidebar-cta">
            <span className="material-symbols-outlined community-sidebar-cta-icon">explore</span>
            <strong>Rotanı Paylaş</strong>
            <p>Kendi gezi rotalarını toplulukla paylaş, diğer gezginlere ilham ver.</p>
            <button
              type="button"
              className="community-share-btn"
              style={{ width: "100%", justifyContent: "center", marginTop: "0.5rem" }}
              onClick={() => {
                requireAuth("Paylaşım", "Seyahat deneyiminizi paylaşmak için", () => {
                  setShowNewPostModal(true);
                });
              }}
            >
              Paylaşım Yap
            </button>
          </div>
        </aside>
      </div>

      <CommunityFooter />

      {/* ── YENİ PAYLAŞIM MODALI ── */}
      <NewPostModal
        isOpen={showNewPostModal}
        onClose={() => setShowNewPostModal(false)}
        activeUsername={activeUsername}
        userSavedRoutes={userSavedRoutes}
        onSubmit={handleCreatePost}
      />

      {/* ── TOAST BİLDİRİMİ ── */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            background: "rgba(15,23,42,0.92)",
            backdropFilter: "blur(8px)",
            color: "#fff",
            padding: "0.6rem 1.25rem",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            fontWeight: 600,
            boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>{toast}</span>
        </div>
      )}

      {/* ── AUTH MODAL ── */}
      {showAuthModal && (
        <AuthActionModal
          isOpen={showAuthModal}
          title={authConfig.title}
          subtitle={authConfig.subtitle}
          featureName={authConfig.featureName}
          nextUrl="/community/"
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}
