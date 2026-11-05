// Dosya adı icon.tsx değil: app/ altında icon.tsx Next metadata ikon rotası sayılır (plan D4).
// Tek ikon seti (design §4.2, R3): path'ler packages/design-tokens/src/icons.ts'ten üretilir.
import { iconPaths, iconStroke, type IconName } from "../../lib/icon-paths";
import { cx } from "./cx";
import "./ui.css";
export type { IconName };
export type IconSize = 16 | 20 | 24;
const STROKE: Partial<Record<IconName, number>> = iconStroke;
/** Etiket yoksa dekoratiftir (aria-hidden); etiket verilirse role="img" + aria-label taşır. */
export function Icon({
  name,
  size = 20,
  label,
  className,
}: {
  name: IconName;
  size?: IconSize;
  label?: string;
  className?: string;
}) {
  return (
    <svg
      className={cx("ui-icon", className)}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE[name] ?? iconStroke.default}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}
