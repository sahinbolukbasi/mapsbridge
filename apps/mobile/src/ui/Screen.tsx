import React, { useContext } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { relativeLuminance, tokens, type ColorToken } from "../theme";
import { SafeArea } from "./SafeArea";
import { ScreenFocusContext } from "./screen-focus";

// Ekran kökü (design §7.3): SafeArea + ekran başına tek StatusBar + isteğe bağlı header,
// kaydırma ve klavye kaçınma. `statusBar` verilmezse zeminin göreli parlaklığından seçilir
// (L < 0.2 → açık içerik). `backgroundColor` iOS'ta etkisiz, Android edge-to-edge'de no-op;
// yine de aynı token'la verilir (edge-to-edge kapanırsa doğru kalır).
export interface ScreenProps {
  header?: React.ReactNode;
  scroll?: boolean;
  keyboardAvoiding?: boolean;
  statusBar?: "dark" | "light";
  background?: ColorToken;
  /** Kökün ek stili (bugünkü ekran kök stilleri birebir korunur). */
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function Screen({
  header,
  scroll = false,
  keyboardAvoiding = false,
  statusBar,
  background = "bg",
  style,
  children,
}: ScreenProps) {
  const focused = useContext(ScreenFocusContext);
  const bg = tokens.color[background];
  const bar = statusBar ?? (relativeLuminance(bg) < 0.2 ? "light" : "dark");
  let body: React.ReactNode = children;
  if (scroll) {
    body = (
      <ScrollView style={styles.fill} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>
    );
  }
  if (keyboardAvoiding) {
    body = (
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {body}
      </KeyboardAvoidingView>
    );
  }
  return (
    <SafeArea style={[styles.fill, { backgroundColor: bg }, style]}>
      {focused ? (
        <StatusBar
          barStyle={bar === "light" ? "light-content" : "dark-content"}
          backgroundColor={bg}
        />
      ) : null}
      {header}
      {body}
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
