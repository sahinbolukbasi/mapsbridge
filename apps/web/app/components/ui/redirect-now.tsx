"use client";
import { useEffect } from "react";
/**
 * İstemci navigasyonuyla (Next <Link>) LEGACY URL'ye gelinirse inline script çalışmaz; bu çocuk
 * aynı yönlendirmeyi yapar (query + hash korunur). Hedef build-time sabittir.
 */
export function RedirectNow({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to + window.location.search + window.location.hash);
  }, [to]);
  return null;
}
