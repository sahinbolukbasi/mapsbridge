"use client";
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { useLocale } from "../../lib/locale-context";
import { cx } from "./cx";
import { IconButton } from "./icon-button";
import { FOCUSABLE_SELECTOR, nextFocusIndex, shouldWrap } from "./logic/focus-trap";
import "./ui.css";

export type ModalSize = "sm" | "md" | "lg" | "sheet";

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0,
  );
}

/**
 * Yerel <dialog> + showModal() (inert arka plan, Esc, üst katman). Odak: initialFocus ya da ilk
 * odaklanabilir, yoksa başlık; Tab döngüsü logic/focus-trap.ts; kapanışta tetikleyiciye döner.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  initialFocus,
  dismissible = true,
  footer,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  size?: ModalSize;
  initialFocus?: RefObject<HTMLElement | null>;
  /** false: scrim tıklaması kapatmaz (Esc/cancel yine onClose'a gider). */
  dismissible?: boolean;
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const { t } = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const id = useId();
  const titleId = `${id}-title`;
  const descId = description ? `${id}-desc` : undefined;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      trigger.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      const target = initialFocus?.current ?? focusables(dialog)[0] ?? titleRef.current;
      target?.focus();
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
    if (!open && dialog.open) {
      dialog.close();
      trigger.current?.focus?.();
    }
  }, [open, initialFocus]);

  useEffect(
    () => () => {
      // Söküm: açık kaldıysa kapat ve odağı geri ver.
      if (ref.current?.open) ref.current.close();
    },
    [],
  );

  return (
    <dialog
      ref={ref}
      className={cx("ui-modal", `ui-modal--${size}`, className)}
      data-surface="default"
      aria-labelledby={titleId}
      aria-describedby={descId}
      aria-modal="true"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Tab" || !ref.current) return;
        const list = focusables(ref.current);
        const current = list.indexOf(document.activeElement as HTMLElement);
        if (!shouldWrap(list.length, current, e.shiftKey)) return;
        e.preventDefault();
        const next = nextFocusIndex(list.length, current, e.shiftKey);
        (next >= 0 ? list[next] : titleRef.current)?.focus();
      }}
    >
      {open && (
        <div className="ui-modal__panel">
          <div className="ui-modal__header">
            <h2 className="ui-modal__title" id={titleId} ref={titleRef} tabIndex={-1}>
              {title}
            </h2>
            <IconButton icon="close" label={t("ui.close", "Kapat")} onClick={onClose} />
          </div>
          {description && (
            <p className="ui-modal__description" id={descId}>
              {description}
            </p>
          )}
          <div className="ui-modal__body">{children}</div>
          {footer && <div className="ui-modal__footer">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
