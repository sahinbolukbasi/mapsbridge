import { useContext, useEffect, useRef } from "react";
import { BackHandler } from "react-native";
import { ScreenFocusContext } from "./screen-focus";

// Ekran içi alt görünüm için Android geri tuşu (design §12.1: önce ekranın kendi yığını). Sekme
// ekranları açık kaldığından yalnızca görünür ekran (ScreenFocusContext) dinler. Sonra kaydedilen
// dinleyici önce çalışır; `enabled` iken true dönerek App'in sekme yığınına geçişi durdurur.
export function useBackHandler(enabled: boolean, onBack: () => void): void {
  const focused = useContext(ScreenFocusContext);
  const handler = useRef(onBack);
  handler.current = onBack;
  useEffect(() => {
    if (!enabled || !focused) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handler.current();
      return true;
    });
    return () => sub.remove();
  }, [enabled, focused]);
}
