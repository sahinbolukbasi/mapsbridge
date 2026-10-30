"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * `?modal=saved` dinleyicisi (design §4.1, G21: useSearchParams yalnız *-listener.tsx'te).
 * Tüketici <Suspense fallback={null}> içinde render eder; sayfa kökü Suspense'e sarılmaz.
 */
export function SavedModalListener({ onOpen }: { onOpen: () => void }) {
  const params = useSearchParams();
  const modal = params?.get("modal");
  useEffect(() => {
    if (modal === "saved") onOpen();
  }, [modal, onOpen]);
  return null;
}
