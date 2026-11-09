import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { tokens } from "../theme";
import { IconButton } from "./IconButton";
import { tr } from "../i18n/ui";

// Etiketli metin alanı (design §7.3, §6.2). Görünür etiket = erişilebilir ad; hata değişince
// ekran okuyucuya duyurulur (Android'de ayrıca canlı bölge). `secureToggle` ile şifre
// göster/gizle düğmesi (G16): yalnız `secure` alanlarda anlamlı.
export interface TextFieldProps extends Omit<TextInputProps, "style" | "secureTextEntry"> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  hint?: string;
  error?: string;
  secure?: boolean;
  /** Şifre göster/gizle düğmesi (yalnız `secure` ile). */
  secureToggle?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function TextField({
  label,
  value,
  onChangeText,
  hint,
  error,
  secure,
  secureToggle,
  style,
  ...rest
}: TextFieldProps) {
  const lastError = useRef<string | undefined>(undefined);
  const [revealed, setRevealed] = useState(false);
  const showToggle = !!secure && !!secureToggle;
  const hidden = secure && !(showToggle && revealed);
  useEffect(() => {
    if (error && error !== lastError.current) AccessibilityInfo.announceForAccessibility(error);
    lastError.current = error;
  }, [error]);
  return (
    <View style={style}>
      <Text style={styles.label} maxFontSizeMultiplier={tokens.font.maxScale.body}>
        {label}
      </Text>
      <View style={styles.inputWrap}>
        <TextInput
          {...rest}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={hidden}
          accessibilityLabel={label}
          accessibilityHint={hint}
          placeholderTextColor={tokens.color.fieldPlaceholder}
          maxFontSizeMultiplier={tokens.font.maxScale.body}
          style={[
            styles.input,
            showToggle ? styles.inputWithAction : null,
            error ? styles.inputInvalid : null,
          ]}
        />
        {showToggle ? (
          <View style={styles.action}>
            <IconButton
              icon={revealed ? "eye-off" : "eye"}
              label={revealed ? tr("edit.pw.hide") : tr("edit.pw.show")}
              selected={revealed}
              size={tokens.touch.min}
              color={tokens.color.textMuted}
              onPress={() => setRevealed((v) => !v)}
            />
          </View>
        ) : null}
      </View>
      {hint && !error ? (
        <Text style={styles.hint} maxFontSizeMultiplier={tokens.font.maxScale.body}>
          {hint}
        </Text>
      ) : null}
      {error ? (
        <Text
          style={styles.error}
          accessibilityLiveRegion="polite"
          maxFontSizeMultiplier={tokens.font.maxScale.body}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: tokens.font.size.sm,
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
    marginBottom: tokens.space["1"],
  },
  inputWrap: { position: "relative", justifyContent: "center" },
  input: {
    minHeight: tokens.touch.min,
    borderWidth: 1,
    borderColor: tokens.color.fieldBorder,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.fieldBg,
    color: tokens.color.fieldFg,
    paddingHorizontal: tokens.space["3"],
    fontSize: tokens.font.size.base,
  },
  inputWithAction: { paddingRight: tokens.space["12"] },
  action: { position: "absolute", right: tokens.space["1"] },
  inputInvalid: { borderColor: tokens.color.fieldBorderInvalid },
  hint: {
    marginTop: tokens.space["1"],
    fontSize: tokens.font.size.xs,
    color: tokens.color.textMuted,
  },
  error: {
    marginTop: tokens.space["1"],
    fontSize: tokens.font.size.xs,
    color: tokens.color.danger,
  },
});
