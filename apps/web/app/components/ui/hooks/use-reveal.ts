"use client";
// Kaydırma ile bir kez görünme (direction §2 "Kaydırmaya bağlı açılma", R15). İlerleyici
// iyileştirme: içerik JS olmadan ve azaltılmış harekette baştan görünür. Hook yalnızca
// IntersectionObserver varsa, hareket tercihi açıksa ve öğe ilk ekranda değilse
// data-reveal="pending" yazar; görünür alana girince "shown" (+ .is-in) olur. Gizleme CSS'i
// `html[data-js]` + `@media (prefers-reduced-motion: no-preference)` altındadır.
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../../../lib/a11y/use-reduced-motion";
import { revealStartsHidden } from "../logic/press-feedback";

export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const hidden = revealStartsHidden({
      hasObserver: typeof IntersectionObserver === "function",
      reducedMotion: prefersReducedMotion(),
      inViewport: rect.top < window.innerHeight && rect.bottom > 0,
    });
    if (!hidden) return;
    el.dataset.reveal = "pending";
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          el.dataset.reveal = "shown";
          el.classList.add("is-in");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      // Unmount/yeniden çalıştırmada içerik gizli kalmasın.
      if (el.dataset.reveal === "pending") el.dataset.reveal = "shown";
    };
  }, []);
  return ref;
}
