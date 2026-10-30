"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "./button";
import { cx } from "./cx";
import { Icon } from "./material-icon";
import "./ui.css";

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "aria-pressed" | "aria-expanded" | "aria-controls" | "children"
> & {
  /** Material Symbols adı ya da hazır ikon düğümü. */
  icon: string | ReactNode;
  /** Zorunlu erişilebilir ad (görünür metin yok). */
  label: string;
  variant?: Exclude<ButtonVariant, "link">;
  size?: ButtonSize;
  pressed?: boolean;
  expanded?: boolean;
  controls?: string;
};

export function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "md",
  pressed,
  expanded,
  controls,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={cx(buttonClassName(variant, size, false, className), "ui-icon-button")}
      data-surface={variant === "secondary" ? "default" : undefined}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-controls={expanded !== undefined ? controls : undefined}
    >
      {typeof icon === "string" ? <Icon name={icon} /> : icon}
    </button>
  );
}
