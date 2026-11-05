import React from "react";
import { StyleSheet, View } from "react-native";
import { tokens } from "../theme";
import { tr } from "../i18n/ui";
import { Button } from "./Button";
import { ModalFrame } from "./ModalFrame";
import { Txt } from "./Txt";

// Yıkıcı eylem onayı (web ConfirmDialog karşılığı, design §4.1): ModalFrame dialog; birincil
// eylem tehlike tonunda, "İptal" ve Android geri vazgeçer. Alert.alert yerine tek görünüm.
export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Varsayılan "danger". */
  tone?: "danger" | "primary";
  busy?: boolean;
}

export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  tone = "danger",
  busy = false,
}: ConfirmDialogProps) {
  return (
    <ModalFrame visible={visible} variant="dialog" title={title} onRequestClose={onCancel}>
      <View style={styles.card}>
        <Txt variant="heading" header>
          {title}
        </Txt>
        {body ? (
          <Txt variant="small" tone="muted">
            {body}
          </Txt>
        ) : null}
        <View style={styles.actions}>
          <Button label={tr("ui.cancel")} variant="secondary" onPress={onCancel} />
          <Button
            label={confirmLabel}
            variant={tone === "danger" ? "danger" : "primary"}
            loading={busy}
            onPress={onConfirm}
          />
        </View>
      </View>
    </ModalFrame>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: 420,
    gap: tokens.space["3"],
    padding: tokens.space["5"],
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.modalBg,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: tokens.space["2"],
    marginTop: tokens.space["2"],
  },
});
