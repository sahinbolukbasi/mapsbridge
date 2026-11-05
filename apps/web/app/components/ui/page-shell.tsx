"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { findRoute } from "../../lib/route-registry";
import { cx } from "./cx";
import "./ui.css";

export type PageLayout = "content" | "reading" | "form" | "landing" | "app" | "sidebar";

/**
 * Sayfanın tek <main>'i (G4). layout max-width/gutter seçer; yerleşim sayfaya kalır. `layout`
 * verilmezse route-registry kaydının layout'u (yoksa "content"); verilirse registry'yi ezer (§4.2).
 * En az header altı ekran yüksekliği (footer sayfanın altına iner, F24); ui-page-enter giriş
 * animasyonu yalnızca hareket tercihinde (design §8.2). data-chrome="immersive" (registry) sayfayı
 * header ve alt menü arasındaki alana doldurur (design §5.2).
 */
export function PageShell({
  layout: layoutProp,
  header,
  sidebar,
  className,
  children,
}: {
  layout?: PageLayout;
  header?: ReactNode;
  sidebar?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const route = findRoute(pathname);
  const layout: PageLayout = layoutProp ?? route?.layout ?? "content";
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cx("ui-page-shell", `ui-page-shell--${layout}`, "ui-page-enter", className)}
      data-layout={layout}
      data-chrome={route?.chrome}
    >
      {layout === "sidebar" ? (
        <>
          {header}
          <div className="ui-page-shell__grid">
            {sidebar && <div className="ui-page-shell__sidebar">{sidebar}</div>}
            <div className="ui-page-shell__content">{children}</div>
          </div>
        </>
      ) : (
        <>
          {header}
          {children}
        </>
      )}
    </main>
  );
}
