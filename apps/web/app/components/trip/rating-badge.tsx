"use client";
// Kompakt puan rozeti (FEAT-003 B2): yalnız kaynakta puan varsa çizilir (I1/I10). Puan 0–5
// aralığına kısılır, bir ondalık gösterilir; varsa değerlendirme sayısı eklenir. Renk tek bilgi
// taşıyıcı değildir: erişilebilir metin "4,5 / 5 puan (1.200 değerlendirme)" olarak sunulur.
import { useLocale } from "../../lib/locale-context";

export function RatingBadge({
  rating,
  count,
  format,
}: {
  rating: number;
  count?: number;
  /** Yerele uygun sayı biçimleyici (çağıran dil bağlamını taşır). */
  format: (n: number) => string;
}) {
  const { t } = useLocale();
  if (typeof rating !== "number" || !Number.isFinite(rating) || rating < 0 || rating > 5)
    return null;
  const value = format(Math.round(rating * 10) / 10);
  const hasCount = typeof count === "number" && Number.isFinite(count) && count >= 0;
  const countText = hasCount ? format(Math.round(count)) : "";
  const label = hasCount
    ? t("planner.facts.ratingLabelCount", "{r} / 5 puan ({n} değerlendirme)")
        .replace("{r}", value)
        .replace("{n}", countText)
    : t("planner.facts.ratingLabel", "{r} / 5 puan").replace("{r}", value);
  return (
    <span className="planner-rating-badge" aria-label={label}>
      <span aria-hidden="true">
        {value}
        {hasCount && ` (${countText})`}
      </span>
    </span>
  );
}
