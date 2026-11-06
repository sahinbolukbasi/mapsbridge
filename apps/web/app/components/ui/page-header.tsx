"use client";
import type { CSSProperties, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "../../lib/locale-context";
import { Breadcrumb, type BreadcrumbItem } from "./breadcrumb";
import { cx } from "./cx";
import { findRoute } from "../../lib/route-registry";
import { resolvePageTitle } from "./logic/page-title";
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
  /** Giriş koreografisi (direction §2): eyebrow → başlık → metin → çocuklar sırayla yükselir. */
  enter?: boolean;
  /** Eyebrow hap biçiminde, başında nabız noktası (≥5 sn döngü, yalnız no-preference). */
  eyebrowPulse?: boolean;
  /** Başlık metninde altı çizilerek vurgulanacak sözcük (yalnız string başlıkta). */
  titleInk?: string;
};
const enterAttrs = (on: boolean, i: number) =>
  on ? { "data-enter": "", style: { "--i": i } as CSSProperties } : {};
/** Başlığı vurgu sözcüğü çevresinden böler; sözcük yoksa başlık aynen döner. */
function withInk(heading: ReactNode, ink?: string): ReactNode {
  if (!ink || typeof heading !== "string") return heading;
  const at = heading.indexOf(ink);
  if (at < 0) return heading;
  return (
    <>
      {heading.slice(0, at)}
      <span className="ui-ink">
        {ink}
        <svg
          className="ui-ink__line"
          viewBox="0 0 300 20"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path pathLength={1} d="M4 14 C 60 4, 140 4, 200 10 S 280 16, 296 6" />
        </svg>
      </span>
      {heading.slice(at + ink.length)}
    </>
  );
}

/** Sayfanın tek <h1>'i (G10). Kök <div>; <header> değil (G5). eyebrow başlık değil <p> (heading-order). */
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
  enter = false,
  eyebrowPulse = false,
  titleInk,
}: PageHeaderProps) {
  const pathname = usePathname() ?? "";
  const { locale } = useLocale();
  const resolved = resolvePageTitle(
    { title, titleText, entry: findRoute(pathname) ?? null, locale },
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
          {eyebrow && (
            <p
              className={cx(
                "ui-page-header__eyebrow",
                eyebrowPulse && "ui-page-header__eyebrow--pill",
              )}
              {...enterAttrs(enter, 0)}
            >
              {eyebrowPulse && <span className="ui-pulse-dot" aria-hidden="true" />}
              {eyebrow}
            </p>
          )}
          <h1
            id={titleId}
            className={cx(
              "ui-page-header__title",
              titleHidden && "ui-visually-hidden",
              titleClassName,
            )}
            {...enterAttrs(enter, 1)}
          >
            {withInk(resolved.heading as ReactNode, titleInk)}
          </h1>
          {description && !titleHidden && (
            <p className="ui-page-header__description" {...enterAttrs(enter, 2)}>
              {description}
            </p>
          )}
        </div>
        {actions && <div className="ui-page-header__actions">{actions}</div>}
      </div>
      {enter && children ? (
        <div className="ui-page-header__body" {...enterAttrs(enter, 3)}>
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
