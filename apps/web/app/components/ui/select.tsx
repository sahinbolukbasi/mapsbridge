import { forwardRef, type SelectHTMLAttributes } from "react";
import { cx } from "./cx";
import type { ControlSize } from "./input";
import "./ui.css";

type Base = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  size?: ControlSize;
  invalid?: boolean;
};
/** Yerel <select> (özel listbox yok). Field dışında kullanımda erişilebilir ad zorunludur. */
export type SelectProps = Base &
  ({ id: string } | { "aria-label": string } | { "aria-labelledby": string });

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { size = "md", invalid = false, className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      {...rest}
      className={cx("ui-select", `ui-select--${size}`, className)}
      data-surface="default"
      aria-invalid={invalid || rest["aria-invalid"] || undefined}
    >
      {children}
    </select>
  );
});
