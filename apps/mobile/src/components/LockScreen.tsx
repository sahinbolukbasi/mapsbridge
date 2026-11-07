import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Icon, SafeArea, Txt } from "../ui";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";
import { authenticate } from "../services/biometric";
// Biyometrik kilit örtüsü (K4, isteğe bağlı): görünürken içerik erişilebilirlik ağacından gizlenir
// (App), açılışta otomatik doğrulama istenir; başarısızsa "Kilidi aç" ile tekrar denenir.
export function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const unlock = async () => {
    if (await authenticate()) onUnlocked();
  };
  useEffect(() => {
    void unlock();
    // Yalnız ilk gösterimde otomatik.
  }, []);
  return (
    <SafeArea style={styles.root} accessibilityViewIsModal>
      <View style={styles.body}>
        <View style={styles.icon}>
          <Icon name="lock" size={32} color={tokens.color.onPrimary} />
        </View>
        <Txt variant="title" header align="center">
          {tr("native.lock.title")}
        </Txt>
        <Txt tone="muted" align="center">
          {tr("native.lock.body")}
        </Txt>
        <Button label={tr("native.lock.unlock")} size="lg" onPress={unlock} />
      </View>
    </SafeArea>
  );
}
const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: tokens.color.bg },
  body: { flex: 1, justifyContent: "center", padding: tokens.space["6"], gap: tokens.space["4"] },
  icon: {
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
