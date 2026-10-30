"use client";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx";
import "./ui.css";

/** Yerel <input type=checkbox>; switch → role="switch". Etiket tıklanabilir alanı ≥44px. */
export function Checkbox({
  label,
  checked,
  onChange,
  hint,
  variant = "checkbox",
  disabled,
  name,
  value,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "checked"> & {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: ReactNode;
  variant?: "checkbox" | "switch";
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={cx("ui-checkbox", `ui-checkbox--${variant}`, className)}>
      <label className="ui-checkbox__label" htmlFor={id}>
        <input
          {...rest}
          id={id}
          type="checkbox"
          className="ui-checkbox__box"
          data-surface="default"
          role={variant === "switch" ? "switch" : undefined}
          aria-checked={variant === "switch" ? checked : undefined}
          aria-describedby={hintId}
          checked={checked}
          disabled={disabled}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="ui-checkbox__text">{label}</span>
      </label>
      {hint && (
        <p className="ui-checkbox__hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}
