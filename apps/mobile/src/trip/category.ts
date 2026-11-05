// Durak kategorisi → ikon (design §4.4, R4: kategori ikonla kodlanır, renk tek bilgi taşıyıcı
// değil). Kategori serbest metindir (sunucu / Google Places / kullanıcı); bilinmeyen kategori
// genel harita ikonunu alır. Saf modül.
import type { IconName } from "../theme/icon-paths";

const RULES: ReadonlyArray<[RegExp, IconName]> = [
  [/yeme|yemek|food|restoran|restaurant|kahve|cafe|kafe|lezzet|gastro|bar/i, "food"],
  [/müze|muze|museum|tarih|histor|landmark|anıt|anit|cami|kilise|church|saray|kale/i, "landmark"],
  [/manzara|view|seyir|panorama/i, "eye"],
  [/alışveriş|alisveris|çarşı|carsi|pazar|market|shop/i, "bag"],
];

export function categoryIcon(category: string | undefined): IconName {
  const text = category ?? "";
  for (const [re, icon] of RULES) if (re.test(text)) return icon;
  return "map";
}
