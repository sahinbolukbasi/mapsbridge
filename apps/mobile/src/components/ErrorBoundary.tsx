import React, { Component, ErrorInfo, ReactNode } from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";

import { SafeArea } from "../ui";
import { tokens, withAlpha } from "../theme";
interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("[ErrorBoundary] Caught runtime exception:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <SafeArea style={styles.container}>
          <View style={styles.card}>
            <View style={styles.badge}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.badgeText}>
                SİSTEM KURTARMA
              </Text>
            </View>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.title}>
              Uygulama Güvenle Kurtarıldı
            </Text>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.message}>
              Beklenmedik bir ekran yükleme sorunu oluştu. Verileriniz koruma altında tutulmaktadır.
            </Text>
            {this.state.error?.message && (
              <Text
                maxFontSizeMultiplier={tokens.font.maxScale.body}
                style={styles.detail}
                numberOfLines={3}
              >
                {this.state.error.message}
              </Text>
            )}
            <TouchableOpacity style={styles.button} onPress={this.handleReset} activeOpacity={0.85}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.buttonText}>
                Yeniden Başlat
              </Text>
            </TouchableOpacity>
          </View>
        </SafeArea>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.surfaceInverseStrong,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: tokens.color.surfaceInverse,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: tokens.color.brandHover,
    alignItems: "center",
  },
  badge: {
    backgroundColor: withAlpha(tokens.color.accentStrong, 0.15),
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.color.accentStrong,
    marginBottom: 16,
  },
  badgeText: {
    color: tokens.color.accentStrong,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: tokens.color.onPrimary,
    textAlign: "center",
    marginBottom: 10,
  },
  message: {
    fontSize: 13,
    color: tokens.color.neutral400,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  detail: {
    fontSize: 11,
    fontFamily: "monospace",
    color: tokens.color.dangerIcon,
    backgroundColor: withAlpha(tokens.color.black, 0.3),
    padding: 10,
    borderRadius: 8,
    width: "100%",
    marginBottom: 20,
  },
  button: {
    backgroundColor: tokens.color.accent,
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 999,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: tokens.color.onPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
});
