"use client";
import { IconButton, Icon, cx, type IconName } from "../ui";
import { useLocale } from "../../lib/locale-context";
import { RatingBadge } from "./rating-badge";
import { dayColorIndex, formatMinutes } from "./trip-format";
import "./trip-ui.css";

/**
 * Durak satırı (design §4.2): numara hapı gün rengiyle (--color-day-N), kategori İKONLA
 * kodlanır; renk tek bilgi taşıyıcı değildir (WCAG 1.4.1). `onMove` verilirse sürüklemenin
 * klavye alternatifi "Yukarı taşı / Aşağı taşı" düğmeleri çıkar (R9).
 */
export function StopRow({
  index,
  day,
  time,
  name,
  category,
  categoryLabel,
  duration,
  rating,
  ratingCount,
  selected = false,
  onMove,
  isFirst = false,
  isLast = false,
}: {
  /** 1'den başlayan gün içi sıra. */
  index: number;
  day: number;
  /** "09:00" gibi hazır saat metni. */
  time?: string;
  name: string;
  category: IconName;
  /** Kategori adı; ikonun erişilebilir adı ve görünür alt metni. */
  categoryLabel?: string;
  /** Dakika. */
  duration?: number;
  /** Yer kaydına bağlı durakta ayrıntı yüklendiyse kaynak puanı (I10; foto satırda çekilmez). */
  rating?: number;
  ratingCount?: number;
  selected?: boolean;
  onMove?: (direction: "up" | "down") => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const { t, locale } = useLocale();
  const num = (n: number) => n.toLocaleString(locale === "en" ? "en-GB" : "tr-TR");
  const stopLabel = t("trip.stop.label", "{n}. durak").replace("{n}", String(index));
  return (
    <div
      className={cx("trip-stop", selected && "trip-stop--selected")}
      aria-current={selected || undefined}
    >
      <span className="trip-stop__num trip-day-color" data-day={dayColorIndex(day)}>
        <span aria-hidden="true">{index}</span>
        <span className="ui-visually-hidden">{stopLabel}</span>
      </span>
      <div className="trip-stop__body">
        <span className="trip-stop__name">{name}</span>
        <span className="trip-stop__meta">
          {time && <span className="trip-stop__time">{time}</span>}
          <span className="trip-stop__category">
            <Icon name={category} size={16} />
            {categoryLabel && <span>{categoryLabel}</span>}
          </span>
          {duration !== undefined && (
            <span className="trip-stop__duration">{formatMinutes(duration, t)}</span>
          )}
          {typeof rating === "number" && (
            <RatingBadge rating={rating} count={ratingCount} format={num} />
          )}
        </span>
      </div>
      {onMove && (
        <div className="trip-stop__move">
          <IconButton
            icon="chevron-up"
            size="sm"
            label={`${t("trip.stop.moveUp", "Yukarı taşı")}: ${name}`}
            disabled={isFirst}
            onClick={() => onMove("up")}
          />
          <IconButton
            icon="chevron"
            size="sm"
            label={`${t("trip.stop.moveDown", "Aşağı taşı")}: ${name}`}
            disabled={isLast}
            onClick={() => onMove("down")}
          />
        </div>
      )}
    </div>
  );
}
