// Misafir asistan taslağının (mapsbridge.guestDraft.v1) hesap yalıtımı (FEAT-007 review #1).
// Taslağı yalnızca misafir yazar. `?resume=1` ile onu ilk açan hesap taslağı sahiplenir; başka
// bir hesap (ör. çıkış yapmadan girilen ikinci hesap) ve sonraki misafir onu göremez. Misafir
// yeni bir taslak yazınca sahiplik bırakılır. Çıkışta taslak silinir (cognito.signOut).
import { GUEST_OWNER, currentDeviceOwner } from "../device-owner";
import { GUEST_DRAFT_KEY, type DraftStorage } from "./guest-draft";

export const GUEST_DRAFT_OWNER_KEY = "mapsbridge.guestDraft.owner";

/** İşaretsiz ya da misafir taslağı herkese (ilk hesap sahiplenir); sahipli taslak yalnızca sahibine. */
export function canUseGuestDraft(stored: string | null, current: string): boolean {
  return !stored || stored === GUEST_OWNER || stored === current;
}

/**
 * Sahipliği uygulayan DraftStorage (guest-draft.ts load/save/clear ile kullanılır). Okuma:
 * başka hesabın taslağı null; oturumlu hesap okuyunca sahiplenir. Yazma: sahip şu anki kişi.
 * Silme: taslak ve sahip işareti birlikte.
 */
export function ownedDraftStorage(base: DraftStorage | null): DraftStorage | null {
  if (!base) return null;
  const owner = () => currentDeviceOwner();
  return {
    getItem(key) {
      const current = owner();
      const stored = base.getItem(GUEST_DRAFT_OWNER_KEY);
      if (!canUseGuestDraft(stored, current)) return null;
      const value = base.getItem(key);
      if (
        value !== null &&
        key === GUEST_DRAFT_KEY &&
        current !== GUEST_OWNER &&
        stored !== current
      ) {
        try {
          base.setItem(GUEST_DRAFT_OWNER_KEY, current);
        } catch {}
      }
      return value;
    },
    setItem(key, value) {
      base.setItem(key, value);
      base.setItem(GUEST_DRAFT_OWNER_KEY, owner());
    },
    removeItem(key) {
      base.removeItem(key);
      if (key === GUEST_DRAFT_KEY) base.removeItem(GUEST_DRAFT_OWNER_KEY);
    },
  };
}

/** Çıkışta çağrılır. */
export function clearGuestDraftStore(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(GUEST_DRAFT_KEY);
    localStorage.removeItem(GUEST_DRAFT_OWNER_KEY);
  } catch {}
}
