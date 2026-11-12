import React, { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { authService, billingService, type UserSession, type WalletSnapshot } from "../services/api";
import {
  socialSyncService,
  type MobileCommunityPost,
  type MobileUserProfile,
} from "../services/socialSync";
import { tripStore } from "../services/tripStore";
import { EditProfileModal } from "../components/EditProfileModal";
import { EditPostModal } from "../components/EditPostModal";
import { PaywallModal } from "../components/PaywallModal";
import { ScreenTourModal } from "../components/ScreenTourModal";
import { AppSettings } from "../components/AppSettings";
import { DocumentManagerModal } from "../components/DocumentManagerModal";
import { PinShareModal } from "../components/PinShareModal";
import { Avatar, Button, Card, ConfirmDialog, Screen, ScreenHeader, SegmentedControl, Txt } from "../ui";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";

// Profil sekmesi (oturumlu; design §5.3, §9; FEAT-009 kuralları): yalnızca gerçek veri. Ad, kullanıcı
// adı, (girildiyse) unvan/konum/tanıtım; Rotalarım Planla'ya yönlendirir; Paylaşımlarım yalnızca
// kendi paylaşımların (eskiden boşsa başkasının iki gönderisi gösteriliyordu); Planlar ve kredi
// native Paywall'u açar. Uydurma takipçi/rota sayıları, istatistik ve sabit "Canberk Yılmaz"
// yedek adı kaldırıldı. Çıkış onay ister.
interface ProfileScreenProps {
  onSignOut: () => void;
  onOpenPlan?: () => void;
  onOpenCommunity?: () => void;
}

function isOwn(p: MobileCommunityPost, me: MobileUserProfile): boolean {
  return p.authorHandle === `@${me.username}` || (!!me.email && p.authorEmail === me.email);
}

function tierName(tier?: string): string {
  switch (tier) {
    case "agency":
      return "Tur Lideri";
    case "pro":
      return "Pro";
    case "explorer":
      return "Gezgin";
    default:
      return "Ücretsiz Plan";
  }
}

export function ProfileScreen({ onSignOut, onOpenPlan, onOpenCommunity }: ProfileScreenProps) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [profile, setProfile] = useState<MobileUserProfile | null>(null);
  const [posts, setPosts] = useState<MobileCommunityPost[]>([]);
  const [bookmarkedPosts, setBookmarkedPosts] = useState<MobileCommunityPost[]>([]);
  const [savedTab, setSavedTab] = useState<"posts" | "routes">("posts");
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [routeCount, setRouteCount] = useState(tripStore.getAllRoutes().length);
  const [editOpen, setEditOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<MobileCommunityPost | null>(null);
  const [paywall, setPaywall] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [docManagerOpen, setDocManagerOpen] = useState(false);
  const [shareCodeOpen, setShareCodeOpen] = useState(false);
  const profileRef = useRef<MobileUserProfile | null>(null);
  profileRef.current = profile;

  useEffect(() => {
    let alive = true;
    authService.getSession().then((s) => alive && setSession(s));
    billingService
      .getWallet()
      .then((w) => alive && setWallet(w))
      .catch(() => undefined);
    socialSyncService.getUserProfile().then(async (p) => {
      if (!alive) return;
      setProfile(p);
      const all = await socialSyncService.getPosts();
      if (alive) {
        setPosts(all.filter((x) => isOwn(x, p)));
        setBookmarkedPosts(all.filter((x) => !!x.isBookmarked));
      }
    });
    const unsubProfile = socialSyncService.subscribeProfile((p) => setProfile(p));
    const unsubPosts = socialSyncService.subscribePosts((all) => {
      setPosts((prev) => {
        const me = profileRef.current;
        return me ? all.filter((x) => isOwn(x, me)) : prev;
      });
      setBookmarkedPosts(all.filter((x) => !!x.isBookmarked));
    });
    const unsubTrip = tripStore.subscribe(() => setRouteCount(tripStore.getAllRoutes().length));
    return () => {
      alive = false;
      unsubProfile();
      unsubPosts();
      unsubTrip();
    };
  }, []);
  const name = profile?.fullName || session?.name || session?.email?.split("@")[0] || "";
  const handle = profile?.username ? `@${profile.username}` : (session?.email ?? "");

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.head}>
          <Avatar name={name || "?"} uri={profile?.avatarUrl} size={72} />
          <View style={styles.flex}>
            <Txt variant="title" header>
              {name}
            </Txt>
            <Txt variant="small" tone="muted">
              {[handle, profile?.travelTitle, profile?.location].filter(Boolean).join(" · ")}
            </Txt>
          </View>
        </View>
        {profile?.bio ? (
          <Txt>{profile.bio}</Txt>
        ) : (
          <Txt variant="small" tone="muted">
            {tr("profile.noBio")}
          </Txt>
        )}
        <Button label={tr("profile.edit")} variant="secondary" onPress={() => setEditOpen(true)} />

        <Card variant="bordered">
          <View style={styles.body}>
            <View style={styles.planHeaderRow}>
              <Txt variant="heading" header>
                {tr("profile.plans")}
              </Txt>
              <View style={styles.planBadge}>
                <Txt variant="caption" tone="highlight">
                  {tierName(wallet?.tier)}
                </Txt>
              </View>
            </View>
            <Txt variant="label">
              {tr("upgrade.balance")}:{" "}
              {wallet?.credits !== undefined
                ? tr("credits.other", { n: wallet.credits })
                : "100 kredi"}
            </Txt>
            <Txt variant="small" tone="muted">
              {tr("upgrade.note")}
            </Txt>
            <Button
              label={tr("native.profile.plans.edit")}
              onPress={() => setPaywall(true)}
            />
          </View>
        </Card>

        <Card variant="bordered">
          <View style={styles.body}>
            <Txt variant="heading" header>
              {tr("profile.trips")}
            </Txt>
            <Txt variant="small" tone="muted">
              {`${routeCount} rota · ${tr("profile.tripsBody")}`}
            </Txt>
            <Button label={tr("profile.tripsCta")} variant="secondary" onPress={onOpenPlan} />
          </View>
        </Card>

        <View style={styles.body}>
          <Txt variant="heading" header>
            {tr("profile.posts")}
          </Txt>
          {posts.length === 0 ? (
            <Card variant="bordered">
              <View style={styles.body}>
                <Txt variant="label">{tr("profile.posts.empty")}</Txt>
                <Txt variant="small" tone="muted">
                  {tr("profile.posts.emptyBody")}
                </Txt>
                <Button
                  label={tr("profile.posts.cta")}
                  variant="secondary"
                  onPress={onOpenCommunity}
                />
              </View>
            </Card>
          ) : (
            posts.map((p) => (
              <Card key={p.id} variant="bordered">
                <View style={styles.body}>
                  <Txt variant="caption" tone="subtle">
                    {[p.timeAgo, p.locationTag].filter(Boolean).join(" · ")}
                  </Txt>
                  <Txt variant="small">{p.content}</Txt>
                  <Button
                    label={tr("community.post.edit")}
                    variant="ghost"
                    size="sm"
                    onPress={() => setEditingPost(p)}
                  />
                </View>
              </Card>
            ))
          )}
        </View>

        <View style={styles.body}>
          <Txt variant="heading" header>
            {tr("native.profile.saved.title")}
          </Txt>
          <SegmentedControl
            label={tr("native.profile.saved.title")}
            options={[
              { value: "posts", label: tr("publicProfile.tabPosts") },
              { value: "routes", label: tr("publicProfile.tabRoutes") },
            ]}
            value={savedTab}
            onChange={setSavedTab}
          />
          {savedTab === "posts" ? (
            bookmarkedPosts.length === 0 ? (
              <Card variant="bordered">
                <View style={styles.body}>
                  <Txt variant="small" tone="muted">
                    {tr("native.profile.saved.emptyPosts")}
                  </Txt>
                </View>
              </Card>
            ) : (
              bookmarkedPosts.map((p) => (
                <Card key={p.id} variant="bordered">
                  <View style={styles.body}>
                    <Txt variant="label">{p.authorName}</Txt>
                    <Txt variant="caption" tone="subtle">
                      {[p.timeAgo, p.locationTag].filter(Boolean).join(" · ")}
                    </Txt>
                    <Txt variant="small">{p.content}</Txt>
                  </View>
                </Card>
              ))
            )
          ) : tripStore.getAllRoutes().length === 0 ? (
            <Card variant="bordered">
              <View style={styles.body}>
                <Txt variant="small" tone="muted">
                  {tr("native.profile.saved.emptyRoutes")}
                </Txt>
              </View>
            </Card>
          ) : (
            tripStore.getAllRoutes().map((r) => (
              <Card key={r.id} variant="bordered">
                <View style={styles.body}>
                  <Txt variant="label">{r.name}</Txt>
                  <Txt variant="caption" tone="muted">
                    {tr("trip.day.stops", { n: r.stops.length })}
                  </Txt>
                  <Button
                    label={tr("home.lastTrip.open")}
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      tripStore.switchActiveRoute(r.id);
                      onOpenPlan?.();
                    }}
                  />
                </View>
              </Card>
            ))
          )}
        </View>

        <Card variant="bordered">
          <View style={styles.body}>
            <Txt variant="heading" header>
              {"Seyahat Belgelerim"}
            </Txt>
            <Txt variant="small" tone="muted">
              {"Uçak biletleri, otel rezervasyonları, vizeler ve etkinlik biletlerinizi düzenleyin ve takip edin."}
            </Txt>
            <Button
              label={"Belgelerimi Yönet"}
              variant="secondary"
              onPress={() => setDocManagerOpen(true)}
            />
          </View>
        </Card>

        <Card variant="bordered">
          <View style={styles.body}>
            <Txt variant="heading" header>
              {"Konum Kodu ile Git & Paylaş"}
            </Txt>
            <Txt variant="small" tone="muted">
              {"6 haneli seyahat kodunu girerek konuma gidin ya da kendi konum kodunuzu arkadaşlarınızla paylaşın."}
            </Txt>
            <Button
              label={"Konum Kodunu Aç / Kod Gir"}
              variant="secondary"
              onPress={() => setShareCodeOpen(true)}
            />
          </View>
        </Card>

        <AppSettings />
        <Button label={tr("nav.logout")} variant="danger" onPress={() => setConfirmOut(true)} />
      </ScrollView>

      <EditProfileModal
        visible={editOpen}
        profile={profile}
        onClose={() => setEditOpen(false)}
        onSaved={setProfile}
      />
      <EditPostModal
        visible={!!editingPost}
        post={editingPost}
        onClose={() => setEditingPost(null)}
        onSaved={() => undefined}
        onDeleted={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))}
      />
      <PaywallModal
        visible={paywall}
        onClose={() => {
          setPaywall(false);
          billingService
            .getWallet()
            .then(setWallet)
            .catch(() => undefined);
        }}
        placement="profile"
      />
      <ConfirmDialog
        visible={confirmOut}
        title={tr("native.profile.signOutTitle")}
        body={tr("native.profile.signOutBody")}
        confirmLabel={tr("nav.logout")}
        onCancel={() => setConfirmOut(false)}
        onConfirm={() => {
          setConfirmOut(false);
          onSignOut();
        }}
      />
      <DocumentManagerModal
        visible={docManagerOpen}
        onClose={() => setDocManagerOpen(false)}
      />
      <PinShareModal
        visible={shareCodeOpen}
        onClose={() => setShareCodeOpen(false)}
        pin={{
          title: profile?.fullName ? `${profile.fullName} Konumu` : "Seyahat Konumu",
          lat: 41.0082,
          lng: 28.9784,
          address: profile?.location || "İstanbul, Türkiye",
        }}
      />
      <ScreenTourModal screen="profile" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { padding: tokens.space["4"], gap: tokens.space["4"], paddingBottom: tokens.space["12"] },
  head: { flexDirection: "row", alignItems: "center", gap: tokens.space["4"] },
  flex: { flex: 1, gap: tokens.space["1"] },
  body: { gap: tokens.space["2"] },
  planHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planBadge: {
    paddingHorizontal: tokens.space["2"],
    paddingVertical: tokens.space["1"],
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.surfaceSunken,
  },
});
