// I8 (design §9.1): affiliate yüzeylerinin TEK bağlama kuralı. Saf modül; bağımlılıklar parametre
// olarak gelir (lib/affiliate/** test sırasında yüklenmez). Sıralamaya dokunmaz.

export type PrepContext<R> =
  | { kind: "route"; route: R } // aktif taslak rota var
  | { kind: "strip"; destination: string; messageText: string } // rota yok, fiyat yüzeyi açık, hedef bulundu
  | { kind: "none" }; // diğer her durum

export type PrepMessage = { role: string; text: string; route?: unknown };

export function pickPrepContext<R>({
  route,
  messages,
  surfacePricing,
  extractDestination,
}: {
  route: R | null | undefined;
  messages: ReadonlyArray<PrepMessage>;
  surfacePricing: boolean;
  extractDestination: (text: string) => string | null | undefined;
}): PrepContext<R> {
  if (route) return { kind: "route", route };
  if (!surfacePricing) return { kind: "none" };
  // Sondan başa: rotasız ilk asistan mesajında hedef aranır; yoksa bir öncekine geçilir.
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role !== "assistant" || m.route) continue;
    const destination = extractDestination(m.text);
    if (destination) return { kind: "strip", destination, messageText: m.text };
  }
  return { kind: "none" };
}
