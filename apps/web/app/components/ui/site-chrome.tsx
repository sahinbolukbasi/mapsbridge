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
  return (
    <Toaster>
      <SkipLink />
      {/* Header varyantı (G19) route-registry `chrome` alanından. */}
      <HeaderNav variant={findRoute(pathname)?.chrome ?? "default"} />
      <OperationsBanner />
      {children}
      <SiteFooter />
      <MobileNav />
    </Toaster>
  );
}
