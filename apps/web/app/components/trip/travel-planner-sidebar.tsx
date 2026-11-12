// ============================================================
// TravelPlannerSidebar — planlayıcı listesi (design §4.2, §4.3 AppSplit, §6.3; FEAT-007)
// Günler DayHeader, duraklar StopRow + Connector ile. Süre/mesafe yalnızca OSRM bacaklarından
// (I1/I2); yoksa "Süre hesaplanamadı". Sürükle-bırakın klavye alternatifi "Yukarı/Aşağı taşı" (R9).
// ============================================================

"use client";

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { DEFAULT_CATEGORY_META, type Pin, type PinCategory } from "../../lib/trip/models";
import type { useTravelPlanner } from "../../lib/trip/use-travel-planner";
import { googleMapsEnabled } from "../../lib/google/maps-client";
import { searchPlaces, type GeocodedPlace } from "../../lib/trip/geocoding-service";
import {
  initialSearchState,
  parseCoordinates,
  parseRecent,
  pushRecent,
  searchKey,
  searchReducer,
  shouldSendSearch,
  type RecentSearch,
  type SentSearch,
} from "../../lib/trip/place-search-logic";
import {
  PLANNER_RECENT_SEARCHES_KEY,
  readPlannerStore,
  writePlannerStore,
} from "../../lib/trip/planner-store";
import { apiFetch } from "../../lib/api-client";
import type { MultiAgentResponse } from "../../lib/ai/types";
import { interactionTracker } from "../../lib/analytics/tracker";
import { exportTripToGoogleMaps } from "../../features/trip-planner/google-maps-exporter";
import {
  ADD_TARGET_GENERAL,
  addTargetFor,
  dayBufferRatio,
  dayFullSuggestion,
  dayTimeline,
  defaultAddTargetValue,
  legKey,
  parseAddTarget,
  type AddTarget,
  type DayFullSuggestion,
} from "../../lib/trip/planner-logic";
import { isTextFieldTarget, plannerShortcut, SHORTCUT_HELP } from "../../lib/trip/shortcuts";
import { MotionProvider, Reorder, useDragControls } from "../../lib/motion";
import { prefersReducedMotion } from "../../lib/a11y/use-reduced-motion";
import { useLocale } from "../../lib/locale-context";
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  CostBadge,
  EmptyState,
  Field,
  Icon,
  IconButton,
  Input,
  SegmentedControl,
  Select,
  Skeleton,
  Textarea,
  cx,
  useToast,
} from "../ui";
import { GooglePlaceInfo } from "./google-place-info";
import { PlaceFacts } from "./place-facts";
import { PinShareModal } from "./pin-share-modal";
import { DiscoverPanel } from "./discover-panel";
import { NearbyList, type NearbyAddPlace } from "./nearby-list";
import { CATEGORY_ICON } from "../../lib/trip/pin-popup";
import { StopRow } from "./stop-row";
import { Connector, type ConnectorMode } from "./connector";
import { DayHeader } from "./day-header";
import { dayColorIndex } from "./trip-format";
import "./travel-planner.css";

const MODE: Record<string, ConnectorMode> = { walking: "walk", cycling: "walk", driving: "drive" };
/** Arama: en az 3 karakter, 400 ms bekleme (design §6.3; Nominatim/Photon kullanım politikası). */
const SEARCH_MIN = 3;
const SEARCH_DEBOUNCE_MS = 400;

type Planner = ReturnType<typeof useTravelPlanner>;
type ToastApi = ReturnType<typeof useToast>;
type Translate = (key: string, fallback?: string) => string;
/**
 * Silme sonrası geri bildirim (Increment 2.8): gezideki durak oturum içi geri alma yığınındadır →
 * "Geri al" eylemli toast (eylem araç çubuğundaki Geri al düğmesinde de kalıcı). Kaydedilen yer
 * yığında değildir → yalnız bilgi toast'ı (geri alınamaz vaadi verilmez).
 */
function announcePinDeleted(planner: Planner, toast: ToastApi, t: Translate, pin: Pin) {
  const message = t("planner.toast.deleted", "“{name}” silindi.").replace("{name}", pin.label);
  if (pin.tripId)
    toast.show({
      tone: "success",
      message,
      action: { label: t("planner.undo", "Geri al"), onClick: planner.undo },
      actionAlsoAt: "planner-toolbar undo IconButton",
    });
  else toast.show({ tone: "success", message });
}
type Place = {
  lat: number;
  lng: number;
  address: string;
  label: string;
  /** Proxy sonucunda sağlayıcı kimliği (ayrıntı/atıf için). */
  placeId?: string;
  provider?: "amazon" | "google";
  /** Keşiften gelen yerin kategorisi; yoksa "genel". */
  category?: PinCategory;
};
export type PlannerMode = "guest" | "user";

export interface TravelPlannerSidebarProps {
  planner: Planner;
  mode: PlannerMode;
  onFlyToPin?: (pin: Pin) => void;
  onFlyToCoords?: (lat: number, lng: number, label: string) => void;
  selectedMapPoint?: { lat: number; lng: number; address: string } | null;
  onClearSelectedMapPoint?: () => void;
  /** Ağ/hesap gerektiren eylem misafirde AuthGate sheet açar (design §6.3). */
  onRequireAuth: (reason: "ai" | "save") => void;
  /** Liste sonundaki eylemler (optimize/paylaş/asistan). */
  footer?: ReactNode;
  /** Keşif "Haritadaki alan" kapsamı için harita merkezi. */
  mapCenter?: () => { lat: number; lng: number } | null;
}

export function TravelPlannerSidebar({
  planner,
  mode,
  onFlyToPin,
  onFlyToCoords,
  selectedMapPoint,
  onClearSelectedMapPoint,
  onRequireAuth,
  footer,
  mapCenter,
}: TravelPlannerSidebarProps) {
  const { t } = useLocale();
  const toast = useToast();
  const {
    generalPins,
    selectedPin,
    activeTrip,
    activeTripId,
    activeDayIndex,
    selectedPinId,
    pinsWithTime,
    activeRouteLegs,
    transportMode,
    setActiveDayIndex,
    setSelectedPinId,
    addPinToGeneral,
    addPinDirectlyToTrip,
    assignPinToTrip,
    movePinToDay,
    updatePinAnywhere,
    deletePinAnywhere,
    togglePinVisitedAnywhere,
    addDay,
  } = planner;
  // B3 (FEAT-002): "edit" planlama görünümü (arama + Keşfet + gün durakları aynı anda görünür,
  // ayrı etiketli bölümlerde), "travel" gezide ilerleme görünümü. Eski ayrık "discover" kipi
  // kaldırıldı; Keşfet artık planlama görünümünde kalıcı bir bölüm.
  const [workspaceMode, setWorkspaceMode] = useState<"edit" | "travel">("edit");
  const [showDetail, setShowDetail] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Pin | null>(null);
  const targetDay = activeDayIndex && activeDayIndex > 0 ? activeDayIndex : 1;
  const connectorMode = MODE[transportMode] ?? "walk";

  // Seçili durak değişince ayrıntı açılır ve etkileşim kaydı düşer (mevcut davranış).
  useEffect(() => {
    if (!selectedPin) return;
    setShowDetail(true);
    interactionTracker.logPinClick({
      id: selectedPin.id,
      label: selectedPin.label,
      category: selectedPin.category,
      address: selectedPin.address,
      lat: selectedPin.lat,
      lng: selectedPin.lng,
      tripId: selectedPin.tripId,
      dayIndex: selectedPin.dayIndex,
    });
    interactionTracker.logPlaceView({
      label: selectedPin.label,
      placeId: selectedPin.googlePlaceId,
      category: selectedPin.category,
      source: "map_pin",
    });
  }, [selectedPin?.id]);

  useEffect(() => {
    const open = () => setShowDetail(true);
    window.addEventListener("mapsbridge:show-pin-detail", open);
    return () => window.removeEventListener("mapsbridge:show-pin-detail", open);
  }, []);

  // U3: ekleme hedefi artık kullanıcının seçtiği gün ya da Kaydedilenler (günsüz havuz).
  const addPlace = (place: Place, target: AddTarget) => {
    const pin = {
      label: place.label || place.address.split(",")[0] || t("planner.stop.new", "Yeni durak"),
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      category: place.category ?? ("genel" as PinCategory),
      dayIndex: target.kind === "day" ? target.day : 0,
      group: "Genel",
      visited: false,
      durationMinutes: 60,
      // Kaynak kimliği yalnız proxy sonucunda (ayrıntı için); Google kimliği mevcut alanda.
      ...(place.placeId && place.provider === "google" ? { googlePlaceId: place.placeId } : {}),
      ...(place.placeId && place.provider === "amazon"
        ? { placeId: place.placeId, placeProvider: "amazon" as const }
        : {}),
    };
    if (target.kind === "day") {
      addPinDirectlyToTrip(activeTripId, pin, target.day);
      toast.show({
        tone: "success",
        message: t("planner.toast.addedToDay", "“{name}” {day}. güne eklendi.")
          .replace("{name}", pin.label)
          .replace("{day}", String(target.day)),
      });
    } else {
      addPinToGeneral(pin);
      toast.show({
        tone: "success",
        message: t("planner.toast.addedToPool", "“{name}” kayıtlı yerlere eklendi.").replace(
          "{name}",
          pin.label,
        ),
      });
    }
  };

  // Gün içi sıra değişimi (klavye alternatifi, R9).
  const moveStop = (dayPins: Pin[], pin: Pin, direction: "up" | "down") => {
    const index = dayPins.findIndex((p) => p.id === pin.id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= dayPins.length) return;
    const other = dayPins[target];
    updatePinAnywhere(pin.id, { order: other.order || target + 1 });
    updatePinAnywhere(other.id, { order: pin.order || index + 1 });
    toast.show({
      tone: "info",
      message: (direction === "up"
        ? t("planner.toast.movedUp", "“{name}” bir üst sıraya taşındı.")
        : t("planner.toast.movedDown", "“{name}” bir alt sıraya taşındı.")
      ).replace("{name}", pin.label),
    });
  };

  // P8: sürükle-bırak bırakılınca günün sırası tek güncellemeyle yazılır; "Geri al" eylemli toast.
  const [dragOrder, setDragOrder] = useState<{ day: number; ids: string[] } | null>(null);
  const commitDrag = (day: number, before: readonly string[]) => {
    const ids = dragOrder?.day === day ? dragOrder.ids : null;
    setDragOrder(null);
    if (!ids || ids.join() === before.join()) return;
    planner.reorderDay(day, ids);
    toast.show({
      tone: "success",
      message: t("planner.toast.reordered", "{day}. günün sırası değişti.").replace(
        "{day}",
        String(day),
      ),
      action: { label: t("planner.undo", "Geri al"), onClick: planner.undo },
      actionAlsoAt: "planner-toolbar undo IconButton",
    });
  };

  // Seçili durağa yumuşak odak: liste satırı görünür alana kayar (azaltmada anında).
  useEffect(() => {
    if (!selectedPinId) return;
    const el = document.querySelector(`[data-stop-id="${CSS.escape(selectedPinId)}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [selectedPinId]);

  // Klavye kısayolları (lib/trip/shortcuts): / ve N aramaya, Esc ayrıntıyı kapatır,
  // Alt+↑/↓ seçili durağı taşır (sürükle-bırakın klavye alternatifi, R9).
  const shortcutState = useRef({ selectedPin, pinsWithTime, workspaceMode, showDetail, moveStop });
  shortcutState.current = { selectedPin, pinsWithTime, workspaceMode, showDetail, moveStop };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (document.querySelector("dialog[open]")) return;
      const action = plannerShortcut({
        key: e.key,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        inTextField: isTextFieldTarget(e.target as HTMLElement | null),
        // Tek tuşlu kısayollar yalnız plan paneli ya da harita odaktayken (WCAG 2.1.4).
        outsidePlanner: !(e.target instanceof Element && e.target.closest("[data-planner-scope]")),
      });
      if (!action) return;
      const st = shortcutState.current;
      if (action === "search" || action === "newStop") {
        e.preventDefault();
        setShowDetail(false);
        setWorkspaceMode("edit");
        window.setTimeout(() => document.getElementById("planner-search-input")?.focus(), 0);
      } else if (action === "closeDetail") {
        if (st.showDetail) setShowDetail(false);
      } else if (st.selectedPin && st.workspaceMode === "edit") {
        const dayPins = st.pinsWithTime.filter((p) => p.dayIndex === st.selectedPin?.dayIndex);
        if (!dayPins.some((p) => p.id === st.selectedPin?.id)) return;
        e.preventDefault();
        st.moveStop(dayPins, st.selectedPin, action === "moveUp" ? "up" : "down");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Gösterilecek günler: tek gün ya da "Tümü" görünümünde her gün kendi başlığıyla.
  const sections = useMemo(() => {
    if (!activeTrip) return [];
    const days =
      activeDayIndex && activeDayIndex > 0
        ? activeTrip.days.filter((d) => d.dayIndex === activeDayIndex)
        : activeTrip.days;
    return days.map((d) => {
      const pins =
        activeDayIndex && activeDayIndex > 0
          ? pinsWithTime
          : activeTrip.pins
              .filter((p) => p.dayIndex === d.dayIndex)
              .sort((a, b) => a.order - b.order);
      return {
        day: d,
        pins,
        timeline: dayTimeline(pins, activeRouteLegs, d.startTime),
        // I9: yalnız tüm bacaklar gerçekse oran; eksikse null ("hesaplanamadı").
        buffer: pins.length > 0 ? dayBufferRatio(pins, activeRouteLegs, d.startTime) : undefined,
        // U6: deterministik "gün doldu / boş" önerisi (I2); bacak eksikse null (öneri çizilmez).
        fullSuggestion: dayFullSuggestion(pins, activeRouteLegs, d.startTime),
      };
    });
  }, [activeTrip, activeDayIndex, pinsWithTime, activeRouteLegs]);

  const visitedCount = pinsWithTime.filter((p) => p.visited).length;
  const allPins = activeTrip?.pins ?? [];
  // Arama yakınlık önceliği: gezinin gerçek duraklarının ağırlık merkezi (yoksa yok).
  const searchBias = useMemo(() => {
    const pts = allPins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (pts.length === 0) return undefined;
    return {
      lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
      lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length,
    };
  }, [allPins]);

  // Ayrıntı listenin üstüne kayar; liste bağlı kalır (arama metni/sonuçları korunur).
  const detailOpen = Boolean(selectedPin && showDetail);
  return (
    <>
      {detailOpen && selectedPin && (
        <div className="planner-detail-layer">
          <PinDetail
            planner={planner}
            pin={selectedPin}
            mode={mode}
            days={(activeTrip?.days ?? []).map((d) => d.dayIndex)}
            activeDayIndex={activeDayIndex}
            onAddNearby={addPlace}
            onFlyToCoords={onFlyToCoords}
            onBack={() => setShowDetail(false)}
            onRequireAuth={onRequireAuth}
          />
        </div>
      )}
      <div className="planner-list" hidden={detailOpen}>
        {/* B3 (FEAT-002): üstte görünüm anahtarı; altında net etiketli bölümler —
            Günler, Yer ara, Keşfet (planlama görünümünde) ya da Gezide ilerlemesi,
            en altta Kayıtlı yerler. */}
        <SegmentedControl
          className="planner-list__mode"
          size="sm"
          block
          label={t("planner.mode.label", "Görünüm")}
          options={[
            { value: "edit", label: t("planner.mode.edit", "Plan") },
            { value: "travel", label: t("planner.mode.travel", "Gezide") },
          ]}
          value={workspaceMode}
          onChange={setWorkspaceMode}
        />

        <section className="planner-group planner-group--days" aria-labelledby="planner-group-days">
          <h3 className="planner-group__title" id="planner-group-days">
            <Icon name="calendar" size={16} aria-hidden="true" />
            {t("planner.group.days", "Günler")}
          </h3>
          <div className="planner-days" role="group" aria-label={t("planner.days", "Günler")}>
            <button
              type="button"
              className="planner-days__tab"
              aria-pressed={!activeDayIndex}
              onClick={() => setActiveDayIndex(0)}
            >
              {t("planner.days.all", "Tümü")}
              <span className="planner-days__count">{allPins.length}</span>
            </button>
            {(activeTrip?.days ?? []).map((d) => (
              <button
                key={d.dayIndex}
                type="button"
                className="planner-days__tab"
                aria-pressed={activeDayIndex === d.dayIndex}
                onClick={() => setActiveDayIndex(d.dayIndex)}
              >
                <span
                  className="planner-days__dot trip-day-color"
                  data-day={dayColorIndex(d.dayIndex)}
                  aria-hidden="true"
                />
                {t("planner.days.day", "{n}. Gün").replace("{n}", String(d.dayIndex))}
                <span className="planner-days__count">
                  {allPins.filter((p) => p.dayIndex === d.dayIndex).length}
                </span>
              </button>
            ))}
            <IconButton
              icon="plus"
              size="sm"
              label={t("planner.days.add", "Gün ekle")}
              onClick={() => {
                addDay();
                toast.show({
                  tone: "success",
                  message: t("planner.toast.dayAdded", "Yeni gün eklendi."),
                });
              }}
            />
          </div>
          {allPins.some((p) => p.visited) && (
            <Checkbox
              variant="switch"
              className="planner-list__visited"
              label={t("planner.visited.hide", "Gezilenleri haritada gizle")}
              checked={!planner.showVisitedOnMap}
              onChange={(hide) => planner.setShowVisitedOnMap(!hide)}
            />
          )}
        </section>

        {workspaceMode === "edit" ? (
          <>
            <section
              className="planner-group planner-group--search"
              aria-labelledby="planner-group-search"
            >
              <h3 className="planner-group__title" id="planner-group-search">
                <Icon name="search" size={16} aria-hidden="true" />
                {t("planner.group.search", "Yer ara")}
              </h3>
              <PlaceSearch
                near={searchBias}
                days={(activeTrip?.days ?? []).map((d) => d.dayIndex)}
                activeDayIndex={activeDayIndex}
                onPick={(place) => onFlyToCoords?.(place.lat, place.lng, place.label)}
                onAdd={addPlace}
              />
            </section>
            <section
              className="planner-group planner-group--discover"
              aria-labelledby="planner-group-discover"
            >
              <h3 className="planner-group__title" id="planner-group-discover">
                <Icon name="compass" size={16} aria-hidden="true" />
                {t("planner.group.discover", "Keşfet")}
              </h3>
              <DiscoverPanel
                dayPins={activeDayIndex && activeDayIndex > 0 ? pinsWithTime : allPins}
                allPins={[...allPins, ...generalPins]}
                activeDay={activeDayIndex && activeDayIndex > 0 ? activeDayIndex : undefined}
                mapCenter={mapCenter}
                onAdd={(place, target) =>
                  addPlace(
                    place,
                    target === "trip" ? addTargetFor(activeDayIndex) : { kind: "general" },
                  )
                }
                onFocus={(lat, lng, label) => onFlyToCoords?.(lat, lng, label)}
              />
            </section>
          </>
        ) : (
          <div className="planner-travel">
            <p className="planner-travel__progress-label" id="planner-progress">
              {t("planner.travel.progress", "{done} / {total} durak tamamlandı")
                .replace("{done}", String(visitedCount))
                .replace("{total}", String(pinsWithTime.length))}
            </p>
            <progress
              className="planner-travel__progress"
              aria-labelledby="planner-progress"
              max={Math.max(1, pinsWithTime.length)}
              value={visitedCount}
            />
            <div className="planner-travel__actions">
              <Button
                size="sm"
                variant="secondary"
                iconStart={<Icon name="external" size={16} />}
                onClick={() => {
                  const res = exportTripToGoogleMaps(
                    pinsWithTime.length > 0 ? pinsWithTime : allPins,
                  );
                  toast.show({
                    tone: res.success ? "success" : "warning",
                    message: res.message.replace(/^[^\p{L}\p{N}]+/u, ""),
                  });
                }}
              >
                {t("planner.travel.googleMaps", "Google Haritalar'da aç")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                iconStart={<Icon name="copy" size={16} />}
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("mapsbridge:open-trip-manifesto"))
                }
              >
                {t("planner.travel.summary", "Seyahat özeti (.md)")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                iconStart={<Icon name="locate" size={16} />}
                onClick={() => {
                  const next = pinsWithTime.find((p) => !p.visited);
                  if (next) {
                    setSelectedPinId(next.id);
                    onFlyToPin?.(next);
                  } else {
                    toast.show({
                      tone: "success",
                      message: t("planner.toast.allDone", "Tüm duraklar tamamlandı."),
                    });
                  }
                }}
              >
                {t("planner.travel.next", "Sıradaki durak")}
              </Button>
            </div>
          </div>
        )}

        {selectedMapPoint && (
          <PlaceCard
            eyebrow={t("planner.point.eyebrow", "Haritadan seçildi")}
            place={{
              ...selectedMapPoint,
              label: selectedMapPoint.address.split(",")[0] || t("planner.stop.new", "Yeni durak"),
            }}
            days={(activeTrip?.days ?? []).map((d) => d.dayIndex)}
            activeDayIndex={activeDayIndex}
            onAdd={(target) => {
              addPlace(
                {
                  ...selectedMapPoint,
                  label:
                    selectedMapPoint.address.split(",")[0] || t("planner.stop.new", "Yeni durak"),
                },
                target,
              );
              onClearSelectedMapPoint?.();
            }}
            onClose={() => onClearSelectedMapPoint?.()}
            onFlyToCoords={onFlyToCoords}
            showNearby
            onAddNearby={(place, target) => addPlace(place, target)}
          />
        )}

        {sections.map(({ day, pins, timeline, buffer, fullSuggestion }) => (
          <section
            key={day.dayIndex}
            className="planner-day"
            aria-labelledby={`planner-day-${day.dayIndex}`}
          >
            <div id={`planner-day-${day.dayIndex}`}>
              <DayHeader
                title={t("planner.days.day", "{n}. Gün").replace("{n}", String(day.dayIndex))}
                eyebrow={activeTrip?.destination || undefined}
                stops={pins.length}
                meters={timeline && pins.length > 1 ? timeline.travelMeters : undefined}
                minutes={
                  timeline && pins.length > 1
                    ? timeline.travelMinutes +
                      pins.reduce((sum, p) => sum + (p.durationMinutes ?? 60), 0)
                    : undefined
                }
                bufferRatio={buffer}
                offline={planner.deviceSaved}
              />
            </div>
            {/* U6: gün dolu/boş ise deterministik öneri — ekstra yer ekle (Keşfet'i o güne açar)
                ya da son durağı başka güne kaydır (movePinToDay). Yalnız düzenleme kipinde. */}
            {workspaceMode === "edit" && fullSuggestion && pins.length > 0 && (
              <DayFullBanner
                suggestion={fullSuggestion}
                otherDays={(activeTrip?.days ?? [])
                  .map((d) => d.dayIndex)
                  .filter((d) => d !== day.dayIndex)}
                pins={pins}
                onAddExtra={() => {
                  // Keşfet artık planlama görünümünde kalıcı bölüm; o güne odaklan ve bölüme kaydır.
                  setActiveDayIndex(day.dayIndex);
                  setWorkspaceMode("edit");
                  window.setTimeout(
                    () =>
                      document.getElementById("planner-group-discover")?.scrollIntoView({
                        block: "nearest",
                        behavior: prefersReducedMotion() ? "auto" : "smooth",
                      }),
                    0,
                  );
                }}
                onShift={(pinId, targetDay) => {
                  movePinToDay(pinId, targetDay);
                  const moved = pins.find((p) => p.id === pinId);
                  toast.show({
                    tone: "success",
                    message: t("planner.toast.addedToDay", "“{name}” {day}. güne eklendi.")
                      .replace("{name}", moved?.label ?? t("planner.stop.new", "Yeni durak"))
                      .replace("{day}", String(targetDay)),
                    action: { label: t("planner.undo", "Geri al"), onClick: planner.undo },
                    actionAlsoAt: "planner-toolbar undo IconButton",
                  });
                }}
              />
            )}
            {pins.length === 0 ? (
              <EmptyState
                icon="map"
                level={4}
                title={t("planner.day.empty", "Bu günde henüz durak yok")}
                description={t(
                  "planner.day.emptyHint",
                  "Mekan ara ya da haritaya dokunarak durak ekle.",
                )}
              />
            ) : (
              <MotionProvider>
                <Reorder.Group
                  as="ol"
                  axis="y"
                  className="planner-stops"
                  values={dragOrder?.day === day.dayIndex ? dragOrder.ids : pins.map((p) => p.id)}
                  onReorder={(ids: string[]) => setDragOrder({ day: day.dayIndex, ids })}
                >
                  {(dragOrder?.day === day.dayIndex
                    ? dragOrder.ids
                        .map((id) => pins.find((p) => p.id === id))
                        .filter((p): p is Pin => Boolean(p))
                    : pins
                  ).map((pin, index, list) => {
                    const prev = index > 0 ? list[index - 1] : null;
                    const leg = prev ? activeRouteLegs[legKey(prev.id, pin.id)] : undefined;
                    const meta = DEFAULT_CATEGORY_META[pin.category] ?? DEFAULT_CATEGORY_META.genel;
                    const dragging = dragOrder?.day === day.dayIndex;
                    return (
                      <DraggableStop
                        key={pin.id}
                        id={pin.id}
                        enabled={workspaceMode === "edit" && pins.length > 1}
                        className={cx("planner-stop", pin.visited && "is-visited")}
                        selected={pin.id === selectedPinId}
                        gripLabel={t("planner.stop.drag", "Sürükleyerek sırala")}
                        onDragStart={() =>
                          setDragOrder({ day: day.dayIndex, ids: pins.map((p) => p.id) })
                        }
                        onDragEnd={() =>
                          commitDrag(
                            day.dayIndex,
                            pins.map((p) => p.id),
                          )
                        }
                        connector={
                          prev && !dragging ? (
                            <div className="planner-stops__connector">
                              <Connector
                                mode={connectorMode}
                                minutes={leg ? Math.round(leg.durationSeconds / 60) : undefined}
                                meters={leg ? leg.distanceMeters : undefined}
                              />
                            </div>
                          ) : null
                        }
                      >
                        <StopRow
                          index={index + 1}
                          day={day.dayIndex}
                          time={dragging ? undefined : timeline?.times[index]}
                          name={pin.label}
                          category={CATEGORY_ICON[pin.category] ?? "map"}
                          categoryLabel={meta.label}
                          duration={pin.durationMinutes ?? 60}
                          selected={pin.id === selectedPinId}
                        />
                        {/* Satır altı araç şeridi (direction planner.html): taşı (sürüklemenin
                            klavye alternatifi, R9), ayrıntı, sil; ad tam genişlikte kalır. */}
                        <div className="planner-stop__actions">
                          {workspaceMode === "edit" && (
                            <>
                              <IconButton
                                icon="chevron-up"
                                size="sm"
                                label={`${t("trip.stop.moveUp", "Yukarı taşı")}: ${pin.label}`}
                                disabled={index === 0}
                                onClick={() => moveStop(pins, pin, "up")}
                              />
                              <IconButton
                                icon="chevron"
                                size="sm"
                                label={`${t("trip.stop.moveDown", "Aşağı taşı")}: ${pin.label}`}
                                disabled={index === list.length - 1}
                                onClick={() => moveStop(pins, pin, "down")}
                              />
                            </>
                          )}
                          {workspaceMode === "travel" ? (
                            <Button
                              size="sm"
                              variant={pin.visited ? "secondary" : "ghost"}
                              iconStart={<Icon name="check" size={16} />}
                              aria-pressed={pin.visited}
                              onClick={() => togglePinVisitedAnywhere(pin.id)}
                            >
                              {pin.visited
                                ? t("planner.stop.done", "Tamamlandı")
                                : t("planner.stop.markDone", "Tamamla")}
                            </Button>
                          ) : null}
                          <IconButton
                            icon="info"
                            size="sm"
                            label={`${t("planner.stop.details", "Ayrıntılar")}: ${pin.label}`}
                            onClick={() => {
                              setSelectedPinId(pin.id);
                              setShowDetail(true);
                              onFlyToPin?.(pin);
                            }}
                          />
                          {workspaceMode === "edit" && (
                            <IconButton
                              icon="trash"
                              size="sm"
                              label={`${t("planner.stop.delete", "Durağı sil")}: ${pin.label}`}
                              onClick={() => setPendingDelete(pin)}
                            />
                          )}
                        </div>
                      </DraggableStop>
                    );
                  })}
                </Reorder.Group>
              </MotionProvider>
            )}
          </section>
        ))}

        {/* U4: Kaydedilenler (günsüz yerler) varsayılan kapalı disclosure; başlıkta sayı. Açılınca
            liste görünür; her satırda gün seçimi + "Güne ekle" (sürükle-bırakın klavye alternatifi). */}
        <details className="planner-pool" aria-labelledby="planner-pool-title">
          <summary className="planner-pool__summary">
            <h3 id="planner-pool-title" className="planner-pool__title">
              <Icon name="bookmark" size={16} aria-hidden="true" />
              {t("planner.pool.title", "Kayıtlı yerler ({n})").replace(
                "{n}",
                String(generalPins.length),
              )}
            </h3>
            <Icon name="chevron" className="planner-pool__chevron" />
          </summary>
          {generalPins.length === 0 ? (
            <p className="planner-pool__empty">
              {t(
                "planner.pool.empty",
                "Gün seçmeden eklediğin yerler burada bekler; istediğin güne buradan taşırsın.",
              )}
            </p>
          ) : (
            <ul className="planner-pool__list">
              {generalPins.map((p) => (
                <PoolRow
                  key={p.id}
                  pin={p}
                  days={(activeTrip?.days ?? []).map((d) => d.dayIndex)}
                  defaultDay={targetDay}
                  onAssign={(day) => {
                    assignPinToTrip(p.id, activeTripId, day);
                    toast.show({
                      tone: "success",
                      message: t("planner.toast.addedToDay", "“{name}” {day}. güne eklendi.")
                        .replace("{name}", p.label)
                        .replace("{day}", String(day)),
                    });
                  }}
                />
              ))}
            </ul>
          )}
        </details>

        {footer}
        <Accordion
          items={[
            {
              id: "planner-shortcuts",
              summary: t("planner.shortcuts.title", "Klavye kısayolları"),
              content: (
                <ul className="planner-shortcuts__list">
                  {SHORTCUT_HELP.map((s) => (
                    <li key={s.id} className="planner-shortcuts__item">
                      <span>{t(`planner.shortcuts.${s.id}`, s.label)}</span>
                      <kbd className="planner-shortcuts__key">{s.keys}</kbd>
                    </li>
                  ))}
                  <li className="planner-shortcuts__item planner-shortcuts__item--note">
                    {t(
                      "planner.shortcuts.scope",
                      "Tek tuşlu kısayollar (/ ve N) yalnız plan paneli ya da harita odaktayken çalışır.",
                    )}
                  </li>
                </ul>
              ),
            },
          ]}
        />
        <p className="planner-list__note">
          {t(
            "planner.note.osrm",
            "Süre ve mesafeler OSRM yol ağı tahminidir; hesaplanamayan bacaklar boş kalır.",
          )}
        </p>

        <ConfirmDialog
          open={pendingDelete !== null}
          title={t("planner.stop.deleteTitle", "Durak silinsin mi?")}
          consequence={t("planner.stop.deleteBody", "“{name}” rotadan çıkarılır.").replace(
            "{name}",
            pendingDelete?.label ?? "",
          )}
          confirmLabel={t("planner.stop.delete", "Durağı sil")}
          onConfirm={async () => {
            if (!pendingDelete) return;
            deletePinAnywhere(pendingDelete.id);
            announcePinDeleted(planner, toast, t, pendingDelete);
          }}
          onClose={() => setPendingDelete(null)}
        />
      </div>
    </>
  );
}

/**
 * P8 sürüklenebilir durak satırı (lib/motion Reorder.Item). Sürükleme yalnız tutamaktan başlar
 * (düğmeler normal çalışır); tutamak dekoratiftir, klavye alternatifi taşı düğmeleri + Alt+↑/↓.
 * Azaltılmış harekette MotionProvider düzen animasyonunu kapatır.
 */
function DraggableStop({
  id,
  enabled,
  className,
  selected,
  gripLabel,
  connector,
  onDragStart,
  onDragEnd,
  children,
}: {
  id: string;
  enabled: boolean;
  className?: string;
  selected: boolean;
  gripLabel: string;
  connector: ReactNode;
  onDragStart: () => void;
  onDragEnd: () => void;
  children: ReactNode;
}) {
  const controls = useDragControls();
  const [dragging, setDragging] = useState(false);
  return (
    <Reorder.Item
      as="li"
      value={id}
      dragListener={false}
      dragControls={controls}
      drag={enabled ? "y" : false}
      className={className}
      data-stop-id={id}
      data-selected={selected || undefined}
      data-dragging={dragging || undefined}
      onDragStart={() => {
        setDragging(true);
        onDragStart();
      }}
      onDragEnd={() => {
        setDragging(false);
        onDragEnd();
      }}
    >
      {connector}
      <div className="planner-stop__row">
        {enabled && (
          <span
            className="planner-stop__grip"
            title={gripLabel}
            aria-hidden="true"
            onPointerDown={(e) => controls.start(e)}
          >
            <Icon name="grip" size={16} />
          </span>
        )}
        {children}
      </div>
    </Reorder.Item>
  );
}

/** Kaydedilenler satırı: gün menüsü + "Güne ekle" (P7; sürükle-bırakın klavye alternatifi). */
function PoolRow({
  pin,
  days,
  defaultDay,
  onAssign,
}: {
  pin: Pin;
  days: number[];
  defaultDay: number;
  onAssign: (day: number) => void;
}) {
  const { t } = useLocale();
  const options = days.length > 0 ? days : [1];
  const [day, setDay] = useState(options.includes(defaultDay) ? defaultDay : options[0]);
  return (
    <li className="planner-pool__item">
      <Icon name={CATEGORY_ICON[pin.category] ?? "map"} size={20} />
      <span className="planner-pool__text">
        <span className="planner-pool__name">{pin.label}</span>
        {pin.address && <span className="planner-pool__address">{pin.address}</span>}
      </span>
      <span className="planner-pool__assign">
        <Select
          aria-label={t("planner.pool.dayFor", "{name} için gün").replace("{name}", pin.label)}
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
        >
          {options.map((d) => (
            <option key={d} value={d}>
              {t("planner.days.day", "{n}. Gün").replace("{n}", String(d))}
            </option>
          ))}
        </Select>
        <Button size="sm" variant="secondary" onClick={() => onAssign(day)}>
          {t("planner.pool.add", "Güne ekle")}
        </Button>
      </span>
    </li>
  );
}

/**
 * U6: gün dolu/boş önerisi. addExtra → "buraya ekstra bir yer ekle" (Keşfet'i bu güne açar);
 * shiftStop → bir durağı başka güne kaydır (movePinToDay). Öneri deterministik planner-logic'ten
 * gelir (I2); burada yalnız sunulur. R9: hareket yok; başka gün yoksa kaydırma kontrolü çizilmez.
 */
function DayFullBanner({
  suggestion,
  otherDays,
  pins,
  onAddExtra,
  onShift,
}: {
  suggestion: DayFullSuggestion;
  otherDays: number[];
  pins: Pin[];
  onAddExtra: () => void;
  onShift: (pinId: string, targetDay: number) => void;
}) {
  const { t } = useLocale();
  const shiftPin =
    suggestion.kind === "shiftStop" ? pins.find((p) => p.id === suggestion.pinId) : undefined;
  const [targetDay, setTargetDay] = useState<number>(otherDays[0] ?? 0);

  if (suggestion.kind === "addExtra") {
    return (
      <Alert
        tone="info"
        className="planner-day__suggest"
        title={t("planner.dayFull.addTitle", "Bu gün boş görünüyor")}
        action={
          <Button size="sm" variant="secondary" onClick={onAddExtra}>
            {t("planner.dayFull.addExtra", "Bu güne yakından yer ekle")}
          </Button>
        }
      >
        {t("planner.dayFull.addBody", "Keşfet'ten bu güne yakındaki yerleri ekleyebilirsin.")}
      </Alert>
    );
  }

  // shiftStop: başka gün yoksa kaydıracak yer yok → yalnız bilgi + ekstra ekleme yönlendirmesi.
  if (otherDays.length === 0 || !shiftPin) {
    return (
      <Alert
        tone="warning"
        className="planner-day__suggest"
        title={t("planner.dayFull.fullTitle", "Bu gün oldukça dolu")}
      >
        {t(
          "planner.dayFull.fullBodyNoDay",
          "Rahat bir tempo için yeni bir gün ekleyip durak kaydırabilirsin.",
        )}
      </Alert>
    );
  }

  return (
    <Alert
      tone="warning"
      className="planner-day__suggest"
      title={t("planner.dayFull.fullTitle", "Bu gün oldukça dolu")}
      action={
        <span className="planner-day__suggest-actions">
          <Select
            size="sm"
            aria-label={t("planner.dayFull.shiftDayFor", "{name} için hedef gün").replace(
              "{name}",
              shiftPin.label,
            )}
            value={targetDay}
            onChange={(e) => setTargetDay(Number(e.target.value))}
          >
            {otherDays.map((d) => (
              <option key={d} value={d}>
                {t("planner.days.day", "{n}. Gün").replace("{n}", String(d))}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="secondary" onClick={() => onShift(shiftPin.id, targetDay)}>
            {t("planner.dayFull.shiftStop", "Durağı kaydır")}
          </Button>
        </span>
      }
    >
      {t(
        "planner.dayFull.fullBody",
        "“{name}” durağını başka güne kaydırarak tamponu artırabilirsin.",
      ).replace("{name}", shiftPin.label)}
    </Alert>
  );
}

/**
 * Mekan/adres arama (bug 4): yazarken 400 ms sonra (≥3 karakter) öneri; otomatik yeniden deneme
 * yok. Durum makinesi `place-search-logic`: hata "Sonuç bulunamadı" değil `role="alert"` uyarısı
 * + "Tekrar dene"; yüklenirken iskelet satırları; koordinat yapıştırılınca "Bu koordinata pin
 * ekle"; son aramalar (sahip bazlı, en çok 8).
 */
function PlaceSearch({
  near,
  days,
  activeDayIndex,
  onPick,
  onAdd,
}: {
  near?: { lat: number; lng: number };
  days: number[];
  activeDayIndex: number | null | undefined;
  onPick: (place: Place) => void;
  onAdd: (place: Place, target: AddTarget) => void;
}) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [search, dispatch] = useReducer(searchReducer<Place>, initialSearchState<Place>());
  const [picked, setPicked] = useState<Place | null>(null);
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const request = useRef(0);
  // review-final #3: bekleyen debounce zamanlayıcısı ve son gönderilen sorgu; Enter debounce'u
  // iptal eder, aynı sorgu ikinci kez gönderilmez (bir sorgu = bir kota birimi).
  const debounce = useRef<number | undefined>(undefined);
  const lastSent = useRef<SentSearch | null>(null);
  useEffect(() => setRecent(parseRecent(readPlannerStore(PLANNER_RECENT_SEARCHES_KEY))), []);
  const coords = parseCoordinates(query);
  const run = async (q: string) => {
    if (!shouldSendSearch(lastSent.current, q)) return;
    const sent: SentSearch = { key: searchKey(q), status: "loading" };
    lastSent.current = sent;
    const id = ++request.current;
    dispatch({ type: "start", requestId: id });
    try {
      const places: GeocodedPlace[] = await searchPlaces(q, 5, { near });
      const list = places.slice(0, 5).map((p) => ({
        lat: p.lat,
        lng: p.lng,
        address: p.address,
        label: p.label || p.address.split(",")[0],
        placeId: p.placeId,
        provider: p.provider,
      }));
      sent.status = list.length > 0 ? "results" : "empty";
      dispatch({ type: "success", requestId: id, results: list });
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.warn("Arama başarısız", err);
      sent.status = "error";
      dispatch({ type: "failure", requestId: id });
    }
  };
  useEffect(() => {
    if (googleMapsEnabled) return;
    const q = query.trim();
    if (q.length < SEARCH_MIN || parseCoordinates(q)) {
      request.current++;
      lastSent.current = null;
      dispatch({ type: "reset" });
      return;
    }
    const timer = window.setTimeout(() => void run(q), SEARCH_DEBOUNCE_MS);
    debounce.current = timer;
    return () => window.clearTimeout(timer);
  }, [query]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (googleMapsEnabled) {
      document.getElementById("google-place-query")?.focus();
      return;
    }
    const q = query.trim();
    window.clearTimeout(debounce.current);
    if (q.length >= SEARCH_MIN && !parseCoordinates(q)) void run(q);
  };
  const pick = (place: Place) => {
    setPicked(place);
    request.current++;
    lastSent.current = null;
    dispatch({ type: "reset" });
    const next = pushRecent(recent, {
      label: place.label,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    });
    setRecent(next);
    writePlannerStore(PLANNER_RECENT_SEARCHES_KEY, JSON.stringify(next));
    onPick(place);
  };
  const results = search.status === "results" ? search.results : [];
  return (
    <div className="planner-search">
      <form className="planner-search__form" role="search" onSubmit={submit} noValidate>
        {/* Hap arama (direction planner.html): görünür kısa etiket (§10), başta arama ikonu;
            yazarken 400 ms sonra kendiliğinden arar, Enter hemen gönderir. */}
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <Field
              id="planner-search-input"
              className="planner-search__field"
              label={t("planner.search.labelShort", "Yer ara")}
              hint={t(
                "planner.search.hintShort",
                "En az 3 harf; haritaya dokunarak da ekleyebilirsin.",
              )}
            >
              {(ids) => (
                <Input
                  {...ids}
                  type="search"
                  shape="pill"
                  iconStart="search"
                  enterKeyHint="search"
                  placeholder={t("planner.search.placeholder", "Mekan, adres ya da koordinat")}
                  value={query}
                  maxLength={120}
                  autoComplete="off"
                  onChange={(e) => setQuery(e.target.value)}
                />
              )}
            </Field>
          </div>
          {query.trim().length > 0 && (
            <IconButton
              icon="x"
              size="sm"
              variant="ghost"
              label={t("ui.clear", "Temizle")}
              onClick={() => {
                setQuery("");
                dispatch({ type: "reset" });
              }}
            />
          )}
        </div>
      </form>
      <div role="status" className="planner-search__status">
        {search.status === "empty" && t("planner.search.empty", "Sonuç bulunamadı.")}
        {/* review-pages: arama sürerken görünür durum metni (Ara düğmesinin spinner'ı kalktı). */}
        {search.status === "loading" && t("planner.search.loading", "Aranıyor…")}
      </div>
      {coords && (
        <Button
          size="sm"
          variant="secondary"
          iconStart={<Icon name="locate" size={16} />}
          onClick={() =>
            pick({
              lat: coords.lat,
              lng: coords.lng,
              label: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
              address: t("planner.search.coordsAddress", "Koordinat: {lat}, {lng}")
                .replace("{lat}", coords.lat.toFixed(5))
                .replace("{lng}", coords.lng.toFixed(5)),
            })
          }
        >
          {t("planner.search.coords", "Bu koordinata pin ekle")}
        </Button>
      )}
      {search.status === "error" && (
        <Alert
          tone="warning"
          live="assertive"
          action={
            <Button size="sm" variant="secondary" onClick={() => void run(query.trim())}>
              {t("ui.retry", "Tekrar dene")}
            </Button>
          }
        >
          {t("planner.search.error", "Arama şu an yanıt vermiyor.")}
        </Alert>
      )}
      {search.status === "loading" && (
        <ul className="planner-search__results" aria-hidden="true">
          {[0, 1, 2].map((n) => (
            <li key={n} className="planner-search__skeleton">
              <Skeleton variant="list-row" />
            </li>
          ))}
        </ul>
      )}
      {results.length > 0 && (
        <ul
          className="planner-search__results"
          aria-label={t("planner.search.results", "Arama sonuçları")}
        >
          {results.map((r) => (
            <li key={`${r.lat},${r.lng},${r.label}`}>
              <button type="button" className="planner-search__result" onClick={() => pick(r)}>
                <Icon name="map" size={16} />
                <span className="planner-search__result-text">
                  <span className="planner-search__result-name">{r.label}</span>
                  {r.address && <span className="planner-search__result-address">{r.address}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!query.trim() && !picked && recent.length > 0 && (
        <div className="planner-search__recent">
          <p className="planner-search__recent-title" id="planner-recent-title">
            {t("planner.search.recent", "Son aramalar")}
          </p>
          <ul className="planner-search__results" aria-labelledby="planner-recent-title">
            {recent.map((r) => (
              <li key={`${r.lat},${r.lng},${r.label}`}>
                <button type="button" className="planner-search__result" onClick={() => pick(r)}>
                  <Icon name="clock" size={16} />
                  <span className="planner-search__result-text">
                    <span className="planner-search__result-name">{r.label}</span>
                    {r.address && (
                      <span className="planner-search__result-address">{r.address}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {picked && (
        <PlaceCard
          eyebrow={t("planner.search.found", "Arama sonucu")}
          place={picked}
          days={days}
          activeDayIndex={activeDayIndex}
          onAdd={(target) => {
            onAdd(picked, target);
            setPicked(null);
            setQuery("");
          }}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  );
}
/**
 * U3: ekleme kartı. Tek + eylemi, yanındaki gün <Select> ile seçilen hedefe (gezinin bir günü ya
 * da Kaydedilenler) ekler. Varsayılan aktif gün (>0), yoksa Kaydedilenler (defaultAddTargetValue).
 */
function PlaceCard({
  eyebrow,
  place,
  days,
  activeDayIndex,
  onAdd,
  onClose,
  onFlyToCoords,
  showNearby,
  onAddNearby,
}: {
  eyebrow: string;
  place: Place;
  days: number[];
  activeDayIndex: number | null | undefined;
  onAdd: (target: AddTarget) => void;
  onClose: () => void;
  /** Yakın yerden "haritada göster"; map-point kartında bağlanır. */
  onFlyToCoords?: (lat: number, lng: number, label: string) => void;
  /** U1: haritadan seçilen noktada "yakında ne var" listesini de göster. */
  showNearby?: boolean;
  /** Yakın yer ekleme: kartı kapatmaz, doğrudan rotaya/kayıtlıya ekler. */
  onAddNearby?: (place: NearbyAddPlace, target: AddTarget) => void;
}) {
  const { t } = useLocale();
  const [target, setTarget] = useState(() => defaultAddTargetValue(activeDayIndex, days));
  return (
    <div className="planner-place" data-surface="default">
      <div className="planner-place__head">
        <p className="planner-place__eyebrow">{eyebrow}</p>
        <IconButton icon="x" size="sm" label={t("ui.close", "Kapat")} onClick={onClose} />
      </div>
      <p className="planner-place__name">{place.label}</p>
      <p className="planner-place__address">{place.address}</p>
      <div className="planner-place__actions">
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
          onClick={() => onAdd(parseAddTarget(target, days))}
        >
          {t("planner.place.add", "Ekle")}
        </Button>
      </div>
      {showNearby && onAddNearby && (
        <NearbyList
          lat={place.lat}
          lng={place.lng}
          days={days}
          activeDayIndex={activeDayIndex}
          onFocus={onFlyToCoords}
          onAdd={onAddNearby}
        />
      )}
    </div>
  );
}

/** Seçili durak ayrıntısı + düzenleme (mevcut özellikler; emoji yerine Icon, primitive'ler). */
function PinDetail({
  planner,
  pin,
  mode,
  days,
  activeDayIndex,
  onAddNearby,
  onFlyToCoords,
  onBack,
  onRequireAuth,
}: {
  planner: Planner;
  pin: Pin;
  mode: PlannerMode;
  days: number[];
  activeDayIndex: number | null | undefined;
  onAddNearby: (place: NearbyAddPlace, target: AddTarget) => void;
  onFlyToCoords?: (lat: number, lng: number, label: string) => void;
  onBack: () => void;
  onRequireAuth: (reason: "ai" | "save") => void;
}) {
  const { t } = useLocale();
  const toast = useToast();
  const { trips, generalPins, updatePinAnywhere, deletePinAnywhere, togglePinVisitedAnywhere } =
    planner;
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(pin.label);
  const [category, setCategory] = useState<PinCategory>(pin.category);
  const [note, setNote] = useState(pin.note ?? "");
  const [duration, setDuration] = useState(pin.durationMinutes ?? 60);
  const [tripId, setTripId] = useState(pin.tripId ?? "general");
  const [dayIndex, setDayIndex] = useState(pin.dayIndex || 0);
  const [photoUrl, setPhotoUrl] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const meta = DEFAULT_CATEGORY_META[pin.category] ?? DEFAULT_CATEGORY_META.genel;
  const inPool = generalPins.some((p) => p.id === pin.id || p.label === pin.label);
  const trip = pin.tripId ? trips.find((x) => x.id === pin.tripId) : null;
  const photos = pin.photos?.length ? pin.photos : pin.photo ? [pin.photo] : [];

  useEffect(() => {
    setEditing(false);
    setLabel(pin.label);
    setCategory(pin.category);
    setNote(pin.note ?? "");
    setDuration(pin.durationMinutes ?? 60);
    setTripId(pin.tripId ?? "general");
    setDayIndex(pin.dayIndex || 0);
    setAnswer(null);
    setQuestion("");
  }, [pin.id]);

  const addPhoto = (src: string) => {
    if (!src.trim()) return;
    const current = [...photos];
    if (!current.includes(src)) current.push(src);
    updatePinAnywhere(pin.id, { photo: current[0], photos: current });
    setPhotoUrl("");
    toast.show({ tone: "success", message: t("planner.toast.photoAdded", "Fotoğraf eklendi.") });
  };

  // "AI'ya sor": I1 — soru mekan verisiyle (ad/adres/kategori/koordinat) beslenir; uç kendi
  // grounding katmanını uygular. Misafirde ağ çağrısı yok, AuthGate (design §6.3).
  const ask = async () => {
    const q = question.trim();
    if (!q) return;
    if (mode === "guest") {
      onRequireAuth("ai");
      return;
    }
    setAsking(true);
    setAnswer(null);
    try {
      const context = `Mekan: ${pin.label}${pin.address ? ` (${pin.address})` : ""}; Kategori: ${meta.label}; Koordinat: ${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}`;
      const res = await apiFetch<MultiAgentResponse>("/ai/route-planner", {
        method: "POST",
        timeoutMs: 35000,
        body: JSON.stringify({
          prompt: `${context}. Soru: ${q}`,
          requestId: crypto.randomUUID(),
          conversationId: `ask-${pin.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 30)}-${Date.now()}`,
          conversationState: {
            version: 1,
            context: { planningRequested: false },
            messages: [{ role: "user", content: q }],
          },
        }),
      });
      setAnswer(
        res?.orchestratorSummary?.trim() ||
          t("planner.ask.noData", "Bu mekan için şu an yeterli veri bulamadım."),
      );
    } catch {
      setAnswer(t("planner.ask.failed", "Asistana ulaşılamadı. Biraz sonra tekrar dene."));
    } finally {
      setAsking(false);
    }
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    updatePinAnywhere(pin.id, {
      label: label.trim() || pin.label,
      category,
      note: note.trim() || undefined,
      durationMinutes: Number(duration) || 60,
    });
    if (tripId === "general") {
      if (pin.tripId) planner.movePinToGeneral(pin.id);
    } else {
      planner.assignPinToTrip(pin.id, tripId, dayIndex);
    }
    setEditing(false);
    toast.show({ tone: "success", message: t("planner.toast.saved", "Değişiklikler kaydedildi.") });
  };

  return (
    <div className="planner-detail">
      <div className="planner-detail__nav">
        <Button
          size="sm"
          variant="ghost"
          iconStart={<Icon name="chevron-left" size={16} />}
          onClick={onBack}
        >
          {t("planner.detail.back", "Listeye dön")}
        </Button>
      </div>
      <div className="planner-detail__head">
        <p className="planner-detail__category">
          <Icon name={CATEGORY_ICON[pin.category] ?? "map"} size={16} />
          {meta.label}
        </p>
        <h3 className="planner-detail__name">{pin.label}</h3>
        {pin.address && <p className="planner-detail__address">{pin.address}</p>}
        <div className="planner-detail__badges">
          <Badge>
            <Icon name="clock" size={16} />
            {t("planner.detail.duration", "{n} dk planlı").replace(
              "{n}",
              String(pin.durationMinutes ?? 60),
            )}
          </Badge>
          <Badge>
            <Icon name="route" size={16} />
            {trip
              ? t("planner.detail.inTrip", "{trip} · {n}. Gün")
                  .replace("{trip}", trip.title)
                  .replace("{n}", String(pin.dayIndex))
              : t("planner.detail.inPool", "Kayıtlı yerler")}
          </Badge>
          {pin.isLocked && pin.fixedTime && (
            <Badge>
              <Icon name="lock" size={16} />
              {pin.fixedTime}
            </Badge>
          )}
        </div>
      </div>
      <div className="planner-detail__actions">
        <Button
          size="sm"
          variant={pin.visited ? "secondary" : "ghost"}
          iconStart={<Icon name="check" size={16} />}
          aria-pressed={pin.visited}
          onClick={() => togglePinVisitedAnywhere(pin.id)}
        >
          {pin.visited
            ? t("planner.stop.done", "Tamamlandı")
            : t("planner.stop.markDone", "Tamamla")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          iconStart={<Icon name="bookmark" size={16} />}
          disabled={inPool}
          onClick={() => {
            planner.addPinToGeneral({
              label: pin.label,
              lat: pin.lat,
              lng: pin.lng,
              category: pin.category,
              address: pin.address,
              note: pin.note,
              group: "Genel",
              durationMinutes: pin.durationMinutes,
              dayIndex: 0,
              visited: false,
            });
            toast.show({
              tone: "success",
              message: t("planner.toast.addedToPool", "“{name}” kayıtlı yerlere eklendi.").replace(
                "{name}",
                pin.label,
              ),
            });
          }}
        >
          {inPool
            ? t("planner.detail.inPoolDone", "Kayıtlı")
            : t("planner.place.addToPool", "Kayıtlı yerlere ekle")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          iconStart={<Icon name="edit" size={16} />}
          onClick={() => setEditing((v) => !v)}
        >
          {t("planner.detail.edit", "Düzenle")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          iconStart={<Icon name="qr" size={16} />}
          onClick={() => setShareOpen(true)}
        >
          {t("planner.pinShare.action", "Bu durağı paylaş")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          iconStart={<Icon name="trash" size={16} />}
          onClick={() => setConfirmDelete(true)}
        >
          {t("planner.stop.delete", "Durağı sil")}
        </Button>
      </div>

      <PinShareModal
        open={shareOpen}
        target={{ lat: pin.lat, lng: pin.lng, label: pin.label }}
        onClose={() => setShareOpen(false)}
      />

      {editing ? (
        <form className="planner-detail__form" onSubmit={save} noValidate>
          <Field label={t("planner.edit.name", "Mekan adı")} required>
            {(ids) => (
              <Input
                {...ids}
                value={label}
                maxLength={120}
                onChange={(e) => setLabel(e.target.value)}
              />
            )}
          </Field>
          <Field label={t("planner.edit.category", "Kategori")}>
            {(ids) => (
              <Select
                {...ids}
                value={category}
                onChange={(e) => setCategory(e.target.value as PinCategory)}
              >
                {Object.entries(DEFAULT_CATEGORY_META).map(([key, m]) => (
                  <option key={key} value={key}>
                    {m.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("planner.edit.duration", "Planlanan süre (dk)")}>
            {(ids) => (
              <Input
                {...ids}
                type="number"
                inputMode="numeric"
                min={5}
                max={600}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            )}
          </Field>
          <Field label={t("planner.edit.trip", "Rota")}>
            {(ids) => (
              <Select {...ids} value={tripId} onChange={(e) => setTripId(e.target.value)}>
                <option value="general">{t("planner.detail.inPool", "Kayıtlı yerler")}</option>
                {trips.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {tripId !== "general" && (
            <Field label={t("planner.edit.day", "Gün")}>
              {(ids) => (
                <Select
                  {...ids}
                  value={dayIndex}
                  onChange={(e) => setDayIndex(Number(e.target.value))}
                >
                  <option value={0}>{t("planner.edit.noDay", "Günsüz")}</option>
                  {trips
                    .find((x) => x.id === tripId)
                    ?.days.map((d) => (
                      <option key={d.dayIndex} value={d.dayIndex}>
                        {t("planner.days.day", "{n}. Gün").replace("{n}", String(d.dayIndex))}
                      </option>
                    ))}
                </Select>
              )}
            </Field>
          )}
          <Field label={t("planner.edit.note", "Not")}>
            {(ids) => (
              <Textarea
                {...ids}
                rows={3}
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </Field>
          <div className="planner-detail__form-actions">
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              {t("ui.cancel", "Vazgeç")}
            </Button>
            <Button type="submit" variant="primary">
              {t("planner.edit.save", "Kaydet")}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <section className="planner-detail__section" aria-labelledby="planner-detail-note">
            <h4 id="planner-detail-note" className="planner-detail__title">
              {t("planner.detail.note", "Not")}
            </h4>
            {pin.note ? (
              <p className="planner-detail__text">{pin.note}</p>
            ) : (
              <p className="planner-detail__muted">
                {t("planner.detail.noNote", "Henüz not yok.")}
              </p>
            )}
          </section>

          <PlaceFacts pin={pin} />

          <NearbyList
            lat={pin.lat}
            lng={pin.lng}
            days={days}
            activeDayIndex={activeDayIndex}
            onFocus={onFlyToCoords}
            onAdd={onAddNearby}
          />

          <section className="planner-detail__section" aria-labelledby="planner-detail-ask">
            <h4 id="planner-detail-ask" className="planner-detail__title">
              {t("planner.ask.title", "Bu mekan hakkında sor")} <CostBadge cost={1} />
            </h4>
            <form
              className="planner-detail__ask"
              onSubmit={(e) => {
                e.preventDefault();
                void ask();
              }}
            >
              <Field
                label={t("planner.ask.label", "Sorun")}
                hint={t("planner.ask.hint", "Yanıtlar mevcut mekan verisine dayanır.")}
              >
                {(ids) => (
                  <Input
                    {...ids}
                    value={question}
                    maxLength={300}
                    disabled={asking}
                    onChange={(e) => setQuestion(e.target.value)}
                  />
                )}
              </Field>
              <Button
                type="submit"
                variant="secondary"
                loading={asking}
                disabled={!question.trim()}
              >
                {t("planner.ask.submit", "Sor")}
              </Button>
            </form>
            <div role="status" className="planner-detail__answer">
              {answer}
            </div>
          </section>

          <section className="planner-detail__section" aria-labelledby="planner-detail-photos">
            <h4 id="planner-detail-photos" className="planner-detail__title">
              {t("planner.photos.title", "Fotoğraflar")}
            </h4>
            {photos.length > 0 ? (
              <ul className="planner-detail__photos">
                {photos.map((url, i) => (
                  <li key={`${i}-${url.slice(0, 24)}`} className="planner-detail__photo">
                    <img
                      src={url}
                      alt={`${pin.label} ${i + 1}`}
                      className="planner-detail__photo-img"
                    />
                    <IconButton
                      icon="x"
                      size="sm"
                      variant="secondary"
                      label={t("planner.photos.remove", "Fotoğrafı kaldır")}
                      onClick={() => {
                        const next = photos.filter((_, idx) => idx !== i);
                        updatePinAnywhere(pin.id, {
                          photo: next[0] || undefined,
                          photos: next.length ? next : undefined,
                        });
                      }}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="planner-detail__muted">
                {t("planner.photos.empty", "Fotoğraf eklenmemiş.")}
              </p>
            )}
            <div className="planner-detail__photo-add">
              <label className="planner-detail__upload">
                <Icon name="image" size={16} />
                <span>{t("planner.photos.upload", "Cihazdan yükle")}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="ui-visually-hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      if (typeof reader.result === "string") addPhoto(reader.result);
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              <form
                className="planner-detail__photo-url"
                onSubmit={(e) => {
                  e.preventDefault();
                  addPhoto(photoUrl.trim());
                }}
              >
                <Field label={t("planner.photos.url", "Görsel bağlantısı")}>
                  {(ids) => (
                    <Input
                      {...ids}
                      type="url"
                      inputMode="url"
                      value={photoUrl}
                      placeholder="https://"
                      onChange={(e) => setPhotoUrl(e.target.value)}
                    />
                  )}
                </Field>
                <Button type="submit" size="sm" variant="secondary" disabled={!photoUrl.trim()}>
                  {t("planner.photos.add", "Ekle")}
                </Button>
              </form>
            </div>
          </section>

          {googleMapsEnabled && (
            <section className="planner-detail__section">
              <GooglePlaceInfo
                placeId={pin.googlePlaceId}
                label={pin.label}
                lat={pin.lat}
                lng={pin.lng}
                onLink={(linked) => updatePinAnywhere(pin.id, { googlePlaceId: linked })}
              />
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={t("planner.stop.deleteTitle", "Durak silinsin mi?")}
        consequence={t("planner.stop.deleteBody", "“{name}” rotadan çıkarılır.").replace(
          "{name}",
          pin.label,
        )}
        confirmLabel={t("planner.stop.delete", "Durağı sil")}
        onConfirm={async () => {
          deletePinAnywhere(pin.id);
          announcePinDeleted(planner, toast, t, pin);
          onBack();
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
