// react-native hafif stub (resilience.test.cjs). Node'da RN kurulu değildir; yalnız sarmalayıcıların
// dokunduğu yüzeyler taklit edilir. Davranış globalThis.__expo ile sürülmez (RN değil); sabittir.
const noop = () => {};

const Platform = { OS: "ios", select: (o) => (o && (o.ios ?? o.default)) };

const Linking = {
  openSettings: async () => undefined,
  openURL: async () => undefined,
  canOpenURL: async () => true,
  addEventListener: () => ({ remove: noop }),
  getInitialURL: async () => null,
};

const AccessibilityInfo = {
  isReduceMotionEnabled: async () => false,
  addEventListener: () => ({ remove: noop }),
  announceForAccessibility: noop,
};

// StyleSheet.create çağrısını destekler (stiller test edilmez).
const StyleSheet = { create: (s) => s, flatten: (s) => s, hairlineWidth: 1 };

// View/Text vb. yalnız marker olarak gerekir (ScreenErrorBoundary stub'ları zaten ui.cjs'de).
const View = "View";
const Text = "Text";

module.exports = {
  Platform,
  Linking,
  AccessibilityInfo,
  StyleSheet,
  View,
  Text,
  Alert: { alert: noop },
};
