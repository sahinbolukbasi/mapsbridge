"use client";
import type { ReactNode } from "react";
import { cx } from "./cx";
import "./ui.css";

export type PageLayout = "content" | "reading" | "form" | "landing" | "app" | "sidebar";

/** Sayfanın tek <main>'i (G4). layout max-width/gutter seçer; yerleşim sayfaya kalır. */
export function PageShell({
  layout = "content",
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
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cx("ui-page-shell", `ui-page-shell--${layout}`, className)}
      data-layout={layout}
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
