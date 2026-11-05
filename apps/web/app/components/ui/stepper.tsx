"use client";
import { useId } from "react";
import { useLocale } from "../../lib/locale-context";
import { cx } from "./cx";
import { IconButton } from "./icon-button";
import { clampStep } from "./logic/choice";
import "./ui.css";
/**
 * Sayı seçici (design §4.2): gün/gece sayısı. role="spinbutton" değil; iki IconButton ve
 * aria-live değer. Sınırda buton aria-disabled olur (odak kaybolmaz), değer [min, max]'ta kalır.
 */
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  const { t } = useLocale();
  const id = useId();
  const atMin = clampStep(value, -1, min, max) === value;
  const atMax = clampStep(value, 1, min, max) === value;
  const step = (delta: number) => {
    const next = clampStep(value, delta, min, max);
    if (next !== value) onChange(next);
  };
  return (
    <div className={cx("ui-stepper", className)} role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="ui-stepper__label">
        {label}
      </span>
      <div className="ui-stepper__controls">
        <IconButton
          icon="minus"
          variant="secondary"
          label={`${t("ui.stepper.decrease", "Azalt")}: ${label}`}
          aria-disabled={atMin || undefined}
          onClick={() => step(-1)}
        />
        <output className="ui-stepper__value" aria-live="polite">
          {value}
        </output>
        <IconButton
          icon="plus"
          variant="secondary"
          label={`${t("ui.stepper.increase", "Artır")}: ${label}`}
          aria-disabled={atMax || undefined}
          onClick={() => step(1)}
        />
      </div>
    </div>
  );
}
