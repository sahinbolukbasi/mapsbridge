"use client";
// Harita pini popup içeriği (Increment 1.7, bug 3). Leaflet popup'ına React portal ile çizilir
// (innerHTML yok; metin React ile kaçışlanır). Model lib/trip/pin-popup.ts'ten: alanlar yalnız
// pin kaydı ve yer proxy'si ayrıntısından (I1); boş alan çizilmez (I10). Stil yalnız
// styles/vendor-overrides.css (.planner-popup, G22).
import { useLocale } from "../../lib/locale-context";
import type { PinPopupModel } from "../../lib/trip/pin-popup";
import { DEFAULT_CATEGORY_META } from "../../lib/trip/models";
import { Button, Icon } from "../ui";
import { dayColorIndex } from "./trip-format";

export function PinPopupContent({
  model,
  onDetails,
  onToggleVisited,
  onAddToDay,
  addDay,
}: {
  model: PinPopupModel;
  onDetails: () => void;
  onToggleVisited: () => void;
  /** Yalnız Kaydedilenler'deki (günsüz) yer için. */
  onAddToDay?: () => void;
  addDay: number;
}) {
  const { t } = useLocale();
  const meta = DEFAULT_CATEGORY_META[model.category] ?? DEFAULT_CATEGORY_META.genel;
  return (
    <div className="planner-popup__inner">
      <p className="planner-popup__category">
        <Icon name={model.icon} size={16} />
        <span>{meta.label}</span>
        {model.day !== undefined && (
          <span className="planner-popup__day">
            <span
              className="planner-popup__day-dot trip-day-color"
              data-day={dayColorIndex(model.day)}
              aria-hidden="true"
            />
            {t("planner.days.day", "{n}. Gün").replace("{n}", String(model.day))}
          </span>
        )}
      </p>
      <p className="planner-popup__title">{model.title}</p>
      {model.address && <p className="planner-popup__address">{model.address}</p>}
      {model.noteLine && <p className="planner-popup__note">{model.noteLine}</p>}
      {model.visited && (
        <p className="planner-popup__visited">
          <Icon name="check" size={16} />
          {t("planner.stop.done", "Tamamlandı")}
        </p>
      )}
      <div className="planner-popup__actions">
        <Button size="sm" variant="primary" onClick={onDetails}>
          {t("planner.popup.details", "Ayrıntı")}
        </Button>
        {onAddToDay ? (
          <Button
            size="sm"
            variant="secondary"
            iconStart={<Icon name="plus" size={16} />}
            onClick={onAddToDay}
          >
            {t("planner.place.addToDayN", "{n}. güne ekle").replace("{n}", String(addDay))}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            iconStart={<Icon name="check" size={16} />}
            aria-pressed={model.visited}
            onClick={onToggleVisited}
          >
            {model.visited
              ? t("planner.popup.unvisit", "Gezilmedi say")
              : t("planner.popup.visit", "Gezildi")}
          </Button>
        )}
      </div>
    </div>
  );
}
