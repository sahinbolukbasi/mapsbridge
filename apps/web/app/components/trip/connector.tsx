"use client";
import { Icon, type IconName } from "../ui";
import { useLocale } from "../../lib/locale-context";
import { formatMeters, formatMinutes } from "./trip-format";
import "./trip-ui.css";

export type ConnectorMode = "walk" | "drive" | "transit";

const MODE_ICON: Record<ConnectorMode, IconName> = {
  walk: "walk",
  drive: "drive",
  transit: "transit",
};

/**
 * İki durak arası bağlantı (design §4.2): noktalı çizgi + süre/mesafe. Süre yoksa değer
 * uydurulmaz, "Süre hesaplanamadı" yazılır (I1/I2). Değerler yalnızca rota motorundan gelir.
 */
export function Connector({
  mode,
  minutes,
  meters,
}: {
  mode: ConnectorMode;
  minutes?: number;
  meters?: number;
}) {
  const { t, locale } = useLocale();
  let text: string;
  if (minutes === undefined) {
    text = t("trip.connector.unknown", "Süre hesaplanamadı");
  } else {
    const parts = [formatMinutes(minutes, t)];
    if (meters !== undefined) parts.push(formatMeters(meters, t, locale));
    text = t(`trip.connector.${mode}`, "{value}").replace("{value}", parts.join(" · "));
  }
  return (
    <div className="trip-connector" data-mode={mode}>
      <Icon name={MODE_ICON[mode]} size={16} />
      <span className="trip-connector__text">{text}</span>
    </div>
  );
}
