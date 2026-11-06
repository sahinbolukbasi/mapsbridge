"use client";
// Keşfet (Increment 1.8, bug 5). Kategori çipleri + kapsam ("Bu güne yakın" / "Haritadaki alan")
// → yer proxy'si nearby (S1, gerçek veri) → discovery-rank (S2, deterministik). "Neden
// önerildi" yalnız skor bileşenlerinden üretilir, LLM yok. Kaynakta olmayan alan çizilmez (I1).
// Para kazanma alanı sıralamaya girmez (I8). Havuz pinleri haritada ayrı stille çizilir
// (maps-client, `mapsbridge:discovery-pool` olayı).
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "../../lib/locale-context";
import {
  PIN_CATEGORY_OF,
  centroid,
  rankCandidates,
  type DiscoveryCandidate,
  type RankedCandidate,
  type Reason,
} from "../../lib/trip/discovery-rank";
import type { Pin } from "../../lib/trip/models";
import {
  PLACE_CATEGORY_IDS,
  PlacesApiError,
  placesApi,
  type PlaceCategoryId,
} from "../../lib/trip/places-api";
import type { IconName } from "../../lib/icon-paths";
import {
  Accordion,
  Button,
  Chip,
  ChipGroup,
  EmptyState,
  ErrorState,
  GoogleLogo,
  Icon,
  SegmentedControl,
  Skeleton,
} from "../ui";

export const DISCOVERY_POOL_EVENT = "mapsbridge:discovery-pool";
export type DiscoveryPoolDetail = {
  places: { id: string; name: string; lat: number; lng: number }[];
};

const CATEGORY_ICON: Record<PlaceCategoryId, IconName> = {
  museum: "landmark",
  food: "food",
  cafe: "food",
  park: "compass",
  viewpoint: "camera",
  shopping: "bag",
  nightlife: "sparkle",
};
const RADIUS = { day: 1500, map: 3000 } as const;
type Scope = "day" | "map";

export function DiscoverPanel({
  dayPins,
  allPins,
  activeDay,
  mapCenter,
  onAdd,
  onFocus,
}: {
  dayPins: readonly Pin[];
  allPins: readonly Pin[];
  /** Aktif gün (Tümü görünümünde yok). */
  activeDay?: number;
  mapCenter?: () => { lat: number; lng: number } | null;
  onAdd: (
    place: {
      label: string;
      address: string;
      lat: number;
      lng: number;
      placeId: string;
      provider: "amazon" | "google";
      category: Pin["category"];
    },
    target: "trip" | "general",
  ) => void;
  onFocus?: (lat: number, lng: number, label: string) => void;
}) {
  const { t, locale } = useLocale();
  const lang = locale === "en" ? "en" : "tr";
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
    const anchor = scope === "day" ? dayCenter : (mapCenter?.() ?? centroid(allPins));
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
          .nearby(anchor.lat, anchor.lng, { category, radius: RADIUS[scope], lang })
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
    const pool = ok.flatMap((s) => s.value);
    const toExisting = (p: Pin) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      category: p.category,
      placeId: p.placeId,
      googlePlaceId: p.googlePlaceId,
    });
    setRanked(
      rankCandidates(pool, {
        interests,
        anchor,
        existingPins: allPins.map(toExisting),
        dayPins: dayPins.map(toExisting),
      }).slice(0, 12),
    );
    setState("ok");
  };

  useEffect(() => {
    void run();
    // Kapsam ya da ilgi değişince yeniden sorgulanır; pin listesi değişimi yalnız sıralamayı
    // etkiler ve kullanıcı "Yenile" ile tetikler (gereksiz sağlayıcı çağrısı yok).
  }, [scope, interests.join(","), dayCenter?.lat, dayCenter?.lng]);

  // Haritadaki havuz pinleri (ayrı stil). Panel kapanınca temizlenir.
  useEffect(() => {
    const places =
      state === "ok"
        ? ranked.map((r) => ({
            id: r.place.id,
            name: r.place.name,
            lat: r.place.lat,
            lng: r.place.lng,
          }))
        : [];
    window.dispatchEvent(
      new CustomEvent<DiscoveryPoolDetail>(DISCOVERY_POOL_EVENT, { detail: { places } }),
    );
  }, [ranked, state]);
  useEffect(
    () => () => {
      window.dispatchEvent(
        new CustomEvent<DiscoveryPoolDetail>(DISCOVERY_POOL_EVENT, { detail: { places: [] } }),
      );
    },
    [],
  );

  const toggle = (c: PlaceCategoryId) =>
    setInterests((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c].slice(-3)));
  const num = (n: number) => n.toLocaleString(lang === "en" ? "en-GB" : "tr-TR");
  const distance = (m: number) =>
    m >= 1000
      ? t("discover.km", "{n} km").replace("{n}", num(Math.round(m / 100) / 10))
      : t("discover.m", "{n} m").replace("{n}", num(Math.round(m / 10) * 10));
  const reasonText = (r: Reason) => {
    switch (r.key) {
      case "interest":
        return t("discover.reason.interest", "Seçtiğin ilgiyle eşleşiyor: {c}").replace(
          "{c}",
          t(`discover.cat.${r.category}`),
        );
      case "distance":
        return (
          scope === "day"
            ? t("discover.reason.distanceDay", "Bu günün duraklarına {d}")
            : t("discover.reason.distanceMap", "Harita merkezine {d}")
        ).replace("{d}", distance(r.meters));
      case "rating":
        return r.count !== undefined
          ? t("discover.reason.ratingCount", "Kaynakta {r} puan ({n} değerlendirme)")
              .replace("{r}", num(r.rating))
              .replace("{n}", num(r.count))
          : t("discover.reason.rating", "Kaynakta {r} puan").replace("{r}", num(r.rating));
      case "alreadyPlanned":
        return t("discover.reason.already", "Zaten rotanda ya da kayıtlı yerlerinde");
      case "sameCategory":
        return t("discover.reason.sameCategory", "Bu günde aynı türden {n} durak var").replace(
          "{n}",
          String(r.count),
        );
    }
  };

  return (
    <div className="planner-discover">
      <ChipGroup label={t("discover.interests", "Ne arıyorsun?")} mode="multi" max={3}>
        {PLACE_CATEGORY_IDS.map((c) => (
          <Chip
            key={c}
            icon={CATEGORY_ICON[c]}
            pressed={interests.includes(c)}
            onPress={() => toggle(c)}
          >
            {t(`discover.cat.${c}`)}
          </Chip>
        ))}
      </ChipGroup>
      {dayCenter ? (
        <SegmentedControl
          label={t("discover.scope", "Nerede?")}
          value={scope}
          onChange={(v) => setScope(v)}
          options={[
            { value: "day", label: t("discover.scope.day", "Bu güne yakın") },
            { value: "map", label: t("discover.scope.map", "Haritadaki alan") },
          ]}
        />
      ) : (
        <p className="planner-discover__hint">
          {t("discover.mapOnly", "Günde durak olmadığı için haritadaki alanda aranıyor.")}
        </p>
      )}
      {scope === "day" && activeDay === undefined && dayCenter && (
        <p className="planner-discover__hint">
          {t("discover.allDaysHint", "Tüm günlerin duraklarına göre.")}
        </p>
      )}
      <div role="status" className="planner-discover__status">
        {state === "loading" && (
          <span className="ui-visually-hidden">{t("discover.loading", "Yerler aranıyor…")}</span>
        )}
      </div>
      {interests.length === 0 ? (
        <EmptyState
          icon="compass"
          level={4}
          title={t("discover.pickInterest", "En az bir ilgi seç.")}
        />
      ) : state === "loading" ? (
        <ul className="planner-discover__list" aria-hidden="true">
          {[0, 1, 2].map((n) => (
            <li key={n} className="planner-discover__card">
              <Skeleton lines={3} />
            </li>
          ))}
        </ul>
      ) : state === "error" ? (
        <ErrorState
          compact
          error={{
            kind: "network",
            title: t("discover.error.title", "Yer servisi şu an yanıt vermiyor."),
            message: t("discover.error.body", "Biraz sonra tekrar dene; rotan etkilenmez."),
            retryable: true,
          }}
          onRetry={() => void run()}
        />
      ) : state === "limited" ? (
        <p className="planner-discover__hint" role="status">
          {t("discover.limited", "Bugünkü keşif sınırına ulaşıldı. Yarın tekrar dene.")}
        </p>
      ) : state === "ok" && ranked.length === 0 ? (
        <EmptyState
          icon="search"
          level={4}
          title={t("discover.empty", "Bu alanda sonuç yok.")}
          description={t("discover.emptyHint", "Haritayı kaydır ya da başka bir ilgi seç.")}
        />
      ) : (
        <ol
          className="planner-discover__list"
          aria-label={t("discover.results", "Önerilen yerler")}
        >
          {ranked.map((r) => {
            const already = r.reasons.some((x) => x.key === "alreadyPlanned");
            const place = {
              label: r.place.name,
              address: r.place.address || "",
              lat: r.place.lat,
              lng: r.place.lng,
              placeId: r.place.id,
              provider: r.place.provider,
              category: r.category ? PIN_CATEGORY_OF[r.category] : ("genel" as const),
            };
            return (
              <li
                key={`${r.place.provider}:${r.place.id}`}
                className="planner-discover__card"
                data-surface="default"
              >
                <button
                  type="button"
                  className="planner-discover__name"
                  onClick={() => onFocus?.(r.place.lat, r.place.lng, r.place.name)}
                >
                  {r.category && <Icon name={CATEGORY_ICON[r.category]} size={16} />}
                  <span>{r.place.name}</span>
                </button>
                <p className="planner-discover__meta">
                  {[r.place.category, distance(r.distanceMeters)].filter(Boolean).join(" · ")}
                </p>
                {r.place.address && <p className="planner-discover__address">{r.place.address}</p>}
                <Accordion
                  className="planner-discover__why"
                  items={[
                    {
                      id: `why-${r.place.provider}-${r.place.id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40)}`,
                      summary: t("discover.why", "Neden önerildi?"),
                      content: (
                        <ul className="planner-discover__reasons">
                          {r.reasons.map((reason, i) => (
                            <li key={i}>{reasonText(reason)}</li>
                          ))}
                        </ul>
                      ),
                    },
                  ]}
                />
                <div className="planner-discover__actions">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={already}
                    iconStart={<Icon name="plus" size={16} />}
                    onClick={() => onAdd(place, "trip")}
                  >
                    {activeDay
                      ? t("planner.place.addToDayN", "{n}. güne ekle").replace(
                          "{n}",
                          String(activeDay),
                        )
                      : t("planner.place.addToDay", "Güne ekle")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={already}
                    iconStart={<Icon name="bookmark" size={16} />}
                    onClick={() => onAdd(place, "general")}
                  >
                    {t("discover.save", "Kaydedilenlere ekle")}
                  </Button>
                </div>
                <p className="planner-discover__source">
                  {r.place.provider === "google" && <GoogleLogo size={16} />}
                  {t("planner.facts.source", "Kaynak: {name}").replace(
                    "{name}",
                    r.place.attribution,
                  )}
                </p>
              </li>
            );
          })}
        </ol>
      )}
      {state === "ok" && (
        <Button
          size="sm"
          variant="ghost"
          iconStart={<Icon name="refresh" size={16} />}
          onClick={() => void run()}
        >
          {t("discover.refresh", "Bu alanı yeniden tara")}
        </Button>
      )}
    </div>
  );
}
