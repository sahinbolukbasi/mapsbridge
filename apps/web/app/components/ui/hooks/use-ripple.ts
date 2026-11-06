"use client";
// Basılan noktadan ripple halkası (direction §2 "Basma"). Yalnız hareket serbestken; azaltmada
// hiçbir şey yazmaz (yalnız renk durumu kalır). Görünüm ui.css `.ui-button[data-ripple]`.
import { useCallback, type PointerEvent } from "react";
import { prefersReducedMotion } from "../../../lib/a11y/use-reduced-motion";
import { rippleOrigin } from "../logic/press-feedback";

export function useRipple<T extends HTMLElement>() {
  return useCallback((e: PointerEvent<T>) => {
    if (prefersReducedMotion()) return;
    const el = e.currentTarget;
    if (el.getAttribute("aria-disabled") === "true") return;
    const { x, y, size } = rippleOrigin(el.getBoundingClientRect(), e.clientX, e.clientY);
    el.style.setProperty("--ripple-x", `${x}px`);
    el.style.setProperty("--ripple-y", `${y}px`);
    el.style.setProperty("--ripple-size", `${size}px`);
    // Animasyonu yeniden başlat: özniteliği kaldır, bir kare sonra geri yaz.
    el.removeAttribute("data-ripple");
    requestAnimationFrame(() => el.setAttribute("data-ripple", ""));
  }, []);
}
