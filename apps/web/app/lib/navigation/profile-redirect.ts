// /profile/ eski sekme bağlantıları (design §5.1, §5.2): "Rotalarım" planlayıcının rota
// seçicisine taşındı. `?tab=routes` sayfa içinde /maps/?view=trips'e yönlenir; /profile/
// kanonik URL olarak kalır (LEGACY değil). Diğer değerler yok sayılır. Saf modül.
const MOVED_TABS: Readonly<Record<string, string>> = {
  routes: "/maps/?view=trips",
};

/** search ("?tab=routes" ya da "tab=routes") için hedef yol, yoksa null. */
export function profileTabRedirect(search: string): string | null {
  const tab = new URLSearchParams(search).get("tab");
  return tab ? (MOVED_TABS[tab.trim().toLowerCase()] ?? null) : null;
}
