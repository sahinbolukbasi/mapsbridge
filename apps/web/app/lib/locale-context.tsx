"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import trDict from "../locales/tr.json";
import enDict from "../locales/en.json";

export type { AppLocale } from "./locale-utils";
export { getLocaleFromPath, getAlternatePath } from "./locale-utils";
import type { AppLocale } from "./locale-utils";

const dictionaries: Record<AppLocale, Record<string, string>> = { tr: trDict, en: enDict };

interface LocaleContextValue {
  locale: AppLocale;
  t: (key: string, fallback?: string) => string;
  isEnglish: boolean;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  t: (key) => key,
  isEnglish: true,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const locale: AppLocale = pathname === "/en" || pathname.startsWith("/en/") ? "en" : "tr";
  const dict = dictionaries[locale];

  const value = useMemo(
    () => ({
      locale,
      t: (key: string, fallback?: string) => dict[key] ?? fallback ?? key,
      isEnglish: locale === "en",
    }),
    [locale, dict],
  );

  // İstemci navigasyonu (ör. / → /en/) HTML'i yeniden yüklemez; <html lang> burada izlenir (I11).
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
