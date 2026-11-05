// Native yazı tipi dosyaları (design §9 parite, karar S13): Inter (gövde) ve Plus Jakarta Sans
// (başlık) resmi sürümlerinden TTF, OFL-1.1 (lisanslar assets/fonts/*-OFL.txt). expo-font woff2
// yükleyemez; her ağırlık ayrı bir aile adıyla kaydedilir (Android ağırlığı aile adından seçer).
// Anahtarlar `fontFamily()` (theme/index.ts) dönüş değerleridir; App.tsx `useFonts(FONT_SOURCES)`.
/* eslint-disable @typescript-eslint/no-require-imports -- Metro varlıkları require() ile çözülür */
export const FONT_SOURCES = {
  "Inter-Regular": require("../../assets/fonts/Inter-Regular.ttf"),
  "Inter-Medium": require("../../assets/fonts/Inter-Medium.ttf"),
  "Inter-SemiBold": require("../../assets/fonts/Inter-SemiBold.ttf"),
  "Inter-Bold": require("../../assets/fonts/Inter-Bold.ttf"),
  "PlusJakartaSans-Bold": require("../../assets/fonts/PlusJakartaSans-Bold.ttf"),
  "PlusJakartaSans-ExtraBold": require("../../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
} as const;
/* eslint-enable @typescript-eslint/no-require-imports */

export type FontFace = keyof typeof FONT_SOURCES;
