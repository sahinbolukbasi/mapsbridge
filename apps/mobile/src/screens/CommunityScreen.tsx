import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Image,
  Alert,
  Share,
  Modal,
} from "react-native";
import { tripStore, TripStop } from "../services/tripStore";
import { PublicProfileView, PublicProfileUser } from "./PublicProfileView";
import { ChatScreen } from "./ChatScreen";
import { chatStore, ChatContact } from "../services/chatStore";
import { socialSyncService, MobileCommunityPost, MobileCommunityComment } from "../services/socialSync";
import { EditPostModal } from "../components/EditPostModal";
import {
  HeartIcon,
  ChatIcon,
  BookmarkIcon,
  SendIcon,
  MapPinIcon,
  TagIcon,
  ExploreIcon,
  EditIcon,
  MapIcon,
} from "../components/Icons";
import { ScreenTourModal } from "../components/ScreenTourModal";

interface CommunityScreenProps {
  onOpenMap: () => void;
  onOpenProfile?: () => void;
}

interface CommunityComment {
  id: string;
  user: string;
  text: string;
  time: string;
}

const CATEGORIES = [
  { id: "Tümü", label: "Tümü", icon: "" },
  { id: "Tarih & Kültür", label: "Tarih & Kültür", icon: "🏛️" },
  { id: "Gastronomi", label: "Gastronomi", icon: "🍽️" },
  { id: "Doğa & Vadi", label: "Doğa & Vadi", icon: "🌲" },
];

export function CommunityScreen({ onOpenMap }: CommunityScreenProps) {
  const [activeTab, setActiveTab] = useState<"foryou" | "following">("foryou");
  const [selectedCat, setSelectedCat] = useState("Tümü");
  const [posts, setPosts] = useState<MobileCommunityPost[]>([]);
  const [selectedProfileUser, setSelectedProfileUser] = useState<PublicProfileUser | null>(null);
  const [editingPost, setEditingPost] = useState<MobileCommunityPost | null>(null);

  useEffect(() => {
    socialSyncService.getPosts().then((loaded) => {
      if (loaded && loaded.length > 0) setPosts(loaded);
    });
    const unsub = socialSyncService.subscribePosts((updated) => {
      setPosts(updated);
    });
    return () => unsub();
  }, []);

  // Chat Navigation State
  const [showChatScreen, setShowChatScreen] = useState(false);
  const [chatInitialContact, setChatInitialContact] = useState<ChatContact | null>(null);

  // New Post Modal State
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostLocation, setNewPostLocation] = useState("");
  const [newPostHashtags, setNewPostHashtags] = useState("");

  // Comment Modal State
  const [activeCommentPost, setActiveCommentPost] = useState<MobileCommunityPost | null>(null);
  const [newCommentText, setNewCommentText] = useState("");

  // Like Toggle
  const handleToggleLike = async (postId: string) => {
    await socialSyncService.toggleLike(postId);
  };

  // Bookmark Toggle
  const handleToggleBookmark = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const willBookmark = !p.isBookmarked;
        return {
          ...p,
          isBookmarked: willBookmark,
          bookmarksCount: willBookmark ? p.bookmarksCount + 1 : p.bookmarksCount - 1,
        };
      }),
    );
  };

  // Retweet / Share
  const handleRetweet = (post: MobileCommunityPost) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, retweetsCount: p.retweetsCount + 1 } : p)),
    );
    Alert.alert(
      "🔁 Rota Paylaşıldı",
      `"${post.authorName}" adlı gezginin paylaşımı profilinizde yeniden yayınlandı.`,
    );
  };

  // External Share
  const handleShare = async (post: MobileCommunityPost) => {
    try {
      await Share.share({
        message: `${post.authorName} MapsBridge'de paylaştı:\n"${post.content}"\nhttps://mapsbridge.com`,
        title: post.authorName,
      });
    } catch {}
  };

  // Clone Route to Active Trip
  const handleCloneRoute = (post: MobileCommunityPost) => {
    if (!post.routeAttachment) return;
    const attachment = post.routeAttachment;
    attachment.stops.forEach((s) => tripStore.addStop(s as unknown as TripStop));
    Alert.alert(
      "🗺️ Rota Haritanıza Eklendi",
      `"${attachment.title}" rotasındaki ${attachment.stops.length} durak seyahat planınıza aktarıldı. Şimdi haritada inceleyebilirsiniz!`,
      [{ text: "Tamam" }, { text: "Haritada Gör ➔", onPress: onOpenMap, style: "default" }],
    );
  };

  // Add Comment
  const handleAddComment = async () => {
    if (!activeCommentPost || !newCommentText.trim()) return;
    const newComment: CommunityComment = {
      id: "c_" + Date.now(),
      user: "@gezgin",
      text: newCommentText.trim(),
      time: "Az önce",
    };

    if (activeCommentPost?.id) {
      await socialSyncService.addComment(activeCommentPost.id, newCommentText.trim());
    }

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== activeCommentPost.id) return p;
        const updatedComments = [...(p.comments || []), newComment];
        return {
          ...p,
          comments: updatedComments,
          commentsCount: p.commentsCount + 1,
        };
      }),
    );

    setActiveCommentPost((prev) =>
      prev
        ? {
            ...prev,
            comments: [...(prev.comments || []), newComment],
            commentsCount: prev.commentsCount + 1,
          }
        : null,
    );

    setNewCommentText("");
  };

  // Post Options Menu with Authorization Check
  const handlePostOptions = async (post: MobileCommunityPost) => {
    const userProf = await socialSyncService.getUserProfile();
    const isOwner =
      post.authorHandle === `@${userProf.username}` ||
      post.authorName === userProf.fullName ||
      (userProf.email && post.authorEmail === userProf.email) ||
      post.authorHandle === "@canberk" ||
      post.authorHandle === "@gezgin";

    if (isOwner) {
      Alert.alert("Paylaşım Seçenekleri", `"${post.authorName}" (@${post.authorHandle})`, [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Gönderiyi Düzenle",
          onPress: () => setEditingPost(post),
        },
        {
          text: "Paylaşımı Sil",
          style: "destructive",
          onPress: () => {
            Alert.alert("Silme Onayı", "Bu gönderiyi silmek istediğinize emin misiniz?", [
              { text: "Vazgeç", style: "cancel" },
              {
                text: "Sil",
                style: "destructive",
                onPress: async () => {
                  await socialSyncService.deletePost(post.id);
                  setPosts((prev) => prev.filter((p) => p.id !== post.id));
                },
              },
            ]);
          },
        },
      ]);
    } else {
      Alert.alert("Paylaşım Seçenekleri", `"${post.authorName}" (@${post.authorHandle})`, [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Mesaj Gönder ✉️",
          onPress: async () => {
            const { contact } = await chatStore.startOrGetDirectThread({
              name: post.authorName,
              handle: post.authorHandle,
              avatar: post.authorAvatar,
              location: post.locationTag,
            });
            setChatInitialContact(contact);
            setShowChatScreen(true);
          },
        },
        {
          text: "Paylaşımı Bildir",
          onPress: () =>
            Alert.alert("Bildirildi", "Bu seyahat paylaşımı moderasyon ekibine iletildi."),
        },
        {
          text: "Gezgini Sessize Al",
          onPress: () =>
            Alert.alert(
              "Sessize Alındı",
              `${post.authorName} kullanıcısının paylaşımları gizlendi.`,
            ),
        },
      ]);
    }
  };

  // Publish New Post
  const handleCreatePost = async () => {
    if (!newPostContent.trim()) {
      Alert.alert("Eksik Bilgi", "Lütfen paylaşım metninizi girin.");
      return;
    }

    const tagsArray = newPostHashtags
      .split(" ")
      .map((t) => (t.startsWith("#") ? t : `#${t}`))
      .filter((t) => t.length > 1);

    const activeStops = tripStore.getActiveRoute().stops;

    await socialSyncService.createPost({
      content: newPostContent.trim(),
      hashtags: tagsArray.length > 0 ? tagsArray : ["#MapsBridge", "#Seyahat"],
      locationTag: newPostLocation.trim() || undefined,
      routeAttachment:
        activeStops.length > 0
          ? {
              id: "rt_user_" + Date.now(),
              title: tripStore.getActiveRoute().name || "Benim Rotam",
              stats: `${activeStops.length} Durak • Canlı Rota`,
              icon: "🗺️",
              stops: activeStops as TripStop[],
            }
          : undefined,
    });

    setNewPostContent("");
    setNewPostLocation("");
    setNewPostHashtags("");
    setShowNewPostModal(false);
    Alert.alert("Paylaşıldı", "Seyahat gönderiniz topluluk akışında yayınlandı!");
  };

  if (showChatScreen) {
    return (
      <ChatScreen
        initialContact={chatInitialContact || undefined}
        onGoBack={() => {
          setShowChatScreen(false);
          setChatInitialContact(null);
        }}
        onOpenMap={() => {
          setShowChatScreen(false);
          setChatInitialContact(null);
          onOpenMap();
        }}
      />
    );
  }

  if (selectedProfileUser) {
    return (
      <PublicProfileView
        user={selectedProfileUser}
        onBack={() => setSelectedProfileUser(null)}
        onOpenMap={onOpenMap}
        onOpenChat={async (targetUser) => {
          const { contact } = await chatStore.startOrGetDirectThread({
            name: targetUser.name,
            handle: targetUser.handle,
            avatar: targetUser.avatar,
            badge: targetUser.badge,
            location: targetUser.location,
          });
          setSelectedProfileUser(null);
          setChatInitialContact(contact);
          setShowChatScreen(true);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf8ff" />

      {/* Top Header Bar with Messages Quick Access */}
      <View style={styles.topHeaderBar}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerLogoBadge}>
            <ExploreIcon size={18} color="#059669" />
          </View>
          <Text style={styles.headerTitle}>Keşfet</Text>
        </View>

        <TouchableOpacity
          style={styles.chatHeaderBtn}
          onPress={() => {
            setChatInitialContact(null);
            setShowChatScreen(true);
          }}
          activeOpacity={0.8}
        >
          <ChatIcon size={18} color="#065f46" />
        </TouchableOpacity>
      </View>

      {/* X/Twitter Style Timeline Tabs: Sana Özel & Takip Edilenler */}
      <View style={styles.timelineTabsBar}>
        <TouchableOpacity
          style={styles.timelineTab}
          onPress={() => setActiveTab("foryou")}
          activeOpacity={0.8}
        >
          <Text
            style={[styles.timelineTabText, activeTab === "foryou" && styles.timelineTabTextActive]}
          >
            Sana Özel
          </Text>
          {activeTab === "foryou" && <View style={styles.activeTabIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.timelineTab}
          onPress={() => setActiveTab("following")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.timelineTabText,
              activeTab === "following" && styles.timelineTabTextActive,
            ]}
          >
            Takip Edilenler
          </Text>
          {activeTab === "following" && <View style={styles.activeTabIndicator} />}
        </TouchableOpacity>
      </View>

      {/* Discovery / Filter Pills */}
      <View style={styles.filterPillsRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsScroll}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.filterChip, selectedCat === cat.id && styles.filterChipActive]}
              onPress={() => setSelectedCat(cat.id)}
            >
              {cat.icon ? <Text style={{ fontSize: 13, marginRight: 4 }}>{cat.icon}</Text> : null}
              <Text
                style={[
                  styles.filterChipText,
                  selectedCat === cat.id && styles.filterChipTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Feed Stream */}
      <ScrollView
        contentContainerStyle={styles.feedScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {posts.length === 0 ? (
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 60,
              paddingHorizontal: 24,
            }}
          >
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: "#e1f7ec",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <ExploreIcon size={28} color="#059669" />
            </View>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#1e293b", marginBottom: 6 }}>
              Henüz paylaşım bulunmuyor
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: "#64748b",
                textAlign: "center",
                lineHeight: 18,
                marginBottom: 20,
              }}
            >
              {activeTab === "following"
                ? "Henüz takip ettiğiniz gezginlerin paylaşımları yok. 'Sana Özel' sekmesinden yeni gezginleri takip edebilirsiniz!"
                : "İlk seyahat rotanızı veya deneyiminizi toplulukla paylaşarak canlı akışı başlatın!"}
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: "#059669",
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 20,
              }}
              onPress={() => setShowNewPostModal(true)}
            >
              <Text style={{ color: "#ffffff", fontWeight: "bold", fontSize: 13 }}>
                ✍️ İlk Paylaşımı Yap
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          posts.map((post) => (
            <View key={post.id} style={styles.tweetCard}>
              <View style={styles.tweetRow}>
                {/* Author Avatar (Clickable to Public Profile) */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedProfileUser({
                      name: post.authorName,
                      handle: post.authorHandle,
                      avatar: post.authorAvatar,
                      verified: post.verified,
                      bio: post.authorName.includes("Canberk")
                        ? "Doğa yürüyüşleri, gizli kanyonlar ve vadiler keşfetmeyi seviyorum 🌄 | MapsBridge Onaylı Rota Kaşifi | 📍 Kapadokya & Fethiye yollarında."
                        : `${post.authorName} ile dünya rotalarını keşfet. MapsBridge Gezgin Topluluğu onaylı üyesi.`,
                      location: post.locationTag || "İstanbul, Türkiye",
                      postsCount: 14,
                      routesCount: 8,
                      followersCount: "1.4k",
                      followingCount: "324",
                    });
                  }}
                >
                  <Image source={{ uri: post.authorAvatar }} style={styles.authorAvatar} />
                </TouchableOpacity>

                <View style={styles.tweetBody}>
                  {/* Header Line (Name, Handle, Timestamp, More) */}
                  <View style={styles.authorLine}>
                    <View style={styles.authorInfo}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          setSelectedProfileUser({
                            name: post.authorName,
                            handle: post.authorHandle,
                            avatar: post.authorAvatar,
                            verified: post.verified,
                            bio: post.authorName.includes("Canberk")
                              ? "Doğa yürüyüşleri, gizli kanyonlar ve vadiler keşfetmeyi seviyorum 🌄 | MapsBridge Onaylı Rota Kaşifi | 📍 Kapadokya & Fethiye yollarında."
                              : `${post.authorName} ile dünya rotalarını keşfet. MapsBridge Gezgin Topluluğu onaylı üyesi.`,
                            location: post.locationTag || "İstanbul, Türkiye",
                            postsCount: 14,
                            routesCount: 8,
                            followersCount: "1.4k",
                            followingCount: "324",
                          });
                        }}
                      >
                        <Text style={styles.authorName} numberOfLines={1}>
                          {post.authorName}
                        </Text>
                      </TouchableOpacity>
                      {post.verified && <Text style={styles.verifiedCheck}>✓</Text>}
                      <Text style={styles.authorHandle} numberOfLines={1}>
                        {post.authorHandle}
                      </Text>
                      <Text style={styles.dotSeparator}>·</Text>
                      <Text style={styles.timeAgo}>{post.timeAgo}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handlePostOptions(post)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.moreIcon}>•••</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Tweet Content */}
                  <Text style={styles.tweetText}>{post.content}</Text>

                  {/* Hashtags */}
                  {post.hashtags && post.hashtags.length > 0 && (
                    <View style={styles.hashtagsRow}>
                      {post.hashtags.map((h: string, i: number) => (
                        <Text key={i} style={styles.hashtagText}>
                          {h}{" "}
                        </Text>
                      ))}
                    </View>
                  )}

                  {/* Attached Media Image with Location Tag */}
                  {post.mediaImage && (
                    <View style={styles.mediaContainer}>
                      <Image
                        source={{ uri: post.mediaImage }}
                        style={styles.mediaImage}
                        resizeMode="cover"
                      />
                      {post.locationTag && (
                        <View style={styles.locationPill}>
                          <MapPinIcon size={12} color="#10B981" />
                          <Text style={styles.locationText}>{post.locationTag}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Embedded Route Card Attachment */}
                  {post.routeAttachment && (
                    <View style={styles.routeCardAttachment}>
                      <View style={styles.routeAttachLeft}>
                        <View style={styles.routeAttachIconBox}>
                          <MapIcon size={16} color="#05513d" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.routeAttachTitle} numberOfLines={1}>
                            {post.routeAttachment.title}
                          </Text>
                          <Text style={styles.routeAttachStats} numberOfLines={1}>
                            {post.routeAttachment.stats}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.cloneRouteBtn}
                        onPress={() => handleCloneRoute(post)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.cloneRouteBtnText}>Haritama Al</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Interaction Action Row (Comment, Retweet, Like, Bookmark, Share) */}
                  <View style={styles.interactionsRow}>
                    {/* Comments */}
                    <TouchableOpacity
                      style={styles.interactionBtn}
                      onPress={() => setActiveCommentPost(post)}
                    >
                      <ChatIcon size={15} color="#717974" />
                      <Text style={styles.interactionCount}>{post.commentsCount}</Text>
                    </TouchableOpacity>

                    {/* Retweet / Rota Paylaş */}
                    <TouchableOpacity
                      style={styles.interactionBtn}
                      onPress={() => handleRetweet(post)}
                    >
                      <ExploreIcon size={15} color="#717974" />
                      <Text style={styles.interactionCount}>{post.retweetsCount}</Text>
                    </TouchableOpacity>

                    {/* Like */}
                    <TouchableOpacity
                      style={styles.interactionBtn}
                      onPress={() => handleToggleLike(post.id)}
                    >
                      <HeartIcon
                        size={15}
                        color="#ef4444"
                        fill={post.isLiked ? "#ef4444" : "none"}
                      />
                      <Text
                        style={[
                          styles.interactionCount,
                          post.isLiked && { color: "#e11d48", fontWeight: "700" },
                        ]}
                      >
                        {post.likesCount}
                      </Text>
                    </TouchableOpacity>

                    {/* Bookmark */}
                    <TouchableOpacity
                      style={styles.interactionBtn}
                      onPress={() => handleToggleBookmark(post.id)}
                    >
                      <BookmarkIcon size={15} color={post.isBookmarked ? "#013628" : "#717974"} />
                      <Text
                        style={[
                          styles.interactionCount,
                          post.isBookmarked && { color: "#013628", fontWeight: "700" },
                        ]}
                      >
                        {post.bookmarksCount}
                      </Text>
                    </TouchableOpacity>

                    {/* Share */}
                    <TouchableOpacity
                      style={styles.interactionBtn}
                      onPress={() => handleShare(post)}
                    >
                      <SendIcon size={14} color="#717974" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Floating Action Button: "Sen de Paylaş" */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={styles.fabButton}
          onPress={() => setShowNewPostModal(true)}
          activeOpacity={0.88}
        >
          <View style={styles.fabIconCircle}>
            <EditIcon size={14} color="#ffffff" />
          </View>
          <Text style={styles.fabText}>Sen de Paylaş</Text>
        </TouchableOpacity>
      </View>

      {/* New Post Creation Modal */}
      <Modal visible={showNewPostModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowNewPostModal(false)}>
              <Text style={styles.modalCancelText}>Vazgeç</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Yeni Gönderi</Text>
            <TouchableOpacity style={styles.modalPublishBtn} onPress={handleCreatePost}>
              <Text style={styles.modalPublishBtnText}>Paylaş</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <TextInput
              style={styles.modalTextInput}
              placeholder="Gezgin topluluğuna ne paylaşmak istersin? Rota ipuçları, fotoğraflar..."
              placeholderTextColor="#717974"
              value={newPostContent}
              onChangeText={setNewPostContent}
              multiline
              autoFocus
            />

            <View style={styles.modalFieldRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <MapPinIcon size={14} color="#10B981" />
                <Text style={styles.modalFieldLabel}>Konum / Şehir:</Text>
              </View>
              <TextInput
                style={styles.modalFieldInput}
                placeholder="Örn: Roma, İtalya veya Kapadokya"
                placeholderTextColor="#717974"
                value={newPostLocation}
                onChangeText={setNewPostLocation}
              />
            </View>

            <View style={styles.modalFieldRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <TagIcon size={14} color="#10B981" />
                <Text style={styles.modalFieldLabel}>Etiketler:</Text>
              </View>
              <TextInput
                style={styles.modalFieldInput}
                placeholder="#Roma #Gastronomi #SırtÇantası"
                placeholderTextColor="#717974"
                value={newPostHashtags}
                onChangeText={setNewPostHashtags}
              />
            </View>

            {tripStore.getActiveRoute().stops.length > 0 && (
              <View style={styles.modalAttachedRouteBox}>
                <MapIcon size={18} color="#05513d" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalAttachedRouteTitle}>
                    {tripStore.getActiveRoute().name}
                  </Text>
                  <Text style={styles.modalAttachedRouteSub}>
                    {tripStore.getActiveRoute().stops.length} Duraklı aktif rotan bu gönderiye
                    iliştirilecek.
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Comments Modal */}
      <Modal visible={!!activeCommentPost} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveCommentPost(null)}>
              <Text style={styles.modalCancelText}>Kapat</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              Yorumlar ({activeCommentPost?.commentsCount || 0})
            </Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {activeCommentPost?.comments && activeCommentPost.comments.length > 0 ? (
              activeCommentPost.comments.map((c: MobileCommunityComment) => (
                <View key={c.id} style={styles.commentItem}>
                  <Text style={styles.commentUser}>{c.user}</Text>
                  <Text style={styles.commentText}>{c.text}</Text>
                  <Text style={styles.commentTime}>{c.time}</Text>
                </View>
              ))
            ) : (
              <View style={{ paddingVertical: 40, alignItems: "center" }}>
                <Text style={{ color: "#717974", fontSize: 14 }}>
                  Henüz yorum yapılmamış. İlk yorumu sen yaz!
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Yorumunuzu yazın..."
              placeholderTextColor="#717974"
              value={newCommentText}
              onChangeText={setNewCommentText}
            />
            <TouchableOpacity style={styles.sendCommentBtn} onPress={handleAddComment}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>Gönder</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Edit Post Modal */}
      {editingPost && (
        <EditPostModal
          visible={!!editingPost}
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSaved={(saved) => {
            setPosts((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
            setEditingPost(null);
          }}
          onDeleted={(delId) => {
            setPosts((prev) => prev.filter((p) => p.id !== delId));
            setEditingPost(null);
          }}
        />
      )}
      <ScreenTourModal screen="community" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#faf8ff",
  },
  topHeaderBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#ffffff",
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
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#065f46",
    letterSpacing: -0.3,
  },
  chatHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  timelineTabsBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eaedff",
    backgroundColor: "#faf8ff",
  },
  timelineTab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    position: "relative",
  },
  timelineTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#717974",
  },
  timelineTabTextActive: {
    color: "#013628",
    fontWeight: "800",
  },
  activeTabIndicator: {
    position: "absolute",
    bottom: 0,
    width: 48,
    height: 3,
    backgroundColor: "#013628",
    borderRadius: 999,
  },
  filterPillsRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#eaedff",
    backgroundColor: "#faf8ff",
    paddingVertical: 8,
  },
  filterPillsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#eaedff",
  },
  filterChipActive: {
    backgroundColor: "#013628",
    borderColor: "#013628",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#404945",
  },
  filterChipTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  feedScrollContent: {
    paddingBottom: 90,
  },
  tweetCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eaedff",
    backgroundColor: "#faf8ff",
  },
  tweetRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  authorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ECFDF5",
  },
  tweetBody: {
    flex: 1,
  },
  authorLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#131b2e",
  },
  verifiedCheck: {
    fontSize: 12,
    color: "#10B981",
    fontWeight: "900",
  },
  authorHandle: {
    fontSize: 12,
    color: "#717974",
  },
  dotSeparator: {
    fontSize: 12,
    color: "#c0c8c3",
  },
  timeAgo: {
    fontSize: 12,
    color: "#717974",
  },
  moreIcon: {
    fontSize: 14,
    color: "#717974",
    paddingHorizontal: 4,
  },
  tweetText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#131b2e",
    marginBottom: 6,
  },
  hashtagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  hashtagText: {
    fontSize: 13,
    color: "#286954",
    fontWeight: "600",
  },
  mediaContainer: {
    position: "relative",
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 6,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  mediaImage: {
    width: "100%",
    height: 180,
  },
  locationPill: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  locationText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  routeCardAttachment: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ECFDF5",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "#abedd3",
    marginVertical: 8,
    gap: 8,
  },
  routeAttachLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  routeAttachIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#013628",
    alignItems: "center",
    justifyContent: "center",
  },
  routeAttachTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#013628",
  },
  routeAttachStats: {
    fontSize: 11,
    color: "#286954",
    marginTop: 1,
  },
  cloneRouteBtn: {
    backgroundColor: "#013628",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  cloneRouteBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  interactionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingRight: 10,
  },
  interactionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  interactionCount: {
    fontSize: 12,
    color: "#717974",
    fontWeight: "500",
  },
  fabContainer: {
    position: "absolute",
    bottom: 24,
    right: 20,
    zIndex: 40,
  },
  fabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#013628",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    shadowColor: "#013628",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  fabIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#34D399",
    alignItems: "center",
    justifyContent: "center",
  },
  fabText: {
    color: "#bbedd8",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#faf8ff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eaedff",
  },
  modalCancelText: {
    fontSize: 14,
    color: "#717974",
    fontWeight: "600",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#013628",
  },
  modalPublishBtn: {
    backgroundColor: "#013628",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  modalPublishBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalTextInput: {
    fontSize: 15,
    color: "#131b2e",
    lineHeight: 22,
    minHeight: 120,
    textAlignVertical: "top",
  },
  modalFieldRow: {
    marginVertical: 8,
  },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#013628",
    marginBottom: 4,
  },
  modalFieldInput: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    color: "#131b2e",
  },
  modalAttachedRouteBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ECFDF5",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#abedd3",
    marginTop: 16,
  },
  modalAttachedRouteTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#013628",
  },
  modalAttachedRouteSub: {
    fontSize: 11,
    color: "#286954",
    marginTop: 2,
  },
  commentItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eaedff",
  },
  commentUser: {
    fontSize: 12,
    fontWeight: "800",
    color: "#013628",
  },
  commentText: {
    fontSize: 13,
    color: "#131b2e",
    marginTop: 2,
  },
  commentTime: {
    fontSize: 10,
    color: "#717974",
    marginTop: 2,
  },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#eaedff",
    backgroundColor: "#ffffff",
  },
  commentInput: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 40,
    fontSize: 13,
    color: "#131b2e",
  },
  sendCommentBtn: {
    backgroundColor: "#013628",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
});
