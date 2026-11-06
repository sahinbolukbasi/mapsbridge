// Gezgin profil bağlantısı (Increment 1.12, bug 7). Statik export'ta yalnız 4 örnek slug için
// /<slug>/ sayfası üretilir; diğer kullanıcılar kanonik /profiles/?u=<kullanıcı> sayfasındadır.
// Saf modül (test edilebilir).
import { SAMPLE_PROFILE_USERNAMES } from "../../[username]/sample-routes";

/** Kullanıcı adı biçimi: harf/rakam/alt çizgi/nokta/tire, 1–40 karakter. */
export const USERNAME_RE = /^[a-z0-9_.-]{1,40}$/;

/** "@Ali_K" → "ali_k"; geçersizse null. */
export function normalizeUsername(raw: string | null | undefined): string | null {
  const u = (raw ?? "").trim().replace(/^@+/, "").toLowerCase();
  return USERNAME_RE.test(u) ? u : null;
}

export function profileHref(username: string): string | null {
  const u = normalizeUsername(username);
  if (!u) return null;
  return (SAMPLE_PROFILE_USERNAMES as readonly string[]).includes(u)
    ? `/${u}/`
    : `/profiles/?u=${encodeURIComponent(u)}`;
}
