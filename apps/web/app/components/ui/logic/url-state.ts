// URL durumu (saf, design D17): ?tab= / ?sekme= / ?alan= gibi tek parametreyi okur ve yazar.
// useSearchParams kullanılmaz; hook (use-url-param.ts) window.location + History API ile çalışır.

/** Bilinmeyen ya da boş değer `fallback`'e düşer. */
export function parseParam<T extends string>(
  search: string,
  name: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = new URLSearchParams(search).get(name);
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * Diğer parametreleri koruyarak `name`'i yazar; değer `fallback`'e eşitse parametre silinir.
 * Dönüş "" ya da "?a=b" biçimindedir (pathname + dönüş + hash ile birleştirilir).
 */
export function buildSearch(
  current: string,
  name: string,
  value: string,
  fallback: string,
): string {
  const params = new URLSearchParams(current);
  if (value === fallback) params.delete(name);
  else params.set(name, value);
  const out = params.toString();
  return out ? `?${out}` : "";
}
