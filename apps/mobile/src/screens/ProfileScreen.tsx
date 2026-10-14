import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  Share,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import {
  ExploreIcon,
  ArrowRightIcon,
  ChatIcon,
  BellIcon,
  SettingsIcon,
  EditIcon,
  BalloonIcon,
  MountainIcon,
  MonumentIcon,
  BookmarkIcon,
  SparkIcon,
  MapIcon,
  ShieldIcon,
  LogoutIcon,
  TrashIcon,
  TagIcon,
  MapPinIcon,
  HeartIcon,
} from '../components/Icons';
import { authService, UserSession } from '../services/api';
import { socialSyncService, MobileUserProfile, MobileCommunityPost } from '../services/socialSync';
import { tripStore, ActiveRoute, TripStop } from '../services/tripStore';
import { EditProfileModal } from '../components/EditProfileModal';
import { EditPostModal } from '../components/EditPostModal';
import { ChatScreen } from './ChatScreen';
import { ScreenTourModal } from '../components/ScreenTourModal';

interface ProfileScreenProps {
  onShowWelcome: () => void;
  onOpenMap: () => void;
  onOpenMessages?: () => void;
  onOpenPlan?: () => void;
}

export function ProfileScreen({
  onShowWelcome,
  onOpenMap,
  onOpenMessages,
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
  const [renameRouteText, setRenameRouteText] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      const currentSession = await authService.getSession();
      setSession(currentSession);

      const userProf = await socialSyncService.getUserProfile();
      setProfile(userProf);

      const allPosts = await socialSyncService.getPosts();
      const filtered = allPosts.filter(
        (p) =>
          p.authorHandle === `@${userProf.username}` ||
          p.authorName === userProf.fullName ||
          (userProf.email && p.authorEmail === userProf.email)
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
            (updated.email && p.authorEmail === updated.email)
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
          (currentProfile.email && p.authorEmail === currentProfile.email)
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

  const displayName = profile?.fullName || session?.name || session?.email?.split('@')[0] || 'Canberk Yılmaz';
  const userHandle = profile
    ? `@${profile.username} • ${profile.travelTitle}`
    : session?.email
    ? `@${session.email.split('@')[0]} • Doğa & Rota Kaşifi`
    : '@canberk • Doğa & Rota Kaşifi';

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `${displayName} MapsBridge Seyahat Profili: Rotalarımı ve seyahat keşiflerimi incele! https://mapsbridge.com`,
        title: `${displayName} - MapsBridge Kaşif Profili`,
      });
    } catch {}
  };

  const handleLogout = () => {
    Alert.alert(
      'Çıkış Yap',
      'MapsBridge hesabınızdan çıkış yapmak istediğinize emin misiniz?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: async () => {
            await authService.signOut();
            onShowWelcome();
          },
        },
      ]
    );
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf8ff" />

      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerLogoBadge}>
            <ExploreIcon size={18} color="#34D399" />
          </View>
          <Text style={styles.headerTitle}>Profil</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            style={styles.chatHeaderBtn}
            onPress={() => setShowChatScreen(true)}
            activeOpacity={0.8}
          >
            <ChatIcon size={18} color="#013628" />
            <View style={styles.chatHeaderBadge}>
              <Text style={styles.chatHeaderBadgeText}>1</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.notificationBtn}
            onPress={() => Alert.alert('Bildirimler', 'Yeni seyahat ve rota bildiriminiz bulunmuyor.')}
            activeOpacity={0.8}
          >
            <BellIcon size={18} color="#013628" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
                  <Text style={styles.avatarText}>
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.avatarEditPenBadge}>
                <EditIcon size={10} color="#ffffff" />
              </View>
            </TouchableOpacity>

            {/* User Info */}
            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
                <Text style={styles.verifiedIcon}>✓</Text>
              </View>
              <Text style={styles.userHandle} numberOfLines={1}>{userHandle}</Text>

              {/* Location Badge */}
              <View style={styles.userLocationBadge}>
                <MapPinIcon size={11} color="#059669" />
                <Text style={styles.userLocationText} numberOfLines={1}>
                  {profile?.location || 'İstanbul, Türkiye'}
                </Text>
              </View>
            </View>

            {/* Settings Cog */}
            <TouchableOpacity
              style={styles.settingsCogBtn}
              onPress={() => Alert.alert('Ayarlar', 'Uygulama sürümü: v3.4.1 (Botanical)\nBildirimler ve konum izinleri aktif.')}
              activeOpacity={0.8}
            >
              <SettingsIcon size={18} color="#013628" />
            </TouchableOpacity>
          </View>

          {/* User Bio */}
          <Text style={styles.userBioText}>
            {profile?.bio || 'Doğa yürüyüşleri, gizli kanyonlar ve vadiler keşfetmeyi seviyorum 🌄 | MapsBridge Rota Kaşifi'}
          </Text>

          {/* Minimal Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{allRoutes.length}</Text>
              <Text style={styles.statLabel}>Rotalar</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNum}>
                {allRoutes.reduce((acc, r) => acc + (r.stops?.length || 0), 0) + savedPool.length}
              </Text>
              <Text style={styles.statLabel}>Duraklar</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{myPosts.length}</Text>
              <Text style={styles.statLabel}>Paylaşım</Text>
            </View>
          </View>

          {/* Clean Action Buttons */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.chatActionBtn}
              onPress={() => setShowChatScreen(true)}
              activeOpacity={0.85}
            >
              <ChatIcon size={15} color="#ffffff" />
              <Text style={styles.chatActionBtnText}>Mesajlaş</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.editProfileBtn}
              onPress={() => setShowEditModal(true)}
              activeOpacity={0.85}
            >
              <EditIcon size={15} color="#013628" />
              <Text style={styles.editProfileBtnText}>Düzenle</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shareProfileBtn}
              onPress={handleShareProfile}
              activeOpacity={0.85}
            >
              <ExploreIcon size={15} color="#013628" />
              <Text style={styles.shareProfileBtnText}>Paylaş</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* My Community Posts (Paylaşımlarım) Section */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.sectionHeading}>Paylaşımlarım</Text>
            <View style={styles.postCountBadge}>
              <Text style={styles.postCountBadgeText}>{myPosts.length}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowChatScreen(false)}>
            <Text style={styles.sectionHeadingLink}>Topluluk Akışı →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.myPostsGroup}>
          {myPosts.length === 0 ? (
            <View style={styles.emptyPostsCard}>
              <ChatIcon size={24} color="#717974" />
              <Text style={styles.emptyPostsTitle}>Henüz paylaşımınız yok</Text>
              <Text style={styles.emptyPostsSub}>
                Keşif sekmesinden ilk seyahat hikayenizi veya rotanızı paylaşabilirsiniz.
              </Text>
            </View>
          ) : (
            myPosts.map((post) => (
              <View key={post.id} style={styles.myPostCard}>
                <View style={styles.myPostHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.myPostTime}>{post.timeAgo}</Text>
                    {post.locationTag && (
                      <View style={styles.myPostLocationRow}>
                        <MapPinIcon size={12} color="#10B981" />
                        <Text style={styles.myPostLocationText}>{post.locationTag}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.myPostActionBtns}>
                    <TouchableOpacity
                      style={styles.postEditSmallBtn}
                      onPress={() => setEditingPost(post)}
                      activeOpacity={0.7}
                    >
                      <EditIcon size={13} color="#013628" />
                      <Text style={styles.postEditSmallText}>Düzenle</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.postDeleteSmallBtn}
                      onPress={async () => {
                        Alert.alert('Gönderiyi Sil', 'Bu paylaşım silinsin mi?', [
                          { text: 'Vazgeç', style: 'cancel' },
                          {
                            text: 'Sil',
                            style: 'destructive',
                            onPress: async () => {
                              await socialSyncService.deletePost(post.id);
                              setMyPosts((prev) => prev.filter((p) => p.id !== post.id));
                            },
                          },
                        ]);
                      }}
                      activeOpacity={0.7}
                    >
                      <TrashIcon size={13} color="#ba1a1a" />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.myPostContent}>{post.content}</Text>

                {post.hashtags && post.hashtags.length > 0 && (
                  <View style={styles.myPostHashtags}>
                    {post.hashtags.map((h, i) => (
                      <Text key={i} style={styles.myPostTag}>{h}</Text>
                    ))}
                  </View>
                )}

                <View style={styles.myPostStatsRow}>
                  <View style={styles.myPostStatItem}>
                    <HeartIcon size={13} color="#ef4444" fill={post.isLiked ? '#ef4444' : 'none'} />
                    <Text style={styles.myPostStatText}>{post.likesCount} Beğeni</Text>
                  </View>
                  <View style={styles.myPostStatItem}>
                    <ChatIcon size={13} color="#10B981" />
                    <Text style={styles.myPostStatText}>{post.commentsCount || 0} Yorum</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Saved Routes Section: Gerçek Kayıtlı Plan Rotaları */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.sectionHeading}>Kayıtlı Rotalarım</Text>
            <View style={styles.postCountBadge}>
              <Text style={styles.postCountBadgeText}>{allRoutes.length}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => (onOpenPlan ? onOpenPlan() : onOpenMap())}>
            <Text style={styles.sectionHeadingLink}>Plan Masasında Gör →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.routesGroup}>
          {allRoutes.length === 0 ? (
            <View style={styles.emptyRoutesCard}>
              <BookmarkIcon size={24} color="#717974" />
              <Text style={styles.emptyRoutesTitle}>Henüz kayıtlı bir rotanız yok</Text>
              <Text style={styles.emptyRoutesSub}>
                Planım sekmesinden dilediğiniz gibi durak seçip gezi rotanızı oluşturabilirsiniz.
              </Text>
              <TouchableOpacity
                style={styles.createRouteBtn}
                onPress={() => {
                  tripStore.createRoute('Yeni Keşif Rotam');
                  if (onOpenPlan) onOpenPlan(); else onOpenMap();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.createRouteBtnText}>+ Yeni Rota Oluştur</Text>
              </TouchableOpacity>
            </View>
          ) : (
            allRoutes.map((r, index) => {
              const isActive = r.id === activeRoute.id;
              const bgColors = ['#1e4d3e', '#05513d', '#013628', '#0d9488'];
              const bgColor = bgColors[index % bgColors.length];

              return (
                <View key={r.id} style={styles.routeCard}>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => {
                      tripStore.switchActiveRoute(r.id);
                      if (onOpenPlan) onOpenPlan(); else onOpenMap();
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.routeThumb, { backgroundColor: bgColor }]}>
                      {index % 3 === 0 ? (
                        <BalloonIcon size={22} color="#ffffff" />
                      ) : index % 3 === 1 ? (
                        <MountainIcon size={22} color="#ffffff" />
                      ) : (
                        <MonumentIcon size={22} color="#ffffff" />
                      )}
                    </View>
                    <View style={styles.routeDetails}>
                      <View style={styles.routeBadgeRow}>
                        {isActive && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 6 }}>
                            <View style={styles.statusLiveDot} />
                            <Text style={styles.routeBadgeText}>AKTİF PLANDA</Text>
                          </View>
                        )}
                        <Text style={styles.routeSub}>{r.stops.length} Durak</Text>
                      </View>
                      <Text style={styles.routeTitle} numberOfLines={1}>{r.name}</Text>
                      <Text style={styles.routeSub} numberOfLines={1}>
                        {r.stops.length > 0 ? r.stops.map((s) => s.name).slice(0, 2).join(' • ') : 'Henüz durak eklenmedi'}
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
                      <EditIcon size={14} color="#059669" />
                    </TouchableOpacity>

                    {allRoutes.length > 1 && (
                      <TouchableOpacity
                        style={styles.routeDeleteBtn}
                        onPress={() => {
                          Alert.alert('Rotayı Sil', `"${r.name}" rotasını silmek istediğinize emin misiniz?`, [
                            { text: 'Vazgeç', style: 'cancel' },
                            {
                              text: 'Sil',
                              style: 'destructive',
                              onPress: () => {
                                tripStore.deleteRoute(r.id);
                              },
                            },
                          ]);
                        }}
                        activeOpacity={0.7}
                        accessibilityLabel="Rotayı Sil"
                      >
                        <TrashIcon size={14} color="#ba1a1a" />
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
          <Text style={styles.toolsCardHeading}>Hesap & Araçlar</Text>

          {/* Seyahat Masam & Rota Planım */}
          <TouchableOpacity
            style={styles.toolRow}
            onPress={() => (onOpenPlan ? onOpenPlan() : onOpenMap())}
            activeOpacity={0.75}
          >
            <View style={styles.toolLeft}>
              <View style={[styles.toolIconWrap, { backgroundColor: '#dcfce7' }]}>
                <BookmarkIcon size={16} color="#05513d" />
              </View>
              <View>
                <Text style={styles.toolLabel}>Seyahat Masam & Rota Planım</Text>
                <Text style={{ fontSize: 10, color: '#717974' }}>
                  {allRoutes.length} kayıtlı rota • {activeRoute.stops.length} aktif durak
                </Text>
              </View>
            </View>
            <View style={styles.toolRight}>
              <View style={[styles.newBadge, { backgroundColor: '#10B981' }]}>
                <Text style={[styles.newBadgeText, { color: '#ffffff' }]}>AÇ</Text>
              </View>
              <Text style={styles.toolChevron}>›</Text>
            </View>
          </TouchableOpacity>

          {/* Kayıtlı Durak Havuzum */}
          <TouchableOpacity
            style={styles.toolRow}
            onPress={() => (onOpenPlan ? onOpenPlan() : onOpenMap())}
            activeOpacity={0.75}
          >
            <View style={styles.toolLeft}>
              <View style={[styles.toolIconWrap, { backgroundColor: '#abedd3' }]}>
                <MapPinIcon size={16} color="#05513d" />
              </View>
              <View>
                <Text style={styles.toolLabel}>Kayıtlı Durak Havuzum</Text>
                <Text style={{ fontSize: 10, color: '#717974' }}>
                  {savedPool.length} adet durak kaydedildi
                </Text>
              </View>
            </View>
            <View style={styles.toolRight}>
              <Text style={styles.toolChevron}>›</Text>
            </View>
          </TouchableOpacity>

          {/* Gezgin Sohbet & Mesajlaşma */}
          <TouchableOpacity
            style={styles.toolRow}
            onPress={() => setShowChatScreen(true)}
            activeOpacity={0.75}
          >
            <View style={styles.toolLeft}>
              <View style={[styles.toolIconWrap, { backgroundColor: '#e0f2fe' }]}>
                <ChatIcon size={16} color="#0284c7" />
              </View>
              <View>
                <Text style={styles.toolLabel}>Gezgin Sohbet & Mesajlaşma</Text>
                <Text style={{ fontSize: 10, color: '#717974' }}>Birebir sohbet & rota paylaşımı</Text>
              </View>
            </View>
            <View style={styles.toolRight}>
              <Text style={styles.toolChevron}>›</Text>
            </View>
          </TouchableOpacity>

          {/* Profili Paylaş */}
          <TouchableOpacity
            style={styles.toolRow}
            onPress={handleShareProfile}
            activeOpacity={0.75}
          >
            <View style={styles.toolLeft}>
              <View style={[styles.toolIconWrap, { backgroundColor: '#f3e8ff' }]}>
                <ExploreIcon size={16} color="#7c3aed" />
              </View>
              <View>
                <Text style={styles.toolLabel}>Profilimi Paylaş</Text>
                <Text style={{ fontSize: 10, color: '#717974' }}>Seyahat profilini arkadaşlarınla paylaş</Text>
              </View>
            </View>
            <Text style={styles.toolChevron}>›</Text>
          </TouchableOpacity>

          {/* Çıkış Yap */}
          <TouchableOpacity
            style={[styles.toolRow, { borderBottomWidth: 0 }]}
            onPress={handleLogout}
            activeOpacity={0.75}
          >
            <View style={styles.toolLeft}>
              <View style={[styles.toolIconWrap, { backgroundColor: '#ffdad6' }]}>
                <LogoutIcon size={16} color="#ba1a1a" />
              </View>
              <Text style={[styles.toolLabel, { color: '#ba1a1a', fontWeight: '700' }]}>
                Çıkış Yap
              </Text>
            </View>
            <Text style={[styles.toolChevron, { color: '#ba1a1a' }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Subtle Footer Note */}
        <View style={styles.botanicalFooter}>
          <Text style={styles.botanicalFooterText}>
            MAPSBRIDGE BOTANICAL • v3.4.1
          </Text>
        </View>
      </ScrollView>

      {/* Rename Route Modal */}
      <Modal visible={renamingRoute !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeading}>Rotanın İsmini Düzenle</Text>
                <Text style={styles.modalSubheading}>Rotanız için yeni bir isim belirleyin</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseCircle}
                onPress={() => setRenamingRoute(null)}
              >
                <Text style={styles.modalCloseCircleText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalRenameInput}
              value={renameRouteText}
              onChangeText={setRenameRouteText}
              placeholder="Örn: Hafta Sonu Ege Rotası"
              placeholderTextColor="#94a3b8"
              autoFocus
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={styles.renameCancelBtn}
                onPress={() => setRenamingRoute(null)}
              >
                <Text style={styles.renameCancelText}>Vazgeç</Text>
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
                <Text style={styles.renameConfirmText}>İsmi Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf8ff',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(234, 237, 255, 0.7)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogoBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e4d3e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#013628',
    letterSpacing: -0.3,
  },
  notificationBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f2f3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#bbedd8',
  },
  chatHeaderBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#10B981',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  chatHeaderBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  chatActionBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bbedd8',
  },
  chatActionBtnText: {
    color: '#013628',
    fontSize: 13,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#013628',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
  },
  profileMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarRealImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#34D399',
  },
  avatarImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: '#34D399',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#013628',
  },
  avatarEditPenBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  avatarCheckBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#013628',
    letterSpacing: -0.3,
  },
  verifiedIcon: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '900',
  },
  userHandle: {
    fontSize: 12,
    color: '#717974',
    marginTop: 2,
  },
  userLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  userLocationText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '700',
  },
  userBioText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginTop: 12,
  },
  settingsCogBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f2f3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 14,
    marginVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eaedff',
  },
  statCol: {
    alignItems: 'center',
  },
  statNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#013628',
  },
  statLabel: {
    fontSize: 11,
    color: '#717974',
    fontWeight: '600',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#eaedff',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  editProfileBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f2f3ff',
    paddingVertical: 11,
    borderRadius: 999,
  },
  editProfileBtnText: {
    color: '#013628',
    fontSize: 13,
    fontWeight: '700',
  },
  shareProfileBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#013628',
    paddingVertical: 11,
    borderRadius: 999,
    shadowColor: '#013628',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  shareProfileBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#013628',
  },
  sectionHeadingLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#286954',
  },
  routesGroup: {
    gap: 10,
    marginBottom: 20,
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  routeThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeDetails: {
    flex: 1,
  },
  routeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  statusLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  routeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#286954',
    letterSpacing: 0.4,
  },
  routeBadgeTextAlt: {
    fontSize: 10,
    fontWeight: '700',
    color: '#717974',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  routeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#013628',
  },
  routeSub: {
    fontSize: 11,
    color: '#717974',
    marginTop: 2,
  },
  chevronIcon: {
    fontSize: 22,
    color: '#c0c8c3',
    paddingRight: 4,
  },
  toolsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  toolsCardHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#013628',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f3ff',
  },
  toolLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toolIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#131b2e',
  },
  toolRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  newBadgeText: {
    color: '#005035',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  toolChevron: {
    fontSize: 20,
    color: '#c0c8c3',
  },
  botanicalFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    opacity: 0.6,
  },
  botanicalFooterText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#013628',
    letterSpacing: 0.8,
  },
  postCountBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  postCountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065f46',
  },
  myPostsGroup: {
    gap: 12,
    marginBottom: 22,
  },
  emptyPostsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyPostsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#013628',
    marginTop: 6,
  },
  emptyPostsSub: {
    fontSize: 12,
    color: '#717974',
    textAlign: 'center',
    lineHeight: 18,
  },
  myPostCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  myPostHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  myPostTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  myPostLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  myPostLocationText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  myPostActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postEditSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f2f3ff',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  postEditSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#013628',
  },
  postDeleteSmallBtn: {
    backgroundColor: '#fee2e2',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myPostContent: {
    fontSize: 13,
    color: '#1e293b',
    lineHeight: 20,
    marginBottom: 8,
  },
  myPostHashtags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  myPostTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  myPostStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  myPostStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  myPostStatText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  // Empty Routes Card
  emptyRoutesCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e7ff',
    marginVertical: 4,
  },
  emptyRoutesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 10,
  },
  emptyRoutesSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  createRouteBtn: {
    backgroundColor: '#013628',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  createRouteBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  // Route Action Buttons
  routeActionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  routeEditBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bbedd8',
  },
  routeDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  // Rename Route Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubheading: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  modalCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseCircleText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '700',
  },
  modalRenameInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  renameCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  renameCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  renameConfirmBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#013628',
    alignItems: 'center',
    justifyContent: 'center',
  },
  renameConfirmText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
});
