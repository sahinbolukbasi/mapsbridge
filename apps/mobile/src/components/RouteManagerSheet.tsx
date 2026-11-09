import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { tripStore, type ActiveRoute } from "../services/tripStore";
import { Button, Card, ConfirmDialog, IconButton, ModalFrame, TextField, Txt } from "../ui";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";

// G2: Harita üstündeki "Rota yönetimi" düğmesinin açtığı kapatılabilir alt sayfa (ModalFrame
// variant="sheet" — haritanın kalıcı BottomSheet'iyle çakışmaması için modal kullanılır). Rota
// listesi + Yeni rota oluştur, Adını düzenle, Sil, Kullanıcılarla paylaş. İş mantığı tripStore'da
// (PlanScreen ile aynı kaynak, I12 kalıcılık değişmez). Paylaşım mevcut bağlantı tabanlı paylaşımı
// (onShare) yeniden kullanır; yeni backend erişim kalıbı eklemez.
interface RouteManagerSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Rota seçilip harita görünümüne dönülür (aktif rota değiştirilir). */
  onOpenRoute: (route: ActiveRoute) => void;
  /** Rotayı paylaş (bağlantı tabanlı; harita ekranındaki share() geçilir). */
  onShare: (route: ActiveRoute) => void;
  /** Misafir: kalıcılık yalnız cihazda; silme metni buna göre. */
  guest?: boolean;
}

export function RouteManagerSheet({
  visible,
  onClose,
  onOpenRoute,
  onShare,
  guest = false,
}: RouteManagerSheetProps) {
  const [routes, setRoutes] = useState<ActiveRoute[]>(tripStore.getAllRoutes());
  const [activeId, setActiveId] = useState<string>(tripStore.getActiveRoute().id);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [renaming, setRenaming] = useState<ActiveRoute | null>(null);
  const [renameText, setRenameText] = useState("");
  const [deleting, setDeleting] = useState<ActiveRoute | null>(null);

  useEffect(
    () =>
      tripStore.subscribe(() => {
        setRoutes([...tripStore.getAllRoutes()]);
        setActiveId(tripStore.getActiveRoute().id);
      }),
    [],
  );

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
    onClose();
    onOpenRoute(tripStore.getActiveRoute());
  };

  return (
    <>
      <ModalFrame
        visible={visible && !creating && !renaming && !deleting}
        variant="sheet"
        title={tr("planner.trips.title")}
        onRequestClose={onClose}
      >
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <Txt variant="label" tone="muted">
              {tr("trip.day.stops", { n: routes.length })}
            </Txt>
            <Button label={tr("planner.trips.new")} size="sm" onPress={() => setCreating(true)} />
          </View>

          {routes.length === 0 ? (
            <Card variant="bordered">
              <View style={styles.empty}>
                <Txt variant="small" tone="muted">
                  {tr("planner.trips.empty")}
                </Txt>
                <Button label={tr("planner.trips.create")} onPress={() => setCreating(true)} />
              </View>
            </Card>
          ) : (
            routes.map((route) => (
              <Card key={route.id} variant={route.id === activeId ? "raised" : "bordered"}>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Txt variant="label" numberOfLines={2}>
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
                    onPress={() => {
                      tripStore.switchActiveRoute(route.id);
                      onClose();
                      onOpenRoute(route);
                    }}
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
                    icon="share"
                    label={`${tr("planner.share")}: ${route.name}`}
                    onPress={() => onShare(route)}
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
        </ScrollView>
      </ModalFrame>

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
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: tokens.space["4"], paddingBottom: tokens.space["8"], gap: tokens.space["3"] },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  empty: { gap: tokens.space["3"], padding: tokens.space["4"] },
  row: { flexDirection: "row", alignItems: "center", gap: tokens.space["1"] },
  flex: { flex: 1, gap: tokens.space["1"] },
  form: { padding: tokens.space["5"], gap: tokens.space["4"] },
});
