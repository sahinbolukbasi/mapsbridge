"use client";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "../components/auth-gate";
import {
  Button,
  Chip,
  ChipGroup,
  ConfirmDialog,
  EmptyState,
  Icon,
  PageHeader,
  PageShell,
  SegmentedControl,
  useToast,
  useUrlParam,
  VisuallyHidden,
} from "../components/ui";
import { EditPostModalWeb, NewPostModal, PostCard, type NewPostInput } from "../features/community";
import type { CommunityPost } from "../features/community/types";
import { trackEvent } from "../lib/analytics";
import { getStoredSession } from "../lib/cognito";
import {
  CATEGORY_LABEL_KEY,
  FEED_CATEGORIES,
  FEED_MODES,
  filterFeed,
  sameUser,
  type FeedCategory,
  type FeedMode,
} from "../lib/community/feed";
import { getFollowedUsers, toggleFollowUser } from "../lib/follow-system";
import { useLocale } from "../lib/locale-context";
import { webSocialSync } from "../lib/social-sync";
import "./community.css";

export type { CommunityPost };

const NEXT = "/community/";

/**
 * Topluluk (design F17, §6.4): okuma herkese açık; paylaşım, beğeni, yorum, kaydetme ve takip
 * misafirde AuthGate sheet (reason="save") açar. Akış modları yalnızca kodda gerçekten çalışan
 * sıralama/süzmeler (lib/community/feed.ts).
 */
export default function CommunityPage() {
  const { t } = useLocale();
  const toast = useToast();
  const [signedIn, setSignedIn] = useState(false);
  const [myUsername, setMyUsername] = useState("");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [followed, setFollowed] = useState<string[]>([]);
  const [mode, setMode] = useUrlParam<FeedMode>("akis", {
    allowed: FEED_MODES,
    fallback: "latest",
  });
  const [category, setCategory] = useState<FeedCategory>("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<CommunityPost | null>(null);
  const [deleting, setDeleting] = useState<CommunityPost | null>(null);
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    const session = getStoredSession();
    const authed = Boolean(session?.token && session?.email);
    setSignedIn(authed);
    if (authed) setMyUsername(webSocialSync.getProfile().username);
    setPosts(webSocialSync.getPosts());
    const unsubPosts = webSocialSync.subscribePosts(setPosts);
    setFollowed(getFollowedUsers());
    const onFollow = () => setFollowed(getFollowedUsers());
    window.addEventListener("mapsbridge:follow-change", onFollow);
    return () => {
      unsubPosts();
      window.removeEventListener("mapsbridge:follow-change", onFollow);
    };
  }, []);

  const visible = useMemo(
    () => filterFeed(posts, { mode, category, followed }),
    [posts, mode, category, followed],
  );

  /** Yazma eylemi: misafirde kapı (false), oturumluda eylem (true). */
  function guarded(action: () => void): boolean {
    if (!signedIn) {
      setGateOpen(true);
      return false;
    }
    action();
    return true;
  }

  function createPost(data: NewPostInput) {
    const post = webSocialSync.createPost({
      content: data.content,
      category: data.category,
      locationTag: data.locationTag,
      hashtags: data.hashtags,
      linkedRoute: data.linkedRoute,
      photo: data.image,
    });
    trackEvent("post_view", { targetId: post.id, targetTitle: post.content.slice(0, 30) });
    setComposerOpen(false);
    toast.show({ tone: "success", message: t("community.toast.posted", "Paylaşımın yayınlandı.") });
  }

  async function sharePost(post: CommunityPost) {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.authorDisplayName,
          text: post.content.slice(0, 100),
          url,
        });
      } catch {}
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.show({
        tone: "success",
        message: t("community.toast.linkCopied", "Bağlantı kopyalandı."),
      });
    } catch {
      toast.show({
        tone: "danger",
        message: t("community.toast.copyFailed", "Bağlantı kopyalanamadı."),
      });
    }
  }

  const openComposer = () => guarded(() => setComposerOpen(true));

  return (
    <PageShell className="community-page">
      <PageHeader
        title={t("community.title", "Topluluk")}
        titleText={t("community.title", "Topluluk")}
        description={t(
          "community.description",
          "Gezginlerin paylaştığı deneyimleri ve rotaları oku; beğendiğin rotayı kendi planına kopyala.",
        )}
        actions={
          <Button onClick={openComposer} iconStart={<Icon name="plus" size={16} />}>
            {t("community.newPost", "Paylaşım yap")}
          </Button>
        }
      />

      <div className="community-layout">
        <aside className="community-aside" aria-label={t("community.filter.label", "Kategori")}>
          <ChipGroup label={t("community.filter.label", "Kategori")} mode="single">
            {FEED_CATEGORIES.map((c) => (
              <Chip key={c} pressed={category === c} onPress={() => setCategory(c)}>
                {t(CATEGORY_LABEL_KEY[c], c === "all" ? "Tümü" : c)}
              </Chip>
            ))}
          </ChipGroup>
        </aside>
        <div className="community-main">
          {/* Satır içi composer daveti: dokununca paylaşım penceresi açılır (misafirde AuthGate). */}
          <div className="community-prompt" data-enter="">
            <span className="community-prompt__icon" aria-hidden="true">
              <Icon name="camera" size={20} />
            </span>
            <button type="button" className="community-prompt__field" onClick={openComposer}>
              {t("community.compose.placeholder", "Nereyi keşfettin?")}
            </button>
            <Button
              variant="secondary"
              onClick={openComposer}
              iconStart={<Icon name="image" size={16} />}
            >
              {t("community.compose.chooseImage", "Fotoğraf seç")}
            </Button>
          </div>
          <SegmentedControl<FeedMode>
            label={t("community.mode.label", "Akış")}
            value={mode}
            onChange={setMode}
            options={[
              { value: "latest", label: t("community.mode.latest", "Güncel") },
              { value: "popular", label: t("community.mode.popular", "Popüler") },
              { value: "following", label: t("community.mode.following", "Takip ettiklerin") },
            ]}
          />

          {/* Kısa durum duyurusu; kartların kendisi canlı bölge değildir. */}
          <div role="status">
            <VisuallyHidden>
              {t("community.count", "{n} paylaşım gösteriliyor").replace(
                "{n}",
                String(visible.length),
              )}
            </VisuallyHidden>
          </div>
          <div className="community-feed">
            {visible.length === 0 ? (
              <EmptyState
                icon="users"
                contour
                title={t("community.empty.title", "Henüz paylaşım yok")}
                description={
                  mode === "following"
                    ? t(
                        "community.empty.following",
                        "Takip ettiğin gezginlerin paylaşımları burada görünür.",
                      )
                    : t("community.empty.body", "İlk seyahat deneyimini paylaşarak akışı başlat.")
                }
                action={
                  <Button variant="secondary" onClick={openComposer}>
                    {t("community.empty.cta", "İlk paylaşımı yap")}
                  </Button>
                }
              />
            ) : (
              visible.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  isMine={signedIn && sameUser(post.authorUsername, myUsername)}
                  isFollowing={followed.some((u) => sameUser(u, post.authorUsername))}
                  next={NEXT}
                  actions={{
                    onToggleLike: (id) => guarded(() => webSocialSync.toggleLike(id)),
                    onToggleBookmark: (id) => guarded(() => webSocialSync.toggleBookmark(id)),
                    onAddComment: (id, text) => guarded(() => webSocialSync.addComment(id, text)),
                    onToggleFollow: (username) =>
                      guarded(() => toggleFollowUser(username.replace(/^@/, ""))),
                    onEdit: (p) => setEditing(p),
                    onDelete: (p) => setDeleting(p),
                    onShare: (p) => void sharePost(p),
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>
      <NewPostModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSubmit={createPost}
      />

      {editing && (
        <EditPostModalWeb
          post={editing}
          onClose={() => setEditing(null)}
          onSave={(id, updates) => {
            if (webSocialSync.editPost(id, updates))
              toast.show({
                tone: "success",
                message: t("community.toast.updated", "Paylaşımın güncellendi."),
              });
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={t("community.delete.title", "Paylaşım silinsin mi?")}
        consequence={t("community.delete.body", "Bu paylaşım akıştan kaldırılır.")}
        confirmLabel={t("community.delete.confirm", "Sil")}
        tone="danger"
        successMessage={t("community.toast.deleted", "Paylaşımın silindi.")}
        onConfirm={async () => {
          if (deleting) webSocialSync.deletePost(deleting.id);
        }}
        onClose={() => setDeleting(null)}
      />

      <AuthGate
        variant="sheet"
        reason="save"
        next={NEXT}
        open={gateOpen}
        onClose={() => setGateOpen(false)}
      />
    </PageShell>
  );
}
