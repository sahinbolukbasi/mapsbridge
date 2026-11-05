import React from "react";
import { StyleSheet, View } from "react-native";
import { tokens } from "../theme";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { Txt } from "./Txt";

// Kalıcı uyarı satırı (web Alert karşılığı, design §4.1): ton rengi + ikon (renk tek bilgi
// taşıyıcı değil). Canlı bölge: polite (danger için de; RN'de assertive Android'e özgü).
export type NoticeTone = "info" | "success" | "warning" | "danger";

export interface NoticeProps {
  tone?: NoticeTone;
  title?: string;
  children?: string;
  action?: { label: string; onPress: () => void };
}

const TONES: Record<NoticeTone, { bg: string; border: string; icon: IconName; accent: string }> = {
  info: {
    bg: tokens.color.alertInfoBg,
    border: tokens.color.alertInfoBorder,
    icon: "info",
    accent: tokens.color.alertInfoAccent,
  },
  success: {
    bg: tokens.color.alertSuccessBg,
    border: tokens.color.alertSuccessBorder,
    icon: "check",
    accent: tokens.color.alertSuccessAccent,
  },
  warning: {
    bg: tokens.color.alertWarningBg,
    border: tokens.color.alertWarningBorder,
    icon: "alert",
    accent: tokens.color.alertWarningAccent,
  },
  danger: {
    bg: tokens.color.alertDangerBg,
    border: tokens.color.alertDangerBorder,
    icon: "error",
    accent: tokens.color.alertDangerAccent,
  },
};

export function Notice({ tone = "info", title, children, action }: NoticeProps) {
  const t = TONES[tone];
  return (
    <View
      style={[styles.box, { backgroundColor: t.bg, borderColor: t.border }]}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.row}>
        <Icon name={t.icon} size={20} color={t.accent} />
        <View style={styles.text}>
          {title ? <Txt variant="label">{title}</Txt> : null}
          {children ? <Txt variant="small">{children}</Txt> : null}
        </View>
      </View>
      {action ? (
        <View style={styles.action}>
          <Button label={action.label} variant="secondary" size="sm" onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: tokens.radius.md,
    padding: tokens.space["3"],
    gap: tokens.space["2"],
  },
  row: { flexDirection: "row", gap: tokens.space["2"], alignItems: "flex-start" },
  text: { flex: 1, gap: tokens.space["1"] },
  action: { alignItems: "flex-start" },
});
