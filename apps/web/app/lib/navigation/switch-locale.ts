// Dil anahtarı (header + footer ortak). D13: gerçek dil varyantı varsa ona, yoksa dil köküne
// gidilir (404 üreten /en/<path>/ üretilmez). Tercih `locale` çerezine yazılır.
import { getAlternatePath, localeRootPath } from "../locale-utils";

export function switchLocale(pathname: string, isEnglish: boolean): void {
  const target = isEnglish ? "tr" : "en";
  const alternate = getAlternatePath(pathname);
  const here = pathname.endsWith("/") ? pathname : `${pathname}/`;
  document.cookie = `locale=${target};path=/;max-age=31536000;SameSite=Lax`;
  window.location.assign(alternate !== here ? alternate : localeRootPath(target));
}
