"use client";
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { prefersReducedMotion } from "../../lib/a11y/use-reduced-motion";
import { useLocale } from "../../lib/locale-context";
import { cx } from "./cx";
import { IconButton } from "./icon-button";
import { FOCUSABLE_SELECTOR, nextFocusIndex, shouldWrap } from "./logic/focus-trap";
import "./ui.css";

export type ModalSize = "sm" | "md" | "lg" | "sheet";

// sheet varyantı küçük ekranda alttan kayar; kapanış animasyonu bitince dialog.close() (§8.2).
const SHEET_MOTION_QUERY = "(max-width: 767.98px)";
function animatesSheet(size: ModalSize): boolean {
  return (
    size === "sheet" &&
    !prefersReducedMotion() &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(SHEET_MOTION_QUERY).matches
  );
}
/** Kapanış animasyonu takılırsa güvenlik süresi: --duration-slow (+ pay). */
function closeFallbackMs(el: HTMLElement): number {
  const raw = getComputedStyle(el).getPropertyValue("--duration-slow").trim();
  const ms = raw.endsWith("ms") ? parseFloat(raw) : parseFloat(raw) * 1000;
  return (Number.isFinite(ms) ? ms : 320) + 80;
}
function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0,
  );
}

/**
 * Yerel <dialog> + showModal() (inert arka plan, Esc, üst katman). Odak: initialFocus ya da ilk
 * odaklanabilir, yoksa başlık; Tab döngüsü logic/focus-trap.ts; kapanışta tetikleyiciye döner.
 * sheet: küçük ekranda --duration-deliberate/--easing-enter ile açılır, --duration-slow/
 * --easing-exit ile kapanır (yalnızca hareket tercihinde; aksi halde anında).
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
  const [closing, setClosing] = useState(false);
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
    if (open && dialog.open) {
      setClosing(false);
      return;
    }
    if (!open && dialog.open) {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        dialog.close();
        setClosing(false);
        trigger.current?.focus?.();
      };
      if (!animatesSheet(size)) {
        finish();
        return;
      }
      setClosing(true);
      const onEnd = (e: AnimationEvent) => {
        if (e.target === dialog) finish();
      };
      dialog.addEventListener("animationend", onEnd);
      const timer = window.setTimeout(finish, closeFallbackMs(dialog));
      return () => {
        dialog.removeEventListener("animationend", onEnd);
        window.clearTimeout(timer);
      };
    }
  }, [open, initialFocus, size]);

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
      className={cx("ui-modal", `ui-modal--${size}`, closing && "ui-modal--closing", className)}
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
      {(open || closing) && (
        <div className="ui-modal__panel">
          <div className="ui-modal__header">
            <h2 className="ui-modal__title" id={titleId} ref={titleRef} tabIndex={-1}>
              {title}
            </h2>
            <IconButton icon="x" label={t("ui.close", "Kapat")} onClick={onClose} />
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
