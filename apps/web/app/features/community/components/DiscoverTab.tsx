"use client";

import React, { useState, useMemo } from "react";
import type { CommunityPost } from "../types";
import { PRESET_TRAVEL_PHOTOS } from "../initial-data";
import { SoftIcon } from "../../../components/soft-icon";
import { EditPostModalWeb } from "./EditPostModalWeb";

export interface PublicProfileModalUser {
  name: string;
  handle: string;
  avatar: string;
  verified?: boolean;
  coverImage?: string;
  bio?: string;
  location?: string;
  followersCount?: number;
  followingCount?: number;
  routesCount?: number;
}

interface DiscoverTabProps {
  posts: CommunityPost[];
  filter: string;
  activeUsername: string;
  userSavedRoutes: string[];
  followedUsernames: string[];
  onToggleLike: (postId: string) => void;
  onToggleBookmark?: (postId: string) => void;
  onRetweet?: (postId: string) => void;
  onAddToMyTrip: (route: { title: string; destination?: string; stops?: any[] }) => void;
  onOpenNewPost: () => void;
  onToggleFollow: (username: string) => void;
  onAddComment: (postId: string, text: string) => void;
  onEditPost?: (
    postId: string,
    updates: { content?: string; category?: string; locationTag?: string; hashtags?: string[] }
  ) => void;
  onDeletePost?: (postId: string) => void;
  onFastTweet: (data: {
    content: string;
    photo: string | null;
    category: string;
    locationTag?: string;
    hashtags?: string[];
    linkedRoute?: string;
  }) => void;
  showToast?: (msg: string) => void;
}

export function DiscoverTab({
  posts,
  filter,
  activeUsername,
  userSavedRoutes,
  followedUsernames,
  onToggleLike,
  onToggleBookmark,
  onRetweet,
  onAddToMyTrip,
  onOpenNewPost,
  onToggleFollow,
  onAddComment,
  onEditPost,
  onDeletePost,
  onFastTweet,
  showToast,
}: DiscoverTabProps) {
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const [selectedProfileUser, setSelectedProfileUser] = useState<PublicProfileModalUser | null>(null);
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);

  // X Timeline Tabs: "foryou" | "following"
  const [activeTimelineTab, setActiveTimelineTab] = useState<"foryou" | "following">("foryou");
  const [selectedCategory, setSelectedCategory] = useState<string>("Tümü");
  const [sortBy, setSortBy] = useState<"latest" | "likes">("latest");

  // In-line Tweet Composer States
  const [composerText, setComposerText] = useState("");
  const [composerPhoto, setComposerPhoto] = useState<string | null>(null);
  const [composerRoute, setComposerRoute] = useState("");
  const [composerLocation, setComposerLocation] = useState("");
  const [composerCategory, setComposerCategory] = useState("Tarih & Kültür");
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [showRoutePicker, setShowRoutePicker] = useState(false);
  const [showLocationInput, setShowLocationInput] = useState(false);

  // Expanded Comments per post
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Categories list matching mobile
  const CATEGORIES = [
    { id: "Tümü", label: "Tümü", icon: "" },
    { id: "Tarih & Kültür", label: "Tarih & Kültür", icon: "🏛️" },
    { id: "Gastronomi", label: "Gastronomi", icon: "🍽️" },
    { id: "Doğa & Vadi", label: "Doğa & Vadi", icon: "🌲" },
    { id: "Fotoğrafçılık", label: "Fotoğrafçılık", icon: "📷" },
    { id: "Sırt Çantalı", label: "Sırt Çantalı", icon: "🎒" },
  ];

  // Filter & Sort Posts
  const displayedPosts = useMemo(() => {
    let list = [...posts];

    // Timeline tab filter
    if (activeTimelineTab === "following") {
      list = list.filter((p) =>
        followedUsernames.some(
          (u) =>
            u.toLowerCase() === p.authorUsername.toLowerCase() ||
            `@${u.toLowerCase()}` === p.authorUsername.toLowerCase()
        )
      );
    }

    // Category Filter
    const activeCat = selectedCategory !== "Tümü" ? selectedCategory : filter !== "all" ? filter : "Tümü";
    if (activeCat !== "Tümü") {
      list = list.filter(
        (p) =>
          p.category?.toLowerCase() === activeCat.toLowerCase() ||
          p.tags?.some((t) => t.toLowerCase().includes(activeCat.toLowerCase())) ||
          p.hashtags?.some((h) => h.toLowerCase().includes(activeCat.toLowerCase()))
      );
    }

    // Sort
    if (sortBy === "likes") {
      list.sort((a, b) => b.likesCount - a.likesCount);
    } else {
      list.sort((a, b) => b.id.localeCompare(a.id));
    }

    return list;
  }, [posts, activeTimelineTab, selectedCategory, filter, sortBy, followedUsernames]);

  const toggleComments = (postId: string) => {
    setExpandedComments((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handleSendCommentSubmit = (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    onAddComment(postId, text);
    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    if (showToast) showToast("✓ Yorumunuz paylaşıldı!");
  };

  const handleComposerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerText.trim()) return;

    const extractedHashtags = composerText.match(/#[a-zA-Z0-9_ğüşıöçĞÜŞİÖÇ]+/g) || [];

    onFastTweet({
      content: composerText.trim(),
      photo: composerPhoto,
      category: composerCategory,
      locationTag: composerLocation.trim() || undefined,
      hashtags: extractedHashtags.length > 0 ? extractedHashtags : ["#MapsBridge", "#Seyahat"],
      linkedRoute: composerRoute || undefined,
    });

    setComposerText("");
    setComposerPhoto(null);
    setComposerRoute("");
    setComposerLocation("");
    setShowPhotoPicker(false);
    setShowRoutePicker(false);
    setShowLocationInput(false);
  };

  // External Share or Copy Link
  const handleSharePost = async (post: CommunityPost) => {
    const shareUrl = window.location.href;
    const shareData = {
      title: `${post.authorDisplayName} MapsBridge Seyahati`,
      text: `"${post.content.slice(0, 100)}..."`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(`${post.authorDisplayName}: ${post.content}\n${shareUrl}`);
        if (showToast) showToast("🔗 Paylaşım bağlantısı panoya kopyalandı!");
      } catch {
        if (showToast) showToast("Bağlantı kopyalanamadı.");
      }
    }
  };

  const handleOpenUserProfile = (post: CommunityPost) => {
    setSelectedProfileUser({
      name: post.authorDisplayName,
      handle: post.authorUsername.startsWith("@") ? post.authorUsername : `@${post.authorUsername}`,
      avatar:
        post.authorAvatar ||
        "https://lh3.googleusercontent.com/aida-public/AB6AXuCQdOMegHKRlkwubsFEMHDlXU8mVoZKUlXw7A0Quos1oSmZCSZEg30fAB4aMRnCI9q8UEUkdzonH9DUfJ3dTRjIPGpEsvmdB7q2Hrn_b98XcVBeB1CNFBlpaQM33IpQEZ9Bj2TQCR_rWOyCdeIsnX_hZXhb7z1nrWj53EXbHiVov_Hx5WO-_ikQRe6lEE_jnkFjZlEF1WXEue5BMqYbUXVJqoHBc--0mvHvT89fTCsu0mllchVOc6h24A",
      verified: post.verified ?? true,
      bio:
        post.authorBio ||
        (post.authorDisplayName.includes("Canberk")
          ? "Doğa yürüyüşleri, gizli kanyonlar ve vadiler keşfetmeyi seviyorum 🌄 | MapsBridge Onaylı Rota Kaşifi | 📍 Kapadokya & Fethiye yollarında."
          : post.authorDisplayName.includes("Elif")
          ? "Gastronomi ve antik Akdeniz rotaları aşığı 🍝 | Roma, Atina ve İstanbul sokak lezzetleri rehberi."
          : `${post.authorDisplayName} ile dünya rotalarını keşfet. MapsBridge Gezgin Topluluğu üyesi.`),
      location: post.locationTag || "İstanbul, Türkiye",
      followersCount: post.authorFollowersCount || 1420,
      followingCount: 284,
      routesCount: 8,
    });
  };

  return (
    <div className="travel-feed-container" style={{ maxWidth: 680, margin: "0 auto", width: "100%", paddingBottom: "3rem" }}>
      {/* ── SANA ÖZEL / TAKİP EDİLENLER SEKME ÇUBUĞU ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--c-sticky-bg, rgba(255,255,255,0.92))", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--c-border, #e2e8f0)", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flex: 1 }}>
            {(["foryou", "following"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTimelineTab(tab)}
                style={{
                  flex: 1, padding: "0.85rem 0", textAlign: "center", fontSize: "0.875rem", fontWeight: activeTimelineTab === tab ? 800 : 600,
                  color: activeTimelineTab === tab ? "var(--c-text)" : "var(--c-text-muted)",
                  background: "none", border: "none", cursor: "pointer", position: "relative", transition: "color 0.15s",
                  borderBottom: activeTimelineTab === tab ? "2.5px solid #059669" : "2.5px solid transparent",
                }}
              >
                {tab === "foryou" ? "Sana Özel" : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    Takip
                    {followedUsernames.length > 0 && (
                      <span style={{ padding: "1px 6px", background: "rgba(16,185,129,0.15)", color: "#059669", fontSize: 11, fontWeight: 700, borderRadius: 9999 }}>
                        {followedUsernames.length}
                      </span>
                    )}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSortBy(sortBy === "latest" ? "likes" : "latest")}
            style={{ padding: "0.4rem 0.6rem", borderRadius: "0.5rem", background: "none", border: "none", cursor: "pointer", color: "var(--c-text-secondary)", fontSize: "0.75rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}
            title={sortBy === "latest" ? "Popülere geç" : "En yenilere geç"}
          >
            <SoftIcon name={sortBy === "latest" ? "sparkles" : "compass"} size={15} color="#059669" />
            <span>{sortBy === "latest" ? "Yeni" : "Popüler"}</span>
          </button>
        </div>

        {/* ── KATEGORİ FİLTRELERİ ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", overflowX: "auto", padding: "0.5rem 0.25rem", scrollbarWidth: "none" }}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  flexShrink: 0, padding: "0.3rem 0.75rem", borderRadius: 9999, fontSize: "0.75rem", fontWeight: 600,
                  background: isSelected ? "#059669" : "var(--c-input-bg)", color: isSelected ? "#fff" : "var(--c-text-secondary)",
                  border: isSelected ? "none" : "1px solid var(--c-border)", cursor: "pointer", transition: "all 0.15s",
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}
              >
                {cat.icon && <span style={{ fontSize: "0.75rem" }}>{cat.icon}</span>}
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── COMPOSER ── */}
      <div style={{ background: "var(--c-card)", borderRadius: "1rem", border: "1px solid var(--c-border)", padding: "1rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(16,185,129,0.15)", color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.875rem", textTransform: "uppercase" }}>
            {activeUsername.charAt(0)}
          </div>

          <form onSubmit={handleComposerSubmit} style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <textarea
              rows={2}
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              placeholder="Nereyi keşfettiniz? Rotanı paylaş..."
              style={{ width: "100%", fontSize: "0.875rem", color: "var(--c-text)", background: "transparent", border: "none", borderBottom: "1px solid var(--c-border)", paddingBottom: "0.5rem", resize: "none", outline: "none" }}
            />

            {/* Fotoğraf Önizleme */}
            {composerPhoto && (
              <div className="relative rounded-xl overflow-hidden max-h-48 border border-slate-200">
                <img src={composerPhoto} alt="Önizleme" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setComposerPhoto(null)}
                  className="absolute top-2 right-2 bg-slate-900/70 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-slate-900 text-xs"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Seçili Rota Rozeti */}
            {composerRoute && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-200">
                <SoftIcon name="map" size={13} color="#059669" />
                <span>Ekli Rota: {composerRoute}</span>
                <button
                  type="button"
                  onClick={() => setComposerRoute("")}
                  className="ml-1 text-slate-400 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Konum Etiketi Açık İse */}
            {showLocationInput && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                <SoftIcon name="map-pin" size={14} color="#059669" />
                <input
                  type="text"
                  value={composerLocation}
                  onChange={(e) => setComposerLocation(e.target.value)}
                  placeholder="Konum etiketi (örn: Roma, İtalya veya Kapadokya)..."
                  className="w-full bg-transparent text-xs text-slate-800 focus:outline-none"
                />
                {composerLocation && (
                  <button
                    type="button"
                    onClick={() => {
                      setComposerLocation("");
                      setShowLocationInput(false);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-700"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Fotoğraf Seçici Paneli */}
            {showPhotoPicker && (
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                  <span>📸 Hızlı Seyahat Görseli Seç</span>
                  <button
                    type="button"
                    onClick={() => setShowPhotoPicker(false)}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    Kapat
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRESET_TRAVEL_PHOTOS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setComposerPhoto(p.url);
                        setShowPhotoPicker(false);
                      }}
                      className={`group relative rounded-lg overflow-hidden h-16 border text-left transition-all ${
                        composerPhoto === p.url ? "ring-2 ring-emerald-500" : "border-slate-200"
                      }`}
                    >
                      <img src={p.url} alt={p.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <span className="absolute inset-x-0 bottom-0 bg-black/60 text-[10px] text-white px-1.5 py-0.5 truncate font-medium">
                        {p.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Rota Seçici Paneli */}
            {showRoutePicker && (
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                  <span>🗺️ Seyahat Rotası İliştir</span>
                  <button
                    type="button"
                    onClick={() => setShowRoutePicker(false)}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    Kapat
                  </button>
                </div>
                <select
                  value={composerRoute}
                  onChange={(e) => {
                    setComposerRoute(e.target.value);
                    if (e.target.value) setShowRoutePicker(false);
                  }}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                >
                  <option value="">Bir rota seçin...</option>
                  {userSavedRoutes.map((r, i) => (
                    <option key={i} value={r}>
                      {r}
                    </option>
                  ))}
                  <option value="Roma: Antik Miras & Trastevere">Roma: Antik Miras & Trastevere</option>
                  <option value="Kapadokya: Gün Doğumu Vadi Yürüyüşü">Kapadokya: Gün Doğumu Vadi Yürüyüşü</option>
                  <option value="İstanbul: Tarihi Yarımada & Boğaz">İstanbul: Tarihi Yarımada & Boğaz</option>
                </select>
              </div>
            )}

            {/* Alt Butonlar */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1 sm:gap-2 text-slate-500">
                <button
                  type="button"
                  onClick={() => setShowPhotoPicker(!showPhotoPicker)}
                  className={`p-2 rounded-xl hover:bg-slate-100 hover:text-emerald-600 transition-colors inline-flex items-center gap-1 text-xs font-semibold ${
                    composerPhoto ? "text-emerald-600 bg-emerald-50" : ""
                  }`}
                  title="Fotoğraf Ekle"
                >
                  <SoftIcon name="photo" size={17} color={composerPhoto ? "#059669" : "#64748b"} />
                  <span className="hidden sm:inline">Fotoğraf</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowRoutePicker(!showRoutePicker)}
                  className={`p-2 rounded-xl hover:bg-slate-100 hover:text-emerald-600 transition-colors inline-flex items-center gap-1 text-xs font-semibold ${
                    composerRoute ? "text-emerald-600 bg-emerald-50" : ""
                  }`}
                  title="Rota İliştir"
                >
                  <SoftIcon name="map" size={17} color={composerRoute ? "#059669" : "#64748b"} />
                  <span className="hidden sm:inline">Rota</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowLocationInput(!showLocationInput)}
                  className={`p-2 rounded-xl hover:bg-slate-100 hover:text-emerald-600 transition-colors inline-flex items-center gap-1 text-xs font-semibold ${
                    composerLocation ? "text-emerald-600 bg-emerald-50" : ""
                  }`}
                  title="Konum Ekle"
                >
                  <SoftIcon name="map-pin" size={17} color={composerLocation ? "#059669" : "#64748b"} />
                  <span className="hidden sm:inline">Konum</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={!composerText.trim()}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-sm transition-all inline-flex items-center gap-1.5"
              >
                <SoftIcon name="send" size={13} color="#ffffff" />
                <span>Paylaş</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── AKIŞ AKORT LİSTESİ (STREAM FEED) ── */}
      <div className="space-y-4">
        {displayedPosts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3.5rem 1.5rem", background: "var(--c-card)", borderRadius: "1rem", border: "1px solid var(--c-border)" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 0.75rem" }}>
              <SoftIcon name="chat" size={28} color="#059669" />
            </div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--c-text)", margin: "0 0 0.35rem" }}>Henüz paylaşım yok</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--c-text-muted)", maxWidth: 360, margin: "0 auto 1rem" }}>
              {activeTimelineTab === "following"
                ? "Takip ettiğiniz gezginlerin paylaşımları burada görünecek."
                : "İlk seyahat deneyiminizi paylaşarak akışı başlatın!"}
            </p>
            <button
              type="button"
              onClick={onOpenNewPost}
              style={{ padding: "0.45rem 0.85rem", background: "#059669", color: "#fff", borderRadius: "0.65rem", fontSize: "0.8rem", fontWeight: 700, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <SoftIcon name="plus" size={14} color="#ffffff" />
              <span>İlk Paylaşımı Yap</span>
            </button>
          </div>
        ) : (
          displayedPosts.map((post) => {
            const isFollowing = followedUsernames.some(
              (u) =>
                u.toLowerCase() === post.authorUsername.toLowerCase() ||
                `@${u.toLowerCase()}` === post.authorUsername.toLowerCase()
            );
            const isMyPost =
              post.authorUsername.toLowerCase() === activeUsername.toLowerCase() ||
              `@${post.authorUsername.toLowerCase()}` === `@${activeUsername.toLowerCase()}` ||
              post.authorDisplayName.toLowerCase() === activeUsername.toLowerCase();

            const isCommentsOpen = !!expandedComments[post.id];
            const isMenuOpen = activeMenuPostId === post.id;

            return (
              <article
                key={post.id}
                style={{ background: "var(--c-card)", borderRadius: "1rem", border: "1px solid var(--c-border)", overflow: "hidden", transition: "box-shadow 0.2s" }}
              >
                <div style={{ padding: "1rem 1.15rem" }}>
                  {/* Üst Yazar Bilgisi ve 3 Nokta Menüsü */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <button
                        type="button"
                        onClick={() => handleOpenUserProfile(post)}
                        className="relative flex-shrink-0 group"
                        title={`${post.authorDisplayName} profilini incele`}
                      >
                        {post.authorAvatar ? (
                          <img
                            src={post.authorAvatar}
                            alt={post.authorDisplayName}
                            className="w-11 h-11 rounded-full object-cover border border-slate-200 group-hover:ring-2 group-hover:ring-emerald-500 transition-all"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm border border-emerald-200 group-hover:ring-2 group-hover:ring-emerald-500 transition-all">
                            {post.authorDisplayName.charAt(0)}
                          </div>
                        )}
                      </button>

                      {/* İsim / Handle / Rozet / Zaman */}
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleOpenUserProfile(post)}
                            className="text-sm font-bold text-slate-900 hover:text-emerald-700 transition-colors text-left"
                          >
                            {post.authorDisplayName}
                          </button>
                          {(post.verified ?? true) && (
                            <span className="text-emerald-600 text-xs font-bold" title="Onaylı Gezgin">
                              ✓
                            </span>
                          )}
                          <span className="text-xs text-slate-400">
                            {post.authorUsername.startsWith("@") ? post.authorUsername : `@${post.authorUsername}`}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs text-slate-400">{post.createdAt}</span>
                        </div>

                        {/* Konum Etiketi */}
                        {post.locationTag && (
                          <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium mt-0.5">
                            <SoftIcon name="map-pin" size={11} color="#059669" />
                            <span>{post.locationTag}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sağ Taraf: 3 Nokta Seçenekler Menüsü */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuPostId(isMenuOpen ? null : post.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-center"
                        title="Seçenekler"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                          <circle cx="19" cy="12" r="1.5" fill="currentColor" />
                          <circle cx="5" cy="12" r="1.5" fill="currentColor" />
                        </svg>
                      </button>

                      {/* Açılır Dropdown Menü (Mobildeki handlePostOptions gibi) */}
                      {isMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setActiveMenuPostId(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-40 animate-fade-in text-xs font-semibold text-slate-700">
                            {isMyPost ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuPostId(null);
                                    setEditingPost(post);
                                  }}
                                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <SoftIcon name="edit" size={14} color="#475569" />
                                  <span>Gönderiyi Düzenle</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuPostId(null);
                                    if (window.confirm("Bu seyahat paylaşımınızı silmek istediğinize emin misiniz?")) {
                                      if (onDeletePost) onDeletePost(post.id);
                                    }
                                  }}
                                  className="w-full px-3.5 py-2 text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
                                >
                                  <SoftIcon name="trash" size={14} color="#dc2626" />
                                  <span>Paylaşımı Sil</span>
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuPostId(null);
                                    onToggleFollow(post.authorUsername);
                                  }}
                                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <SoftIcon name="user" size={14} color="#059669" />
                                  <span>{isFollowing ? "Takipten Çıkar" : "Gezgini Takip Et"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuPostId(null);
                                    if (showToast) showToast("✓ Paylaşım moderasyon ekibine bildirildi.");
                                  }}
                                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 text-slate-600 flex items-center gap-2"
                                >
                                  <SoftIcon name="shield" size={14} color="#eab308" />
                                  <span>Paylaşımı Bildir</span>
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Paylaşım Metni */}
                  <p className="text-sm text-slate-800 leading-relaxed mb-3 whitespace-pre-line">
                    {post.content}
                  </p>

                  {/* Hashtag Listesi */}
                  {post.hashtags && post.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {post.hashtags.map((h, i) => (
                        <span
                          key={i}
                          onClick={() => {
                            const tagWord = h.replace("#", "");
                            setSelectedCategory(tagWord);
                          }}
                          className="text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 cursor-pointer px-2 py-0.5 rounded-md font-semibold transition-colors"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Medya Görseli */}
                  {post.image && (
                    <div className="rounded-xl overflow-hidden border border-slate-200 mb-3 max-h-96">
                      <img
                        src={post.image}
                        alt="Seyahat Görseli"
                        className="w-full h-full object-cover hover:scale-[1.01] transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* ── İLİŞTİRİLMİŞ ROTA KARTI (MOBİLDEKİ CLONE ROUTE ÖZELLİĞİ) ── */}
                  {post.linkedRoute && (
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 sm:p-4 mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm text-sm">
                          🗺️
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{post.linkedRoute.title}</h4>
                          <p className="text-xs text-emerald-800 font-medium">
                            {post.linkedRoute.destination} • {post.linkedRoute.stopCount} Durak
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onAddToMyTrip({
                              title: post.linkedRoute!.title,
                              destination: post.linkedRoute!.destination,
                              stops: post.linkedRoute!.stops,
                            });
                          }}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all inline-flex items-center gap-1.5 flex-shrink-0"
                        >
                          <SoftIcon name="plus" size={13} color="#ffffff" />
                          <span>Haritama Ekle</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── AKSİYON BUTONLARI (REACTIONS BAR - LIKE, COMMENT, RETWEET, BOOKMARK, SHARE) ── */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-slate-500 text-xs font-semibold">
                    {/* Yorum Yap */}
                    <button
                      type="button"
                      onClick={() => toggleComments(post.id)}
                      className={`flex items-center gap-1.5 p-1.5 sm:px-2.5 rounded-lg hover:bg-slate-100 hover:text-emerald-700 transition-colors ${
                        isCommentsOpen ? "text-emerald-700 bg-emerald-50" : ""
                      }`}
                      title="Yorumlar"
                    >
                      <SoftIcon name="chat" size={16} color={isCommentsOpen ? "#059669" : "#64748b"} />
                      <span>{post.comments?.length || 0}</span>
                    </button>

                    {/* Yeniden Paylaş (Retweet) */}
                    <button
                      type="button"
                      onClick={() => {
                        if (onRetweet) onRetweet(post.id);
                        if (showToast) showToast(`🔁 "${post.authorDisplayName}" paylaşımı yeniden yayınlandı!`);
                      }}
                      className={`flex items-center gap-1.5 p-1.5 sm:px-2.5 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 transition-colors ${
                        post.repostedByMe ? "text-emerald-600 font-bold" : ""
                      }`}
                      title="Yeniden Paylaş"
                    >
                      <SoftIcon name="repeat" size={16} color={post.repostedByMe ? "#059669" : "#64748b"} />
                      <span>{post.repostCount || 0}</span>
                    </button>

                    {/* Beğeni (Heart) */}
                    <button
                      type="button"
                      onClick={() => onToggleLike(post.id)}
                      className={`flex items-center gap-1.5 p-1.5 sm:px-2.5 rounded-lg hover:bg-rose-50 hover:text-rose-600 transition-colors ${
                        post.likedByMe ? "text-rose-600 font-bold" : ""
                      }`}
                      title="Beğen"
                    >
                      <SoftIcon
                        name="heart"
                        size={16}
                        color={post.likedByMe ? "#e11d48" : "#64748b"}
                      />
                      <span>{post.likesCount}</span>
                    </button>

                    {/* Kaydet (Bookmark) */}
                    <button
                      type="button"
                      onClick={() => {
                        if (onToggleBookmark) onToggleBookmark(post.id);
                        if (showToast) {
                          showToast(post.savedByMe ? "Yer imlerinden çıkarıldı" : "🔖 Paylaşım yer imlerine kaydedildi!");
                        }
                      }}
                      className={`flex items-center gap-1.5 p-1.5 sm:px-2.5 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 transition-colors ${
                        post.savedByMe ? "text-emerald-600 font-bold" : ""
                      }`}
                      title="Yer İmlerine Kaydet"
                    >
                      <SoftIcon
                        name="bookmark"
                        size={16}
                        color={post.savedByMe ? "#059669" : "#64748b"}
                      />
                      <span>{post.savesCount || 0}</span>
                    </button>

                    {/* Dışa Paylaş (Share) */}
                    <button
                      type="button"
                      onClick={() => handleSharePost(post)}
                      className="flex items-center gap-1.5 p-1.5 sm:px-2.5 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition-colors"
                      title="Paylaş"
                    >
                      <SoftIcon name="send" size={15} color="#64748b" />
                    </button>
                  </div>

                  {/* ── YORUMLAR PANELİ (AÇILIP KAPANAN) ── */}
                  {isCommentsOpen && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                      {/* Yorum Ekleme Formu */}
                      <form
                        onSubmit={(e) => handleSendCommentSubmit(post.id, e)}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="text"
                          value={commentInputs[post.id] || ""}
                          onChange={(e) =>
                            setCommentInputs({ ...commentInputs, [post.id]: e.target.value })
                          }
                          placeholder={`@${post.authorUsername} kullanıcısına yanıt ver...`}
                          className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 bg-slate-50"
                        />
                        <button
                          type="submit"
                          disabled={!commentInputs[post.id]?.trim()}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all"
                        >
                          Yanıtla
                        </button>
                      </form>

                      {/* Yorumlar Listesi */}
                      <div className="space-y-2 pt-1">
                        {!post.comments || post.comments.length === 0 ? (
                          <p className="text-xs text-slate-400 py-1">Henüz yorum yok. İlk yorumu siz yapın!</p>
                        ) : (
                          post.comments.map((c) => (
                            <div key={c.id} className="flex items-start gap-2.5 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                {c.displayName ? c.displayName.charAt(0) : c.username.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-800">
                                    {c.displayName || c.username}
                                  </span>
                                  <span className="text-[11px] text-slate-400">@{c.username}</span>
                                  <span className="text-slate-300">·</span>
                                  <span className="text-[11px] text-slate-400">{c.createdAt}</span>
                                </div>
                                <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{c.text}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* ── GÖNDERİ DÜZENLEME MODALI ── */}
      {editingPost && (
        <EditPostModalWeb
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSave={(id, updates) => {
            if (onEditPost) onEditPost(id, updates);
            setEditingPost(null);
          }}
          onDelete={(id) => {
            if (onDeletePost) onDeletePost(id);
            setEditingPost(null);
          }}
        />
      )}

      {/* ── GEZGİN GENEL PROFİL MODALI (MOBİLDEKİ PUBLIC PROFILE VIEW GİBİ) ── */}
      {selectedProfileUser && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "var(--c-card)", borderRadius: "1.25rem", boxShadow: "0 25px 50px rgba(0,0,0,0.25)", border: "1px solid var(--c-border)", width: "100%", maxWidth: 400, overflow: "hidden", position: "relative" }}>
            <div style={{ height: 100, background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)", position: "relative" }}>
              <button
                type="button"
                onClick={() => setSelectedProfileUser(null)}
                style={{ position: "absolute", top: 10, right: 10, width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.4)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "0 1.25rem 1.25rem", position: "relative" }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: -40, marginBottom: 12 }}>
                <img
                  src={selectedProfileUser.avatar}
                  alt={selectedProfileUser.name}
                  style={{ width: 80, height: 80, borderRadius: "50%", border: "3px solid var(--c-card)", objectFit: "cover", background: "var(--c-card)" }}
                />
                <button
                  type="button"
                  onClick={() => onToggleFollow(selectedProfileUser.handle.replace("@", ""))}
                  style={{
                    padding: "0.4rem 1rem", borderRadius: 9999, fontSize: "0.75rem", fontWeight: 700, border: "none", cursor: "pointer",
                    background: followedUsernames.includes(selectedProfileUser.handle.replace("@", "")) ? "var(--c-input-bg)" : "#059669",
                    color: followedUsernames.includes(selectedProfileUser.handle.replace("@", "")) ? "var(--c-text)" : "#fff",
                  }}
                >
                  {followedUsernames.includes(selectedProfileUser.handle.replace("@", "")) ? "Takipte" : "Takip Et"}
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, color: "var(--c-text)" }}>{selectedProfileUser.name}</h3>
                {selectedProfileUser.verified && <span style={{ color: "#059669", fontWeight: 700 }}>✓</span>}
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--c-text-muted)", margin: "2px 0 0" }}>{selectedProfileUser.handle}</p>

              {selectedProfileUser.location && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: "var(--c-text-secondary)", marginTop: 8 }}>
                  <SoftIcon name="map-pin" size={12} color="#059669" />
                  <span>{selectedProfileUser.location}</span>
                </div>
              )}

              <p style={{ fontSize: "0.8rem", color: "var(--c-text-secondary)", marginTop: 10, lineHeight: 1.5 }}>
                {selectedProfileUser.bio}
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--c-border)", fontSize: "0.75rem" }}>
                <div><span style={{ fontWeight: 800, color: "var(--c-text)" }}>{selectedProfileUser.followingCount}</span> <span style={{ color: "var(--c-text-muted)" }}>Takip</span></div>
                <div><span style={{ fontWeight: 800, color: "var(--c-text)" }}>{selectedProfileUser.followersCount}</span> <span style={{ color: "var(--c-text-muted)" }}>Takipçi</span></div>
                <div><span style={{ fontWeight: 800, color: "var(--c-text)" }}>{selectedProfileUser.routesCount}</span> <span style={{ color: "var(--c-text-muted)" }}>Rota</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
