"use client";
// Değer değişince eski değerden yeniye sayar (yalnız hareket serbestken; azaltmada anında).
// Ekran okuyucuya yalnız son değer gider: çağıran görünür sayıyı aria-hidden yapıp gerçek
// değeri ayrıca yazar.
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../../../lib/a11y/use-reduced-motion";
import { countUpValue } from "../logic/count-up";
export function useCountUp(target: number, durationMs = 900): number {
  const [shown, setShown] = useState(target);
  const from = useRef(0);
  useEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame !== "function") {
      setShown(target);
      from.current = target;
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const v = countUpValue(origin, target, (now - start) / durationMs);
      setShown(v);
      if (v !== target) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = target;
    };
  }, [target, durationMs]);
  return shown;
}
