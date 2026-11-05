"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "../components/auth-gate";
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Icon,
  LoadingState,
  PageHeader,
  PageShell,
  Section,
  useToast,
} from "../components/ui";
import { EditPostModalWeb, PostCard } from "../features/community";
import type { CommunityPost } from "../features/community/types";
import { billingService } from "../lib/billing/billing-service";
import { getStoredSession } from "../lib/cognito";
import { sameUser } from "../lib/community/feed";
import { useLocale } from "../lib/locale-context";
import { webSocialSync } from "../lib/social-sync";
import { userStorage } from "../lib/user-storage";
import { profileTabRedirect } from "../lib/navigation/profile-redirect";
import "./profile.css";

const NEXT = "/profile/";

/** FEAT-007 öncesi planlayıcının bıraktığı kayıtlı yerler (yalnızca okunur, varsa gösterilir). */
type LegacySavedPoint = {
  id: string;
  title?: string;
  label?: string;
  address?: string;
  lat?: number;
  lng?: number;
  category?: string;
  group?: string;
};

function readLegacyPoints(): LegacySavedPoint[] {
  for (const key of ["mapsbridge.savedAddresses", "mapsbridge.generalPins"]) {
    try {
      const raw = userStorage.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as LegacySavedPoint[];
    } catch {}
  }
  return [];
}

/**
 * Profilim (design §5.1–§5.2, F18): misafire AuthGate sayfası; Rotalarım planlayıcıdadır
 * (`?tab=routes` → /maps/?view=trips, URL kanonik kalır). Sayılar yalnızca hesap/cihaz
 * verisinden (bakiye sunucudan); uydurma istatistik, rozet ya da bildirim yok (I1, F2).
 */
export default function ProfilePage() {
  const { t } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [points, setPoints] = useState<LegacySavedPoint[]>([]);
  const [editing, setEditing] = useState<CommunityPost | null>(null);
  const [deleting, setDeleting] = useState<CommunityPost | null>(null);

  // Rotalarım planlayıcıya taşındı (design §5.1): sayfa içi yönlendirme.
  useEffect(() => {
    const target = profileTabRedirect(window.location.search);
    if (target) router.replace(target);
  }, [router]);

  useEffect(() => {
    const session = getStoredSession();
    if (!session?.email || !session?.token) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    const prefix = session.email.split("@")[0] || "";
    const profile = webSocialSync.getProfile();
    let name = prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1) : "";
    let handle = prefix.toLowerCase();
    let about = "";
    try {
      const raw = userStorage.getItem("mapsbridge.userProfileDetails");
      if (raw) {
        const d = JSON.parse(raw);
        if (d.fullName) name = d.fullName;
        else if (d.firstName) name = `${d.firstName} ${d.lastName || ""}`.trim();
        if (d.username) handle = d.username;
        if (d.bio) about = d.bio;
      }
    } catch {}
    setFullName(name);
    setUsername(handle || profile.username);
    setBio(about);
    setAvatar(userStorage.getItem("mapsbridge.userAvatar"));
    setPoints(readLegacyPoints());
    setPosts(webSocialSync.getPosts());
    const unsubPosts = webSocialSync.subscribePosts(setPosts);
    const unsubProfile = webSocialSync.subscribeProfile((p) => {
      if (p.fullName) setFullName(p.fullName);
      if (p.username) setUsername(p.username);
      if (p.avatarUrl) setAvatar(p.avatarUrl);
      if (p.bio) setBio(p.bio);
    });
    // Bakiye yalnızca sunucudan (istemci kredi hesaplamaz).
    void billingService
      .refreshWallet()
      .then((w) => setCredits(w.credits))
      .catch(() => {});
    const onWallet = () => setCredits(billingService.getWallet().credits);
    window.addEventListener("mapsbridge:wallet_updated", onWallet);
    return () => {
      unsubPosts();
      unsubProfile();
      window.removeEventListener("mapsbridge:wallet_updated", onWallet);
    };
  }, []);

  if (authed === false) return <AuthGate variant="page" reason="profile" next={NEXT} />;

  if (authed === null) {
    return (
      <PageShell layout="content" className="profile-page">
        <PageHeader />
        <LoadingState label={t("profile.loading", "Profil yükleniyor…")} />
      </PageShell>
    );
  }

  const mine = posts.filter(
    (p) => sameUser(p.authorUsername, username) || (fullName && p.authorDisplayName === fullName),
  );

  async function copyLink() {
    const url = `https://mapsbridge.com/@${username || "gezgin"}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.show({
        tone: "success",
        message: t("profile.linkCopied", "Profil bağlantısı kopyalandı."),
      });
    } catch {
      toast.show({
        tone: "danger",
        message: t("community.toast.copyFailed", "Bağlantı kopyalanamadı."),
      });
    }
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/community/`);
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

  return (
    <PageShell layout="content" className="profile-page">
      <PageHeader
        actions={
          <>
            <Button
              href="/profile/edit/"
              variant="secondary"
              iconStart={<Icon name="edit" size={16} />}
            >
              {t("profile.edit", "Profili düzenle")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => void copyLink()}
              iconStart={<Icon name="copy" size={16} />}
            >
              {t("profile.copyLink", "Bağlantıyı kopyala")}
            </Button>
          </>
        }
      />

      <Card className="profile-card">
        <Avatar src={avatar} name={fullName || username || "?"} size="lg" />
        <div className="profile-card__text">
          <p className="profile-card__name">{fullName || username}</p>
          {username && <p className="profile-card__handle">@{username}</p>}
          {bio ? (
            <p className="profile-card__bio">{bio}</p>
          ) : (
            <p className="profile-card__bio profile-card__bio--empty">
              {t("profile.noBio", "Henüz bir tanıtım yazmadın.")}{" "}
              <Button href="/profile/edit/" variant="link">
                {t("profile.addBio", "Tanıtım ekle")}
              </Button>
            </p>
          )}
        </div>
        <Button
          href="/profile/photo/"
          variant="ghost"
          size="sm"
          iconStart={<Icon name="camera" size={16} />}
        >
          {t("profile.photo", "Fotoğrafı değiştir")}
        </Button>
      </Card>

      <div className="profile-grid">
        <Card className="profile-tile">
          <p className="profile-tile__label">{t("profile.balance", "Kredi bakiyen")}</p>
          <p className="profile-tile__value">
            {credits === null ? t("profile.balanceUnknown", "Bakiye yükleniyor…") : credits}
          </p>
          <div className="profile-tile__actions">
            <Button href="/checkout/" size="sm">
              {t("profile.balanceCta", "Bakiye ve ödeme")}
            </Button>
            <Button href="/pricing/" size="sm" variant="ghost">
              {t("profile.plans", "Planlar ve kredi")}
            </Button>
          </div>
        </Card>
        <Card className="profile-tile">
          <p className="profile-tile__label">{t("profile.trips", "Rotalarım")}</p>
          <p className="profile-tile__body">
            {t(
              "profile.tripsBody",
              "Rotaların planlayıcıda; oradan açar, düzenler ve paylaşırsın.",
            )}
          </p>
          <div className="profile-tile__actions">
            <Button href="/maps/?view=trips" size="sm" iconStart={<Icon name="route" size={16} />}>
              {t("profile.tripsCta", "Rotalarıma git")}
            </Button>
          </div>
        </Card>
      </div>

      <Section title={t("profile.posts", "Paylaşımlarım")}>
        {mine.length === 0 ? (
          <EmptyState
            icon="users"
            level={3}
            title={t("profile.posts.empty", "Henüz paylaşımın yok")}
            description={t("profile.posts.emptyBody", "Toplulukta ilk deneyimini paylaş.")}
            action={
              <Button href="/community/" variant="secondary">
                {t("profile.posts.cta", "Topluluğa git")}
              </Button>
            }
          />
        ) : (
          <div className="profile-posts">
            {mine.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                isMine
                isFollowing={false}
                next={NEXT}
                actions={{
                  onToggleLike: (id) => webSocialSync.toggleLike(id),
                  onToggleBookmark: (id) => webSocialSync.toggleBookmark(id),
                  onAddComment: (id, text) => webSocialSync.addComment(id, text),
                  onEdit: setEditing,
                  onDelete: setDeleting,
                  onShare: () => void share(),
                }}
              />
            ))}
          </div>
        )}
      </Section>

      {points.length > 0 && (
        <Section
          title={t("profile.places", "Kayıtlı yerler")}
          description={t("profile.places.body", "Önceki planlayıcıda kaydettiğin yerler.")}
        >
          <ul className="profile-places">
            {points.map((p) => (
              <li key={p.id} className="profile-place">
                <Icon name="map" size={20} />
                <span className="profile-place__text">
                  <span className="profile-place__title">
                    {p.title || p.label || t("profile.places.untitled", "Adsız yer")}
                  </span>
                  {p.address && <span className="profile-place__address">{p.address}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

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
    </PageShell>
  );
}
