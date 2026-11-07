"use client";
import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";
import { nextTabIndex } from "./logic/tabs-keyboard";
import "./ui.css";
export type SegmentOption<V extends string> = { value: V; label: ReactNode };
type Options<V extends string> =
  | readonly [SegmentOption<V>, SegmentOption<V>]
  | readonly [SegmentOption<V>, SegmentOption<V>, SegmentOption<V>]
  | readonly [SegmentOption<V>, SegmentOption<V>, SegmentOption<V>, SegmentOption<V>];
// Radyo grubunda dikey oklar da komşu seçeneğe gider (APG radio group).
const KEY_ALIAS: Record<string, string> = { ArrowDown: "ArrowRight", ArrowUp: "ArrowLeft" };
/**
 * 2–4 karşılıklı dışlayan seçenek (design §4.2, R3): role="radiogroup", roving tabindex, ok
 * tuşları/Home/End seçer (logic/tabs-keyboard.ts). Seçili zemin hareket tercihinde kayar.
 */
export function SegmentedControl<V extends string>({
  label,
  options,
  value,
  onChange,
  className,
  size = "md",
  block = false,
}: {
  label: string;
  options: Options<V>;
  value: V;
  onChange: (value: V) => void;
  className?: string;
  /** "sm": dar panellerde (planlayıcı 256 px) etiketlerin sığması için sıkı dolgu + küçük yazı. */
  size?: "md" | "sm";
  /** Kabın tüm satırı doldurması (eşit sütunlar). */
  block?: boolean;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  // value hiçbir seçenekle eşleşmezse hiçbiri seçili gösterilmez (yanlış aria-checked yok);
  // APG gereği o durumda sekme sırasına ilk seçenek girer.
  const index = options.findIndex((o) => o.value === value);
  const tabbable = Math.max(0, index);
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, k: number) {
    const next = nextTabIndex(
      k,
      KEY_ALIAS[e.key] ?? e.key,
      options.map(() => false),
    );
    if (next === null) return;
    e.preventDefault();
    refs.current[next]?.focus();
    if (next !== index) onChange(options[next].value);
  }
  const style = { "--segment-count": options.length, "--segment-index": tabbable } as CSSProperties;
  return (
    <div
      className={cx(
        "ui-segmented",
        size === "sm" && "ui-segmented--sm",
        block && "ui-segmented--block",
        className,
      )}
      role="radiogroup"
      aria-label={label}
      data-surface="default"
      style={style}
    >
      {index >= 0 && <span className="ui-segmented__indicator" aria-hidden="true" />}
      {options.map((option, k) => (
        <button
          key={option.value}
          ref={(el) => {
            refs.current[k] = el;
          }}
          type="button"
          role="radio"
          className="ui-segmented__option"
          aria-checked={k === index}
          tabIndex={k === tabbable ? 0 : -1}
          onClick={() => {
            if (k !== index) onChange(option.value);
          }}
          onKeyDown={(e) => onKeyDown(e, k)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
