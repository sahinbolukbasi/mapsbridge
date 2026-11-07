import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { tripStore, type ActiveRoute, type TripStop } from "../services/tripStore";
import { trainingService } from "../services/api";
import { storage } from "../services/storage";
import { ScreenTourModal } from "../components/ScreenTourModal";
import {
  AuthGate,
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  Connector,
  DayHeader,
  IconButton,
  ModalFrame,
  Notice,
  SafeArea,
  SegmentedControl,
  Skeleton,
  StopRow,
  TextField,
  Txt,
  dayColor,
  isReducedMotion,
  mapLabel,
  useToast,
  type AuthGateReason,
} from "../ui";
import {
  buildLeafletHtml,
  legsKeyOf,
  type MapPoolPayload,
  type MapPopupPayload,
  type MapStopPayload,
} from "../map/leaflet-html";
import { lookupPoint, searchPlaces, type PlaceCandidate } from "../map/places";
import {
  initialSearchState,
  parseCoordinates,
  parseRecent,
  pushRecent,
  searchReducer,
  type RecentSearch,
  type SearchEvent,
  type SearchState,
} from "../trip/place-search-logic";
import { pinPopupModel } from "../trip/pin-popup";
import { stopToPin } from "../trip/models";
import { centroid } from "../trip/discovery-rank";
import { DiscoverPanel, type DiscoverAdd } from "../components/DiscoverPanel";
import { optimizeStopOrder } from "../trip/optimize";
import { categoryIcon } from "../trip/category";
import { spansSeveralDays, stopDay } from "../trip/days";
import { tr } from "../i18n/ui";
import { fontFamily, tokens } from "../theme";

// Rota görünümü (design §6.3, §9 "Planlayıcı", J2; kararlar S7, S19; I1/I2/I12): harita WebView
// (erişilebilir adı değişmedi: mapLabel) + native BottomSheet (DayHeader, StopRow, Connector).
// - Bağlantı süre/mesafeleri YALNIZCA OSRM yanıtından; yoksa "Süre hesaplanamadı". tripStore'un
//   yazdığı `walkTimeFromPrev` / `distanceFromPrev` metinleri tahmin olduğu için gösterilmez.
// - Sürükle yerine erişilebilir "Yukarı/Aşağı taşı" düğmeleri (R9).
// - "Rotayı optimize et" ücretsiz istemci sıralaması (S19): kredi rozeti yok, misafir de kullanır.
// - Misafir: rota yalnız cihazda (tripStore misafir sahibi); "Paylaş", "Asistana sor" ve kayıt
//   AuthGate sheet açar; misafirde etkileşim telemetrisi yazılmaz.
// - Çevrimdışı (I12): durak listesi tripStore/AsyncStorage'dan gelir, harita yüklenemese de kalır;
//   Leaflet/karo yüklenemezse WebView MAP_LOAD_FAILED gönderir ve uyarı görünür.
// - Çok günlü AI rotası (durak `time` öneki "N. gün"): her durak kendi gün rengi ve zaman metniyle
//   görünür; tek gün başlığı ve günler arası toplam süre/mesafe gösterilmez.
// - Increment 4.4 (web paritesi): arama yer proxy'sinden (`/ai/chat?op=places`; hata "sonuç yok"
//   değil, "Tekrar dene"), koordinat yapıştırma, son aramalar (place-search-logic kopyası); pine
//   dokununca popup (pin-popup modeli, yalnız durak kaydı, I1/I10) "Ayrıntı" / "Gezildi"; gezildi
//   pini haritada kalır (kesik kenar + onay); günsüz yer → Kaydedilenler; Keşfet (discovery-rank,
//   deterministik, I2/I8). Geri bildirim Toast ile; silmede "Geri al".
export interface MapScreenProps {
  focusedStopId?: string | null;
  onClearFocus?: () => void;
  /** Rotalarım listesine dön (Planla yığınında pop). */
  onOpenPlan?: () => void;
  onOpenAi?: () => void;
  guest?: boolean;
  onRequireAuth?: (mode: "register" | "login") => void;
}

type Legs = { key: string; legs: Array<{ duration: number; distance: number }> | null };
type Search = SearchState<PlaceCandidate>;
const RECENT_KEY = "mb_recent_searches";
const reduceSearch = (state: Search, event: SearchEvent<PlaceCandidate>) =>
  searchReducer(state, event);

/** Popup metinleri (web PinPopupContent ile aynı alanlar ve anahtarlar). */
export function popupPayload(stop: TripStop, day: number | undefined): MapPopupPayload {
  const model = pinPopupModel(stopToPin(stop, day ?? 0));
  return {
    category: stop.category || tr("native.place.defaultCategory"),
    ...(model.day !== undefined ? { day: tr("planner.days.day", { n: model.day }) } : {}),
    title: model.title || stop.name,
    ...(model.address ? { address: model.address } : {}),
    ...(model.noteLine ? { note: model.noteLine } : {}),
    ...(model.visited ? { visited: tr("planner.stop.done") } : {}),
    details: tr("planner.popup.details"),
    toggle: model.visited ? tr("planner.popup.unvisit") : tr("planner.popup.visit"),
  };
}

function stopsPayload(route: ActiveRoute, selectedId: string | null): MapStopPayload[] {
  const routeDay = route.day || 1;
  const multiDay = spansSeveralDays(route.stops, routeDay);
  return route.stops.map((s, idx) => {
    const day = multiDay ? stopDay(s, routeDay) : routeDay;
    return {
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      index: idx + 1,
      color: dayColor(day),
      isSelected: s.id === selectedId,
      visited: !!s.visited,
      popup: popupPayload(s, day),
    };
  });
}

/** "45 dk" / "1 saat 30 dk" → dakika; anlaşılmazsa undefined (uydurulmaz). */
function parseMinutes(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const h = /(\d+)\s*(saat|sa)\b/i.exec(text);
  const m = /(\d+)\s*(dk|dakika|min)/i.exec(text);
  if (!h && !m) return undefined;
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

export function MapScreen({
  focusedStopId,
  onClearFocus,
  onOpenPlan,
  onOpenAi,
  guest = false,
  onRequireAuth,
}: MapScreenProps) {
  const [route, setRoute] = useState<ActiveRoute>(tripStore.getActiveRoute());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [legs, setLegs] = useState<Legs>({ key: "", legs: null });
  const [query, setQuery] = useState("");
  const [search, dispatchSearch] = useReducer(reduceSearch, initialSearchState<PlaceCandidate>());
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [candidate, setCandidate] = useState<PlaceCandidate | null>(null);
  const [looking, setLooking] = useState(false);
  const [mode, setMode] = useState<"edit" | "discover">("edit");
  const [pool, setPool] = useState<TripStop[]>(tripStore.getSavedPool());
  const [discovered, setDiscovered] = useState<DiscoverAdd[]>([]);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const searchSeq = useRef(0);
  const toast = useToast();
  const [gate, setGate] = useState<AuthGateReason | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TripStop | null>(null);
  const [editing, setEditing] = useState<TripStop | null>(null);
  const [editName, setEditName] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [mapError, setMapError] = useState(false);
  const webRef = useRef<WebView>(null);
  // İlk HTML yalnızca bir kez üretilir; sonraki değişiklikler updateStops ile iletilir.
  const html = useMemo(
    () => buildLeafletHtml(stopsPayload(tripStore.getActiveRoute(), null), isReducedMotion()),
    [],
  );

  useEffect(
    () =>
      tripStore.subscribe(() => {
        const next = tripStore.getActiveRoute();
        setRoute({ ...next, stops: [...next.stops] });
        setPool([...tripStore.getSavedPool()]);
      }),
    [],
  );

  // Son aramalar cihazda (web localStorage karşılığı); bozuk kayıt sessizce atılır.
  useEffect(() => {
    storage
      .getItem(RECENT_KEY)
      .then((raw) => setRecent(parseRecent(raw)))
      .catch(() => undefined);
  }, []);

  const inject = (js: string) => webRef.current?.injectJavaScript(`${js}; true;`);

  // Duraklar / seçim değişince harita güncellenir.
  useEffect(() => {
    inject(
      `window.updateStops && window.updateStops(${JSON.stringify(stopsPayload(route, selectedId))})`,
    );
  }, [route, selectedId]);

  // Kaydedilenler (Plan görünümü) ya da Keşfet sonuçları haritada ayrı stille.
  const poolPayload = (): MapPoolPayload[] =>
    mode === "discover"
      ? discovered.map((d) => ({
          id: `discover:${d.placeId}`,
          name: d.label,
          lat: d.lat,
          lng: d.lng,
          popup: {
            category: tr("planner.mode.discover"),
            title: d.label,
            ...(d.address ? { address: d.address } : {}),
            details: tr("discover.save"),
            toggle: tr("planner.place.addToDayN", { n: addDay }),
          },
        }))
      : pool.map((p) => ({
          id: p.id,
          name: p.name,
          lat: p.lat,
          lng: p.lng,
          popup: {
            ...popupPayload(p, undefined),
            details: tr("planner.popup.details"),
            toggle: tr("planner.place.addToDayN", { n: addDay }),
          },
        }));
  useEffect(() => {
    inject(`window.updatePool && window.updatePool(${JSON.stringify(poolPayload())})`);
  }, [mode, pool, discovered]);

  const focusStop = (stop: TripStop) => {
    setSelectedId(stop.id);
    setCandidate(null);
    inject(`window.focusStop && window.focusStop(${stop.lat}, ${stop.lng}, 16)`);
  };

  // Planla listesinden gelen odak.
  useEffect(() => {
    if (!focusedStopId) return;
    const stop = route.stops.find((s) => s.id === focusedStopId);
    if (stop) focusStop(stop);
    onClearFocus?.();
  }, [focusedStopId]);

  const record = (
    stop: { lat: number; lng: number; name: string; category: string },
    action: "map_click" | "pin_select" | "route_add",
  ) => {
    if (guest) return;
    trainingService
      .recordMapInteraction({
        lat: stop.lat,
        lng: stop.lng,
        name: stop.name,
        category: stop.category,
        action,
      })
      .catch(() => undefined);
  };

  const onMessage = (event: { nativeEvent: { data: string } }) => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (data.type === "PIN_SELECT") {
      // Dokunuş yalnız popup'ı açar ve listede seçer; harita uçmaz (web: expand:false).
      const stop = route.stops.find((s) => s.id === data.id);
      if (stop) {
        setSelectedId(stop.id);
        setCandidate(null);
        record(stop, "pin_select");
      }
    } else if (data.type === "POPUP_ACTION" && typeof data.id === "string") {
      onPopupAction(data.act === "toggle" ? "toggle" : "details", data.id);
    } else if (
      data.type === "MAP_MOVED" &&
      typeof data.lat === "number" &&
      typeof data.lng === "number"
    ) {
      setMapCenter({ lat: data.lat, lng: data.lng });
    } else if (
      data.type === "MAP_CLICK" &&
      typeof data.lat === "number" &&
      typeof data.lng === "number"
    ) {
      setLooking(true);
      setSelectedId(null);
      dispatchSearch({ type: "reset" });
      lookupPoint(data.lat, data.lng)
        .then((place) => {
          setCandidate(place);
          inject(
            `window.setTempPin && window.setTempPin(${place.lat}, ${place.lng}, ${JSON.stringify(place.name)})`,
          );
          record(place, "map_click");
        })
        .finally(() => setLooking(false));
    } else if (data.type === "ROUTE_LEGS" && typeof data.key === "string") {
      setLegs({
        key: data.key,
        legs: Array.isArray(data.legs) ? (data.legs as Legs["legs"]) : null,
      });
    } else if (data.type === "MAP_LOAD_FAILED") {
      setMapError(true);
    } else if (data.type === "MAP_READY") {
      setMapError(false);
      inject(
        `window.updateStops && window.updateStops(${JSON.stringify(stopsPayload(route, selectedId))})`,
      );
      inject(`window.updatePool && window.updatePool(${JSON.stringify(poolPayload())})`);
    } else if (data.type === "LOCATION_ERROR") {
      toast.show({ tone: "warning", message: tr("planner.locate.failed") });
    }
  };

  const showCandidate = (place: PlaceCandidate) => {
    setCandidate(place);
    dispatchSearch({ type: "reset" });
    inject(
      `window.setTempPin && window.setTempPin(${place.lat}, ${place.lng}, ${JSON.stringify(place.name)})`,
    );
  };

  const runSearch = async () => {
    const q = query.trim();
    // Koordinat yapıştırma: yalnız kullanıcının yazdığı okunur, yer adı uydurulmaz (I1).
    const coords = parseCoordinates(q);
    if (coords) {
      const lat = coords.lat.toFixed(5);
      const lng = coords.lng.toFixed(5);
      showCandidate({
        name: `${lat}, ${lng}`,
        address: tr("planner.search.coordsAddress", { lat, lng }),
        category: "",
        lat: coords.lat,
        lng: coords.lng,
      });
      return;
    }
    if (q.length < 3) {
      toast.show({ tone: "info", message: tr("planner.search.hint") });
      return;
    }
    const requestId = ++searchSeq.current;
    setCandidate(null);
    dispatchSearch({ type: "start", requestId });
    try {
      const near = mapCenter ?? centroid(route.stops) ?? undefined;
      const results = await searchPlaces(q, near);
      dispatchSearch({ type: "success", requestId, results });
    } catch {
      dispatchSearch({ type: "failure", requestId });
    }
  };

  const pickResult = (place: PlaceCandidate) => {
    const next = pushRecent(recent, {
      label: place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    });
    setRecent(next);
    storage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => undefined);
    showCandidate(place);
  };

  const addPlace = (place: PlaceCandidate, target: "trip" | "pool" = "trip") => {
    const stop: TripStop = {
      id: `stop-${Date.now()}`,
      name: place.name,
      category: place.category,
      // Çok günlü rotada yeni durak son güne eklenir (düğme metniyle aynı gün).
      time: target === "trip" && multiDay ? `${addDay}. gün` : "",
      duration: "",
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      ...(place.placeId ? { placeId: place.placeId } : {}),
      ...(place.provider ? { placeProvider: place.provider } : {}),
    };
    if (target === "pool") {
      tripStore.addToPool(stop);
      toast.show({
        tone: "success",
        message: tr("planner.toast.addedToPool", { name: stop.name }),
      });
    } else {
      tripStore.addStop(stop);
      record(stop, "route_add");
      toast.show({
        tone: "success",
        message: tr("planner.toast.addedToDay", { name: stop.name, day: addDay }),
      });
    }
    setCandidate(null);
    dispatchSearch({ type: "reset" });
    setQuery("");
    inject("window.setTempPin && window.setTempPin(null)");
  };

  const addDiscovered = (d: DiscoverAdd, target: "trip" | "pool") =>
    addPlace(
      {
        name: d.label,
        address: d.address,
        category: "",
        lat: d.lat,
        lng: d.lng,
        placeId: d.placeId,
        provider: d.provider,
      },
      target,
    );

  const toggleVisited = (stop: TripStop) => {
    tripStore.toggleVisited(stop.id);
    const done = tripStore.getActiveRoute().stops;
    if (!stop.visited && done.length > 1 && done.every((s) => s.visited))
      toast.show({ tone: "success", message: tr("planner.toast.allDone") });
  };

  const addPoolToDay = (item: TripStop) => {
    tripStore.addFromPool(item.id, multiDay ? `${addDay}. gün` : "");
    toast.show({
      tone: "success",
      message: tr("planner.toast.addedToDay", { name: item.name, day: addDay }),
    });
  };

  // Popup düğmeleri: durakta Ayrıntı / Gezildi; Kaydedilenler'de Ayrıntı / N. güne ekle;
  // Keşfet sonucunda Kaydedilenlere ekle / N. güne ekle.
  const onPopupAction = (act: "details" | "toggle", id: string) => {
    if (id.startsWith("discover:")) {
      const d = discovered.find((x) => `discover:${x.placeId}` === id);
      if (d) addDiscovered(d, act === "toggle" ? "trip" : "pool");
      return;
    }
    const stop = route.stops.find((s) => s.id === id);
    if (stop) {
      if (act === "toggle") toggleVisited(stop);
      else {
        setMode("edit");
        focusStop(stop);
      }
      return;
    }
    const item = pool.find((p) => p.id === id);
    if (!item) return;
    if (act === "toggle") addPoolToDay(item);
    else
      showCandidate({
        name: item.name,
        address: item.address,
        category: item.category,
        lat: item.lat,
        lng: item.lng,
      });
  };

  const move = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    const stop = route.stops[index];
    tripStore.reorderStops(index, target);
    toast.show({
      tone: "info",
      message: tr(direction === "up" ? "planner.toast.movedUp" : "planner.toast.movedDown", {
        name: stop.name,
      }),
    });
  };

  const optimize = () => {
    const preview = optimizeStopOrder(route.stops);
    if (!preview) {
      toast.show({ tone: "info", message: tr("planner.optimize.none") });
      return;
    }
    const byId = new Map(route.stops.map((s) => [s.id, s]));
    tripStore.setStops(preview.optimizedStopIds.map((id) => byId.get(id)!).filter(Boolean));
    toast.show({
      tone: "success",
      message: tr("planner.optimize.done", {
        km: String(preview.savedDistanceKm).replace(".", ","),
      }),
    });
  };

  const share = async () => {
    if (guest) {
      setGate("save");
      return;
    }
    if (!route.stops.length) return;
    const lines = route.stops.map(
      (s, i) => `${i + 1}. ${s.name}${s.address ? ` — ${s.address}` : ""}`,
    );
    const url = `https://www.google.com/maps/dir/${route.stops.map((s) => `${s.lat},${s.lng}`).join("/")}`;
    await Share.share({
      message: `${route.name}\n${lines.join("\n")}\n${url}`,
      title: route.name,
    }).catch(() => undefined);
  };

  const openExternal = (stop?: TripStop) => {
    const url = stop
      ? `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}&travelmode=walking`
      : `https://www.google.com/maps/dir/${route.stops.map((s) => `${s.lat},${s.lng}`).join("/")}`;
    Linking.openURL(url).catch(() =>
      Alert.alert(tr("planner.travel.googleMaps"), tr("ui.unexpectedError")),
    );
  };

  const askAssistant = () => (guest ? setGate("ai") : onOpenAi?.());

  const openEdit = (stop: TripStop) => {
    setEditing(stop);
    setEditName(stop.name);
    setEditDuration(String(parseMinutes(stop.duration) ?? ""));
    setEditNotes(stop.notes ?? "");
  };

  const saveEdit = () => {
    if (!editing || !editName.trim()) return;
    const minutes = Number(editDuration);
    tripStore.updateStop(editing.id, {
      name: editName.trim(),
      duration:
        Number.isFinite(minutes) && minutes > 0 ? `${Math.round(minutes)} dk` : editing.duration,
      notes: editNotes.trim() || undefined,
    });
    setEditing(null);
    toast.show({ tone: "success", message: tr("planner.toast.saved") });
  };

  const day = route.day || 1;
  const multiDay = spansSeveralDays(route.stops, day);
  const lastStop = route.stops[route.stops.length - 1];
  const addDay = multiDay && lastStop ? stopDay(lastStop, day) : day;
  const currentLegs = legs.key === legsKeyOf(route.stops) ? legs.legs : null;
  const legsKnown =
    !multiDay && currentLegs && currentLegs.length === Math.max(0, route.stops.length - 1);
  const totalMeters = legsKnown ? currentLegs.reduce((a, l) => a + l.distance, 0) : undefined;
  const totalMinutes = legsKnown
    ? Math.round(currentLegs.reduce((a, l) => a + l.duration, 0) / 60)
    : undefined;
  const selected = route.stops.find((s) => s.id === selectedId) ?? null;

  return (
    <View style={styles.root}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html, baseUrl: "https://unpkg.com" }}
        style={styles.map}
        accessible={true}
        accessibilityLabel={mapLabel(route.stops.length)}
        importantForAccessibility="no-hide-descendants"
        onMessage={onMessage}
        onError={() => setMapError(true)}
        scrollEnabled={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        geolocationEnabled={true}
      />

      <SafeArea style={styles.top} pointerEvents="box-none">
        <View style={styles.topRow}>
          <IconButton
            icon="chevron-left"
            label={tr("planner.trips.title")}
            onPress={onOpenPlan}
            style={styles.floating}
          />
          <View style={styles.search}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={runSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={tr("planner.search.placeholder")}
              placeholderTextColor={tokens.color.fieldPlaceholder}
              accessibilityLabel={tr("planner.search.label")}
              accessibilityHint={tr("planner.search.hint")}
              returnKeyType="search"
              maxLength={120}
              maxFontSizeMultiplier={tokens.font.maxScale.body}
              style={[styles.searchInput, { fontFamily: fontFamily("regular") }]}
            />
            <IconButton icon="search" label={tr("planner.search.submit")} onPress={runSearch} />
          </View>
          <IconButton
            icon="locate"
            label={tr("planner.map.locate")}
            onPress={() => inject("window.requestUserLocation && window.requestUserLocation()")}
            style={styles.floating}
          />
        </View>
        {guest ? (
          <View style={styles.badgeRow}>
            <Button
              label={tr("gate.banner")}
              variant="secondary"
              size="sm"
              onPress={() => setGate("save")}
            />
          </View>
        ) : null}
      </SafeArea>

      <BottomSheet
        snap={["peek", "half", "full"]}
        initial="half"
        label={tr("planner.sheet.label")}
        expandLabel={tr("planner.sheet.expand")}
        collapseLabel={tr("planner.sheet.collapse")}
      >
        <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <SegmentedControl
            label={tr("planner.mode.label")}
            options={[
              { value: "edit", label: tr("planner.mode.edit") },
              { value: "discover", label: tr("planner.mode.discover") },
            ]}
            value={mode}
            onChange={setMode}
          />
          {mapError ? (
            <Notice tone="warning" title={tr("planner.map.errorTitle")}>
              {tr("planner.map.errorBody")}
            </Notice>
          ) : null}

          {looking ? (
            <Txt variant="small" tone="muted">
              {tr("planner.point.loading")}
            </Txt>
          ) : null}

          {searchFocused && !query.trim() && recent.length > 0 && search.status === "idle" ? (
            <View style={styles.cardBody}>
              <Txt variant="heading" header>
                {tr("planner.search.recent")}
              </Txt>
              {recent.map((r) => (
                <Card
                  key={`${r.lat},${r.lng}`}
                  variant="bordered"
                  label={`${r.label}, ${r.address}`}
                  onPress={() =>
                    pickResult({
                      name: r.label,
                      address: r.address,
                      category: "",
                      lat: r.lat,
                      lng: r.lng,
                    })
                  }
                >
                  <Txt variant="label">{r.label}</Txt>
                  {r.address ? (
                    <Txt variant="caption" tone="muted">
                      {r.address}
                    </Txt>
                  ) : null}
                </Card>
              ))}
            </View>
          ) : null}

          {search.status === "loading" ? (
            <View
              accessible
              accessibilityLabel={tr("planner.search.loading")}
              style={styles.cardBody}
            >
              <Txt variant="small" tone="muted">
                {tr("planner.search.loading")}
              </Txt>
              <Skeleton variant="list-row" count={3} />
            </View>
          ) : null}

          {search.status === "error" ? (
            <Notice
              tone="danger"
              title={tr("planner.search.error")}
              action={{ label: tr("ui.retry"), onPress: () => void runSearch() }}
            />
          ) : null}

          {candidate ? (
            <Card variant="bordered">
              <View style={styles.cardBody}>
                <Txt variant="eyebrow" tone="highlight">
                  {parseCoordinates(query.trim())
                    ? tr("planner.search.coords")
                    : tr("planner.point.eyebrow")}
                </Txt>
                <Txt variant="heading" header>
                  {candidate.name}
                </Txt>
                {candidate.address ? (
                  <Txt variant="small" tone="muted">
                    {candidate.address}
                  </Txt>
                ) : null}
                {candidate.category ? (
                  <Txt variant="caption" tone="muted">
                    {candidate.category}
                  </Txt>
                ) : null}
                <View style={styles.actions}>
                  <Button
                    label={tr("planner.place.addToDayN", { n: addDay })}
                    onPress={() => addPlace(candidate)}
                  />
                  <Button
                    label={tr("planner.place.addToPool")}
                    variant="secondary"
                    onPress={() => addPlace(candidate, "pool")}
                  />
                  <Button
                    label={tr("ui.cancel")}
                    variant="ghost"
                    onPress={() => {
                      setCandidate(null);
                      inject("window.setTempPin && window.setTempPin(null)");
                    }}
                  />
                </View>
                {candidate.attribution ? (
                  <Txt variant="caption" tone="subtle">
                    {tr("planner.facts.source", { name: candidate.attribution })}
                  </Txt>
                ) : null}
              </View>
            </Card>
          ) : null}

          {search.status === "results" || search.status === "empty" ? (
            <View style={styles.cardBody}>
              <Txt variant="heading" header>
                {tr("planner.search.results")}
              </Txt>
              {search.status === "empty" ? (
                <Txt variant="small" tone="muted">
                  {tr("planner.search.empty")}
                </Txt>
              ) : (
                search.results.map((place) => (
                  <Card
                    key={`${place.lat},${place.lng}`}
                    variant="bordered"
                    label={`${place.name}, ${place.address}`}
                    onPress={() => pickResult(place)}
                  >
                    <Txt variant="label">{place.name}</Txt>
                    {place.address ? (
                      <Txt variant="caption" tone="muted">
                        {place.address}
                      </Txt>
                    ) : null}
                  </Card>
                ))
              )}
            </View>
          ) : null}

          {mode === "discover" ? (
            <DiscoverPanel
              dayPins={route.stops.map((st) => stopToPin(st, multiDay ? stopDay(st, day) : day))}
              allPins={[
                ...route.stops.map((st) => stopToPin(st, multiDay ? stopDay(st, day) : day)),
                ...pool.map((p) => stopToPin(p, 0)),
              ]}
              addDay={addDay}
              mapCenter={mapCenter}
              onAdd={addDiscovered}
              onFocus={(lat, lng, label) =>
                inject(
                  `window.setTempPin && window.setTempPin(${lat}, ${lng}, ${JSON.stringify(label)})`,
                )
              }
              onResults={setDiscovered}
            />
          ) : null}

          {mode === "edit" ? (
            <>
              <DayHeader
                title={route.name || tr("planner.untitled")}
                eyebrow={multiDay ? undefined : tr("planner.days.day", { n: day })}
                stops={route.stops.length}
                meters={totalMeters}
                minutes={totalMinutes}
                offline={route.stops.length > 0}
              />

              {route.stops.length === 0 ? (
                <View style={styles.cardBody}>
                  <Txt variant="heading">{tr("planner.day.empty")}</Txt>
                  <Txt variant="small" tone="muted">
                    {tr("planner.day.emptyHint")}
                  </Txt>
                </View>
              ) : (
                <View>
                  {route.stops.map((stop, i) => (
                    <View key={stop.id}>
                      <StopRow
                        index={i + 1}
                        day={multiDay ? stopDay(stop, day) : day}
                        time={stop.time || undefined}
                        name={stop.name}
                        category={categoryIcon(stop.category)}
                        categoryLabel={
                          stop.visited
                            ? `${stop.category} · ${tr("planner.stop.done")}`
                            : stop.category
                        }
                        duration={parseMinutes(stop.duration)}
                        selected={stop.id === selectedId}
                        isFirst={i === 0}
                        isLast={i === route.stops.length - 1}
                        onPress={() => focusStop(stop)}
                        onMove={(direction) => move(i, direction)}
                      />
                      {i < route.stops.length - 1 ? (
                        <Connector
                          mode="walk"
                          minutes={
                            currentLegs?.[i] ? Math.round(currentLegs[i].duration / 60) : undefined
                          }
                          meters={
                            currentLegs?.[i] ? Math.round(currentLegs[i].distance) : undefined
                          }
                        />
                      ) : null}
                    </View>
                  ))}
                </View>
              )}

              {selected ? (
                <Card variant="bordered">
                  <View style={styles.cardBody}>
                    <Txt variant="heading" header>
                      {selected.name}
                    </Txt>
                    {selected.address ? (
                      <Txt variant="small" tone="muted">
                        {selected.address}
                      </Txt>
                    ) : null}
                    {selected.notes ? <Txt variant="small">{selected.notes}</Txt> : null}
                    <View style={styles.actions}>
                      <Button
                        label={tr("planner.travel.googleMaps")}
                        variant="secondary"
                        size="sm"
                        onPress={() => openExternal(selected)}
                      />
                      <Button
                        label={
                          selected.visited ? tr("planner.stop.done") : tr("planner.stop.markDone")
                        }
                        variant="secondary"
                        size="sm"
                        onPress={() => toggleVisited(selected)}
                      />
                      <Button
                        label={tr("planner.detail.edit")}
                        variant="secondary"
                        size="sm"
                        onPress={() => openEdit(selected)}
                      />
                      <Button
                        label={tr("planner.stop.delete")}
                        variant="danger"
                        size="sm"
                        onPress={() => setConfirmDelete(selected)}
                      />
                    </View>
                  </View>
                </Card>
              ) : null}

              {route.stops.length ? (
                <View style={styles.cardBody}>
                  <Button label={tr("planner.optimize")} onPress={optimize} />
                  <View style={styles.actions}>
                    <Button label={tr("planner.share")} variant="secondary" onPress={share} />
                    <Button label={tr("planner.ask")} variant="secondary" onPress={askAssistant} />
                    <Button
                      label={tr("planner.travel.googleMaps")}
                      variant="ghost"
                      onPress={() => openExternal()}
                    />
                  </View>
                  <Txt variant="caption" tone="muted">
                    {tr("planner.note.osrm")}
                  </Txt>
                </View>
              ) : null}

              <View style={styles.cardBody}>
                <Txt variant="heading" header>
                  {tr("planner.pool.title", { n: pool.length })}
                </Txt>
                {pool.length === 0 ? (
                  <Txt variant="caption" tone="muted">
                    {tr("planner.pool.empty")}
                  </Txt>
                ) : (
                  pool.map((item) => (
                    <Card key={item.id} variant="bordered">
                      <View style={styles.poolRow}>
                        <View style={styles.poolText}>
                          <Txt variant="label">{item.name}</Txt>
                          {item.address ? (
                            <Txt variant="caption" tone="muted">
                              {item.address}
                            </Txt>
                          ) : null}
                        </View>
                        <Button
                          size="sm"
                          variant="secondary"
                          label={tr("planner.place.addToDayN", { n: addDay })}
                          onPress={() => addPoolToDay(item)}
                        />
                        <IconButton
                          icon="trash"
                          label={tr("planner.stop.delete")}
                          onPress={() => tripStore.removeFromPool(item.id)}
                        />
                      </View>
                    </Card>
                  ))
                )}
              </View>
            </>
          ) : null}
        </ScrollView>
      </BottomSheet>

      <ConfirmDialog
        visible={!!confirmDelete}
        title={tr("planner.stop.deleteTitle")}
        body={
          confirmDelete ? tr("planner.stop.deleteBody", { name: confirmDelete.name }) : undefined
        }
        confirmLabel={tr("planner.stop.delete")}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            // Geri al: silmeden önceki sıra aynen geri yazılır (web ConfirmDialog + Geri al toast).
            const before = [...route.stops];
            tripStore.removeStop(confirmDelete.id);
            toast.show({
              tone: "info",
              message: tr("planner.toast.deleted", { name: confirmDelete.name }),
              action: { label: tr("planner.undo"), onPress: () => tripStore.setStops(before) },
            });
          }
          if (confirmDelete?.id === selectedId) setSelectedId(null);
          setConfirmDelete(null);
        }}
      />

      <ModalFrame
        visible={!!editing}
        variant="sheet"
        title={tr("planner.detail.edit")}
        onRequestClose={() => setEditing(null)}
      >
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <TextField
            label={tr("planner.edit.name")}
            value={editName}
            onChangeText={setEditName}
            error={editName.trim() ? undefined : tr("planner.trips.titleRequired")}
          />
          <TextField
            label={tr("planner.edit.duration")}
            value={editDuration}
            onChangeText={setEditDuration}
            keyboardType="number-pad"
            maxLength={4}
          />
          <TextField
            label={tr("planner.edit.note")}
            value={editNotes}
            onChangeText={setEditNotes}
            multiline
            maxLength={500}
          />
          <Button label={tr("planner.edit.save")} size="lg" onPress={saveEdit} />
        </ScrollView>
      </ModalFrame>

      {gate ? (
        <AuthGate
          variant="sheet"
          reason={gate}
          visible
          onClose={() => setGate(null)}
          onRegister={() => {
            setGate(null);
            onRequireAuth?.("register");
          }}
          onLogin={() => {
            setGate(null);
            onRequireAuth?.("login");
          }}
        />
      ) : null}
      <ScreenTourModal screen="map" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg },
  map: { ...StyleSheet.absoluteFill, backgroundColor: tokens.color.surfaceSunken },
  top: { position: "absolute", top: 0, left: 0, right: 0 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["2"],
    paddingHorizontal: tokens.space["3"],
    // Android'de SafeArea üst boşluk eklemez (R5-6): durum çubuğu kadar elle.
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) + 8 : tokens.space["2"],
  },
  floating: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.full,
    ...tokens.shadow.sm,
  },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: tokens.touch.min,
    paddingLeft: tokens.space["3"],
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    borderColor: tokens.color.fieldBorder,
    backgroundColor: tokens.color.fieldBg,
    ...tokens.shadow.sm,
  },
  searchInput: { flex: 1, fontSize: tokens.font.size.md, color: tokens.color.fieldFg },
  badgeRow: { alignItems: "center", paddingTop: tokens.space["2"] },
  sheet: { padding: tokens.space["4"], paddingBottom: tokens.space["16"], gap: tokens.space["3"] },
  cardBody: { gap: tokens.space["2"] },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space["2"] },
  poolRow: { flexDirection: "row", alignItems: "center", gap: tokens.space["2"] },
  poolText: { flex: 1, gap: tokens.space["1"] },
  form: { padding: tokens.space["5"], gap: tokens.space["4"] },
});
