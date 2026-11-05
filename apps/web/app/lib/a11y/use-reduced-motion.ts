"use client";
// Azaltılmış hareket tercihi (design §8.4): Leaflet flyTo ↔ setView, startViewTransition ve
// scrollIntoView({ behavior }) bunu okur. CSS tarafı @media (prefers-reduced-motion) ile çözülür.
import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** Senkron okuma (olay işleyicileri için). SSR'da ve matchMedia yoksa false. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(QUERY).matches;
}

/** Tercihi izler; mount'a kadar false döner (sunucu çıktısıyla hidrasyon eşleşir). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(QUERY);
    const update = () => setReduced(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return reduced;
}
