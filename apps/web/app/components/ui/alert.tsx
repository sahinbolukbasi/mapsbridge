"use client";
import type { ReactNode } from "react";
import { useLocale } from "../../lib/locale-context";
import { cx } from "./cx";
import { Icon } from "./material-icon";
import "./ui.css";

export type AlertTone = "info" | "success" | "warning" | "danger";
const ICON: Record<AlertTone, string> = {
  info: "info",
  success: "check_circle",
  warning: "warning",
  danger: "error",
};

/**
 * Statik uyarı role almaz; dinamik eklenende live → role="status" (polite) ya da "alert"
 * (assertive). Renk tek ipucu değildir: ton ikonu + görünmez "Uyarı:"/"Hata:" öneki.
 */
export function Alert({
  tone = "info",
  title,
  action,
  live = "off",
  className,
  children,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  action?: ReactNode;
  live?: "polite" | "assertive" | "off";
  className?: string;
  children?: ReactNode;
}) {
  const { t } = useLocale();
  const role = live === "assertive" ? "alert" : live === "polite" ? "status" : undefined;
  return (
    <div
      className={cx("ui-alert", `ui-alert--${tone}`, className)}
      data-surface="default"
      role={role}
    >
      <Icon name={ICON[tone]} className="ui-alert__icon" />
      <div className="ui-alert__body">
        <span className="ui-visually-hidden">{t(`ui.alert.${tone}`)} </span>
        {title && <p className="ui-alert__title">{title}</p>}
        {children && <div className="ui-alert__text">{children}</div>}
      </div>
      {action && <div className="ui-alert__action">{action}</div>}
    </div>
  );
}
