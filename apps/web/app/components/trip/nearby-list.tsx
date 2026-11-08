"use client";
// "Yakında ne var" listesi (FEAT-002, U1/U2). Verilen koordinata yer proxy'sinden nearby ister
// (S1 — gerçek veri, LLM yok, misafire açık/kotalı), mapNearby ile mesafe artan sıralar (I2) ve
// her öğeyi kategori ikonu + mesafe ile çizer. Kaynakta olmayan alan çizilmez (I1/I10); sıralama
// yalnız mesafeye göredir, affiliate etkisi yoktur (I8). Durumlar discover-panel ile aynı desen:
// yükleniyor (Skeleton), boş (EmptyState), hata+tekrar (ErrorState), sınır/429 (limited).
import { useEffect, useRef, useState } from "react";
import { useLocale } from "../../lib/locale-context";
import { PlacesApiError, placesApi, type PlaceCategoryId } from "../../lib/trip/places-api";
import { mapNearby, type NearbyItem } from "../../lib/trip/nearby";
import { detectCategoryFromText } from "../../lib/trip/geocoding-service";
import { CATEGORY_ICON } from "../../lib/trip/pin-popup";
import type { AddTarget } from "../../lib/trip/planner-logic";
import { defaultAddTargetValue, parseAddTarget, ADD_TARGET_GENERAL } from "../../lib/trip/planner-logic";
import type { PinCategory } from "../../lib/trip/models";
import { Button, EmptyState, ErrorState, Icon, Select, Skeleton } from "../ui";

/** NearbyList'in ekleme çağrısına verdiği yer (sidebar addPlace Place biçimiyle uyumlu). */
export type NearbyAddPlace = {
  label: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string;
  provider: "amazon" | "google";
  category: PinCategory;
};

type State = "loading" | "ok" | "empty" | "error" | "limited";

export function NearbyList({
  lat,
  lng,
  category,
  radius,
  days,
  activeDayIndex,
  onAdd,
  onFocus,
}: {
  lat: number;
  lng: number;
  /** İsteğe bağlı kategori süzgeci (yoksa genel yakın yerler). */
  category?: PlaceCategoryId;
  radius?: number;
  /** Ekleme anı gün seçimi (FEAT-001): gezinin gün numaraları. */
  days: number[];
  activeDayIndex: number | null | undefined;
  onAdd: (place: NearbyAddPlace, target: AddTarget) => void;
  onFocus?: (lat: number, lng: number, label: string) => void;
}) {
  const { t, locale } = useLocale();
  const lang = locale === "en" ? "en" : "tr";
  const [state, setState] = useState<State>("loading");
  const [items, setItems] = useState<NearbyItem[]>([]);
  const request = useRef(0);
  // Koordinata göre önbellek: aynı nokta/pin için tek sağlayıcı çağrısı (kota dostu).
  const key = `${lat.toFixed(5)},${lng.toFixed(5)},${category ?? ""},${radius ?? ""}`;

  const run = async () => {
    const id = ++request.current;
    setState("loading");
    try {
      const res = await placesApi.nearby(lat, lng, { category, radius, lang });
      if (id !== request.current) return;
      const mapped = mapNearby(res, { lat, lng });
      setItems(mapped);
      setState(mapped.length > 0 ? "ok" : "empty");
    } catch (err) {
      if (id !== request.current) return;
      setItems([]);
      setState(err instanceof PlacesApiError && err.kind === "limited" ? "limited" : "error");
    }
  };

  useEffect(() => {
    // Yalnız nokta/süzgeç (key) değişince yeniden sorgula (bir nokta = bir sağlayıcı çağrısı).
    void run();
  }, [key]);

  const num = (n: number) => n.toLocaleString(lang === "en" ? "en-GB" : "tr-TR");
  const distance = (m: number) =>
    m >= 1000
      ? t("discover.km", "{n} km").replace("{n}", num(Math.round(m / 100) / 10))
      : t("discover.m", "{n} m").replace("{n}", num(Math.round(m / 10) * 10));

  return (
    <section className="planner-nearby" aria-labelledby="planner-nearby-title">
      <h4 id="planner-nearby-title" className="planner-detail__title">
        {t("nearby.title", "Yakında ne var")}
      </h4>
      <div role="status" className="planner-discover__status">
        {state === "loading" && (
          <span className="ui-visually-hidden">{t("nearby.loading", "Yakın yerler aranıyor…")}</span>
        )}
      </div>
      {state === "loading" ? (
        <ul className="planner-discover__list" aria-hidden="true">
          {[0, 1, 2].map((n) => (
            <li key={n} className="planner-discover__card">
              <Skeleton variant="list-row" />
            </li>
          ))}
        </ul>
      ) : state === "error" ? (
        <ErrorState
          compact
          error={{
            kind: "network",
            title: t("nearby.error.title", "Yakın yerler şu an yüklenemedi."),
            message: t("nearby.error.body", "Biraz sonra tekrar dene; rotan etkilenmez."),
            retryable: true,
          }}
          onRetry={() => void run()}
        />
      ) : state === "limited" ? (
        <p className="planner-discover__hint" role="status">
          {t("nearby.limited", "Bugünkü arama sınırına ulaşıldı. Yarın tekrar dene.")}
        </p>
      ) : state === "empty" ? (
        <EmptyState
          icon="search"
          level={4}
          title={t("nearby.empty", "Bu noktanın yakınında kayıtlı yer yok.")}
        />
      ) : (
        <ol className="planner-discover__list" aria-label={t("nearby.results", "Yakındaki yerler")}>
          {items.map((item) => (
            <NearbyRow
              key={`${item.provider}:${item.id}`}
              item={item}
              days={days}
              activeDayIndex={activeDayIndex}
              distanceLabel={distance(item.distanceMeters)}
              onFocus={onFocus}
              onAdd={onAdd}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function NearbyRow({
  item,
  days,
  activeDayIndex,
  distanceLabel,
  onFocus,
  onAdd,
}: {
  item: NearbyItem;
  days: number[];
  activeDayIndex: number | null | undefined;
  distanceLabel: string;
  onFocus?: (lat: number, lng: number, label: string) => void;
  onAdd: (place: NearbyAddPlace, target: AddTarget) => void;
}) {
  const { t } = useLocale();
  const [target, setTarget] = useState(() => defaultAddTargetValue(activeDayIndex, days));
  const pinCategory = detectCategoryFromText(`${item.name} ${item.category ?? ""}`);
  const place: NearbyAddPlace = {
    label: item.name,
    address: item.address ?? "",
    lat: item.lat,
    lng: item.lng,
    placeId: item.id,
    provider: item.provider,
    category: pinCategory,
  };
  return (
    <li className="planner-discover__card" data-surface="default">
      <button
        type="button"
        className="planner-discover__name"
        onClick={() => onFocus?.(item.lat, item.lng, item.name)}
      >
        <Icon name={CATEGORY_ICON[pinCategory] ?? "map"} size={16} />
        <span>{item.name}</span>
      </button>
      <p className="planner-discover__meta">
        {[item.category, distanceLabel].filter(Boolean).join(" · ")}
      </p>
      {item.address && <p className="planner-discover__address">{item.address}</p>}
      <div className="planner-discover__actions">
        <Select
          aria-label={t("planner.place.targetLabel", "Nereye eklensin")}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          {days.map((d) => (
            <option key={d} value={d}>
              {t("planner.days.day", "{n}. Gün").replace("{n}", String(d))}
            </option>
          ))}
          <option value={ADD_TARGET_GENERAL}>{t("planner.detail.inPool", "Kayıtlı yerler")}</option>
        </Select>
        <Button
          size="sm"
          variant="primary"
          iconStart={<Icon name="plus" size={16} />}
          onClick={() => onAdd(place, parseAddTarget(target, days))}
        >
          {t("planner.place.add", "Ekle")}
        </Button>
      </div>
    </li>
  );
}
