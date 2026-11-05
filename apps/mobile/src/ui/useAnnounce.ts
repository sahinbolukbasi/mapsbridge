import { useEffect, useRef } from "react";
import { AccessibilityInfo, Platform } from "react-native";

// iOS canlı bölge eşleniği (FEAT-011 review #3): `accessibilityLiveRegion` yalnızca Android'de
// çalışır. iOS'ta VoiceOver'a değişen metni `announceForAccessibility` ile okutur. İlk render'da
// okunmaz (yalnızca değişim duyurulur); Android'de canlı bölge zaten okuduğu için çift okuma olmaz.
export function useAnnounce(message: string | undefined | null): void {
  const previous = useRef(message);
  useEffect(() => {
    if (previous.current === message) return;
    previous.current = message;
    if (Platform.OS === "ios" && message) AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
}
