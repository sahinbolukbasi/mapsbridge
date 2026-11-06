import { cx } from "./cx";
import "./ui.css";
export type SkeletonVariant = "line" | "card" | "list-row" | "panel";
/**
 * Dekoratif yer tutucu (aria-hidden; yüklenme durumunu LoadingState/role="status" duyurur).
 * Parıltı yalnızca prefers-reduced-motion: no-preference'ta; azaltmada düz blok.
 * - shape: tek blok (text | rect | circle), `lines` ile çok satır.
 * - variant: hazır kalıplar — line, card (görsel + 2 satır), list-row (avatar + 2 satır),
 *   panel (başlık + 3 satır).
 */
export function Skeleton({
  shape = "text",
  variant,
  lines = 1,
  count = 1,
  width,
  height,
}: {
  shape?: "text" | "rect" | "circle";
  variant?: SkeletonVariant;
  lines?: number;
  /** variant ile: kaç kez tekrarlansın (liste). */
  count?: number;
  width?: string;
  height?: string;
}) {
  const style = width || height ? { inlineSize: width, blockSize: height } : undefined;
  if (variant) {
    const one = (k: number) => (
      <span key={k} className={cx("ui-skeleton-pattern", `ui-skeleton-pattern--${variant}`)}>
        {variant === "card" && <span className="ui-skeleton ui-skeleton--rect" />}
        {variant === "list-row" && <span className="ui-skeleton ui-skeleton--circle" />}
        {variant === "panel" && <span className="ui-skeleton ui-skeleton--heading" />}
        <span className="ui-skeleton-pattern__lines">
          {Array.from({ length: variant === "line" ? 1 : variant === "panel" ? 3 : 2 }, (_, i) => (
            <span key={i} className="ui-skeleton ui-skeleton--text" />
          ))}
        </span>
      </span>
    );
    return (
      <span className="ui-skeleton-group" aria-hidden="true">
        {Array.from({ length: Math.max(1, count) }, (_, k) => one(k))}
      </span>
    );
  }
  if (shape === "text" && lines > 1)
    return (
      <span className="ui-skeleton-group" aria-hidden="true">
        {Array.from({ length: lines }, (_, k) => (
          <span
            key={k}
            className="ui-skeleton ui-skeleton--text"
            style={k === lines - 1 ? style : undefined}
          />
        ))}
      </span>
    );
  return (
    <span className={cx("ui-skeleton", `ui-skeleton--${shape}`)} style={style} aria-hidden="true" />
  );
}
