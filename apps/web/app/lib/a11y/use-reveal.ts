"use client";
// Kaydırma ile bir kez görünme (design §8.2 "Scroll reveal"). İlerleyici iyileştirme: içerik
// JS olmadan ve azaltılmış harekette baştan görünür. Hook yalnızca IntersectionObserver varsa ve
// hareket tercihi açıksa data-reveal="pending" yazar; öğe görünür alana girince "shown" olur.
// Animasyon CSS'te `@media (prefers-reduced-motion: no-preference)` içindedir.
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "./use-reduced-motion";

export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== "function" || prefersReducedMotion()) return;
    // Zaten görünür alandaysa (ilk ekran) gizleyip yeniden göstermeyiz.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) return;
    el.dataset.reveal = "pending";
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          el.dataset.reveal = "shown";
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
