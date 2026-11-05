// Cihazdaki (localStorage) yerel kayıtların sahibi (KVKK; FEAT-007 review #1). Sahip, oturumlu
// kullanıcının küçük harf e-postası ya da oturum yoksa `guest`tir. Anahtarlar
// cognito.getStoredSession ile aynıdır; bu modül cognito'yu içe aktarmaz (döngü olmasın).

export const GUEST_OWNER = "guest";

/** Oturum varsa küçük harf e-posta, yoksa `guest` (maps-client `mode` ile aynı kural). */
export function ownerFromSession(session: { token?: string | null; email?: string | null } | null) {
  const email = session?.email?.trim().toLowerCase();
  return session?.token && email ? email : GUEST_OWNER;
}

/** Şu anki sahip (localStorage oturumu). */
export function currentDeviceOwner(): string {
  if (typeof window === "undefined") return GUEST_OWNER;
  try {
    const token =
      localStorage.getItem("mapsbridge.accessToken") || localStorage.getItem("mapsbridge.idToken");
    return ownerFromSession({ token, email: localStorage.getItem("mapsbridge.userEmail") });
  } catch {
    return GUEST_OWNER;
  }
}
