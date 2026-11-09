// Alt sekme öğeleri (design §5.1 adlandırma sözlüğü, §5.3 tek IA): web MobileNav ile aynı
// etiket (tr.json nav.*) ve ikon. Parite testi (apps/web/tests/mobile-parity.test.cjs) eşitliği
// doğrular. Saf modül.
import type { IconName } from "../theme/icon-paths";
import type { MobileTab } from "../types";

export interface TabItem {
  labelKey: string;
  label: string;
  icon: IconName;
}

export const TAB_ITEMS: Record<MobileTab, TabItem> = {
  plan: { labelKey: "nav.desk", label: "Planla", icon: "map" },
  ai: { labelKey: "nav.ai", label: "Asistan", icon: "sparkle" },
  community: { labelKey: "nav.community", label: "Topluluk", icon: "users" },
  messages: { labelKey: "nav.messages", label: "Mesajlar", icon: "message" },
  profile: { labelKey: "nav.profile", label: "Profil", icon: "user" },
  login: { labelKey: "nav.signInShort", label: "Giriş", icon: "user" },
};
