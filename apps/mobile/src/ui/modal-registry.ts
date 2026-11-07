// Açık ModalFrame sayısı (web toast-hold eşleniği). RN Modal ayrı bir yerel pencere açar;
// kök görünümdeki Toast o an modalın altında kalır, ne görünür ne duyurulur. Bu yüzden Toaster
// açık modal varken gelen toast'u bekletir ve son modal kapanınca gösterir (logic/toast-hold.ts).
let open = 0;
const listeners = new Set<(count: number) => void>();
function emit() {
  for (const l of listeners) l(open);
}
export function modalOpened(): void {
  open += 1;
  emit();
}
export function modalClosed(): void {
  open = Math.max(0, open - 1);
  emit();
}
export function openModalCount(): number {
  return open;
}
export function subscribeModals(listener: (count: number) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
