import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { fontFamily, tokens } from "../theme";
import type { CreditCost } from "../billing/credit-costs";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { tr } from "../i18n/ui";
import { useAnnounce } from "./useAnnounce";

// Sohbet girişi (design §4.2, karar S22): web ComposerBar ile aynı prop sözlüğü. Alanın
// erişilebilir adı `label` (yoksa placeholder). `cost` verilirse gönder düğmesinde CostBadge
// çizilir (yalnızca gösterim); oturumlu sohbette sabit rozet yerine `note` kullanılır (S22).
// Devre dışı nedeni ve not alanın/düğmenin ipucu olarak okunur.
export interface ComposerBarProps {
  placeholder: string;
  label?: string;
  cost?: CreditCost;
  note?: string;
  disabled?: boolean;
  disabledReason?: string;
  busy?: boolean;
  onSubmit: (text: string) => void;
  maxLength?: number;
  value?: string;
  onChange?: (value: string) => void;
  /** Alanın solundaki ek kontroller (ör. konum, sesli giriş). */
  leading?: React.ReactNode;
  submitLabel?: string;
}

export function ComposerBar({
  placeholder,
  label,
  cost,
  note,
  disabled = false,
  disabledReason,
  busy = false,
  onSubmit,
  maxLength = 500,
  value: valueProp,
  onChange,
  leading,
  submitLabel = tr("assistant.composer.send"),
}: ComposerBarProps) {
  const [inner, setInner] = useState("");
  const controlled = valueProp !== undefined;
  const value = controlled ? valueProp : inner;
  const setValue = (next: string) => {
    if (!controlled) setInner(next);
    onChange?.(next);
  };
  const hint = [disabled ? disabledReason : undefined, note].filter(Boolean).join(" ") || undefined;
  // iOS: devre dışı kalma nedeni değişince okunur (Android canlı bölgesinin eşleniği).
  useAnnounce(disabled ? disabledReason : undefined);
  const canSend = !disabled && !busy && value.trim().length > 0;
  const submit = () => {
    if (!canSend) return;
    onSubmit(value.trim());
    if (!controlled) setInner("");
  };
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {leading ? <View style={styles.leading}>{leading}</View> : null}
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          placeholderTextColor={tokens.color.fieldPlaceholder}
          editable={!disabled}
          multiline
          maxLength={maxLength}
          accessibilityLabel={label ?? placeholder}
          accessibilityHint={hint}
          accessibilityState={{ disabled }}
          maxFontSizeMultiplier={tokens.font.maxScale.body}
          style={[styles.input, { fontFamily: fontFamily("regular") }]}
        />
        <Button
          label={submitLabel}
          cost={cost}
          loading={busy}
          disabled={!canSend}
          hint={hint}
          onPress={submit}
          icon={<Icon name="send" size={16} color={tokens.color.buttonPrimaryFg} />}
        />
      </View>
      {note ? (
        <Text style={styles.note} maxFontSizeMultiplier={tokens.font.maxScale.body}>
          {note}
        </Text>
      ) : null}
      {disabled && disabledReason ? (
        <Text
          style={styles.reason}
          accessibilityLiveRegion="polite"
          maxFontSizeMultiplier={tokens.font.maxScale.body}
        >
          {disabledReason}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space["1"] },
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: tokens.space["2"],
    padding: tokens.space["2"],
    borderWidth: 1,
    borderColor: tokens.color.composerBorder,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.composerBg,
  },
  leading: { flexDirection: "row", alignItems: "center" },
  input: {
    flex: 1,
    minHeight: tokens.touch.min,
    maxHeight: 132,
    paddingHorizontal: tokens.space["2"],
    paddingVertical: tokens.space["2"],
    fontSize: tokens.font.size.base,
    color: tokens.color.fieldFg,
  },
  note: { fontSize: tokens.font.size.xs, color: tokens.color.textMuted },
  reason: { fontSize: tokens.font.size.xs, color: tokens.color.warning },
});
