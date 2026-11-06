// Yer verisi kill switch'i (Increment 1.5). Bağımlılıksız: admin lambda'sı da import eder.
export type PlacesControl = {
  googleEnabled: boolean;
  userDailyLimit: number;
  monthlyGoogleCalls: number;
};
export const PLACES_CONTROL_KEY = "SYSTEM#PLACES_CONTROL";
/** Kayıt yoksa ya da okunamazsa: Google kapalı (güvenli varsayılan). */
export const DEFAULT_PLACES_CONTROL: PlacesControl = {
  googleEnabled: false,
  userDailyLimit: 300,
  monthlyGoogleCalls: 10000,
};

/** Kontrol kaydını doğrular; bozuk alan varsayılana düşer, googleEnabled yalnız `true` ise açık. */
export function parsePlacesControl(raw: unknown): PlacesControl {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const int = (v: unknown, d: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : d;
  return {
    googleEnabled: r.googleEnabled === true,
    userDailyLimit: int(r.userDailyLimit, DEFAULT_PLACES_CONTROL.userDailyLimit),
    monthlyGoogleCalls: int(r.monthlyGoogleCalls, DEFAULT_PLACES_CONTROL.monthlyGoogleCalls),
  };
}

/** Admin girdisi (POST /admin/ai-control `places`): katı doğrulama; geçersizse null. */
export function validatePlacesControlInput(raw: unknown): PlacesControl | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const intIn = (v: unknown, max: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max;
  if (typeof r.googleEnabled !== "boolean") return null;
  if (!intIn(r.userDailyLimit, 10000) || !intIn(r.monthlyGoogleCalls, 1_000_000)) return null;
  return {
    googleEnabled: r.googleEnabled,
    userDailyLimit: r.userDailyLimit as number,
    monthlyGoogleCalls: r.monthlyGoogleCalls as number,
  };
}
