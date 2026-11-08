import React, { Component, ErrorInfo, ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Button, EmptyState, SafeArea } from "../ui";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";

// Ekran-düzeyi hata sınırı (mobil dayanıklılık): tek bir sekme/ekran render sırasında throw
// ederse yalnız o ekran yerine yerelleştirilmiş bir hata durumu çizilir; diğer sekmeler, alt menü
// ve kök ErrorBoundary ayakta kalır. Kök ErrorBoundary (App.tsx) son çare olarak korunur.
// "Tekrar dene" `key`'i artırarak çocukları yeniden mount eder (yalnız hasError sıfırlamaz), böylece
// geçici bir mount hatası (ör. ağ/konum) gerçekten yeniden denenir.
interface Props {
  children: ReactNode;
  /** Teşhis logunda ekranı ayırt etmek için (örn. sekme adı). */
  name?: string;
  /** Hata yakalandığında üst katmana bildirir (opsiyonel; log/telemetri). */
  onError?: (error: Error, info: ErrorInfo, name?: string) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  resetKey: number;
}

export class ScreenErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    resetKey: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn(
      `[ScreenErrorBoundary${this.props.name ? `:${this.props.name}` : ""}] Ekran hatası:`,
      error,
      errorInfo,
    );
    this.props.onError?.(error, errorInfo, this.props.name);
  }

  private handleRetry = () => {
    // key'i artır → children yeniden mount olur; hata sıfırlanır.
    this.setState((prev) => ({ hasError: false, error: null, resetKey: prev.resetKey + 1 }));
  };

  public render() {
    if (this.state.hasError) {
      return (
        <SafeArea style={styles.container}>
          <View accessibilityRole="alert">
            <EmptyState
              icon="alert"
              contour
              title={tr("native.error.screenTitle")}
              description={tr("native.error.screenBody")}
              action={
                <Button
                  label={tr("ui.retry")}
                  variant="primary"
                  size="lg"
                  onPress={this.handleRetry}
                />
              }
            />
          </View>
        </SafeArea>
      );
    }

    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: tokens.space["5"],
  },
});
