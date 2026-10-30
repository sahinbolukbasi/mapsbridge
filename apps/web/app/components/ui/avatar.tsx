import { cx } from "./cx";
import "./ui.css";

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts.slice(0, 1);
  return letters.map((p) => p.charAt(0).toLocaleUpperCase("tr-TR")).join("") || "?";
}

/** Görsel varsa img alt={name}; yoksa baş harfler + aria-label. decorative → alt="" / aria-hidden. */
export function Avatar({
  src,
  name,
  size = "md",
  decorative = false,
  className,
}: {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  decorative?: boolean;
  className?: string;
}) {
  const cls = cx("ui-avatar", `ui-avatar--${size}`, className);
  // Statik export: next/image optimizasyonu yok, düz <img> kullanılır.
  if (src)
    return <img className={cls} src={src} alt={decorative ? "" : name} data-surface="default" />;
  return (
    <span
      className={cls}
      data-surface="default"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
    >
      {initialsOf(name)}
    </span>
  );
}
