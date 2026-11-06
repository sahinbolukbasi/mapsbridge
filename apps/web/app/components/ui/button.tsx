"use client";
import Link from "next/link";
import { useId, type ButtonHTMLAttributes, type MouseEvent, type ReactNode, type Ref } from "react";
import { useLocale } from "../../lib/locale-context";
import type { CreditCost } from "../../lib/billing/credit-costs";
import { CostBadge } from "./cost-badge";
import { cx } from "./cx";
import { useRipple } from "./hooks/use-ripple";
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
  /** Yüklenirken görünür etiket ("Kaydediliyor…"); yoksa çocuklar görünür kalır. */
  loadingLabel?: ReactNode;
  /** Devre dışı nedeni: düğmenin altında görünür ipucu, aria-describedby ile bağlı. */
  disabledReason?: ReactNode;
  /** Kredi maliyeti: sağda CostBadge; erişilebilir ad "Rotayı optimize et, 1 kredi" olur. */
  cost?: CreditCost;
  className?: string;
  children: ReactNode;
};
type AsButton = Common &
  Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    keyof Common | "aria-disabled" | "aria-busy" | "aria-describedby"
  > & {
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

/**
 * Düğme (direction §2): hover 1 px kalkma + gölge, sondaki ikon 4 px kayar; basma .97 + basılan
 * noktadan ripple (useRipple); kayma/ölçek/ripple yalnız no-preference, renk/gölge her zaman.
 * loading: spinner + görünür etiket (loadingLabel ?? çocuklar), aria-busy; disabled ayrı görünüm
 * + isteğe bağlı görünür neden (disabledReason, aria-describedby).
 */
export function Button(props: ButtonProps) {
  const { t } = useLocale();
  const ripple = useRipple<HTMLElement>();
  const reasonId = useId();
  const {
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    iconStart,
    iconEnd,
    fullWidth,
    cost,
    loadingLabel,
    disabledReason,
    className,
    children,
  } = props;
  const inert = loading || disabled;
  const showReason = disabled && !loading && disabledReason != null;
  // Yüklenirken spinner baştaki ikonun yerini alır, etiket görünür kalır ("Kaydediliyor…").
  const content = (
    <>
      {loading ? <span className="ui-button__spinner" aria-hidden="true" /> : iconStart}
      <span className="ui-button__label">{loading && loadingLabel ? loadingLabel : children}</span>
      {cost !== undefined && (
        <>
          <span className="ui-visually-hidden">, </span>
          <span className="ui-button__cost" data-surface="default">
            <CostBadge cost={cost} />
          </span>
        </>
      )}
      {iconEnd && <span className="ui-button__end">{iconEnd}</span>}
      {loading && !loadingLabel && (
        <span className="ui-visually-hidden">{t("ui.loading", "Yükleniyor…")}</span>
      )}
    </>
  );
  const reason = showReason ? (
    <span id={reasonId} className="ui-button__reason">
      {disabledReason}
    </span>
  ) : null;
  const shared = {
    className: buttonClassName(variant, size, fullWidth, className),
    "data-surface": OWN_SURFACE.has(variant) ? ("default" as const) : undefined,
    "aria-disabled": inert || undefined,
    "aria-busy": loading || undefined,
    "aria-describedby": showReason ? reasonId : undefined,
  };

  if (props.href !== undefined) {
    const { href, onClick, prefetch, target, rel } = props;
    const link = (
      <Link
        {...shared}
        href={href}
        onPointerDown={ripple}
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
    return reason ? (
      <>
        {link}
        {reason}
      </>
    ) : (
      link
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
    loadingLabel: _ll,
    disabledReason: _dr,
    className: _c,
    children: _ch,
    href: _h,
    type = "button",
    onClick,
    onPointerDown,
    ...rest
  } = props;
  const button = (
    <button
      {...rest}
      {...shared}
      type={type}
      onPointerDown={(e) => {
        ripple(e);
        onPointerDown?.(e);
      }}
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
  return reason ? (
    <>
      {button}
      {reason}
    </>
  ) : (
    button
  );
}
