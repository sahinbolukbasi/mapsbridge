import type { ReactNode } from "react";
import { cx } from "./cx";
import "./ui.css";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info"
  /** "Örnek" veri rozeti (design §0.6). */
  | "example"
  | "highlight";

/** Metin her zaman vardır (renk tek ipucu değildir); sayı rozetinde bağlamı VisuallyHidden ekler. */
export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cx("ui-badge", `ui-badge--${tone}`, className)} data-surface="default">
      {dot && <span className="ui-badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
