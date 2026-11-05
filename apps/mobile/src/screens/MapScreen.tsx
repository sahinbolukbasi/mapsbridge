import React, { useEffect, useMemo, useRef, useState } from "react";
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
  StopRow,
  TextField,
  Txt,
  dayColor,
  isReducedMotion,
  mapLabel,
  type AuthGateReason,
} from "../ui";
import { buildLeafletHtml, legsKeyOf, type MapStopPayload } from "../map/leaflet-html";
import { lookupPoint, searchPlaces, type PlaceCandidate } from "../map/places";
import { optimizeStopOrder } from "../trip/optimize";
import { categoryIcon } from "../trip/category";
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
// - Çevrimdışı (I12): durak listesi tripStore/AsyncStorage'dan gelir, harita yüklenemese de kalır.
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

function stopsPayload(route: ActiveRoute, selectedId: string | null): MapStopPayload[] {
  return route.stops.map((s, idx) => ({
    id: s.id,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    index: idx + 1,
    color: dayColor(route.day || 1),
    isSelected: s.id === selectedId,
    visited: !!s.visited,
  }));
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
  const [results, setResults] = useState<PlaceCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [candidate, setCandidate] = useState<PlaceCandidate | null>(null);
  const [looking, setLooking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
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
      }),
    [],
  );

  const inject = (js: string) => webRef.current?.injectJavaScript(`${js}; true;`);

  // Duraklar / seçim değişince harita güncellenir.
  useEffect(() => {
    inject(
      `window.updateStops && window.updateStops(${JSON.stringify(stopsPayload(route, selectedId))})`,
    );
  }, [route, selectedId]);

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
      const stop = route.stops.find((s) => s.id === data.id);
      if (stop) {
        focusStop(stop);
        record(stop, "pin_select");
      }
    } else if (
      data.type === "MAP_CLICK" &&
      typeof data.lat === "number" &&
      typeof data.lng === "number"
    ) {
      setLooking(true);
      setSelectedId(null);
      setResults(null);
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
    } else if (data.type === "MAP_READY") {
      setMapError(false);
      inject(
        `window.updateStops && window.updateStops(${JSON.stringify(stopsPayload(route, selectedId))})`,
      );
    } else if (data.type === "LOCATION_ERROR") {
      setNotice(tr("planner.locate.failed"));
    }
  };

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 3) {
      setNotice(tr("planner.search.hint"));
      return;
    }
    setSearching(true);
    setCandidate(null);
    const found = await searchPlaces(q);
    setResults(found);
    setSearching(false);
  };

  const addPlace = (place: PlaceCandidate) => {
    const stop: TripStop = {
      id: `stop-${Date.now()}`,
      name: place.name,
      category: place.category,
      time: "",
      duration: "",
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    };
    tripStore.addStop(stop);
    record(stop, "route_add");
    setCandidate(null);
    setResults(null);
    setQuery("");
    inject("window.setTempPin && window.setTempPin(null)");
    setNotice(tr("planner.toast.addedToDay", { name: stop.name, day: route.day || 1 }));
  };

  const move = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    const stop = route.stops[index];
    tripStore.reorderStops(index, target);
    setNotice(
      tr(direction === "up" ? "planner.toast.movedUp" : "planner.toast.movedDown", {
        name: stop.name,
      }),
    );
  };

  const optimize = () => {
    const preview = optimizeStopOrder(route.stops);
    if (!preview) {
      setNotice(tr("planner.optimize.none"));
      return;
    }
    const byId = new Map(route.stops.map((s) => [s.id, s]));
    tripStore.setStops(preview.optimizedStopIds.map((id) => byId.get(id)!).filter(Boolean));
    setNotice(
      tr("planner.optimize.done", { km: String(preview.savedDistanceKm).replace(".", ",") }),
    );
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
    setNotice(tr("planner.toast.saved"));
  };

  const currentLegs = legs.key === legsKeyOf(route.stops) ? legs.legs : null;
  const legsKnown = currentLegs && currentLegs.length === Math.max(0, route.stops.length - 1);
  const totalMeters = legsKnown ? currentLegs.reduce((a, l) => a + l.distance, 0) : undefined;
  const totalMinutes = legsKnown
    ? Math.round(currentLegs.reduce((a, l) => a + l.duration, 0) / 60)
    : undefined;
  const selected = route.stops.find((s) => s.id === selectedId) ?? null;
  const day = route.day || 1;

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
              placeholder={tr("planner.search.label")}
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
          {notice ? (
            <Notice tone="info" action={{ label: tr("ui.close"), onPress: () => setNotice(null) }}>
              {notice}
            </Notice>
          ) : null}
          {mapError ? (
            <Notice tone="warning" title={tr("planner.map.errorTitle")}>
              {tr("planner.map.errorBody")}
            </Notice>
          ) : null}

          {searching || looking ? (
            <Txt variant="small" tone="muted">
              {looking ? tr("planner.point.loading") : tr("ui.loading")}
            </Txt>
          ) : null}

          {candidate ? (
            <Card variant="bordered">
              <View style={styles.cardBody}>
                <Txt variant="eyebrow" tone="highlight">
                  {tr("planner.point.eyebrow")}
                </Txt>
                <Txt variant="heading" header>
                  {candidate.name}
                </Txt>
                {candidate.address ? (
                  <Txt variant="small" tone="muted">
                    {candidate.address}
                  </Txt>
                ) : null}
                <Txt variant="caption" tone="muted">
                  {candidate.category}
                </Txt>
                <View style={styles.actions}>
                  <Button
                    label={tr("planner.place.addToDayN", { n: day })}
                    onPress={() => addPlace(candidate)}
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
              </View>
            </Card>
          ) : null}

          {results ? (
            <View style={styles.cardBody}>
              <Txt variant="heading" header>
                {tr("planner.search.results")}
              </Txt>
              {results.length === 0 ? (
                <Txt variant="small" tone="muted">
                  {tr("planner.search.empty")}
                </Txt>
              ) : (
                results.map((place) => (
                  <Card
                    key={`${place.lat},${place.lng}`}
                    variant="bordered"
                    label={`${place.name}, ${place.address}`}
                    onPress={() => {
                      setCandidate(place);
                      setResults(null);
                      inject(
                        `window.setTempPin && window.setTempPin(${place.lat}, ${place.lng}, ${JSON.stringify(place.name)})`,
                      );
                    }}
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

          <DayHeader
            title={route.name || tr("planner.untitled")}
            eyebrow={tr("planner.days.day", { n: day })}
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
                    day={day}
                    name={stop.name}
                    category={categoryIcon(stop.category)}
                    categoryLabel={
                      stop.visited ? `${stop.category} · ${tr("planner.stop.done")}` : stop.category
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
                      meters={currentLegs?.[i] ? Math.round(currentLegs[i].distance) : undefined}
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
                    label={selected.visited ? tr("planner.stop.done") : tr("planner.stop.markDone")}
                    variant="secondary"
                    size="sm"
                    onPress={() => tripStore.toggleVisited(selected.id)}
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
          if (confirmDelete) tripStore.removeStop(confirmDelete.id);
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
  form: { padding: tokens.space["5"], gap: tokens.space["4"] },
});
