import React, { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Modal,
  StyleSheet,
  Text,
  View,
  findNodeHandle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { tokens } from "../theme";
import { CloseIcon } from "../components/Icons";
import { IconButton } from "./IconButton";
import { SafeArea } from "./SafeArea";
import { useReducedMotion } from "./useReducedMotion";

// Modal çerçevesi (design §7.3). RN <Modal> yalnızca burada kullanılır.
// - fullscreen: opak, SafeArea kökü (iOS'ta üst+alt inset çekirdek davranıştan).
// - sheet: iOS pageSheet sunumu + SafeArea kökü.
// - dialog / bottomSheet: saydam modal, scrim zemini; kart ortada / altta.
// Erişilebilirlik: içerik kökü accessibilityViewIsModal; onRequestClose HER ZAMAN verilir
// (Android geri tuşu; dismissible=false iken no-op). title: fullscreen/sheet'te başlık satırı
// (header rolü, açılışta odak, "Kapat" düğmesi); dialog/bottomSheet'te kökün erişilebilir adı.
export type ModalVariant = "fullscreen" | "sheet" | "dialog" | "bottomSheet";

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

const noop = () => undefined;

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
  const titleRef = useRef<Text>(null);
  const close = dismissible && onRequestClose ? onRequestClose : noop;

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
          label="Kapat"
          onPress={onRequestClose}
          icon={<CloseIcon size={18} color={tokens.color.textMuted} />}
        />
      ) : null}
    </View>
  ) : null;

  const animationType = reduced ? "none" : (animation ?? (variant === "dialog" ? "fade" : "slide"));
  const overlay = variant === "dialog" || variant === "bottomSheet";

  return (
    <Modal
      visible={visible}
      animationType={animationType}
      transparent={overlay}
      presentationStyle={variant === "sheet" ? "pageSheet" : undefined}
      onRequestClose={close}
    >
      {overlay ? (
        <View
          accessibilityViewIsModal={true}
          accessibilityLabel={title}
          style={
            style
              ? [styles.fill, style]
              : [styles.overlay, variant === "dialog" ? styles.center : styles.bottom]
          }
        >
          {children}
        </View>
      ) : (
        <SafeArea accessibilityViewIsModal={true} style={[styles.page, style]}>
          {header}
          {children}
        </SafeArea>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { flex: 1, backgroundColor: tokens.color.scrim },
  center: { justifyContent: "center", alignItems: "center", padding: tokens.space["5"] },
  bottom: { justifyContent: "flex-end" },
  page: { flex: 1, backgroundColor: tokens.color.surface },
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
