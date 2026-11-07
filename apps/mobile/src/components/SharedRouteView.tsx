import React from "react";
import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { ModalFrame } from "../ui";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";
import { shareCodeUrl } from "../share/share-code";
// Paylaşım kodu derin bağlantısı (K4): `/k/?code=` web görüntüleyicisi uygulama içinde açılır
// (hesapsız; aynı evrensel bağlantıyı dışarı açmak uygulamaya geri döngü yaratırdı). Yalnız
// mapsbridge.com içinde gezinilir; dış bağlantılar sistem tarayıcısına gitmez, engellenir.
export function SharedRouteView({ code, onClose }: { code: string | null; onClose: () => void }) {
  return (
    <ModalFrame
      visible={!!code}
      variant="sheet"
      title={tr("native.shared.title")}
      onRequestClose={onClose}
    >
      {code ? (
        <WebView
          source={{ uri: shareCodeUrl(code) }}
          style={styles.web}
          accessibilityLabel={tr("native.shared.webview")}
          originWhitelist={["https://mapsbridge.com", "https://www.mapsbridge.com"]}
          onShouldStartLoadWithRequest={(req) =>
            /^https:\/\/(www\.)?mapsbridge\.com(\/|$)/.test(req.url) ||
            req.url.startsWith("https://tile.openstreetmap.org") ||
            req.url === "about:blank"
          }
          javaScriptEnabled
          domStorageEnabled
        />
      ) : null}
    </ModalFrame>
  );
}
const styles = StyleSheet.create({ web: { flex: 1, backgroundColor: tokens.color.bg } });
