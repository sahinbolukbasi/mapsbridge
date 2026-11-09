// Kullanıcı adı uygunluk kontrolü (F3). Yeni backend ucu YOK: mevcut public
// GET /profiles/{username} (auth lambda, canlıda deploy) kullanılır — 404 = boşta,
// 200 = alınmış. Ağ/5xx hatası "unknown" döner ve kaydı BLOKLAMAZ (yalnız kesin
// "alınmış" bloklar). Saf yardımcılar ayrıca test edilir.
import { API_ENDPOINT } from "../api";
import { USERNAME_RE, normalizeUsername } from "../navigation/profile-href";

export type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "unknown";

/** Saf: ham kullanıcı adını doğrular. Geçerli ise normalize haliyle döner, değilse null. */
export function validateUsername(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (!u) return null;
  return USERNAME_RE.test(u) ? u : null;
}

/** Saf: HTTP durum kodunu uygunluk durumuna çevirir. 404=boşta, 200=alınmış, diğer=unknown. */
export function statusFromResponse(httpStatus: number): UsernameStatus {
  if (httpStatus === 404) return "available";
  if (httpStatus === 200) return "taken";
  return "unknown";
}

/** Canlı kontrol: mevcut public profil ucuna bakar. Ağ hatasında "unknown" (bloklamaz). */
export async function checkUsernameAvailable(raw: string): Promise<UsernameStatus> {
  const u = validateUsername(raw);
  if (!u) return "invalid";
  try {
    const res = await fetch(`${API_ENDPOINT}/profiles/${encodeURIComponent(u)}`, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });
    return statusFromResponse(res.status);
  } catch {
    return "unknown";
  }
}
