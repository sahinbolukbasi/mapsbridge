"use client";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { CopyRouteButton } from "../../../components/copy-route-button";
import { Avatar, Badge, Button, Card, Field, Icon, Input, Media } from "../../../components/ui";
import { useLocale } from "../../../lib/locale-context";
import { profileHref } from "../../../lib/navigation/profile-href";
import { isDeviceOnlyImage } from "../media";
import { toCopyStops } from "../../../lib/trip/copy-stops";
import type { CommunityPost } from "../types";
import "../community-feed.css";

/** Misafirde yazma eylemleri kapıya düşer (design §6.4); oturumluda gerçek eylem çalışır. */
export type PostActions = {
  onToggleLike: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  /** true: yorum eklendi; false: eklenmedi (ör. misafire kapı açıldı) — taslak korunur. */
  onAddComment: (id: string, text: string) => boolean;
  onToggleFollow?: (username: string) => void;
  onEdit?: (post: CommunityPost) => void;
  onDelete?: (post: CommunityPost) => void;
  onShare: (post: CommunityPost) => void;
};

function handle(username: string): string {
  return username.startsWith("@") ? username : `@${username}`;
}

/**
 * Topluluk gönderisi (design F17, F20): Card + Media, ikonlar yalnızca Icon. Sayılar yalnızca
 * gönderi verisinden gelir; takipçi sayısı ya da "onaylı" rozeti uydurulmaz (I1, F2).
 */
export function PostCard({
  post,
  isMine,
  isFollowing,
  next,
  actions,
}: {
  post: CommunityPost;
  isMine: boolean;
  isFollowing: boolean;
  /** Kapı sonrası dönüş yolu. */
  next: string;
  actions: PostActions;
}) {
  const { t } = useLocale();
  const id = useId();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comment, setComment] = useState("");
  const comments = post.comments ?? [];
  const stops = toCopyStops(post.linkedRoute?.stops);
  const stopCount = post.linkedRoute?.stops ? stops.length : (post.linkedRoute?.stopCount ?? 0);
  const authorHref = profileHref(post.authorUsername);
  // Tepki "pop" animasyonu yalnız tıklanan düğmede (CSS: prefers-reduced-motion: no-preference).
  const [popped, setPopped] = useState<"like" | "save" | null>(null);
  const pop = (kind: "like" | "save") => {
    setPopped(null);
    requestAnimationFrame(() => setPopped(kind));
  };

  function submitComment(e: FormEvent) {
    e.preventDefault();
    const text = comment.trim();
    if (!text) return;
    if (actions.onAddComment(post.id, text)) setComment("");
  }

  return (
    <Card as="article" className="cm-post" padding="md">
      <div className="cm-post__head">
        {authorHref ? (
          <Link href={authorHref} className="cm-post__avatar-link" tabIndex={-1} aria-hidden="true">
            <Avatar src={post.authorAvatar} name={post.authorDisplayName} size="md" decorative />
          </Link>
        ) : (
          <Avatar src={post.authorAvatar} name={post.authorDisplayName} size="md" decorative />
        )}
        <div className="cm-post__who">
          <p className="cm-post__author">
            {authorHref ? (
              <Link
                href={authorHref}
                className="cm-post__author-link"
                aria-label={`${post.authorDisplayName} — ${t("community.post.profile", "profili")}`}
              >
                {post.authorDisplayName}
              </Link>
            ) : (
              <span>{post.authorDisplayName}</span>
            )}
            {post.verified === true && (
              <Badge tone="success">{t("community.post.verified", "Onaylı")}</Badge>
            )}
          </p>
          <p className="cm-post__meta">
            <span>{handle(post.authorUsername)}</span>
            {post.createdAt && <span>· {post.createdAt}</span>}
            {post.locationTag && (
              <span className="cm-post__place">
                · <Icon name="map" size={16} /> {post.locationTag}
              </span>
            )}
          </p>
        </div>
        {!isMine && actions.onToggleFollow && (
          <Button
            size="sm"
            variant={isFollowing ? "secondary" : "ghost"}
            aria-pressed={isFollowing}
            onClick={() => actions.onToggleFollow?.(post.authorUsername)}
          >
            {isFollowing
              ? t("community.post.following", "Takiptesin")
              : t("community.post.follow", "Takip et")}
          </Button>
        )}
      </div>

      <p className="cm-post__content">{post.content}</p>

      {post.hashtags && post.hashtags.length > 0 && (
        <p className="cm-post__tags">{post.hashtags.join(" ")}</p>
      )}

      {post.image && (
        <Media
          src={post.image}
          alt={t("community.post.imageAlt", "Gönderi görseli")}
          ratio="16/9"
          className="cm-post__media"
        />
      )}
      {(isDeviceOnlyImage(post.image) || post.deviceOnly) && (
        <p className="cm-post__local">
          <Badge tone="example">
            <Icon name="offline" size={16} />
            {t("community.post.deviceOnly", "Yalnız bu cihazda")}
          </Badge>
        </p>
      )}

      {post.linkedRoute && (
        <div className="cm-post__route" data-surface="default">
          <Icon name="route" size={20} />
          <div className="cm-post__route-text">
            <p className="cm-post__route-title">{post.linkedRoute.title}</p>
            <p className="cm-post__route-meta">
              {[
                post.linkedRoute.destination,
                stopCount > 0
                  ? t("community.post.stops", "{n} durak").replace("{n}", String(stopCount))
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <CopyRouteButton title={post.linkedRoute.title} stops={stops} next={next} size="sm" />
        </div>
      )}

      <div className="cm-post__actions">
        <Button
          size="sm"
          variant="ghost"
          aria-pressed={post.likedByMe}
          className="cm-react"
          data-pop={popped === "like" || undefined}
          data-active={post.likedByMe || undefined}
          onAnimationEnd={() => setPopped(null)}
          iconStart={<Icon name="heart" size={16} />}
          onClick={() => {
            if (!post.likedByMe) pop("like");
            actions.onToggleLike(post.id);
          }}
        >
          {t("community.post.like", "Beğen")} {post.likesCount || 0}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={commentsOpen}
          aria-controls={`${id}-comments`}
          iconStart={<Icon name="message" size={16} />}
          onClick={() => setCommentsOpen((v) => !v)}
        >
          {t("community.post.comments", "Yorumlar")} {comments.length}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-pressed={Boolean(post.savedByMe)}
          className="cm-react"
          data-pop={popped === "save" || undefined}
          data-active={post.savedByMe || undefined}
          onAnimationEnd={() => setPopped(null)}
          iconStart={<Icon name="bookmark" size={16} />}
          onClick={() => {
            if (!post.savedByMe) pop("save");
            actions.onToggleBookmark(post.id);
          }}
        >
          {post.savedByMe
            ? t("community.post.saved", "Kaydedildi")
            : t("community.post.save", "Kaydet")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          iconStart={<Icon name="share" size={16} />}
          onClick={() => actions.onShare(post)}
        >
          {t("community.post.share", "Paylaş")}
        </Button>
        {isMine && actions.onEdit && (
          <Button
            size="sm"
            variant="ghost"
            iconStart={<Icon name="edit" size={16} />}
            onClick={() => actions.onEdit?.(post)}
          >
            {t("community.post.edit", "Düzenle")}
          </Button>
        )}
        {isMine && actions.onDelete && (
          <Button
            size="sm"
            variant="ghost"
            iconStart={<Icon name="trash" size={16} />}
            onClick={() => actions.onDelete?.(post)}
          >
            {t("community.post.delete", "Sil")}
          </Button>
        )}
      </div>

      {commentsOpen && (
        <div id={`${id}-comments`} className="cm-post__comments">
          <form className="cm-post__comment-form" onSubmit={submitComment}>
            <Field
              label={t("community.post.commentLabel", "Yorum yaz")}
              className="cm-post__comment-field"
            >
              {(ids) => (
                <Input
                  {...ids}
                  value={comment}
                  maxLength={500}
                  onChange={(e) => setComment(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" size="sm" disabled={!comment.trim()}>
              {t("community.post.reply", "Yanıtla")}
            </Button>
          </form>
          {comments.length === 0 ? (
            <p className="cm-post__empty">{t("community.post.noComments", "Henüz yorum yok.")}</p>
          ) : (
            <ul className="cm-post__comment-list">
              {comments.map((c) => (
                <li key={c.id} className="cm-post__comment">
                  <p className="cm-post__comment-meta">
                    <strong>{c.displayName || c.username}</strong> {handle(c.username)}
                    {c.createdAt && ` · ${c.createdAt}`}
                  </p>
                  <p className="cm-post__comment-text">{c.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
