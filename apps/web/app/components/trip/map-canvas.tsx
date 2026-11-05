"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ErrorState, IconButton } from "../ui";
import { useLocale } from "../../lib/locale-context";
import { useReducedMotion } from "../../lib/a11y/use-reduced-motion";
import { ensureLeafletCss, ensureLeafletScript } from "../../lib/leaflet-loader";
import "./map-canvas.css";

/* ── Leaflet tip taslakları (betik dinamik <script> ile yüklenir; yalnız bu dosya yükler) ── */
export interface LeafletLatLng {
  lat: number;
  lng: number;
}
export interface LeafletPoint {
  x: number;
  y: number;
  add(offset: [number, number]): LeafletPoint;
}
export interface LeafletBounds {
  pad(ratio: number): LeafletBounds;
}
export interface LeafletLayer {
  addTo(target: LeafletMap | LeafletFeatureGroup): this;
  on(event: string, callback: (...args: unknown[]) => void): this;
  bringToBack?(): void;
  getElement?(): Element | undefined;
}
export interface LeafletFeatureGroup extends LeafletLayer {
  getBounds(): LeafletBounds;
}
export interface LeafletMarker extends LeafletLayer {
  setLatLng(latlng: [number, number]): this;
  getLatLng(): LeafletLatLng;
}
export interface LeafletMouseEvent {
  latlng: LeafletLatLng;
}
export interface LeafletMap {
  flyTo(latlng: [number, number] | LeafletLatLng, zoom: number, options?: object): this;
  setView(latlng: [number, number] | LeafletLatLng, zoom: number, options?: object): this;
  zoomIn(): this;
  zoomOut(): this;
  getZoom(): number;
  getSize(): LeafletPoint;
  project(latlng: [number, number], zoom: number): LeafletPoint;
  unproject(point: LeafletPoint, zoom: number): LeafletLatLng;
  invalidateSize(options?: object): this;
  fitBounds(bounds: LeafletBounds, options?: object): this;
  removeLayer(layer: LeafletLayer): this;
  remove(): this;
  whenReady(callback: () => void): this;
  on(event: string, callback: (e: LeafletMouseEvent) => void): this;
  attributionControl?: { setPrefix(prefix: string | false): unknown };
}
export interface LeafletNamespace {
  map(container: HTMLElement, options?: object): LeafletMap;
  marker(latlng: [number, number], options?: object): LeafletMarker;
  divIcon(options: object): unknown;
  tileLayer(url: string, options?: object): LeafletLayer;
  featureGroup(): LeafletFeatureGroup;
  polyline(latlngs: [number, number][], options?: object): LeafletLayer;
}
type WindowWithLeaflet = Window & { L?: LeafletNamespace };

/**
 * Harita katmanları (design §4.4): bugünkü OSM tabanlı set + Esri uydu. Yeni tile servisi yok.
 * `osm: true` katmanlarda vendor-overrides.css'teki hafif sepya filtresi uygulanır (S12).
 * Atıf her katmanın kendi lisansına göredir; `{osm}` kullanıcının dilinde "OpenStreetMap
 * katkıcıları" metniyle doldurulur (I11).
 */
export const MAP_LAYERS = [
  {
    id: "standart",
    labelKey: "planner.map.layer.standard",
    fallback: "Standart",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    subdomains: "abc",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">{osm}</a>',
    maxZoom: 19,
    osm: true,
  },
  {
    id: "sade",
    labelKey: "planner.map.layer.light",
    fallback: "Sade",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    subdomains: "abc",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">{osm}</a>, HOT',
    maxZoom: 19,
    osm: true,
  },
  {
    id: "doga",
    labelKey: "planner.map.layer.terrain",
    fallback: "Arazi",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    subdomains: "abc",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">{osm}</a>, <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
    osm: false,
  },
  {
    id: "uydu",
    labelKey: "planner.map.layer.satellite",
    fallback: "Uydu",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    maxZoom: 19,
    osm: false,
  },
] as const;
export type MapLayerId = (typeof MAP_LAYERS)[number]["id"];
export const MAP_LAYER_IDS = MAP_LAYERS.map((l) => l.id) as readonly MapLayerId[];
const TRANSIT_URL = "https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png";
const TRANSIT_ATTRIBUTION = '&copy; <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>';
const INITIAL_VIEW: [number, number] = [40.9856, 29.0289];
const FOCUS_ZOOM = 16;
/** flyTo süresi (design FEAT-007: 600 ms); azaltılmış harekette setView. */
const FLY_SECONDS = 0.6;

export type MapControl = "zoom" | "layers" | "locate";
export interface MapCanvasHandle {
  map: LeafletMap;
  L: LeafletNamespace;
  /** Konuma odaklan: normalde flyTo (600 ms), prefers-reduced-motion'da setView. */
  focus(target: [number, number] | LeafletLatLng, zoom?: number): void;
}

/**
 * Harita kabı (design §4.2 MapCanvas, §4.4). Leaflet YALNIZ burada, lib/leaflet-loader.ts ile
 * yüklenir. role="region" + aria-label; sağ üstte 44 px dikey kontrol yığını; atıf katman başına.
 * Harita yüklenemezse yalnız harita alanında ErrorState compact gösterilir, liste etkilenmez
 * (I12, design §12.1).
 */
export function MapCanvas({
  label,
  controls = ["zoom", "layers", "locate"],
  layer,
  onLayerChange,
  transit,
  onTransitChange,
  onReady,
  onMapClick,
  onMapDoubleClick,
  onLocate,
  locating = false,
  className,
  children,
}: {
  label: string;
  controls?: readonly MapControl[];
  layer: MapLayerId;
  onLayerChange: (id: MapLayerId) => void;
  transit: boolean;
  onTransitChange: (on: boolean) => void;
  onReady: (handle: MapCanvasHandle | null) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onMapDoubleClick?: (lat: number, lng: number) => void;
  onLocate?: () => void;
  locating?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const { t } = useLocale();
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileRef = useRef<LeafletLayer | null>(null);
  const tileLayerId = useRef<MapLayerId | null>(null);
  const transitRef = useRef<LeafletLayer | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [layersOpen, setLayersOpen] = useState(false);
  const callbacks = useRef({ onReady, onMapClick, onMapDoubleClick });
  callbacks.current = { onReady, onMapClick, onMapDoubleClick };
  const initialLayer = useRef(layer);
  initialLayer.current = layer;
  const osmCredit = useRef("");
  osmCredit.current = t("planner.map.osmContributors", "OpenStreetMap katkıcıları");

  // Leaflet yükleme + harita kurulumu (yeniden deneme `attempt` ile).
  useEffect(() => {
    let mounted = true;
    let resizeObserver: ResizeObserver | undefined;
    setStatus("loading");
    const init = () => {
      const L = (window as WindowWithLeaflet).L;
      const el = containerRef.current;
      if (!mounted || !L || !el || mapRef.current) return;
      try {
        const map = L.map(el, { zoomControl: false, doubleClickZoom: false }).setView(
          INITIAL_VIEW,
          14,
        );
        map.attributionControl?.setPrefix(false);
        mapRef.current = map;
        const tile = addBaseLayer(L, map, initialLayer.current, osmCredit.current);
        tileRef.current = tile;
        tileLayerId.current = initialLayer.current;
        let hasTiles = false;
        tile.on("tileload", () => {
          hasTiles = true;
          if (mounted) setStatus("ready");
        });
        tile.on("tileerror", () => {
          if (mounted && !hasTiles) setStatus("error");
        });
        map.whenReady(() => {
          if (!mounted) return;
          map.invalidateSize();
          setStatus((s) => (s === "error" ? s : "ready"));
        });
        map.on("click", (e) => callbacks.current.onMapClick?.(e.latlng.lat, e.latlng.lng));
        map.on("dblclick", (e) => callbacks.current.onMapDoubleClick?.(e.latlng.lat, e.latlng.lng));
        resizeObserver = new ResizeObserver(() => map.invalidateSize({ pan: false }));
        resizeObserver.observe(el);
        callbacks.current.onReady({
          map,
          L,
          focus(target, zoom = FOCUS_ZOOM) {
            if (reducedRef.current) map.setView(target, zoom, { animate: false });
            else map.flyTo(target, zoom, { duration: FLY_SECONDS });
          },
        });
      } catch (error) {
        if (process.env.NODE_ENV !== "production") console.warn("Harita kurulamadı", error);
        mapRef.current?.remove();
        mapRef.current = null;
        setStatus("error");
      }
    };
    const failed = () => {
      if (mounted) setStatus("error");
    };
    ensureLeafletCss();
    let script: HTMLScriptElement | null = null;
    if ((window as WindowWithLeaflet).L) init();
    else script = ensureLeafletScript({ onLoad: init, onError: failed, reload: attempt > 0 });
    const timeout = window.setTimeout(() => {
      if (!mapRef.current) failed();
    }, 15000);
    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      script?.removeEventListener("load", init);
      script?.removeEventListener("error", failed);
      resizeObserver?.disconnect();
      callbacks.current.onReady(null);
      mapRef.current?.remove();
      mapRef.current = null;
      tileRef.current = null;
      tileLayerId.current = null;
      transitRef.current = null;
    };
  }, [attempt]);

  // Taban katman değişimi (yalnızca farklı katman seçilince).
  useEffect(() => {
    const L = (window as WindowWithLeaflet).L;
    const map = mapRef.current;
    if (!L || !map || !tileRef.current || tileLayerId.current === layer) return;
    map.removeLayer(tileRef.current);
    tileRef.current = addBaseLayer(L, map, layer, osmCredit.current);
    tileLayerId.current = layer;
    tileRef.current.bringToBack?.();
  }, [layer, status]);

  // Raylı sistem katmanı.
  useEffect(() => {
    const L = (window as WindowWithLeaflet).L;
    const map = mapRef.current;
    if (!L || !map) return;
    if (transit && !transitRef.current) {
      transitRef.current = L.tileLayer(TRANSIT_URL, {
        maxZoom: 19,
        opacity: 0.85,
        attribution: TRANSIT_ATTRIBUTION,
      }).addTo(map);
    } else if (!transit && transitRef.current) {
      map.removeLayer(transitRef.current);
      transitRef.current = null;
    }
  }, [transit, status]);

  const osm = MAP_LAYERS.find((l) => l.id === layer)?.osm ?? false;
  const layersId = "map-canvas-layers";
  return (
    <section
      className={["map-canvas", className].filter(Boolean).join(" ")}
      role="region"
      aria-label={label}
      data-tiles={osm ? "osm" : "other"}
      data-status={status}
    >
      <div ref={containerRef} className="map-canvas__surface" />
      <div className="map-canvas__controls" data-surface="default">
        {controls.includes("zoom") && (
          <>
            <IconButton
              icon="plus"
              variant="secondary"
              label={t("planner.map.zoomIn", "Yakınlaştır")}
              onClick={() => mapRef.current?.zoomIn()}
            />
            <IconButton
              icon="minus"
              variant="secondary"
              label={t("planner.map.zoomOut", "Uzaklaştır")}
              onClick={() => mapRef.current?.zoomOut()}
            />
          </>
        )}
        {controls.includes("layers") && (
          <IconButton
            icon="layers"
            variant="secondary"
            label={t("planner.map.layers", "Harita katmanları")}
            expanded={layersOpen}
            controls={layersId}
            onClick={() => setLayersOpen((v) => !v)}
          />
        )}
        {controls.includes("locate") && onLocate && (
          <IconButton
            icon="locate"
            variant="secondary"
            label={t("planner.map.locate", "Konumuma git")}
            disabled={locating}
            onClick={onLocate}
          />
        )}
      </div>
      {layersOpen && (
        <fieldset id={layersId} className="map-canvas__layers" data-surface="default">
          <legend className="map-canvas__layers-title">
            {t("planner.map.layers", "Harita katmanları")}
          </legend>
          {MAP_LAYERS.map((l) => (
            <label key={l.id} className="map-canvas__layer">
              <input
                type="radio"
                name="map-canvas-layer"
                value={l.id}
                checked={layer === l.id}
                onChange={() => onLayerChange(l.id)}
              />
              <span>{t(l.labelKey, l.fallback)}</span>
            </label>
          ))}
          <label className="map-canvas__layer map-canvas__layer--toggle">
            <input
              type="checkbox"
              checked={transit}
              onChange={(e) => onTransitChange(e.target.checked)}
            />
            <span>{t("planner.map.transit", "Raylı sistem hatları")}</span>
          </label>
        </fieldset>
      )}
      {status === "loading" && (
        <p className="map-canvas__status" role="status">
          {t("planner.map.loading", "Harita yükleniyor…")}
        </p>
      )}
      {status === "error" && (
        <div className="map-canvas__error" data-surface="default">
          <ErrorState
            compact
            error={{
              kind: "network",
              title: t("planner.map.errorTitle", "Harita yüklenemedi."),
              message: t("planner.map.errorBody", "Durak listen çevrimdışı da kullanılabilir."),
              retryable: true,
            }}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        </div>
      )}
      {children}
    </section>
  );
}

function addBaseLayer(
  L: LeafletNamespace,
  map: LeafletMap,
  id: MapLayerId,
  osmCredit: string,
): LeafletLayer {
  const l = MAP_LAYERS.find((x) => x.id === id) ?? MAP_LAYERS[0];
  return L.tileLayer(l.url, {
    // Atıf HTML olarak çizilir; çeviri metni kaçışlanır.
    attribution: l.attribution.replace("{osm}", escapeHtml(osmCredit)),
    maxZoom: l.maxZoom,
    ...("subdomains" in l ? { subdomains: l.subdomains } : {}),
  }).addTo(map);
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
