import React, { useEffect, useRef } from "react";
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

// Etiketli metin alanı (design §7.3, §6.2). Görünür etiket = erişilebilir ad; hata değişince
// ekran okuyucuya duyurulur (Android'de ayrıca canlı bölge).
export interface TextFieldProps extends Omit<TextInputProps, "style" | "secureTextEntry"> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  hint?: string;
  error?: string;
  secure?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function TextField({
  label,
  value,
  onChangeText,
  hint,
  error,
  secure,
  style,
  ...rest
}: TextFieldProps) {
  const lastError = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (error && error !== lastError.current) AccessibilityInfo.announceForAccessibility(error);
    lastError.current = error;
  }, [error]);
  return (
    <View style={style}>
      <Text style={styles.label} maxFontSizeMultiplier={tokens.font.maxScale.body}>
        {label}
      </Text>
      <TextInput
        {...rest}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={tokens.color.fieldPlaceholder}
        maxFontSizeMultiplier={tokens.font.maxScale.body}
        style={[styles.input, error ? styles.inputInvalid : null]}
      />
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
