"use client";
import { useEffect, useState } from "react";
import { AuthGate } from "../components/auth-gate";
import { CopyRouteButton } from "../components/copy-route-button";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  Media,
  PageHeader,
  PageShell,
  Reveal,
  Section,
  revealItem,
  toUiError,
  useToast,
  type UiError,
} from "../components/ui";
import type { CommunityPost } from "../features/community/types";
import { sameUser } from "../lib/community/feed";
import { webSocialSync } from "../lib/social-sync";
import { apiFetch } from "../lib/api-client";
import { getStoredSession } from "../lib/cognito";
import { isFollowingUser, toggleFollowUser } from "../lib/follow-system";
import { useLocale } from "../lib/locale-context";
import { toCopyStops } from "../lib/trip/copy-stops";
import { userStorage } from "../lib/user-storage";
import { SAMPLE_ROUTES, isSampleProfile } from "./sample-routes";
import "./public-profile.css";

function titleCase(name: string): string {
  return name ? name.charAt(0).toLocaleUpperCase("tr-TR") + name.slice(1) : "";
}

/**
 * Gezgin profili (design F2, F18, F20). Statik olarak üretilen dört kullanıcı adı örnek
 * profildir: "Örnek profil" rozeti taşır, takipçi/rota/puan gibi sayısal iddia içermez ve örnek
 * rotaları gerçek bir kullanıcıya ait değildir. Sayfa ziyaretçinin kendi profiliyse cihazdaki
 * profil bilgisi gösterilir ve rozet çizilmez. Örnek profilde takip/mesaj yoktur (I10); diğer
 * profillerde takip ve mesaj misafirde AuthGate sheet açar.
 */
export default function PublicProfileClient({
  initialUsername,
  canonicalPath,
}: {
  initialUsername: string;
  /** /profiles/?u= sayfasından açıldığında dönüş yolu (Increment 1.12). */
  canonicalPath?: string;
}) {
  const { t, locale } = useLocale();
  const toast = useToast();
  const username = initialUsername.toLowerCase();
  const next = canonicalPath ?? `/${encodeURIComponent(username)}/`;
  const [signedIn, setSignedIn] = useState(false);
  const [own, setOwn] = useState(false);
  const [name, setName] = useState(titleCase(username));
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  // Kullanıcının paylaşımları yazar kapsamlı sorgudan gelir (GET /community/posts?author=);
  // genel akış önbelleği süzülmez, aksi hâlde ilk sayfa dışındaki yazarlar yanlışlıkla "Henüz
  // paylaşım yok" görür. Yalnız gerçek gönderiler; sayaç/istatistik uydurulmaz (I1).
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [postsState, setPostsState] = useState<"loading" | "ready" | "error">("loading");
  const [postsError, setPostsError] = useState<UiError | null>(null);
  const [postsAttempt, setPostsAttempt] = useState(0);
  useEffect(() => {
    if (isSampleProfile(username) || !/^[a-z0-9_.-]{1,40}$/.test(username)) {
      setPostsState("ready");
      return;
    }
    let alive = true;
    setPostsState("loading");
    apiFetch<{ success?: boolean; posts?: CommunityPost[] }>(
      `/community/posts?author=${encodeURIComponent(username)}`,
      { timeoutMs: 8000, skipAuth: !webSocialSync.hasSession() },
    )
      .then((data) => {
        if (!alive) return;
        const list = Array.isArray(data?.posts) ? data.posts : [];
        setPosts(list.filter((p) => sameUser(p.authorUsername, username)));
        setPostsState("ready");
      })
      .catch((err) => {
        if (!alive) return;
        setPostsError(toUiError(err));
        setPostsState("error");
      });
    return () => {
      alive = false;
    };
  }, [username, postsAttempt]);

  useEffect(() => {
    const session = getStoredSession();
    const authed = Boolean(session?.token && session?.email);
    setSignedIn(authed);
    setFollowing(isFollowingUser(username));
    if (!authed) return;
    let ownUser = session?.email ? session.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "") : "";
    try {
      const raw = userStorage.getItem("mapsbridge.userProfileDetails");
      const d = raw ? JSON.parse(raw) : null;
      if (d?.username) ownUser = d.username;
      if (ownUser.toLowerCase() === username) {
        setOwn(true);
        if (d?.fullName) setName(d.fullName);
        if (d?.bio) setBio(d.bio);
        setAvatar(userStorage.getItem("mapsbridge.userAvatar"));
      }
    } catch {}
  }, [username]);

  const sample = !own && isSampleProfile(username);
  // Yayınlanmış herkese açık profil (GET /profiles/{username}); yalnız dönen alanlar (I1).
  useEffect(() => {
    if (own || isSampleProfile(username)) return;
    let alive = true;
    apiFetch<Record<string, unknown>>(`/profiles/${encodeURIComponent(username)}`, {
      skipAuth: true,
      timeoutMs: 8000,
    })
      .then((p) => {
        if (!alive || !p || typeof p !== "object") return;
        const full = typeof p.fullName === "string" ? p.fullName.trim() : "";
        const about = typeof p.bio === "string" ? p.bio.trim() : "";
        const pic =
          typeof p.avatarUrl === "string" && /^https:\/\//.test(p.avatarUrl) ? p.avatarUrl : "";
        if (full) setName(full);
        if (about) setBio(about);
        if (pic) setAvatar(pic);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [username, own]);

  function follow() {
    if (!signedIn) {
      setGateOpen(true);
      return;
    }
    setFollowing(toggleFollowUser(username));
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
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

  return (
    <PageShell className="pub-profile">
      <div className="pub-profile__cover" aria-hidden="true">
        <svg className="pub-profile__contours" viewBox="0 0 1200 200" preserveAspectRatio="none">
          <path d="M-50 140 C 200 90, 380 180, 620 120 S 1000 40, 1260 90" />
          <path d="M-50 170 C 220 120, 400 210, 640 150 S 1010 70, 1260 120" />
          <path d="M-50 60 C 160 20, 360 110, 580 50 S 960 -10, 1260 30" />
        </svg>
      </div>
      <PageHeader
        enter
        title={name}
        titleText={name}
        eyebrow={`@${username}`}
        actions={
          own ? (
            <Button
              href="/profile/edit/"
              variant="secondary"
              iconStart={<Icon name="edit" size={16} />}
            >
              {t("profile.edit", "Profili düzenle")}
            </Button>
          ) : sample ? (
            // Örnek profil gerçek bir kişi değildir: takip ve mesaj uygulanmaz (I10).
            <Button
              variant="ghost"
              onClick={() => void copyLink()}
              iconStart={<Icon name="copy" size={16} />}
            >
              {t("profile.copyLink", "Bağlantıyı kopyala")}
            </Button>
          ) : (
            <>
              <Button
                variant={following ? "secondary" : "primary"}
                aria-pressed={following}
                onClick={follow}
              >
                {following
                  ? t("community.post.following", "Takiptesin")
                  : t("community.post.follow", "Takip et")}
              </Button>
              {signedIn ? (
                <Button
                  href={`/messages/?user=${encodeURIComponent(username)}`}
                  variant="secondary"
                  iconStart={<Icon name="message" size={16} />}
                >
                  {t("publicProfile.message", "Mesaj gönder")}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => setGateOpen(true)}
                  iconStart={<Icon name="message" size={16} />}
                >
                  {t("publicProfile.message", "Mesaj gönder")}
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => void copyLink()}
                iconStart={<Icon name="copy" size={16} />}
              >
                {t("profile.copyLink", "Bağlantıyı kopyala")}
              </Button>
            </>
          )
        }
      />

      <Card className="pub-profile__card" variant="raised">
        <span className="pub-profile__avatar">
          <Avatar src={avatar} name={name} size="lg" />
        </span>
        <div className="pub-profile__text">
          {sample && <Badge tone="example">{t("publicProfile.sampleBadge", "Örnek profil")}</Badge>}
          {sample ? (
            <p className="pub-profile__bio">
              {t(
                "publicProfile.sampleBio",
                "Bu sayfa MapsBridge gezgin profillerinin nasıl görüneceğini gösteren bir örnektir; gerçek bir kullanıcıya ait değildir.",
              )}
            </p>
          ) : bio ? (
            <p className="pub-profile__bio">{bio}</p>
          ) : null}
        </div>
      </Card>

      {sample && (
        <Section
          title={t("publicProfile.routes", "Örnek rotalar")}
          description={t(
            "publicProfile.routesBody",
            "Durakları kendi planlayıcına kopyalayıp düzenleyebilirsin.",
          )}
        >
          <ul className="pub-profile__routes">
            {SAMPLE_ROUTES.map((route) => (
              <li key={route.id}>
                <Card as="article" className="pub-route">
                  <Media
                    src={route.image}
                    alt={route.title}
                    ratio="16/9"
                    className="pub-route__media"
                  />
                  <div className="pub-route__body">
                    <p className="pub-route__meta">
                      <Badge tone="example">{t("publicProfile.sampleRoute", "Örnek")}</Badge>
                      <span>{locale === "en" ? route.category.en : route.category.tr}</span>
                    </p>
                    <h3 className="pub-route__title">{route.title}</h3>
                    <p className="pub-route__summary">
                      {locale === "en" ? route.summary.en : route.summary.tr}
                    </p>
                    <ol className="pub-route__stops">
                      {route.stops.map((s) => (
                        <li key={s.label}>{s.label}</li>
                      ))}
                    </ol>
                    <CopyRouteButton
                      title={route.title}
                      stops={toCopyStops(route.stops)}
                      next={next}
                    />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!sample && (
        <Section title={t("publicProfile.posts", "Paylaşımları")}>
          {postsState === "loading" ? (
            <LoadingState label={t("publicProfile.posts.loading", "Paylaşımlar yükleniyor…")} />
          ) : postsState === "error" && postsError ? (
            <ErrorState error={postsError} onRetry={() => setPostsAttempt((n) => n + 1)} />
          ) : posts.length === 0 ? (
            <EmptyState
              icon="users"
              contour
              level={3}
              title={t("publicProfile.posts.empty", "Henüz paylaşım yok")}
              action={
                <Button href="/community/" variant="secondary">
                  {t("publicProfile.posts.toCommunity", "Topluluğa git")}
                </Button>
              }
            />
          ) : (
            <Reveal as="ul" stagger className="pub-profile__posts">
              {posts.slice(0, 12).map((p, i) => (
                <li key={p.id} className="pub-post" {...revealItem(i)}>
                  {p.image && (
                    <Media src={p.image} alt="" ratio="16/9" className="pub-post__media" />
                  )}
                  <p className="pub-post__text">{p.content}</p>
                  <p className="pub-post__meta">
                    {p.locationTag && (
                      <span className="pub-post__place">
                        <Icon name="map" size={16} />
                        {p.locationTag}
                      </span>
                    )}
                    <time dateTime={p.createdAt}>
                      {new Date(p.createdAt).toLocaleDateString(locale === "en" ? "en-GB" : "tr-TR")}
                    </time>
                  </p>
                </li>
              ))}
            </Reveal>
          )}
        </Section>
      )}
      {own && (
        <Alert tone="info">
          {t(
            "publicProfile.ownNote",
            "Bu senin profilin. Ziyaretçiler adını ve tanıtım yazını görür.",
          )}
        </Alert>
      )}

      <AuthGate
        variant="sheet"
        reason="save"
        next={next}
        open={gateOpen}
        onClose={() => setGateOpen(false)}
      />
    </PageShell>
  );
}
