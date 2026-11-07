import React, { useCallback, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Icon, ModalFrame, Txt, haptic, useToast, type IconName } from "../ui";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";
import {
  markExplained,
  openSystemSettings,
  permissionState,
  requestPermission,
  wasExplained,
  type PermissionKind,
} from "../services/permissions";
// İzin gerekçe ekranı (N1, mock native-onboarding): kendi açıklamamız → sistem penceresi.
// "Şimdi değil" her zaman var ve özelliği izinsiz sürdürür (ör. harita merkezinde arama).
const CONTENT: Record<
  PermissionKind,
  { icon: IconName; title: string; points: string[]; allow: string }
> = {
  location: {
    icon: "locate",
    title: tr("native.perm.location.title"),
    points: [
      tr("native.perm.location.p1"),
      tr("native.perm.location.p2"),
      tr("native.perm.location.p3"),
    ],
    allow: tr("native.perm.location.allow"),
  },
  notifications: {
    icon: "clock",
    title: tr("native.perm.notifications.title"),
    points: [tr("native.perm.notifications.body")],
    allow: tr("native.perm.notifications.allow"),
  },
};
/**
 * `ensure()`: izin varsa true; gerekçe hiç gösterilmediyse önce gerekçe ekranı; sistem kalıcı
 * reddettiyse "Ayarları aç" eylemli uyarı. `element` ekranda bir kez çizilir.
 */
export function usePermission(kind: PermissionKind): {
  ensure: () => Promise<boolean>;
  element: React.ReactNode;
} {
  const [visible, setVisible] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const toast = useToast();
  const finish = (ok: boolean) => {
    setVisible(false);
    resolver.current?.(ok);
    resolver.current = null;
  };
  const ensure = useCallback(async () => {
    const state = await permissionState(kind);
    if (state === "granted") return true;
    if (state === "denied") {
      toast.show({
        tone: "warning",
        message: tr("native.perm.denied"),
        action: { label: tr("native.perm.openSettings"), onPress: openSystemSettings },
      });
      return false;
    }
    if (await wasExplained(kind)) return requestPermission(kind);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setVisible(true);
    });
  }, [kind, toast]);
  const c = CONTENT[kind];
  const element = (
    <ModalFrame
      visible={visible}
      variant="bottomSheet"
      title={c.title}
      onRequestClose={() => {
        void markExplained(kind);
        finish(false);
      }}
    >
      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.icon}>
            <Icon name={c.icon} size={24} color={tokens.color.textBrand} />
          </View>
          <Txt variant="title" header>
            {c.title}
          </Txt>
          {c.points.map((p) => (
            <View key={p} style={styles.point}>
              <Icon name="check" size={16} color={tokens.color.success} />
              <Txt variant="small" tone="muted" style={styles.flex}>
                {p}
              </Txt>
            </View>
          ))}
          <Button
            label={c.allow}
            size="lg"
            onPress={async () => {
              await markExplained(kind);
              const ok = await requestPermission(kind);
              if (ok) haptic("success");
              finish(ok);
            }}
          />
          <Button
            label={tr("native.perm.notNow")}
            variant="ghost"
            onPress={() => {
              void markExplained(kind);
              finish(false);
            }}
          />
        </ScrollView>
      </View>
    </ModalFrame>
  );
  return { ensure, element };
}
const styles = StyleSheet.create({
  sheet: {
    maxHeight: "85%",
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    backgroundColor: tokens.color.sheetBg,
  },
  body: { padding: tokens.space["5"], paddingBottom: tokens.space["10"], gap: tokens.space["3"] },
  icon: {
    width: 56,
    height: 56,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.surfaceBrand,
    alignItems: "center",
    justifyContent: "center",
  },
  point: { flexDirection: "row", gap: tokens.space["2"], alignItems: "flex-start" },
  flex: { flex: 1 },
});
