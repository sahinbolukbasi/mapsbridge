import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Accordion, Button, Card, EmptyState, Icon, Notice, Skeleton, Txt } from "../ui";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";
import { mapNearby, type NearbyItem } from "../trip/nearby";
import { PlacesApiError, placesApi, type PlaceCategoryId } from "../trip/places-api";
import { categoryIcon } from "../trip/category";
// "Yakında ne var" listesi (FEAT-004, U1 — web components/trip/nearby-list.tsx karşılığı). Verilen
// koordinata yer proxy'sinden nearby ister (S1 — gerçek veri, LLM yok, misafire açık/kotalı),
// mapNearby ile mesafe artan sıralar (I2) ve her öğeyi kategori ikonu + mesafe ile çizer. Kaynakta
// olmayan alan çizilmez (I1/I10); sıra yalnız mesafeye göredir, affiliate etkisi yoktur (I8).
// Durumlar DiscoverPanel ile aynı desen: yükleniyor (Skeleton), boş (EmptyState), hata+tekrar
// (Notice danger + Tekrar dene), sınır/429 (Notice warning). Bir koordinat = bir sağlayıcı çağrısı.
// G4: compact=true ise liste varsayılan kapalı Accordion içinde çizilir (az alan kaplar); açılınca
// aynı içerik görünür. Veri/çağrı mantığı değişmez (placesApi.nearby, parite korunur).
/** NearbyList'in ekleme çağrısına verdiği yer (MapScreen candidate/addPlace biçimiyle uyumlu). */
export type NearbyAddPlace = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string;
  provider: "amazon" | "google";
  category: string;
};
type State = "loading" | "ok" | "empty" | "error" | "limited";
const num = (n: number) => String(n).replace(".", ",");
function distance(m: number): string {
  return m >= 1000
    ? tr("discover.km", { n: num(Math.round(m / 100) / 10) })
    : tr("discover.m", { n: num(Math.round(m / 10) * 10) });
}
export interface NearbyListProps {
  lat: number;
  lng: number;
  /** İsteğe bağlı kategori süzgeci (yoksa genel yakın yerler). */
  category?: PlaceCategoryId;
  radius?: number;
  /** Eklenebilecek gün numarası (çok günlü rotada son gün, tek günde rotanın günü). */
  addDay: number;
  onAdd: (place: NearbyAddPlace, target: "trip" | "pool") => void;
  onFocus?: (lat: number, lng: number, label: string) => void;
  /** G4: varsayılan kapalı Accordion içinde çiz (az alan). */
  compact?: boolean;
}
export function NearbyList({
  lat,
  lng,
  category,
  radius,
  addDay,
  onAdd,
  onFocus,
  compact = false,
}: NearbyListProps) {
  const [state, setState] = useState<State>("loading");
  const [items, setItems] = useState<NearbyItem[]>([]);
  const request = useRef(0);
  // Koordinata göre tek sağlayıcı çağrısı (kota dostu): nokta/süzgeç değişince yeniden sorgu.
  const key = `${lat.toFixed(5)},${lng.toFixed(5)},${category ?? ""},${radius ?? ""}`;
  const run = async () => {
    const id = ++request.current;
    setState("loading");
    try {
      const res = await placesApi.nearby(lat, lng, { category, radius, lang: "tr" });
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
    void run();
  }, [key]);

  const body = (
    <>
      {state === "loading" ? (
        <View accessible accessibilityLabel={tr("nearby.loading")}>
          <Skeleton variant="list-row" count={compact ? 2 : 3} />
        </View>
      ) : null}
      {state === "error" ? (
        <Notice
          tone="danger"
          title={tr("nearby.error.title")}
          action={{ label: tr("ui.retry"), onPress: () => void run() }}
        >
          {tr("nearby.error.body")}
        </Notice>
      ) : null}
      {state === "limited" ? <Notice tone="warning">{tr("nearby.limited")}</Notice> : null}
      {state === "empty" ? (
        <EmptyState icon="search" contour title={tr("nearby.empty")} />
      ) : null}
      {state === "ok" ? (
        <View style={styles.list} accessibilityLabel={tr("nearby.results")}>
          {items.map((item) => (
            <Card
              key={`${item.provider}:${item.id}`}
              variant="bordered"
              label={item.name}
              onPress={() => onFocus?.(item.lat, item.lng, item.name)}
            >
              <View style={styles.item}>
                <View style={styles.nameRow}>
                  <Icon name={categoryIcon(`${item.name} ${item.category ?? ""}`)} size={16} />
                  <Txt variant="label">{item.name}</Txt>
                </View>
                <Txt variant="caption" tone="muted">
                  {[item.category, distance(item.distanceMeters)].filter(Boolean).join(" · ")}
                </Txt>
                {item.address ? (
                  <Txt variant="caption" tone="muted">
                    {item.address}
                  </Txt>
                ) : null}
                <View style={styles.actions}>
                  <Button
                    size="sm"
                    label={tr("planner.place.addToDayN", { n: addDay })}
                    onPress={() =>
                      onAdd(
                        {
                          name: item.name,
                          address: item.address ?? "",
                          lat: item.lat,
                          lng: item.lng,
                          placeId: item.id,
                          provider: item.provider,
                          category: item.category ?? "",
                        },
                        "trip",
                      )
                    }
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    label={tr("discover.save")}
                    onPress={() =>
                      onAdd(
                        {
                          name: item.name,
                          address: item.address ?? "",
                          lat: item.lat,
                          lng: item.lng,
                          placeId: item.id,
                          provider: item.provider,
                          category: item.category ?? "",
                        },
                        "pool",
                      )
                    }
                  />
                </View>
                <Txt variant="caption" tone="subtle">
                  {tr("planner.facts.source", { name: item.attribution })}
                </Txt>
              </View>
            </Card>
          ))}
        </View>
      ) : null}
    </>
  );

  // G4: kompakt — başlık + içerik varsayılan kapalı Accordion'da (az alan).
  if (compact) {
    const count = state === "ok" ? items.length : 0;
    return (
      <View accessibilityLabel={tr("nearby.title")}>
        <Accordion
          items={[
            {
              id: "nearby",
              summary: count
                ? `${tr("nearby.title")} (${count})`
                : tr("nearby.title"),
              content: <View style={styles.root}>{body}</View>,
            },
          ]}
        />
      </View>
    );
  }

  return (
    <View style={styles.root} accessibilityLabel={tr("nearby.title")}>
      <Txt variant="label">{tr("nearby.title")}</Txt>
      {body}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { gap: tokens.space["2"] },
  list: { gap: tokens.space["2"] },
  item: { gap: tokens.space["1"] },
  nameRow: { flexDirection: "row", alignItems: "center", gap: tokens.space["2"] },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space["2"] },
});
