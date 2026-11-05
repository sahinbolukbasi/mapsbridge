import { createContext } from "react";

// Sekme ekranları açık kaldığından (App.tsx, design §8.3) birden fazla Screen aynı anda bağlıdır.
// Yalnızca görünür ekran StatusBar stilini belirler: Screen, bu bağlam false iken <StatusBar>
// çizmez; sekme yeniden görünür olunca StatusBar tekrar bağlanır ve stil o ekrana döner.
export const ScreenFocusContext = createContext(true);
