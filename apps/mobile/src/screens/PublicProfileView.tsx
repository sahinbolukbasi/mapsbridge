import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Share,
  Dimensions,
  Platform,
} from "react-native";
import { tripStore, TripStop } from "../services/tripStore";

const { width: SCREEN_W } = Dimensions.get("window");

export interface PublicProfileUser {
  name: string;
  handle: string;
  avatar: string;
  verified?: boolean;
  coverImage?: string;
  badge?: string;
  bio?: string;
  location?: string;
  joinDate?: string;
  website?: string;
  postsCount?: number;
  routesCount?: number;
  followersCount?: string;
  followingCount?: string;
}

import { ChatScreen } from "./ChatScreen";
import { chatStore, ChatContact } from "../services/chatStore";

import { SafeArea } from "../ui";
import { tokens, withAlpha } from "../theme";
interface PublicProfileViewProps {
  user: PublicProfileUser;
  onBack: () => void;
  onOpenMap: () => void;
  onOpenChat?: (targetUser: PublicProfileUser) => void;
}

export function PublicProfileView({ user, onBack, onOpenMap, onOpenChat }: PublicProfileViewProps) {
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"feed" | "routes" | "media" | "likes">("feed");
  const [isPost1Liked, setIsPost1Liked] = useState<boolean>(false);
  const [post1Likes, setPost1Likes] = useState<number>(512);
  const [isPost2Liked, setIsPost2Liked] = useState<boolean>(false);
  const [post2Likes, setPost2Likes] = useState<number>(289);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [activeChatContact, setActiveChatContact] = useState<ChatContact | null>(null);

  const coverUrl =
    user.coverImage ||
    "https://lh3.googleusercontent.com/aida-public/AB6AXuA2fXydtJ5nwaw-B2ZJHS8YZRAIFRNyn8vyMhSM_93HwrBfPoVUPs3qi-fSZLZAwlLZ5CVFdhTYLx9NuEr3FVYHUOiGoT48bpTPKBSDlJy77amNGViqT-dOd84Wj-I9WDTFEVL-63HrUgHbfpSlZeC9FS_FqLbBJjHNKYpfZOrt_5TolBe2niEgCt8OrmzjHI7xba8AdhXnEnLDI88TKTNgjxnPeVibA4wDqMWk5e_L9bkknzbi9y-jlQ";

  const bioText =
    user.bio ||
    "Doğa yürüyüşleri, gizli kanyonlar ve vadiler keşfetmeyi seviyorum 🌄 | MapsBridge Onaylı Rota Kaşifi | 📍 Kapadokya & Fethiye yollarında.";

  const handleToggleFollow = () => {
    setIsFollowing(!isFollowing);
  };

  const handleLikePost1 = () => {
    if (isPost1Liked) {
      setPost1Likes((c) => c - 1);
      setIsPost1Liked(false);
    } else {
      setPost1Likes((c) => c + 1);
      setIsPost1Liked(true);
    }
  };

  const handleLikePost2 = () => {
    if (isPost2Liked) {
      setPost2Likes((c) => c - 1);
      setIsPost2Liked(false);
    } else {
      setPost2Likes((c) => c + 1);
      setIsPost2Liked(true);
    }
  };

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `${user.name} (${user.handle}) MapsBridge seyahat profilini incele: https://mapsbridge.com${user.handle}`,
        title: user.name,
      });
    } catch {}
  };

  const handleImportRoute = (routeTitle: string) => {
    const importedStops: TripStop[] = [
      {
        id: `capp-1`,
        name: "Aşk Vadisi Seyir Noktası",
        category: "TARİHİ YER",
        time: "05:45",
        duration: "60 dk",
        address: "Çavuşin Köyü, Göreme",
        lat: 38.6625,
        lng: 34.8322,
        rating: 4.9,
        budget: "Ücretsiz",
        notes: "Gündoğumu balon kalkışları için mükemmel vadi.",
      },
      {
        id: `capp-2`,
        name: "Göreme Açık Hava Müzesi",
        category: "MÜZE",
        time: "07:30",
        duration: "90 dk",
        address: "Müze Cd., Göreme",
        lat: 38.6402,
        lng: 34.8291,
        rating: 4.8,
        budget: "480 ₺",
        notes: "Karanlık Kilise freskleri mutlaka görülmeli.",
      },
      {
        id: `capp-3`,
        name: "Uçhisar Kalesi Zirvesi",
        category: "TARİHİ YER",
        time: "10:00",
        duration: "45 dk",
        address: "Uçhisar, Nevşehir",
        lat: 38.6301,
        lng: 34.8055,
        rating: 4.8,
        budget: "150 ₺",
        notes: "Kapadokya’nın en yüksek panoramik noktası.",
      },
    ];

    tripStore.createRoute(routeTitle, importedStops);
    Alert.alert(
      "📥 Rota Haritana Eklendi!",
      `"${routeTitle}" aktif seyahat rotalarına eklendi. Haritada incelemek ister misiniz?`,
      [
        { text: "Daha Sonra", style: "cancel" },
        { text: "Haritada Aç", onPress: onOpenMap },
      ],
    );
  };

  const handleStartChat = async () => {
    try {
      const { contact } = await chatStore.startOrGetDirectThread({
        name: user.name,
        handle: user.handle,
        avatar: user.avatar,
        badge: user.badge,
        location: user.location,
      });
      if (onOpenChat) {
        onOpenChat(user);
      } else {
        setActiveChatContact(contact);
      }
    } catch (e) {
      console.error("Chat start failed", e);
    }
  };

  if (activeChatContact) {
    return (
      <ChatScreen initialContact={activeChatContact} onGoBack={() => setActiveChatContact(null)} />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Cover Photo Header */}
        <View style={styles.coverWrap}>
          <Image source={{ uri: coverUrl }} style={styles.coverImage} resizeMode="cover" />
          <View style={styles.coverGradientOverlay} />

          {/* Top Floating Actions: Back Button & Badges */}
          <SafeArea style={styles.coverTopBar}>
            <TouchableOpacity style={styles.topBackBtn} onPress={onBack} activeOpacity={0.8}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.topBackArrow}>
                ←
              </Text>
            </TouchableOpacity>

            <View style={styles.coverBadge}>
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={{ fontSize: 11, marginRight: 4 }}
              >
                🏔️
              </Text>
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.compact}
                style={styles.coverBadgeText}
              >
                Vadi Kaşifi
              </Text>
            </View>
          </SafeArea>
        </View>

        {/* Profile Info Header Bar */}
        <View style={styles.profileHeaderBox}>
          {/* Avatar & Action Buttons Row */}
          <View style={styles.avatarActionsRow}>
            {/* Avatar with Ring */}
            <View style={styles.avatarWrap}>
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
              <View style={styles.verifiedBadge}>
                <Text
                  maxFontSizeMultiplier={tokens.font.maxScale.body}
                  style={styles.verifiedCheckText}
                >
                  ✓
                </Text>
              </View>
            </View>

            {/* Top Right Action Buttons (Mail, Notification, Follow) */}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={styles.iconCircleBtn}
                onPress={handleStartChat}
                activeOpacity={0.8}
              >
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ fontSize: 16 }}>
                  ✉️
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconCircleBtn}
                onPress={handleShareProfile}
                activeOpacity={0.8}
              >
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ fontSize: 16 }}>
                  🔗
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.followBtn, isFollowing && styles.followingBtn]}
                onPress={handleToggleFollow}
                activeOpacity={0.85}
              >
                <Text
                  maxFontSizeMultiplier={tokens.font.maxScale.body}
                  style={[styles.followBtnText, isFollowing && styles.followingBtnText]}
                >
                  {isFollowing ? "✓ Takip Ediliyor" : "+ Takip Et"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Name & Handle */}
          <View style={styles.nameRow}>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.userNameText}>
              {user.name}
            </Text>
            <View style={styles.masterBadge}>
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={{ fontSize: 11, marginRight: 2 }}
              >
                ⭐
              </Text>
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.compact}
                style={styles.masterBadgeText}
              >
                Master Gezgin
              </Text>
            </View>
          </View>
          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.userHandleText}>
            {user.handle}
          </Text>

          {/* Bio Text */}
          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.bioText}>
            {bioText}
          </Text>

          {/* Location & Metadata Row */}
          <View style={styles.metaInfoRow}>
            <View style={styles.metaItem}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.metaIcon}>
                📍
              </Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.metaText}>
                {user.location || "Nevşehir, Türkiye"}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.metaIcon}>
                📅
              </Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.metaText}>
                {user.joinDate || "Mart 2024'te katıldı"}
              </Text>
            </View>
            <TouchableOpacity onPress={handleShareProfile}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.metaLinkText}>
                🔗 {user.website || "mapsbridge.com/canberk"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Stats Summary Bar */}
          <View style={styles.statsBar}>
            <View style={styles.statBox}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.statNumber}>
                {user.postsCount || 14}
              </Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.statLabel}>
                PAYLAŞIM
              </Text>
            </View>
            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={[styles.statNumber, { color: tokens.color.textBrand }]}
              >
                🛣️ {user.routesCount || 8}
              </Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.statLabel}>
                AÇIK ROTA
              </Text>
            </View>
            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.statNumber}>
                {user.followersCount || "1.4k"}
              </Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.statLabel}>
                TAKİPÇİ
              </Text>
            </View>
            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.statNumber}>
                {user.followingCount || "324"}
              </Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.statLabel}>
                TAKİP
              </Text>
            </View>
          </View>
        </View>

        {/* Navigation Tabs (Yazılar & Akış, Rotalar, Medyalar, Beğeniler) */}
        <View style={styles.tabsStickyRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "feed" && styles.tabBtnActive]}
            onPress={() => setActiveTab("feed")}
            activeOpacity={0.8}
          >
            <Text
              maxFontSizeMultiplier={tokens.font.maxScale.body}
              style={[styles.tabBtnText, activeTab === "feed" && styles.tabBtnTextActive]}
            >
              Yazılar & Akış
            </Text>
            {activeTab === "feed" && <View style={styles.tabIndicator} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "routes" && styles.tabBtnActive]}
            onPress={() => setActiveTab("routes")}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={[styles.tabBtnText, activeTab === "routes" && styles.tabBtnTextActive]}
              >
                Rotalar
              </Text>
              <View style={styles.routesCountPill}>
                <Text
                  maxFontSizeMultiplier={tokens.font.maxScale.compact}
                  style={styles.routesCountPillText}
                >
                  8
                </Text>
              </View>
            </View>
            {activeTab === "routes" && <View style={styles.tabIndicator} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "media" && styles.tabBtnActive]}
            onPress={() => setActiveTab("media")}
            activeOpacity={0.8}
          >
            <Text
              maxFontSizeMultiplier={tokens.font.maxScale.body}
              style={[styles.tabBtnText, activeTab === "media" && styles.tabBtnTextActive]}
            >
              Medyalar
            </Text>
            {activeTab === "media" && <View style={styles.tabIndicator} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "likes" && styles.tabBtnActive]}
            onPress={() => setActiveTab("likes")}
            activeOpacity={0.8}
          >
            <Text
              maxFontSizeMultiplier={tokens.font.maxScale.body}
              style={[styles.tabBtnText, activeTab === "likes" && styles.tabBtnTextActive]}
            >
              Beğeniler
            </Text>
            {activeTab === "likes" && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        </View>

        {/* Tab Content: Feed */}
        {activeTab === "feed" && (
          <View style={styles.feedContent}>
            {/* Pinned Experience Article */}
            <View style={styles.postCard}>
              <View style={styles.pinnedBadge}>
                <Text
                  maxFontSizeMultiplier={tokens.font.maxScale.body}
                  style={{ fontSize: 11, marginRight: 4 }}
                >
                  📌
                </Text>
                <Text
                  maxFontSizeMultiplier={tokens.font.maxScale.compact}
                  style={styles.pinnedBadgeText}
                >
                  Sabitlenmiş Gezgin Deneyimi
                </Text>
              </View>

              <View style={styles.postAuthorRow}>
                <Image source={{ uri: user.avatar }} style={styles.miniAvatar} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={styles.miniAuthorName}
                    >
                      {user.name}
                    </Text>
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={{ color: tokens.color.accent, fontWeight: "900", fontSize: 13 }}
                    >
                      ✓
                    </Text>
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={styles.miniAuthorHandle}
                    >
                      {user.handle} · 3g
                    </Text>
                  </View>
                </View>
              </View>

              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.postText}>
                Sabah 05:30'da Aşk Vadisi'nde balonların yükselişini izlemek paha biçilemezdi 🎈🌅
                Vadi içindeki gizli patikaları tek tek kaydettim, rotayı klonlayabilirsiniz!
              </Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.postHashtags}>
                #Kapadokya #Doğa #Doğadakiİz
              </Text>

              {/* Route Attachment Card */}
              <View style={styles.routeCardContainer}>
                <View style={styles.routeCardBannerWrap}>
                  <Image
                    source={{
                      uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuDcvr7DD_kFmlHtK4p0lGpxBkTDJrURvNHFvBM4FIDCI9f7Y99u_rsTsjU6lvxSW0IVWV7rboEHUpaUraFEQKAmvCH4eOGoboebkWeFlBb0rJdPCJqJrvuTRzQpZje4LoQn01nJU1FfLpdXIfoM8XJ1C2KDqo-EZ0H3puc2JMsBUQ0AfOzTtMFBwYYnSabIDHsMofFPzzO8k1vNlEhLzbAU7aEGUBtnJbKVVkTIF9Sm_kpQf3bDQLG44g",
                    }}
                    style={styles.routeCardBanner}
                    resizeMode="cover"
                  />
                  <View style={styles.gpsRoutePill}>
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.compact}
                      style={styles.gpsRoutePillText}
                    >
                      🧭 Canlı GPS Rotası
                    </Text>
                  </View>
                  <View style={styles.elevationPill}>
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.compact}
                      style={styles.elevationPillText}
                    >
                      📈 +140m İrtifa
                    </Text>
                  </View>
                </View>

                <View style={styles.routeCardInfoBox}>
                  <View style={styles.routeCardTitleRow}>
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={styles.routeCardTitle}
                      numberOfLines={1}
                    >
                      Kapadokya: Gün Doğumu Vadi Yürüyüşü
                    </Text>
                    <View style={styles.routeLevelPill}>
                      <Text
                        maxFontSizeMultiplier={tokens.font.maxScale.compact}
                        style={styles.routeLevelPillText}
                      >
                        Kolay
                      </Text>
                    </View>
                  </View>

                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.routeStatsRow}
                  >
                    📍 8 Durak • 📏 5.1 km • ⏱️ 2s 15dk
                  </Text>

                  <View style={styles.clonersAndActionRow}>
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={styles.clonersText}
                    >
                      👥 42 gezgin klonladı
                    </Text>
                    <TouchableOpacity
                      style={styles.importRouteBtn}
                      onPress={() => handleImportRoute("Kapadokya: Gün Doğumu Vadi Yürüyüşü")}
                      activeOpacity={0.85}
                    >
                      <Text
                        maxFontSizeMultiplier={tokens.font.maxScale.body}
                        style={styles.importRouteBtnText}
                      >
                        Haritama Al 📥
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Interaction Bar */}
              <View style={styles.interactionRow}>
                <TouchableOpacity
                  style={styles.interactionItem}
                  onPress={() => Alert.alert("Yorumlar", "58 Gezgin Yorumu")}
                >
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.interactionIcon}
                  >
                    💬
                  </Text>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.compact}
                    style={styles.interactionCount}
                  >
                    58
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.interactionItem}
                  onPress={() => Alert.alert("Paylaşım", "93 kişi rotayı paylaştı")}
                >
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.interactionIcon}
                  >
                    🔁
                  </Text>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.compact}
                    style={styles.interactionCount}
                  >
                    93
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.interactionItem} onPress={handleLikePost1}>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={[styles.interactionIcon, isPost1Liked && { color: tokens.color.danger }]}
                  >
                    {isPost1Liked ? "❤️" : "🤍"}
                  </Text>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.compact}
                    style={[
                      styles.interactionCount,
                      isPost1Liked && { color: tokens.color.danger, fontWeight: "800" },
                    ]}
                  >
                    {post1Likes}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.interactionItem}
                  onPress={() => setIsBookmarked(!isBookmarked)}
                >
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.interactionIcon}
                  >
                    {isBookmarked ? "🔖" : "📑"}
                  </Text>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.compact}
                    style={styles.interactionCount}
                  >
                    140
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.interactionItem} onPress={handleShareProfile}>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.interactionIcon}
                  >
                    ↗️
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Post 2: Ihlara Canyon */}
            <View style={styles.postCard}>
              <View style={styles.postAuthorRow}>
                <Image source={{ uri: user.avatar }} style={styles.miniAvatar} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={styles.miniAuthorName}
                    >
                      {user.name}
                    </Text>
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={{ color: tokens.color.accent, fontWeight: "900", fontSize: 13 }}
                    >
                      ✓
                    </Text>
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={styles.miniAuthorHandle}
                    >
                      {user.handle} · 1hf
                    </Text>
                  </View>
                </View>
              </View>

              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.postText}>
                Ihlara Vadisi'nin derinliklerinde akan Melendiz Çayı boyunca 14 km yürüdük. Suyun
                sesi ve kayalara oyulmuş kiliseler büyüleyiciydi 🥾🌿
              </Text>

              {/* 2-Photo Grid */}
              <View style={styles.photoGridRow}>
                <Image
                  source={{
                    uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuAeaSMjMZTWm7oePMaFEklPH2RktXTy4DacXZmh2meeTs4U6-C5rSrFQie3Saimy2MaIaPsFynm4amBAdyrV5f0O-J0udGNcvyxP0m4EWP-_zCqGxCLJCElaJLN6gQf1TpPqD4pTmEucz1SkiJfuYFvX2n62R7WPFai-vA35yTKyhYo45_Pek3yjeIGVuHeb9Uu7sI3IPpnVO8t2v3NU4vJadBiNvP-LXat2lCxNb9vQIlYzAGlfO54mg",
                  }}
                  style={styles.gridImage}
                  resizeMode="cover"
                />
                <Image
                  source={{
                    uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuDyTrqYKQlJCD9GgEskiwTCJoCUwHRk0lxpfJZkVAUWgoXyfDnrhRMojWM-hvhsj8_wPKx6wwVh_06tMtyVlxQdlui2F3CZfcbu-jGA4g_o1SLMIiUlfd0RU05eniHYI4X2TZl6TOgOaI_WkiSs7VsZ4UAc2cY1vNa-yRD4vSosSw_myavrMrgtz8j-TLyUMMmKOgt1O3pk1SOCd29Cp9lzkzpITCjEhA_rTQW49u-fD-k_yGUAFABLZA",
                  }}
                  style={styles.gridImage}
                  resizeMode="cover"
                />
              </View>

              {/* Interaction Bar */}
              <View style={styles.interactionRow}>
                <TouchableOpacity style={styles.interactionItem}>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.interactionIcon}
                  >
                    💬
                  </Text>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.compact}
                    style={styles.interactionCount}
                  >
                    24
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.interactionItem}>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.interactionIcon}
                  >
                    🔁
                  </Text>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.compact}
                    style={styles.interactionCount}
                  >
                    31
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.interactionItem} onPress={handleLikePost2}>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={[styles.interactionIcon, isPost2Liked && { color: tokens.color.danger }]}
                  >
                    {isPost2Liked ? "❤️" : "🤍"}
                  </Text>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.compact}
                    style={[
                      styles.interactionCount,
                      isPost2Liked && { color: tokens.color.danger, fontWeight: "800" },
                    ]}
                  >
                    {post2Likes}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.interactionItem}>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.interactionIcon}
                  >
                    📑
                  </Text>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.compact}
                    style={styles.interactionCount}
                  >
                    64
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.interactionItem} onPress={handleShareProfile}>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.interactionIcon}
                  >
                    ↗️
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Tab Content: Routes */}
        {activeTab === "routes" && (
          <View style={styles.routesListContent}>
            {[
              {
                id: "r1",
                name: "Kapadokya: Gün Doğumu Vadi Yürüyüşü",
                stopsCount: 8,
                km: "5.1 km",
                time: "2s 15dk",
                level: "Kolay",
              },
              {
                id: "r2",
                name: "Ihlara Vadisi Kanyon & Kiliseler Parkuru",
                stopsCount: 6,
                km: "14.0 km",
                time: "4s 30dk",
                level: "Orta",
              },
              {
                id: "r3",
                name: "Fethiye Kelebekler Vadisi & Kabak Koyu",
                stopsCount: 7,
                km: "9.8 km",
                time: "3s 45dk",
                level: "Orta",
              },
            ].map((route) => (
              <View key={route.id} style={styles.routeItemCard}>
                <View style={{ flex: 1 }}>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.routeItemTitle}
                  >
                    {route.name}
                  </Text>
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.routeItemSub}
                  >
                    {route.stopsCount} Durak • {route.km} • {route.time} • {route.level}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.importRouteBtn}
                  onPress={() => handleImportRoute(route.name)}
                >
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={styles.importRouteBtnText}
                  >
                    Haritama Al 📥
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Tab Content: Media Gallery */}
        {activeTab === "media" && (
          <View style={styles.mediaGridContent}>
            {[
              "https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=600&auto=format&fit=crop&q=80",
              "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=600&auto=format&fit=crop&q=80",
              "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=600&auto=format&fit=crop&q=80",
              "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80",
              "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&auto=format&fit=crop&q=80",
              "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600&auto=format&fit=crop&q=80",
            ].map((url, i) => (
              <Image key={i} source={{ uri: url }} style={styles.galleryImage} resizeMode="cover" />
            ))}
          </View>
        )}

        {/* Tab Content: Likes */}
        {activeTab === "likes" && (
          <View style={styles.likesEmptyContent}>
            <Text
              maxFontSizeMultiplier={tokens.font.maxScale.body}
              style={{ fontSize: 32, marginBottom: 8 }}
            >
              ❤️
            </Text>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.likesEmptyTitle}>
              Beğenilen Gönderiler
            </Text>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.likesEmptySub}>
              {user.name} tarafından beğenilen 342 rota ve fotoğraf burada toplanıyor.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.bg,
  },
  scrollContent: {
    paddingBottom: 90,
  },
  coverWrap: {
    width: "100%",
    height: 180,
    position: "relative",
    backgroundColor: tokens.color.surfaceInverse,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverGradientOverlay: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: withAlpha(tokens.color.surfaceInverse, 0.35),
  },
  coverTopBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 12 : 36,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  topBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: withAlpha(tokens.color.surface, 0.92),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  topBackArrow: {
    fontSize: 18,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  coverBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: withAlpha(tokens.color.surfaceInverse, 0.75),
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  coverBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.color.onPrimary,
  },
  profileHeaderBox: {
    paddingHorizontal: 16,
    backgroundColor: tokens.color.bg,
  },
  avatarActionsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: -48,
    marginBottom: 10,
  },
  avatarWrap: {
    position: "relative",
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: tokens.color.surface,
    padding: 3,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 42,
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tokens.color.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: tokens.color.neutral0,
  },
  verifiedCheckText: {
    color: tokens.color.onPrimary,
    fontSize: 11,
    fontWeight: "900",
  },
  actionButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 4,
  },
  iconCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tokens.color.surfaceTint,
    alignItems: "center",
    justifyContent: "center",
  },
  followBtn: {
    backgroundColor: tokens.color.brandHover,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 999,
    shadowColor: tokens.color.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  followingBtn: {
    backgroundColor: tokens.color.surfaceTint,
  },
  followBtnText: {
    color: tokens.color.onPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  followingBtnText: {
    color: tokens.color.textBrand,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userNameText: {
    fontSize: 20,
    fontWeight: "800",
    color: tokens.color.text,
    letterSpacing: -0.2,
  },
  masterBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.color.surfaceBrand,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  masterBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  userHandleText: {
    fontSize: 13,
    color: tokens.color.textSubtle,
    marginTop: 2,
  },
  bioText: {
    fontSize: 13,
    color: tokens.color.text,
    lineHeight: 20,
    marginTop: 8,
  },
  metaInfoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaIcon: {
    fontSize: 12,
  },
  metaText: {
    fontSize: 11,
    color: tokens.color.textSubtle,
    fontWeight: "500",
  },
  metaLinkText: {
    fontSize: 11,
    color: tokens.color.accent,
    fontWeight: "700",
  },
  statsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: tokens.color.surface,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: tokens.color.surfaceTint,
    marginTop: 14,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statBox: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontSize: 15,
    fontWeight: "800",
    color: tokens.color.text,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: tokens.color.textSubtle,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: tokens.color.surfaceTint,
  },
  tabsStickyRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.surfaceTint,
    backgroundColor: tokens.color.bg,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    position: "relative",
  },
  tabBtnActive: {},
  tabBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.color.textSubtle,
  },
  tabBtnTextActive: {
    color: tokens.color.textBrand,
    fontWeight: "800",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 12,
    right: 12,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: tokens.color.primary,
  },
  routesCountPill: {
    backgroundColor: tokens.color.surfaceBrandSoft,
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 999,
  },
  routesCountPillText: {
    fontSize: 9,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  feedContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  postCard: {
    backgroundColor: tokens.color.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.color.surfaceTint,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  pinnedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.color.surfaceBrand,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  pinnedBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  postAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  miniAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  miniAuthorName: {
    fontSize: 14,
    fontWeight: "800",
    color: tokens.color.text,
  },
  miniAuthorHandle: {
    fontSize: 12,
    color: tokens.color.textSubtle,
  },
  postText: {
    fontSize: 13,
    color: tokens.color.text,
    lineHeight: 20,
  },
  postHashtags: {
    fontSize: 12,
    color: tokens.color.link,
    fontWeight: "700",
    marginTop: 4,
  },
  routeCardContainer: {
    backgroundColor: tokens.color.bg,
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 10,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  routeCardBannerWrap: {
    height: 120,
    position: "relative",
  },
  routeCardBanner: {
    width: "100%",
    height: "100%",
  },
  gpsRoutePill: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: withAlpha(tokens.color.surfaceInverse, 0.8),
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  gpsRoutePillText: {
    fontSize: 10,
    fontWeight: "800",
    color: tokens.color.onPrimary,
  },
  elevationPill: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: withAlpha(tokens.color.surface, 0.92),
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  elevationPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: tokens.color.textBrand,
  },
  routeCardInfoBox: {
    padding: 12,
  },
  routeCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  routeCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: tokens.color.text,
    flexShrink: 1,
  },
  routeLevelPill: {
    backgroundColor: tokens.color.surfaceBrandSoft,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  routeLevelPillText: {
    fontSize: 9,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  routeStatsRow: {
    fontSize: 11,
    color: tokens.color.textSubtle,
    marginTop: 4,
  },
  clonersAndActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
  },
  clonersText: {
    fontSize: 11,
    color: tokens.color.textSubtle,
    fontWeight: "600",
  },
  importRouteBtn: {
    backgroundColor: tokens.color.brandHover,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  importRouteBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: tokens.color.onPrimary,
  },
  photoGridRow: {
    flexDirection: "row",
    gap: 8,
    height: 140,
    marginTop: 10,
    borderRadius: 14,
    overflow: "hidden",
  },
  gridImage: {
    flex: 1,
    height: "100%",
  },
  interactionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: tokens.color.surfaceTint,
    paddingHorizontal: 4,
  },
  interactionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  interactionIcon: {
    fontSize: 14,
  },
  interactionCount: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.color.textSubtle,
  },
  routesListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  routeItemCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: tokens.color.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.color.surfaceTint,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  routeItemTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: tokens.color.text,
  },
  routeItemSub: {
    fontSize: 11,
    color: tokens.color.textSubtle,
    marginTop: 3,
  },
  mediaGridContent: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  galleryImage: {
    width: (SCREEN_W - 40) / 3,
    height: (SCREEN_W - 40) / 3,
    borderRadius: 10,
  },
  likesEmptyContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 30,
  },
  likesEmptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: tokens.color.text,
  },
  likesEmptySub: {
    fontSize: 12,
    color: tokens.color.textSubtle,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
});
