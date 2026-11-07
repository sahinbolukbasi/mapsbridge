import React, { createContext, useContext, useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
  findNodeHandle,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { tokens } from "../theme";
import { tr } from "../i18n/ui";
import { IconButton } from "./IconButton";
import { SafeArea } from "./SafeArea";
import { useReducedMotion } from "./useReducedMotion";
import { animate } from "./motion";
import { modalPresentation, type ModalPresentation } from "./logic/modal-presentation";
import { modalClosed, modalOpened } from "./modal-registry";
// Modal çerçevesi (design §7.3, R10 / approval ruleChanges a). RN <Modal> yalnızca burada.
// Sunum logic/modal-presentation.ts (web ile birebir): sheet yalnız dar ekranda (<768 dp) alttan
// kayar; ≥768 dp (tablet) her modal ortalı dialogdur: solma + kart translateY(8) scale(.96) → 1
// (motion.ts, --duration-slow / easing enter). Hareket azaltmada animationType "none".
// - fullscreen: opak, SafeArea kökü.
// - sheet: <768 iOS pageSheet / Android tam sayfa kayma; ≥768 iOS formSheet, Android ortalı kart.
// - dialog: her genişlikte ortalı kart.
// - bottomSheet: <768 alttan kart; ≥768 ortalı kart.
// Erişilebilirlik: içerik kökü accessibilityViewIsModal; onRequestClose HER ZAMAN verilir
// (Android geri tuşu; dismissible=false iken no-op). title: fullscreen/sheet'te başlık satırı
// (header rolü, açılışta odak, "Kapat" düğmesi); dialog/bottomSheet'te kökün erişilebilir adı.
export type ModalVariant = "fullscreen" | "sheet" | "dialog" | "bottomSheet";
/** ≥ bu genişlikte (dp) sheet sunumu ortalı dialoga döner (web 768 px eşiği). */
export const TABLET_MIN_WIDTH = 768;
export interface ModalFrameProps {
  visible: boolean;
  onRequestClose?: () => void;
  title?: string;
  variant: ModalVariant;
  dismissible?: boolean;
  animation?: "slide" | "fade";
  /**
   * İçerik kökünün stili. dialog/bottomSheet'te verilirse varsayılan scrim/hizalama yerine
   * yalnız bu stil uygulanır (bugünkü örtü stilleri birebir korunur).
   */
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}
/** Çocuklar sunumu okuyabilir (ör. alt köşe yuvarlaması yalnız dialogda). */
export const ModalPresentationContext = createContext<ModalPresentation>("dialog");
export function useModalPresentation(): ModalPresentation {
  return useContext(ModalPresentationContext);
}
const noop = () => undefined;
/** Sunum kararı: varyant + pencere genişliği (saf; web modalPresentation'ı sarar). */
export function framePresentation(variant: ModalVariant, width: number): ModalPresentation {
  if (variant === "dialog" || variant === "fullscreen") return "dialog";
  return modalPresentation("sheet", width < TABLET_MIN_WIDTH);
}
export function ModalFrame({
  visible,
  onRequestClose,
  title,
  variant,
  dismissible = true,
  animation,
  style,
  children,
}: ModalFrameProps) {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const titleRef = useRef<Text>(null);
  const close = dismissible && onRequestClose ? onRequestClose : noop;
  const presentation = framePresentation(variant, width);
  // Tablette sheet/bottomSheet ortalı karta döner; iOS sheet'i yerel formSheet sunar.
  const iosFormSheet = variant === "sheet" && presentation === "dialog" && Platform.OS === "ios";
  const centeredCard =
    variant === "dialog" ||
    (presentation === "dialog" && variant === "bottomSheet") ||
    (presentation === "dialog" && variant === "sheet" && !iosFormSheet);
  const lift = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible) return;
    modalOpened();
    return () => modalClosed();
  }, [visible]);
  useEffect(() => {
    if (!visible || !centeredCard) return;
    lift.setValue(0);
    animate(lift, 1, {
      duration: tokens.motion.duration.slow,
      easing: "enter",
      useNativeDriver: true,
    }).start();
  }, [visible, centeredCard, lift]);
  useEffect(() => {
    if (!visible || !title || variant === "dialog" || variant === "bottomSheet") return;
    const t = setTimeout(() => {
      const node = titleRef.current ? findNodeHandle(titleRef.current) : null;
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 300);
    return () => clearTimeout(t);
  }, [visible, title, variant]);
  const header = title ? (
    <View style={styles.titleRow}>
      <Text
        ref={titleRef}
        style={styles.title}
        accessibilityRole="header"
        maxFontSizeMultiplier={tokens.font.maxScale.compact}
      >
        {title}
      </Text>
      {dismissible && onRequestClose ? (
        <IconButton
          label={tr("ui.close")}
          onPress={onRequestClose}
          icon="x"
          color={tokens.color.textMuted}
        />
      ) : null}
    </View>
  ) : null;
  const animationType = reduced
    ? "none"
    : (animation ?? (centeredCard || iosFormSheet ? "fade" : "slide"));
  const overlay = centeredCard || variant === "bottomSheet";
  const cardMotion = {
    opacity: lift,
    transform: [
      {
        translateY: lift.interpolate({
          inputRange: [0, 1],
          outputRange: [tokens.motion.distance.md, 0],
        }),
      },
      { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
    ],
  };
  // Tablette sheet/bottomSheet içeriği ortalı, sınırlı genişlikte ve tüm köşeleri yuvarlak kart.
  const tabletCard = centeredCard && variant !== "dialog";
  let body: React.ReactNode;
  if (overlay) {
    const content =
      variant === "sheet" ? (
        <View style={[styles.page, style]}>
          {header}
          {children}
        </View>
      ) : (
        children
      );
    body = (
      <View
        accessibilityViewIsModal={true}
        accessibilityLabel={title}
        style={
          style && variant !== "sheet"
            ? [styles.fill, style, tabletCard ? styles.center : null]
            : [styles.overlay, centeredCard ? styles.center : styles.bottom]
        }
      >
        {centeredCard ? (
          <Animated.View
            style={[
              tabletCard ? styles.tabletCard : null,
              variant === "sheet" ? styles.tabletSheet : null,
              cardMotion,
            ]}
          >
            {content}
          </Animated.View>
        ) : (
          content
        )}
      </View>
    );
  } else {
    body = (
      <SafeArea accessibilityViewIsModal={true} style={[styles.page, style]}>
        {header}
        {children}
      </SafeArea>
    );
  }
  return (
    <Modal
      visible={visible}
      animationType={animationType}
      transparent={overlay}
      presentationStyle={
        overlay
          ? undefined
          : variant === "sheet"
            ? iosFormSheet
              ? "formSheet"
              : "pageSheet"
            : undefined
      }
      supportedOrientations={["portrait", "landscape"]}
      onRequestClose={close}
    >
      <ModalPresentationContext.Provider value={presentation}>
        {body}
      </ModalPresentationContext.Provider>
    </Modal>
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { flex: 1, backgroundColor: tokens.color.scrim },
  center: { justifyContent: "center", alignItems: "center", padding: tokens.space["5"] },
  bottom: { justifyContent: "flex-end" },
  page: { flex: 1, backgroundColor: tokens.color.surface },
  tabletCard: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "90%",
    borderRadius: tokens.radius.xl,
    overflow: "hidden",
    backgroundColor: tokens.color.sheetBg,
    ...tokens.shadow.lg,
  },
  // Android tablette tam sayfa sheet: sabit yükseklik (içerideki flex:1 kaydırma alanı için).
  tabletSheet: { maxWidth: 640, height: "85%" },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.space["4"],
    paddingVertical: tokens.space["2"],
  },
  title: {
    flex: 1,
    fontSize: tokens.font.size.lg,
    fontWeight: tokens.font.weight.bold,
    color: tokens.color.text,
  },
});
