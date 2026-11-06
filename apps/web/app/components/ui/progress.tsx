"use client";
import { useLocale } from "../../lib/locale-context";
import { cx } from "./cx";
import { clampProgress, stepAnnouncement, stepState } from "./logic/progress";
import { Icon } from "./svg-icon";
import "./ui.css";

type Common = {
  /** Erişilebilir ad (görünür etiket yoksa da zorunlu). */
  label: string;
  className?: string;
};
export type ProgressProps =
  | (Common & { variant: "determinate"; value: number; max?: number; showValue?: boolean })
  | (Common & { variant: "indeterminate" })
  | (Common & {
      variant: "steps";
      /** Gerçek işlem adımları (süre uydurulmaz). */
      steps: readonly { id: string; label: string }[];
      /** Etkin adımın sırası; steps.length → hepsi tamam. */
      current: number;
    });

/**
 * İlerleme (direction §2): belirli (genişlik geçişi), belirsiz (kayan çubuk), adımlı (aktif adım
 * döner, tamamlanan onaylanır). role="progressbar"; adımlarda değişiklik aria-live ile duyurulur.
 * Hareket yalnız no-preference'ta; azaltmada statik çubuk ve adım metni.
 */
export function Progress(props: ProgressProps) {
  const { t } = useLocale();
  if (props.variant === "steps") {
    const { steps, current } = props;
    const done = Math.min(current, steps.length);
    const announcement =
      current >= steps.length
        ? t("ui.progress.done", "Tamamlandı")
        : stepAnnouncement(
            t("ui.progress.step", "Adım {n}/{total}: {label}"),
            current,
            steps.map((s) => s.label),
          );
    return (
      <div className={cx("ui-progress", "ui-progress--steps", props.className)}>
        <div
          role="progressbar"
          aria-label={props.label}
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={done}
          aria-valuetext={announcement}
        >
          <ol className="ui-progress__steps">
            {steps.map((s, i) => {
              const state = stepState(i, current);
              return (
                <li key={s.id} className="ui-progress__step" data-state={state}>
                  <span className="ui-progress__marker" aria-hidden="true">
                    {state === "done" && <Icon name="check" size={16} />}
                  </span>
                  <span className="ui-progress__step-label">{s.label}</span>
                </li>
              );
            })}
          </ol>
        </div>
        <p className="ui-visually-hidden" aria-live="polite">
          {announcement}
        </p>
      </div>
    );
  }
  if (props.variant === "indeterminate")
    return (
      <div
        className={cx("ui-progress", "ui-progress--indeterminate", props.className)}
        role="progressbar"
        aria-label={props.label}
        aria-busy="true"
      >
        <span className="ui-progress__track">
          <span className="ui-progress__bar" />
        </span>
      </div>
    );
  const pct = clampProgress(props.value, props.max);
  return (
    <div className={cx("ui-progress", "ui-progress--determinate", props.className)}>
      <span
        className="ui-progress__track"
        role="progressbar"
        aria-label={props.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span className="ui-progress__bar" style={{ inlineSize: `${pct}%` }} />
      </span>
      {props.showValue && (
        <span className="ui-progress__value" aria-hidden="true">
          %{Math.round(pct)}
        </span>
      )}
    </div>
  );
}
