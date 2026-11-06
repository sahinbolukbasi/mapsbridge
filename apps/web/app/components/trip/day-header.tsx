"use client";
import { Badge, Icon } from "../ui";
import { useLocale } from "../../lib/locale-context";
import { formatMeters, formatMinutes } from "./trip-format";
import "./trip-ui.css";

/** I9: her gün en az %20 programsız tampon. */
export const MIN_BUFFER_RATIO = 0.2;

/**
 * Gün başlığı + toplamlar (design §4.2). Tampon rozeti yalnızca `bufferRatio` verilince çizilir
 * (I10); %20'nin altında uyarı tonu ve açıklayıcı metin (I9, renk tek ipucu değil). Çevrimdışı
 * rozeti yalnızca `offline` doğruysa (I10).
 */
export function DayHeader({
  title,
  eyebrow,
  stops,
  meters,
  minutes,
  bufferRatio,
  offline,
  titleAs: Title = "h3",
}: {
  title: string;
  eyebrow?: string;
  stops: number;
  meters?: number;
  minutes?: number;
  bufferRatio?: number;
  offline: boolean;
  /** Sayfanın başlık hiyerarşisine göre; başlık seviyesi atlanmaz. */
  titleAs?: "h2" | "h3" | "p";
}) {
  const { t, locale } = useLocale();
  const stopsText = t(stops === 1 ? "trip.day.stops.one" : "trip.day.stops", "{n} durak").replace(
    "{n}",
    String(stops),
  );
  const pct = bufferRatio === undefined ? null : Math.round(bufferRatio * 100);
  const lowBuffer = bufferRatio !== undefined && bufferRatio < MIN_BUFFER_RATIO;
  return (
    <div className="trip-day">
      {eyebrow && <p className="trip-day__eyebrow">{eyebrow}</p>}
      <Title className="trip-day__title">{title}</Title>
      <div className="trip-day__meta">
        <Badge>
          <Icon name="route" size={16} />
          {meters === undefined ? stopsText : `${stopsText} · ${formatMeters(meters, t, locale)}`}
        </Badge>
        {minutes !== undefined && (
          <Badge>
            <Icon name="clock" size={16} />
            {t("trip.unit.approx", "≈ {value}").replace("{value}", formatMinutes(minutes, t))}
          </Badge>
        )}
        {pct !== null && (
          <Badge tone={lowBuffer ? "warning" : "success"}>
            {(lowBuffer
              ? t("trip.day.bufferLow", "Tampon %{n} · önerilen en az %20")
              : t("trip.day.buffer", "Tampon %{n}")
            ).replace("{n}", String(pct))}
          </Badge>
        )}
        {offline && (
          <Badge>
            <Icon name="offline" size={16} />
            {t("trip.day.offline", "Cihazda kayıtlı")}
          </Badge>
        )}
      </div>
    </div>
  );
}
