import { createContext, useContext } from "react";
// Biyometrik kilit durumu (K4). RN Modal bileşeni ayrı bir yerel pencerede çizildiğinden kök görünümdeki
// LockScreen'in üstünde kalır; bu yüzden ModalFrame kilitliyken modalı gizler (visible && !locked),
// kilit açılınca modal kaldığı yerden yeniden görünür. Sağlayıcı App.tsx'tedir.
export const LockContext = createContext(false);
export function useAppLocked(): boolean {
  return useContext(LockContext);
}
