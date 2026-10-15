// Device-local data is isolated by account. Unowned legacy keys are preserved,
// but never silently assigned to whoever signs in next.
let boundOwner: string | undefined;

function scopedKey(key: string): string | null {
  if (typeof window === "undefined") return null;
  const email =
    localStorage.getItem("mapsbridge.userEmail") || localStorage.getItem("adreskopru.userEmail");
  const token = localStorage.getItem("mapsbridge.accessToken");
  if (!email || !token) return null;
  const owner = email.trim().toLowerCase();
  if (boundOwner === undefined) boundOwner = owner;
  if (boundOwner !== owner) return null;
  return `mapsbridge.account.${encodeURIComponent(owner)}.${key}`;
}

export const userStorage = {
  getItem(key: string): string | null {
    const scoped = scopedKey(key);
    return scoped ? localStorage.getItem(scoped) : null;
  },
  setItem(key: string, value: string) {
    const scoped = scopedKey(key);
    if (!scoped) throw new Error("Kaydetmek için giriş yapın.");
    try {
      localStorage.setItem(scoped, value);
    } catch {
      window.dispatchEvent(new CustomEvent("mapsbridge:storage-error"));
      throw new Error("Değişiklik kaydedilemedi. Depolama alanını kontrol edin.");
    }
  },
  removeItem(key: string) {
    const scoped = scopedKey(key);
    if (scoped) localStorage.removeItem(scoped);
  },
};
