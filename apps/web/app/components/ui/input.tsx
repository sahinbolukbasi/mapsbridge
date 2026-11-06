import { forwardRef, type InputHTMLAttributes } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./svg-icon";
import "./ui.css";

export type ControlSize = "sm" | "md" | "lg";

type Base = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: ControlSize;
  invalid?: boolean;
  /** Alanın başında dekoratif ikon (direction login/register "leading ikonlu alan"). */
  iconStart?: IconName;
};
/** Field dışında kullanımda erişilebilir ad zorunludur (aria-label ya da aria-labelledby). */
export type InputProps = Base &
  ({ id: string } | { "aria-label": string } | { "aria-labelledby": string });

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = "md", invalid = false, iconStart, className, ...rest },
  ref,
) {
  const input = (
    <input
      ref={ref}
      {...rest}
      className={cx("ui-input", `ui-input--${size}`, iconStart && "ui-input--with-icon", className)}
      data-surface="default"
      aria-invalid={invalid || rest["aria-invalid"] || undefined}
    />
  );
  if (!iconStart) return input;
  return (
    <span className="ui-input-wrap">
      <Icon name={iconStart} size={20} className="ui-input-wrap__icon" />
      {input}
    </span>
  );
});
