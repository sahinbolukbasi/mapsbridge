import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { fontFamily, tokens, withAlpha } from "../theme";
import { tr } from "../i18n/ui";
import { Icon, type IconName } from "./Icon";
import { IconButton } from "./IconButton";
import { animate } from "./motion";
import { haptic } from "./haptics";
import { useReducedMotion } from "./useReducedMotion";
import {
  pauseTimer,
  resumeTimer,
  startTimer,
  timerProgress,
  toastDuration,
  type ToastTimer,
} from "./logic/toast-timing";
import { admitToast, releaseHeld } from "./logic/toast-hold";
import { openModalCount, subscribeModals } from "./modal-registry";
// Toast (web Toast ile aynı ad ve sözleşme, direction §3): ton başına sol şerit + ikonlu daire,
// isteğe bağlı başlık, gövde, eylem ("Geri al", "Tekrar dene") ve süre çubuğu. Hata (danger) ve
// eylemli toast kendiliğinden kapanmaz (logic/toast-timing.ts, web ile birebir). Basılı tutunca
// süre durur. Giriş: alttan 8 + .96 → yerinde; çıkış: sağa kayarak solma (motion.ts). Açık
// ModalFrame varken gelen toast bekletilir (logic/toast-hold.ts + modal-registry.ts).
export type ToastTone = "info" | "success" | "warning" | "danger";
type ToastAction = { label: string; onPress: () => void };
export type ToastInput = {
  tone?: ToastTone;
  title?: string;
  message: string;
  durationMs?: number;
  action?: ToastAction;
};
type ToastItem = {
  id: number;
  tone: ToastTone;
  title?: string;
  message: string;
  action?: ToastAction;
  duration: number | null;
};
export type ToastApi = { show: (t: ToastInput) => number; dismiss: (id: number) => void };
const ToastContext = createContext<ToastApi | null>(null);
/** Toaster yoksa çağrılar sessizce yok sayılır. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? { show: () => -1, dismiss: () => undefined };
}
type ToneLabel = "ui.alert.info" | "ui.alert.success" | "ui.alert.warning" | "ui.alert.danger";
const TONE: Record<ToastTone, { icon: IconName; accent: string; bg: string; label: ToneLabel }> = {
  info: {
    icon: "info",
    accent: tokens.color.infoIcon,
    bg: tokens.color.infoBg,
    label: "ui.alert.info",
  },
  success: {
    icon: "check",
    accent: tokens.color.successStrong,
    bg: tokens.color.successBg,
    label: "ui.alert.success",
  },
  warning: {
    icon: "alert",
    accent: tokens.color.warningIcon,
    bg: tokens.color.warningBg,
    label: "ui.alert.warning",
  },
  danger: {
    icon: "error",
    accent: tokens.color.dangerIcon,
    bg: tokens.color.dangerBg,
    label: "ui.alert.danger",
  },
};
function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const reduced = useReducedMotion();
  const tone = TONE[item.tone];
  const enter = useRef(new Animated.Value(0)).current;
  const leave = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(1)).current;
  const [paused, setPaused] = useState(false);
  const timer = useRef<ToastTimer | null>(
    item.duration === null ? null : startTimer(item.duration, Date.now()),
  );
  const leaving = useRef(false);
  const spoken = `${tr(tone.label)} ${item.title ? `${item.title}. ` : ""}${item.message}`;
  const close = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    animate(leave, 1, {
      duration: tokens.motion.duration.base,
      easing: "exit",
      useNativeDriver: true,
    }).start(() => onDismiss(item.id));
  }, [item.id, leave, onDismiss]);
  useEffect(() => {
    animate(enter, 1, {
      duration: tokens.motion.duration.slow,
      easing: "enter",
      useNativeDriver: true,
    }).start();
    if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(spoken);
    if (item.tone !== "info") haptic(item.tone === "danger" ? "error" : item.tone);
    // Yalnız ilk görünüşte.
  }, []);
  useEffect(() => {
    const current = timer.current;
    if (!current || item.duration === null) return;
    if (paused) {
      timer.current = pauseTimer(current, Date.now());
      bar.stopAnimation();
      return;
    }
    timer.current = resumeTimer(current, Date.now());
    const remaining = timer.current.remaining;
    bar.setValue(timerProgress(timer.current, item.duration, Date.now()));
    const anim = animate(bar, 0, { duration: remaining, easing: "linear", useNativeDriver: false });
    if (!reduced) anim.start();
    const handle = setTimeout(close, remaining);
    return () => {
      clearTimeout(handle);
      anim.stop();
    };
  }, [paused, item.duration, bar, close, reduced]);
  const style = {
    opacity: Animated.multiply(enter, Animated.subtract(1, leave)),
    transform: [
      {
        translateY: enter.interpolate({
          inputRange: [0, 1],
          outputRange: [tokens.motion.distance.md, 0],
        }),
      },
      {
        translateX: leave.interpolate({
          inputRange: [0, 1],
          outputRange: [0, tokens.motion.distance.lg * 3],
        }),
      },
      { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
    ],
  };
  return (
    <Animated.View
      style={[styles.toast, style]}
      accessibilityLiveRegion={item.tone === "danger" ? "assertive" : "polite"}
      accessibilityRole={item.tone === "danger" ? "alert" : "summary"}
    >
      <Pressable
        style={styles.row}
        onPressIn={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
        accessible={false}
        accessibilityRole="none"
      >
        <View style={[styles.stripe, { backgroundColor: tone.accent }]} />
        <View style={[styles.iconCircle, { backgroundColor: tone.bg }]}>
          <Icon name={tone.icon} size={16} color={tone.accent} />
        </View>
        <View style={styles.body} accessible accessibilityLabel={spoken}>
          {item.title ? (
            <Text
              style={[styles.title, { fontFamily: fontFamily("bold") }]}
              maxFontSizeMultiplier={tokens.font.maxScale.compact}
            >
              {item.title}
            </Text>
          ) : null}
          <Text style={styles.message} maxFontSizeMultiplier={tokens.font.maxScale.compact}>
            {item.message}
          </Text>
        </View>
        {item.action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.action.label}
            onPress={() => {
              item.action?.onPress();
              close();
            }}
            style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
          >
            <Text style={styles.actionLabel} maxFontSizeMultiplier={tokens.font.maxScale.compact}>
              {item.action.label}
            </Text>
          </Pressable>
        ) : null}
        <IconButton
          icon="x"
          label={tr("ui.close")}
          size={36}
          onPress={close}
          color={tokens.color.textMuted}
        />
      </Pressable>
      {item.duration !== null && !reduced ? (
        <Animated.View
          style={[styles.timer, { backgroundColor: tone.accent, transform: [{ scaleX: bar }] }]}
        />
      ) : null}
    </Animated.View>
  );
}
/**
 * Uygulama kökünde tek örnek (App.tsx). Konum: alt menünün üstü (`bottomOffset`).
 */
export function Toaster({
  children,
  bottomOffset = 0,
}: {
  children?: React.ReactNode;
  bottomOffset?: number;
}) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const held = useRef<ToastItem[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => {
    held.current = held.current.filter((i) => i.id !== id);
    setItems((list) => list.filter((i) => i.id !== id));
  }, []);
  const show = useCallback((input: ToastInput) => {
    const id = nextId.current++;
    const tone = input.tone ?? "info";
    const item: ToastItem = {
      id,
      tone,
      title: input.title,
      message: input.message,
      action: input.action,
      duration: toastDuration({
        tone,
        hasAction: Boolean(input.action),
        durationMs: input.action ? undefined : input.durationMs,
      }),
    };
    if (admitToast(openModalCount() > 0) === "hold") held.current = [...held.current, item];
    else setItems((list) => [...list.slice(-2), item]);
    return id;
  }, []);
  useEffect(
    () =>
      subscribeModals((count) => {
        if (held.current.length === 0) return;
        const { show: ready, keep } = releaseHeld(held.current, count > 0);
        held.current = keep;
        if (ready.length) setItems((list) => [...list, ...ready].slice(-3));
      }),
    [],
  );
  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <View
        pointerEvents="box-none"
        style={[styles.region, { bottom: bottomOffset + tokens.space["3"] }]}
      >
        {items.map((i) => (
          <ToastView key={i.id} item={i} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}
const styles = StyleSheet.create({
  region: {
    position: "absolute",
    left: tokens.space["3"],
    right: tokens.space["3"],
    gap: tokens.space["2"],
    alignItems: "center",
  },
  toast: {
    width: "100%",
    maxWidth: 480,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    overflow: "hidden",
    ...tokens.shadow.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["3"],
    paddingVertical: tokens.space["3"],
    paddingRight: tokens.space["2"],
    minHeight: tokens.touch.min + tokens.space["2"],
  },
  stripe: { alignSelf: "stretch", width: 4 },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 2 },
  title: {
    fontSize: tokens.font.size.md,
    fontWeight: tokens.font.weight.bold,
    color: tokens.color.text,
  },
  message: { fontSize: tokens.font.size.sm, color: tokens.color.textMuted },
  action: {
    minHeight: tokens.touch.min,
    justifyContent: "center",
    paddingHorizontal: tokens.space["2"],
    borderRadius: tokens.radius.sm,
  },
  actionLabel: {
    fontSize: tokens.font.size.sm,
    fontWeight: tokens.font.weight.bold,
    color: tokens.color.buttonLinkFg,
  },
  pressed: { backgroundColor: withAlpha(tokens.color.brand, 0.1) },
  timer: { height: 3, width: "100%", transformOrigin: "left" },
});
