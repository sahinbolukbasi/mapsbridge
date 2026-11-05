"use client";
import { useId, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { useLocale } from "../../lib/locale-context";
import { cx } from "./cx";
import {
  SHEET_DRAG_THRESHOLD,
  nextSnap,
  orderedSnaps,
  snapFromDrag,
  type SheetSnap,
} from "./logic/sheet-snap";
import "./ui.css";
export type { SheetSnap };
/**
 * Mobil kalıcı panel (design §4.2, R3). Modal değildir: arka plan etkileşimli kalır, odak
 * tuzağı yoktur. Tutamak bir <button>: Enter/Space/dokunma snap'ler arasında döner, ↑/↓
 * büyütür/küçültür, pointer ile sürüklenir (logic/sheet-snap.ts). Yükseklikler --sheet-*
 * token'larından; hareket yalnızca transform (no-preference'ta geçişli). Yerleşim (fixed/alt
 * kenar) sayfaya aittir.
 */
export function BottomSheet({
  snap,
  initial,
  label,
  className,
  children,
}: {
  snap: readonly SheetSnap[];
  initial?: SheetSnap;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useLocale();
  const order = orderedSnaps(snap);
  const [current, setCurrent] = useState<SheetSnap>(
    initial && order.includes(initial) ? initial : (order[0] ?? "peek"),
  );
  const rootRef = useRef<HTMLElement>(null);
  const drag = useRef<{ y: number } | null>(null);
  const suppressClick = useRef(false);
  const bodyId = useId();
  const atTop = current === order[order.length - 1];
  const setDrag = (dy: number | null) => {
    const el = rootRef.current;
    if (!el) return;
    if (dy === null) {
      el.style.removeProperty("--sheet-drag");
      delete el.dataset.dragging;
    } else {
      el.style.setProperty("--sheet-drag", `${dy}px`);
      el.dataset.dragging = "true";
    }
  };
  const endDrag = (e: PointerEvent<HTMLButtonElement>, commit: boolean) => {
    const start = drag.current;
    drag.current = null;
    setDrag(null);
    if (!start || !commit) return;
    const dy = e.clientY - start.y;
    if (Math.abs(dy) >= SHEET_DRAG_THRESHOLD) {
      suppressClick.current = true;
      setCurrent(snapFromDrag(dy, current, order));
    }
  };
  return (
    <section
      ref={rootRef}
      className={cx("ui-bottom-sheet", className)}
      aria-label={label}
      data-snap={current}
      data-surface="default"
    >
      <button
        type="button"
        className="ui-bottom-sheet__handle"
        aria-label={
          atTop ? t("ui.sheet.collapse", "Paneli daralt") : t("ui.sheet.expand", "Paneli genişlet")
        }
        aria-controls={bodyId}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          setCurrent(nextSnap(current, "Enter", order) ?? current);
        }}
        onKeyDown={(e) => {
          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
          const next = nextSnap(current, e.key, order);
          if (next === null) return;
          e.preventDefault();
          setCurrent(next);
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          drag.current = { y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setDrag(e.clientY - drag.current.y);
        }}
        onPointerUp={(e) => endDrag(e, true)}
        onPointerCancel={(e) => endDrag(e, false)}
      />
      <div id={bodyId} className="ui-bottom-sheet__body">
        {children}
      </div>
    </section>
  );
}
