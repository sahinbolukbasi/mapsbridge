import React, { useEffect, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";
import { Card, HAPTICS_KEY, Txt, haptic, hapticsEnabled, setHapticsEnabled } from "../ui";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";
import { storage } from "../services/storage";
import { APP_BUILD, APP_VERSION } from "../constants/app-version";
export const NOTIFICATIONS_KEY = "mapsbridge.settings.notifications";

// Uygulama ayarları (K4): dokunsal geri bildirim ve mesaj bildirimleri. Ayarlar yalnız cihazda saklanır.
// H (görev 16): biyometrik kilit (Face ID) alanı kaldırıldı — artık kullanıcıya sunulmaz.
export function AppSettings() {
  const [haptics, setHaptics] = useState(true);
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    setHaptics(hapticsEnabled());
    storage.getItem(NOTIFICATIONS_KEY).then((v) => {
      if (v !== null) setNotifications(v === "true");
    });
  }, []);

  const toggleHaptics = (next: boolean) => {
    setHapticsEnabled(next);
    setHaptics(next);
    storage.setItem(HAPTICS_KEY, next ? "true" : "false").catch(() => undefined);
    if (next) haptic("selection");
  };

  const toggleNotifications = (next: boolean) => {
    setNotifications(next);
    storage.setItem(NOTIFICATIONS_KEY, next ? "true" : "false").catch(() => undefined);
    if (haptics) haptic("selection");
  };

  return (
    <Card variant="bordered">
      <View style={styles.body}>
        <Txt variant="heading" header>
          {tr("native.settings.title")}
        </Txt>
        <View style={styles.row}>
          <View style={styles.text}>
            <Txt variant="label">{tr("native.settings.notifications")}</Txt>
            <Txt variant="caption" tone="muted">
              {tr("native.settings.notificationsHint")}
            </Txt>
          </View>
          <Switch
            value={notifications}
            onValueChange={toggleNotifications}
            accessibilityLabel={tr("native.settings.notifications")}
            trackColor={{ true: tokens.color.brand, false: tokens.color.borderStrong }}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.text}>
            <Txt variant="label">{tr("native.settings.haptics")}</Txt>
          </View>
          <Switch
            value={haptics}
            onValueChange={toggleHaptics}
            accessibilityLabel={tr("native.settings.haptics")}
            trackColor={{ true: tokens.color.brand, false: tokens.color.borderStrong }}
          />
        </View>
        {/* G13: en altta uygulama sürümü. */}
        <View style={styles.versionRow}>
          <Txt variant="caption" tone="subtle">
            {tr("native.settings.version", { version: APP_VERSION, build: APP_BUILD })}
          </Txt>
        </View>
      </View>
    </Card>
  );
}
const styles = StyleSheet.create({
  body: { gap: tokens.space["3"] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["3"],
    minHeight: tokens.touch.min,
  },
  text: { flex: 1, gap: tokens.space["1"] },
  versionRow: { alignItems: "center", paddingTop: tokens.space["1"] },
});
