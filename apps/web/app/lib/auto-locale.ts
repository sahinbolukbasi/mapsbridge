export type AppLocale = "tr" | "en";

const COOKIE_NAME = "locale";
const COOKIE_MAX_AGE = 31536000; // 1 year

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${value};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Strict;Secure`;
}

function localeFromPathname(pathname: string): AppLocale {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "tr";
}

function localeFromBrowser(): AppLocale {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language || (navigator as any).userLanguage || "";
  return lang.startsWith("tr") ? "tr" : "en";
}

export function getAutoLocale(): AppLocale {
  const cookie = getCookie(COOKIE_NAME);
  if (cookie === "tr" || cookie === "en") return cookie;
  if (typeof window !== "undefined") {
    return localeFromPathname(window.location.pathname);
  }
  return localeFromBrowser();
}

export function isTurkeyConnection(): boolean {
  return false;
}

export function checkAndEnforceAutoLocale(pathname: string): void {
  const pathLocale = localeFromPathname(pathname);
  const cookie = getCookie(COOKIE_NAME);
  if (cookie !== pathLocale) {
    setCookie(COOKIE_NAME, pathLocale);
  }
}
