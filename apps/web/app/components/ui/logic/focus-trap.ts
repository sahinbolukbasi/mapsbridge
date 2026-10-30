// Modal odak tuzağı (saf, design §3 Modal): Tab/Shift+Tab döngüsünün sıradaki hedefi.

/** Odaklanabilir öğe seçicisi (gizli/disabled filtrelemesini çağıran DOM tarafında yapar). */
export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "summary",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * `current` odaklı öğenin listedeki indeksi (-1: liste dışında, ör. başlık ya da dialog kökü).
 * Döngü: sondan Tab → ilk, baştan Shift+Tab → son. Liste boşsa -1 (odak dialogda kalır).
 */
export function nextFocusIndex(count: number, current: number, shift: boolean): number {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return shift ? count - 1 : 0;
  if (shift) return current === 0 ? count - 1 : current - 1;
  return current === count - 1 ? 0 : current + 1;
}

/** Tarayıcının varsayılan Tab davranışı tuzaktan çıkacaksa true (yalnız sınırlarda araya gir). */
export function shouldWrap(count: number, current: number, shift: boolean): boolean {
  if (count <= 0) return true;
  if (current < 0 || current >= count) return true;
  return shift ? current === 0 : current === count - 1;
}
