import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { tokens } from "../theme";
import { MapPinIcon } from "../components/Icons";
import { IconButton } from "./IconButton";
import { ModalFrame } from "./ModalFrame";

// Harita WebView'inin ekran okuyucu alternatifi (design §6.1, FR-6.5). Leaflet DOM'u okunmaz;
// bunun yerine mevcut rota state'inden okunan durak listesi sunulur. Görsel arayüz değişmesin
// diye düğme yalnızca ekran okuyucu açıkken render edilir.
export interface StopItem {
  id: string;
  name: string;
  duration?: string;
}

export interface AccessibleStopListProps {
  day: number;
  stops: StopItem[];
  onSelectStop?: (id: string, index: number) => void;
}

export function mapLabel(count: number): string {
  return `Harita: ${count} durak`;
}

export function stopLabel(day: number, index: number, stop: StopItem): string {
  return `${day}. gün, ${index + 1}. durak: ${stop.name}${stop.duration ? `, ${stop.duration}` : ""}`;
}

export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((v) => alive && setEnabled(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("screenReaderChanged", setEnabled);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return enabled;
}

export function AccessibleStopList({ day, stops, onSelectStop }: AccessibleStopListProps) {
  const screenReader = useScreenReaderEnabled();
  const [open, setOpen] = useState(false);
  if (!screenReader) return null;
  return (
    <View style={styles.trigger}>
      <IconButton
        label="Durak listesini göster"
        onPress={() => setOpen(true)}
        icon={<MapPinIcon size={20} color={tokens.color.onPrimary} />}
        style={styles.triggerButton}
      />
      <ModalFrame
        visible={open}
        variant="sheet"
        title="Duraklar"
        onRequestClose={() => setOpen(false)}
      >
        <ScrollView>
          <View accessibilityRole="list">
            {stops.length === 0 ? (
              <Text style={styles.empty} maxFontSizeMultiplier={tokens.font.maxScale.body}>
                Bu rotada henüz durak yok.
              </Text>
            ) : (
              stops.map((stop, i) => (
                <TouchableOpacity
                  key={stop.id}
                  accessibilityRole="button"
                  accessibilityLabel={stopLabel(day, i, stop)}
                  onPress={() => {
                    setOpen(false);
                    onSelectStop?.(stop.id, i);
                  }}
                  style={styles.row}
                >
                  <Text style={styles.rowText} maxFontSizeMultiplier={tokens.font.maxScale.body}>
                    {stopLabel(day, i, stop)}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      </ModalFrame>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: { position: "absolute", left: tokens.space["4"], bottom: tokens.space["4"], zIndex: 60 },
  triggerButton: { backgroundColor: tokens.color.primary },
  row: {
    minHeight: tokens.touch.min,
    justifyContent: "center",
    paddingHorizontal: tokens.space["4"],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.border,
  },
  rowText: { fontSize: tokens.font.size.base, color: tokens.color.text },
  empty: { padding: tokens.space["4"], color: tokens.color.textMuted },
});
