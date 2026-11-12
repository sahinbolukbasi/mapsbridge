"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLocale } from "../../lib/locale-context";
import { Button, Icon } from "../ui";
import "./assistant-ui.css";

/**
 * Sohbet balonu (design §4.2). Kullanıcı balonu birincil (koyu) zeminli olduğu için
 * data-surface="inverse" taşır (G18); asistan balonu kağıt yüzeydir. Yeni mesaj girişi yalnızca
 * hareket tercihinde (opacity + 4px kayma, --duration-base/--easing-enter).
 */
export function MessageBubble({
  role,
  className,
  children,
}: {
  role: "user" | "assistant";
  className?: string;
  children: ReactNode;
}) {
  if (role === "user") {
    return (
      <div className="as-msg as-msg--user">
        <div
          className={
            className ? `as-bubble as-bubble--user ${className}` : "as-bubble as-bubble--user"
          }
          data-surface="inverse"
        >
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="as-msg as-msg--assistant">
      <div
        className={
          className
            ? `as-bubble as-bubble--assistant ${className}`
            : "as-bubble as-bubble--assistant"
        }
        data-surface="default"
      >
        {children}
      </div>
    </div>
  );
}

/** Sadece 3 nokta animasyonu görünür; metin yalnız ekran okuyucuya kalır. */
export function TypingIndicator() {
  const { t } = useLocale();
  return (
    <span className="as-typing" role="status" aria-label={t("assistant.typing", "Yanıt hazırlanıyor…")}>
      <span className="as-typing__dots" aria-hidden="true">
        <span className="as-typing__dot" />
        <span className="as-typing__dot" />
        <span className="as-typing__dot" />
      </span>
      <span className="ui-visually-hidden">{t("assistant.typing", "Yanıt hazırlanıyor…")}</span>
    </span>
  );
}

/** Alttan bu kadar piksel içindeyse kullanıcı "altta" sayılır. */
const BOTTOM_SLACK = 48;

/**
 * Sohbet akışı (design §4.2, §8.3): role="log" aria-live="polite". İçerik büyüdüğünde kullanıcı
 * alttaysa otomatik kaydırılır; değilse "Yeni mesaj" hapı çıkar (dokununca alta iner).
 * `typing`: true → TypingIndicator, düğüm → o düğüm (ör. akış metni), asistan balonunda.
 * Liste `overscroll-behavior: contain` ile sayfayı sürüklemez.
 */
export function MessageLog({
  label,
  busy = false,
  typing,
  className,
  children,
}: {
  label?: string;
  busy?: boolean;
  typing?: boolean | ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const lastHeight = useRef(0);
  const [hasNew, setHasNew] = useState(false);
  // Her render sonrası: içerik büyüdüyse alta in (kullanıcı alttaysa) ya da hapı göster.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const height = el.scrollHeight;
    if (height > lastHeight.current + 1) {
      if (atBottom.current) el.scrollTop = height;
      else setHasNew(true);
    }
    lastHeight.current = height;
  });
  const toBottom = () => {
    const el = ref.current;
    if (!el) return;
    atBottom.current = true;
    el.scrollTop = el.scrollHeight;
    setHasNew(false);
  };
  return (
    <div className="as-log-wrap">
      <div
        ref={ref}
        className={className ? `as-log ${className}` : "as-log"}
        role="log"
        aria-live="polite"
        aria-busy={busy || undefined}
        aria-label={label ?? t("assistant.log.label", "Sohbet")}
        tabIndex={0}
        onScroll={(e) => {
          const el = e.currentTarget;
          const bottom = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_SLACK;
          atBottom.current = bottom;
          if (bottom && hasNew) setHasNew(false);
        }}
      >
        <div className="as-log__list">
          {children}
          {typing ? (
            <MessageBubble role="assistant">
              {typing === true ? <TypingIndicator /> : typing}
            </MessageBubble>
          ) : null}
        </div>
      </div>
      {hasNew && (
        <div className="as-log__new">
          <Button
            variant="secondary"
            size="sm"
            onClick={toBottom}
            iconEnd={<Icon name="chevron" size={16} />}
          >
            {t("assistant.log.new", "Yeni mesaj")}
          </Button>
        </div>
      )}
    </div>
  );
}
