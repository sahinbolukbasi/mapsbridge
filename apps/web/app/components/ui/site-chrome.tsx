"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { HeaderNav, MobileNav, type HeaderVariant } from "../header-nav";
import { OperationsBanner } from "../operations-banner";
import { SiteFooter } from "../site-footer";
import "../header-nav.css";
import { SkipLink } from "./skip-link";
import { Toaster } from "./toast";
/**
 * Header varyantı (G19): sayfa CSS'i chrome'u override etmez. C7'de route-registry'ye taşınır.
 * Değerler eski sayfa override'larının birebir karşılığıdır (header-nav.css `[data-variant]`).
 */
const HEADER_VARIANTS: ReadonlyArray<[path: string, variant: HeaderVariant]> = [
  ["/messages/", "wide-compact"],
  ["/community/", "wide-compact"],
  ["/profile/", "wide"],
];
function headerVariant(pathname: string): HeaderVariant {
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return HEADER_VARIANTS.find(([p]) => p === path)?.[1] ?? "default";
}
/**
 * Site chrome'u (design §4.1, D5): her sayfada tek kez, navigasyonlar arasında kalıcı.
 * Sıra: SkipLink → HeaderNav → OperationsBanner → sayfa → SiteFooter → MobileNav → Toaster.
 * HeaderNav/SiteFooter'ı import eden TEK dosya (guard G5, ESLint no-restricted-imports).
 */
export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  return (
    <Toaster>
      <SkipLink />
      <HeaderNav variant={headerVariant(pathname)} />
      <OperationsBanner />
      {children}
      <SiteFooter />
      <MobileNav />
    </Toaster>
  );
}
