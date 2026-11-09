import React, { useEffect, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";
import { Card, HAPTICS_KEY, Txt, haptic, hapticsEnabled, setHapticsEnabled } from "../ui";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";
import { storage } from "../services/storage";
import { APP_BUILD, APP_VERSION } from "../constants/app-version";
import {
  authenticate,
  biometricAvailable,
  lockEnabled,
  setLockEnabled,
} from "../services/biometric";
// Uygulama ayarları (K4): isteğe bağlı biyometrik kilit (açarken bir kez doğrulanır) ve dokunsal
// geri bildirim. Ayarlar yalnız cihazda saklanır.
export function AppSettings() {
  const [available, setAvailable] = useState(false);
  const [lock, setLock] = useState(false);
  const [haptics, setHaptics] = useState(true);
  useEffect(() => {
    biometricAvailable().then(setAvailable);
    lockEnabled().then(setLock);
    setHaptics(hapticsEnabled());
  }, []);
  const toggleLock = async (next: boolean) => {
    if (next && !(await authenticate())) return;
    await setLockEnabled(next);
    setLock(next);
    haptic("selection");
  };
  const toggleHaptics = (next: boolean) => {
    setHapticsEnabled(next);
    setHaptics(next);
    storage.setItem(HAPTICS_KEY, next ? "true" : "false").catch(() => undefined);
    if (next) haptic("selection");
  };
  return (
    <Card variant="bordered">
      <View style={styles.body}>
        <Txt variant="heading" header>
          {tr("native.settings.title")}
        </Txt>
        <View style={styles.row}>
          <View style={styles.text}>
            <Txt variant="label">{tr("native.settings.lock")}</Txt>
            <Txt variant="caption" tone="muted">
              {available ? tr("native.settings.lockHint") : tr("native.settings.lockUnavailable")}
            </Txt>
          </View>
          <Switch
            value={lock}
            disabled={!available}
            onValueChange={(v) => void toggleLock(v)}
            accessibilityLabel={tr("native.settings.lock")}
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
