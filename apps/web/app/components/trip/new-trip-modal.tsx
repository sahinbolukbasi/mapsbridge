"use client";
// P4 "Yeni rota" penceresi (Increment 3.3): ad, şehir (geocoding/places proxy araması), gün
// sayısı (Stepper), isteğe bağlı başlangıç tarihi, "Asistanla başla". ≥768 ortalı dialog,
// <768 alt sayfa (Modal R10). Şehir koordinatı yalnız arama sonucundan gelir (I1).
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Field, Icon, Input, Modal, Stepper } from "../ui";
import { useLocale } from "../../lib/locale-context";
import { searchPlaces, type GeocodedPlace } from "../../lib/trip/geocoding-service";
import { NEW_TRIP_MAX_DAYS, NEW_TRIP_MIN_DAYS } from "../../lib/trip/planner-logic";
import "./travel-planner.css";

export type NewTripInput = {
  title: string;
  destination?: string;
  days: number;
  startDate?: string;
  center?: { lat: number; lng: number };
};

type CityHit = { label: string; address: string; lat: number; lng: number };

export function NewTripModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: NewTripInput) => void;
}) {
  const { t } = useLocale();
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [picked, setPicked] = useState<CityHit | null>(null);
  const [hits, setHits] = useState<CityHit[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "error">("idle");
  const [days, setDays] = useState(2);
  const [startDate, setStartDate] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const request = useRef(0);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setCity("");
    setPicked(null);
    setHits([]);
    setDays(2);
    setStartDate("");
    setTitleError(null);
  }, [open]);

  // Şehir araması: en az 3 harf, 350 ms gecikme; seçilen sonuçla metin aynıysa yeniden aranmaz.
  useEffect(() => {
    const q = city.trim();
    if (q.length < 3 || (picked && picked.label === q)) {
      request.current++;
      setHits([]);
      setSearchState("idle");
      return;
    }
    const id = ++request.current;
    const timer = window.setTimeout(async () => {
      setSearchState("loading");
      try {
        const places: GeocodedPlace[] = await searchPlaces(q, 5);
        if (id !== request.current) return;
        setHits(
          places.slice(0, 5).map((p) => ({
            label: p.label || p.address.split(",")[0],
            address: p.address,
            lat: p.lat,
            lng: p.lng,
          })),
        );
        setSearchState("idle");
      } catch {
        if (id === request.current) setSearchState("error");
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [city, picked]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError(t("planner.trips.titleRequired", "Rota adı gerekli."));
      document.getElementById("new-trip-title")?.focus();
      return;
    }
    onCreate({
      title: title.trim(),
      destination: city.trim() || undefined,
      days,
      startDate: startDate || undefined,
      center: picked ? { lat: picked.lat, lng: picked.lng } : undefined,
    });
  };

  const assistantHref = `/travel-assistant/?q=${encodeURIComponent(
    city.trim()
      ? t("planner.newTrip.assistantPrompt", "{city}, {n} gün")
          .replace("{city}", city.trim())
          .replace("{n}", String(days))
      : "",
  )}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("planner.trips.new", "Yeni rota")}
      description={t(
        "planner.newTrip.body",
        "Adını ver, şehri seç, kaç gün süreceğini belirle. Durakları sonra eklersin.",
      )}
      footer={
        <div className="new-trip__actions">
          <Button
            href={city.trim() ? assistantHref : "/travel-assistant/"}
            variant="ghost"
            iconStart={<Icon name="sparkle" size={16} />}
          >
            {t("planner.newTrip.assistant", "Asistanla başla")}
          </Button>
          <Button type="submit" form="new-trip-form" iconEnd={<Icon name="arrow" size={20} />}>
            {t("planner.trips.create", "Rota oluştur")}
          </Button>
        </div>
      }
    >
      <form id="new-trip-form" className="new-trip" onSubmit={submit} noValidate>
        <Field
          id="new-trip-title"
          label={t("planner.trips.name", "Rota adı")}
          required
          error={titleError}
        >
          {(ids) => (
            <Input
              {...ids}
              size="lg"
              iconStart="route"
              value={title}
              maxLength={80}
              autoComplete="off"
              placeholder={t("planner.newTrip.titlePlaceholder", "Örn. Roma hafta sonu")}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError(null);
              }}
            />
          )}
        </Field>
        <div className="new-trip__city">
          <Field
            id="new-trip-city"
            label={t("planner.trips.destination", "Şehir ya da bölge")}
            hint={t("planner.newTrip.cityHint", "En az 3 harf yaz, listeden seç.")}
          >
            {(ids) => (
              <Input
                {...ids}
                size="lg"
                iconStart="search"
                value={city}
                maxLength={80}
                autoComplete="off"
                onChange={(e) => {
                  setCity(e.target.value);
                  setPicked(null);
                }}
              />
            )}
          </Field>
          <div role="status" className="new-trip__status">
            {searchState === "loading" && t("planner.search.loading", "Aranıyor…")}
            {picked &&
              t("planner.newTrip.cityPicked", "Seçildi: {name}").replace("{name}", picked.address)}
          </div>
          {searchState === "error" && (
            <Alert tone="warning" live="polite">
              {t(
                "planner.newTrip.cityError",
                "Şehir araması şu an yanıt vermiyor; adı yazarak devam edebilirsin.",
              )}
            </Alert>
          )}
          {hits.length > 0 && (
            <ul
              className="new-trip__hits"
              aria-label={t("planner.search.results", "Arama sonuçları")}
            >
              {hits.map((h) => (
                <li key={`${h.lat},${h.lng}`}>
                  <button
                    type="button"
                    className="new-trip__hit"
                    onClick={() => {
                      setPicked(h);
                      setCity(h.label);
                      setHits([]);
                    }}
                  >
                    <Icon name="map" size={16} />
                    <span className="new-trip__hit-text">
                      <span className="new-trip__hit-name">{h.label}</span>
                      <span className="new-trip__hit-address">{h.address}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="new-trip__row">
          <Stepper
            label={t("planner.newTrip.days", "Gün sayısı")}
            value={days}
            min={NEW_TRIP_MIN_DAYS}
            max={NEW_TRIP_MAX_DAYS}
            onChange={setDays}
          />
          <Field
            id="new-trip-start"
            label={t("planner.newTrip.start", "Başlangıç tarihi")}
            optionalLabel={t("ui.optional", "isteğe bağlı")}
          >
            {(ids) => (
              <Input
                {...ids}
                type="date"
                size="lg"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            )}
          </Field>
        </div>
      </form>
    </Modal>
  );
}
