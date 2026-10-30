import { forwardRef, type InputHTMLAttributes } from "react";
import { cx } from "./cx";
import "./ui.css";

export type ControlSize = "sm" | "md" | "lg";

type Base = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: ControlSize;
  invalid?: boolean;
};
/** Field dışında kullanımda erişilebilir ad zorunludur (aria-label ya da aria-labelledby). */
export type InputProps = Base &
  ({ id: string } | { "aria-label": string } | { "aria-labelledby": string });

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = "md", invalid = false, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      {...rest}
      className={cx("ui-input", `ui-input--${size}`, className)}
      data-surface="default"
      aria-invalid={invalid || rest["aria-invalid"] || undefined}
    />
  );
});
