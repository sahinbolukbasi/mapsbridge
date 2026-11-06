// Basma/kaydırma geri bildirimi saf mantığı (direction §2, design-system.md R15).
/** Ripple çıkış noktası ve yarıçapı: basılan noktadan kutunun en uzak köşesine (px). */
export function rippleOrigin(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): { x: number; y: number; size: number } {
  // Klavye ile basmada (0,0 ya da kutu dışı) merkez.
  const inside =
    clientX >= rect.left &&
    clientX <= rect.left + rect.width &&
    clientY >= rect.top &&
    clientY <= rect.top + rect.height &&
    !(clientX === 0 && clientY === 0);
  const x = inside ? clientX - rect.left : rect.width / 2;
  const y = inside ? clientY - rect.top : rect.height / 2;
  const dx = Math.max(x, rect.width - x);
  const dy = Math.max(y, rect.height - y);
  return { x: Math.round(x), y: Math.round(y), size: Math.ceil(Math.hypot(dx, dy)) };
}
/**
 * Kaydırmada açılma gizli başlar mı (R15): yalnız IntersectionObserver varken, hareket
 * azaltılmamışken ve öğe ilk ekranda değilken. Aksi halde içerik baştan görünür.
 */
export function revealStartsHidden(opts: {
  hasObserver: boolean;
  reducedMotion: boolean;
  inViewport: boolean;
}): boolean {
  return opts.hasObserver && !opts.reducedMotion && !opts.inViewport;
}
