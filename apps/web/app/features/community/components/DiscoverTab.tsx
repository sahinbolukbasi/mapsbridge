"use client";

import React, { useState, useMemo } from "react";
import type { CommunityPost } from "../types";
import { PRESET_TRAVEL_PHOTOS } from "../initial-data";
import { SoftIcon } from "../../../components/soft-icon";
import { EditPostModalWeb } from "./EditPostModalWeb";
import "../community-layout.css";

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
  onAddToMyTrip: (route: { title: string; destination?: string; stops?: unknown[] }) => void;
  onOpenNewPost: () => void;
  onToggleFollow: (username: string) => void;
  onAddComment: (postId: string, text: string) => void;
  onEditPost?: (
    postId: string,
    updates: { content?: string; category?: string; locationTag?: string; hashtags?: string[] },
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
  const [selectedProfileUser, setSelectedProfileUser] = useState<PublicProfileModalUser | null>(
    null,
  );
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
  const [composerCategory, _setComposerCategory] = useState("Tarih & Kültür");
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
            `@${u.toLowerCase()}` === p.authorUsername.toLowerCase(),
        ),
      );
    }

    // Category Filter
    const activeCat =
      selectedCategory !== "Tümü" ? selectedCategory : filter !== "all" ? filter : "Tümü";
    if (activeCat !== "Tümü") {
      list = list.filter(
        (p) =>
          p.category?.toLowerCase() === activeCat.toLowerCase() ||
          p.tags?.some((t) => t.toLowerCase().includes(activeCat.toLowerCase())) ||
          p.hashtags?.some((h) => h.toLowerCase().includes(activeCat.toLowerCase())),
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
        await navigator.clipboard.writeText(
          `${post.authorDisplayName}: ${post.content}\n${shareUrl}`,
        );
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
    <div
      className="travel-feed-container"
      style={{ maxWidth: 680, margin: "0 auto", width: "100%", paddingBottom: "3rem" }}
    >
      {/* ── SANA ÖZEL / TAKİP EDİLENLER SEKME ÇUBUĞU ── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background:
            "var(--c-sticky-bg, color-mix(in srgb, var(--color-surface) 92%, transparent))",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--c-border, var(--color-border))",
          marginBottom: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flex: 1 }}>
            {(["foryou", "following"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTimelineTab(tab)}
                style={{
                  flex: 1,
                  padding: "0.85rem 0",
                  textAlign: "center",
                  fontSize: "0.875rem",
                  fontWeight: activeTimelineTab === tab ? 800 : 600,
                  color: activeTimelineTab === tab ? "var(--c-text)" : "var(--c-text-muted)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  transition: "color 0.15s",
                  borderBottom:
                    activeTimelineTab === tab ? "2.5px solid #059669" : "2.5px solid transparent",
                }}
              >
                {tab === "foryou" ? (
                  "Sana Özel"
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    Takip
                    {followedUsernames.length > 0 && (
                      <span
                        style={{
                          padding: "1px 6px",
                          background: "color-mix(in srgb, var(--color-accent) 15%, transparent)",
                          color: "var(--color-success-strong)",
                          fontSize: 11,
                          fontWeight: 700,
                          borderRadius: 9999,
                        }}
                      >
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
            style={{
              padding: "0.4rem 0.6rem",
              borderRadius: "0.5rem",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--c-text-secondary)",
              fontSize: "0.75rem",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
            title={sortBy === "latest" ? "Popülere geç" : "En yenilere geç"}
          >
            <SoftIcon
              name={sortBy === "latest" ? "sparkles" : "compass"}
              size={15}
              color="#059669"
            />
            <span>{sortBy === "latest" ? "Yeni" : "Popüler"}</span>
          </button>
        </div>

        {/* ── KATEGORİ FİLTRELERİ ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.45rem",
            overflowX: "auto",
            padding: "0.5rem 0.25rem",
            scrollbarWidth: "none",
          }}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  flexShrink: 0,
                  padding: "0.3rem 0.75rem",
                  borderRadius: 9999,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  background: isSelected ? "var(--color-success)" : "var(--c-input-bg)",
                  color: isSelected ? "#fff" : "var(--c-text-secondary)",
                  border: isSelected ? "none" : "1px solid var(--c-border)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
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
      <div
        style={{
          background: "var(--c-card)",
          borderRadius: "1rem",
          border: "1px solid var(--c-border)",
          padding: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "color-mix(in srgb, var(--color-accent) 15%, transparent)",
              color: "var(--color-success-strong)",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: "0.875rem",
              textTransform: "uppercase",
            }}
          >
            {activeUsername.charAt(0)}
          </div>

          <form
            onSubmit={handleComposerSubmit}
            style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            <textarea
              rows={2}
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              placeholder="Nereyi keşfettiniz? Rotanı paylaş..."
              style={{
                width: "100%",
                fontSize: "0.875rem",
                color: "var(--c-text)",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--c-border)",
                paddingBottom: "0.5rem",
                resize: "none",
                outline: "none",
              }}
            />

            {/* Fotoğraf Önizleme */}
            {composerPhoto && (
              <div className="cm-1">
                <img src={composerPhoto} alt="Önizleme" className="cm-2" />
                <button type="button" onClick={() => setComposerPhoto(null)} className="cm-3">
                  ✕
                </button>
              </div>
            )}

            {/* Seçili Rota Rozeti */}
            {composerRoute && (
              <div className="cm-4">
                <SoftIcon name="map" size={13} color="#059669" />
                <span>Ekli Rota: {composerRoute}</span>
                <button
                  type="button"
                  onClick={() => setComposerRoute("")}
                  className="cm-5 cm-u-text-400"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Konum Etiketi Açık İse */}
            {showLocationInput && (
              <div className="cm-6">
                <SoftIcon name="map-pin" size={14} color="#059669" />
                <input
                  type="text"
                  value={composerLocation}
                  onChange={(e) => setComposerLocation(e.target.value)}
                  placeholder="Konum etiketi (örn: Roma, İtalya veya Kapadokya)..."
                  className="cm-7"
                />
                {composerLocation && (
                  <button
                    type="button"
                    onClick={() => {
                      setComposerLocation("");
                      setShowLocationInput(false);
                    }}
                    className="cm-8 cm-u-text-400"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Fotoğraf Seçici Paneli */}
            {showPhotoPicker && (
              <div className="cm-9">
                <div className="cm-10 cm-u-text-600">
                  <span>📸 Hızlı Seyahat Görseli Seç</span>
                  <button
                    type="button"
                    onClick={() => setShowPhotoPicker(false)}
                    className="cm-11 cm-u-text-400"
                  >
                    Kapat
                  </button>
                </div>
                <div className="cm-12">
                  {PRESET_TRAVEL_PHOTOS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setComposerPhoto(p.url);
                        setShowPhotoPicker(false);
                      }}
                      className={`cm-group cm-13 h-16 ${
                        composerPhoto === p.url ? "ring-2 ring-emerald-500" : "cm-u-border-200"
                      }`}
                    >
                      <img src={p.url} alt={p.label} className="cm-14" />
                      <span className="cm-15 cm-u-scrim-60">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Rota Seçici Paneli */}
            {showRoutePicker && (
              <div className="cm-9">
                <div className="cm-10 cm-u-text-600">
                  <span>🗺️ Seyahat Rotası İliştir</span>
                  <button
                    type="button"
                    onClick={() => setShowRoutePicker(false)}
                    className="cm-11 cm-u-text-400"
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
                  className="cm-16"
                >
                  <option value="">Bir rota seçin...</option>
                  {userSavedRoutes.map((r, i) => (
                    <option key={i} value={r}>
                      {r}
                    </option>
                  ))}
                  <option value="Roma: Antik Miras & Trastevere">
                    Roma: Antik Miras & Trastevere
                  </option>
                  <option value="Kapadokya: Gün Doğumu Vadi Yürüyüşü">
                    Kapadokya: Gün Doğumu Vadi Yürüyüşü
                  </option>
                  <option value="İstanbul: Tarihi Yarımada & Boğaz">
                    İstanbul: Tarihi Yarımada & Boğaz
                  </option>
                </select>
              </div>
            )}

            {/* Alt Butonlar */}
            <div className="cm-17">
              <div className="cm-18">
                <button
                  type="button"
                  onClick={() => setShowPhotoPicker(!showPhotoPicker)}
                  className={`cm-19 hover:text-emerald-600 ${
                    composerPhoto ? "cm-u-text-success-strong cm-u-bg-brand" : ""
                  }`}
                  title="Fotoğraf Ekle"
                >
                  <SoftIcon name="photo" size={17} color={composerPhoto ? "#059669" : "#64748b"} />
                  <span className="cm-20">Fotoğraf</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowRoutePicker(!showRoutePicker)}
                  className={`cm-19 hover:text-emerald-600 ${
                    composerRoute ? "cm-u-text-success-strong cm-u-bg-brand" : ""
                  }`}
                  title="Rota İliştir"
                >
                  <SoftIcon name="map" size={17} color={composerRoute ? "#059669" : "#64748b"} />
                  <span className="cm-20">Rota</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowLocationInput(!showLocationInput)}
                  className={`cm-19 hover:text-emerald-600 ${
                    composerLocation ? "cm-u-text-success-strong cm-u-bg-brand" : ""
                  }`}
                  title="Konum Ekle"
                >
                  <SoftIcon
                    name="map-pin"
                    size={17}
                    color={composerLocation ? "#059669" : "#64748b"}
                  />
                  <span className="cm-20">Konum</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={!composerText.trim()}
                className="cm-21 cm-u-shadow-sm"
              >
                <SoftIcon name="send" size={13} color="#ffffff" />
                <span>Paylaş</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── AKIŞ AKORT LİSTESİ (STREAM FEED) ── */}
      <div className="cm-22">
        {displayedPosts.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "3.5rem 1.5rem",
              background: "var(--c-card)",
              borderRadius: "1rem",
              border: "1px solid var(--c-border)",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--color-accent-a10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 0.75rem",
              }}
            >
              <SoftIcon name="chat" size={28} color="#059669" />
            </div>
            <h3
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: "var(--c-text)",
                margin: "0 0 0.35rem",
              }}
            >
              Henüz paylaşım yok
            </h3>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--c-text-muted)",
                maxWidth: 360,
                margin: "0 auto 1rem",
              }}
            >
              {activeTimelineTab === "following"
                ? "Takip ettiğiniz gezginlerin paylaşımları burada görünecek."
                : "İlk seyahat deneyiminizi paylaşarak akışı başlatın!"}
            </p>
            <button
              type="button"
              onClick={onOpenNewPost}
              style={{
                padding: "0.45rem 0.85rem",
                background: "var(--color-success)",
                color: "var(--color-on-primary)",
                borderRadius: "0.65rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
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
                `@${u.toLowerCase()}` === post.authorUsername.toLowerCase(),
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
                style={{
                  background: "var(--c-card)",
                  borderRadius: "1rem",
                  border: "1px solid var(--c-border)",
                  overflow: "hidden",
                  transition: "box-shadow 0.2s",
                }}
              >
                <div style={{ padding: "1rem 1.15rem" }}>
                  {/* Üst Yazar Bilgisi ve 3 Nokta Menüsü */}
                  <div className="cm-23">
                    <div className="cm-24">
                      {/* Avatar */}
                      <button
                        type="button"
                        onClick={() => handleOpenUserProfile(post)}
                        className="cm-25 cm-group"
                        title={`${post.authorDisplayName} profilini incele`}
                      >
                        {post.authorAvatar ? (
                          <img
                            src={post.authorAvatar}
                            alt={post.authorDisplayName}
                            className="cm-26"
                          />
                        ) : (
                          <div className="cm-27">{post.authorDisplayName.charAt(0)}</div>
                        )}
                      </button>

                      {/* İsim / Handle / Rozet / Zaman */}
                      <div>
                        <div className="cm-28">
                          <button
                            type="button"
                            onClick={() => handleOpenUserProfile(post)}
                            className="cm-29"
                          >
                            {post.authorDisplayName}
                          </button>
                          {(post.verified ?? true) && (
                            <span className="cm-30" title="Onaylı Gezgin">
                              ✓
                            </span>
                          )}
                          <span className="cm-31 cm-u-text-400">
                            {post.authorUsername.startsWith("@")
                              ? post.authorUsername
                              : `@${post.authorUsername}`}
                          </span>
                          <span className="cm-u-text-300">·</span>
                          <span className="cm-31 cm-u-text-400">{post.createdAt}</span>
                        </div>

                        {/* Konum Etiketi */}
                        {post.locationTag && (
                          <div className="cm-33">
                            <SoftIcon name="map-pin" size={11} color="#059669" />
                            <span>{post.locationTag}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sağ Taraf: 3 Nokta Seçenekler Menüsü */}
                    <div className="cm-34">
                      <button
                        type="button"
                        onClick={() => setActiveMenuPostId(isMenuOpen ? null : post.id)}
                        className="cm-35 cm-u-text-400"
                        title="Seçenekler"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                          <circle cx="19" cy="12" r="1.5" fill="currentColor" />
                          <circle cx="5" cy="12" r="1.5" fill="currentColor" />
                        </svg>
                      </button>

                      {/* Açılır Dropdown Menü (Mobildeki handlePostOptions gibi) */}
                      {isMenuOpen && (
                        <>
                          <div className="cm-36" onClick={() => setActiveMenuPostId(null)} />
                          <div className="cm-37 cm-u-shadow-xl">
                            {isMyPost ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuPostId(null);
                                    setEditingPost(post);
                                  }}
                                  className="cm-38"
                                >
                                  <SoftIcon name="edit" size={14} color="#475569" />
                                  <span>Gönderiyi Düzenle</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuPostId(null);
                                    if (
                                      window.confirm(
                                        "Bu seyahat paylaşımınızı silmek istediğinize emin misiniz?",
                                      )
                                    ) {
                                      if (onDeletePost) onDeletePost(post.id);
                                    }
                                  }}
                                  className="cm-39 cm-u-text-danger"
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
                                  className="cm-38"
                                >
                                  <SoftIcon name="user" size={14} color="#059669" />
                                  <span>{isFollowing ? "Takipten Çıkar" : "Gezgini Takip Et"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuPostId(null);
                                    if (showToast)
                                      showToast("✓ Paylaşım moderasyon ekibine bildirildi.");
                                  }}
                                  className="cm-40 cm-u-text-600"
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
                  <p className="cm-41">{post.content}</p>

                  {/* Hashtag Listesi */}
                  {post.hashtags && post.hashtags.length > 0 && (
                    <div className="cm-42">
                      {post.hashtags.map((h, i) => (
                        <span
                          key={i}
                          onClick={() => {
                            const tagWord = h.replace("#", "");
                            setSelectedCategory(tagWord);
                          }}
                          className="cm-43"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Medya Görseli */}
                  {post.image && (
                    <div className="cm-44">
                      <img
                        src={post.image}
                        alt="Seyahat Görseli"
                        className="cm-45"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* ── İLİŞTİRİLMİŞ ROTA KARTI (MOBİLDEKİ CLONE ROUTE ÖZELLİĞİ) ── */}
                  {post.linkedRoute && (
                    <div className="cm-46">
                      <div className="cm-47">
                        <div className="cm-48 cm-u-shadow-sm">🗺️</div>
                        <div>
                          <h4 className="cm-49">{post.linkedRoute.title}</h4>
                          <p className="cm-50">
                            {post.linkedRoute.destination} • {post.linkedRoute.stopCount} Durak
                          </p>
                        </div>
                      </div>

                      <div className="cm-51">
                        <button
                          type="button"
                          onClick={() => {
                            onAddToMyTrip({
                              title: post.linkedRoute!.title,
                              destination: post.linkedRoute!.destination,
                              stops: post.linkedRoute!.stops,
                            });
                          }}
                          className="cm-52 cm-u-shadow-sm"
                        >
                          <SoftIcon name="plus" size={13} color="#ffffff" />
                          <span>Haritama Ekle</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── AKSİYON BUTONLARI (REACTIONS BAR - LIKE, COMMENT, RETWEET, BOOKMARK, SHARE) ── */}
                  <div className="cm-53">
                    {/* Yorum Yap */}
                    <button
                      type="button"
                      onClick={() => toggleComments(post.id)}
                      className={`cm-54 ${isCommentsOpen ? "cm-u-text-success cm-u-bg-brand" : ""}`}
                      title="Yorumlar"
                    >
                      <SoftIcon
                        name="chat"
                        size={16}
                        color={isCommentsOpen ? "#059669" : "#64748b"}
                      />
                      <span>{post.comments?.length || 0}</span>
                    </button>

                    {/* Yeniden Paylaş (Retweet) */}
                    <button
                      type="button"
                      onClick={() => {
                        if (onRetweet) onRetweet(post.id);
                        if (showToast)
                          showToast(`🔁 "${post.authorDisplayName}" paylaşımı yeniden yayınlandı!`);
                      }}
                      className={`cm-55 hover:bg-emerald-50 ${
                        post.repostedByMe ? "cm-u-text-success-strong cm-u-bold" : ""
                      }`}
                      title="Yeniden Paylaş"
                    >
                      <SoftIcon
                        name="repeat"
                        size={16}
                        color={post.repostedByMe ? "#059669" : "#64748b"}
                      />
                      <span>{post.repostCount || 0}</span>
                    </button>

                    {/* Beğeni (Heart) */}
                    <button
                      type="button"
                      onClick={() => onToggleLike(post.id)}
                      className={`cm-56 hover:bg-rose-50 hover:text-rose-600 ${
                        post.likedByMe ? "text-rose-600 cm-u-bold" : ""
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
                          showToast(
                            post.savedByMe
                              ? "Yer imlerinden çıkarıldı"
                              : "🔖 Paylaşım yer imlerine kaydedildi!",
                          );
                        }
                      }}
                      className={`cm-55 hover:bg-emerald-50 ${
                        post.savedByMe ? "cm-u-text-success-strong cm-u-bold" : ""
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
                      className="cm-57"
                      title="Paylaş"
                    >
                      <SoftIcon name="send" size={15} color="#64748b" />
                    </button>
                  </div>

                  {/* ── YORUMLAR PANELİ (AÇILIP KAPANAN) ── */}
                  {isCommentsOpen && (
                    <div className="cm-58">
                      {/* Yorum Ekleme Formu */}
                      <form onSubmit={(e) => handleSendCommentSubmit(post.id, e)} className="cm-51">
                        <input
                          type="text"
                          value={commentInputs[post.id] || ""}
                          onChange={(e) =>
                            setCommentInputs({ ...commentInputs, [post.id]: e.target.value })
                          }
                          placeholder={`@${post.authorUsername} kullanıcısına yanıt ver...`}
                          className="cm-59"
                        />
                        <button
                          type="submit"
                          disabled={!commentInputs[post.id]?.trim()}
                          className="cm-60"
                        >
                          Yanıtla
                        </button>
                      </form>

                      {/* Yorumlar Listesi */}
                      <div className="cm-61">
                        {!post.comments || post.comments.length === 0 ? (
                          <p className="cm-62 cm-u-text-400">
                            Henüz yorum yok. İlk yorumu siz yapın!
                          </p>
                        ) : (
                          post.comments.map((c) => (
                            <div key={c.id} className="cm-63">
                              <div className="cm-64">
                                {c.displayName ? c.displayName.charAt(0) : c.username.charAt(0)}
                              </div>
                              <div className="cm-65">
                                <div className="cm-66">
                                  <span className="cm-67">{c.displayName || c.username}</span>
                                  <span className="cm-68 cm-u-text-400">@{c.username}</span>
                                  <span className="cm-u-text-300">·</span>
                                  <span className="cm-68 cm-u-text-400">{c.createdAt}</span>
                                </div>
                                <p className="cm-69">{c.text}</p>
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
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              background: "var(--c-card)",
              borderRadius: "1.25rem",
              boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
              border: "1px solid var(--c-border)",
              width: "100%",
              maxWidth: 400,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                height: 100,
                background: "linear-gradient(135deg, var(--color-success-strong) 0%, #0d9488 100%)",
                position: "relative",
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedProfileUser(null)}
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.4)",
                  color: "var(--color-on-primary)",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "0 1.25rem 1.25rem", position: "relative" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  marginTop: -40,
                  marginBottom: 12,
                }}
              >
                <img
                  src={selectedProfileUser.avatar}
                  alt={selectedProfileUser.name}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    border: "3px solid var(--c-card)",
                    objectFit: "cover",
                    background: "var(--c-card)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => onToggleFollow(selectedProfileUser.handle.replace("@", ""))}
                  style={{
                    padding: "0.4rem 1rem",
                    borderRadius: 9999,
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    background: followedUsernames.includes(
                      selectedProfileUser.handle.replace("@", ""),
                    )
                      ? "var(--c-input-bg)"
                      : "#059669",
                    color: followedUsernames.includes(selectedProfileUser.handle.replace("@", ""))
                      ? "var(--c-text)"
                      : "#fff",
                  }}
                >
                  {followedUsernames.includes(selectedProfileUser.handle.replace("@", ""))
                    ? "Takipte"
                    : "Takip Et"}
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <h3
                  style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, color: "var(--c-text)" }}
                >
                  {selectedProfileUser.name}
                </h3>
                {selectedProfileUser.verified && (
                  <span style={{ color: "var(--color-success-strong)", fontWeight: 700 }}>✓</span>
                )}
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--c-text-muted)", margin: "2px 0 0" }}>
                {selectedProfileUser.handle}
              </p>

              {selectedProfileUser.location && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "0.75rem",
                    color: "var(--c-text-secondary)",
                    marginTop: 8,
                  }}
                >
                  <SoftIcon name="map-pin" size={12} color="#059669" />
                  <span>{selectedProfileUser.location}</span>
                </div>
              )}

              <p
                style={{
                  fontSize: "0.8rem",
                  color: "var(--c-text-secondary)",
                  marginTop: 10,
                  lineHeight: 1.5,
                }}
              >
                {selectedProfileUser.bio}
              </p>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1.25rem",
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: "1px solid var(--c-border)",
                  fontSize: "0.75rem",
                }}
              >
                <div>
                  <span style={{ fontWeight: 800, color: "var(--c-text)" }}>
                    {selectedProfileUser.followingCount}
                  </span>{" "}
                  <span style={{ color: "var(--c-text-muted)" }}>Takip</span>
                </div>
                <div>
                  <span style={{ fontWeight: 800, color: "var(--c-text)" }}>
                    {selectedProfileUser.followersCount}
                  </span>{" "}
                  <span style={{ color: "var(--c-text-muted)" }}>Takipçi</span>
                </div>
                <div>
                  <span style={{ fontWeight: 800, color: "var(--c-text)" }}>
                    {selectedProfileUser.routesCount}
                  </span>{" "}
                  <span style={{ color: "var(--c-text-muted)" }}>Rota</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
