// Emoji seçicinin içerik verisi (Increment 1.12, bug 7). Emoji burada paylaşım METNİDİR (R3:
// içerik metni serbest), ikon değildir; bu yüzden veri .ts modülünde, UI yalnız Icon kullanır.
/** [emoji, i18n anahtarı soneki] — seyahatle ilgili küçük ve sabit bir küme. */
export const EMOJIS: readonly (readonly [string, string])[] = [
  ["😍", "love"],
  ["😂", "laugh"],
  ["🤩", "wow"],
  ["😋", "yum"],
  ["🙏", "thanks"],
  ["👍", "like"],
  ["❤️", "heart"],
  ["🔥", "fire"],
  ["✈️", "plane"],
  ["🗺️", "map"],
  ["🏖️", "beach"],
  ["⛰️", "mountain"],
  ["🌅", "sunset"],
  ["📸", "camera"],
  ["☕", "coffee"],
  ["🍽️", "food"],
];

/** Metne imleç konumunda ekler; yeni metin ve yeni imleç konumu döner. */
export function insertAt(
  text: string,
  insert: string,
  start: number | null | undefined,
  end?: number | null,
): { text: string; caret: number } {
  const s = Math.max(0, Math.min(text.length, start ?? text.length));
  const e = Math.max(s, Math.min(text.length, end ?? s));
  return { text: text.slice(0, s) + insert + text.slice(e), caret: s + insert.length };
}
