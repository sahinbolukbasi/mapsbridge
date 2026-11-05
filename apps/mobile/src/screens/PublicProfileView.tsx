import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import type { MobileCommunityPost } from "../services/socialSync";
import { Avatar, Button, Card, IconButton, Screen, ScreenHeader, Txt, useBackHandler } from "../ui";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";

// Gezgin profili (design §9, FEAT-009 kuralı): yalnızca gerçek veri; paylaşımın yazarından gelen
// ad, kullanıcı adı ve (varsa) görsel ile bu yazarın akıştaki paylaşımları. Uydurma takipçi /
// rota / gönderi sayısı, kapak, tanıtım, "onaylı" rozeti, galeri ve örnek rotalar YOK; Takip et
// yok (sunucu desteği yok). Native'de örnek (demo) profil yoktur; olsaydı "Örnek profil" rozetiyle
// ve Mesaj/Takip olmadan gösterilmeliydi. "Mesaj gönder" oturumluda sohbeti açar, misafirde kapı.
export interface PublicProfileUser {
  name: string;
  handle: string;
  avatar?: string;
}

interface PublicProfileViewProps {
  user: PublicProfileUser;
  posts: MobileCommunityPost[];
  onBack: () => void;
  /** Verilmezse Mesaj gönder düğmesi çizilmez (ör. kendi profilin). */
  onMessage?: () => void;
}

export function PublicProfileView({ user, posts, onBack, onMessage }: PublicProfileViewProps) {
  useBackHandler(true, onBack);
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
          </View>
        </View>
        {onMessage ? <Button label={tr("publicProfile.message")} onPress={onMessage} /> : null}
        <Txt variant="heading" header>
          {tr("community.title")}
        </Txt>
        {posts.length === 0 ? (
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
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { padding: tokens.space["4"], gap: tokens.space["4"], paddingBottom: tokens.space["12"] },
  head: { flexDirection: "row", alignItems: "center", gap: tokens.space["4"] },
  flex: { flex: 1, gap: tokens.space["1"] },
});
