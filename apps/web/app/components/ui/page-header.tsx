"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "../../lib/locale-context";
import { Breadcrumb, type BreadcrumbItem } from "./breadcrumb";
import { cx } from "./cx";
import { resolvePageTitle, type PageTitleEntry } from "./logic/page-title";
import "./ui.css";

export type PageHeaderProps = {
  title?: ReactNode;
  titleText?: string;
  description?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  actions?: ReactNode;
  eyebrow?: string;
  variant?: "default" | "hero" | "hidden";
  surface?: "default" | "inverse";
  titleId?: string;
  titleClassName?: string;
  /** Hero görseli vb. */
  children?: ReactNode;
};

/** Registry araması C7'de eklenir (route-registry.ts); C5–C6'da title/titleText verilir. */
const lookupEntry = (_pathname: string): PageTitleEntry | null => null;

/** Sayfanın tek <h1>'i (G10). Kök <div>; <header> değil (G5). */
export function PageHeader({
  title,
  titleText,
  description,
  breadcrumb,
  actions,
  eyebrow,
  variant = "default",
  surface = "default",
  titleId = "page-title",
  titleClassName,
  children,
}: PageHeaderProps) {
  const pathname = usePathname() ?? "";
  const { locale } = useLocale();
  const resolved = resolvePageTitle(
    { title, titleText, entry: lookupEntry(pathname), locale },
    pathname,
  );
  if ("error" in resolved) {
    if (process.env.NODE_ENV !== "production") throw new Error(resolved.error);
    console.error(resolved.error);
    return null;
  }
  const crumbs = breadcrumb && breadcrumb.length > 0 ? breadcrumb : null;
  const titleHidden = variant === "hidden";
  return (
    <div
      className={cx("ui-page-header", `ui-page-header--${variant}`)}
      data-surface={surface === "inverse" ? "inverse" : undefined}
    >
      {crumbs && <Breadcrumb items={crumbs} />}
      <div className="ui-page-header__row">
        <div className="ui-page-header__titles">
          {eyebrow && <p className="ui-page-header__eyebrow">{eyebrow}</p>}
          <h1
            id={titleId}
            className={cx(
              "ui-page-header__title",
              titleHidden && "ui-visually-hidden",
              titleClassName,
            )}
          >
            {resolved.heading as ReactNode}
          </h1>
          {description && !titleHidden && (
            <p className="ui-page-header__description">{description}</p>
          )}
        </div>
        {actions && <div className="ui-page-header__actions">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
