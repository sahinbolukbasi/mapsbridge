"use client";
// Emoji seçici (Increment 1.12, bug 7). Emoji burada İÇERİK METNİDİR (R3 istisnası), ikon
// değil: seçilen emoji paylaşım metnine imleç konumunda eklenir. Her düğme aria-label taşır.
import { useLocale } from "../../../lib/locale-context";
import { EMOJIS } from "../emoji";
export { insertAt } from "../emoji";

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const { t } = useLocale();
  return (
    <div className="cm-emoji" role="group" aria-label={t("community.emoji.label", "Emoji ekle")}>
      {EMOJIS.map(([emoji, key]) => (
        <button
          key={key}
          type="button"
          className="cm-emoji__item"
          aria-label={t(`community.emoji.${key}`, key)}
          onClick={() => onPick(emoji)}
        >
          <span aria-hidden="true">{emoji}</span>
        </button>
      ))}
    </div>
  );
}
