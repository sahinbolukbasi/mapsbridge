"use client";
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { useLocale } from "../../lib/locale-context";
import "./ui.css";

export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
};

/**
 * Etiket + ipucu + hata. Kontrole id, aria-describedby (ipucu + hata), aria-invalid ve
 * aria-required enjekte eder. Hata <p role="alert"> yalnızca hata metni değişince duyurulur.
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  optionalLabel,
  className,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  /** Zorunlu olmayan alanda etiketin yanına (ör. "isteğe bağlı"). */
  optionalLabel?: string;
  className?: string;
  children: ((ids: FieldControlProps) => ReactNode) | ReactElement<FieldControlProps>;
}) {
  const { t } = useLocale();
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control: FieldControlProps = {
    id,
    "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
    "aria-invalid": error ? true : undefined,
    "aria-required": required || undefined,
  };
  const rendered =
    typeof children === "function"
      ? children(control)
      : isValidElement(children)
        ? cloneElement(children, control)
        : children;
  return (
    <div className={className ? `ui-field ${className}` : "ui-field"}>
      <label className="ui-field__label" htmlFor={id}>
        {label}
        {required ? (
          <>
            <span className="ui-field__required" aria-hidden="true">
              {" "}
              *
            </span>
            <span className="ui-visually-hidden"> ({t("ui.required", "zorunlu")})</span>
          </>
        ) : (
          optionalLabel && <span className="ui-field__optional"> ({optionalLabel})</span>
        )}
      </label>
      {hint && (
        <p className="ui-field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {rendered}
      {error && (
        <p className="ui-field__error" id={errorId} role="alert" key={error}>
          {error}
        </p>
      )}
    </div>
  );
}
