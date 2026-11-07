// apps/web/app/components/ui/logic/toast-hold.ts ile aynı saf mantık (birebir kopya)
// (parite testi: apps/web/tests/mobile-parity.test.cjs).
// Modal açıkken toast bekletme (review-foundation B2). showModal() dışarıdaki her şeyi inert
// yapar ve ::backdrop altında bırakır; Toaster SiteChrome'da olduğu için o an eklenen toast ne
// görünür ne duyurulur. Bu yüzden modal açıkken gelen toast bekletilir, son modal kapanınca
// gösterilir (zamanlayıcı da o an başlar). Modal İÇİNDEKİ geri bildirim (ör. paylaşım kopyalama)
// toast'a değil modal içindeki Alert/status bölgesine yazılır.
/** showModal() ile açılmış dialog; :modal desteklenmezse açık ve aria-modal dialog. */
export const OPEN_MODAL_SELECTORS = ["dialog:modal", "dialog[open][aria-modal='true']"] as const;
/** Bir sorgu işleviyle (document.querySelector) açık modal var mı. */
export function isModalOpen(query: (selector: string) => unknown): boolean {
  for (const selector of OPEN_MODAL_SELECTORS) {
    try {
      return Boolean(query(selector));
    } catch {
      // Seçici desteklenmiyor → bir sonrakini dene.
    }
  }
  return false;
}
/** Yeni toast: modal açıksa bekletilir, değilse hemen gösterilir. */
export function admitToast(modalOpen: boolean): "show" | "hold" {
  return modalOpen ? "hold" : "show";
}
/** Modal kapanınca: hâlâ açık modal yoksa bekleyenlerin hepsi sırasıyla gösterilir. */
export function releaseHeld<T>(held: readonly T[], modalOpen: boolean): { show: T[]; keep: T[] } {
  return modalOpen ? { show: [], keep: [...held] } : { show: [...held], keep: [] };
}
