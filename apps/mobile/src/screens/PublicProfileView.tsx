import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import type { MobileCommunityPost } from "../services/socialSync";
import {
  Avatar,
  Button,
  Card,
  IconButton,
  Screen,
  ScreenHeader,
  SegmentedControl,
  Txt,
  useBackHandler,
} from "../ui";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";

export interface PublicProfileUser {
  name: string;
  handle: string;
  avatar?: string;
  followersCount?: number;
  followingCount?: number;
}

interface PublicProfileViewProps {
  user: PublicProfileUser;
  posts: MobileCommunityPost[];
  onBack: () => void;
  /** Verilmezse Mesaj gönder düğmesi çizilmez (ör. kendi profilin). */
  onMessage?: () => void;
  onOpenRoute?: (route: NonNullable<MobileCommunityPost["routeAttachment"]>) => void;
}

export function PublicProfileView({
  user,
  posts,
  onBack,
  onMessage,
  onOpenRoute,
}: PublicProfileViewProps) {
  useBackHandler(true, onBack);
  const [following, setFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "routes">("posts");

  const routePosts = posts.filter((p) => p.routeAttachment);

  return (
    <Screen
      header={
        <ScreenHeader
          title={user.name}
          subtitle={user.handle}
          left={<IconButton icon="chevron-left" label={tr("nav.back")} onPress={onBack} />}
        />
      }
    >
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.head}>
          <Avatar name={user.name} uri={user.avatar} size={72} />
          <View style={styles.flex}>
            <Txt variant="title" header>
              {user.name}
            </Txt>
            <Txt variant="small" tone="muted">
              {user.handle}
            </Txt>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Txt variant="label">{user.followersCount ?? 0}</Txt>
                <Txt variant="caption" tone="muted">
                  {tr("publicProfile.followers")}
                </Txt>
              </View>
              <View style={styles.statItem}>
                <Txt variant="label">{user.followingCount ?? 0}</Txt>
                <Txt variant="caption" tone="muted">
                  {tr("publicProfile.followingCount")}
                </Txt>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.btnRow}>
          <Button
            label={following ? tr("publicProfile.following") : tr("publicProfile.follow")}
            variant={following ? "secondary" : "primary"}
            onPress={() => setFollowing((v) => !v)}
            style={styles.actionBtn}
          />
          {onMessage ? (
            <Button
              label={tr("publicProfile.message")}
              variant="secondary"
              onPress={onMessage}
              style={styles.actionBtn}
            />
          ) : null}
        </View>

        <SegmentedControl
          label={tr("publicProfile.tabPosts")}
          options={[
            { value: "posts", label: tr("publicProfile.tabPosts") },
            { value: "routes", label: tr("publicProfile.tabRoutes") },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === "posts" ? (
          posts.length === 0 ? (
            <Txt variant="small" tone="muted">
              {tr("community.empty.title")}
            </Txt>
          ) : (
            posts.map((p) => (
              <Card key={p.id} variant="bordered">
                <View style={styles.flex}>
                  <Txt variant="caption" tone="subtle">
                    {[p.timeAgo, p.locationTag].filter(Boolean).join(" · ")}
                  </Txt>
                  <Txt variant="small">{p.content}</Txt>
                  {p.routeAttachment ? (
                    <Txt variant="caption" tone="muted">
                      {`${p.routeAttachment.title} · ${tr("community.post.stops", { n: p.routeAttachment.stops.length })}`}
                    </Txt>
                  ) : null}
                </View>
              </Card>
            ))
          )
        ) : routePosts.length === 0 ? (
          <Txt variant="small" tone="muted">
            {tr("publicProfile.noRoutes")}
          </Txt>
        ) : (
          routePosts.map((p) => {
            const rt = p.routeAttachment!;
            return (
              <Card key={p.id} variant="bordered">
                <View style={styles.flex}>
                  <Txt variant="heading" header numberOfLines={1}>
                    {rt.title}
                  </Txt>
                  <Txt variant="caption" tone="muted">
                    {rt.stats || tr("community.post.stops", { n: rt.stops.length })}
                  </Txt>
                  {rt.stops.length ? (
                    <Txt variant="small" tone="subtle" numberOfLines={2}>
                      {rt.stops.map((s) => s.name).join(" → ")}
                    </Txt>
                  ) : null}
                  {onOpenRoute ? (
                    <Button
                      label={tr("home.lastTrip.open")}
                      size="sm"
                      variant="secondary"
                      onPress={() => onOpenRoute(rt)}
                    />
                  ) : null}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { padding: tokens.space["4"], gap: tokens.space["4"], paddingBottom: tokens.space["12"] },
  head: { flexDirection: "row", alignItems: "center", gap: tokens.space["4"] },
  flex: { flex: 1, gap: tokens.space["1"] },
  statsRow: { flexDirection: "row", gap: tokens.space["4"], marginTop: tokens.space["2"] },
  statItem: { alignItems: "center" },
  btnRow: { flexDirection: "row", gap: tokens.space["2"] },
  actionBtn: { flex: 1 },
});
