import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Accordion,
  Button,
  Card,
  Chip,
  ChipGroup,
  EmptyState,
  Notice,
  SegmentedControl,
  Skeleton,
  Txt,
} from "../ui";
import { tr, type UiKey } from "../i18n/ui";
import { tokens } from "../theme";
import {
  PIN_CATEGORY_OF,
  centroid,
  rankCandidates,
  type DiscoveryCandidate,
  type RankedCandidate,
  type Reason,
} from "../trip/discovery-rank";
import type { Pin } from "../trip/models";
import {
  PLACE_CATEGORY_IDS,
  PlacesApiError,
  placesApi,
  type PlaceCategoryId,
  type PlaceProvider,
} from "../trip/places-api";
// Keşfet (web components/trip/discover-panel.tsx karşılığı, Increment 4.4). Kategori çipleri +
// kapsam ("Bu güne yakın" / "Haritadaki alan") → yer proxy'si nearby (S1, gerçek veri, LLM yok) →
// discovery-rank (S2, deterministik, web ile birebir). "Neden önerildi?" yalnız skor
// bileşenlerinden üretilir. Kaynakta olmayan alan çizilmez (I1, I10). Para kazanma alanı
// sıralamaya girmez (I8). Sonuçlar haritada ayrı stille (havuz pinleri) gösterilir.
const RADIUS = { day: 1500, map: 3000 } as const;
type Scope = "day" | "map";
export type DiscoverAdd = {
  label: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string;
  provider: PlaceProvider;
  category: Pin["category"];
};
export interface DiscoverPanelProps {
  dayPins: readonly Pin[];
  allPins: readonly Pin[];
  addDay: number;
  mapCenter: { lat: number; lng: number } | null;
  onAdd: (place: DiscoverAdd, target: "trip" | "pool") => void;
  onFocus: (lat: number, lng: number, label: string) => void;
  /** Sonuçlar değişince haritadaki havuz pinleri için (sıralı, eklenebilir biçimde). */
  onResults?: (places: DiscoverAdd[]) => void;
}
const num = (n: number) => String(n).replace(".", ",");
function distance(m: number): string {
  return m >= 1000
    ? tr("discover.km", { n: num(Math.round(m / 100) / 10) })
    : tr("discover.m", { n: num(Math.round(m / 10) * 10) });
}
function addOf(r: RankedCandidate): DiscoverAdd {
  return {
    label: r.place.name,
    address: r.place.address ?? "",
    lat: r.place.lat,
    lng: r.place.lng,
    placeId: r.place.id,
    provider: r.place.provider,
    category: r.category ? PIN_CATEGORY_OF[r.category] : "genel",
  };
}
export function reasonText(r: Reason, scope: Scope): string {
  switch (r.key) {
    case "interest":
      return tr("discover.reason.interest", { c: tr(`discover.cat.${r.category}` as UiKey) });
    case "distance":
      return tr(scope === "day" ? "discover.reason.distanceDay" : "discover.reason.distanceMap", {
        d: distance(r.meters),
      });
    case "rating":
      return r.count !== undefined
        ? tr("discover.reason.ratingCount", { r: num(r.rating), n: r.count })
        : tr("discover.reason.rating", { r: num(r.rating) });
    case "alreadyPlanned":
      return tr("discover.reason.already");
    case "sameCategory":
      return tr("discover.reason.sameCategory", { n: r.count });
  }
}
export function DiscoverPanel({
  dayPins,
  allPins,
  addDay,
  mapCenter,
  onAdd,
  onFocus,
  onResults,
}: DiscoverPanelProps) {
  const [interests, setInterests] = useState<PlaceCategoryId[]>(["museum"]);
  const dayCenter = useMemo(() => centroid(dayPins), [dayPins]);
  const [scope, setScope] = useState<Scope>(dayCenter ? "day" : "map");
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error" | "limited">("idle");
  const [ranked, setRanked] = useState<RankedCandidate[]>([]);
  const request = useRef(0);
  useEffect(() => {
    if (!dayCenter && scope === "day") setScope("map");
  }, [dayCenter, scope]);
  const run = async () => {
    const anchor = scope === "day" ? dayCenter : (mapCenter ?? centroid(allPins));
    if (!anchor || interests.length === 0) {
      setRanked([]);
      setState("idle");
      return;
    }
    const id = ++request.current;
    setState("loading");
    const settled = await Promise.allSettled(
      interests.map((category) =>
        placesApi
          .nearby(anchor.lat, anchor.lng, { category, radius: RADIUS[scope], lang: "tr" })
          .then(({ places }) =>
            places.map((p): DiscoveryCandidate => ({ ...p, queriedCategory: category })),
          ),
      ),
    );
    if (id !== request.current) return;
    const ok = settled.filter(
      (s): s is PromiseFulfilledResult<DiscoveryCandidate[]> => s.status === "fulfilled",
    );
    if (ok.length === 0) {
      const limited = settled.some(
        (s) =>
          s.status === "rejected" &&
          s.reason instanceof PlacesApiError &&
          s.reason.kind === "limited",
      );
      setRanked([]);
      setState(limited ? "limited" : "error");
      return;
    }
    const toExisting = (p: Pin) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      category: p.category,
      placeId: p.placeId,
      googlePlaceId: p.googlePlaceId,
    });
    setRanked(
      rankCandidates(
        ok.flatMap((s) => s.value),
        {
          interests,
          anchor,
          existingPins: allPins.map(toExisting),
          dayPins: dayPins.map(toExisting),
        },
      ).slice(0, 12),
    );
    setState("ok");
  };
  useEffect(() => {
    void run();
    // Kapsam ya da ilgi değişince yeniden sorgulanır; pin değişimi yalnız "yeniden tara" ile.
  }, [scope, interests.join(","), dayCenter?.lat, dayCenter?.lng]);
  useEffect(() => {
    onResults?.(state === "ok" ? ranked.map(addOf) : []);
  }, [state, ranked]);
  useEffect(() => () => onResults?.([]), []);
  const toggle = (c: PlaceCategoryId) =>
    setInterests((list) =>
      list.includes(c) ? list.filter((x) => x !== c) : list.length >= 3 ? list : [...list, c],
    );

  return (
    <View style={styles.root}>
      <ChipGroup label={tr("discover.interests")} mode="multi" max={3}>
        {PLACE_CATEGORY_IDS.map((c) => (
          <Chip key={c} pressed={interests.includes(c)} onPress={() => toggle(c)}>
            {tr(`discover.cat.${c}` as UiKey)}
          </Chip>
        ))}
      </ChipGroup>
      {dayCenter ? (
        <SegmentedControl
          label={tr("discover.scope")}
          options={[
            { value: "day", label: tr("discover.scope.day") },
            { value: "map", label: tr("discover.scope.map") },
          ]}
          value={scope}
          onChange={setScope}
        />
      ) : (
        <Txt variant="caption" tone="muted">
          {tr("discover.mapOnly")}
        </Txt>
      )}
      {state === "loading" ? (
        <View accessibilityLabel={tr("discover.loading")} accessible>
          <Skeleton variant="list-row" count={3} />
        </View>
      ) : null}
      {interests.length === 0 ? <Notice tone="info">{tr("discover.pickInterest")}</Notice> : null}
      {state === "error" ? (
        <Notice
          tone="danger"
          title={tr("discover.error.title")}
          action={{ label: tr("ui.retry"), onPress: () => void run() }}
        >
          {tr("discover.error.body")}
        </Notice>
      ) : null}
      {state === "limited" ? <Notice tone="warning">{tr("discover.limited")}</Notice> : null}
      {state === "ok" && ranked.length === 0 ? (
        <EmptyState
          icon="search"
          contour
          title={tr("discover.empty")}
          description={tr("discover.emptyHint")}
        />
      ) : null}
      {state === "ok" && ranked.length > 0 ? (
        <View style={styles.list} accessibilityLabel={tr("discover.results")}>
          <Txt variant="heading" header>
            {tr("discover.results")}
          </Txt>
          {ranked.map((r) => (
            <Card
              key={`${r.place.provider}:${r.place.id}`}
              variant="bordered"
              onPress={() => onFocus(r.place.lat, r.place.lng, r.place.name)}
              label={r.place.name}
            >
              <View style={styles.item}>
                <Txt variant="label">{r.place.name}</Txt>
                {r.place.address ? (
                  <Txt variant="caption" tone="muted">
                    {r.place.address}
                  </Txt>
                ) : null}
                <Accordion
                  items={[
                    {
                      id: "why",
                      summary: tr("discover.why"),
                      content: (
                        <View style={styles.reasons}>
                          {r.reasons.map((reason, i) => (
                            <Txt key={i} variant="caption" tone="muted">
                              {reasonText(reason, scope)}
                            </Txt>
                          ))}
                        </View>
                      ),
                    },
                  ]}
                />
                <View style={styles.actions}>
                  <Button
                    size="sm"
                    label={tr("planner.place.addToDayN", { n: addDay })}
                    onPress={() => onAdd(addOf(r), "trip")}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    label={tr("discover.save")}
                    onPress={() => onAdd(addOf(r), "pool")}
                  />
                </View>
                <Txt variant="caption" tone="subtle">
                  {tr("planner.facts.source", { name: r.place.attribution })}
                </Txt>
              </View>
            </Card>
          ))}
          <Button variant="ghost" label={tr("discover.refresh")} onPress={() => void run()} />
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { gap: tokens.space["3"] },
  list: { gap: tokens.space["2"] },
  item: { gap: tokens.space["1"] },
  reasons: { gap: tokens.space["1"] },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space["2"] },
});
