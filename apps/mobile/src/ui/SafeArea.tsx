import React from "react";
import {
  Platform,
  SafeAreaView,
  StatusBar,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";

// Güvenli alan (design §7.3, R5-6). RN çekirdek SafeAreaView'ı (deprecated) yalnızca burada
// kullanılır. iOS'ta bugünkü davranış: görünümle örtüşen TÜM kenarların inset'i padding olur.
// Android'de çekirdek SafeAreaView no-op olduğundan düz View çizilir ve varsayılan olarak üst
// boşluk eklenmez (ekranlardaki manuel Android ofsetleri bu sayede değişmeden çalışır).
// Kenar seçimi (`edges`) bilinçli olarak YOK: çekirdek bileşen bunu desteklemez (F-14).
export interface SafeAreaProps extends Omit<ViewProps, "style"> {
  /** Android'de durum çubuğu yüksekliği kadar üst boşluk. Bu işte hiçbir kökte açılmaz (F-14). */
  androidTopInset?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function SafeArea({ androidTopInset = false, style, children, ...rest }: SafeAreaProps) {
  if (Platform.OS === "ios") {
    return (
      <SafeAreaView {...rest} style={style}>
        {children}
      </SafeAreaView>
    );
  }
  const inset = androidTopInset ? { paddingTop: StatusBar.currentHeight ?? 0 } : null;
  return (
    <View {...rest} style={[style, inset]}>
      {children}
    </View>
  );
}
