// Tabs klavye gezinmesi (saf reducer, design §3 Tabs): ok tuşları, Home/End, sarma, disabled atlama.

export type TabsOrientation = "horizontal" | "vertical";

/**
 * Basılan tuşa göre odaklanacak sekmenin indeksini döndürür. Tuş bu desenin parçası değilse
 * ya da etkin sekme yoksa `null` (çağıran olayı olduğu gibi bırakır).
 */
export function nextTabIndex(
  current: number,
  key: string,
  disabled: readonly boolean[],
  orientation: TabsOrientation = "horizontal",
): number | null {
  const count = disabled.length;
  if (count === 0 || disabled.every(Boolean)) return null;
  const prevKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
  const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
  const scan = (from: number, step: 1 | -1): number => {
    let i = from;
    for (let n = 0; n < count; n++) {
      i = (i + step + count) % count;
      if (!disabled[i]) return i;
    }
    return current;
  };
  switch (key) {
    case nextKey:
      return scan(current, 1);
    case prevKey:
      return scan(current, -1);
    case "Home":
      return scan(-1, 1);
    case "End":
      return scan(count, -1);
    default:
      return null;
  }
}

/** İlk etkin sekmenin indeksi (yoksa -1). */
export function firstEnabledIndex(disabled: readonly boolean[]): number {
  return disabled.findIndex((d) => !d);
}
