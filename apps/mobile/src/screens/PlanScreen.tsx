import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { tripStore, type ActiveRoute } from "../services/tripStore";
import { ScreenTourModal } from "../components/ScreenTourModal";
import {
  AuthGate,
  Button,
  Card,
  ConfirmDialog,
  IconButton,
  ModalFrame,
  Notice,
  Screen,
  ScreenHeader,
  Skeleton,
  TextField,
  Txt,
} from "../ui";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";

// Planla sekmesinin ilk ekranı (design §5.3, karar S10): Rotalarım listesi → rota görünümü
// (MapScreen, Planla yığınında). Aç, oluştur, yeniden adlandır, sil (ConfirmDialog). Misafirde
// rotalar yalnız cihazda kalır (tripStore misafir sahibi, design §6.3); üst bilgi kaydetmek için
// hesap açmaya çağırır. Kalıcılık tripStore/AsyncStorage'da değişmeden durur (I12).
// FEAT-012: uydurma yürüme süreli/puanlı Pro şablonlar, koordinatı tahmin edilen elle durak ekleme
// ve "%38 tasarruf" metni kaldırıldı; durak ekleme rota görünümünde (arama / haritaya dokunma).
interface PlanScreenProps {
  onOpenMap: (stopId?: string) => void;
  /** Oturumsuz (design §6.3/§6.4): kayıt/paylaşım kimlik kapısını açar. */
  guest?: boolean;
  onRequireAuth?: (mode: "register" | "login") => void;
}

export function PlanScreen({ onOpenMap, guest = false, onRequireAuth }: PlanScreenProps) {
  const [routes, setRoutes] = useState<ActiveRoute[]>(tripStore.getAllRoutes());
  const [activeId, setActiveId] = useState<string>(tripStore.getActiveRoute().id);
  // L (Kriter L / görev 19): eşitleme durumu — veri yüklenirken "hiç rota yok" yanıltması yerine
  // yükleniyor/çevrimdışı gösterilir.
  const [syncState, setSyncState] = useState(tripStore.getSyncState());
  const [creating, setCreating] = useState(false);
  const [sharedRoutes, setSharedRoutes] = useState<Record<string, boolean>>({});
  const [shareFeedbackRoute, setShareFeedbackRoute] = useState<ActiveRoute | null>(null);
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [renaming, setRenaming] = useState<ActiveRoute | null>(null);
  const [renameText, setRenameText] = useState("");
  const [deleting, setDeleting] = useState<ActiveRoute | null>(null);
  const [showAuthGate, setShowAuthGate] = useState(false);

  useEffect(
    () =>
      tripStore.subscribe(() => {
        setRoutes([...tripStore.getAllRoutes()]);
        setActiveId(tripStore.getActiveRoute().id);
        setSyncState(tripStore.getSyncState());
      }),
    [],
  );

  const open = (route: ActiveRoute) => {
    tripStore.switchActiveRoute(route.id);
    onOpenMap();
  };

  const create = () => {
    const name = newName.trim();
    if (!name) {
      setNameError(tr("planner.trips.titleRequired"));
      return;
    }
    tripStore.createRoute(name);
    setNewName("");
    setNameError(undefined);
    setCreating(false);
    onOpenMap();
  };

  return (
    <Screen
      header={
        <ScreenHeader
          title={tr("planner.trips.title")}
          subtitle={tr("nav.desk")}
          right={
            <IconButton
              icon="plus"
              color={tokens.color.buttonPrimaryFg}
              label={tr("planner.trips.new")}
              onPress={() => setCreating(true)}
              style={styles.primaryPlusBtn}
            />
          }
        />
      }
    >
      <ScrollView contentContainerStyle={styles.page}>
        {guest ? (
          <Notice
            tone="info"
            title={tr("gate.banner")}
            action={{ label: tr("gate.register"), onPress: () => setShowAuthGate(true) }}
          />
        ) : null}

        {/* L (görev 19): üye verisi sunucudan çekilemediyse sönük, bloklamayan bilgi — yerel
            (çevrimdışı) rotalar yine gösterilir. */}
        {!guest && syncState === "error" ? (
          <Notice tone="warning" title={tr("planner.sync.offlineTitle")}>
            {tr("planner.sync.offlineBody")}
          </Notice>
        ) : null}

        {routes.length === 0 && !guest && syncState === "syncing" ? (
          /* L (görev 19): veri yüklenirken "hiç rota yok" yerine iskelet gösterilir. */
          <View accessible accessibilityLabel={tr("ui.loading")}>
            <Skeleton variant="card" count={2} />
          </View>
        ) : routes.length === 0 ? (
          <Card variant="bordered">
            <View style={styles.empty}>
              <Txt variant="heading" header>
                {tr("planner.trips.empty")}
              </Txt>
              <Txt variant="small" tone="muted">
                {tr("planner.day.emptyHint")}
              </Txt>
              <Button label={tr("planner.trips.create")} onPress={() => setCreating(true)} />
            </View>
          </Card>
        ) : (
          routes.map((route) => (
            <Card key={route.id} variant={route.id === activeId ? "raised" : "bordered"}>
              <View style={styles.cardContainer}>
                <View style={styles.nameBlock}>
                  <Txt variant="heading" header numberOfLines={2}>
                    {route.name}
                  </Txt>
                  <Txt variant="caption" tone="muted">
                    {tr("trip.day.stops", { n: route.stops.length })}
                  </Txt>
                </View>
                <View style={styles.cardActionRow}>
                  <IconButton
                    icon="map"
                    label={`${tr("home.lastTrip.open")}: ${route.name}`}
                    onPress={() => open(route)}
                    style={styles.cardIconBtn}
                  />
                  <IconButton
                    icon="edit"
                    label={`${tr("planner.trips.name")}: ${route.name}`}
                    onPress={() => {
                      setRenaming(route);
                      setRenameText(route.name);
                    }}
                    style={styles.cardIconBtn}
                  />
                  <IconButton
                    icon="share"
                    selected={!!sharedRoutes[route.id]}
                    color={sharedRoutes[route.id] ? tokens.color.buttonPrimaryFg : undefined}
                    label={`${tr("planner.share")}: ${route.name}`}
                    onPress={() => {
                      setSharedRoutes((prev) => ({ ...prev, [route.id]: true }));
                      setShareFeedbackRoute(route);
                    }}
                    style={[
                      styles.cardIconBtn,
                      sharedRoutes[route.id] && styles.sharedActiveBtn,
                    ]}
                  />
                  <IconButton
                    icon="trash"
                    label={`${tr("planner.trips.delete")}: ${route.name}`}
                    onPress={() => setDeleting(route)}
                    style={styles.cardIconBtn}
                  />
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <ModalFrame
        visible={creating}
        variant="sheet"
        title={tr("planner.trips.new")}
        onRequestClose={() => setCreating(false)}
      >
        <View style={styles.form}>
          <TextField
            label={tr("planner.trips.name")}
            value={newName}
            onChangeText={(text) => {
              setNewName(text);
              if (nameError) setNameError(undefined);
            }}
            error={nameError}
            maxLength={80}
            returnKeyType="done"
            onSubmitEditing={create}
          />
          <Button label={tr("planner.trips.create")} size="lg" onPress={create} />
        </View>
      </ModalFrame>

      <ModalFrame
        visible={!!renaming}
        variant="sheet"
        title={tr("planner.trips.name")}
        onRequestClose={() => setRenaming(null)}
      >
        <View style={styles.form}>
          <TextField
            label={tr("planner.trips.name")}
            value={renameText}
            onChangeText={setRenameText}
            error={renameText.trim() ? undefined : tr("planner.trips.titleRequired")}
            maxLength={80}
          />
          <Button
            label={tr("planner.edit.save")}
            size="lg"
            disabled={!renameText.trim()}
            onPress={() => {
              if (renaming) tripStore.updateRouteName(renaming.id, renameText);
              setRenaming(null);
            }}
          />
        </View>
      </ModalFrame>

      <ConfirmDialog
        visible={!!shareFeedbackRoute}
        title={tr("planner.share")}
        body={tr("planner.trips.sharedPopup")}
        confirmLabel={tr("ui.close")}
        onCancel={() => setShareFeedbackRoute(null)}
        onConfirm={() => setShareFeedbackRoute(null)}
      />

      <ConfirmDialog
        visible={!!deleting}
        title={tr("planner.trips.deleteTitle")}
        body={
          deleting
            ? tr(guest ? "planner.trips.deleteBodyDevice" : "planner.trips.deleteBody", {
                name: deleting.name,
              })
            : undefined
        }
        confirmLabel={tr("planner.trips.delete")}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) tripStore.deleteRoute(deleting.id);
          setDeleting(null);
        }}
      />

      {guest ? (
        <AuthGate
          variant="sheet"
          reason="save"
          visible={showAuthGate}
          onClose={() => setShowAuthGate(false)}
          onRegister={() => {
            setShowAuthGate(false);
            onRequireAuth?.("register");
          }}
          onLogin={() => {
            setShowAuthGate(false);
            onRequireAuth?.("login");
          }}
        />
      ) : null}
      <ScreenTourModal screen="plan" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { padding: tokens.space["4"], paddingBottom: tokens.space["12"], gap: tokens.space["3"] },
  empty: { gap: tokens.space["3"] },
  row: { flexDirection: "row", alignItems: "center", gap: tokens.space["1"] },
  flex: { flex: 1, gap: tokens.space["1"] },
  form: { padding: tokens.space["5"], gap: tokens.space["4"] },
  primaryPlusBtn: {
    backgroundColor: tokens.color.buttonPrimaryBg,
    borderRadius: tokens.radius.full,
  },
  cardContainer: { gap: tokens.space["2"] },
  nameBlock: { gap: tokens.space["1"] },
  cardActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space["2"],
    marginTop: tokens.space["1"],
  },
  cardIconBtn: {
    backgroundColor: tokens.color.surfaceSunken,
    borderRadius: tokens.radius.full,
  },
  sharedActiveBtn: {
    backgroundColor: tokens.color.buttonPrimaryBg,
  },
});
