// apps/web/app/components/ui/logic/modal-presentation.ts ile aynı saf mantık (birebir kopya)
// (parite testi: apps/web/tests/mobile-parity.test.cjs).
// Modal sunumu (design-system.md R10, approval ruleChanges a): `sheet` boyutu yalnız <768'de alt
// sayfa olarak çizilir; ≥768'de her modal ortalı dialogdur (ölçek + solma). Saf; matchMedia
// sonucunu çağıran verir.
export type ModalPresentation = "sheet" | "dialog";
/** <768 sorgusu (CSS'teki @media (max-width: 767.98px) ile aynı). */
export const MOBILE_SHEET_QUERY = "(max-width: 767.98px)";
export function modalPresentation(size: string, matchesMobile: boolean): ModalPresentation {
  return size === "sheet" && matchesMobile ? "sheet" : "dialog";
}
/** Kapanış animasyonu beklenir mi: her iki sunumda da hareket serbestse evet, azaltmada anında. */
export function animatesClose(reducedMotion: boolean): boolean {
  return !reducedMotion;
}
