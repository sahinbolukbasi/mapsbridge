"use client";
// Oturumlu asistan taslak panelinin üstündeki statik mini harita (FEAT-004, B4). Rotanın
// GERÇEK durak koordinatlarından türetilen saf model (mini-map.ts) ile çizilir; Leaflet veya
// ağ YOK (I1/I12 — çevrimdışı da çalışır). Koordinat 2'den azsa hiçbir şey çizmez. Gün renkleri
// (--color-day-*) yalnız components/trip ve maps altında serbesttir (G23); asistan paneli o
// kapsamda olmadığından burada semantik token (--color-primary/--color-border) kullanılır.
import type { UnifiedRoutePlan } from "../lib/ai/types";
import { useLocale } from "../lib/locale-context";
import { fill } from "./studio-format";
import { routeMiniMap } from "./mini-map";

export function MiniRouteMap({ route }: { route: UnifiedRoutePlan }) {
  const { t } = useLocale();
  const model = routeMiniMap(route);
  if (!model) return null;
  const caption = fill(t("studio.map.caption", "{title} · {days} gün · {stops} durak"), {
    title: model.title,
    days: model.dayCount,
    stops: model.stopCount,
  });
  return (
    <figure className="as-studio__minimap">
      <svg
        className="as-studio__minimap-svg"
        viewBox={model.viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={caption}
      >
        <rect className="as-studio__minimap-bg" x="0" y="0" width="320" height="180" rx="12" />
        <path
          className="as-studio__minimap-casing"
          d={model.path}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          className="as-studio__minimap-line"
          d={model.path}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {model.points.map((p, i) => (
          <g key={`${p.x}-${p.y}-${i}`} aria-hidden="true">
            <circle className="as-studio__minimap-dot" cx={p.x} cy={p.y} r="5" />
            <text className="as-studio__minimap-num" x={p.x} y={p.y + 3} textAnchor="middle">
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="as-studio__minimap-caption" data-surface="inverse">
        {caption}
      </figcaption>
    </figure>
  );
}
