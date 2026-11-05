"use client";
import { Fragment } from "react";
import { Badge } from "../ui";
import { useLocale } from "../../lib/locale-context";
import { Connector } from "./connector";
import { DayHeader } from "./day-header";
import { StopRow } from "./stop-row";
import "./trip-ui.css";

/**
 * Ana sayfa ürün kanıtı (design F41): planlayıcının gün paneli + statik SVG harita. Veriler
 * AÇIKÇA örnektir ("Örnek görünüm" rozeti); Leaflet yüklenmez, ağ isteği yoktur. Rota çizimi ve
 * pin'ler yalnızca hareket tercihinde canlanır (trip-ui.css), varsayılan statik ve tam çizili.
 */
const SAMPLE_STOPS = [
  {
    nameKey: "home.sample.stop1",
    time: "09:00",
    category: "landmark",
    categoryKey: "home.sample.category.landmark",
    duration: 120,
  },
  {
    nameKey: "home.sample.stop2",
    time: "11:20",
    category: "landmark",
    categoryKey: "home.sample.category.landmark",
    duration: 90,
  },
  {
    nameKey: "home.sample.stop3",
    time: "13:15",
    category: "food",
    categoryKey: "home.sample.category.food",
    duration: 60,
  },
] as const;
const SAMPLE_LEGS = [
  { minutes: 8, meters: 600 },
  { minutes: 12, meters: 900 },
] as const;
// Statik illüstrasyon koordinatları (viewBox birimleri); gerçek konum iddiası taşımaz.
const PINS: ReadonlyArray<readonly [number, number]> = [
  [300, 400],
  [372, 318],
  [470, 344],
];
const ROUTE_D = `M${PINS.map((p) => p.join(" ")).join(" L")}`;
const ROADS = [
  "M-40 470 C 160 430 320 470 520 420 S 760 360 840 380",
  "M200 -20 C 230 140 260 300 250 620",
  "M-40 180 C 180 210 420 160 840 210",
  "M560 -20 C 540 160 600 320 580 620",
  "M90 620 C 260 520 420 520 620 600",
];
const MINOR = [
  ...Array.from({ length: 9 }, (_, i) => `M-40 ${60 + i * 66} L840 ${40 + i * 70}`),
  ...Array.from({ length: 12 }, (_, i) => `M${30 + i * 76} -20 L${60 + i * 72} 620`),
];

export function SampleRoutePreview() {
  const { t } = useLocale();
  const totalMinutes =
    SAMPLE_STOPS.reduce((sum, s) => sum + s.duration, 0) +
    SAMPLE_LEGS.reduce((sum, l) => sum + l.minutes, 0);
  const totalMeters = SAMPLE_LEGS.reduce((sum, l) => sum + l.meters, 0);
  return (
    <figure className="trip-sample">
      <div className="trip-sample__frame">
        <div className="trip-sample__panel">
          <DayHeader
            eyebrow={t("home.sample.eyebrow")}
            title={t("home.sample.dayTitle")}
            titleAs="p"
            stops={SAMPLE_STOPS.length}
            meters={totalMeters}
            minutes={totalMinutes}
            offline={false}
          />
          <ol className="trip-stops">
            {SAMPLE_STOPS.map((stop, i) => (
              <li key={stop.nameKey} className="trip-stops__item">
                {i > 0 && <Connector mode="walk" {...SAMPLE_LEGS[i - 1]} />}
                <StopRow
                  index={i + 1}
                  day={1}
                  time={stop.time}
                  name={t(stop.nameKey)}
                  category={stop.category}
                  categoryLabel={t(stop.categoryKey)}
                  duration={stop.duration}
                  selected={i === 1}
                />
              </li>
            ))}
          </ol>
        </div>
        <div className="trip-sample__map">
          <svg
            className="trip-sample__svg"
            viewBox="100 170 560 360"
            preserveAspectRatio="xMidYMid slice"
            role="img"
            aria-label={t("home.sample.mapLabel")}
          >
            <rect className="trip-map__land" x="-40" y="-20" width="880" height="640" />
            {MINOR.map((d) => (
              <path key={d} className="trip-map__minor" d={d} strokeWidth="3" fill="none" />
            ))}
            <path
              className="trip-map__park"
              d="M640 420 c60 -20 140 0 150 60 c10 60 -60 110 -140 90 c-70 -18 -80 -130 -10 -150Z"
            />
            <path
              className="trip-map__park"
              d="M90 90 h150 a20 20 0 0 1 20 20 v70 a20 20 0 0 1 -20 20 h-150 a20 20 0 0 1 -20 -20 v-70 a20 20 0 0 1 20 -20Z"
            />
            <path
              className="trip-map__water"
              d="M110 -20 C 170 120 80 230 150 340 S 250 520 190 640"
              strokeWidth="40"
              fill="none"
              strokeLinecap="round"
            />
            {ROADS.map((d) => (
              <Fragment key={d}>
                <path
                  className="trip-map__road-case"
                  d={d}
                  strokeWidth="14"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  className="trip-map__road"
                  d={d}
                  strokeWidth="9"
                  fill="none"
                  strokeLinecap="round"
                />
              </Fragment>
            ))}
            <path
              className="trip-map__route-casing"
              d={ROUTE_D}
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              className="trip-map__route trip-day-color"
              data-day="1"
              d={ROUTE_D}
              pathLength={1}
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {PINS.map(([x, y], i) => {
              const selected = i === 1;
              return (
                <g key={`${x}-${y}`} className="trip-map__pin" aria-hidden="true">
                  {selected && (
                    <circle
                      className="trip-map__pin-halo trip-day-color"
                      data-day="1"
                      cx={x}
                      cy={y}
                      r="30"
                    />
                  )}
                  <circle
                    className="trip-map__pin-dot trip-day-color"
                    data-day="1"
                    cx={x}
                    cy={y}
                    r={selected ? 19 : 15}
                    strokeWidth="3"
                  />
                  <text
                    className="trip-map__pin-num"
                    x={x}
                    y={y + 5}
                    textAnchor="middle"
                    fontSize={selected ? 15 : 13}
                  >
                    {i + 1}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      <figcaption className="trip-sample__note">
        <Badge tone="example">{t("home.hero.productNote")}</Badge>
      </figcaption>
    </figure>
  );
}
