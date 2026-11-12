import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { tripStore, type TripStop } from "../services/tripStore";
import {
  socialSyncService,
  type MobileCommunityPost,
  type MobileUserProfile,
} from "../services/socialSync";
import { chatStore, type ChatContact } from "../services/chatStore";
import { EditPostModal } from "../components/EditPostModal";
import { PostComposer } from "../components/PostComposer";
import { currentPosition } from "../services/nearby";
import { placesApi } from "../trip/places-api";
import { LikeButton } from "../components/LikeButton";
import { ScreenTourModal } from "../components/ScreenTourModal";
import {
  AuthGate,
  Avatar,
  Button,
  Card,
  Chip,
  ChipGroup,
  EmptyState,
  IconButton,
  Media,
  ModalFrame,
  Screen,
  ScreenHeader,
  SegmentedControl,
  Skeleton,
  TextField,
  Txt,
  haptic,
  useToast,
  type AuthGateReason,
} from "../ui";
import { PublicProfileView, type PublicProfileUser } from "./PublicProfileView";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";

// Topluluk (design §6.4, §9; FEAT-009 kuralları; S21): okuma herkese açık; paylaşım yapma, beğenme,
// kaydetme, yorum yazma ve rota kopyalama misafirde AuthGate sheet (reason "save"), mesaj
// "messages". Akış socialSyncService'ten (değişmedi). Kaldırılanlar (uydurma/işlevsiz): yeniden
// paylaş, "Paylaşımı bildir" ve "Sessize al" (yalnız Alert), yazara uydurma takipçi sayılı profil,
// sabit "@canberk/@gezgin" sahiplik istisnası. Kategori çipleri akıştaki gerçek etiketlerden.
// Increment 4.4 (web paritesi): satır içi paylaşım daveti, PostComposer (fotoğraf + yükleme
// ilerlemesi + "Yalnız bu cihazda", emoji seçici, boşta sallanma), beğenide kalp/halka animasyonu,
// yazar adı ve avatarı → PublicProfileView, geri bildirim Toast ile, yüklenirken iskelet.
export interface CommunityScreenProps {
  onOpenMap: () => void;
  guest?: boolean;
  onRequireAuth?: (mode: "register" | "login") => void;
  /** Oturumlu: yazarla birebir sohbeti Mesajlar sekmesinde açar. */
  onOpenChat?: (contact: ChatContact) => void;
  /** Derin bağlantı /traveler/?u= (K4): bu gezginin profilini açar. */
  openTraveler?: { username: string; nonce: number };
}

type Mode = "latest" | "popular";

function isOwnPost(post: MobileCommunityPost, me: MobileUserProfile | null): boolean {
  if (!me) return false;
  return post.authorHandle === `@${me.username}` || (!!me.email && post.authorEmail === me.email);
}

export function CommunityScreen({
  onOpenMap,
  guest = false,
  onRequireAuth,
  onOpenChat,
  openTraveler,
}: CommunityScreenProps) {
  const [posts, setPosts] = useState<MobileCommunityPost[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [me, setMe] = useState<MobileUserProfile | null>(null);
  const [mode, setMode] = useState<Mode>("latest");
  const [tag, setTag] = useState<string | null>(null);
  const [gate, setGate] = useState<AuthGateReason | null>(null);
  const [profile, setProfile] = useState<PublicProfileUser | null>(null);
  const [editing, setEditing] = useState<MobileCommunityPost | null>(null);
  const [commentsFor, setCommentsFor] = useState<MobileCommunityPost | null>(null);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    socialSyncService
      .getPosts()
      .then((list) => alive && setPosts(list))
      .finally(() => alive && setLoaded(true));
    if (!guest) socialSyncService.getUserProfile().then((p) => alive && setMe(p));
    const unsub = socialSyncService.subscribePosts(setPosts);
    return () => {
      alive = false;
      unsub();
    };
  }, [guest]);

  // Derin bağlantıdan gelen profil: ad/görsel yalnız akıştaki gerçek gönderiden; yoksa kullanıcı adı.
  useEffect(() => {
    if (!openTraveler) return;
    const handle = `@${openTraveler.username}`;
    const post = posts.find((p) => p.authorHandle.toLowerCase() === handle);
    setProfile({
      name: post?.authorName || openTraveler.username,
      handle,
      avatar: post?.authorAvatar,
    });
    // Yalnız yeni bağlantıda (nonce).
  }, [openTraveler?.nonce]);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts)
      for (const h of p.hashtags ?? []) counts.set(h, (counts.get(h) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([h]) => h);
  }, [posts]);

  const visible = useMemo(() => {
    let list = tag ? posts.filter((p) => p.hashtags?.includes(tag)) : [...posts];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) => {
        const matchContent = p.content.toLowerCase().includes(q);
        const matchAuthor =
          p.authorName.toLowerCase().includes(q) ||
          p.authorHandle.toLowerCase().includes(q);
        const matchLocation = p.locationTag?.toLowerCase().includes(q);
        const matchTags = p.hashtags?.some((h) => h.toLowerCase().includes(q));
        const matchRoute = p.routeAttachment?.title.toLowerCase().includes(q);
        return matchContent || matchAuthor || matchLocation || matchTags || matchRoute;
      });
    }
    return mode === "popular"
      ? list.sort((a, b) => b.likesCount - a.likesCount)
      : list.sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [posts, tag, mode, searchQuery]);

  const requireMember = (reason: AuthGateReason, action: () => void) =>
    guest ? setGate(reason) : action();

  const copyRoute = (post: MobileCommunityPost) =>
    requireMember("save", () => {
      const r = post.routeAttachment;
      if (!r?.stops.length) return;
      const stops: TripStop[] = r.stops.map((s, i) => ({
        id: s.id || `stop-${i}`,
        name: s.name,
        category: s.category || tr("native.place.defaultCategory"),
        time: "",
        duration: s.duration || "",
        address: s.address || "",
        lat: s.lat,
        lng: s.lng,
      }));
      tripStore.createRoute(r.title || tr("copyRoute.defaultName"), stops);
      onOpenMap();
    });

  const messageAuthor = (user: PublicProfileUser) =>
    requireMember("messages", async () => {
      const { contact } = await chatStore.startOrGetDirectThread({
        name: user.name,
        handle: user.handle,
        avatar: user.avatar,
      });
      setProfile(null);
      onOpenChat?.(contact);
    });

  if (profile) {
    return (
      <PublicProfileView
        user={profile}
        posts={posts.filter((p) => p.authorHandle === profile.handle)}
        onBack={() => setProfile(null)}
        onMessage={
          me && profile.handle === `@${me.username}` ? undefined : () => messageAuthor(profile)
        }
      />
    );
  }

  const activeRoute = tripStore.getActiveRoute();

  return (
    <Screen
      header={<ScreenHeader title={tr("community.title")} />}
    >
      <ScrollView contentContainerStyle={styles.page}>
        {/* D (görev 7): üst "Seyahat deneyimini paylaş" compose alanı, açıklama ve başlıktaki
            kalem kaldırıldı; paylaşım oluşturma sol-alt FAB'de (misafir → AuthGate). */}
        <SegmentedControl
          label={tr("community.mode.label")}
          options={[
            { value: "latest", label: tr("community.mode.latest") },
            { value: "popular", label: tr("community.mode.popular") },
          ]}
          value={mode}
          onChange={setMode}
        />

        {/* Güncel ve Popüler butonlarının hemen altındaki arama alanı */}
        <View style={styles.searchBar}>
          <TextField
            label="Toplulukta Ara"
            placeholder="Gönderi, yazar, mekan veya etiket ara..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.trim().length > 0 ? (
            <IconButton
              icon="x"
              label="Aramayı Temizle"
              onPress={() => setSearchQuery("")}
              style={styles.searchClearBtn}
            />
          ) : null}
        </View>

        {tags.length ? (
          <ChipGroup label={tr("community.filter.label")} mode="single">
            {tags.map((h) => (
              <Chip key={h} pressed={tag === h} onPress={() => setTag(tag === h ? null : h)}>
                {h}
              </Chip>
            ))}
          </ChipGroup>
        ) : null}

        {!loaded ? (
          <View accessible accessibilityLabel={tr("ui.loading")}>
            <Skeleton variant="card" count={2} />
          </View>
        ) : visible.length === 0 ? (
          <EmptyState
            icon="users"
            contour
            title={searchQuery.trim() ? "Eşleşen Paylaşım Bulunamadı" : tr("community.empty.title")}
            description={
              searchQuery.trim()
                ? `"${searchQuery}" aramasıyla eşleşen bir seyahat paylaşımı bulunamadı.`
                : tr("community.empty.body")
            }
            action={
              searchQuery.trim() ? (
                <Button label="Aramayı Temizle" variant="secondary" onPress={() => setSearchQuery("")} />
              ) : (
                <Button
                  label={tr("community.empty.cta")}
                  onPress={() => requireMember("save", () => setComposeOpen(true))}
                />
              )
            }
          />
        ) : (
          visible.map((post) => {
            const own = isOwnPost(post, me);
            const author: PublicProfileUser = {
              name: post.authorName,
              handle: post.authorHandle,
              avatar: post.authorAvatar,
            };
            return (
              <Card key={post.id} variant="bordered">
                <View style={styles.body}>
                  <View style={styles.row}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={post.authorName}
                      accessibilityHint={post.authorHandle}
                      onPress={() => setProfile(author)}
                      hitSlop={4}
                    >
                      <Avatar name={post.authorName} uri={post.authorAvatar} />
                    </Pressable>
                    <View style={styles.flex}>
                      <Button
                        label={post.authorName}
                        variant="ghost"
                        size="sm"
                        hint={post.authorHandle}
                        onPress={() => setProfile(author)}
                        style={styles.authorBtn}
                      />
                      <Txt variant="caption" tone="subtle">
                        {[post.authorHandle, post.timeAgo, post.locationTag]
                          .filter(Boolean)
                          .join(" · ")}
                      </Txt>
                    </View>
                    {own ? (
                      <IconButton
                        icon="edit"
                        label={tr("community.post.edit")}
                        onPress={() => setEditing(post)}
                      />
                    ) : null}
                  </View>
                  <Txt>{post.content}</Txt>
                  {post.deviceOnly ? (
                    <Txt variant="caption" tone="warning">
                      {tr("community.post.deviceOnly")}
                    </Txt>
                  ) : null}
                  {post.hashtags?.length ? (
                    <Txt variant="caption" tone="muted">
                      {post.hashtags.join(" ")}
                    </Txt>
                  ) : null}
                  {post.mediaImage ? (
                    <Media src={post.mediaImage} alt={tr("community.post.imageAlt")} ratio="4/3" />
                  ) : null}
                  {post.routeAttachment ? (
                    <Card variant="bordered" padding="3">
                      <View style={styles.body}>
                        <Txt variant="label">{post.routeAttachment.title}</Txt>
                        <Txt variant="caption" tone="muted">
                          {tr("community.post.stops", { n: post.routeAttachment.stops.length })}
                        </Txt>
                        {post.routeAttachment.stops.length ? (
                          <Button
                            label={tr("copyRoute.label")}
                            variant="secondary"
                            size="sm"
                            onPress={() => copyRoute(post)}
                          />
                        ) : null}
                      </View>
                    </Card>
                  ) : null}
                  {/* D (görev 8): gönderi eylemleri simge — beğeni (kalp), yorum, kaydet, paylaş.
                      Yorum/beğeni sayısı simge yanında; kaydet durumu simge doluluğu (selected)
                      + bookmark ikonuyla ayırt edilir (renk tek başına değil). */}
                  <View style={styles.actions}>
                    <LikeButton
                      liked={!!post.isLiked}
                      count={post.likesCount}
                      label={tr("community.post.like")}
                      onPress={() =>
                        requireMember("save", () => socialSyncService.toggleLike(post.id))
                      }
                    />
                    <View style={styles.actionCount}>
                      <IconButton
                        icon="message"
                        label={tr("community.post.comments")}
                        onPress={() => setCommentsFor(post)}
                      />
                      <Txt variant="caption" tone="muted">
                        {post.commentsCount}
                      </Txt>
                    </View>
                    <IconButton
                      icon="bookmark"
                      selected={post.isBookmarked}
                      label={
                        post.isBookmarked ? tr("community.post.saved") : tr("community.post.save")
                      }
                      onPress={() =>
                        requireMember("save", () => socialSyncService.toggleBookmark(post.id))
                      }
                    />
                    <IconButton
                      icon="share"
                      label={tr("community.post.share")}
                      onPress={() =>
                        Share.share({
                          message: `${post.authorName}: "${post.content}"\nhttps://mapsbridge.com/community/`,
                        }).catch(() => undefined)
                      }
                    />
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      <ModalFrame
        visible={!!commentsFor}
        variant="sheet"
        title={tr("community.post.comments")}
        onRequestClose={() => setCommentsFor(null)}
      >
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          {(commentsFor?.comments ?? []).length === 0 ? (
            <Txt variant="small" tone="muted">
              {tr("community.post.noComments")}
            </Txt>
          ) : (
            (commentsFor?.comments ?? []).map((c) => (
              <View key={c.id} style={styles.comment}>
                <Txt variant="label">{c.displayName || c.user}</Txt>
                <Txt variant="small">{c.text}</Txt>
                <Txt variant="caption" tone="subtle">
                  {[c.time, c.location].filter(Boolean).join(" · ")}
                </Txt>
              </View>
            ))
          )}
          {guest ? (
            <Button
              label={tr("gate.register")}
              variant="secondary"
              onPress={() => {
                setCommentsFor(null);
                setGate("save");
              }}
            />
          ) : (
            <>
              <TextField
                label={tr("community.post.commentLabel")}
                value={comment}
                onChangeText={(t) => {
                  setComment(t);
                  if (commentError) setCommentError(null);
                }}
                error={commentError ?? undefined}
                maxLength={500}
              />
              <Button
                label={tr("community.post.reply")}
                disabled={!comment.trim()}
                onPress={async () => {
                  if (!commentsFor || !comment.trim()) return;
                  let added;
                  try {
                    // G8: yoruma cihaz konumundan yer etiketi turet (varsa); hata bloklanmaz.
                    let location: string | undefined;
                    try {
                      const pos = await currentPosition();
                      if (pos) {
                        const { places } = await placesApi.reverse(pos.lat, pos.lng, "tr");
                        const best = places?.[0];
                        location =
                          (best?.name || best?.address || "").trim().slice(0, 80) || undefined;
                      }
                    } catch {
                      // konumsuz devam
                    }
                    added = await socialSyncService.addComment(
                      commentsFor.id,
                      comment.trim(),
                      location,
                    );
                  } catch {
                    setCommentError(tr("native.community.commentFailed"));
                    return;
                  }
                  setCommentError(null);
                  setCommentsFor({
                    ...commentsFor,
                    comments: [...(commentsFor.comments ?? []), added],
                    commentsCount: commentsFor.commentsCount + 1,
                  });
                  setComment("");
                }}
              />
            </>
          )}
        </ScrollView>
      </ModalFrame>

      <PostComposer
        visible={composeOpen}
        onClose={() => setComposeOpen(false)}
        activeRoute={activeRoute}
        onPublished={(post) => {
          setComposeOpen(false);
          toast.show({
            tone: post.deviceOnly ? "warning" : "success",
            message: post.deviceOnly
              ? `${tr("community.toast.posted")} · ${tr("community.post.deviceOnly")}`
              : tr("community.toast.posted"),
          });
        }}
      />

      <EditPostModal
        visible={!!editing}
        post={editing}
        onClose={() => setEditing(null)}
        onSaved={() => toast.show({ tone: "success", message: tr("community.toast.updated") })}
        onDeleted={() => toast.show({ tone: "info", message: tr("community.toast.deleted") })}
      />

      {gate ? (
        <AuthGate
          variant="sheet"
          reason={gate}
          visible
          onClose={() => setGate(null)}
          onRegister={() => {
            setGate(null);
            onRequireAuth?.("register");
          }}
          onLogin={() => {
            setGate(null);
            onRequireAuth?.("login");
          }}
        />
      ) : null}
      {/* G6: sol-altta kayan (+) — yorum/paylaşım oluşturma hızlı erişimi (misafir kapıya yönlenir). */}
      <View style={styles.fab}>
        <IconButton
          icon="plus"
          color={tokens.color.buttonPrimaryFg}
          label={tr("community.newPost")}
          onPress={() => requireMember("save", () => setComposeOpen(true))}
        />
      </View>
      <ScreenTourModal screen="community" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { padding: tokens.space["4"], gap: tokens.space["4"], paddingBottom: tokens.space["12"] },
  body: { gap: tokens.space["2"] },
  row: { flexDirection: "row", alignItems: "center", gap: tokens.space["3"] },
  flex: { flex: 1 },
  authorBtn: { alignSelf: "flex-start" },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: tokens.space["1"] },
  actionCount: { flexDirection: "row", alignItems: "center" },
  comment: { gap: tokens.space["1"] },
  fab: {
    position: "absolute",
    left: tokens.space["4"],
    bottom: tokens.space["6"],
    backgroundColor: tokens.color.buttonPrimaryBg,
    borderRadius: tokens.radius.full,
    ...tokens.shadow.md,
  },
  searchBar: {
    position: "relative",
    justifyContent: "center",
  },
  searchClearBtn: {
    position: "absolute",
    right: tokens.space["2"],
    top: tokens.space["3"],
  },
  form: { padding: tokens.space["5"], gap: tokens.space["4"], paddingBottom: tokens.space["12"] },
});
