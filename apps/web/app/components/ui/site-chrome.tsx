"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { findRoute } from "../../lib/route-registry";
import { HeaderNav, MobileNav } from "../header-nav";
import { OperationsBanner } from "../operations-banner";
import { SiteFooter } from "../site-footer";
import "../header-nav.css";
import { SkipLink } from "./skip-link";
import { Toaster } from "./toast";
/**
 * Site chrome'u (design §4.1, D5): her sayfada tek kez, navigasyonlar arasında kalıcı.
 * Sıra: SkipLink → HeaderNav → OperationsBanner → sayfa → SiteFooter → MobileNav → Toaster.
 * HeaderNav/SiteFooter'ı import eden TEK dosya (guard G5, ESLint no-restricted-imports).
 */
export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  // Chrome varyantı (G19, R5) route-registry `chrome` alanından: immersive → footer yok;
  // focus → yalın header, alt menü ve footer yok.
  const chrome = findRoute(pathname)?.chrome ?? "default";
  return (
    <Toaster>
      <SkipLink />
      <HeaderNav variant={chrome} />
      <OperationsBanner />
      {children}
      {chrome !== "immersive" && chrome !== "focus" && <SiteFooter />}
      {chrome !== "focus" && <MobileNav />}
    </Toaster>
  );
}
