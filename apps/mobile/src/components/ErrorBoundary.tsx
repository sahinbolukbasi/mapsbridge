import React, { Component, ErrorInfo, ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Button, SafeArea, Txt } from "../ui";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";

// Beklenmeyen ekran hatası (web error.tsx karşılığı: "Bir şeyler ters gitti"). FEAT-012:
// primitive'lerle; "verileriniz koruma altında" gibi doğrulanmamış güvence metni kaldırıldı.
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
          <View style={styles.card} accessibilityRole="alert">
            <Txt variant="title" header align="center">
              {tr("ui.errorPage.title")}
            </Txt>
            <Txt variant="small" tone="muted" align="center">
              Ekran yüklenirken beklenmeyen bir sorun oluştu. Tekrar deneyebilirsin.
            </Txt>
            {this.state.error?.message ? (
              <Txt variant="caption" tone="danger" numberOfLines={3}>
                {this.state.error.message}
              </Txt>
            ) : null}
            <Button label={tr("ui.retry")} size="lg" onPress={this.handleReset} />
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
    backgroundColor: tokens.color.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: tokens.space["6"],
  },
  card: {
    width: "100%",
    maxWidth: 400,
    gap: tokens.space["4"],
    padding: tokens.space["6"],
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.cardBorder,
    backgroundColor: tokens.color.cardBg,
  },
});
