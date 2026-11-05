"use client";
import { Children, createContext, isValidElement, useContext, useId, type ReactNode } from "react";
import { cx } from "./cx";
import { chipLocked, type ChoiceMode } from "./logic/choice";
import { Icon, type IconName } from "./svg-icon";
import "./ui.css";
type GroupState = { mode: ChoiceMode; max?: number; selectedCount: number };
const ChipGroupContext = createContext<GroupState | null>(null);
/**
 * Seçenek çipi (design §4.2, R3): başlangıç önerisi, filtre, I3 seçenekleri. aria-pressed ile
 * durum taşır; görsel 40px, dokunma alanı 44px. Çoklu grupta `max` dolunca seçili olmayanlar
 * aria-disabled olur (odak kaybolmaz).
 */
export function Chip({
  pressed = false,
  icon,
  onPress,
  disabled = false,
  className,
  children,
}: {
  pressed?: boolean;
  icon?: IconName;
  onPress: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const group = useContext(ChipGroupContext);
  const locked = group ? chipLocked(pressed, group.selectedCount, group.mode, group.max) : false;
  const inert = disabled || locked;
  return (
    <button
      type="button"
      className={cx("ui-chip", className)}
      aria-pressed={pressed}
      aria-disabled={inert || undefined}
      onClick={() => {
        if (!inert) onPress();
      }}
    >
      {icon && <Icon name={icon} size={16} />}
      <span className="ui-chip__label">{children}</span>
      {pressed && <Icon name="check" size={16} className="ui-chip__check" />}
    </button>
  );
}
/** role="group" + görünür etiket (aria-labelledby). Seçim durumu çocuk Chip'lerin `pressed`'inden. */
export function ChipGroup({
  label,
  mode,
  max,
  className,
  children,
}: {
  label: ReactNode;
  mode: ChoiceMode;
  max?: number;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const selectedCount = Children.toArray(children).filter(
    (child) => isValidElement<{ pressed?: boolean }>(child) && child.props.pressed,
  ).length;
  return (
    <div
      className={cx("ui-chip-group", className)}
      role="group"
      aria-labelledby={`${id}-label`}
      data-mode={mode}
    >
      <span id={`${id}-label`} className="ui-chip-group__label">
        {label}
      </span>
      <div className="ui-chip-group__items">
        <ChipGroupContext.Provider value={{ mode, max, selectedCount }}>
          {children}
        </ChipGroupContext.Provider>
      </div>
    </div>
  );
}
