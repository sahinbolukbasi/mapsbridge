// ============================================================
// TripSideDrawer — unified side panel for the map workspace
// No separate modals, no page navigation — everything inline.
// ============================================================

import React, { useState, useEffect } from "react";
import { Pin, DrawerView, TripDay, PinCategory, TripGroup } from "../../lib/trip/models";

interface TripSideDrawerProps {
  isOpen: boolean;
  view: DrawerView;
  activeDayIndex: number | null;
  days: TripDay[];
  groups: TripGroup[];
  pins: Pin[];
  pinsForActiveDay: Pin[];
  allDaysExceptAll: TripDay[];
  title: string;
  onClose: () => void;
  onToggle: () => void;
  onSetActiveDay: (dayIndex: number | null) => void;
  onOpenDrawer: (view: DrawerView, pin?: Pin | null) => void;
  onAddPin: (pin: Omit<Pin, "id" | "order">) => void;
  onUpdatePin: (pinId: string, updates: Partial<Pin>) => void;
  onDeletePin: (pinId: string) => void;
  onMovePin: (pinId: string, direction: "up" | "down") => void;
  onAddDay: () => void;
  onRenameDay: (dayIndex: number, label: string) => void;
  onUpdateTrip: (
    updates: Partial<{ title: string; isPublic: boolean; destination: string }>,
  ) => void;
  onAddGroup: (name: string, emoji?: string, color?: string) => void;
}

export default function TripSideDrawer(props: TripSideDrawerProps) {
  const {
    isOpen,
    view,
    activeDayIndex,
    days,
    groups,
    pins,
    pinsForActiveDay,
    allDaysExceptAll,
    title,
    onClose: _onClose,
    onToggle,
    onSetActiveDay,
    onOpenDrawer,
    onAddPin,
    onUpdatePin,
    onDeletePin,
    onMovePin,
    onAddDay,
    onRenameDay: _onRenameDay,
    onUpdateTrip,
    onAddGroup,
  } = props;

  // ── inline form states ──
  const [newPinLabel, setNewPinLabel] = useState("");
  const [newPinNote, setNewPinNote] = useState("");
  const [newPinCategory, setNewPinCategory] = useState<PinCategory>("genel");
  const [newPinDay, setNewPinDay] = useState(activeDayIndex ?? 1);
  const [newPinGroup, setNewPinGroup] = useState("genel");
  const [editPinId, setEditPinId] = useState<string | null>(null);

  // ── trip settings states ──
  const [editTitle, setEditTitle] = useState(title);
  const [editPublic, setEditPublic] = useState(false);
  const [editDest, setEditDest] = useState("");

  // Sync trip title
  useEffect(() => {
    setEditTitle(title);
  }, [title]);

  // ── helpers ──
  const categoryMeta: Record<PinCategory, { emoji: string; label: string; color: string }> = {
    kahve: { emoji: "☕", label: "Kahve & Kafe", color: "#8b5cf6" },
    yemek: { emoji: "🍽️", label: "Yemek & Restoran", color: "#f97316" },
    muze: { emoji: "🏛️", label: "Müze & Tarih", color: "#3b82f6" },
    alisveris: { emoji: "🛍️", label: "Alışveriş", color: "#ec4899" },
    otel: { emoji: "🏨", label: "Otel & Konaklama", color: "#06b6d4" },
    doga: { emoji: "🌳", label: "Doğa & Park", color: "#10b981" },
    genel: { emoji: "📍", label: "Genel", color: "#6366f1" },
    gezilecek: { emoji: "👀", label: "Gezilecek", color: "#2563eb" },
    fotograf: { emoji: "📸", label: "Fotoğraf", color: "#eab308" },
    kultur: { emoji: "🎭", label: "Kültür", color: "#8b5cf6" },
    manzara: { emoji: "🏔️", label: "Manzara", color: "#10b981" },
    turistik: { emoji: "🏛️", label: "Turistik", color: "#3b82f6" },
    gastronomi: { emoji: "🍝", label: "Gastronomi", color: "#f97316" },
    tarih: { emoji: "🏛️", label: "Tarihi Yer", color: "#3b82f6" },
    spor: { emoji: "🏃", label: "Spor & Macera", color: "#10b981" },
    gezi: { emoji: "🧭", label: "Gezi & Seyahat", color: "#06b6d4" },
    aktivite: { emoji: "🎡", label: "Aktivite", color: "#06b6d4" },
    eglence: { emoji: "🎭", label: "Eğlence", color: "#a855f7" },
    konaklama: { emoji: "🏨", label: "Konaklama", color: "#64748b" },
  };

  const categories = Object.entries(categoryMeta) as [
    PinCategory,
    (typeof categoryMeta)[PinCategory],
  ][];

  // ── inline pin create / edit submit ──
  function handleSavePin() {
    if (!newPinLabel.trim()) return;
    if (editPinId) {
      onUpdatePin(editPinId, {
        label: newPinLabel.trim(),
        note: newPinNote.trim() || undefined,
        category: newPinCategory,
        dayIndex: newPinDay,
        group: newPinGroup,
      });
      setEditPinId(null);
    } else {
      // We need lat/lng — these come from map click. For now use placeholder.
      onAddPin({
        label: newPinLabel.trim(),
        address: "Harita seçili nokta",
        lat: 41.0082, // placeholder, overridden by map click
        lng: 28.9784,
        category: newPinCategory,
        note: newPinNote.trim() || undefined,
        dayIndex: newPinDay,
        group: newPinGroup,
        visited: false,
      });
    }
    setNewPinLabel("");
    setNewPinNote("");
    setNewPinCategory("genel");
    onOpenDrawer("day-list");
  }

  // ── edit existing pin ──
  function startEditPin(pin: Pin) {
    setEditPinId(pin.id);
    setNewPinLabel(pin.label);
    setNewPinNote(pin.note ?? "");
    setNewPinCategory(pin.category);
    setNewPinDay(pin.dayIndex);
    setNewPinGroup(pin.group);
    onOpenDrawer("pin-detail", pin);
  }

  function cancelEdit() {
    setEditPinId(null);
    setNewPinLabel("");
    setNewPinNote("");
    setNewPinCategory("genel");
    onOpenDrawer("day-list");
  }

  // ── save trip settings ──
  function handleSaveTripSettings() {
    onUpdateTrip({
      title: editTitle.trim() || title,
      isPublic: editPublic,
      destination: editDest.trim() || undefined,
    });
    onOpenDrawer("day-list");
  }

  return (
    <aside className={`trip-side-drawer ${isOpen ? "open" : "closed"}`}>
      {/* ── drag handle / toggle ── */}
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="trip-drawer-content"
        className="drawer-toggle-btn"
        onClick={onToggle}
        title={isOpen ? "Paneli Kapat" : "Paneli Aç"}
      >
        <span>{isOpen ? "◀" : "▶"}</span>
      </button>

      <div id="trip-drawer-content" className="drawer-scroll-area" inert={!isOpen}>
        {/* ── header: trip title + settings gear ── */}
        <div className="drawer-header">
          <h2 className="drawer-title">{title}</h2>
          <button
            className="drawer-header-btn"
            onClick={() => {
              setEditTitle(title);
              setEditPublic(pins.some((p) => p.group === "public"));
              onOpenDrawer("trip-settings");
            }}
            title="Gezi Ayarları"
          >
            ⚙️
          </button>
        </div>

        {/* ── VIEW: day tabs ── */}
        {view === "day-list" && (
          <>
            <div className="day-tabs-row">
              <button
                className={`day-tab ${activeDayIndex == null || activeDayIndex === 0 ? "active" : ""}`}
                onClick={() => onSetActiveDay(0)}
              >
                📋 Tümü
              </button>
              {allDaysExceptAll.map((d) => (
                <button
                  key={d.dayIndex}
                  className={`day-tab ${activeDayIndex === d.dayIndex ? "active" : ""}`}
                  style={{ borderColor: d.color }}
                  onClick={() => onSetActiveDay(d.dayIndex)}
                >
                  <span className="day-dot" style={{ background: d.color }} />
                  {d.label}
                </button>
              ))}
              <button className="day-tab add-day" onClick={onAddDay} title="Gün Ekle">
                +
              </button>
            </div>

            {/* ── pin list for active day ── */}
            <div className="drawer-pin-list">
              {pinsForActiveDay.length === 0 && (
                <div className="drawer-empty-state">
                  <span className="empty-icon">📍</span>
                  <h3>İlk durağın neresi olsun?</h3>
                  <p>Haritada bir yere dokunarak bu güne ekle.</p>
                  <button className="ui-button" type="button" onClick={onToggle}>
                    Haritada yer seç
                  </button>
                </div>
              )}
              {pinsForActiveDay
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((pin) => {
                  const cat = categoryMeta[pin.category] ?? categoryMeta.genel;
                  return (
                    <div key={pin.id} className={`pin-list-item ${pin.visited ? "visited" : ""}`}>
                      <button
                        type="button"
                        className="pin-list-main"
                        onClick={() => startEditPin(pin)}
                        aria-label={`${pin.label} durağını düzenle`}
                      >
                        <span className="pin-order-badge">{pin.order}</span>
                        <span className="pin-cat-dot" style={{ background: cat.color }}>
                          {cat.emoji}
                        </span>
                        <div className="pin-list-info">
                          <span className="pin-list-label">{pin.label}</span>
                          {pin.note && <span className="pin-list-note">{pin.note}</span>}
                          <span className="pin-list-meta">
                            {pin.dayIndex > 0 &&
                              `${days.find((d) => d.dayIndex === pin.dayIndex)?.label ?? pin.dayIndex + ". Gün"} · `}
                            🏷️ {pin.group}
                          </span>
                        </div>
                      </button>
                      <div className="pin-list-actions">
                        <button
                          className="pin-move-btn"
                          onClick={() => onMovePin(pin.id, "up")}
                          title="Yukarı"
                        >
                          ▲
                        </button>
                        <button
                          className="pin-move-btn"
                          onClick={() => onMovePin(pin.id, "down")}
                          title="Aşağı"
                        >
                          ▼
                        </button>
                        <button
                          className="pin-delete-btn"
                          onClick={() => {
                            onDeletePin(pin.id);
                            if (editPinId === pin.id) cancelEdit();
                          }}
                          title="Sil"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </>
        )}

        {/* ── VIEW: pin create / edit ── */}
        {(view === "pin-create" || view === "pin-detail") && (
          <div className="drawer-pin-form">
            <div className="drawer-form-header">
              <h3>{editPinId ? "Pini Düzenle" : "Yeni Pin Ekle"}</h3>
              <button className="drawer-back-btn" onClick={cancelEdit}>
                ← Geri
              </button>
            </div>

            <div className="drawer-field">
              <label htmlFor="pin-title">Başlık</label>
              <input
                id="pin-title"
                type="text"
                className="drawer-input"
                placeholder="Örn: Kolezyum, Kahve Durağı..."
                value={newPinLabel}
                onChange={(e) => setNewPinLabel(e.target.value)}
                autoFocus
              />
            </div>

            <div className="drawer-field">
              <label htmlFor="pin-note">Not</label>
              <textarea
                id="pin-note"
                className="drawer-textarea"
                rows={2}
                placeholder="Kısa seyahat notu veya ipucu..."
                value={newPinNote}
                onChange={(e) => setNewPinNote(e.target.value)}
              />
            </div>

            <div className="drawer-field">
              <label>Kategori</label>
              <div className="drawer-chip-row">
                {categories.map(([key, meta]) => (
                  <button
                    key={key}
                    type="button"
                    className={`drawer-chip ${newPinCategory === key ? "active" : ""}`}
                    style={{
                      borderColor: meta.color,
                      ...(newPinCategory === key ? { background: meta.color + "22" } : {}),
                    }}
                    onClick={() => setNewPinCategory(key)}
                  >
                    {meta.emoji} {meta.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="drawer-row-fields">
              <div className="drawer-field">
                <label htmlFor="pin-day">Gün</label>
                <select
                  id="pin-day"
                  className="drawer-select"
                  value={newPinDay}
                  onChange={(e) => setNewPinDay(Number(e.target.value))}
                >
                  {allDaysExceptAll.map((d) => (
                    <option key={d.dayIndex} value={d.dayIndex}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="drawer-field">
                <label htmlFor="pin-group">Grup</label>
                <select
                  id="pin-group"
                  className="drawer-select"
                  value={newPinGroup}
                  onChange={(e) => setNewPinGroup(e.target.value)}
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.emoji} {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="drawer-field" style={{ marginTop: "0.75rem" }}>
              <label htmlFor="pin-photo">Fotoğraf (URL)</label>
              <input
                id="pin-photo"
                type="text"
                className="drawer-input"
                placeholder="https://..."
                value={newPinNote} // simplified — separate photo state later
                onChange={() => {}}
              />
            </div>

            <div className="drawer-form-actions">
              <button
                className="drawer-primary-btn"
                onClick={handleSavePin}
                disabled={!newPinLabel.trim()}
              >
                {editPinId ? "Değişiklikleri Kaydet" : "Pini Kaydet"}
              </button>
              {editPinId && (
                <button
                  className="drawer-danger-btn"
                  onClick={() => {
                    onDeletePin(editPinId);
                    cancelEdit();
                  }}
                >
                  🗑️ Pini Sil
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── VIEW: trip settings ── */}
        {view === "trip-settings" && (
          <div className="drawer-pin-form">
            <div className="drawer-form-header">
              <h3>⚙️ Gezi Ayarları</h3>
              <button className="drawer-back-btn" onClick={() => onOpenDrawer("day-list")}>
                ← Geri
              </button>
            </div>

            <div className="drawer-field">
              <label htmlFor="trip-title">Gezi Adı</label>
              <input
                id="trip-title"
                type="text"
                className="drawer-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>

            <div className="drawer-field">
              <label htmlFor="trip-destination">Destinasyon</label>
              <input
                id="trip-destination"
                type="text"
                className="drawer-input"
                placeholder="Örn: Roma, İtalya"
                value={editDest}
                onChange={(e) => setEditDest(e.target.value)}
              />
            </div>

            <div className="drawer-toggle-row">
              <span>🌍 Toplulukta Yayınla</span>
              <label className="drawer-switch">
                <input
                  type="checkbox"
                  aria-label="Toplulukta yayınla"
                  checked={editPublic}
                  onChange={(e) => setEditPublic(e.target.checked)}
                />
                <span className="switch-slider" />
              </label>
            </div>

            <div className="drawer-form-actions" style={{ marginTop: "1rem" }}>
              <button className="drawer-primary-btn" onClick={handleSaveTripSettings}>
                Değişiklikleri Kaydet
              </button>
            </div>
          </div>
        )}

        {/* ── VIEW: group manage (placeholder) ── */}
        {view === "group-manage" && (
          <div className="drawer-pin-form">
            <div className="drawer-form-header">
              <h3>📁 Grupları Yönet</h3>
              <button className="drawer-back-btn" onClick={() => onOpenDrawer("day-list")}>
                ← Geri
              </button>
            </div>
            <div className="drawer-groups-list">
              {groups.map((g) => (
                <div key={g.id} className="drawer-group-row">
                  <span>
                    {g.emoji} {g.name}
                  </span>
                  <span className="group-pin-count">
                    {pins.filter((p) => p.group === g.id).length} pin
                  </span>
                </div>
              ))}
            </div>
            <div className="drawer-field" style={{ marginTop: "0.75rem" }}>
              <label htmlFor="new-group-input">Yeni Grup Ekle</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  className="drawer-input"
                  placeholder="Grup adı..."
                  id="new-group-input"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                      onAddGroup((e.target as HTMLInputElement).value.trim());
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
                <button
                  className="drawer-primary-btn"
                  style={{ padding: "0.5rem 0.85rem" }}
                  onClick={() => {
                    const input = document.getElementById("new-group-input") as HTMLInputElement;
                    if (input?.value.trim()) {
                      onAddGroup(input.value.trim());
                      input.value = "";
                    }
                  }}
                >
                  Ekle
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
