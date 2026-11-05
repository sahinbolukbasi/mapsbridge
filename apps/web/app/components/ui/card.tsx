import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";
import "./ui.css";

export type CardVariant = "bordered" | "raised" | "inverse" | "interactive";
export type CardProps = {
  as?: "div" | "article" | "li";
  padding?: "sm" | "md" | "lg";
  /**
   * bordered (varsayılan, gölgesiz kağıt kenarlığı) · raised · inverse (koyu zemin) ·
   * interactive (href ile kartın tamamı tek link; hover yükselir, odakta halka).
   */
  variant?: CardVariant;
  href?: string;
  /** Link metni (interactive + href); verilmezse çocuklar link içine alınmaz. */
  linkLabel?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Card({
  as: Tag = "div",
  padding = "md",
  variant = "bordered",
  href,
  linkLabel,
  className,
  children,
}: CardProps) {
  const linked = variant === "interactive" && href;
  return (
    <Tag
      className={cx("ui-card", `ui-card--${padding}`, `ui-card--${variant}`, className)}
      data-surface={variant === "inverse" ? "inverse" : "default"}
    >
      {linked && linkLabel !== undefined && (
        <Link href={href} className="ui-card__link">
          {linkLabel}
        </Link>
      )}
      {children}
    </Tag>
  );
}
