import React, { useEffect, useState } from "react";
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from "react-native";
import { tokens } from "../theme";
import { IconButton } from "./IconButton";
import { ModalFrame } from "./ModalFrame";
import { StopRow } from "./StopRow";

// Harita WebView'inin ekran okuyucu alternatifi (design §6.1, FR-6.5). Leaflet DOM'u okunmaz;
// bunun yerine mevcut rota state'inden okunan durak listesi sunulur. Görsel arayüz değişmesin
// diye düğme yalnızca ekran okuyucu açıkken render edilir. Satırlar StopRow primitive'idir
// (design §4.2: gün rengi + numara; erişilebilir ad stopLabel() ile aynı kalır).
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
        icon="route"
        color={tokens.color.onPrimary}
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
                <View key={stop.id} style={styles.row}>
                  <StopRow
                    index={i + 1}
                    day={day}
                    name={stop.name}
                    category="map"
                    accessibilityLabel={stopLabel(day, i, stop)}
                    onPress={() => {
                      setOpen(false);
                      onSelectStop?.(stop.id, i);
                    }}
                  />
                </View>
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
  row: { paddingHorizontal: tokens.space["4"], paddingVertical: tokens.space["1"] },
  empty: { padding: tokens.space["4"], color: tokens.color.textMuted },
});
