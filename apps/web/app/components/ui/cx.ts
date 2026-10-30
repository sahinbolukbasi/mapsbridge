/** Sınıf adlarını birleştirir; boş/false değerler atlanır. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
