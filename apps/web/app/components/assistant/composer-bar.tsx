"use client";
import { useId, useState, type ReactNode, type Ref } from "react";
import type { CreditCost } from "../../lib/billing/credit-costs";
import { useLocale } from "../../lib/locale-context";
import { Button, Icon } from "../ui";
import "./assistant-ui.css";

/**
 * Sohbet girişi + maliyet etiketi (design §4.2, mock b-assistant.html). Etiket görsel olarak
 * gizli; Enter gönderir, Shift+Enter satır ekler (IME bileşimi sırasında Enter göndermez).
 * `cost` gönder düğmesinde CostBadge olarak görünür ("Gönder, 1 kredi"); yalnızca gösterimdir,
 * kredi sunucuda düşer. `disabled` + `disabledReason`: neden görünür yazılır ve alan ile düğme
 * aria-describedby ile ona bağlanır. `value`/`onChange` verilirse kontrollü çalışır.
 */
export function ComposerBar({
  placeholder,
  label,
  cost,
  disabled = false,
  disabledReason,
  busy = false,
  onSubmit,
  maxLength = 500,
  value: valueProp,
  onChange,
  leading,
  inputRef,
  submitLabel,
  className,
}: {
  placeholder: string;
  /** Görsel olarak gizli etiket; verilmezse placeholder. */
  label?: string;
  cost?: CreditCost;
  disabled?: boolean;
  disabledReason?: ReactNode;
  busy?: boolean;
  onSubmit: (text: string) => void;
  maxLength?: number;
  value?: string;
  onChange?: (value: string) => void;
  /** Alanın solundaki ek kontroller (ör. konum, sesli giriş). */
  leading?: ReactNode;
  inputRef?: Ref<HTMLTextAreaElement>;
  submitLabel?: string;
  className?: string;
}) {
  const { t } = useLocale();
  const id = useId();
  const [inner, setInner] = useState("");
  const controlled = valueProp !== undefined;
  const value = controlled ? valueProp : inner;
  const setValue = (next: string) => {
    if (!controlled) setInner(next);
    onChange?.(next);
  };
  const reasonId = disabled && disabledReason ? `${id}-reason` : undefined;
  const canSend = !disabled && !busy && value.trim().length > 0;
  const submit = () => {
    if (!canSend) return;
    const text = value.trim();
    onSubmit(text);
    if (!controlled) setInner("");
  };
  return (
    <div className={className ? `as-composer-wrap ${className}` : "as-composer-wrap"}>
      <form
        className="as-composer"
        data-surface="default"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {leading && <div className="as-composer__leading">{leading}</div>}
        <label htmlFor={id} className="ui-visually-hidden">
          {label ?? placeholder}
        </label>
        <textarea
          ref={inputRef}
          id={id}
          className="as-composer__input"
          value={value}
          rows={1}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled}
          aria-describedby={reasonId}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button
          type="submit"
          variant="primary"
          cost={cost}
          loading={busy}
          disabled={!canSend}
          aria-describedby={reasonId}
          iconEnd={<Icon name="send" size={16} />}
        >
          {submitLabel ?? t("assistant.composer.send", "Gönder")}
        </Button>
      </form>
      {reasonId && (
        <p id={reasonId} className="as-composer__reason">
          {disabledReason}
        </p>
      )}
    </div>
  );
}
