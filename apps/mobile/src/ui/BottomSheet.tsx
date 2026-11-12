import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, View } from "react-native";
import { tokens } from "../theme";
import { tr } from "../i18n/ui";
import { spring } from "./motion";
import {
  SHEET_DRAG_THRESHOLD,
  nextSnap,
  orderedSnaps,
  snapFromDrag,
  type SheetSnap,
} from "./logic/sheet-snap";

// Mobil kalıcı panel (design §4.2, §8.2, R3): web BottomSheet ile aynı prop sözlüğü ve aynı snap
// mantığı (logic/sheet-snap.ts, parite testli). Modal değildir: arka plan (harita) etkileşimli
// kalır. Kabın tamamını kaplayan katmana (pointerEvents box-none) yerleşir; görünür yükseklik
// snap'e göre kabın %25 / %55 / %92'si (web --sheet-peek/half/full). Tutamak bir düğmedir:
// dokunma snap'ler arasında döner, ekran okuyucu "genişlet/daralt" eylemleri ↑/↓ karşılığıdır,
// sürükleme PanResponder ile; bırakınca motion.spring(…, "sheet") ile oturur (reduce: anında).
export type { SheetSnap };

const RATIO: Record<SheetSnap, number> = { peek: 0.35, half: 0.58, full: 0.92 };
const HANDLE_HEIGHT = tokens.touch.min;

export interface BottomSheetProps {
  snap: readonly SheetSnap[];
  initial?: SheetSnap;
  label: string;
  /** Tutamağın erişilebilir adı (varsayılan "Paneli genişlet" / "Paneli daralt"). */
  expandLabel?: string;
  collapseLabel?: string;
  /** Kontrollü kullanım: verilirse geçerli snap budur; değişiklik onSnapChange ile bildirilir. */
  value?: SheetSnap;
  onSnapChange?: (snap: SheetSnap) => void;
  children: React.ReactNode;
}

export function BottomSheet({
  snap,
  initial,
  label,
  expandLabel = tr("ui.sheet.expand"),
  collapseLabel = tr("ui.sheet.collapse"),
  value,
  onSnapChange,
  children,
}: BottomSheetProps) {
  const order = useMemo(() => orderedSnaps(snap), [snap]);
  const [internal, setInternal] = useState<SheetSnap>(
    initial && order.includes(initial) ? initial : (order[0] ?? "peek"),
  );
  const current = value && order.includes(value) ? value : internal;
  const [height, setHeight] = useState(0);
  const translate = useRef(new Animated.Value(0)).current;

  const offsetFor = (s: SheetSnap) => height * (RATIO.full - RATIO[s]);
  const live = useRef({ current, order, height, offsetFor, setCurrent: (_s: SheetSnap) => {} });
  const setCurrent = (next: SheetSnap) => {
    setInternal(next);
    onSnapChange?.(next);
  };
  live.current = { current, order, height, offsetFor, setCurrent };

  useEffect(() => {
    if (height <= 0) return;
    spring(translate, offsetFor(current), "sheet", true).start();
    // offsetFor yalnızca height'a bağlıdır.
  }, [current, height, translate]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
        onPanResponderMove: (_e, g) => {
          const s = live.current;
          const base = s.offsetFor(s.current);
          const lowest = s.offsetFor(s.order[0] ?? "peek");
          const highest = s.offsetFor(s.order[s.order.length - 1] ?? "full");
          translate.setValue(Math.min(lowest, Math.max(highest, base + g.dy)));
        },
        onPanResponderRelease: (_e, g) => {
          const s = live.current;
          const next = snapFromDrag(g.dy, s.current, s.order, SHEET_DRAG_THRESHOLD);
          if (next === s.current) spring(translate, s.offsetFor(next), "sheet", true).start();
          else s.setCurrent(next);
        },
        onPanResponderTerminate: () => {
          const s = live.current;
          spring(translate, s.offsetFor(s.current), "sheet", true).start();
        },
      }),
    [translate],
  );

  const atTop = current === order[order.length - 1];
  const step = (input: string) => {
    const next = nextSnap(current, input, order);
    if (next && next !== current) setCurrent(next);
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
    >
      {height > 0 ? (
        <Animated.View
          accessibilityLabel={label}
          style={[
            styles.sheet,
            { height: height * RATIO.full, transform: [{ translateY: translate }] },
          ]}
        >
          <View {...pan.panHandlers}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={atTop ? collapseLabel : expandLabel}
              accessibilityState={{ expanded: current !== order[0] }}
              // Adlı özel eylemler (FEAT-011 review #4): iOS increment/decrement'ı yalnızca
              // "adjustable" öğede eşler; özel adlar VoiceOver rotor "Eylemler" ve TalkBack eylem
              // menüsünde görünür. Çift dokunma (activate → onPress) sırayla snap'ler arasında döner.
              accessibilityActions={[
                { name: "expand", label: expandLabel },
                { name: "collapse", label: collapseLabel },
              ]}
              onAccessibilityAction={(e) =>
                step(e.nativeEvent.actionName === "expand" ? "up" : "down")
              }
              onPress={() => step("Enter")}
              style={styles.handle}
            >
              <View style={styles.grip} />
            </Pressable>
          </View>
          <View style={styles.body}>{children}</View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.sheetBg,
    ...tokens.shadow.lg,
  },
  handle: {
    height: HANDLE_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  grip: {
    width: 40,
    height: 4,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.sheetHandle,
  },
  body: { flex: 1 },
});
