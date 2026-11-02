// ============================================================
// TravelPlannerSidebar — Unified Modern Travel Planner Desk
// Stitch Design System: Clean, Non-Repetitive, Map-First UX
// ============================================================

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Pin, PinCategory, DEFAULT_CATEGORY_META } from "../../lib/trip/models";
import { useTravelPlanner } from "../../lib/trip/use-travel-planner";
import { googleMapsEnabled } from "../../lib/google/maps-client";
import { searchPlaces } from "../../lib/trip/geocoding-service";
import { apiFetch } from "../../lib/api-client";
import { tripToRoute, routeToTrip } from "../../lib/trip/workspace-store";
import { isRoutePlan, type MultiAgentResponse } from "../../lib/ai/types";
import { GooglePlaceInfo } from "./google-place-info";
import { interactionTracker } from "../../lib/analytics/tracker";
import { exportTripToGoogleMaps, ManualPinModal } from "../../features/trip-planner";
import "../../maps/maps-layout.css";

export interface TravelPlannerSidebarProps {
  planner: ReturnType<typeof useTravelPlanner>;
  isOpen?: boolean;
  onToggle?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onFlyToPin?: (pin: Pin) => void;
  onFlyToCoords?: (lat: number, lng: number, label: string) => void;
  selectedMapPoint?: { lat: number; lng: number; address: string } | null;
  onClearSelectedMapPoint?: () => void;
  isAddingPinMode?: boolean;
  onToggleAddPinMode?: () => void;
  isGuest?: boolean;
  onRequireAuth?: (featureName: string, actionDesc: string) => void;
  onRunOptimize?: () => void;
  userLocation?: { lat: number; lng: number } | null;
}

type DetailTab = "info" | "edit";

export function TravelPlannerSidebar({
  planner,
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
  onFlyToPin,
  onFlyToCoords,
  selectedMapPoint,
  onClearSelectedMapPoint,
  isAddingPinMode: _isAddingPinMode,
  onToggleAddPinMode: _onToggleAddPinMode,
  isGuest = false,
  onRequireAuth,
  onRunOptimize,
  userLocation: _userLocation,
}: TravelPlannerSidebarProps) {
  const {
    trips,
    generalPins,
    selectedPin,
    activeTrip,
    activeTripId,
    activeDayIndex,
    selectedPinId,
    pinsWithTime,
    daySummary,
    switchTrip,
    setActiveDayIndex,
    setSelectedPinId,
    createTrip,
    deleteTrip,
    addPinToGeneral,
    addPinDirectlyToTrip,
    assignPinToTrip,
    movePinToGeneral,
    updatePinAnywhere,
    deletePinAnywhere,
    togglePinVisitedAnywhere,
    customGroups: _customGroups,
    addDay,
    importTrip,
  } = planner;

  // Panel state: expanded vs collapsed rail
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const setPanelCollapsed = (val: boolean) => {
    if (onToggleCollapse && val !== isCollapsed) {
      onToggleCollapse();
    }
    setInternalCollapsed(val);
  };

  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  // Detail sub-tab when a pin is selected (Info vs Edit)
  const [detailTab, setDetailTab] = useState<DetailTab>("info");
  const [showInPanelDetail, setShowInPanelDetail] = useState(false);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Helper to dynamically calculate stop times
  const calcStopTime = (idx: number) => {
    let totalMins = 9 * 60 + 30; // Starts at 09:30
    for (let i = 0; i < idx; i++) {
      const p = pinsWithTime[i];
      totalMins += (p?.durationMinutes || 45) + (p?.transitDurationFromPrevious || 10);
    }
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  // Inline edit state for selected pin
  const [editLabel, setEditLabel] = useState("");
  const [editCategory, setEditCategory] = useState<PinCategory>("tarih");
  const [editGroup, setEditGroup] = useState<string>("Genel");
  const [editNote, setEditNote] = useState("");
  const [editDuration, setEditDuration] = useState(60);
  const [editTargetTripId, setEditTargetTripId] = useState<string>("general");
  const [editTargetDayIndex, setEditTargetDayIndex] = useState<number>(0);
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const [infoNewPhotoUrl, setInfoNewPhotoUrl] = useState("");

  // New trip inline creation form
  const [showInlineNewTrip, setShowInlineNewTrip] = useState(false);
  const [showRouteMenu, setShowRouteMenu] = useState(false);
  const [newTripTitle, setNewTripTitle] = useState("");
  const [newTripDest, setNewTripDest] = useState("");

  // Toast notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const guardGuest = (featureName: string, actionDesc: string) => {
    if (isGuest) {
      onRequireAuth?.(featureName, actionDesc);
      return true;
    }
    return false;
  };

  // ── Mode Switcher: "edit" (Rota Düzenleme) vs "travel" (Gezi Modu) ──
  const [workspaceMode, setWorkspaceMode] = useState<"edit" | "travel">("edit");

  // ── Sidebar Address / Place Search ──
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [isSidebarSearching, setIsSidebarSearching] = useState(false);
  const [foundPlace, setFoundPlace] = useState<{
    lat: number;
    lng: number;
    address: string;
    label?: string;
  } | null>(null);

  const handleSidebarSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = sidebarSearch.trim();
    if (!query) return;
    setIsSidebarSearching(true);
    try {
      const places = await searchPlaces(query);
      if (places && places.length > 0) {
        const top = places[0];
        const placeData = {
          lat: top.lat,
          lng: top.lng,
          address: top.address,
          label: top.label || top.address.split(",")[0],
        };
        setFoundPlace(placeData);
        onFlyToCoords?.(top.lat, top.lng, placeData.label);
        showToast(`✓ "${placeData.label}" haritada bulundu!`);
      } else {
        showToast("⚠️ Aradığınız adres veya mekan bulunamadı.");
      }
    } catch {
      showToast("⚠️ Arama servisine ulaşılamadı.");
    } finally {
      setIsSidebarSearching(false);
    }
  };

  const handleAddFoundPlace = (target: "trip" | "general") => {
    if (!foundPlace) return;
    const targetDay = activeDayIndex && activeDayIndex > 0 ? activeDayIndex : 1;
    const pinData = {
      label: foundPlace.label || foundPlace.address.split(",")[0] || "Yeni Rota Durağı",
      address: foundPlace.address,
      lat: foundPlace.lat,
      lng: foundPlace.lng,
      category: "genel" as PinCategory,
      dayIndex: target === "trip" ? targetDay : 0,
      group: "Genel",
      visited: false,
      durationMinutes: 45,
    };
    if (target === "trip") {
      addPinDirectlyToTrip(activeTripId, pinData, targetDay);
      showToast(`✓ "${pinData.label}" ${targetDay}. güne eklendi`);
    } else {
      addPinToGeneral(pinData);
      showToast(`📌 "${pinData.label}" havuza kaydedildi`);
    }
    setFoundPlace(null);
    setSidebarSearch("");
  };

  // ── Quick Manual Pin Entry ──
  const [showManualAdd, setShowManualAdd] = useState(false);

  const handleCreateManualPin = (pinData: {
    label: string;
    category: PinCategory;
    day: number;
    duration: number;
    note: string;
  }) => {
    const basePin = (activeTrip?.pins && activeTrip.pins[0]) || generalPins[0];
    const baseLat = basePin?.lat || 41.0082;
    const baseLng = basePin?.lng || 28.9784;
    const offset = ((activeTrip?.pins?.length || 0) + 1) * 0.002;

    const newPin: Omit<Pin, "id"> = {
      label: pinData.label,
      address: activeTrip?.destination ? `${activeTrip.destination} civarı` : "Konum",
      lat: baseLat + offset,
      lng: baseLng + offset,
      category: pinData.category,
      dayIndex: pinData.day,
      order: (activeTrip?.pins?.length || 0) + 1,
      group: "Genel",
      visited: false,
      durationMinutes: pinData.duration,
      note: pinData.note || undefined,
    };

    addPinDirectlyToTrip(activeTripId, newPin, pinData.day);
    showToast(`✓ "${pinData.label}" ${pinData.day}. güne eklendi`);
  };

  // ── Reorder Pins Up / Down in Edit Mode ──
  const handleMovePinOrder = (pin: Pin, direction: "up" | "down") => {
    if (!activeTrip || !activeTrip.pins) return;
    const currentDayPins = [...filteredPins];
    const currentIndex = currentDayPins.findIndex((p) => p.id === pin.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentDayPins.length) return;

    const currentOrder = pin.order || currentIndex + 1;
    const targetPin = currentDayPins[targetIndex];
    const targetOrder = targetPin.order || targetIndex + 1;

    updatePinAnywhere(pin.id, { order: targetOrder });
    updatePinAnywhere(targetPin.id, { order: currentOrder });
    showToast("✓ Durak sırası güncellendi");
  };

  // ── 1-Click Google Maps Integration (Durak Sıralı Aktarım) ──────
  const handleExportToGoogleMaps = () => {
    const rawStops =
      pinsWithTime && pinsWithTime.length > 0 ? pinsWithTime : activeTrip?.pins || [];
    const res = exportTripToGoogleMaps(rawStops);
    showToast(res.message);
  };

  // ── AI Route Modifier Agent with Versioning ────────────────
  const [aiPrompt, setAiPrompt] = useState("");
  const [_isAiModifying, setIsAiModifying] = useState(false);
  const [_showAiInput, setShowAiInput] = useState(false);
  const [routeVersions, setRouteVersions] = useState<
    { id: string; versionNum: number; label: string; prompt?: string; stops: Pin[] }[]
  >([]);
  const [_activeVersionNum, setActiveVersionNum] = useState<number>(1);

  // "AI'ya Sor" — seçili mekan hakkında anlık soru-cevap.
  // I1: LLM olgu uydurmaz; soruyu mekan verisiyle (ad/adres/kategori/koordinat) besliyoruz,
  // endpoint kendi grounding/retrieval katmanını uygular.
  const [askPlaceQuestion, setAskPlaceQuestion] = useState("");
  const [askPlaceAnswer, setAskPlaceAnswer] = useState<string | null>(null);
  const [askPlaceLoading, setAskPlaceLoading] = useState(false);
  const handleAskAboutPlace = async (pin: Pin) => {
    const q = askPlaceQuestion.trim();
    if (!q) return;
    if (guardGuest("AI'ya Sor", "Mekan hakkında yapay zekaya soru sormak için")) return;
    setAskPlaceLoading(true);
    setAskPlaceAnswer(null);
    try {
      const requestId = crypto.randomUUID();
      const conversationId = `ask-${pin.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 30)}-${Date.now()}`;
      const placeContext = `Mekan: ${pin.label}${pin.address ? ` (${pin.address})` : ""}; Kategori: ${DEFAULT_CATEGORY_META[pin.category]?.label || "Genel"}; Koordinat: ${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}`;
      const res = await apiFetch<MultiAgentResponse>("/ai/route-planner", {
        method: "POST",
        timeoutMs: 35000,
        body: JSON.stringify({
          prompt: `${placeContext}. Soru: ${q}`,
          requestId,
          conversationId,
          conversationState: {
            version: 1,
            context: { planningRequested: false },
            messages: [{ role: "user", content: q }],
          },
        }),
      });
      const answer = res?.orchestratorSummary?.trim();
      if (answer) {
        setAskPlaceAnswer(answer);
      } else {
        setAskPlaceAnswer(
          "Bu mekan için şu an yeterli veri bulamadım. Farklı bir soru deneyebilirsiniz.",
        );
      }
    } catch {
      setAskPlaceAnswer("⚠ Yapay zekaya ulaşılamadı. Lütfen biraz sonra tekrar deneyin.");
    } finally {
      setAskPlaceLoading(false);
    }
  };

  // Seçili pin değişince AI'ya Sor cevabını temizle (cevaplar pinler arası sızmasın).
  useEffect(() => {
    setAskPlaceAnswer(null);
    setAskPlaceQuestion("");
  }, [selectedPinId]);
  // Initialize v1 when activeTrip changes
  useEffect(() => {
    if (activeTrip && activeTrip.pins) {
      setRouteVersions([
        {
          id: `v1_${activeTrip.id}`,
          versionNum: 1,
          label: "v1 (Orijinal)",
          stops: [...activeTrip.pins],
        },
      ]);
      setActiveVersionNum(1);
    }
  }, [activeTrip?.id]);

  const _handleAiModifyRoute = async (customPrompt?: string) => {
    const promptText = (customPrompt || aiPrompt).trim();
    if (!promptText) return;
    if (guardGuest("AI ile Rota Düzenleme", "Yapay zeka ile rotanızı yeniden düzenlemek için"))
      return;
    if (!activeTrip) {
      showToast("⚠️ Lütfen önce aktif bir gezi seçin.");
      return;
    }

    setIsAiModifying(true);
    showToast("🤖 Yapay zeka rotanızı analiz edip düzenliyor...");

    try {
      const currentRoute = tripToRoute(activeTrip);
      const requestId = crypto.randomUUID();
      const conversationId = `map-${activeTrip.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 30)}-${Date.now()}`;

      const res = await apiFetch<MultiAgentResponse>("/ai/route-planner", {
        method: "POST",
        timeoutMs: 35000,
        body: JSON.stringify({
          prompt: `${activeTrip.destination || activeTrip.title || "Şehir"}: ${promptText}`,
          requestId,
          conversationId,
          conversationState: {
            version: routeVersions.length + 1,
            context: {
              destination: activeTrip.destination || activeTrip.title,
              days: activeTrip.days?.length || 1,
              interests: [],
              planningRequested: true,
            },
            route: currentRoute,
            messages: [{ role: "user", content: `Mevcut rotamı düzenle: ${promptText}` }],
          },
        }),
      });

      if (res && res.route && isRoutePlan(res.route)) {
        const updatedTrip = routeToTrip(res.route, activeTrip.id);
        importTrip(updatedTrip);

        const nextVerNum = routeVersions.length + 1;
        setRouteVersions((prev) => [
          ...prev,
          {
            id: `v${nextVerNum}_${activeTrip.id}`,
            versionNum: nextVerNum,
            label: `v${nextVerNum} (AI Düzenleme)`,
            prompt: promptText,
            stops: updatedTrip.pins,
          },
        ]);
        setActiveVersionNum(nextVerNum);
        showToast(
          `✨ ${res.orchestratorSummary?.slice(0, 75) || "Rotanız yapay zeka ile güncellendi!"}`,
        );
        setAiPrompt("");
        setShowAiInput(false);
      } else if (res && res.orchestratorSummary) {
        showToast(`ℹ️ ${res.orchestratorSummary.slice(0, 90)}`);
      } else {
        throw new Error("AI rotayı güncelleyemedi.");
      }
    } catch (err: unknown) {
      console.warn("AI modify error:", err);
      showToast(
        `⚠️ ${err instanceof Error ? err.message : "AI yanıt veremedi. Lütfen tekrar deneyin."}`,
      );
    } finally {
      setIsAiModifying(false);
    }
  };

  const _handleSwitchVersion = (verNum: number) => {
    const target = routeVersions.find((v) => v.versionNum === verNum);
    if (target && activeTrip) {
      importTrip({
        ...activeTrip,
        pins: target.stops,
      });
      setActiveVersionNum(verNum);
      showToast(`✓ Versiyon ${verNum} aktifleştirildi`);
    }
  };

  // Sync edit form state whenever selectedPin changes
  useEffect(() => {
    if (selectedPin) {
      setEditLabel(selectedPin.label);
      setEditCategory(selectedPin.category);
      setEditGroup(selectedPin.group || "Genel");
      setEditNote(selectedPin.note || "");
      setEditDuration(selectedPin.durationMinutes || 60);
      setEditTargetTripId(selectedPin.tripId || "general");
      setEditTargetDayIndex(selectedPin.dayIndex || 0);
      setEditPhotoUrl("");
      setDetailTab("info");
      setPanelCollapsed(false);
      setIsMobileExpanded(true);
      setShowInPanelDetail(true);

      interactionTracker.logPinClick({
        id: selectedPin.id,
        label: selectedPin.label,
        category: selectedPin.category,
        address: selectedPin.address,
        lat: selectedPin.lat,
        lng: selectedPin.lng,
        tripId: selectedPin.tripId,
        dayIndex: selectedPin.dayIndex,
      });
      interactionTracker.logPlaceView({
        label: selectedPin.label,
        placeId: selectedPin.googlePlaceId,
        category: selectedPin.category,
        source: "map_pin",
      });
    }
  }, [selectedPin?.id]);

  useEffect(() => {
    const handleShowDetail = () => {
      setShowInPanelDetail(true);
      setPanelCollapsed(false);
      setDetailTab("info");
      setIsMobileExpanded(true);
    };
    window.addEventListener("mapsbridge:show-pin-detail", handleShowDetail);
    return () => window.removeEventListener("mapsbridge:show-pin-detail", handleShowDetail);
  }, []);

  // Handle saving pin edits
  const handleSavePinEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (guardGuest("Durak Düzenleme", "Durak bilgilerini özelleştirmek için lütfen üye olun."))
      return;
    if (!selectedPin) return;

    const photos = [...(selectedPin.photos || [])];
    if (selectedPin.photo && !photos.includes(selectedPin.photo)) {
      photos.unshift(selectedPin.photo);
    }
    if (editPhotoUrl.trim() && !photos.includes(editPhotoUrl.trim())) {
      photos.push(editPhotoUrl.trim());
    }

    updatePinAnywhere(selectedPin.id, {
      label: editLabel.trim() || selectedPin.label,
      category: editCategory,
      group: editGroup || "Genel",
      note: editNote.trim() || undefined,
      durationMinutes: Number(editDuration) || 60,
      photo: photos[0] || undefined,
      photos: photos.length > 0 ? photos : undefined,
    });

    if (editTargetTripId === "general") {
      if (selectedPin.tripId) {
        movePinToGeneral(selectedPin.id);
      }
    } else {
      assignPinToTrip(selectedPin.id, editTargetTripId, editTargetDayIndex);
    }

    setDetailTab("info");
    showToast("✓ Değişiklikler kaydedildi");
  };

  const handleAddPhotoToPin = (photoSrc: string) => {
    if (guardGuest("Fotoğraf Ekleme", "Duraklara fotoğraf eklemek için lütfen üye olun.")) return;
    if (!selectedPin || !photoSrc.trim()) return;
    const current = [...(selectedPin.photos || [])];
    if (selectedPin.photo && !current.includes(selectedPin.photo)) {
      current.unshift(selectedPin.photo);
    }
    if (!current.includes(photoSrc)) {
      current.push(photoSrc);
    }
    updatePinAnywhere(selectedPin.id, {
      photo: current[0],
      photos: current,
    });
    setInfoNewPhotoUrl("");
    showToast("📷 Fotoğraf eklendi");
  };

  const handleRemovePhoto = (photoIdx: number) => {
    if (!selectedPin || !selectedPin.photos) return;
    const updated = selectedPin.photos.filter((_, idx) => idx !== photoIdx);
    updatePinAnywhere(selectedPin.id, {
      photo: updated[0] || undefined,
      photos: updated.length > 0 ? updated : undefined,
    });
    showToast("Fotoğraf kaldırıldı");
  };

  const handleCopyShare = (pin: Pin) => {
    const url = `${window.location.origin}/desk/?lat=${pin.lat.toFixed(5)}&lng=${pin.lng.toFixed(5)}&label=${encodeURIComponent(pin.label)}`;
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(url);
    }
    showToast("📋 Konum bağlantısı kopyalandı");
  };

  // Filtered stops in active day/route
  const filteredPins = useMemo(() => {
    return pinsWithTime.filter((p) => {
      if (categoryFilter !== "all") {
        if (categoryFilter === "kahve" && p.category !== "kahve") return false;
        if (
          categoryFilter === "gastronomi" &&
          p.category !== "gastronomi" &&
          p.category !== "yemek"
        )
          return false;
        if (categoryFilter === "tarih" && p.category !== "tarih" && p.category !== "muze")
          return false;
        if (categoryFilter === "alisveris" && p.category !== "alisveris") return false;
        if (categoryFilter === "spor" && p.category !== "spor" && p.category !== "aktivite")
          return false;
        if (
          categoryFilter === "gezi" &&
          p.category !== "gezi" &&
          p.category !== "gezilecek" &&
          p.category !== "turistik"
        )
          return false;
      }
      return true;
    });
  }, [pinsWithTime, categoryFilter]);

  return (
    <aside
      className={`travel-planner-panel ${isCollapsed ? "is-collapsed" : "is-expanded"} ${
        isMobileExpanded ? "mobile-expanded" : "mobile-collapsed"
      }`}
      aria-label="Seyahat Haritası"
    >
      {/* Mobile Drag Handle */}
      <button
        type="button"
        aria-expanded={isMobileExpanded}
        className="mobile-sheet-drag-handle"
        onClick={() => setIsMobileExpanded(!isMobileExpanded)}
      >
        <span className="drag-bar" />
        <span className="mobile-handle-text">
          {isMobileExpanded ? "Haritayı Göster ▼" : "Harita Planı ▲"}
        </span>
      </button>

      {/* Floating Notification Toast */}
      {toastMessage && (
        <div className="panel-floating-toast" role="status">
          {toastMessage}
        </div>
      )}

      {/* ── COLLAPSED RAIL VIEW ── */}
      <div className="travel-planner-rail" aria-hidden={!isCollapsed}>
        <button
          type="button"
          className="rail-action-btn rail-expand-toggle"
          onClick={() => setPanelCollapsed(false)}
          title="Harita Planını Aç"
        >
          <span className="material-symbols-outlined">left_panel_open</span>
          <span className="rail-label">Aç</span>
        </button>

        <div className="rail-divider" />

        <button
          type="button"
          className="rail-action-btn active"
          onClick={() => setPanelCollapsed(false)}
          title="Harita Planı"
        >
          <span className="material-symbols-outlined">explore</span>
          <span className="rail-label">Plan</span>
        </button>
      </div>

      {/* ── EXPANDED BODY ── */}
      <div className="travel-planner-expanded-body" aria-hidden={isCollapsed}>
        {/* Subview: Selected Pin Details (Takeover Mode) */}
        {selectedPin && showInPanelDetail ? (
          <div className="pin-detail-view-container">
            {/* Header: Back Button + Title + Close */}
            <div className="pin-detail-nav-bar">
              <button
                type="button"
                className="btn-back-link"
                onClick={() => setShowInPanelDetail(false)}
                title="Rotaya Geri Dön"
              >
                ← Listeye Dön
              </button>

              <span className="pin-detail-title-trunc" title={selectedPin.label}>
                {selectedPin.label}
              </span>

              <button
                type="button"
                className="btn-collapse-toggle"
                onClick={() => setPanelCollapsed(true)}
                title="Paneli Kapat"
              >
                «
              </button>
            </div>

            {/* Sub-tabs: Info vs Edit */}
            <div className="pin-detail-action-tabs">
              <button
                type="button"
                className={`detail-tab-btn ${detailTab === "info" ? "active" : ""}`}
                onClick={() => setDetailTab("info")}
              >
                ℹ️ Bilgi & Notlar
              </button>
              <button
                type="button"
                className={`detail-tab-btn ${detailTab === "edit" ? "active" : ""}`}
                onClick={() => setDetailTab("edit")}
              >
                ✏️ Düzenle
              </button>
            </div>

            {/* TAB 1: INFO & NOTLAR */}
            {detailTab === "info" && (
              <div className="pin-info-content">
                <div className="info-header-box">
                  <div className="info-top-badge-row">
                    <span className="info-category-tag">
                      {DEFAULT_CATEGORY_META[selectedPin.category]?.emoji || "📍"}{" "}
                      {DEFAULT_CATEGORY_META[selectedPin.category]?.label || "Genel"}
                    </span>

                    <button
                      type="button"
                      className={`btn-visited-pill ${selectedPin.visited ? "is-visited" : ""}`}
                      onClick={() => togglePinVisitedAnywhere(selectedPin.id)}
                    >
                      {selectedPin.visited ? "✓ Ziyaret Edildi" : "○ Ziyaret Edilmedi"}
                    </button>
                  </div>

                  <h3 className="info-place-name">{selectedPin.label}</h3>
                  <p className="info-address">{selectedPin.address}</p>

                  {/* Sol Alanda Belirgin Paylaş ve Kaydet Butonları */}
                  <div className="pin-primary-actions-row">
                    <button
                      type="button"
                      className="btn-pin-primary-share"
                      onClick={() => handleCopyShare(selectedPin)}
                      title="Konumu Paylaş"
                    >
                      <span className="material-symbols-outlined">share</span>
                      <span>Paylaş</span>
                    </button>

                    <button
                      type="button"
                      className={`btn-pin-primary-save ${generalPins.some((p) => p.id === selectedPin.id || p.label === selectedPin.label) ? "is-saved" : ""}`}
                      onClick={() => {
                        const alreadySaved = generalPins.some(
                          (p) => p.id === selectedPin.id || p.label === selectedPin.label,
                        );
                        if (alreadySaved) {
                          showToast("📍 Bu durak zaten kayıtlı havuzunuzda mevcut.");
                        } else {
                          addPinToGeneral({
                            label: selectedPin.label,
                            lat: selectedPin.lat,
                            lng: selectedPin.lng,
                            category: selectedPin.category,
                            address: selectedPin.address,
                            note: selectedPin.note,
                            group: "Genel",
                            durationMinutes: selectedPin.durationMinutes,
                            dayIndex: 0,
                            visited: false,
                          });
                          showToast("✓ Durak kayıtlı adreslerinize eklendi!");
                        }
                      }}
                      title="Kayıtlı Adreslerime Ekle"
                    >
                      <span className="material-symbols-outlined">
                        {generalPins.some(
                          (p) => p.id === selectedPin.id || p.label === selectedPin.label,
                        )
                          ? "bookmark_added"
                          : "bookmark_add"}
                      </span>
                      <span>
                        {generalPins.some(
                          (p) => p.id === selectedPin.id || p.label === selectedPin.label,
                        )
                          ? "Kaydedildi"
                          : "Kaydet"}
                      </span>
                    </button>
                  </div>

                  <div className="info-meta-list">
                    <div className="info-meta-row">
                      <span className="info-meta-label">Planlanan Süre</span>
                      <span className="info-meta-value">
                        ⏱️ {selectedPin.durationMinutes || 60} dakika
                      </span>
                    </div>
                    <div className="info-meta-row">
                      <span className="info-meta-label">Bağlı Olduğu Gezi</span>
                      <span className="info-meta-value">
                        {selectedPin.tripId
                          ? `🗺️ ${trips.find((t) => t.id === selectedPin.tripId)?.title || "Gezi"} (${selectedPin.dayIndex}. Gün)`
                          : "📌 Genel Havuz"}
                      </span>
                    </div>
                    {selectedPin.calculatedStartTime && selectedPin.calculatedEndTime && (
                      <div className="info-meta-row">
                        <span className="info-meta-label">Planlanan Zaman</span>
                        <span className="info-meta-value">
                          🕐 {selectedPin.calculatedStartTime}–{selectedPin.calculatedEndTime}
                        </span>
                      </div>
                    )}
                    {selectedPin.isLocked && selectedPin.fixedTime && (
                      <div className="info-meta-row">
                        <span className="info-meta-label">Sabit Saat</span>
                        <span className="info-meta-value">🔒 {selectedPin.fixedTime}</span>
                      </div>
                    )}
                    {typeof selectedPin.transitDurationFromPrevious === "number" &&
                      selectedPin.transitDurationFromPrevious > 0 && (
                        <div className="info-meta-row">
                          <span className="info-meta-label">Önceki Duraktan</span>
                          <span className="info-meta-value">
                            🚶 ~{selectedPin.transitDurationFromPrevious} dk yol
                          </span>
                        </div>
                      )}
                    {selectedPin.interestTag && (
                      <div className="info-meta-row">
                        <span className="info-meta-label">İlgi Etiketi</span>
                        <span className="info-meta-value">🏷 {selectedPin.interestTag}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notlar */}
                <div className="info-section-group">
                  <h4 className="info-section-title">📝 Gezgin Notları</h4>
                  {selectedPin.note ? (
                    <div className="info-notes-quote">&quot;{selectedPin.note}&quot;</div>
                  ) : (
                    <div className="info-empty-note">
                      <span>Henüz özel not eklenmemiş.</span>
                      <button
                        type="button"
                        className="btn-add-note-inline"
                        onClick={() => setDetailTab("edit")}
                      >
                        + Not Ekle
                      </button>
                    </div>
                  )}
                </div>

                {/* AI'ya Sor — mekan hakkında anlık soru-cevap */}
                <div className="info-section-group">
                  <h4 className="info-section-title">🤖 AI'ya Sor</h4>
                  <p className="ask-ai-hint">
                    Bu mekan hakkında merak ettiğinizi sorun. Yanıtlar mevcut mekan verisine
                    dayanır.
                  </p>
                  <div className="ask-ai-input-row">
                    <input
                      type="text"
                      className="ask-ai-input"
                      placeholder="Örn: Ne zaman gitmeliyim? Çevresinde ne var?"
                      value={askPlaceQuestion}
                      onChange={(e) => setAskPlaceQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !askPlaceLoading) {
                          void handleAskAboutPlace(selectedPin);
                        }
                      }}
                      disabled={askPlaceLoading}
                    />
                    <button
                      type="button"
                      className="btn-ask-ai"
                      disabled={askPlaceLoading || !askPlaceQuestion.trim()}
                      onClick={() => void handleAskAboutPlace(selectedPin)}
                    >
                      {askPlaceLoading ? "…" : "Sor"}
                    </button>
                  </div>
                  {askPlaceLoading && (
                    <div className="ask-ai-loading">🤖 Yapay zeka yanıtını hazırlıyor...</div>
                  )}
                  {askPlaceAnswer && !askPlaceLoading && (
                    <div className="ask-ai-answer">{askPlaceAnswer}</div>
                  )}
                </div>
                {/* Fotoğraflar */}
                <div className="info-section-group">
                  <div className="info-photos-header">
                    <h4 className="info-section-title">📷 Fotoğraflar</h4>
                    <label className="btn-file-upload-label" title="Cihazdan fotoğraf seç">
                      📁 Yükle
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === "string") {
                              handleAddPhotoToPin(reader.result);
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  </div>

                  <div className="info-photos-grid">
                    {selectedPin.photos && selectedPin.photos.length > 0 ? (
                      selectedPin.photos.map((url, i) => (
                        <div key={i} className="photo-card-item">
                          <img
                            src={url}
                            alt={`${selectedPin.label} - ${i + 1}`}
                            className="photo-thumbnail-img"
                          />
                          <button
                            type="button"
                            className="photo-remove-btn"
                            onClick={() => handleRemovePhoto(i)}
                            title="Fotoğrafı Kaldır"
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    ) : selectedPin.photo ? (
                      <div className="photo-card-item">
                        <img
                          src={selectedPin.photo}
                          alt={selectedPin.label}
                          className="photo-thumbnail-img"
                        />
                      </div>
                    ) : (
                      <div className="no-photos-box">
                        <span>Fotoğraf eklenmemiş</span>
                      </div>
                    )}
                  </div>

                  <div className="add-photo-url-row">
                    <input
                      type="url"
                      className="input-sm-photo"
                      placeholder="Görsel URL yapıştır (https://...)"
                      value={infoNewPhotoUrl}
                      onChange={(e) => setInfoNewPhotoUrl(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-sm-photo-add"
                      disabled={!infoNewPhotoUrl.trim()}
                      onClick={() => handleAddPhotoToPin(infoNewPhotoUrl)}
                    >
                      Ekle
                    </button>
                  </div>
                </div>

                {/* Google Maps Mekan & Yorum Bilgileri (Çok Katmanlı Önbellek) */}
                <div
                  className="info-section-group"
                  style={{
                    marginTop: "0.75rem",
                    padding: "0.75rem",
                    backgroundColor: "color-mix(in srgb, var(--color-surface) 3%, transparent)",
                    borderRadius: "12px",
                    border: "1px solid var(--color-white-a08)",
                  }}
                >
                  <GooglePlaceInfo
                    placeId={selectedPin.googlePlaceId}
                    label={selectedPin.label}
                    lat={selectedPin.lat}
                    lng={selectedPin.lng}
                    onLink={(linkedPlaceId) => {
                      updatePinAnywhere(selectedPin.id, { googlePlaceId: linkedPlaceId });
                      showToast("✓ Pin Google mekanıyla eşleştirildi!");
                    }}
                  />
                </div>

                {/* Sil / Düzenle toolbar */}
                <div className="info-actions-toolbar">
                  <button
                    type="button"
                    className="btn-info-edit-trigger"
                    onClick={() => setDetailTab("edit")}
                  >
                    ✏️ Düzenle
                  </button>
                  <button
                    type="button"
                    className="btn-sub-action btn-danger"
                    onClick={() => {
                      if (
                        confirm(`"${selectedPin.label}" pinini silmek istediğinize emin misiniz?`)
                      ) {
                        deletePinAnywhere(selectedPin.id);
                        setShowInPanelDetail(false);
                      }
                    }}
                  >
                    🗑️ Pini Sil
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: EDIT FORM */}
            {detailTab === "edit" && (
              <form onSubmit={handleSavePinEdit} className="pin-edit-form">
                <div className="form-group">
                  <label className="form-label">Mekan İsmi</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Kategori</label>
                  <div className="category-chips-grid">
                    {Object.entries(DEFAULT_CATEGORY_META).map(([catKey, meta]) => (
                      <button
                        key={catKey}
                        type="button"
                        className={`cat-chip-btn ${editCategory === catKey ? "active" : ""}`}
                        onClick={() => setEditCategory(catKey as PinCategory)}
                      >
                        <span>{meta.emoji}</span>
                        <span>{meta.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Gezi & Gün Ataması</label>
                  <div className="form-dual-select">
                    <select
                      className="form-select"
                      aria-label="Gezi"
                      value={editTargetTripId}
                      onChange={(e) => setEditTargetTripId(e.target.value)}
                    >
                      <option value="general">📌 Genel Havuz (Atanmamış)</option>
                      {trips.map((t) => (
                        <option key={t.id} value={t.id}>
                          🗺️ {t.title}
                        </option>
                      ))}
                    </select>

                    {editTargetTripId !== "general" && (
                      <select
                        className="form-select"
                        aria-label="Gün"
                        value={editTargetDayIndex}
                        onChange={(e) => setEditTargetDayIndex(Number(e.target.value))}
                      >
                        <option value={0}>🌟 Karışık (Günsüz)</option>
                        {trips
                          .find((t) => t.id === editTargetTripId)
                          ?.days.map((d) => (
                            <option key={d.dayIndex} value={d.dayIndex}>
                              {d.label}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Gezgin Notu</label>
                  <textarea
                    className="form-input form-textarea"
                    rows={3}
                    placeholder="Örn: Gün batımı için rezervasyon şart..."
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                  />
                </div>

                <div className="form-actions-row">
                  <button
                    type="button"
                    className="btn-cancel-inline"
                    onClick={() => setDetailTab("info")}
                  >
                    İptal
                  </button>
                  <button type="submit" className="btn-save-inline">
                    ✓ Kaydet
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* ── MAIN WORKSPACE VIEW (Clean, Unified Stitch Design) ── */
          <div className="planner-main-container">
            {/* ════════════════════════════════════════════════════════════════ */}
            {/* 1. HEADER: TRIP SELECTOR, DUAL MODES & DAY TABS                  */}
            {/* ════════════════════════════════════════════════════════════════ */}
            <div className="stitch-desk-header">
              {/* Row 1: Trip Selector + Mode Switcher + Collapse Button */}
              <div className="stitch-desk-top-row">
                {/* Active Trip Selector Button with Dropdown */}
                <div className="stitch-route-selector-wrapper">
                  <div
                    onClick={() => setShowRouteMenu(!showRouteMenu)}
                    className="stitch-route-selector-box"
                    title="Rotayı değiştir veya yeni rota ekle"
                  >
                    <div className="stitch-route-selector-icon">
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                        alt_route
                      </span>
                    </div>
                    <div className="stitch-route-selector-text">
                      <div className="stitch-route-title-wrap">
                        <h2 className="stitch-route-title-text">
                          {activeTrip?.title || "Yeni Seyahat Planım"}
                        </h2>
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "16px", color: "#94a3b8" }}
                        >
                          {showRouteMenu ? "expand_less" : "expand_more"}
                        </span>
                      </div>
                      <div className="stitch-route-sub-meta">
                        <span className="stitch-route-count-badge">
                          {(activeTrip?.pins || []).length} Durak
                        </span>
                        {activeTrip?.destination && (
                          <>
                            <span>•</span>
                            <span
                              style={{
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {activeTrip.destination}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Route Switcher Dropdown */}
                  {showRouteMenu && (
                    <div className="stitch-route-dropdown-menu">
                      <div className="stitch-dropdown-head">
                        <span>Kayıtlı Rotalarınız</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowRouteMenu(false);
                            setShowInlineNewTrip(true);
                          }}
                          className="stitch-dropdown-add-btn"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                            add_circle
                          </span>
                          Yeni Rota
                        </button>
                      </div>

                      <div className="stitch-route-list-scroll">
                        {trips.map((t) => {
                          const isActive = t.id === activeTripId;
                          return (
                            <div
                              key={t.id}
                              onClick={() => {
                                switchTrip(t.id);
                                setActiveDayIndex(0);
                                setShowRouteMenu(false);
                              }}
                              className={`stitch-route-dropdown-item ${isActive ? "active" : ""}`}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  minWidth: 0,
                                }}
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{
                                    fontSize: "17px",
                                    color: isActive ? "#047857" : "#94a3b8",
                                  }}
                                >
                                  {isActive ? "check_circle" : "alt_route"}
                                </span>
                                <div
                                  style={{ display: "flex", flexDirection: "column", minWidth: 0 }}
                                >
                                  <span
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: isActive ? 800 : 600,
                                      color: isActive ? "#065f46" : "#334155",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {t.title}
                                  </span>
                                  <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                                    {t.pins.length} Durak{" "}
                                    {t.destination ? `• ${t.destination}` : ""}
                                  </span>
                                </div>
                              </div>

                              {trips.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (
                                      confirm(
                                        `"${t.title}" rotasını silmek istediğinizden emin misiniz?`,
                                      )
                                    ) {
                                      deleteTrip(t.id);
                                      showToast("🗑️ Rota silindi.");
                                    }
                                  }}
                                  className="stitch-icon-action-btn btn-delete"
                                  title="Rotayı Sil"
                                >
                                  <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: "15px" }}
                                  >
                                    delete
                                  </span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Controls: Collapse only */}
                <div className="stitch-header-right-ctrls">
                  {/* Panel Collapse Toggle */}
                  <button
                    type="button"
                    className="stitch-collapse-action-btn"
                    onClick={() => setPanelCollapsed(true)}
                    title="Paneli Daralt"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                      left_panel_close
                    </span>
                  </button>
                </div>
              </div>

              {/* Inline New Route Creator Drawer */}
              {showInlineNewTrip && (
                <div className="stitch-drawer-card">
                  <div className="stitch-drawer-header">
                    <span className="stitch-drawer-title">
                      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                        add_location_alt
                      </span>
                      Yeni Seyahat Rotası Oluştur
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowInlineNewTrip(false)}
                      className="stitch-icon-action-btn"
                    >
                      ✕
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Rota Başlığı (örn: Kapadokya Keşfi)..."
                    value={newTripTitle}
                    onChange={(e) => setNewTripTitle(e.target.value)}
                    className="stitch-drawer-input"
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Hedef Şehir / Bölge (opsiyonel)..."
                    value={newTripDest}
                    onChange={(e) => setNewTripDest(e.target.value)}
                    className="stitch-drawer-input"
                  />
                  <div className="stitch-drawer-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setShowInlineNewTrip(false);
                        setNewTripTitle("");
                        setNewTripDest("");
                      }}
                      className="stitch-btn-secondary"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newTripTitle.trim()) {
                          showToast("Lütfen rota başlığı girin.");
                          return;
                        }
                        createTrip(newTripTitle.trim(), newTripDest.trim() || undefined);
                        showToast(`✓ "${newTripTitle.trim()}" oluşturuldu!`);
                        setShowInlineNewTrip(false);
                        setNewTripTitle("");
                        setNewTripDest("");
                      }}
                      className="stitch-btn-primary"
                    >
                      Oluştur
                    </button>
                  </div>
                </div>
              )}

              {/* Row 2: Day Tabs Bar */}
              <div className="stitch-days-scroll-row">
                <button
                  type="button"
                  className={`stitch-day-tab-pill ${activeDayIndex === 0 || activeDayIndex === null ? "active" : ""}`}
                  onClick={() => setActiveDayIndex(0)}
                  title="Tüm Günleri Göster"
                >
                  Tümü ({(activeTrip?.pins || []).length})
                </button>
                {(activeTrip?.days || []).map((d) => {
                  const dayPinsCount = (activeTrip.pins || []).filter(
                    (p) => p.dayIndex === d.dayIndex,
                  ).length;
                  const isActive = activeDayIndex === d.dayIndex;
                  return (
                    <button
                      key={d.dayIndex}
                      type="button"
                      className={`stitch-day-tab-pill ${isActive ? "active" : ""}`}
                      onClick={() => setActiveDayIndex(d.dayIndex)}
                    >
                      {d.dayIndex}. Gün ({dayPinsCount})
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="stitch-day-add-pill"
                  title="Yeni Gün Ekle"
                  onClick={() => {
                    addDay();
                    showToast("🗓️ Yeni gün eklendi");
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                    add
                  </span>
                  <span>Gün</span>
                </button>
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* 2. SEARCH & QUICK ACTION TOOLBAR (Streamlined, Single Row)       */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {workspaceMode === "edit" && (
              <div className="stitch-toolbar-panel">
                {/* Address / Place Search Input */}
                <form
                  className="stitch-search-input-group"
                  onSubmit={
                    googleMapsEnabled
                      ? (e) => {
                          e.preventDefault();
                          document.getElementById("google-place-query")?.focus();
                        }
                      : handleSidebarSearchSubmit
                  }
                >
                  <span className="material-symbols-outlined stitch-search-icon-left">search</span>
                  <input
                    type="text"
                    className="stitch-search-input-field"
                    placeholder="Mekan veya adres ara..."
                    value={sidebarSearch}
                    onChange={(e) => setSidebarSearch(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={isSidebarSearching}
                    className="stitch-search-submit-btn"
                  >
                    {isSidebarSearching ? "..." : "Bul"}
                  </button>
                </form>

                {/* Search Result Card */}
                {foundPlace && (
                  <div className="stitch-search-result-box">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <h4
                        style={{
                          fontSize: "12px",
                          fontWeight: 800,
                          color: "var(--color-on-surface-brand)",
                          margin: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span>📍</span>
                        <span
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {foundPlace.label}
                        </span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setFoundPlace(null)}
                        className="stitch-icon-action-btn"
                      >
                        ✕
                      </button>
                    </div>
                    <p
                      style={{
                        fontSize: "11px",
                        color: "var(--color-success)",
                        margin: 0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {foundPlace.address}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        paddingTop: "4px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleAddFoundPlace("trip")}
                        className="stitch-btn-primary"
                        style={{ flex: 1, padding: "5px 10px" }}
                      >
                        + Rotaya Ekle
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddFoundPlace("general")}
                        className="stitch-btn-secondary"
                        style={{ padding: "5px 10px" }}
                      >
                        📌 Havuz
                      </button>
                    </div>
                  </div>
                )}

                {/* Rotayı Optimize Et */}
                <button
                  type="button"
                  onClick={() => {
                    onRunOptimize?.();
                    showToast("⚡ Duraklar coğrafi sıraya göre optimize ediliyor...");
                  }}
                  className="stitch-quick-grid-btn"
                  style={{ width: "100%", justifyContent: "center", gap: "8px" }}
                  title="Durakları en uygun yol sırasına göre optimize et"
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "15px", color: "var(--color-warning-icon)" }}
                  >
                    auto_fix_high
                  </span>
                  <span>Rotayı Optimize Et</span>
                </button>

                {/* Optional Category Filter Chips (Shown when there are stops) */}
                {pinsWithTime.length > 0 && (
                  <div className="stitch-chips-category-bar">
                    {[
                      { id: "all", label: "Tümü" },
                      { id: "gastronomi", label: "🍽️ Yemek" },
                      { id: "tarih", label: "🏛️ Tarih" },
                      { id: "spor", label: "🏃 Spor" },
                      { id: "gezi", label: "🧭 Gezi" },
                      { id: "kahve", label: "☕ Kahve" },
                      { id: "alisveris", label: "🛍️ Çarşı" },
                    ].map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        className={`stitch-category-chip-btn ${categoryFilter === chip.id ? "active" : ""}`}
                        onClick={() => setCategoryFilter(chip.id)}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Mode Toggle (always visible, below tools panel) ── */}
            <div
              style={{
                display: "flex",
                width: "100%",
                borderTop: "1px solid color-mix(in srgb, var(--color-border) 60%, transparent)",
                marginTop: "4px",
                paddingTop: "8px",
                paddingLeft: "12px",
                paddingRight: "12px",
                paddingBottom: "4px",
              }}
            >
              <button
                type="button"
                onClick={() => setWorkspaceMode("edit")}
                className={`stitch-mode-segment-btn ${workspaceMode === "edit" ? "active" : ""}`}
                style={{ flex: 1, justifyContent: "center" }}
                title="Rota Düzenleme Modu"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                  edit_location_alt
                </span>
                <span>Düzenle</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceMode("travel")}
                className={`stitch-mode-segment-btn ${workspaceMode === "travel" ? "active" : ""}`}
                style={{ flex: 1, justifyContent: "center" }}
                title="Gezi / Navigasyon Modu"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                  navigation
                </span>
                <span>Gezi Modu</span>
              </button>
            </div>

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* WORKSPACE MODE 2: GEZİ MODU (Navigation / Progress Mode)        */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {workspaceMode === "travel" && (
              <div className="stitch-toolbar-panel">
                <div className="stitch-travel-overview-box">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "12px",
                      fontWeight: 800,
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        color: "var(--color-text)",
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "17px", color: "var(--color-success)" }}
                      >
                        navigation
                      </span>
                      <span
                        style={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {activeTrip?.title || "Aktif Gezi"}
                      </span>
                    </span>
                    <span style={{ color: "var(--color-success)", fontSize: "11px" }}>
                      {pinsWithTime.filter((p) => p.visited).length} / {pinsWithTime.length} Durak (
                      {pinsWithTime.length > 0
                        ? Math.round(
                            (pinsWithTime.filter((p) => p.visited).length / pinsWithTime.length) *
                              100,
                          )
                        : 0}
                      %)
                    </span>
                  </div>

                  <div
                    style={{
                      width: "100%",
                      height: "6px",
                      borderRadius: "99px",
                      background: "var(--color-neutral-200)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        background: "var(--color-accent)",
                        borderRadius: "99px",
                        transition: "width 0.3s ease",
                        width: `${
                          pinsWithTime.length > 0
                            ? Math.round(
                                (pinsWithTime.filter((p) => p.visited).length /
                                  pinsWithTime.length) *
                                  100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: "4px",
                    }}
                  >
                    <span style={{ fontSize: "11px", color: "var(--color-text-subtle)" }}>
                      ⏱️ Toplam:{" "}
                      {daySummary?.totalDayDurationMinutes
                        ? (daySummary.totalDayDurationMinutes / 60).toFixed(1)
                        : "2.5"}{" "}
                      saat
                    </span>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={handleExportToGoogleMaps}
                        className="stitch-btn-primary"
                        style={{ display: "flex", alignItems: "center", gap: "4px" }}
                        title="Tüm rotayı Google Maps'e aktar"
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "14px", color: "var(--color-accent-strong)" }}
                        >
                          navigation
                        </span>
                        <span>Google Maps</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent("mapsbridge:open-trip-manifesto"));
                        }}
                        className="stitch-btn-secondary"
                        style={{ display: "flex", alignItems: "center", gap: "4px" }}
                        title="Seyahat Rotası Markdown Manifestosu (.md)"
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "14px", color: "#38bdf8" }}
                        >
                          article
                        </span>
                        <span>.MD</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent("mapsbridge:open-deal-tracker"));
                        }}
                        className="stitch-btn-secondary"
                        style={{ display: "flex", alignItems: "center", gap: "4px" }}
                        title="Ucuz Bilet ve Otel Fiyat Takip Botu"
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "14px", color: "var(--color-warning-icon)" }}
                        >
                          smart_toy
                        </span>
                        <span>Fiyat Botu</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const nextUnvisited = pinsWithTime.find((p) => !p.visited);
                          if (nextUnvisited) {
                            setSelectedPinId(nextUnvisited.id);
                            onFlyToPin?.(nextUnvisited);
                            showToast(`📍 Sıradaki durak: ${nextUnvisited.label}`);
                          } else {
                            showToast("🎉 Tüm duraklar tamamlandı!");
                          }
                        }}
                        className="stitch-btn-secondary"
                        style={{ display: "flex", alignItems: "center", gap: "4px" }}
                        title="Sıradaki durağa haritada odaklan"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                          my_location
                        </span>
                        <span>Sıradaki</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* 3. MAP-CLICKED LOCATION CARD (Sleek Stitch Location Drawer)      */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {selectedMapPoint && (
              <div className="stitch-map-point-banner">
                <div className="stitch-map-point-top">
                  <span className="stitch-map-point-badge">
                    <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
                      pin_drop
                    </span>
                    Haritadan Seçildi
                  </span>
                  <button
                    type="button"
                    onClick={onClearSelectedMapPoint}
                    className="stitch-icon-action-btn"
                    title="Kapat"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                      close
                    </span>
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <h4
                    style={{
                      fontSize: "13px",
                      fontWeight: 800,
                      color: "var(--color-text)",
                      margin: 0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {selectedMapPoint.address.split(",")[0] || "Yeni Durak"}
                  </h4>
                  <p
                    style={{
                      fontSize: "11px",
                      color: "var(--color-text-subtle)",
                      margin: 0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {selectedMapPoint.address}
                  </p>
                </div>
                <div className="stitch-map-point-actions">
                  <button
                    type="button"
                    onClick={() => {
                      const label = selectedMapPoint.address.split(",")[0] || "Yeni Rota Durağı";
                      const targetDay = activeDayIndex && activeDayIndex > 0 ? activeDayIndex : 1;
                      addPinDirectlyToTrip(
                        activeTripId,
                        {
                          label,
                          address: selectedMapPoint.address,
                          lat: selectedMapPoint.lat,
                          lng: selectedMapPoint.lng,
                          category: "genel",
                          dayIndex: targetDay,
                          group: "Genel",
                          visited: false,
                          durationMinutes: 60,
                        },
                        targetDay,
                      );
                      onClearSelectedMapPoint?.();
                      showToast(`✓ "${label}" ${targetDay}. güne durak olarak eklendi`);
                    }}
                    className="stitch-btn-add-route"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                      add_location
                    </span>
                    <span>+ Rotaya Durak Ekle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      addPinToGeneral({
                        label: selectedMapPoint.address.split(",")[0] || "Yeni Havuz Durağı",
                        address: selectedMapPoint.address,
                        lat: selectedMapPoint.lat,
                        lng: selectedMapPoint.lng,
                        category: "genel",
                        dayIndex: 0,
                        group: "Genel",
                        visited: false,
                        durationMinutes: 60,
                      });
                      onClearSelectedMapPoint?.();
                      showToast("Nokta havuza kaydedildi.");
                    }}
                    className="stitch-btn-add-pool"
                  >
                    Havuza Kaydet
                  </button>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* ITINERARY FEED: REDESIGNED STITCH TIMELINE & CARDS               */}
            {/* ════════════════════════════════════════════════════════════════ */}
            <div className="stitch-feed-scroller">
              {filteredPins.length === 0 ? (
                <div className="stitch-empty-notice-card">
                  <div className="stitch-empty-icon-circle">
                    <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                      explore_nearby
                    </span>
                  </div>
                  <h3
                    style={{
                      fontSize: "13.5px",
                      fontWeight: 800,
                      color: "var(--color-text)",
                      margin: 0,
                    }}
                  >
                    {pinsWithTime.length === 0
                      ? "Rotanızda Henüz Durak Yok"
                      : "Filtreye Uygun Durak Bulunamadı"}
                  </h3>
                  <p
                    style={{
                      fontSize: "11.5px",
                      color: "var(--color-text-subtle)",
                      maxWidth: "260px",
                      lineHeight: "1.4",
                      margin: 0,
                    }}
                  >
                    {pinsWithTime.length === 0
                      ? "Yukarıdaki arama çubuğundan mekan arayabilir veya haritaya tıklayarak ilk durağınızı ekleyebilirsiniz."
                      : "Filtreyi 'Tümü' yaparak diğer durakları görebilirsiniz."}
                  </p>
                  {categoryFilter !== "all" && (
                    <button
                      type="button"
                      onClick={() => setCategoryFilter("all")}
                      className="stitch-btn-primary"
                      style={{ marginTop: "4px" }}
                    >
                      Tüm Durakları Göster
                    </button>
                  )}
                </div>
              ) : (
                filteredPins.map((pin, index) => {
                  const isSelected = pin.id === selectedPinId;
                  const catMeta =
                    DEFAULT_CATEGORY_META[pin.category] || DEFAULT_CATEGORY_META.genel;
                  const prevPin = index > 0 ? filteredPins[index - 1] : null;

                  return (
                    <React.Fragment key={pin.id}>
                      {/* ── Transit Connector (Between consecutive stops) ── */}
                      {index > 0 && prevPin && (
                        <div className="travel-transit-connector">
                          <div className="transit-icon-pill">
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: "14px" }}
                            >
                              directions_walk
                            </span>
                            <span>~{pin.transitDurationFromPrevious || index * 3 + 4} dk</span>
                          </div>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&origin=${prevPin.lat},${prevPin.lng}&destination=${pin.lat},${pin.lng}&travelmode=walking`}
                            target="_blank"
                            rel="noreferrer"
                            className="transit-directions-btn"
                            title="Google Maps üzerinde yol tarifi al"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span>Yol Tarifi</span>
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: "12px" }}
                            >
                              open_in_new
                            </span>
                          </a>
                        </div>
                      )}

                      {/* ── Stop Card ── */}
                      <div
                        className={`stitch-card-stop ${isSelected ? "selected" : ""}`}
                        onClick={() => {
                          setSelectedPinId(pin.id);
                          onFlyToPin?.(pin);
                        }}
                      >
                        <div className="stitch-card-main-row">
                          <div className="stitch-card-left-wrap">
                            <div className={`stitch-card-badge ${pin.visited ? "visited" : ""}`}>
                              {pin.visited ? (
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: "16px" }}
                                >
                                  check
                                </span>
                              ) : (
                                pin.order || index + 1
                              )}
                            </div>

                            <div className="stitch-card-text-col">
                              <div className="stitch-card-title-row">
                                <h4 className="stitch-card-title">{pin.label}</h4>
                                <span className="stitch-card-time">{calcStopTime(index)}</span>
                              </div>

                              <div className="stitch-card-meta">
                                <span style={{ fontWeight: 600 }}>
                                  {catMeta.emoji} {catMeta.label}
                                </span>
                                <span>•</span>
                                <span>{pin.durationMinutes || 45} dk</span>
                                {pin.visited && (
                                  <>
                                    <span>•</span>
                                    <span
                                      style={{
                                        color: "var(--color-success-strong)",
                                        fontWeight: 700,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "2px",
                                      }}
                                    >
                                      <span
                                        className="material-symbols-outlined"
                                        style={{ fontSize: "13px" }}
                                      >
                                        check_circle
                                      </span>
                                      Ziyaret Edildi
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right Controls */}
                          {workspaceMode === "edit" ? (
                            <div
                              className="stitch-card-actions"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMovePinOrder(pin, "up")}
                                className="stitch-card-action-btn"
                                title="Yukarı Taşı"
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: "15px" }}
                                >
                                  arrow_upward
                                </span>
                              </button>
                              <button
                                type="button"
                                disabled={index === filteredPins.length - 1}
                                onClick={() => handleMovePinOrder(pin, "down")}
                                className="stitch-card-action-btn"
                                title="Aşağı Taşı"
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: "15px" }}
                                >
                                  arrow_downward
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPinId(pin.id);
                                  setShowInPanelDetail(true);
                                  setDetailTab("edit");
                                }}
                                className="stitch-card-action-btn"
                                title="Düzenle"
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: "15px" }}
                                >
                                  edit
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    confirm(
                                      `"${pin.label}" durağını silmek istediğinizden emin misiniz?`,
                                    )
                                  ) {
                                    deletePinAnywhere(pin.id);
                                    showToast("Durak silindi.");
                                  }
                                }}
                                className="stitch-card-action-btn btn-delete"
                                title="Sil"
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: "15px" }}
                                >
                                  delete_outline
                                </span>
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePinVisitedAnywhere(pin.id);
                              }}
                              className={`stitch-btn-secondary ${pin.visited ? "active" : ""}`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "4px 8px",
                              }}
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: "14px" }}
                              >
                                {pin.visited ? "check_circle" : "radio_button_unchecked"}
                              </span>
                              <span>{pin.visited ? "Tamamlandı" : "Tamamla"}</span>
                            </button>
                          )}
                        </div>

                        {pin.note && <div className="stitch-card-note">💡 {pin.note}</div>}
                      </div>
                    </React.Fragment>
                  );
                })
              )}

              {/* General Pool Accordion (Kayıtlı Adresler) - Sadece Rota Düzenleme Modunda */}
              {workspaceMode === "edit" && generalPins.length > 0 && (
                <details
                  className="stitch-pool-accordion"
                  style={{ marginTop: "8px", marginBottom: "8px" }}
                  open={false}
                >
                  <summary className="stitch-pool-summary">
                    <div className="pool-summary-title-row">
                      <span
                        className="material-symbols-outlined"
                        style={{ color: "var(--color-success)", fontSize: "18px" }}
                      >
                        inventory_2
                      </span>
                      <span className="pool-summary-title">
                        Kayıtlı Durak Havuzu ({generalPins.length} Yer)
                      </span>
                    </div>
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "20px", color: "var(--color-text-subtle)" }}
                    >
                      expand_more
                    </span>
                  </summary>

                  <div className="pool-items-container">
                    {generalPins.map((gPin) => (
                      <div key={gPin.id} className="pool-item-row">
                        <div className="pool-item-info">
                          <div className="pool-item-icon-box">
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: "14px" }}
                            >
                              {gPin.category === "kahve"
                                ? "coffee"
                                : gPin.category === "gastronomi"
                                  ? "bakery_dining"
                                  : "tour"}
                            </span>
                          </div>
                          <div style={{ minWidth: 0, overflow: "hidden" }}>
                            <p className="pool-item-name">{gPin.label}</p>
                            <p className="pool-item-address">{gPin.address}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn-pool-assign"
                          onClick={() => {
                            assignPinToTrip(gPin.id, activeTripId, activeDayIndex ?? 1);
                            showToast(`✓ "${gPin.label}" rotaya eklendi`);
                          }}
                        >
                          + Ekle
                        </button>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        )}
      </div>

      {showManualAdd && (
        <ManualPinModal
          isOpen={showManualAdd}
          onClose={() => setShowManualAdd(false)}
          onSubmit={handleCreateManualPin}
          tripDaysCount={activeTrip?.days?.length || 1}
          activeDayIndex={activeDayIndex}
        />
      )}
    </aside>
  );
}
