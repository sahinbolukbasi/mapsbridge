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
  const [creating, setCreating] = useState(false);
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
              label={tr("planner.trips.new")}
              onPress={() => setCreating(true)}
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

        {routes.length === 0 ? (
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
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Txt variant="heading" header numberOfLines={2}>
                    {route.name}
                  </Txt>
                  <Txt variant="caption" tone="muted">
                    {tr("trip.day.stops", { n: route.stops.length })}
                  </Txt>
                </View>
                <Button
                  label={tr("home.lastTrip.open")}
                  size="sm"
                  variant="secondary"
                  hint={route.name}
                  onPress={() => open(route)}
                />
                <IconButton
                  icon="edit"
                  label={`${tr("planner.trips.name")}: ${route.name}`}
                  onPress={() => {
                    setRenaming(route);
                    setRenameText(route.name);
                  }}
                />
                <IconButton
                  icon="trash"
                  label={`${tr("planner.trips.delete")}: ${route.name}`}
                  onPress={() => setDeleting(route)}
                />
              </View>
            </Card>
          ))
        )}

        {routes.length ? (
          <Button
            label={tr("planner.trips.new")}
            variant="secondary"
            onPress={() => setCreating(true)}
          />
        ) : null}
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
});
