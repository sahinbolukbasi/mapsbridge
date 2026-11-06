"use client";
import { useState } from "react";
import { Button, ConfirmDialog, EmptyState, Field, Icon, IconButton, Input, cx } from "../ui";
import { useLocale } from "../../lib/locale-context";
import type { useTravelPlanner } from "../../lib/trip/use-travel-planner";
import type { PlannerMode } from "./travel-planner-sidebar";
import "./travel-planner.css";

/**
 * "Rotalarım" (`/maps/?view=trips`, design §5.3): cihazdaki/hesaptaki gezilerin listesi.
 * Seçim planı açar; yeni rota oluşturulabilir; silme ConfirmDialog ister (design §12).
 * Görünümün başlığı (h2 "Rotalarım") planlayıcı araç çubuğundadır; burada tekrarlanmaz.
 */
export function TripPicker({
  planner,
  mode,
  onOpen,
}: {
  planner: ReturnType<typeof useTravelPlanner>;
  mode: PlannerMode;
  onOpen: () => void;
}) {
  const { t } = useLocale();
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  // Misafirin ya da henüz sunucuya yazılmamış ("trip-…") gezinin kaydı yalnızca bu cihazdadır.
  const deviceOnly = mode === "guest" || Boolean(pendingDelete?.id.startsWith("trip-"));
  return (
    <div className="trip-picker">
      {planner.trips.length === 0 ? (
        <EmptyState
          icon="route"
          level={3}
          title={t("planner.trips.empty", "Henüz kayıtlı rota yok")}
        />
      ) : (
        <ul className="trip-picker__list">
          {planner.trips.map((trip) => {
            const active = trip.id === planner.activeTripId;
            const stops = t(
              trip.pins.length === 1 ? "trip.day.stops.one" : "trip.day.stops",
              "{n} durak",
            ).replace("{n}", String(trip.pins.length));
            return (
              <li key={trip.id} className={cx("trip-picker__item", active && "is-active")}>
                <button
                  type="button"
                  className="trip-picker__open"
                  aria-current={active || undefined}
                  onClick={() => {
                    planner.switchTrip(trip.id);
                    onOpen();
                  }}
                >
                  <span className="trip-picker__name">{trip.title}</span>
                  <span className="trip-picker__meta">
                    {trip.destination ? `${stops} · ${trip.destination}` : stops}
                  </span>
                </button>
                {planner.trips.length > 1 && (
                  <IconButton
                    icon="trash"
                    label={`${t("planner.trips.delete", "Rotayı sil")}: ${trip.title}`}
                    onClick={() => setPendingDelete({ id: trip.id, title: trip.title })}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      <form
        className="trip-picker__form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) {
            setTitleError(t("planner.trips.titleRequired", "Rota adı gerekli."));
            return;
          }
          planner.createTrip(title.trim(), destination.trim() || undefined);
          setTitle("");
          setDestination("");
          setTitleError(null);
          onOpen();
        }}
      >
        <h3 className="trip-picker__subtitle">{t("planner.trips.new", "Yeni rota")}</h3>
        <Field label={t("planner.trips.name", "Rota adı")} required error={titleError}>
          {(ids) => (
            <Input
              {...ids}
              value={title}
              maxLength={80}
              autoComplete="off"
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </Field>
        <Field label={t("planner.trips.destination", "Şehir ya da bölge")}>
          {(ids) => (
            <Input
              {...ids}
              value={destination}
              maxLength={80}
              autoComplete="off"
              onChange={(e) => setDestination(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" variant="primary" iconStart={<Icon name="plus" size={20} />}>
          {t("planner.trips.create", "Rota oluştur")}
        </Button>
      </form>
      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("planner.trips.deleteTitle", "Rota silinsin mi?")}
        consequence={(deviceOnly
          ? t("planner.trips.deleteBodyDevice", "“{name}” ve tüm durakları bu cihazdan silinir.")
          : t(
              "planner.trips.deleteBody",
              "“{name}” ve tüm durakları bu cihazdan ve hesabından silinir.",
            )
        ).replace("{name}", pendingDelete?.title ?? "")}
        confirmLabel={t("planner.trips.delete", "Rotayı sil")}
        tone="danger"
        onConfirm={async () => {
          if (pendingDelete) planner.deleteTrip(pendingDelete.id);
        }}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
