"use client";
// URL'ye bağlı tek parametre (design D17). useSearchParams KULLANMAZ: ilk render (prerender ve
// hydration) `fallback` döner, mount sonrası window.location.search okunur; yazım History API ile.
import { useCallback, useEffect, useState } from "react";
import { buildSearch, parseParam } from "./logic/url-state";

export type UseUrlParamOptions<T extends string> = {
  allowed: readonly T[];
  fallback: T;
  history?: "replace" | "push";
};

export function useUrlParam<T extends string>(
  name: string,
  { allowed, fallback, history = "replace" }: UseUrlParamOptions<T>,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(fallback);
  // allowed dizisi her render'da yeni olabilir; efekt içerik anahtarına bağlanır.
  const allowedKey = allowed.join("\u0000");

  useEffect(() => {
    const list = allowedKey.split("\u0000") as T[];
    const read = () => setValue(parseParam(window.location.search, name, list, fallback));
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [name, allowedKey, fallback]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      const { pathname, search, hash } = window.location;
      const url = pathname + buildSearch(search, name, next, fallback) + hash;
      if (history === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [name, fallback, history],
  );

  return [value, update];
}
