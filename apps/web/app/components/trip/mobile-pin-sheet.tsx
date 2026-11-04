"use client";
import { GooglePlaceInfo } from "./google-place-info";
import { useEffect, useRef, useState } from "react";
import type { useTravelPlanner } from "../../lib/trip/use-travel-planner";
import { DEFAULT_CATEGORY_META, type Pin, type PinCategory } from "../../lib/trip/models";

type Props = {
  planner: ReturnType<typeof useTravelPlanner>;
  point: { lat: number; lng: number; address: string; googlePlaceId?: string } | null;
  pin: Pin | null;
  onClose: () => void;
  onClearPoint: () => void;
  onUpdate: (id: string, updates: Partial<Pin>) => void;
  onLinkPlace?: (id: string) => void;
  onAskAi?: (context: string) => void;
};

export function MobilePinSheet({
  planner,
  point,
  pin,
  onClose,
  onClearPoint,
  onUpdate,
  onLinkPlace,
  onAskAi,
}: Props) {
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(pin?.label || "");
  const [note, setNote] = useState(pin?.note || "");
  const [category, setCategory] = useState<PinCategory>(pin?.category || "genel");
  const [duration, setDuration] = useState(pin?.durationMinutes || 60);
  const [tripId, setTripId] = useState(planner.activeTrip?.id || "");
  const [day, setDay] = useState(planner.activeDayIndex || 1);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"info" | "reviews">("info");
  const closeRef = useRef<HTMLButtonElement>(null);
  const saving = useRef(false);

  const trip = planner.trips.find((t) => t.id === tripId) || planner.activeTrip;
  const targetDay = trip?.days.some((d) => d.dayIndex === day) ? day : trip?.days[0]?.dayIndex || 1;
  const assignedTrip = pin?.tripId ? planner.trips.find((t) => t.id === pin.tripId) : null;
  const loading = !pin && point?.address === "Konum sorgulanıyor...";
  const placeName = pin?.label || point?.address?.split(",")[0] || "Yeni durak";

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editing) setEditing(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [editing, onClose]);

  function add() {
    if (!trip || loading || saving.current) return;
    saving.current = true;
    if (pin && planner.allPins.some((p) => p.id === pin.id)) {
      planner.assignPinToTrip(pin.id, trip.id, targetDay);
    } else {
      const source = pin || point!;
      planner.addPinDirectlyToTrip(
        trip.id,
        {
          googlePlaceId: pin?.googlePlaceId || point?.googlePlaceId,
          label:
            pin?.label ||
            (point?.googlePlaceId ? newName.trim() : point!.address.split(",")[0]) ||
            "Yeni durak",
          address:
            !pin && point?.googlePlaceId
              ? `${source.lat.toFixed(5)}, ${source.lng.toFixed(5)}`
              : source.address,
          lat: source.lat,
          lng: source.lng,
          category: pin?.category || "genel",
          note: pin?.note,
          photo: pin?.photo,
          dayIndex: targetDay,
          group: pin?.group || "Genel",
          visited: pin?.visited || false,
          durationMinutes: pin?.durationMinutes || 60,
        },
        targetDay,
      );
    }
    onClearPoint();
    setMessage("Rotaya eklendi.");
  }

  function handleAskAi() {
    const lat = pin?.lat ?? point?.lat;
    const lng = pin?.lng ?? point?.lng;
    const prompt = `"${placeName}" hakkında bilgi ver. Konum: ${lat?.toFixed(5)}, ${lng?.toFixed(5)}. Bu mekan hakkında gezginlere öneriler, yakın çevrede görülecek yerler ve en iyi ziyaret zamanı nedir?`;
    if (onAskAi) {
      onAskAi(prompt);
    } else {
      window.location.href = `/travel-assistant/?q=${encodeURIComponent(prompt)}`;
    }
  }

  return (
    <section
      className={`mobile-pin-sheet ${editing ? "is-editing" : ""}`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="mobile-pin-title"
    >
      <div className="mobile-pin-handle" aria-hidden="true" />

      {/* Header */}
      <div className="mobile-pin-header">
        <div>
          <small>{editing ? "Kayıtlı yer" : pin ? "Kayıtlı pin" : "Haritada seçilen yer"}</small>
          <h2 id="mobile-pin-title">{editing ? "Pini düzenle" : placeName}</h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="mobile-pin-close"
          aria-label="Pin panelini kapat"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="mobile-pin-body">
        {editing && pin ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!label.trim()) return;
              try {
                onUpdate(pin.id, {
                  label: label.trim(),
                  note: note.trim(),
                  category,
                  durationMinutes: duration,
                });
                setEditing(false);
                setMessage("Değişiklikler kaydedildi.");
              } catch {
                setMessage("Değişiklik kaydedilemedi. Lütfen tekrar dene.");
              }
            }}
          >
            <label>
              Yer adı
              <input
                autoFocus
                required
                maxLength={160}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
            <label>
              Kategori
              <select value={category} onChange={(e) => setCategory(e.target.value as PinCategory)}>
                {Object.entries(DEFAULT_CATEGORY_META).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ziyaret süresi (dakika)
              <input
                type="number"
                min={1}
                max={1440}
                required
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </label>
            <label>
              Notlar
              <textarea
                rows={3}
                maxLength={4000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <div className="mobile-pin-actions">
              <button type="button" onClick={() => setEditing(false)}>
                Bilgilere dön
              </button>
              <button className="primary" type="submit" disabled={!label.trim()}>
                Değişiklikleri kaydet
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Photo */}
            {pin?.photo && <img className="mobile-pin-photo" src={pin.photo} alt={pin.label} />}

            {/* Address */}
            <p>{pin?.address || point?.address}</p>

            {/* Pin meta info */}
            {pin && (
              <>
                <div className="mobile-pin-meta">
                  <span>{DEFAULT_CATEGORY_META[pin.category]?.label || "Mekan"}</span>
                  <span>{pin.durationMinutes || 60} dk</span>
                  <span>{pin.visited ? "Ziyaret edildi" : "Henüz ziyaret edilmedi"}</span>
                </div>
                <p>
                  {assignedTrip
                    ? `${assignedTrip.title} · ${pin.dayIndex}. gün`
                    : "Henüz bir rotaya eklenmedi."}
                </p>
                {pin.note && <p className="mobile-pin-note">{pin.note}</p>}
              </>
            )}

            {/* Name input for new Google Places pin */}
            {!pin && point?.googlePlaceId && (
              <label>
                Bu durağa vereceğin ad
                <input
                  value={newName}
                  maxLength={160}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Örn. İlk gün müze ziyareti"
                />
              </label>
            )}

            {/* Action Buttons — Rotaya Ekle + AI'a Sor */}
            <div className="mobile-pin-action-buttons">
              {!assignedTrip && (
                <>
                  <div className="mobile-pin-target">
                    <label>
                      Rota
                      <select
                        aria-label="Rota"
                        value={trip?.id || ""}
                        onChange={(e) => {
                          setTripId(e.target.value);
                          setDay(1);
                        }}
                      >
                        {planner.trips.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Gün
                      <select
                        aria-label="Gün"
                        value={targetDay}
                        onChange={(e) => setDay(Number(e.target.value))}
                      >
                        {trip?.days.map((d) => (
                          <option key={d.dayIndex} value={d.dayIndex}>
                            {d.dayIndex}. gün
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button
                    type="button"
                    className="primary mobile-pin-add"
                    disabled={
                      loading ||
                      !trip ||
                      saving.current ||
                      (!pin && !!point?.googlePlaceId && !newName.trim())
                    }
                    onClick={add}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      add_location
                    </span>
                    {loading ? "Konum bulunuyor…" : "Rotaya Ekle"}
                  </button>
                </>
              )}

              <button type="button" className="mobile-pin-ai-btn" onClick={handleAskAi}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  auto_awesome
                </span>
                AI'a Sor
              </button>
            </div>

            {/* Edit + Directions for existing pins */}
            {pin && (
              <div className="mobile-pin-actions">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Yol tarifi
                </a>
                <button
                  className="primary"
                  onClick={() => {
                    setLabel(pin.label);
                    setNote(pin.note || "");
                    setCategory(pin.category);
                    setDuration(pin.durationMinutes || 60);
                    setEditing(true);
                    setMessage("");
                  }}
                >
                  Düzenle
                </button>
              </div>
            )}

            {/* Tab Navigation: Bilgi / Yorumlar */}
            <div className="mobile-pin-tabs">
              <button
                type="button"
                className={activeTab === "info" ? "active" : ""}
                onClick={() => setActiveTab("info")}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  info
                </span>
                Bilgi
              </button>
              <button
                type="button"
                className={activeTab === "reviews" ? "active" : ""}
                onClick={() => setActiveTab("reviews")}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  reviews
                </span>
                Yorumlar
              </button>
            </div>

            {/* Google Place Info — shows info or reviews based on active tab */}
            <GooglePlaceInfo
              placeId={pin?.googlePlaceId || point?.googlePlaceId}
              label={pin?.label || point?.address || ""}
              lat={pin?.lat ?? point!.lat}
              lng={pin?.lng ?? point!.lng}
              onLink={(id) => {
                if (pin) onUpdate(pin.id, { googlePlaceId: id });
                else onLinkPlace?.(id);
              }}
              activeTab={activeTab}
            />
          </>
        )}

        {message && <p role="status">{message}</p>}
      </div>
    </section>
  );
}
