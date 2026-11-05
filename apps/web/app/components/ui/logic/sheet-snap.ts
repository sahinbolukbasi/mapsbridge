// BottomSheet snap mantığı (saf, design §4.2): tutamak klavyesi ve sürükleme bırakma kararı.
export type SheetSnap = "peek" | "half" | "full";
export const SNAP_ORDER: readonly SheetSnap[] = ["peek", "half", "full"];
/** Sürüklemenin bir snap adımı sayılması için gereken en az mesafe (CSS px). */
export const SHEET_DRAG_THRESHOLD = 48;
export type SheetInput = "Enter" | " " | "ArrowUp" | "ArrowDown" | "up" | "down";

/** Snap listesini küçükten büyüğe sıralı ve tekil yapar. */
export function orderedSnaps(snaps: readonly SheetSnap[]): SheetSnap[] {
  return SNAP_ORDER.filter((s) => snaps.includes(s));
}

/**
 * Tutamakta basılan tuşa ya da yöne göre sonraki snap. Enter/Space döngüseldir (sondan başa
 * sarar); ↑/"up" bir büyür, ↓/"down" bir küçülür ve sınırda kalır. Desen dışı tuş → null.
 */
export function nextSnap(
  current: SheetSnap,
  input: SheetInput | string,
  snaps: readonly SheetSnap[],
): SheetSnap | null {
  const list = orderedSnaps(snaps);
  if (!list.length) return null;
  const index = list.indexOf(current);
  if (index < 0) return list[0];
  switch (input) {
    case "Enter":
    case " ":
      return list[(index + 1) % list.length];
    case "ArrowUp":
    case "up":
      return list[Math.min(index + 1, list.length - 1)];
    case "ArrowDown":
    case "down":
      return list[Math.max(index - 1, 0)];
    default:
      return null;
  }
}

/** Sürükleme bırakıldığında snap: dy < 0 yukarı. Eşik altı hareket mevcut snap'te kalır. */
export function snapFromDrag(
  dy: number,
  current: SheetSnap,
  snaps: readonly SheetSnap[],
  threshold = SHEET_DRAG_THRESHOLD,
): SheetSnap {
  if (!Number.isFinite(dy) || Math.abs(dy) < threshold) {
    return orderedSnaps(snaps).includes(current) ? current : (orderedSnaps(snaps)[0] ?? current);
  }
  return nextSnap(current, dy < 0 ? "up" : "down", snaps) ?? current;
}
