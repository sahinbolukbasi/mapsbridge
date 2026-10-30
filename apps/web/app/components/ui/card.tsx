import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";
import "./ui.css";

export type CardProps = {
  as?: "div" | "article" | "li";
  padding?: "sm" | "md" | "lg";
  /** href ile birlikte: kartın tamamı tek link (başlık bağlantısı ::after ile yayılır). */
  interactive?: boolean;
  href?: string;
  /** Link metni (interactive + href); verilmezse çocuklar link içine alınmaz. */
  linkLabel?: ReactNode;
  surface?: "default" | "inverse";
  className?: string;
  children: ReactNode;
};

export function Card({
  as: Tag = "div",
  padding = "md",
  interactive = false,
  href,
  linkLabel,
  surface = "default",
  className,
  children,
}: CardProps) {
  const linked = interactive && href;
  return (
    <Tag
      className={cx(
        "ui-card",
        `ui-card--${padding}`,
        surface === "inverse" && "ui-card--inverse",
        linked && "ui-card--interactive",
        className,
      )}
      data-surface={surface === "inverse" ? "inverse" : "default"}
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
