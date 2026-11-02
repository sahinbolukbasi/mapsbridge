import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Share,
  Alert,
  TextInput,
} from "react-native";
import {
  ExploreIcon,
  ChatIcon,
  BellIcon,
  SettingsIcon,
  EditIcon,
  BalloonIcon,
  MountainIcon,
  MonumentIcon,
  BookmarkIcon,
  LogoutIcon,
  TrashIcon,
  MapPinIcon,
  HeartIcon,
} from "../components/Icons";
import { authService, UserSession } from "../services/api";
import { socialSyncService, MobileUserProfile, MobileCommunityPost } from "../services/socialSync";
import { tripStore, ActiveRoute, TripStop } from "../services/tripStore";
import { EditProfileModal } from "../components/EditProfileModal";
import { EditPostModal } from "../components/EditPostModal";
import { ChatScreen } from "./ChatScreen";
import { ScreenTourModal } from "../components/ScreenTourModal";
import { PaywallModal } from "../components/PaywallModal";
import { getCustomerInfo, getActiveTier, type PlanTier } from "../services/revenuecat";

import { ModalFrame, Screen } from "../ui";
import { tokens, withAlpha } from "../theme";
interface ProfileScreenProps {
  onShowWelcome: () => void;
  onOpenMap: () => void;
  onOpenMessages?: () => void;
  onOpenPlan?: () => void;
}

export function ProfileScreen({
  onShowWelcome,
  onOpenMap,
  onOpenMessages: _onOpenMessages,
  onOpenPlan,
}: ProfileScreenProps) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [profile, setProfile] = useState<MobileUserProfile | null>(null);
  const [myPosts, setMyPosts] = useState<MobileCommunityPost[]>([]);
  const [allRoutes, setAllRoutes] = useState<ActiveRoute[]>(tripStore.getAllRoutes());
  const [activeRoute, setActiveRoute] = useState<ActiveRoute>(tripStore.getActiveRoute());
  const [savedPool, setSavedPool] = useState<TripStop[]>(tripStore.getSavedPool());
  const [showChatScreen, setShowChatScreen] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingPost, setEditingPost] = useState<MobileCommunityPost | null>(null);
  const [renamingRoute, setRenamingRoute] = useState<ActiveRoute | null>(null);
  const [renameRouteText, setRenameRouteText] = useState<string>("");
  const [showPaywall, setShowPaywall] = useState(false);
  const [planTier, setPlanTier] = useState<PlanTier>("free");

  useEffect(() => {
    async function loadData() {
      const currentSession = await authService.getSession();
      setSession(currentSession);

      // Load RevenueCat entitlement status
      getCustomerInfo()
        .then((info) => {
          if (info) setPlanTier(getActiveTier(info));
        })
        .catch(() => {});

      const userProf = await socialSyncService.getUserProfile();
      setProfile(userProf);

      const allPosts = await socialSyncService.getPosts();
      const filtered = allPosts.filter(
        (p) =>
          p.authorHandle === `@${userProf.username}` ||
          p.authorName === userProf.fullName ||
          (userProf.email && p.authorEmail === userProf.email),
      );
      setMyPosts(filtered.length > 0 ? filtered : allPosts.slice(0, 2));
    }
    loadData();

    const unsubProfile = socialSyncService.subscribeProfile((updated) => {
      setProfile(updated);
      socialSyncService.getPosts().then((posts) => {
        const filtered = posts.filter(
          (p) =>
            p.authorHandle === `@${updated.username}` ||
            p.authorName === updated.fullName ||
            (updated.email && p.authorEmail === updated.email),
        );
        setMyPosts(filtered.length > 0 ? filtered : posts.slice(0, 2));
      });
    });

    const unsubPosts = socialSyncService.subscribePosts(async (posts) => {
      const currentProfile = await socialSyncService.getUserProfile();
      const filtered = posts.filter(
        (p) =>
          p.authorHandle === `@${currentProfile.username}` ||
          p.authorName === currentProfile.fullName ||
          (currentProfile.email && p.authorEmail === currentProfile.email),
      );
      setMyPosts(filtered.length > 0 ? filtered : posts.slice(0, 2));
    });

    const unsubTrip = tripStore.subscribe(() => {
      setAllRoutes([...tripStore.getAllRoutes()]);
      setActiveRoute({ ...tripStore.getActiveRoute() });
      setSavedPool([...tripStore.getSavedPool()]);
    });

    return () => {
      unsubProfile();
      unsubPosts();
      unsubTrip();
    };
  }, []);

  const displayName =
    profile?.fullName || session?.name || session?.email?.split("@")[0] || "Canberk Yılmaz";
  const userHandle = profile
    ? `@${profile.username} • ${profile.travelTitle}`
    : session?.email
      ? `@${session.email.split("@")[0]} • Doğa & Rota Kaşifi`
      : "@canberk • Doğa & Rota Kaşifi";

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `${displayName} MapsBridge Seyahat Profili: Rotalarımı ve seyahat keşiflerimi incele! https://mapsbridge.com`,
        title: `${displayName} - MapsBridge Kaşif Profili`,
      });
    } catch {}
  };

  const handleLogout = () => {
    Alert.alert("Çıkış Yap", "MapsBridge hesabınızdan çıkış yapmak istediğinize emin misiniz?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Çıkış Yap",
        style: "destructive",
        onPress: async () => {
          await authService.signOut();
          onShowWelcome();
        },
      },
    ]);
  };

  if (showChatScreen) {
    return (
      <ChatScreen
        onGoBack={() => setShowChatScreen(false)}
        onOpenMap={() => {
          setShowChatScreen(false);
          onOpenMap();
        }}
      />
    );
  }

  return (
    <Screen style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerLogoBadge}>
            <ExploreIcon size={18} color={tokens.color.accentStrong} />
          </View>
          <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.headerTitle}>
            Profil
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity
            style={styles.chatHeaderBtn}
            onPress={() => setShowChatScreen(true)}
            activeOpacity={0.8}
          >
            <ChatIcon size={18} color={tokens.color.textBrand} />
            <View style={styles.chatHeaderBadge}>
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.compact}
                style={styles.chatHeaderBadgeText}
              >
                1
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.notificationBtn}
            onPress={() =>
              Alert.alert("Bildirimler", "Yeni seyahat ve rota bildiriminiz bulunmuyor.")
            }
            activeOpacity={0.8}
          >
            <BellIcon size={18} color={tokens.color.textBrand} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Clean Profile Header Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileMainRow}>
            {/* Avatar with Verified Badge & Edit Pen Badge */}
            <TouchableOpacity
              style={styles.avatarWrap}
              onPress={() => setShowEditModal(true)}
              activeOpacity={0.8}
            >
              {profile?.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={styles.avatarRealImage} />
              ) : (
                <View style={styles.avatarImagePlaceholder}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.avatarText}>
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.avatarEditPenBadge}>
                <EditIcon size={10} color={tokens.color.onPrimary} />
              </View>
            </TouchableOpacity>

            {/* User Info */}
            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text
                  maxFontSizeMultiplier={tokens.font.maxScale.body}
                  style={styles.userName}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.verifiedIcon}>
                  ✓
                </Text>
              </View>
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={styles.userHandle}
                numberOfLines={1}
              >
                {userHandle}
              </Text>

              {/* Location Badge */}
              <View style={styles.userLocationBadge}>
                <MapPinIcon size={11} color={tokens.color.successStrong} />
                <Text
                  maxFontSizeMultiplier={tokens.font.maxScale.body}
                  style={styles.userLocationText}
                  numberOfLines={1}
                >
                  {profile?.location || "İstanbul, Türkiye"}
                </Text>
              </View>
            </View>

            {/* Settings Cog */}
            <TouchableOpacity
              style={styles.settingsCogBtn}
              onPress={() =>
                Alert.alert(
                  "Ayarlar",
                  "Uygulama sürümü: v3.4.1 (Botanical)\nBildirimler ve konum izinleri aktif.",
                )
              }
              activeOpacity={0.8}
            >
              <SettingsIcon size={18} color={tokens.color.textBrand} />
            </TouchableOpacity>
          </View>

          {/* User Bio */}
          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.userBioText}>
            {profile?.bio ||
              "Doğa yürüyüşleri, gizli kanyonlar ve vadiler keşfetmeyi seviyorum 🌄 | MapsBridge Rota Kaşifi"}
          </Text>

          {/* Minimal Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.statNum}>
                {allRoutes.length}
              </Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.statLabel}>
                Rotalar
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.statNum}>
                {allRoutes.reduce((acc, r) => acc + (r.stops?.length || 0), 0) + savedPool.length}
              </Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.statLabel}>
                Duraklar
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.statNum}>
                {myPosts.length}
              </Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.statLabel}>
                Paylaşım
              </Text>
            </View>
          </View>

          {/* Clean Action Buttons */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.chatActionBtn}
              onPress={() => setShowChatScreen(true)}
              activeOpacity={0.85}
            >
              <ChatIcon size={15} color={tokens.color.onPrimary} />
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={styles.chatActionBtnText}
              >
                Mesajlaş
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.editProfileBtn}
              onPress={() => setShowEditModal(true)}
              activeOpacity={0.85}
            >
              <EditIcon size={15} color={tokens.color.textBrand} />
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={styles.editProfileBtnText}
              >
                Düzenle
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shareProfileBtn}
              onPress={handleShareProfile}
              activeOpacity={0.85}
            >
              <ExploreIcon size={15} color={tokens.color.textBrand} />
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={styles.shareProfileBtnText}
              >
                Paylaş
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* My Community Posts (Paylaşımlarım) Section */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.sectionHeading}>
              Paylaşımlarım
            </Text>
            <View style={styles.postCountBadge}>
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.compact}
                style={styles.postCountBadgeText}
              >
                {myPosts.length}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowChatScreen(false)}>
            <Text
              maxFontSizeMultiplier={tokens.font.maxScale.body}
              style={styles.sectionHeadingLink}
            >
              Topluluk Akışı →
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.myPostsGroup}>
          {myPosts.length === 0 ? (
            <View style={styles.emptyPostsCard}>
              <ChatIcon size={24} color={tokens.color.textSubtle} />
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={styles.emptyPostsTitle}
              >
                Henüz paylaşımınız yok
              </Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.emptyPostsSub}>
                Keşif sekmesinden ilk seyahat hikayenizi veya rotanızı paylaşabilirsiniz.
              </Text>
            </View>
          ) : (
            myPosts.map((post) => (
              <View key={post.id} style={styles.myPostCard}>
                <View style={styles.myPostHeader}>
                  <View style={{ flex: 1 }}>
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={styles.myPostTime}
                    >
                      {post.timeAgo}
                    </Text>
                    {post.locationTag && (
                      <View style={styles.myPostLocationRow}>
                        <MapPinIcon size={12} color={tokens.color.accent} />
                        <Text
                          maxFontSizeMultiplier={tokens.font.maxScale.body}
                          style={styles.myPostLocationText}
                        >
                          {post.locationTag}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.myPostActionBtns}>
                    <TouchableOpacity
                      style={styles.postEditSmallBtn}
                      onPress={() => setEditingPost(post)}
                      activeOpacity={0.7}
                    >
                      <EditIcon size={13} color={tokens.color.textBrand} />
                      <Text
                        maxFontSizeMultiplier={tokens.font.maxScale.body}
                        style={styles.postEditSmallText}
                      >
                        Düzenle
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.postDeleteSmallBtn}
                      onPress={async () => {
                        Alert.alert("Gönderiyi Sil", "Bu paylaşım silinsin mi?", [
                          { text: "Vazgeç", style: "cancel" },
                          {
                            text: "Sil",
                            style: "destructive",
                            onPress: async () => {
                              await socialSyncService.deletePost(post.id);
                              setMyPosts((prev) => prev.filter((p) => p.id !== post.id));
                            },
                          },
                        ]);
                      }}
                      activeOpacity={0.7}
                    >
                      <TrashIcon size={13} color={tokens.color.danger} />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text
                  maxFontSizeMultiplier={tokens.font.maxScale.body}
                  style={styles.myPostContent}
                >
                  {post.content}
                </Text>

                {post.hashtags && post.hashtags.length > 0 && (
                  <View style={styles.myPostHashtags}>
                    {post.hashtags.map((h, i) => (
                      <Text
                        maxFontSizeMultiplier={tokens.font.maxScale.body}
                        key={i}
                        style={styles.myPostTag}
                      >
                        {h}
                      </Text>
                    ))}
                  </View>
                )}

                <View style={styles.myPostStatsRow}>
                  <View style={styles.myPostStatItem}>
                    <HeartIcon
                      size={13}
                      color={tokens.color.dangerIcon}
                      fill={post.isLiked ? tokens.color.dangerIcon : "none"}
                    />
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={styles.myPostStatText}
                    >
                      {post.likesCount} Beğeni
                    </Text>
                  </View>
                  <View style={styles.myPostStatItem}>
                    <ChatIcon size={13} color={tokens.color.accent} />
                    <Text
                      maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={styles.myPostStatText}
                    >
                      {post.commentsCount || 0} Yorum
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Saved Routes Section: Gerçek Kayıtlı Plan Rotaları */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.sectionHeading}>
              Kayıtlı Rotalarım
            </Text>
            <View style={styles.postCountBadge}>
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.compact}
                style={styles.postCountBadgeText}
              >
                {allRoutes.length}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => (onOpenPlan ? onOpenPlan() : onOpenMap())}>
            <Text
              maxFontSizeMultiplier={tokens.font.maxScale.body}
              style={styles.sectionHeadingLink}
            >
              Plan Masasında Gör →
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.routesGroup}>
          {allRoutes.length === 0 ? (
            <View style={styles.emptyRoutesCard}>
              <BookmarkIcon size={24} color={tokens.color.textSubtle} />
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={styles.emptyRoutesTitle}
              >
                Henüz kayıtlı bir rotanız yok
              </Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.emptyRoutesSub}>
                Planım sekmesinden dilediğiniz gibi durak seçip gezi rotanızı oluşturabilirsiniz.
              </Text>
              <TouchableOpacity
                style={styles.createRouteBtn}
                onPress={() => {
                  tripStore.createRoute("Yeni Keşif Rotam");
                  if (onOpenPlan) onOpenPlan();
                  else onOpenMap();
                }}
                activeOpacity={0.8}
              >
                <Text
                  maxFontSizeMultiplier={tokens.font.maxScale.body}
                  style={styles.createRouteBtnText}
                >
                  + Yeni Rota Oluştur
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            allRoutes.map((r, index) => {
              const isActive = r.id === activeRoute.id;
              const bgColors = [
                tokens.color.brandHover,
                tokens.color.onSurfaceBrand,
                tokens.color.primary,
                tokens.dataPalette.teal,
              ];
              const bgColor = bgColors[index % bgColors.length];

              return (
                <View key={r.id} style={styles.routeCard}>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
                    onPress={() => {
                      tripStore.switchActiveRoute(r.id);
                      if (onOpenPlan) onOpenPlan();
                      else onOpenMap();
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.routeThumb, { backgroundColor: bgColor }]}>
                      {index % 3 === 0 ? (
                        <BalloonIcon size={22} color={tokens.color.onPrimary} />
                      ) : index % 3 === 1 ? (
                        <MountainIcon size={22} color={tokens.color.onPrimary} />
                      ) : (
                        <MonumentIcon size={22} color={tokens.color.onPrimary} />
                      )}
                    </View>
                    <View style={styles.routeDetails}>
                      <View style={styles.routeBadgeRow}>
                        {isActive && (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                              marginRight: 6,
                            }}
                          >
                            <View style={styles.statusLiveDot} />
                            <Text
                              maxFontSizeMultiplier={tokens.font.maxScale.compact}
                              style={styles.routeBadgeText}
                            >
                              AKTİF PLANDA
                            </Text>
                          </View>
                        )}
                        <Text
                          maxFontSizeMultiplier={tokens.font.maxScale.body}
                          style={styles.routeSub}
                        >
                          {r.stops.length} Durak
                        </Text>
                      </View>
                      <Text
                        maxFontSizeMultiplier={tokens.font.maxScale.body}
                        style={styles.routeTitle}
                        numberOfLines={1}
                      >
                        {r.name}
                      </Text>
                      <Text
                        maxFontSizeMultiplier={tokens.font.maxScale.body}
                        style={styles.routeSub}
                        numberOfLines={1}
                      >
                        {r.stops.length > 0
                          ? r.stops
                              .map((s) => s.name)
                              .slice(0, 2)
                              .join(" • ")
                          : "Henüz durak eklenmedi"}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Route Action Buttons: Rename & Delete */}
                  <View style={styles.routeActionButtonsRow}>
                    <TouchableOpacity
                      style={styles.routeEditBtn}
                      onPress={() => {
                        setRenamingRoute(r);
                        setRenameRouteText(r.name);
                      }}
                      activeOpacity={0.7}
                      accessibilityLabel="Rotanın İsmini Düzenle"
                    >
                      <EditIcon size={14} color={tokens.color.successStrong} />
                    </TouchableOpacity>

                    {allRoutes.length > 1 && (
                      <TouchableOpacity
                        style={styles.routeDeleteBtn}
                        onPress={() => {
                          Alert.alert(
                            "Rotayı Sil",
                            `"${r.name}" rotasını silmek istediğinize emin misiniz?`,
                            [
                              { text: "Vazgeç", style: "cancel" },
                              {
                                text: "Sil",
                                style: "destructive",
                                onPress: () => {
                                  tripStore.deleteRoute(r.id);
                                },
                              },
                            ],
                          );
                        }}
                        activeOpacity={0.7}
                        accessibilityLabel="Rotayı Sil"
                      >
                        <TrashIcon size={14} color={tokens.color.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Hesap & Araçlar Section (Gereksiz mock alertler kaldırıldı, hepsi çalışan işlevler) */}
        <View style={styles.toolsCard}>
          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.toolsCardHeading}>
            Hesap & Araçlar
          </Text>

          {/* Seyahat Masam & Rota Planım */}
          <TouchableOpacity
            style={styles.toolRow}
            onPress={() => (onOpenPlan ? onOpenPlan() : onOpenMap())}
            activeOpacity={0.75}
          >
            <View style={styles.toolLeft}>
              <View
                style={[styles.toolIconWrap, { backgroundColor: tokens.color.surfaceBrandStrong }]}
              >
                <BookmarkIcon size={16} color={tokens.color.onSurfaceBrand} />
              </View>
              <View>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.toolLabel}>
                  Seyahat Masam & Rota Planım
                </Text>
                <Text
                  maxFontSizeMultiplier={tokens.font.maxScale.body}
                  style={{ fontSize: 10, color: tokens.color.textSubtle }}
                >
                  {allRoutes.length} kayıtlı rota • {activeRoute.stops.length} aktif durak
                </Text>
              </View>
            </View>
            <View style={styles.toolRight}>
              <View style={[styles.newBadge, { backgroundColor: tokens.color.accent }]}>
                <Text
                  maxFontSizeMultiplier={tokens.font.maxScale.compact}
                  style={[styles.newBadgeText, { color: tokens.color.onPrimary }]}
                >
                  AÇ
                </Text>
              </View>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.toolChevron}>
                ›
              </Text>
            </View>
          </TouchableOpacity>

          {/* Kayıtlı Durak Havuzum */}
          <TouchableOpacity
            style={styles.toolRow}
            onPress={() => (onOpenPlan ? onOpenPlan() : onOpenMap())}
            activeOpacity={0.75}
          >
            <View style={styles.toolLeft}>
              <View
                style={[styles.toolIconWrap, { backgroundColor: tokens.color.surfaceBrandSoft }]}
              >
                <MapPinIcon size={16} color={tokens.color.onSurfaceBrand} />
              </View>
              <View>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.toolLabel}>
                  Kayıtlı Durak Havuzum
                </Text>
                <Text
                  maxFontSizeMultiplier={tokens.font.maxScale.body}
                  style={{ fontSize: 10, color: tokens.color.textSubtle }}
                >
                  {savedPool.length} adet durak kaydedildi
                </Text>
              </View>
            </View>
            <View style={styles.toolRight}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.toolChevron}>
                ›
              </Text>
            </View>
          </TouchableOpacity>

          {/* Abonelik Durumu */}
          <TouchableOpacity
            style={styles.toolRow}
            onPress={() => setShowPaywall(true)}
            activeOpacity={0.75}
          >
            <View style={styles.toolLeft}>
              <View
                style={[
                  styles.toolIconWrap,
                  {
                    backgroundColor:
                      planTier === "pro"
                        ? withAlpha(tokens.color.accentStrong, 0.15)
                        : tokens.color.warningBgStrong,
                  },
                ]}
              >
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ fontSize: 16 }}>
                  {planTier === "pro" ? "⭐" : "🔓"}
                </Text>
              </View>
              <View>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.toolLabel}>
                  {planTier === "pro" ? "MapsBridge Pro ✓" : "Ücretsiz Plan"}
                </Text>
                <Text
                  maxFontSizeMultiplier={tokens.font.maxScale.body}
                  style={{
                    fontSize: 10,
                    color: planTier === "pro" ? tokens.color.accentStrong : tokens.color.textSubtle,
                  }}
                >
                  {planTier === "pro"
                    ? "Tüm özellikler aktif"
                    : "Pro'ya geçerek tüm özellikleri aç"}
                </Text>
              </View>
            </View>
            <View style={styles.toolRight}>
              {planTier !== "pro" && (
                <View
                  style={{
                    backgroundColor: tokens.color.accentStrong,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 10,
                  }}
                >
                  <Text
                    maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={{
                      fontSize: 10,
                      fontWeight: "800",
                      color: tokens.color.surfaceInverseStrong,
                    }}
                  >
                    UPGRADE
                  </Text>
                </View>
              )}
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.toolChevron}>
                ›
              </Text>
            </View>
          </TouchableOpacity>

          {/* Gezgin Sohbet & Mesajlaşma */}
          <TouchableOpacity
            style={styles.toolRow}
            onPress={() => setShowChatScreen(true)}
            activeOpacity={0.75}
          >
            <View style={styles.toolLeft}>
              <View style={[styles.toolIconWrap, { backgroundColor: tokens.color.infoBg }]}>
                <ChatIcon size={16} color={tokens.color.accentSky} />
              </View>
              <View>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.toolLabel}>
                  Gezgin Sohbet & Mesajlaşma
                </Text>
                <Text
                  maxFontSizeMultiplier={tokens.font.maxScale.body}
                  style={{ fontSize: 10, color: tokens.color.textSubtle }}
                >
                  Birebir sohbet & rota paylaşımı
                </Text>
              </View>
            </View>
            <View style={styles.toolRight}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.toolChevron}>
                ›
              </Text>
            </View>
          </TouchableOpacity>

          {/* Profili Paylaş */}
          <TouchableOpacity
            style={styles.toolRow}
            onPress={handleShareProfile}
            activeOpacity={0.75}
          >
            <View style={styles.toolLeft}>
              <View style={[styles.toolIconWrap, { backgroundColor: tokens.color.surfaceTint }]}>
                <ExploreIcon size={16} color={tokens.dataPalette.violet} />
              </View>
              <View>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.toolLabel}>
                  Profilimi Paylaş
                </Text>
                <Text
                  maxFontSizeMultiplier={tokens.font.maxScale.body}
                  style={{ fontSize: 10, color: tokens.color.textSubtle }}
                >
                  Seyahat profilini arkadaşlarınla paylaş
                </Text>
              </View>
            </View>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.toolChevron}>
              ›
            </Text>
          </TouchableOpacity>

          {/* Çıkış Yap */}
          <TouchableOpacity
            style={[styles.toolRow, { borderBottomWidth: 0 }]}
            onPress={handleLogout}
            activeOpacity={0.75}
          >
            <View style={styles.toolLeft}>
              <View style={[styles.toolIconWrap, { backgroundColor: tokens.color.dangerBorder }]}>
                <LogoutIcon size={16} color={tokens.color.danger} />
              </View>
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={[styles.toolLabel, { color: tokens.color.danger, fontWeight: "700" }]}
              >
                Çıkış Yap
              </Text>
            </View>
            <Text
              maxFontSizeMultiplier={tokens.font.maxScale.body}
              style={[styles.toolChevron, { color: tokens.color.danger }]}
            >
              ›
            </Text>
          </TouchableOpacity>
        </View>

        {/* Subtle Footer Note */}
        <View style={styles.botanicalFooter}>
          <Text
            maxFontSizeMultiplier={tokens.font.maxScale.body}
            style={styles.botanicalFooterText}
          >
            MAPSBRIDGE BOTANICAL • v3.4.1
          </Text>
        </View>
      </ScrollView>

      {/* Paywall Modal */}
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onProUnlocked={() => {
          setPlanTier("pro");
          setShowPaywall(false);
        }}
      />

      {/* Rename Route Modal */}
      <ModalFrame
        visible={renamingRoute !== null}
        variant="dialog"
        animation="fade"
        onRequestClose={() => setRenamingRoute(null)}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          <View style={styles.modalHeaderRow}>
            <View>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalHeading}>
                Rotanın İsmini Düzenle
              </Text>
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={styles.modalSubheading}
              >
                Rotanız için yeni bir isim belirleyin
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseCircle}
              onPress={() => setRenamingRoute(null)}
            >
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={styles.modalCloseCircleText}
              >
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.modalRenameInput}
            value={renameRouteText}
            onChangeText={setRenameRouteText}
            placeholder="Örn: Hafta Sonu Ege Rotası"
            placeholderTextColor={tokens.color.neutral400}
            autoFocus
          />

          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <TouchableOpacity style={styles.renameCancelBtn} onPress={() => setRenamingRoute(null)}>
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={styles.renameCancelText}
              >
                Vazgeç
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.renameConfirmBtn}
              onPress={() => {
                if (renamingRoute && renameRouteText.trim()) {
                  tripStore.updateRouteName(renamingRoute.id, renameRouteText.trim());
                  setRenamingRoute(null);
                }
              }}
            >
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={styles.renameConfirmText}
              >
                İsmi Kaydet
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ModalFrame>

      {/* Edit Profile Modal */}
      <EditProfileModal
        visible={showEditModal}
        profile={profile}
        onClose={() => setShowEditModal(false)}
        onSaved={(updated) => setProfile(updated)}
      />

      {/* Edit Post Modal */}
      {editingPost && (
        <EditPostModal
          visible={!!editingPost}
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSaved={(savedPost) => {
            setMyPosts((prev) => prev.map((p) => (p.id === savedPost.id ? savedPost : p)));
          }}
          onDeleted={(deletedId) => {
            setMyPosts((prev) => prev.filter((p) => p.id !== deletedId));
          }}
        />
      )}
      <ScreenTourModal screen="profile" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.bg,
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: withAlpha(tokens.color.surfaceTint, 0.7),
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerLogoBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.color.brandHover,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: tokens.color.textBrand,
    letterSpacing: -0.3,
  },
  notificationBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tokens.color.surfaceTint,
    alignItems: "center",
    justifyContent: "center",
  },
  chatHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tokens.color.surfaceBrand,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderWidth: 1,
    borderColor: tokens.color.surfaceBrandStrong,
  },
  chatHeaderBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: tokens.color.accent,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: tokens.color.neutral0,
  },
  chatHeaderBadgeText: {
    color: tokens.color.onPrimary,
    fontSize: 9,
    fontWeight: "900",
  },
  chatActionBtn: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: tokens.color.surfaceBrand,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.color.surfaceBrandStrong,
  },
  chatActionBtnText: {
    color: tokens.color.textBrand,
    fontSize: 13,
    fontWeight: "800",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  profileCard: {
    backgroundColor: tokens.color.surface,
    borderRadius: 20,
    padding: 18,
    shadowColor: tokens.color.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
  },
  profileMainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarWrap: {
    position: "relative",
  },
  avatarRealImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: tokens.color.accentStrong,
  },
  avatarImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.color.surfaceBrand,
    borderWidth: 2,
    borderColor: tokens.color.accentStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  avatarEditPenBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tokens.color.successStrong,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: tokens.color.neutral0,
  },
  avatarCheckBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: tokens.color.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: tokens.color.neutral0,
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  userName: {
    fontSize: 18,
    fontWeight: "800",
    color: tokens.color.textBrand,
    letterSpacing: -0.3,
  },
  verifiedIcon: {
    fontSize: 13,
    color: tokens.color.accent,
    fontWeight: "900",
  },
  userHandle: {
    fontSize: 12,
    color: tokens.color.textSubtle,
    marginTop: 2,
  },
  userLocationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  userLocationText: {
    fontSize: 11,
    color: tokens.color.successStrong,
    fontWeight: "700",
  },
  userBioText: {
    fontSize: 13,
    color: tokens.color.neutral700,
    lineHeight: 18,
    marginTop: 12,
  },
  settingsCogBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.color.surfaceTint,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 14,
    marginVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: tokens.color.surfaceTint,
  },
  statCol: {
    alignItems: "center",
  },
  statNum: {
    fontSize: 16,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  statLabel: {
    fontSize: 11,
    color: tokens.color.textSubtle,
    fontWeight: "600",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: tokens.color.surfaceTint,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  editProfileBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: tokens.color.surfaceTint,
    paddingVertical: 11,
    borderRadius: 999,
  },
  editProfileBtnText: {
    color: tokens.color.textBrand,
    fontSize: 13,
    fontWeight: "700",
  },
  shareProfileBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: tokens.color.primary,
    paddingVertical: 11,
    borderRadius: 999,
    shadowColor: tokens.color.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  shareProfileBtnText: {
    color: tokens.color.onPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  sectionHeadingLink: {
    fontSize: 12,
    fontWeight: "700",
    color: tokens.color.link,
  },
  routesGroup: {
    gap: 10,
    marginBottom: 20,
  },
  routeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: tokens.color.surface,
    borderRadius: 16,
    padding: 12,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  routeThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  routeDetails: {
    flex: 1,
  },
  routeBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 2,
  },
  statusLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.color.accent,
  },
  routeBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: tokens.color.link,
    letterSpacing: 0.4,
  },
  routeBadgeTextAlt: {
    fontSize: 10,
    fontWeight: "700",
    color: tokens.color.textSubtle,
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  routeTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  routeSub: {
    fontSize: 11,
    color: tokens.color.textSubtle,
    marginTop: 2,
  },
  chevronIcon: {
    fontSize: 22,
    color: tokens.color.neutral300,
    paddingRight: 4,
  },
  toolsCard: {
    backgroundColor: tokens.color.surface,
    borderRadius: 20,
    padding: 16,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  toolsCardHeading: {
    fontSize: 15,
    fontWeight: "800",
    color: tokens.color.textBrand,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.surfaceTint,
  },
  toolLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toolIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  toolLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.color.text,
  },
  toolRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  newBadge: {
    backgroundColor: tokens.color.surfaceBrand,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  newBadgeText: {
    color: tokens.color.onSurfaceBrand,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  toolChevron: {
    fontSize: 20,
    color: tokens.color.neutral300,
  },
  botanicalFooter: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    opacity: 0.6,
  },
  botanicalFooterText: {
    fontSize: 10,
    fontWeight: "800",
    color: tokens.color.textBrand,
    letterSpacing: 0.8,
  },
  postCountBadge: {
    backgroundColor: tokens.color.surfaceBrand,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.color.successBorder,
  },
  postCountBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: tokens.color.onSurfaceBrand,
  },
  myPostsGroup: {
    gap: 12,
    marginBottom: 22,
  },
  emptyPostsCard: {
    backgroundColor: tokens.color.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyPostsTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: tokens.color.textBrand,
    marginTop: 6,
  },
  emptyPostsSub: {
    fontSize: 12,
    color: tokens.color.textSubtle,
    textAlign: "center",
    lineHeight: 18,
  },
  myPostCard: {
    backgroundColor: tokens.color.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  myPostHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  myPostTime: {
    fontSize: 11,
    color: tokens.color.neutral400,
    fontWeight: "600",
  },
  myPostLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  myPostLocationText: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.color.successStrong,
  },
  myPostActionBtns: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  postEditSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: tokens.color.surfaceTint,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  postEditSmallText: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.color.textBrand,
  },
  postDeleteSmallBtn: {
    backgroundColor: tokens.color.dangerBg,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  myPostContent: {
    fontSize: 13,
    color: tokens.color.neutral800,
    lineHeight: 20,
    marginBottom: 8,
  },
  myPostHashtags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  myPostTag: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.color.accent,
    backgroundColor: tokens.color.surfaceBrand,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  myPostStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.color.neutral100,
  },
  myPostStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  myPostStatText: {
    fontSize: 11,
    fontWeight: "600",
    color: tokens.color.textSubtle,
  },
  // Empty Routes Card
  emptyRoutesCard: {
    backgroundColor: tokens.color.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: tokens.color.surfaceTint,
    marginVertical: 4,
  },
  emptyRoutesTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: tokens.color.neutral800,
    marginTop: 10,
  },
  emptyRoutesSub: {
    fontSize: 12,
    color: tokens.color.textSubtle,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  createRouteBtn: {
    backgroundColor: tokens.color.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  createRouteBtnText: {
    color: tokens.color.onPrimary,
    fontSize: 12.5,
    fontWeight: "700",
  },
  // Route Action Buttons
  routeActionButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 8,
  },
  routeEditBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: tokens.color.surfaceBrand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tokens.color.surfaceBrandStrong,
  },
  routeDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: tokens.color.dangerBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tokens.color.dangerBorder,
  },
  // Rename Route Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: withAlpha(tokens.color.black, 0.5),
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: tokens.color.surface,
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalHeading: {
    fontSize: 17,
    fontWeight: "800",
    color: tokens.color.text,
  },
  modalSubheading: {
    fontSize: 12,
    color: tokens.color.textSubtle,
    marginTop: 2,
  },
  modalCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.color.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseCircleText: {
    fontSize: 14,
    color: tokens.color.textSubtle,
    fontWeight: "700",
  },
  modalRenameInput: {
    backgroundColor: tokens.color.bg,
    borderWidth: 1,
    borderColor: tokens.color.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: tokens.color.text,
  },
  renameCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: tokens.color.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  renameCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: tokens.color.textSubtle,
  },
  renameConfirmBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 12,
    backgroundColor: tokens.color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  renameConfirmText: {
    fontSize: 13,
    fontWeight: "800",
    color: tokens.color.onPrimary,
  },
});
