"use client";
// Rota planlayıcı /maps/ (design §4.3 AppSplit, §4.4 harita dili, §6.3 misafir planlayıcı; FEAT-007).
// Oturumsuz kullanıcı gerçek planlayıcıyı `mode="guest"` ile kullanır: çalışma alanı yalnızca
// cihazda (use-travel-planner → planner-store, hesap yalıtımlı). Hesap gerektiren eylemler
// (paylaş, asistana sor, kaydet) AuthGate sheet açar. "Rotayı optimize et" istemcide ücretsiz,
// deterministik 2-opt sıralamasıdır (I2): kredi rozeti ve kapı yok; gerçek bir sunucu
// route_optimize ucu olana kadar böyle kalır (karar S19). Sunucu kredi zorlaması değişmez;
// istemci kredi hesaplamaz (S1).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getStoredSession } from "../lib/cognito";
import { AuthGate } from "../components/auth-gate";
import {
  GooglePlannerMap,
  type GoogleMapHandle,
  type GooglePoint,
} from "../components/trip/google-planner-map";
import { googleMapsEnabled } from "../lib/google/maps-client";
import type { Pin, PinCategory } from "../lib/trip/models";
import { TravelPlannerSidebar, type PlannerMode } from "../components/trip/travel-planner-sidebar";
import {
  MapCanvas,
  MAP_LAYER_IDS,
  type MapCanvasHandle,
  type MapLayerId,
} from "../components/trip/map-canvas";
import type {
  LeafletFeatureGroup,
  LeafletLayer,
  LeafletMarker,
} from "../components/trip/map-canvas";
import { PinPopupContent } from "../components/trip/pin-popup";
import { DISCOVERY_POOL_EVENT, type DiscoveryPoolDetail } from "../components/trip/discover-panel";
import { openPinEffects, pinPopupModel } from "../lib/trip/pin-popup";
import { TripPicker } from "../components/trip/trip-picker";
import { ShareModal, type ShareTarget } from "../components/trip/share-modal";
import { dayColorIndex } from "../components/trip/trip-format";
import { useTravelPlanner } from "../lib/trip/use-travel-planner";
import { reverseGeocodeLocation } from "../lib/trip/geocoding-service";
import { tripToMarkdown } from "../lib/trip/trip-markdown";
import { PLANNER_VIEWS } from "../lib/trip/planner-logic";
import { dayPalette, mapLine } from "../lib/design-tokens";
import { prefersReducedMotion } from "../lib/a11y/use-reduced-motion";
import { useLocale } from "../lib/locale-context";
import {
  Badge,
  BottomSheet,
  Button,
  Icon,
  IconButton,
  Modal,
  PageHeader,
  PageShell,
  useToast,
  useUrlParam,
  type SheetSnap,
} from "../components/ui";
import "./maps.css";

const COMPACT_QUERY = "(max-width: 767.98px)";
const LAYER_KEY = "mapsbridge.mapStyle";
const TRANSIT_KEY = "mapsbridge.transitOverlay";

/** <768: tam ekran harita + BottomSheet; mount'a kadar false (prerender masaüstü düzeni). */
function useCompact(): boolean {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(COMPACT_QUERY);
    const update = () => setCompact(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return compact;
}

/** Gün rengi (design §4.4): dayPalette[(gün-1) % 7]; günsüz durak 1. renk. */
function dayColor(day: number): string {
  return dayPalette[dayColorIndex(day || 1) - 1];
}

type QuickPoint = GooglePoint;

export default function Panel() {
  const { t } = useLocale();
  const toast = useToast();
  const planner = useTravelPlanner();
  const compact = useCompact();
  const [mode, setMode] = useState<PlannerMode>("guest");
  const [view, setView] = useUrlParam("view", { allowed: PLANNER_VIEWS, fallback: "plan" });
  const [gate, setGate] = useState<"ai" | "save" | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("peek");
  const [quickPoint, setQuickPoint] = useState<QuickPoint | null>(null);
  const [layer, setLayer] = useState<MapLayerId>("standart");
  const [transit, setTransit] = useState(false);
  const [locating, setLocating] = useState(false);
  const [canvas, setCanvas] = useState<MapCanvasHandle | null>(null);
  const googleRef = useRef<GoogleMapHandle | null>(null);
  const pointRequest = useRef(0);

  // Oturum (mount sonrası; statik çıktı misafir planlayıcıyı çizer).
  useEffect(() => {
    const session = getStoredSession();
    setMode(session?.token && session?.email ? "user" : "guest");
    try {
      const saved = localStorage.getItem(LAYER_KEY) as MapLayerId | null;
      if (saved && MAP_LAYER_IDS.includes(saved)) setLayer(saved);
      setTransit(localStorage.getItem(TRANSIT_KEY) === "true");
    } catch {}
  }, []);

  // ?tripId= / ?trip= / ?route= ile gelen rota, gezi listesi yüklenince bir kez açılır.
  const pendingTrip = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    pendingTrip.current = params.get("tripId") || params.get("trip") || params.get("route");
  }, []);
  useEffect(() => {
    const wanted = pendingTrip.current;
    if (!wanted) return;
    const lower = wanted.toLowerCase();
    const match = planner.trips.find((x) => x.id === wanted || x.title.toLowerCase() === lower);
    if (match) {
      pendingTrip.current = null;
      planner.switchTrip(match.id);
    }
  }, [planner.trips, planner.switchTrip]);

  // Seyahat özeti (.md) modalı: kenar çubuğundaki "Gezi modu" düğmesi olayla açar.
  useEffect(() => {
    const open = () => setSummaryOpen(true);
    window.addEventListener("mapsbridge:open-trip-manifesto", open);
    return () => window.removeEventListener("mapsbridge:open-trip-manifesto", open);
  }, []);

  const persistLayer = (id: MapLayerId) => {
    setLayer(id);
    try {
      localStorage.setItem(LAYER_KEY, id);
    } catch {}
  };
  const persistTransit = (on: boolean) => {
    setTransit(on);
    try {
      localStorage.setItem(TRANSIT_KEY, String(on));
    } catch {}
  };

  const focus = useCallback(
    (lat: number, lng: number) => {
      if (googleMapsEnabled) googleRef.current?.focus(lat, lng);
      else canvas?.focus([lat, lng]);
    },
    [canvas],
  );

  const pickPoint = async (lat: number, lng: number) => {
    const request = ++pointRequest.current;
    planner.setSelectedPinId(null);
    setQuickPoint({ lat, lng, address: t("planner.point.loading", "Konum sorgulanıyor…") });
    if (compact) setSheetSnap("half");
    try {
      const place = await reverseGeocodeLocation(lat, lng);
      if (request === pointRequest.current) setQuickPoint({ lat, lng, address: place.address });
    } catch {
      if (request === pointRequest.current)
        setQuickPoint({ lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
    }
  };

  const addAt = async (lat: number, lng: number) => {
    const tripId = planner.activeTrip?.id || planner.trips[0]?.id;
    if (!tripId) return;
    const day = planner.activeDayIndex || 1;
    let label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    let category: PinCategory = "genel";
    try {
      const place = await reverseGeocodeLocation(lat, lng);
      label = place.label || place.address.split(",")[0] || label;
      address = place.address;
      category = (place.category as PinCategory) || "genel";
    } catch {}
    planner.addPinDirectlyToTrip(
      tripId,
      {
        label,
        address,
        lat,
        lng,
        category,
        dayIndex: day,
        group: "Genel",
        visited: false,
        durationMinutes: 60,
      },
      day,
    );
    toast.show({
      tone: "success",
      message: t("planner.toast.addedToDay", "“{name}” {day}. güne eklendi.")
        .replace("{name}", label)
        .replace("{day}", String(day)),
    });
  };

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        focus(pos.coords.latitude, pos.coords.longitude);
        void pickPoint(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLocating(false);
        toast.show({ tone: "warning", message: t("planner.locate.failed", "Konumun alınamadı.") });
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  /**
   * Pini seç ve ayrıntıyı aç. "Rotalarım" görünümünde kenar çubuğu yok: önce plana geçilir ki
   * ayrıntı olayı kaybolmasın (bug 3). Mobilde harita pini dokunuşu yalnız popup açar
   * (`expand:false`); sayfayı "Ayrıntı" düğmesi yarıya çeker.
   */
  const openPin = (id: string, opts: { expand?: boolean } = {}) => {
    pointRequest.current++;
    setQuickPoint(null);
    const effects = openPinEffects(view, compact, opts.expand !== false);
    if (effects.switchToPlan) setView("plan");
    planner.setSelectedPinId(id);
    if (effects.expandSheet) setSheetSnap("half");
    window.dispatchEvent(new CustomEvent("mapsbridge:show-pin-detail", { detail: { id } }));
  };

  // ── Pin popup (bug 3): Leaflet popup'ı + React portal. Pin yeniden çizilince açık popup
  // aynı pin için yeniden açılır; çizim sırasındaki kapanma olayları yok sayılır. ──
  const [popup, setPopup] = useState<{
    pinId: string;
    host: HTMLElement;
    marker: LeafletMarker;
  } | null>(null);
  const popupFor = useRef<string | null>(null);
  const redrawing = useRef(false);
  useEffect(() => {
    if (!popup) return;
    const frame = requestAnimationFrame(() => popup.marker.getPopup()?.update());
    return () => cancelAnimationFrame(frame);
  }, [popup, planner.pinsWithTime, planner.generalPins]);
  const bindPinPopup = (marker: LeafletMarker, pinId: string) => {
    const host = document.createElement("div");
    host.className = "planner-popup__body";
    host.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      marker.closePopup();
      (marker.getElement?.() as HTMLElement | undefined)?.focus();
    });
    marker.bindPopup(host, {
      className: "planner-popup",
      maxWidth: 280,
      minWidth: 220,
      autoPanPadding: [24, 24],
      closeButton: true,
    });
    marker.on("popupopen", () => {
      popupFor.current = pinId;
      setPopup({ pinId, host, marker });
    });
    marker.on("popupclose", () => {
      if (redrawing.current) return;
      popupFor.current = null;
      setPopup((cur) => (cur?.pinId === pinId ? null : cur));
    });
  };

  // ── Harita: numaralı pinler, rota çizgisi, seçili nokta (Leaflet; design §4.4) ──
  const markersRef = useRef<LeafletFeatureGroup | null>(null);
  const routeRef = useRef<LeafletFeatureGroup | null>(null);
  const pointRef = useRef<LeafletLayer | null>(null);
  const lastFit = useRef("");
  const lastFocused = useRef("");
  const drawnRoute = useRef("");
  const pinsToRender = useMemo(
    () => planner.pinsWithTime.filter((p) => !p.visited || planner.showVisitedOnMap),
    [planner.pinsWithTime, planner.showVisitedOnMap],
  );
  useEffect(() => {
    if (!canvas) return;
    const { L, map } = canvas;
    redrawing.current = true;
    if (markersRef.current) map.removeLayer(markersRef.current);
    redrawing.current = false;
    if (routeRef.current) map.removeLayer(routeRef.current);
    markersRef.current = null;
    routeRef.current = null;
    const fitKey = `${planner.activeTrip?.id}:${planner.activeDayIndex}`;
    const geometry = planner.activeRoadGeometry;
    const coords =
      geometry && geometry.coordinates.length > 1
        ? geometry.coordinates
        : pinsToRender.length > 1
          ? pinsToRender.map((p) => [p.lat, p.lng] as [number, number])
          : [];
    if (coords.length > 1) {
      const real = Boolean(geometry?.isRealRoad);
      const color = dayColor(planner.currentDay?.dayIndex || pinsToRender[0]?.dayIndex || 1);
      const group = L.featureGroup();
      L.polyline(coords, {
        color: mapLine.casing,
        weight: 10,
        opacity: 1,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      }).addTo(group);
      // İlk çizim animasyonu (vendor-overrides.css) yalnız gün/rota ilk kez çizildiğinde.
      const firstDraw = real && drawnRoute.current !== fitKey;
      if (real) drawnRoute.current = fitKey;
      const line = L.polyline(coords, {
        color,
        weight: 5,
        opacity: 1,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
        dashArray: real ? undefined : "6 8",
        className: firstDraw ? "planner-route planner-route--draw" : "planner-route",
      }).addTo(group);
      group.addTo(map);
      if (firstDraw) line.getElement?.()?.setAttribute("pathLength", "1");
      routeRef.current = group;
    }
    const group = L.featureGroup();
    const markers = new Map<string, LeafletMarker>();
    pinsToRender.forEach((pin, index) => {
      const selected = planner.selectedPinId === pin.id;
      const number = pin.order || index + 1;
      const icon = L.divIcon({
        className: `planner-pin${selected ? " is-selected" : ""}${pin.visited ? " is-visited" : ""}`,
        html: `<span class="planner-pin__head" style="--pin-color:${dayColor(pin.dayIndex)}">${number}</span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const marker = L.marker([pin.lat, pin.lng], {
        icon,
        title: `${number}. ${pin.label}`,
        keyboard: true,
        riseOnHover: true,
        zIndexOffset: selected ? 1000 : 0,
      });
      bindPinPopup(marker, pin.id);
      marker.on("click", () => openPin(pin.id, { expand: false })).addTo(group);
      markers.set(pin.id, marker);
    });
    planner.generalPins.forEach((pin) => {
      const icon = L.divIcon({
        className: `planner-pool-pin${planner.selectedPinId === pin.id ? " is-selected" : ""}`,
        html: `<span class="planner-pool-pin__dot"></span>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      const marker = L.marker([pin.lat, pin.lng], { icon, title: pin.label, keyboard: true });
      bindPinPopup(marker, pin.id);
      marker.on("click", () => openPin(pin.id, { expand: false })).addTo(group);
      markers.set(pin.id, marker);
    });
    group.addTo(map);
    markersRef.current = group;
    // Açık popup yeniden çizimden sağ çıkar; pin artık yoksa kapanır.
    if (popupFor.current) {
      const again = markers.get(popupFor.current);
      if (again) again.openPopup();
      else {
        popupFor.current = null;
        setPopup(null);
      }
    }
    if (pinsToRender.length > 0 && lastFit.current !== fitKey) {
      lastFit.current = fitKey;
      try {
        map.fitBounds(group.getBounds().pad(0.18), {
          maxZoom: 16,
          animate: !prefersReducedMotion(),
        });
      } catch {}
    }
    const selected = planner.selectedPin;
    if (selected && lastFocused.current !== selected.id) {
      lastFocused.current = selected.id;
      canvas.focus([selected.lat, selected.lng]);
    }
  }, [
    canvas,
    pinsToRender,
    planner.generalPins,
    planner.activeRoadGeometry,
    planner.activeDayIndex,
    planner.activeTrip?.id,
    planner.selectedPinId,
  ]);

  // Keşif havuzu (bug 5): ayrı stil (kesik halka), rota pinlerinden ayırt edilir.
  const [discoveryPool, setDiscoveryPool] = useState<DiscoveryPoolDetail["places"]>([]);
  const discoveryRef = useRef<LeafletFeatureGroup | null>(null);
  useEffect(() => {
    const onPool = (e: Event) =>
      setDiscoveryPool((e as CustomEvent<DiscoveryPoolDetail>).detail?.places ?? []);
    window.addEventListener(DISCOVERY_POOL_EVENT, onPool);
    return () => window.removeEventListener(DISCOVERY_POOL_EVENT, onPool);
  }, []);
  useEffect(() => {
    if (!canvas) return;
    if (discoveryRef.current) canvas.map.removeLayer(discoveryRef.current);
    discoveryRef.current = null;
    if (discoveryPool.length === 0) return;
    const group = canvas.L.featureGroup();
    for (const p of discoveryPool) {
      const icon = canvas.L.divIcon({
        className: "planner-discover-pin",
        html: `<span class="planner-discover-pin__ring"></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      canvas.L.marker([p.lat, p.lng], { icon, title: p.name, keyboard: false }).addTo(group);
    }
    group.addTo(canvas.map);
    discoveryRef.current = group;
  }, [canvas, discoveryPool]);

  // Haritada seçilen (henüz durak olmayan) nokta.
  useEffect(() => {
    if (!canvas) return;
    if (pointRef.current) canvas.map.removeLayer(pointRef.current);
    pointRef.current = null;
    if (!quickPoint) return;
    const icon = canvas.L.divIcon({
      className: "planner-point-pin",
      html: `<span class="planner-point-pin__dot"></span>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    pointRef.current = canvas.L.marker([quickPoint.lat, quickPoint.lng], {
      icon,
      title: t("planner.point.eyebrow", "Haritadan seçildi"),
      keyboard: false,
    }).addTo(canvas.map);
  }, [canvas, quickPoint]);

  // ── Eylemler (misafirde AuthGate; design §6.3) ──
  const activeDay = planner.activeDayIndex && planner.activeDayIndex > 0;
  const canOptimize = Boolean(activeDay) && planner.pinsWithTime.length >= 3;
  // Karar S19: ücretsiz istemci sıralaması; misafir de kullanır, kredi ayrılmaz/gösterilmez.
  const optimize = () => {
    const preview = planner.optimizationPreview;
    if (!preview) {
      toast.show({
        tone: "info",
        message: t("planner.optimize.none", "Bu günün sırası zaten en kısa sıraya yakın."),
      });
      return;
    }
    planner.applyOptimization();
    toast.show({
      tone: "success",
      message: t(
        "planner.optimize.done",
        "Durak sırası güncellendi: yaklaşık {km} km daha kısa.",
      ).replace("{km}", String(preview.savedDistanceKm).replace(".", ",")),
    });
  };
  const shareTarget: ShareTarget | null = planner.selectedPin
    ? {
        lat: planner.selectedPin.lat,
        lng: planner.selectedPin.lng,
        address: planner.selectedPin.address,
        label: planner.selectedPin.label,
      }
    : quickPoint
      ? { ...quickPoint, label: quickPoint.address.split(",")[0] }
      : planner.pinsWithTime[0]
        ? {
            lat: planner.pinsWithTime[0].lat,
            lng: planner.pinsWithTime[0].lng,
            address: planner.pinsWithTime[0].address,
            label: planner.pinsWithTime[0].label,
          }
        : null;
  const askHref = planner.activeTrip
    ? `/travel-assistant/?tripId=${encodeURIComponent(planner.activeTrip.id)}`
    : "/travel-assistant/";

  const actions = (
    <div className="planner-actions">
      {canOptimize && (
        <Button variant="primary" iconStart={<Icon name="sparkle" size={20} />} onClick={optimize}>
          {t("planner.optimize", "Rotayı optimize et")}
        </Button>
      )}
      {shareTarget && (
        <Button
          variant="secondary"
          iconStart={<Icon name="share" size={20} />}
          onClick={() => (mode === "guest" ? setGate("save") : setShareOpen(true))}
        >
          {t("planner.share", "Paylaş")}
        </Button>
      )}
      {mode === "guest" ? (
        <Button
          variant="secondary"
          iconStart={<Icon name="message" size={20} />}
          onClick={() => setGate("ai")}
        >
          {t("planner.ask", "Asistana sor")}
        </Button>
      ) : (
        <Button href={askHref} variant="secondary" iconStart={<Icon name="message" size={20} />}>
          {t("planner.ask", "Asistana sor")}
        </Button>
      )}
    </div>
  );

  const saveText =
    planner.saveState === "saving"
      ? t("planner.save.saving", "Kaydediliyor…")
      : planner.saveState === "error"
        ? t("planner.save.error", "Kaydedilemedi")
        : t("planner.save.saved", "Kaydedildi");
  const toolbar = (
    <div className="planner-toolbar">
      <div className="planner-toolbar__row">
        <h2 className="planner-toolbar__title">
          {view === "trips"
            ? t("planner.trips.title", "Rotalarım")
            : planner.activeTrip?.title || t("planner.untitled", "Yeni rota")}
        </h2>
        <Button
          size="sm"
          variant={view === "trips" ? "secondary" : "ghost"}
          iconStart={<Icon name={view === "trips" ? "map" : "route"} size={16} />}
          onClick={() => setView(view === "trips" ? "plan" : "trips")}
        >
          {view === "trips"
            ? t("planner.backToPlan", "Plana dön")
            : t("planner.trips.title", "Rotalarım")}
        </Button>
        <IconButton
          icon="undo"
          size="sm"
          label={t("planner.undo", "Geri al")}
          disabled={!planner.canUndo}
          onClick={planner.undo}
        />
      </div>
      <div className="planner-toolbar__row" role="status">
        {mode === "guest" ? (
          <>
            <Badge tone="example">
              <Icon name="offline" size={16} />
              {t("gate.banner", "Cihazında taslak · Kaydetmek için hesap aç")}
            </Badge>
            <Button size="sm" variant="primary" onClick={() => setGate("save")}>
              {t("planner.save", "Kaydet")}
            </Button>
          </>
        ) : (
          <Badge tone={planner.saveState === "error" ? "danger" : "neutral"}>
            <Icon name={planner.saveState === "error" ? "alert" : "check"} size={16} />
            {saveText}
          </Badge>
        )}
      </div>
    </div>
  );

  const panel = (
    <>
      {toolbar}
      {view === "trips" ? (
        <TripPicker planner={planner} mode={mode} onOpen={() => setView("plan")} />
      ) : (
        <TravelPlannerSidebar
          planner={planner}
          mode={mode}
          onFlyToPin={(pin: Pin) => focus(pin.lat, pin.lng)}
          onFlyToCoords={(lat, lng, label) => {
            focus(lat, lng);
            pointRequest.current++;
            planner.setSelectedPinId(null);
            setQuickPoint({ lat, lng, address: label });
          }}
          selectedMapPoint={quickPoint}
          onClearSelectedMapPoint={() => setQuickPoint(null)}
          onRequireAuth={(reason) => setGate(reason)}
          footer={actions}
          mapCenter={() => {
            const c = canvas?.map.getCenter();
            return c ? { lat: c.lat, lng: c.lng } : null;
          }}
        />
      )}
    </>
  );

  const mapLabel = t("planner.map.label", "Rota haritası");
  const map = googleMapsEnabled ? (
    <div className="planner__google" role="region" aria-label={mapLabel}>
      <GooglePlannerMap
        pins={[...planner.pinsWithTime, ...planner.generalPins]}
        selectedId={planner.selectedPinId}
        point={quickPoint}
        path={(planner.activeRoadGeometry?.coordinates || []) as [number, number][]}
        onPoint={(point) => {
          pointRequest.current++;
          planner.setSelectedPinId(null);
          setQuickPoint(point);
        }}
        onPin={openPin}
        onReady={(handle) => {
          googleRef.current = handle;
        }}
        onError={() => {
          googleRef.current = null;
        }}
        onAddPlaceToTrip={(place) => {
          const tripId = planner.activeTrip?.id || planner.trips[0]?.id;
          if (!tripId) return;
          const day = planner.activeDayIndex || 1;
          planner.addPinDirectlyToTrip(
            tripId,
            {
              label: place.label,
              address: place.address,
              lat: place.lat,
              lng: place.lng,
              category: (place.category || "genel") as PinCategory,
              dayIndex: day,
              group: "Genel",
              visited: false,
              durationMinutes: 60,
              googlePlaceId: place.googlePlaceId,
            },
            day,
          );
          setQuickPoint(null);
        }}
      />
    </div>
  ) : (
    <MapCanvas
      className="planner__canvas"
      label={mapLabel}
      layer={layer}
      onLayerChange={persistLayer}
      transit={transit}
      onTransitChange={persistTransit}
      onReady={setCanvas}
      onMapClick={(lat, lng) => void pickPoint(lat, lng)}
      onMapDoubleClick={(lat, lng) => void addAt(lat, lng)}
      onLocate={locate}
      locating={locating}
    />
  );

  const trip = planner.activeTrip;
  const targetDay =
    planner.activeDayIndex && planner.activeDayIndex > 0 ? planner.activeDayIndex : 1;
  const popupPin = popup
    ? (planner.activeTrip?.pins.find((p) => p.id === popup.pinId) ??
      planner.generalPins.find((p) => p.id === popup.pinId))
    : undefined;
  const popupModel = popupPin ? pinPopupModel(popupPin) : null;
  return (
    <PageShell layout="app" className="planner">
      {/* AC-34: tek h1 "Rota planlayıcı" (registry, görsel olarak gizli). */}
      <PageHeader variant="hidden" />
      <div className="planner__split" data-compact={compact || undefined}>
        {compact ? (
          <BottomSheet
            className="planner__sheet"
            snap={["peek", "half", "full"]}
            value={sheetSnap}
            onSnapChange={setSheetSnap}
            label={t("planner.sheet.label", "Rota listesi")}
            expandLabel={t("planner.sheet.expand", "Listeyi genişlet")}
            collapseLabel={t("planner.sheet.collapse", "Listeyi daralt")}
          >
            <div className="planner__panel-body">{panel}</div>
          </BottomSheet>
        ) : (
          <aside className="planner__panel" aria-label={t("planner.sheet.label", "Rota listesi")}>
            <div className="planner__panel-body">{panel}</div>
          </aside>
        )}
        <div className="planner__map">{map}</div>
      </div>

      {popup && popupPin && popupModel
        ? createPortal(
            <PinPopupContent
              model={popupModel}
              addDay={targetDay}
              onDetails={() => openPin(popupPin.id)}
              onToggleVisited={() => planner.togglePinVisitedAnywhere(popupPin.id)}
              onAddToDay={
                popupPin.dayIndex > 0 || !planner.activeTripId
                  ? undefined
                  : () => {
                      planner.assignPinToTrip(popupPin.id, planner.activeTripId, targetDay);
                      popup.marker.closePopup();
                      toast.show({
                        tone: "success",
                        message: t("planner.toast.addedToDay", "“{name}” {day}. güne eklendi.")
                          .replace("{name}", popupPin.label)
                          .replace("{day}", String(targetDay)),
                      });
                    }
              }
            />,
            popup.host,
          )
        : null}
      <AuthGate
        variant="sheet"
        reason={gate ?? "save"}
        open={gate !== null}
        next="/maps/"
        onClose={() => setGate(null)}
      />
      <ShareModal open={shareOpen} target={shareTarget} onClose={() => setShareOpen(false)} />
      <Modal
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        size="lg"
        title={t("planner.summary.title", "Seyahat özeti (.md)")}
        description={t(
          "planner.summary.body",
          "Rotanın durakları ve notları. Asistan bu rota bağlamıyla açıldığında aynı bilgiyi kullanır.",
        )}
        footer={
          <div className="planner-summary__actions">
            <Button
              variant="secondary"
              iconStart={<Icon name="copy" size={16} />}
              disabled={!trip}
              onClick={async () => {
                if (!trip) return;
                try {
                  await navigator.clipboard.writeText(tripToMarkdown(trip));
                  toast.show({
                    tone: "success",
                    message: t("planner.summary.copied", "Özet panoya kopyalandı."),
                  });
                } catch {}
              }}
            >
              {t("planner.summary.copy", "Kopyala")}
            </Button>
            <Button
              variant="primary"
              iconStart={<Icon name="arrow" size={16} />}
              disabled={!trip}
              onClick={() => {
                if (!trip) return;
                const blob = new Blob([tripToMarkdown(trip)], {
                  type: "text/markdown;charset=utf-8",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${(trip.title || "seyahat").toLowerCase().replace(/[^a-z0-9]/gi, "_")}.md`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              {t("planner.summary.download", "İndir (.md)")}
            </Button>
          </div>
        }
      >
        <pre className="planner-summary__pre">
          {trip ? tripToMarkdown(trip) : t("planner.summary.empty", "Henüz etkin rota yok.")}
        </pre>
      </Modal>
    </PageShell>
  );
}
