import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView } from 'react-native';

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
    console.warn('[ErrorBoundary] Caught runtime exception:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.card}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>SİSTEM KURTARMA</Text>
            </View>
            <Text style={styles.title}>Uygulama Güvenle Kurtarıldı</Text>
            <Text style={styles.message}>
              Beklenmedik bir ekran yükleme sorunu oluştu. Verileriniz koruma altında tutulmaktadır.
            </Text>
            {this.state.error?.message && (
              <Text style={styles.detail} numberOfLines={3}>
                {this.state.error.message}
              </Text>
            )}
            <TouchableOpacity style={styles.button} onPress={this.handleReset} activeOpacity={0.85}>
              <Text style={styles.buttonText}>Yeniden Başlat</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020e0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#0d281e',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#1e4d3e',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#34d399',
    marginBottom: 16,
  },
  badgeText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  detail: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#f87171',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 10,
    borderRadius: 8,
    width: '100%',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#10b981',
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 999,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
