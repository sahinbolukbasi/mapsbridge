// FEAT-012 review #4 (karar B1, I1): eski sürümlerin her yeni profile yazdığı uydurma varsayılanlar.
// Cihazda saklı profilde bir alan HÂLÂ bu metinle BİREBİR aynıysa (kullanıcı hiç değiştirmemiş)
// boşaltılır; kullanıcının yazdığı her değer olduğu gibi kalır. Saf modül (apps/web/tests ile test).
export const LEGACY_PROFILE_DEFAULTS = {
  travelTitle: "Doğa & Rota Kaşifi",
  bio: "Sırt çantalı gezgin. Kültürel duraklar, gizli patikalar ve çevre dostu seyahatler tasarlar.",
  location: "İstanbul, Türkiye",
  avatarUrl:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCQdOMegHKRlkwubsFEMHDlXU8mVoZKUlXw7A0Quos1oSmZCSZEg30fAB4aMRnCI9q8UEUkdzonH9DUfJ3dTRjIPGpEsvmdB7q2Hrn_b98XcVBeB1CNFBlpaQM33IpQEZ9Bj2TQCR_rWOyCdeIsnX_hZXhb7z1nrWj53EXbHiVov_Hx5WO-_ikQRe6lEE_jnkFjZlEF1WXEue5BMqYbUXVJqoHBc--0mvHvT89fTCsu0mllchVOc6h24A",
} as const;

type LegacyFields = {
  travelTitle?: string;
  bio?: string;
  location?: string;
  avatarUrl?: string;
};

/**
 * Eski varsayılanla birebir eşleşen alanları temizler. Değişiklik yoksa aynı nesneyi döndürür
 * (çağıran `result !== input` ile yeniden yazma gerekip gerekmediğini anlar).
 */
export function stripLegacyProfileDefaults<T extends LegacyFields>(profile: T): T {
  const next = { ...profile };
  let changed = false;
  for (const key of ["travelTitle", "bio", "location"] as const) {
    if (profile[key] === LEGACY_PROFILE_DEFAULTS[key]) {
      next[key] = "" as T[typeof key];
      changed = true;
    }
  }
  if (profile.avatarUrl === LEGACY_PROFILE_DEFAULTS.avatarUrl) {
    next.avatarUrl = undefined;
    changed = true;
  }
  return changed ? next : profile;
}
