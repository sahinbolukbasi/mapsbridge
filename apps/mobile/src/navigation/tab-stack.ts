// Sekme başına ekran yığını ve geri davranışı (design §5.5 J6, §8.3, §9 "Geri", §12.1; plan
// FEAT-011). Saf modül: React Native import'u yok, App.tsx Android BackHandler'a bağlar.
// Kütüphane yok (react-navigation reddedildi, design §16): her sekmenin kök ekranı sekmenin
// kendisidir; üstüne itilen ekranlar `stacks[tab]`'de durur. Sekme ekranları unmount edilmez
// (kaydırma konumu korunur); yığından çıkan ekran unmount olur.
//
// Geri sırası (design §12.1): üstteki ekranı kapat → önceki sekmeye dön → Planla → sistem
// varsayılanı (uygulamadan çık: handled=false).

export interface TabNavState<Tab extends string, Screen extends string> {
  /** Etkin sekme. */
  tab: Tab;
  /** Daha önce etkin olan sekmeler (en eski başta, tekil; etkin sekme içermez). */
  history: Tab[];
  /** Sekme kökünün üstüne itilmiş ekranlar (en üstteki sonda). */
  stacks: Partial<Record<Tab, Screen[]>>;
}

export type TabNavAction<Tab extends string, Screen extends string> =
  /** Sekmeye geç; zaten etkinse o sekmenin yığınını köke indir (sekmeye yeniden dokunma). */
  | { type: "select"; tab: Tab }
  /** Ekran it; `tab` verilirse önce o sekmeye geçilir. */
  | { type: "push"; screen: Screen; tab?: Tab }
  /** Etkin sekmenin en üstteki ekranını kapat (yığın boşsa değişiklik yok). */
  | { type: "pop" }
  /** Tüm gezinmeyi sıfırla (oturum açılınca/kapanınca sekme seti değişir). */
  | { type: "reset"; tab: Tab };

export function initialNav<Tab extends string, Screen extends string>(
  tab: Tab,
): TabNavState<Tab, Screen> {
  return { tab, history: [], stacks: {} };
}

/** Etkin sekmenin üstündeki ekran (yoksa null = sekme kökü görünür). */
export function topScreen<Tab extends string, Screen extends string>(
  state: TabNavState<Tab, Screen>,
  tab: Tab = state.tab,
): Screen | null {
  const stack = state.stacks[tab];
  return stack && stack.length ? stack[stack.length - 1] : null;
}

function switchTab<Tab extends string, Screen extends string>(
  state: TabNavState<Tab, Screen>,
  tab: Tab,
): TabNavState<Tab, Screen> {
  if (tab === state.tab) return state;
  const history = [...state.history.filter((t) => t !== tab && t !== state.tab), state.tab];
  return { ...state, tab, history };
}

export function navReducer<Tab extends string, Screen extends string>(
  state: TabNavState<Tab, Screen>,
  action: TabNavAction<Tab, Screen>,
): TabNavState<Tab, Screen> {
  switch (action.type) {
    case "select": {
      if (action.tab !== state.tab) return switchTab(state, action.tab);
      if (!state.stacks[state.tab]?.length) return state;
      return { ...state, stacks: { ...state.stacks, [state.tab]: [] } };
    }
    case "push": {
      const next = action.tab === undefined ? state : switchTab(state, action.tab);
      const stack = next.stacks[next.tab] ?? [];
      if (stack[stack.length - 1] === action.screen) return next;
      return { ...next, stacks: { ...next.stacks, [next.tab]: [...stack, action.screen] } };
    }
    case "pop": {
      const stack = state.stacks[state.tab];
      if (!stack?.length) return state;
      return { ...state, stacks: { ...state.stacks, [state.tab]: stack.slice(0, -1) } };
    }
    case "reset":
      return initialNav<Tab, Screen>(action.tab);
  }
}

/**
 * Android geri tuşu (design §12.1). `home` kök sekmedir (Planla). Dönüş: yeni durum ve tuşun
 * uygulamada işlenip işlenmediği; handled=false iken çağıran sistemi devreye sokar (çıkış).
 * `allowed` verilirse geçmişte kalan ama artık var olmayan sekmeler atlanır.
 */
export function onBack<Tab extends string, Screen extends string>(
  state: TabNavState<Tab, Screen>,
  home: Tab,
  allowed?: readonly Tab[],
): { state: TabNavState<Tab, Screen>; handled: boolean } {
  if (state.stacks[state.tab]?.length)
    return { state: navReducer(state, { type: "pop" }), handled: true };
  const history = allowed ? state.history.filter((t) => allowed.includes(t)) : state.history;
  if (history.length) {
    const prev = history[history.length - 1];
    return { state: { ...state, tab: prev, history: history.slice(0, -1) }, handled: true };
  }
  if (state.tab !== home && (!allowed || allowed.includes(home)))
    return { state: { ...state, tab: home, history: [] }, handled: true };
  return { state, handled: false };
}
