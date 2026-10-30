// Dosya adı icon.tsx değil: app/ altında icon.tsx Next metadata ikon rotası sayılır (app icon kuralı).
import { cx } from "./cx";
import "./ui.css";

export type IconSize = "sm" | "md" | "lg";

/** Material Symbols ligatürü. Hiçbir zaman erişilebilir ad taşımaz; ad sahibi kapsayıcıdır. */
export function Icon({
  name,
  size = "md",
  filled = false,
  className,
}: {
  name: string;
  size?: IconSize;
  filled?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "material-symbols-outlined ui-icon",
        `ui-icon--${size}`,
        filled && "ui-icon--filled",
        className,
      )}
      aria-hidden="true"
      translate="no"
    >
      {name}
    </span>
  );
}
