"use client";
import Link from "next/link";
import type { ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from "react";
import { useLocale } from "../../lib/locale-context";
import type { CreditCost } from "../../lib/billing/credit-costs";
import { CostBadge } from "./cost-badge";
import { cx } from "./cx";
import "./ui.css";

export type ButtonVariant = "primary" | "brand" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  fullWidth?: boolean;
  /** Kredi maliyeti: sağda CostBadge; erişilebilir ad "Rotayı optimize et, 1 kredi" olur. */
  cost?: CreditCost;
  className?: string;
  children: ReactNode;
};
type AsButton = Common &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof Common | "aria-disabled" | "aria-busy"> & {
    href?: undefined;
    /** React 19: ref sıradan prop olarak iletilir. */
    ref?: Ref<HTMLButtonElement>;
  };
type AsLink = Common & {
  href: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  prefetch?: boolean;
  target?: string;
  rel?: string;
};
export type ButtonProps = AsButton | AsLink;

/** Kendi zeminini çizen varyantlar (design §3.1 ownSurface). */
const OWN_SURFACE: ReadonlySet<ButtonVariant> = new Set(["secondary"]);

export function buttonClassName(
  variant: ButtonVariant,
  size: ButtonSize,
  fullWidth?: boolean,
  extra?: string,
): string {
  return cx(
    "ui-button",
    `ui-button--${variant}`,
    `ui-button--${size}`,
    fullWidth && "ui-button--full",
    extra,
  );
}

export function Button(props: ButtonProps) {
  const { t } = useLocale();
  const {
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    iconStart,
    iconEnd,
    fullWidth,
    cost,
    className,
    children,
  } = props;
  const inert = loading || disabled;
  // Yüklenirken içerik yerinde kalır (genişlik sabit, opacity 0); spinner üstüne biner.
  const content = (
    <>
      {iconStart}
      <span className="ui-button__label">{children}</span>
      {cost !== undefined && (
        <>
          <span className="ui-visually-hidden">, </span>
          <span className="ui-button__cost" data-surface="default">
            <CostBadge cost={cost} />
          </span>
        </>
      )}
      {iconEnd}
      {loading && <span className="ui-button__spinner" aria-hidden="true" />}
      {loading && <span className="ui-visually-hidden">{t("ui.loading", "Yükleniyor…")}</span>}
    </>
  );
  const shared = {
    className: buttonClassName(variant, size, fullWidth, className),
    "data-surface": OWN_SURFACE.has(variant) ? ("default" as const) : undefined,
    "aria-disabled": inert || undefined,
    "aria-busy": loading || undefined,
  };

  if (props.href !== undefined) {
    const { href, onClick, prefetch, target, rel } = props;
    return (
      <Link
        {...shared}
        href={href}
        prefetch={prefetch}
        target={target}
        rel={rel}
        onClick={(e) => {
          // Odak kaybolmasın diye disabled yerine aria-disabled + tıklamayı yut.
          if (inert) {
            e.preventDefault();
            return;
          }
          onClick?.(e);
        }}
      >
        {content}
      </Link>
    );
  }

  const {
    variant: _v,
    size: _s,
    loading: _l,
    disabled: _d,
    iconStart: _is,
    iconEnd: _ie,
    fullWidth: _f,
    cost: _cost,
    className: _c,
    children: _ch,
    href: _h,
    type = "button",
    onClick,
    ...rest
  } = props;
  return (
    <button
      {...rest}
      {...shared}
      type={type}
      onClick={(e) => {
        if (inert) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
    >
      {content}
    </button>
  );
}
