import { useId, type ReactNode } from "react";
import { cx } from "./cx";
import "./ui.css";

export type SectionSurface = "default" | "sunken" | "inverse" | "brand";

/** title varsa <section aria-labelledby> + <h{level}>; başlık seviyesi atlamaz (varsayılan 2). */
export function Section({
  title,
  level = 2,
  description,
  actions,
  id,
  surface = "default",
  size = "default",
  className,
  children,
}: {
  /** "display": vitrin bölümleri için büyük başlık + geniş açıklama (direction home.html). */
  size?: "default" | "display";
  title?: string;
  level?: 2 | 3;
  description?: ReactNode;
  actions?: ReactNode;
  id?: string;
  surface?: SectionSurface;
  className?: string;
  children: ReactNode;
}) {
  const autoId = useId();
  const headingId = `${id ?? autoId}-title`;
  const Heading = level === 3 ? "h3" : "h2";
  return (
    <section
      id={id}
      className={cx(
        "ui-section",
        surface !== "default" && `ui-section--${surface}`,
        size === "display" && "ui-section--display",
        className,
      )}
      aria-labelledby={title ? headingId : undefined}
      data-surface={surface === "inverse" ? "inverse" : undefined}
    >
      {(title || actions) && (
        <div className="ui-section__header">
          <div className="ui-section__titles">
            {title && (
              <Heading id={headingId} className="ui-section__title">
                {title}
              </Heading>
            )}
            {description && <p className="ui-section__description">{description}</p>}
          </div>
          {actions && <div className="ui-section__actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
