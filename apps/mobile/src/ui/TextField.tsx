import React, { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
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
  /** Giriş alanının (TextInput) ek stili — ör. çok satırlı alanda daha yüksek minHeight. */
  inputStyle?: StyleProp<TextStyle>;
  /** Alanın içinde sağda bir kontrol (ör. şifre göster/gizle göz simgesi, konumu bul). */
  endAdornment?: React.ReactNode;
}

export function TextField({
  label,
  value,
  onChangeText,
  hint,
  error,
  secure,
  style,
  inputStyle,
  endAdornment,
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
      {endAdornment ? (
        <View style={[styles.adornedRow, error ? styles.inputInvalid : null]}>
          <TextInput
            {...rest}
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={secure}
            accessibilityLabel={label}
            accessibilityHint={hint}
            placeholderTextColor={tokens.color.fieldPlaceholder}
            maxFontSizeMultiplier={tokens.font.maxScale.body}
            style={[styles.bareInput, inputStyle]}
          />
          <View style={styles.adornment}>{endAdornment}</View>
        </View>
      ) : (
        <TextInput
          {...rest}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure}
          accessibilityLabel={label}
          accessibilityHint={hint}
          placeholderTextColor={tokens.color.fieldPlaceholder}
          maxFontSizeMultiplier={tokens.font.maxScale.body}
          style={[styles.input, error ? styles.inputInvalid : null, inputStyle]}
        />
      )}
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
  // Uç-aksesuarlı alan: kenarlık satırda; input kendi kenarlığını taşımaz, sağda kontrol oturur.
  adornedRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: tokens.touch.min,
    borderWidth: 1,
    borderColor: tokens.color.fieldBorder,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.fieldBg,
    paddingRight: tokens.space["1"],
  },
  bareInput: {
    flex: 1,
    minHeight: tokens.touch.min,
    color: tokens.color.fieldFg,
    paddingHorizontal: tokens.space["3"],
    fontSize: tokens.font.size.base,
  },
  adornment: { alignItems: "center", justifyContent: "center" },
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
