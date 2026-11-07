// Planlayıcı klavye kısayolları (Increment 3.3): saf eşleme, travel-planner.test.cjs ile sınanır.
// Yazı alanında (input/textarea/select/contenteditable) tek tuşlu kısayollar çalışmaz; Esc ve
// Alt+↑/↓ her yerde. Yardım listesi aynı tablodan üretilir (tek kaynak).

export type PlannerShortcut = "search" | "newStop" | "closeDetail" | "moveUp" | "moveDown";

export type ShortcutKeyEvent = {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  /** Olayın hedefi bir yazı alanı mı (çağıran hesaplar). */
  inTextField?: boolean;
};

export const SHORTCUT_HELP: ReadonlyArray<{ id: PlannerShortcut; keys: string; label: string }> = [
  { id: "search", keys: "/", label: "Mekan aramaya git" },
  { id: "newStop", keys: "N", label: "Yeni durak ekle (aramayı aç)" },
  { id: "closeDetail", keys: "Esc", label: "Ayrıntıyı kapat" },
  { id: "moveUp", keys: "Alt + ↑", label: "Seçili durağı yukarı taşı" },
  { id: "moveDown", keys: "Alt + ↓", label: "Seçili durağı aşağı taşı" },
];

export function plannerShortcut(e: ShortcutKeyEvent): PlannerShortcut | null {
  if (e.ctrlKey || e.metaKey) return null;
  if (e.key === "Escape") return "closeDetail";
  if (e.altKey && !e.shiftKey) {
    if (e.key === "ArrowUp") return "moveUp";
    if (e.key === "ArrowDown") return "moveDown";
    return null;
  }
  if (e.inTextField || e.altKey) return null;
  if (e.key === "/") return "search";
  if (e.key === "n" || e.key === "N") return "newStop";
  return null;
}

/** Hedef öğe yazı alanı mı (DOM'suz da sınanabilsin diye yalnız tagName/isContentEditable). */
export function isTextFieldTarget(
  target: { tagName?: string; isContentEditable?: boolean } | null,
): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName ?? "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
