import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cx } from "./cx";
import type { ControlSize } from "./input";
import "./ui.css";

type Base = TextareaHTMLAttributes<HTMLTextAreaElement> & { size?: ControlSize; invalid?: boolean };
/** Field dışında kullanımda erişilebilir ad zorunludur. */
export type TextareaProps = Base &
  ({ id: string } | { "aria-label": string } | { "aria-labelledby": string });

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { size = "md", invalid = false, className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      {...rest}
      className={cx("ui-textarea", `ui-textarea--${size}`, className)}
      data-surface="default"
      aria-invalid={invalid || rest["aria-invalid"] || undefined}
    />
  );
});
