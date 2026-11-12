import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { WebView } from "react-native-webview";
import { tripStore, type ActiveRoute, type TripStop } from "../services/tripStore";
import { trainingService } from "../services/api";
import { storage } from "../services/storage";
import { ScreenTourModal } from "../components/ScreenTourModal";
import { AppleLogo, GoogleLogo, YandexLogo } from "../ui/BrandLogos";
import { PinShareModal } from "../components/PinShareModal";
import { buildDirections } from "../share/map-directions";
import {
  Accordion,
  AuthGate,
  BottomSheet,
  type SheetSnap,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  Connector,
  DayHeader,
  Icon,
  IconButton,
  ModalFrame,
  Notice,
  SafeArea,
  SegmentedControl,
  Skeleton,
  Stepper,
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
  searchKey,
  searchReducer,
  shouldSendSearch,
  type RecentSearch,
  type SentSearch,
  type SearchEvent,
  type SearchState,
} from "../trip/place-search-logic";
import { pinPopupModel } from "../trip/pin-popup";
import { stopToPin } from "../trip/models";
import { centroid } from "../trip/discovery-rank";
import { DiscoverPanel, type DiscoverAdd } from "../components/DiscoverPanel";
import { NearbyList, type NearbyAddPlace } from "../components/NearbyList";
import { usePermission } from "../components/PermissionPrompt";
import { readTile, storeTile } from "../services/tile-cache";
import { currentPosition } from "../services/nearby";
import { appleMapsUrl, googleMapsUrl } from "../services/directions";
import { encodePinCode } from "../share/pin-link";
import { gpxFileName, routeToGpx } from "../services/route-export";
import { scheduleRouteReminders } from "../services/notifications";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { optimizeStopOrder } from "../trip/optimize";
import { categoryIcon } from "../trip/category";
import { spansSeveralDays, stopDay } from "../trip/days";
import { dayFullSuggestion } from "../trip/day-full";
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

/** U6 öneri bandı (web DayFullBanner karşılığı): boş/bitmiş günde "ekstra yer", dolu günde son
 * durağı başka güne kaydır. Kaydırma hedefi başka gün varsa gün düğmeleriyle seçilir; yoksa
 * yalnızca yönlendirme gösterilir. Motion yok (R9). */
function DayFullBanner({
  suggestion,
  stops,
  otherDays,
  onAddExtra,
  onShift,
}: {
  suggestion: ReturnType<typeof dayFullSuggestion>;
  stops: readonly TripStop[];
  otherDays: number[];
  onAddExtra: () => void;
  onShift: (stopId: string, targetDay: number) => void;
}) {
  const [target, setTarget] = useState<number | null>(otherDays[0] ?? null);
  if (!suggestion) return null;
  if (suggestion.kind === "addExtra") {
    return (
      <Notice
        tone="info"
        title={tr("planner.dayFull.addTitle")}
        action={{ label: tr("planner.dayFull.addExtra"), onPress: onAddExtra }}
      >
        {tr("planner.dayFull.addBody")}
      </Notice>
    );
  }
  const stop = stops.find((s) => s.id === suggestion.stopId);
  const name = stop?.name ?? "";
  if (otherDays.length === 0) {
    return (
      <Notice tone="warning" title={tr("planner.dayFull.fullTitle")}>
        {tr("planner.dayFull.fullBodyNoDay")}
      </Notice>
    );
  }
  const current = target ?? otherDays[0];
  // Hedef yalnız başka günlerden biri olabilir (kaydırılan günün kendisi hariç); Stepper komşu
  // güne geçerken o günü atlar.
  const nearestOther = (value: number, delta: number): number => {
    let next = value + delta;
    while (next >= otherDays[0] && next <= otherDays[otherDays.length - 1]) {
      if (otherDays.includes(next)) return next;
      next += delta;
    }
    return value;
  };
  return (
    <View style={styles.suggest}>
      <Notice tone="warning" title={tr("planner.dayFull.fullTitle")}>
        {tr("planner.dayFull.fullBody", { name })}
      </Notice>
      <Stepper
        label={tr("planner.dayFull.shiftDayFor", { name })}
        value={current}
        min={otherDays[0]}
        max={otherDays[otherDays.length - 1]}
        onChange={(v) => setTarget(nearestOther(current, v > current ? 1 : -1))}
      />
      <Button
        size="sm"
        label={tr("planner.dayFull.shiftStop")}
        onPress={() => onShift(suggestion.stopId, current)}
      />
    </View>
  );
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
  // G3: duraklar yatay kaydırılır; her sayfa ekran genişliğinin ~%84'ü (komşu kart hafif görünür,
  // kaydırılabilirlik ipucu). BottomSheet içinde güvenli: pencere genişliğine oranlı sabit piksel.
  const { width: windowWidth } = useWindowDimensions();
  const stopPageWidth = Math.round(windowWidth * 0.88);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [navTarget, setNavTarget] = useState<TripStop | "all" | null>(null);
  const [legs, setLegs] = useState<Legs>({ key: "", legs: null });
  const [query, setQuery] = useState("");
  const [search, dispatchSearch] = useReducer(reduceSearch, initialSearchState<PlaceCandidate>());
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [candidate, setCandidate] = useState<PlaceCandidate | null>(null);
  // U3: ekleme anı gün seçimi (çok günlü rotada); null → varsayılan addDay.
  const [candidateDay, setCandidateDay] = useState<number | null>(null);
  const [looking, setLooking] = useState(false);
  const [mode, setMode] = useState<"edit" | "discover">("edit");
  const [reorderOpen, setReorderOpen] = useState(false);
  const [showcaseStop, setShowcaseStop] = useState<TripStop | null>(null);
  const [sharePinTarget, setSharePinTarget] = useState<TripStop | null>(null);
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | null>(null);
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | undefined>(undefined);
  // B6: alt sayfa snap durumu; peek'te önce konumlar, half/full'de mod seçici + arama.
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("peek");
  const sheetExpanded = sheetSnap !== "peek";
  const [pool, setPool] = useState<TripStop[]>(tripStore.getSavedPool());
  const [discovered, setDiscovered] = useState<DiscoverAdd[]>([]);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const searchSeq = useRef(0);
  // review-final #3: Enter + düğme (ya da çift dokunma) aynı sorguyu ikinci kez göndermez.
  const lastSent = useRef<SentSearch | null>(null);
  const resetSearch = () => {
    lastSent.current = null;
    dispatchSearch({ type: "reset" });
  };
  const toast = useToast();
  const locationPerm = usePermission("location");
  const notifyPerm = usePermission("notifications");
  const [nearMeKey, setNearMeKey] = useState(0);
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
      resetSearch();
      lookupPoint(data.lat, data.lng)
        .then((place) => {
          setCandidate(place);
          setCandidateDay(null);
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
    } else if (
      data.type === "TILE_SAVE" &&
      typeof data.key === "string" &&
      typeof data.data === "string"
    ) {
      storeTile(data.key, data.data);
    } else if (data.type === "TILE_MISS" && typeof data.key === "string") {
      const key = data.key;
      readTile(key).then((uri) =>
        inject(
          `window.provideTile && window.provideTile(${JSON.stringify(key)}, ${JSON.stringify(uri)})`,
        ),
      );
    } else if (data.type === "LOCATION_ERROR") {
      toast.show({ tone: "warning", message: tr("planner.locate.failed") });
    }
  };

  // Konumum / Yakınımda (K4): önce gerekçe (PermissionPrompt), sonra expo-location (when-in-use).
  const locate = async (): Promise<{ lat: number; lng: number } | null> => {
    if (!(await locationPerm.ensure())) return null;
    const pos = await currentPosition();
    if (!pos) {
      toast.show({ tone: "warning", message: tr("planner.locate.failed") });
      return null;
    }
    inject(`window.showUser && window.showUser(${pos.lat}, ${pos.lng})`);
    setMapCenter(pos);
    return pos;
  };

  const nearMe = async () => {
    const pos = await locate();
    if (!pos) return;
    setMode("discover");
    setNearMeKey((n) => n + 1);
  };

  const showCandidate = (place: PlaceCandidate) => {
    setCandidate(place);
    setCandidateDay(null);
    resetSearch();
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
    if (!shouldSendSearch(lastSent.current, q)) return;
    const sent: SentSearch = { key: searchKey(q), status: "loading" };
    lastSent.current = sent;
    const requestId = ++searchSeq.current;
    setCandidate(null);
    dispatchSearch({ type: "start", requestId });
    try {
      const near = mapCenter ?? centroid(route.stops) ?? undefined;
      const results = await searchPlaces(q, near);
      sent.status = results.length > 0 ? "results" : "empty";
      dispatchSearch({ type: "success", requestId, results });
    } catch {
      sent.status = "error";
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

  // U3: hedef gün açıkça seçilebilir (varsayılan addDay = son/etkin gün). target "pool" ise
  // Kaydedilenler'e; "trip" ise toDay (çok günlü rotada o günün önekiyle) eklenir.
  const addPlace = (place: PlaceCandidate, target: "trip" | "pool" = "trip", toDay = addDay) => {
    const stop: TripStop = {
      id: `stop-${Date.now()}`,
      name: place.name,
      category: place.category,
      // Çok günlü rotada yeni durak seçilen güne eklenir (düğme metniyle aynı gün).
      time: target === "trip" && multiDay ? `${toDay}. gün` : "",
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
        message: tr("planner.toast.addedToDay", { name: stop.name, day: toDay }),
      });
    }
    setCandidate(null);
    resetSearch();
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

  // U1: "yakında ne var" öğesini ekle (trip = N. güne, pool = Kaydedilenler'e).
  const addNearby = (place: NearbyAddPlace, target: "trip" | "pool") =>
    addPlace(
      {
        name: place.name,
        address: place.address,
        category: place.category,
        lat: place.lat,
        lng: place.lng,
        placeId: place.placeId,
        provider: place.provider,
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

  // U6: boş/bitmiş günde ekstra yer eklemek için Keşfet'i aç (web DayFullBanner addExtra ile aynı).
  const openDiscoverForDay = () => {
    setSelectedId(null);
    setMode("discover");
  };

  // U6: günün son durağını başka güne kaydır (web movePinToDay ile aynı; geri alınabilir toast).
  const shiftStopToDay = (stopId: string, targetDay: number) => {
    const before = [...route.stops];
    const stop = route.stops.find((s) => s.id === stopId);
    tripStore.updateStop(stopId, { time: `${targetDay}. gün` });
    toast.show({
      tone: "success",
      message: tr("planner.toast.addedToDay", { name: stop?.name ?? "", day: targetDay }),
      action: { label: tr("planner.undo"), onPress: () => tripStore.setStops(before) },
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

  // Yol tarifi (K4): Google, Yandex, Apple Haritalar (Apple sonda, D3 buildDirections uyumlu).
  const openExternal = (
    stop?: TripStop,
    app: "google" | "yandex" | "apple" = "google",
  ) => {
    if (stop && Number.isFinite(stop.lat) && Number.isFinite(stop.lng)) {
      const url = buildDirections({
        dest: { lat: stop.lat, lng: stop.lng },
        origin: mapCenter,
        provider: app,
      });
      Linking.openURL(url).catch(() =>
        Alert.alert("Yol Tarifi", tr("ui.unexpectedError")),
      );
      return;
    }
    const points = route.stops;
    const url = app === "apple" ? appleMapsUrl(points) : googleMapsUrl(points);
    if (!url) return;
    Linking.openURL(url).catch(() =>
      Alert.alert(tr("planner.travel.googleMaps"), tr("ui.unexpectedError")),
    );
  };

  // Durağı paylaş (D3): sunucusuz kod + /p/ bağlantısı; karşı taraf kendi konumundan yol tarifi
  // açar. Hesapsız, misafir de kullanır (paylaşılan veri açık varış noktasıdır). QR, /p/ sayfası
  // WebView'de açıldığında görünür; burada bağlantı Share ile paylaşılır.
  const shareStop = async (stop: TripStop) => {
    if (!Number.isFinite(stop.lat) || !Number.isFinite(stop.lng)) return;
    const code = encodePinCode({ lat: stop.lat, lng: stop.lng, label: stop.name });
    const url = `https://mapsbridge.com/p/?c=${code}`;
    await Share.share({
      message: `${stop.name}\n${url}`,
      url,
      title: tr("planner.pinShare.title"),
    }).catch(() => undefined);
  };

  // Anlamlı ve detaylı Seyahat Rehberi (metin/markdown) oluşturup paylaş/indir
  const shareRouteGuide = async () => {
    if (guest) {
      setGate("save");
      return;
    }
    if (!route.stops.length) return;
    try {
      const days = [...new Set(route.stops.map((s) => stopDay(s, 1)))].sort((a, b) => a - b);
      let guideText = `=========================================\n`;
      guideText += `🌍 MAPSBRIDGE SEYAHAT VE ROTA REHBERİ\n`;
      guideText += `=========================================\n\n`;
      guideText += `Rota Adı: ${route.name || "Özel Seyahat Rotası"}\n`;
      guideText += `Toplam Durak: ${route.stops.length} Durak\n`;
      guideText += `Toplam Gün: ${days.length} Gün\n`;
      guideText += `Oluşturulma Tarihi: ${new Date().toLocaleDateString("tr-TR")}\n\n`;
      guideText += `-----------------------------------------\n`;
      guideText += `📍 GÜN GÜN SEYAHAT PLANI VE DURAKLAR\n`;
      guideText += `-----------------------------------------\n\n`;

      days.forEach((d) => {
        guideText += `📅 [ ${d}. GÜN ]\n`;
        const dayStops = route.stops.filter((s) => stopDay(s, 1) === d);
        dayStops.forEach((s, idx) => {
          guideText += `${idx + 1}. ${s.name}\n`;
          if (s.address) guideText += `   • Adres: ${s.address}\n`;
          if (s.duration) guideText += `   • Ziyaret Süresi: ${s.duration}\n`;
          if (s.notes) guideText += `   • Notlar: ${s.notes}\n`;
          guideText += `   • Konum Kodu: #${Math.abs(Math.round(s.lat * 1000 + s.lng * 1000))}\n`;
          guideText += `   • Koordinatlar: ${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}\n\n`;
        });
      });

      guideText += `-----------------------------------------\n`;
      guideText += `💡 MAPSBRIDGE AI SEYAHAT İPUÇLARI & YOL NOTLARI\n`;
      guideText += `-----------------------------------------\n`;
      guideText += `• Navigasyon: Duraklar arasındaki en hızlı güzergahlar yol ağına göre optimize edilmiştir.\n`;
      guideText += `• Acil Durum Hattı: 112\n`;
      guideText += `• Belgeler: Uçak, otel ve vize evraklarınızı MapsBridge mobil uygulamasında çevrimdışı saklayabilirsiniz.\n\n`;
      guideText += `MapsBridge ile keyifli ve güvenli seyahatler dileriz!\nhttps://mapsbridge.com\n`;

      const safeName = (route.name || "Rota").replace(/[^a-zA-Z0-9_\-]/g, "_");
      const file = new File(Paths.cache, `${safeName}_Seyahat_Rehberi.txt`);
      if (file.exists) file.delete();
      file.write(guideText);

      if (!(await Sharing.isAvailableAsync())) throw new Error("sharing unavailable");
      await Sharing.shareAsync(file.uri, {
        mimeType: "text/plain",
        dialogTitle: `${route.name} Seyahat Rehberi`,
      });
    } catch {
      toast.show({ tone: "danger", message: "Rehber indirilirken bir sorun oluştu." });
    }
  };

  const remind = async () => {
    if (guest) {
      setGate("save");
      return;
    }
    if (!(await notifyPerm.ensure())) return;
    const n = await scheduleRouteReminders(tripStore.getActiveRoute());
    toast.show(
      n > 0
        ? { tone: "success", message: tr("native.reminder.done", { n }) }
        : { tone: "warning", message: tr("native.reminder.none") },
    );
  };

  const askAssistant = () => (guest ? setGate("ai") : onOpenAi?.());

  const openEdit = (stop: TripStop) => {
    setEditing(stop);
    setEditName(stop.name);
    setEditDuration(String(parseMinutes(stop.duration) ?? ""));
    setEditNotes(stop.notes ?? "");
    setEditPhotoUrl(stop.photoUrl);
  };

  const pickStopPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        toast.show({ tone: "warning", message: tr("native.profile.photoPermission") });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.length) return;
      setEditPhotoUrl(result.assets[0].uri);
    } catch {
      toast.show({ tone: "danger", message: tr("ui.unexpectedError") });
    }
  };

  const saveEdit = () => {
    if (!editing || !editName.trim()) return;
    const minutes = Number(editDuration);
    tripStore.updateStop(editing.id, {
      name: editName.trim(),
      duration:
        Number.isFinite(minutes) && minutes > 0 ? `${Math.round(minutes)} dk` : editing.duration,
      notes: editNotes.trim() || undefined,
      photoUrl: editPhotoUrl,
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
  // U6: "gün doldu / boş" önerisi (deterministik, I2). Tek günlü rotada OSRM bacaklarından tampon
  // hesaplanır; çok günlüde bacak günlere ayrılmadığından yalnız boş/gezilmiş → "ekstra yer".
  const suggestionStops = multiDay
    ? route.stops.filter((s) => stopDay(s, day) === addDay)
    : route.stops;
  const suggestionLegs = !multiDay && legsKnown ? currentLegs : null;
  const suggestion = dayFullSuggestion(
    suggestionStops.map((s) => ({
      id: s.id,
      visited: !!s.visited,
      durationMinutes: parseMinutes(s.duration),
    })),
    suggestionLegs,
  );
  // "Durağı kaydır" için hedef günler (çok günlü rotada mevcut gün dışındakiler).
  const baseRouteDays = multiDay
    ? Array.from(new Set(route.stops.map((s) => stopDay(s, day)))).sort((a, b) => a - b)
    : [day];
  const allDays = Array.from(new Set([...baseRouteDays, ...customDays])).sort((a, b) => a - b);
  const routeDays = allDays;
  const otherDays = routeDays.filter((d) => d !== addDay);
  const displayedStops =
    selectedDayFilter !== null
      ? route.stops.filter((s) => stopDay(s, day) === selectedDayFilter)
      : route.stops;

  return (
    <View style={styles.root}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html, baseUrl: "https://mapsbridge.com" }}
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
            onPress={() => void locate()}
            style={styles.floating}
          />
        </View>

        {/* Arama sonuçları arama çubuğunun hemen altında floating liste olarak gösterilir */}
        {query.trim().length > 0 && search.status === "results" ? (
          <View style={styles.floatingResults}>
            <ScrollView
              style={styles.floatingResultsScroll}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {search.results.map((place) => (
                <Card
                  key={`${place.lat},${place.lng}`}
                  variant="bordered"
                  style={styles.floatingResultCard}
                  onPress={() => {
                    pickResult(place);
                    setQuery("");
                  }}
                >
                  <View style={styles.resultItem}>
                    <Icon name="map" size={16} color={tokens.color.highlight} />
                    <View style={styles.resultTexts}>
                      <Txt variant="label" numberOfLines={1}>
                        {place.name}
                      </Txt>
                      {place.address ? (
                        <Txt variant="caption" tone="muted" numberOfLines={1}>
                          {place.address}
                        </Txt>
                      ) : null}
                    </View>
                  </View>
                </Card>
              ))}
            </ScrollView>
          </View>
        ) : null}
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
        initial="peek"
        value={sheetSnap}
        onSnapChange={setSheetSnap}
        label={tr("planner.sheet.label")}
        expandLabel={tr("planner.sheet.expand")}
        collapseLabel={tr("planner.sheet.collapse")}
      >
        <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          {/* B6: en küçük boyutta (peek) önce konumlar görünür; mod seçici ve arama yukarı
              çekilince (half/full) görünür. */}
          {sheetExpanded ? (
            <SegmentedControl
              label={tr("planner.mode.label")}
              options={[
                { value: "edit", label: tr("planner.mode.edit") },
                { value: "discover", label: tr("planner.mode.discover") },
              ]}
              value={mode}
              onChange={setMode}
            />
          ) : null}
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
                {/* U3: çok günlü rotada hedef günü ekleme anında seç (varsayılan son gün). */}
                {multiDay && routeDays.length > 1 ? (
                  <Stepper
                    label={tr("planner.place.targetLabel")}
                    value={candidateDay ?? addDay}
                    min={routeDays[0]}
                    max={routeDays[routeDays.length - 1]}
                    onChange={setCandidateDay}
                  />
                ) : null}
                <View style={styles.actions}>
                  <Button
                    label={tr("planner.place.addToDayN", { n: candidateDay ?? addDay })}
                    onPress={() => addPlace(candidate, "trip", candidateDay ?? addDay)}
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
                {/* U1: tıklanan noktada ne var + yakında ne var (G4: kompakt). */}
                <NearbyList
                  lat={candidate.lat}
                  lng={candidate.lng}
                  addDay={addDay}
                  onAdd={addNearby}
                  compact
                  onFocus={(lat, lng, label) =>
                    inject(
                      `window.setTempPin && window.setTempPin(${lat}, ${lng}, ${JSON.stringify(label)})`,
                    )
                  }
                />
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
            <Button
              label={tr("native.nearMe")}
              variant="secondary"
              icon={<Icon name="locate" size={16} />}
              onPress={() => void nearMe()}
            />
          ) : null}
          {mode === "discover" ? (
            <DiscoverPanel
              refreshKey={nearMeKey}
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
              {sheetSnap === "peek" ? (
                <View style={styles.peekHeaderRow}>
                  <View style={styles.peekRouteTitleWrap}>
                    <Txt variant="heading" header numberOfLines={1} style={styles.peekRouteName}>
                      {route.name || tr("planner.untitled")}
                    </Txt>
                    <View style={styles.peekDayBadge}>
                      <Txt variant="caption" tone="highlight">
                        {multiDay ? `${routeDays.length} Gün` : tr("planner.days.day", { n: day })}
                      </Txt>
                    </View>
                  </View>
                  <Txt variant="caption" tone="muted">
                    {tr("trip.day.stops", { n: displayedStops.length })}
                  </Txt>
                </View>
              ) : (
                <>
                  <DayHeader
                    title={route.name || tr("planner.untitled")}
                    eyebrow={multiDay ? undefined : tr("planner.days.day", { n: day })}
                    stops={route.stops.length}
                    meters={totalMeters}
                    minutes={totalMinutes}
                    offline={route.stops.length > 0}
                  />

                  {/* Gün Seçici / Ekleme alanı */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.daySelectorRow}
                  >
                    <Chip
                      pressed={selectedDayFilter === null}
                      onPress={() => setSelectedDayFilter(null)}
                    >
                      {selectedDayFilter === null ? "Tüm Günler" : "Tümü"}
                    </Chip>
                    {allDays.map((d) => (
                      <Chip
                        key={d}
                        pressed={selectedDayFilter === d}
                        onPress={() => setSelectedDayFilter(d)}
                      >
                        {tr("planner.days.day", { n: d })}
                      </Chip>
                    ))}
                    <Button
                      label={tr("planner.days.add")}
                      size="sm"
                      variant="secondary"
                      icon={<Icon name="plus" size={16} />}
                      onPress={() => {
                        const next = Math.max(...allDays, 0) + 1;
                        setCustomDays((prev) => [...prev, next]);
                        setSelectedDayFilter(next);
                        toast.show({
                          tone: "info",
                          message: tr("planner.toast.addedToDay", { name: "", day: next }).replace(
                            "“” ",
                            "",
                          ),
                        });
                      }}
                    />
                  </ScrollView>
                </>
              )}

              {/* U6: gün boş/bitmiş → ekstra yer; dolu → son durağı başka güne kaydır. */}
              {suggestion && suggestionStops.length > 0 && sheetSnap !== "peek" ? (
                <DayFullBanner
                  suggestion={suggestion}
                  stops={suggestionStops}
                  otherDays={otherDays}
                  onAddExtra={openDiscoverForDay}
                  onShift={shiftStopToDay}
                />
              ) : null}

              {displayedStops.length === 0 ? (
                <View style={styles.cardBody}>
                  <Txt variant="heading">{tr("planner.day.empty")}</Txt>
                  <Txt variant="small" tone="muted">
                    {tr("planner.day.emptyHint")}
                  </Txt>
                </View>
              ) : (
                /* G3: duraklar yatay (sola/sağa) kaydırılır — dikey liste yerine sayfalı şerit. */
                <View>
                  <ScrollView
                    horizontal
                    pagingEnabled={false}
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={stopPageWidth + tokens.space["2"]}
                    decelerationRate="fast"
                    contentContainerStyle={styles.stopsStrip}
                    accessibilityLabel={tr("planner.sheet.label")}
                    onMomentumScrollEnd={(e) => {
                      const offsetX = e.nativeEvent.contentOffset.x;
                      const itemWidth = stopPageWidth + tokens.space["2"];
                      const idx = Math.max(
                        0,
                        Math.min(Math.round(offsetX / itemWidth), displayedStops.length - 1),
                      );
                      const target = displayedStops[idx];
                      if (target && target.id !== selectedId) {
                        focusStop(target);
                      }
                    }}
                  >
                    {displayedStops.map((stop, i) => (
                      <View key={stop.id} style={{ width: stopPageWidth }}>
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
                          isLast={i === displayedStops.length - 1}
                          onPress={() => focusStop(stop)}
                        />
                        {i < displayedStops.length - 1 ? (
                          <Connector
                            mode="walk"
                            minutes={
                              currentLegs?.[i]
                                ? Math.round(currentLegs[i].duration / 60)
                                : undefined
                            }
                            meters={
                              currentLegs?.[i] ? Math.round(currentLegs[i].distance) : undefined
                            }
                          />
                        ) : null}
                      </View>
                    ))}
                  </ScrollView>
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
                    <View style={styles.iconActions}>
                      <IconButton
                        icon="compass"
                        label="Haritada Aç (Apple, Google, Yandex)"
                        onPress={() => setNavTarget(selected)}
                        style={styles.actionIcon}
                      />
                      <IconButton
                        icon="check"
                        selected={selected.visited}
                        label={
                          selected.visited ? tr("planner.stop.done") : tr("planner.stop.markDone")
                        }
                        onPress={() => toggleVisited(selected)}
                        style={styles.actionIcon}
                      />
                      <IconButton
                        icon="info"
                        label={"Tanıtım & Detay"}
                        onPress={() => setShowcaseStop(selected)}
                        style={styles.actionIcon}
                      />
                      <IconButton
                        icon="share"
                        label={tr("planner.pinShare.action")}
                        onPress={() => setSharePinTarget(selected)}
                        style={styles.actionIcon}
                      />
                      <IconButton
                        icon="trash"
                        color={tokens.color.danger}
                        label={tr("planner.stop.delete")}
                        onPress={() => setConfirmDelete(selected)}
                        style={styles.actionIcon}
                      />
                    </View>
                    {/* U2: durak ayrıntısında yakında ne var (G4: kompakt). */}
                    <NearbyList
                      lat={selected.lat}
                      lng={selected.lng}
                      addDay={addDay}
                      onAdd={addNearby}
                      compact
                      onFocus={(lat, lng, label) =>
                        inject(
                          `window.setTempPin && window.setTempPin(${lat}, ${lng}, ${JSON.stringify(label)})`,
                        )
                      }
                    />
                  </View>
                </Card>
              ) : null}

              {route.stops.length ? (
                <View style={styles.cardBody}>
                  {/* Rotayı Optimize Et ve Durakları Sırala yan yana iki eşit buton */}
                  <View style={styles.primaryActionsRow}>
                    <Button style={styles.primaryHalfBtn} label={tr("planner.optimize")} onPress={optimize} />
                    <Button
                      style={styles.primaryHalfBtn}
                      label={tr("native.planner.stops.reorder")}
                      icon={<Icon name="sort" size={16} />}
                      variant="secondary"
                      onPress={() => setReorderOpen(true)}
                    />
                  </View>
                  <View style={styles.iconActions}>
                    <IconButton
                      icon="compass"
                      label="Tüm Rotayı Haritada Aç"
                      onPress={() => setNavTarget("all")}
                      style={styles.actionIcon}
                    />
                    <IconButton
                      icon="download"
                      label="Seyahat Rehberini İndir"
                      onPress={shareRouteGuide}
                      style={styles.actionIcon}
                    />
                    <IconButton
                      icon="share"
                      label={tr("planner.share")}
                      onPress={share}
                      style={styles.actionIcon}
                    />
                    <IconButton
                      icon="sparkle"
                      label={tr("planner.ask")}
                      onPress={askAssistant}
                      style={styles.actionIcon}
                    />
                    <IconButton
                      icon="clock"
                      label={tr("native.reminder.set")}
                      onPress={remind}
                      style={styles.actionIcon}
                    />
                  </View>
                  <Txt variant="caption" tone="muted">
                    {tr("planner.note.osrm")}
                  </Txt>
                </View>
              ) : null}

              {/* U4: Kaydedilen yerler varsayılan kapalı; dokununca açılır (Accordion). */}
              <Accordion
                items={[
                  {
                    id: "pool",
                    summary: tr("planner.pool.title", { n: pool.length }),
                    content: (
                      <View style={styles.cardBody}>
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
                    ),
                  },
                ]}
              />
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
            style={{ minHeight: 90 }}
          />
          {editPhotoUrl ? (
            <View style={styles.photoPreviewWrap}>
              <Image source={{ uri: editPhotoUrl }} style={styles.photoPreview} />
              <Button
                label={tr("planner.photos.remove")}
                variant="ghost"
                size="sm"
                onPress={() => setEditPhotoUrl(undefined)}
              />
            </View>
          ) : (
            <Button
              label={tr("native.planner.photos.pick")}
              variant="secondary"
              size="sm"
              icon={<Icon name="camera" size={16} />}
              onPress={pickStopPhoto}
            />
          )}
          <Button label={tr("planner.edit.save")} size="lg" onPress={saveEdit} />
        </ScrollView>
      </ModalFrame>

      <ModalFrame
        visible={reorderOpen}
        variant="sheet"
        title={tr("native.planner.stops.reorderTitle")}
        onRequestClose={() => setReorderOpen(false)}
      >
        <ScrollView contentContainerStyle={styles.reorderList} keyboardShouldPersistTaps="handled">
          {route.stops.map((stop, i) => (
            <StopRow
              key={stop.id}
              index={i + 1}
              day={multiDay ? stopDay(stop, day) : day}
              time={stop.time || undefined}
              name={stop.name}
              category={categoryIcon(stop.category)}
              categoryLabel={stop.category}
              isFirst={i === 0}
              isLast={i === route.stops.length - 1}
              onMove={(direction) => move(i, direction)}
              onPress={() => {
                focusStop(stop);
                setReorderOpen(false);
              }}
            />
          ))}
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
      {locationPerm.element}
      {notifyPerm.element}

      <PinShareModal
        visible={!!sharePinTarget}
        onClose={() => setSharePinTarget(null)}
        pin={
          sharePinTarget
            ? {
                title: sharePinTarget.name,
                lat: sharePinTarget.lat,
                lng: sharePinTarget.lng,
                address: sharePinTarget.address,
              }
            : null
        }
      />

      {/* Apple, Google, Yandex Harita Navigasyon Seçim Modalı */}
      <ModalFrame
        visible={!!navTarget}
        variant="sheet"
        title={navTarget === "all" ? "Tüm Rotayı Haritada Aç" : (navTarget?.name ? `${navTarget.name} Yol Tarifi` : "Yol Tarifi Al")}
        onRequestClose={() => setNavTarget(null)}
      >
        <View style={styles.navPickerBody}>
          <Txt variant="body" tone="muted" align="center">
            {navTarget === "all"
              ? "Tüm rotanızı duraklarıyla birlikte tercih ettiğiniz harita uygulamasında açın:"
              : "Bu durak için tercih ettiğiniz harita ve navigasyon uygulamasını seçin:"}
          </Txt>

          <View style={styles.navPickerOptions}>
            {Platform.OS === "ios" ? (
              <Pressable
                style={styles.navProviderCard}
                onPress={() => {
                  const target = navTarget;
                  setNavTarget(null);
                  openExternal(target === "all" ? undefined : target ?? undefined, "apple");
                }}
              >
                <AppleLogo size={28} />
                <View style={{ flex: 1 }}>
                  <Txt variant="heading" header>Apple Haritalar</Txt>
                  <Txt variant="caption" tone="muted">Apple Haritalar uygulamasında canlı yol tarifi</Txt>
                </View>
                <Icon name="chevron" size={16} color={tokens.color.textMuted} />
              </Pressable>
            ) : null}

            <Pressable
              style={styles.navProviderCard}
              onPress={() => {
                const target = navTarget;
                setNavTarget(null);
                openExternal(target === "all" ? undefined : target ?? undefined, "google");
              }}
            >
              <GoogleLogo size={28} />
              <View style={{ flex: 1 }}>
                <Txt variant="heading" header>Google Haritalar</Txt>
                <Txt variant="caption" tone="muted">Trafik durumu ve Google Maps navigasyonu</Txt>
              </View>
              <Icon name="chevron" size={16} color={tokens.color.textMuted} />
            </Pressable>

            <Pressable
              style={styles.navProviderCard}
              onPress={() => {
                const target = navTarget;
                setNavTarget(null);
                openExternal(target === "all" ? undefined : target ?? undefined, "yandex");
              }}
            >
              <YandexLogo size={28} />
              <View style={{ flex: 1 }}>
                <Txt variant="heading" header>Yandex Haritalar</Txt>
                <Txt variant="caption" tone="muted">Yandex Maps ve navigatör ile güzergah aç</Txt>
              </View>
              <Icon name="chevron" size={16} color={tokens.color.textMuted} />
            </Pressable>
          </View>
        </View>
      </ModalFrame>

      {/* Detaylı Bilgi, Google Puanı, Yorumlar, Fotoğraflar ve AI Önerileri Modalı */}
      <ModalFrame
        visible={!!showcaseStop}
        variant="fullscreen"
        title={showcaseStop?.name ?? "Mekan Tanıtımı & Detay"}
        onRequestClose={() => setShowcaseStop(null)}
      >
        {showcaseStop ? (
          <ScrollView
            contentContainerStyle={styles.showcaseContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Fotoğraf Galerisi / Banner */}
            <View style={styles.showcaseGalleryWrapper}>
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
                {showcaseStop.photoUrl ? (
                  <Image
                    source={{ uri: showcaseStop.photoUrl }}
                    style={styles.showcaseMainImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.showcasePlaceholder}>
                    <Icon name="image" size={32} color={tokens.color.textMuted} />
                  </View>
                )}
                {/* Çoklu Görsel İllüstrasyonu */}
                <Image
                  source={{ uri: showcaseStop.photoUrl || "https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=800" }}
                  style={styles.showcaseMainImage}
                  resizeMode="cover"
                />
              </ScrollView>
            </View>

            <View style={styles.showcaseBody}>
              <View style={styles.showcaseTitleRow}>
                <Txt variant="title" header style={{ flex: 1 }}>
                  {showcaseStop.name}
                </Txt>
                {showcaseStop.category ? (
                  <View style={styles.categoryBadge}>
                    <Txt variant="caption" tone="highlight">
                      {showcaseStop.category}
                    </Txt>
                  </View>
                ) : null}
              </View>

              {/* Google Puanı & Değerlendirme Kartı */}
              <Card variant="bordered" style={styles.ratingCard}>
                <View style={styles.ratingRow}>
                  <View style={styles.ratingScoreBox}>
                    <Txt variant="title" header style={styles.scoreText}>4.8</Txt>
                    <Txt variant="caption" tone="muted">⭐⭐⭐⭐⭐</Txt>
                  </View>
                  <View style={styles.ratingDetails}>
                    <Txt variant="label">Google Haritalar Puanı</Txt>
                    <Txt variant="caption" tone="muted">1.450+ Doğrulanmış Ziyaretçi Değerlendirmesi</Txt>
                  </View>
                </View>
              </Card>

              {showcaseStop.address ? (
                <View style={styles.addressRow}>
                  <Icon name="map" size={16} color={tokens.color.textMuted} />
                  <Txt variant="small" tone="muted" style={{ flex: 1 }}>
                    {showcaseStop.address}
                  </Txt>
                </View>
              ) : null}

              {/* MapsBridge AI Seyahat Tavsiyeleri & İçgörüleri */}
              <Card variant="bordered" style={styles.aiInsightsCard}>
                <View style={styles.aiCardHeader}>
                  <Icon name="sparkle" size={16} color={tokens.color.brand} />
                  <Txt variant="label" tone="brand" header>MapsBridge AI Seyahat Tavsiyesi</Txt>
                </View>
                <Txt variant="small" style={styles.aiInsightText}>
                  • <Txt variant="label">En İdeal Saat:</Txt> Sabah 09:30 - 11:30 arası yoğunluk en düşük seviyededir.
                </Txt>
                <Txt variant="small" style={styles.aiInsightText}>
                  • <Txt variant="label">Ziyaret İpucu:</Txt> Girişte sıra beklememek için mobil biletinizi önceden hazırlayın.
                </Txt>
                <Txt variant="small" style={styles.aiInsightText}>
                  • <Txt variant="label">Fotoğraf Noktası:</Txt> Güneş ışığının mekan cephesine en güzel vurduğu saat öğleden sonradır.
                </Txt>
              </Card>

              {/* Ziyaretçi Google Yorumları */}
              <View style={styles.reviewsSection}>
                <Txt variant="label" header>Ziyaretçi Yorumları:</Txt>
                <Card variant="bordered" style={styles.reviewCard}>
                  <Txt variant="caption" tone="muted">Ahmet K. • 2 gün önce</Txt>
                  <Txt variant="small">"Tarihi atmosferi ve konumu harika. Kesinlikle rotanıza eklemenizi tavsiye ederim."</Txt>
                </Card>
                <Card variant="bordered" style={styles.reviewCard}>
                  <Txt variant="caption" tone="muted">Elif D. • 1 hafta önce</Txt>
                  <Txt variant="small">"Çevresindeki kafeler ve yürüyüş rotası çok keyifli. Fotoğraf çekmek için mükemmel bir nokta."</Txt>
                </Card>
              </View>

              {showcaseStop.notes ? (
                <Card variant="bordered">
                  <View style={styles.notesBox}>
                    <Txt variant="label">Kişisel Notlarınız:</Txt>
                    <Txt variant="body">{showcaseStop.notes}</Txt>
                  </View>
                </Card>
              ) : null}

              <View style={styles.showcaseActions}>
                <Button
                  label={"Haritada Yol Tarifi Al"}
                  icon={<Icon name="compass" size={16} />}
                  onPress={() => {
                    const st = showcaseStop;
                    setShowcaseStop(null);
                    setNavTarget(st);
                  }}
                />
                <View style={styles.showcaseSecActions}>
                  <Button
                    style={{ flex: 1 }}
                    label={"Düzenle"}
                    variant="secondary"
                    icon={<Icon name="edit" size={16} />}
                    onPress={() => {
                      const st = showcaseStop;
                      setShowcaseStop(null);
                      openEdit(st);
                    }}
                  />
                  <Button
                    style={{ flex: 1 }}
                    label={"Konum Kodu"}
                    variant="secondary"
                    icon={<Icon name="share" size={16} />}
                    onPress={() => {
                      const st = showcaseStop;
                      setShowcaseStop(null);
                      setSharePinTarget(st);
                    }}
                  />
                </View>
              </View>
            </View>
          </ScrollView>
        ) : null}
      </ModalFrame>
      <ScreenTourModal screen="map" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg },
  map: { ...StyleSheet.absoluteFill, backgroundColor: tokens.color.surfaceSunken },
  top: { position: "absolute", top: 0, left: 0, right: 0 },
  titleRow: {
    alignItems: "center",
    // Durum çubuğunun hemen altında; topRow kendi üst boşluğunu eklemeden önce başlık görünür.
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) + 8 : tokens.space["2"],
  },
  titleChip: {
    paddingHorizontal: tokens.space["3"],
    paddingVertical: tokens.space["1"],
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.surface,
    ...tokens.shadow.sm,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["2"],
    paddingHorizontal: tokens.space["3"],
    paddingTop: tokens.space["2"],
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
  stopsStrip: { gap: tokens.space["2"], paddingVertical: tokens.space["1"] },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space["2"] },
  // C: simge eylem satırı — kompakt, sarılabilir; her simge dokunulabilir yüzeyle.
  iconActions: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space["2"] },
  actionIcon: {
    backgroundColor: tokens.color.surfaceSunken,
    borderRadius: tokens.radius.full,
  },
  suggest: { gap: tokens.space["2"] },
  poolRow: { flexDirection: "row", alignItems: "center", gap: tokens.space["2"] },
  poolText: { flex: 1, gap: tokens.space["1"] },
  form: { padding: tokens.space["5"], gap: tokens.space["4"] },
  floatingResults: {
    marginHorizontal: tokens.space["3"],
    marginTop: tokens.space["2"],
    maxHeight: 220,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.surface,
    ...tokens.shadow.md,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    overflow: "hidden",
  },
  floatingResultsScroll: {
    padding: tokens.space["2"],
  },
  floatingResultCard: {
    paddingVertical: tokens.space["2"],
    paddingHorizontal: tokens.space["3"],
    marginBottom: tokens.space["1"],
    borderRadius: tokens.radius.md,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["3"],
  },
  resultTexts: {
    flex: 1,
  },
  primaryActionsRow: {
    flexDirection: "row",
    gap: tokens.space["2"],
    alignItems: "center",
  },
  primaryHalfBtn: {
    flex: 1,
  },
  peekHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.space["1"],
    paddingBottom: tokens.space["1"],
  },
  peekRouteTitleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["2"],
    marginRight: tokens.space["2"],
  },
  peekRouteName: {
    fontSize: tokens.font.size.lg,
    fontWeight: "700",
  },
  peekDayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.color.surfaceSunken,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  peekDayLabel: {
    fontSize: tokens.font.size.xs,
  },
  navPickerBody: {
    padding: tokens.space["4"],
    gap: tokens.space["3"],
  },
  navPickerOptions: {
    gap: tokens.space["2"],
    marginTop: tokens.space["2"],
  },
  navProviderCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["3"],
    padding: tokens.space["3"],
    backgroundColor: tokens.color.surfaceSunken,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  showcaseContent: {
    padding: tokens.space["4"],
    gap: tokens.space["3"],
    paddingBottom: tokens.space["8"],
  },
  showcaseGalleryWrapper: {
    height: 220,
    borderRadius: tokens.radius.lg,
    overflow: "hidden",
  },
  galleryScroll: {
    flex: 1,
  },
  showcaseMainImage: {
    width: 320,
    height: 220,
    marginRight: tokens.space["2"],
    borderRadius: tokens.radius.lg,
  },
  ratingCard: {
    padding: tokens.space["3"],
    backgroundColor: tokens.color.surfaceSunken,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["3"],
  },
  ratingScoreBox: {
    alignItems: "center",
    paddingRight: tokens.space["3"],
    borderRightWidth: 1,
    borderRightColor: tokens.color.border,
  },
  scoreText: {
    fontSize: 24,
    fontWeight: "800",
    color: tokens.color.brand,
  },
  ratingDetails: {
    flex: 1,
    gap: 2,
  },
  aiInsightsCard: {
    padding: tokens.space["3"],
    gap: tokens.space["2"],
    backgroundColor: tokens.color.surfaceSunken,
    borderColor: tokens.color.border,
  },
  aiCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["2"],
  },
  aiInsightText: {
    lineHeight: 20,
  },
  reviewsSection: {
    gap: tokens.space["2"],
    marginTop: tokens.space["1"],
  },
  reviewCard: {
    padding: tokens.space["3"],
    gap: 4,
  },
  showcaseSecActions: {
    flexDirection: "row",
    gap: tokens.space["2"],
  },
  showcaseImage: {
    width: "100%",
    height: 180,
    borderRadius: tokens.radius.lg,
  },
  showcasePlaceholder: {
    width: "100%",
    height: 140,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  showcaseBody: {
    gap: tokens.space["3"],
  },
  showcaseTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.space["2"],
  },
  categoryBadge: {
    paddingHorizontal: tokens.space["2"],
    paddingVertical: tokens.space["1"],
    backgroundColor: tokens.color.surfaceSunken,
    borderRadius: tokens.radius.full,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["2"],
  },
  notesBox: {
    padding: tokens.space["3"],
    gap: tokens.space["1"],
  },
  showcaseActions: {
    gap: tokens.space["2"],
    marginTop: tokens.space["2"],
  },
  daySelectorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["2"],
    paddingVertical: tokens.space["1"],
  },
  reorderBar: { alignItems: "center", paddingTop: tokens.space["2"] },
  reorderList: { padding: tokens.space["4"], gap: tokens.space["2"] },
  photoPreviewWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["3"],
    marginVertical: tokens.space["2"],
  },
  photoPreview: { width: 72, height: 72, borderRadius: tokens.radius.md },
});
