import { cx } from "./cx";
import "./ui.css";

/** Dekoratif yer tutucu (aria-hidden); shimmer yalnızca prefers-reduced-motion: no-preference'ta. */
export function Skeleton({
  shape = "text",
  lines = 1,
  width,
  height,
}: {
  shape?: "text" | "rect" | "circle";
  lines?: number;
  width?: string;
  height?: string;
}) {
  const style = width || height ? { inlineSize: width, blockSize: height } : undefined;
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
