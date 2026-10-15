"use client";

import { HeaderNav, MobileNav } from "../components/header-nav";

import { userStorage } from "../lib/user-storage";

import { API_ENDPOINT, readShare } from "../lib/api";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getStoredSession, refreshSession, signOut } from "../lib/cognito";
import { AuthActionModal, PanelGuestBanner } from "../components/auth-gate";
import { AuthGuard } from "../components/auth-guard";
import { AIPromoLanding } from "../ai/ai-promo-landing";
import {
  GooglePlannerMap,
  type GoogleMapHandle,
  type GooglePoint,
} from "../components/trip/google-planner-map";
import { googleMapsEnabled } from "../lib/google/maps-client";
import { MobilePinSheet } from "../components/trip/mobile-pin-sheet";
import type { Pin } from "../lib/trip/models";
import { TravelPlannerSidebar } from "../components/trip/travel-planner-sidebar";
import { useTravelPlanner } from "../lib/trip/use-travel-planner";
import { DEFAULT_CATEGORY_META } from "../lib/trip/models";
import { reverseGeocodeLocation, searchPlaces } from "../lib/trip/geocoding-service";
import { tripToMarkdown } from "../lib/trip/trip-markdown";
import { billingService } from "../lib/billing/billing-service";
import { interactionTracker } from "../lib/analytics/tracker";
import { DealTrackerPanel } from "../components/tracker/deal-tracker-panel";
import "../components/trip/travel-planner.css";
import "./desk.css";

import { useLocale, getAlternatePath } from "../lib/locale-context";
import {
  IconLocationPin,
  IconBookmark,
  IconShare,
  IconClock,
  IconSearch,
  IconCalendar,
  IconNote,
  IconPlus,
  IconCheck,
  IconCompass,
  IconCopy,
  IconLayers,
} from "../components/icons";
import {
  CATEGORIES,
  MAP_STYLES,
  PIN_COLORS,
  MAP_FILTERS,
  type PlaceCategory,
  type CategoryMeta,
  type MapStyleId,
  type MapStyleOption,
} from "../features/trip-planner/map-styles";

export { CATEGORIES, MAP_STYLES, PIN_COLORS, MAP_FILTERS };
export type { PlaceCategory, CategoryMeta, MapStyleId, MapStyleOption };

export interface MapTemplate {
  id: string;
  name: string;
  badge?: string;
  icon: string;
  description: string;
  mapStyle: MapStyleId;
  pinColor: string;
  transitOverlay: boolean;
  filter: string;
}

export const MAP_TEMPLATES: MapTemplate[] = [
  {
    id: "tpl_minimal",
    name: "Simple and Balanced",
    badge: "Popular",
    icon: "🏙️",
    description: "Clear streets and a spacious, easy-to-read layout",
    mapStyle: "standart",
    pinColor: "#2563eb",
    transitOverlay: false,
    filter: "none",
  },
  {
    id: "tpl_night",
    name: "Night Explorer",
    badge: "Dark",
    icon: "🌙",
    description: "A dark minimalist canvas with glowing emerald markers",
    mapStyle: "koyu",
    pinColor: "#10b981",
    transitOverlay: false,
    filter: "contrast",
  },
  {
    id: "tpl_metro",
    name: "City and Transit",
    badge: "Transit",
    icon: "🚇",
    description: "Public transit lines, rail systems, and stations",
    mapStyle: "transit",
    pinColor: "#8b5cf6",
    transitOverlay: true,
    filter: "none",
  },
  {
    id: "tpl_nature",
    name: "Nature and Routes",
    badge: "Nature",
    icon: "⛰️",
    description: "Topographic relief, green spaces, and coastlines",
    mapStyle: "doga",
    pinColor: "#059669",
    transitOverlay: false,
    filter: "warm",
  },
  {
    id: "tpl_satellite",
    name: "Gerçek Uydu",
    badge: "Hava",
    icon: "🛰️",
    description: "Yüksek çözünürlüklü gerçek yeryüzü uydu çekimi",
    mapStyle: "uydu",
    pinColor: "#f97316",
    transitOverlay: false,
    filter: "none",
  },
];

interface LocationState {
  lat: number;
  lng: number;
  address: string;
  district?: string;
  city?: string;
}

export interface SavedAddress {
  day?: number;
  suggestedDuration?: string;
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  group?: string; // Gezi Rotası veya Grup adı
  category?: PlaceCategory; // Kategori
  visited?: boolean; // Gidildi mi?
  order?: number;
  note?: string; // Detaylı not & ipucu
  date?: string; // Planlanan veya ziyaret tarihi
  photo?: string; // Durak / Mekan Fotoğrafı (URL veya Base64)
}

export default function Panel() {
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");
  const [mapAttempt, setMapAttempt] = useState(0);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const routeMarkersGroupRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Professional Travel Day Planner State ──
  const planner = useTravelPlanner();
  const [isPlannerOpen, setIsPlannerOpen] = useState(true);
  const [isPlannerCollapsed, setIsPlannerCollapsed] = useState(false);
  const [panelToast, setPanelToast] = useState<string | null>(null);
  const showPanelToast = (msg: string) => {
    setPanelToast(msg);
    setTimeout(() => setPanelToast(null), 3200);
  };
  const googleMapRef = useRef<GoogleMapHandle>(null);
  const pointRequest = useRef(0);
  const [quickAddPoint, setQuickAddPoint] = useState<GooglePoint | null>(null);
  const lastPlannerFit = useRef("");
  const lastFocusedPin = useRef("");
  const plannerMarkersGroupRef = useRef<any>(null);
  const plannerRouteLayerRef = useRef<any>(null);
  const [isAddingPinMode, setIsAddingPinMode] = useState(false);
  const isAddingPinModeRef = useRef(isAddingPinMode);
  useEffect(() => {
    isAddingPinModeRef.current = isAddingPinMode;
  }, [isAddingPinMode]);
  const [wallet, setWallet] = useState(() => billingService.getWallet());
  useEffect(() => {
    const handleWalletUpdated = (e: any) => {
      if (e.detail) setWallet(e.detail);
    };
    window.addEventListener("mapsbridge:wallet_updated", handleWalletUpdated);
    return () => window.removeEventListener("mapsbridge:wallet_updated", handleWalletUpdated);
  }, []);

  const [showTripManifestoModal, setShowTripManifestoModal] = useState(false);
  useEffect(() => {
    const handleOpenManifesto = () => setShowTripManifestoModal(true);
    window.addEventListener("mapsbridge:open-trip-manifesto", handleOpenManifesto);
    return () => window.removeEventListener("mapsbridge:open-trip-manifesto", handleOpenManifesto);
  }, []);

  const [showDealTrackerModal, setShowDealTrackerModal] = useState(false);
  useEffect(() => {
    const handleOpenTracker = () => setShowDealTrackerModal(true);
    window.addEventListener("mapsbridge:open-deal-tracker", handleOpenTracker);
    return () => window.removeEventListener("mapsbridge:open-deal-tracker", handleOpenTracker);
  }, []);

  const [location, setLocation] = useState<LocationState>({
    lat: 41.0082,
    lng: 28.9784,
    address: "Konum yükleniyor...",
  });

  // Hours: 0 = Sınırsız, 1, 6, 24, 168
  const [hours, setHours] = useState(24);
  const [showDurationModal, setShowDurationModal] = useState(false);

  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [isCreated, setIsCreated] = useState(false);
  const [recentShares, setRecentShares] = useState<
    Array<{ code: string; expiresAt: number; url: string }>
  >([]);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState("");
  const sharePending = useRef(false);
  const [shareCode, setShareCode] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // User & Theme State
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("Gezgin");
  const [userHandle, setUserHandle] = useState("gezgin");
  const [userAvatar, setUserAvatar] = useState("");
  const [copiedTravelerCode, setCopiedTravelerCode] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [isDark, setIsDark] = useState(false);
  const { isEnglish } = useLocale();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Saved Addresses & Gezi Rotaları State
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);

  const addressesInitialized = useRef(false);

  const persistAddresses = (addresses: SavedAddress[]) => {
    setSavedAddresses(addresses);
    try {
      userStorage.setItem("mapsbridge.savedAddresses", JSON.stringify(addresses));
    } catch {}
    const session = getStoredSession();
    if (session?.token) {
      fetch(`${API_ENDPOINT}/user/saved-addresses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ addresses }),
      }).catch(() => {});
    }
  };
  const [customTabs, setCustomTabs] = useState<string[]>([]);
  const [savedSearchQuery, setSavedSearchQuery] = useState("");
  // Keşif Modu her zaman açık — gezi grupları ve rotalar daima görünür
  const [isDiscoveryMode] = useState<boolean>(true);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [showRouteCard, setShowRouteCard] = useState(false);
  const [showTripManager, setShowTripManager] = useState(false);
  // Gezi Yönetim Masası durumları
  const [tripNameInput, setTripNameInput] = useState("");
  const [tripStartDate, setTripStartDate] = useState("");
  const [tripEndDate, setTripEndDate] = useState("");
  const [tripTheme, setTripTheme] = useState("Kültür & Şehir");
  const [tripIsPublic, setTripIsPublic] = useState(false);
  const [expandedStops, setExpandedStops] = useState(true);
  const [workspaceMode, setWorkspaceMode] = useState<"itinerary" | "travel" | "ai">("itinerary");
  const [highlightedStopId, setHighlightedStopId] = useState<string | null>(null);
  const [aiWorkspacePrompt, setAiWorkspacePrompt] = useState<string>("");
  const [aiActionToast, setAiActionToast] = useState<string | null>(null);

  // Sekme (Tab) Ekleme State
  const [showAddTabModal, setShowAddTabModal] = useState(false);
  const [newTabNameInput, setNewTabNameInput] = useState("");

  // Alt Konum Listesi Arama & Yatay Kaydırma State
  const [bottomSearchQuery, setBottomSearchQuery] = useState("");
  const [isBottomSearchExpanded, setIsBottomSearchExpanded] = useState(false);

  // Harita Modları ve Özelleştirme State'leri
  const tileLayerRef = useRef<any>(null);
  const transitOverlayRef = useRef<any>(null);
  const [currentMapStyle, setCurrentMapStyle] = useState<MapStyleId>("standart");
  const [pinColor, setPinColor] = useState<string>("#2563eb");
  const [showTransitOverlay, setShowTransitOverlay] = useState<boolean>(false);
  const [mapVisualFilter, setMapVisualFilter] = useState<string>("none");
  const [showMapCustomizeModal, setShowMapCustomizeModal] = useState<boolean>(false);
  const [showShareCard, setShowShareCard] = useState<boolean>(false);
  const [showAdvancedMapSettings, setShowAdvancedMapSettings] = useState<boolean>(false);
  const [isMapHubOpen, setIsMapHubOpen] = useState<boolean>(false);
  const mapHubRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (mapHubRef.current && !mapHubRef.current.contains(e.target as Node)) {
        setIsMapHubOpen(false);
      }
    }
    if (isMapHubOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMapHubOpen]);

  // Kodla Konum Bulma (Pop-up) State'leri
  const [showCodeLookupModal, setShowCodeLookupModal] = useState<boolean>(false);
  const [lookupCodeInput, setLookupCodeInput] = useState<string>("");
  const [isLookupLoading, setIsLookupLoading] = useState<boolean>(false);
  const [lookupError, setLookupError] = useState<string>("");

  function applyMapTemplate(tpl: MapTemplate) {
    setCurrentMapStyle(tpl.mapStyle);
    setPinColor(tpl.pinColor);
    setShowTransitOverlay(tpl.transitOverlay);
    setMapVisualFilter(tpl.filter);
    if (typeof window !== "undefined") {
      localStorage.setItem("mapsbridge.mapStyle", tpl.mapStyle);
      localStorage.setItem("mapsbridge.pinColor", tpl.pinColor);
      localStorage.setItem("mapsbridge.transitOverlay", String(tpl.transitOverlay));
      localStorage.setItem("mapsbridge.mapVisualFilter", tpl.filter);
    }
  }

  function focusMapPin(lat: number, lng: number) {
    if (googleMapsEnabled) {
      googleMapRef.current?.focus(lat, lng);
      return;
    }
    const map = mapInstanceRef.current;
    if (!map) return;
    const center = window.matchMedia("(max-width: 767px)").matches
      ? map.unproject(map.project([lat, lng], 16).add([0, map.getSize().y * 0.22]), 16)
      : [lat, lng];
    map.flyTo(center, 16, { duration: 0.6 });
  }
  function openSavedPin(id: string) {
    pointRequest.current++;
    setQuickAddPoint(null);
    planner.setSelectedPinId(id);
    setIsPlannerOpen(true);
    setIsPlannerCollapsed(false);

    const pin = planner.allPins.find((p) => p.id === id) || savedAddresses.find((p) => p.id === id);
    if (pin) {
      focusMapPin(pin.lat, pin.lng);
      interactionTracker.logPinClick({
        id: pin.id,
        label: pin.label,
        category: pin.category,
        address: pin.address,
        lat: pin.lat,
        lng: pin.lng,
        tripId: (pin as any).tripId,
        dayIndex: (pin as any).dayIndex,
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mapsbridge:show-pin-detail", { detail: { id } }));
      }
    }
  }
  function closePinSheet() {
    pointRequest.current++;
    setQuickAddPoint(null);
    planner.setSelectedPinId(null);
  }
  // Save Dialog Form State
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newLabelInput, setNewLabelInput] = useState("");
  const [newNoteInput, setNewNoteInput] = useState("");
  const [newPhotoInput, setNewPhotoInput] = useState("");
  const [newDateInput, setNewDateInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<PlaceCategory>("genel");
  const [selectedGroupInput, setSelectedGroupInput] = useState<string>("Genel");
  const [customNewGroup, setCustomNewGroup] = useState("");
  const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  // Authentication & Gate Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalConfig, setAuthModalConfig] = useState<{
    title: string;
    subtitle: string;
    featureName: string;
  }>({
    title: "MapsBridge Üyeliği Gereklidir",
    subtitle: "Bu işlemi gerçekleştirmek için lütfen ücretsiz üye olun veya giriş yapın.",
    featureName: "Gezgin Özelliği",
  });

  const requireAuth = (featureName: string, actionDesc: string, onAuthenticated: () => void) => {
    const session = getStoredSession();
    if (!session?.email || !session?.token) {
      setAuthModalConfig({
        title: `${featureName} İçin Üye Olun`,
        subtitle: `${actionDesc} için lütfen ücretsiz bir MapsBridge hesabı oluşturun veya giriş yapın.`,
        featureName,
      });
      setShowAuthModal(true);
      return false;
    }
    onAuthenticated();
    return true;
  };

  // Load user session, saved addresses and custom tabs on mount
  useEffect(() => {
    const session = getStoredSession();
    const fallbackEmail =
      typeof window !== "undefined"
        ? localStorage.getItem("mapsbridge.userEmail") ||
          localStorage.getItem("mapsbridge.userEmail")
        : null;
    const activeEmail = session?.email || fallbackEmail;
    if (activeEmail) {
      setUserEmail(activeEmail);
    }
    try {
      const stored = userStorage.getItem("mapsbridge.userProfileDetails");
      if (stored) {
        const d = JSON.parse(stored);
        if (d.fullName) setUserName(d.fullName);
        else if (d.firstName) setUserName(`${d.firstName} ${d.lastName || ""}`.trim());
        if (d.username) setUserHandle(d.username);
        if (d.avatarUrl) setUserAvatar(d.avatarUrl);
      } else if (activeEmail) {
        const fallbackHandle = activeEmail.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
        if (fallbackHandle) {
          setUserHandle(fallbackHandle);
          setUserName(fallbackHandle.charAt(0).toUpperCase() + fallbackHandle.slice(1));
        }
      }
    } catch {}
    const savedAvatar = userStorage.getItem("mapsbridge.userAvatar");
    if (savedAvatar) setUserAvatar(savedAvatar);

    try {
      const rawMsg = localStorage.getItem("mapsbridge.directMessages");
      if (rawMsg) {
        const parsed = JSON.parse(rawMsg);
        if (Array.isArray(parsed)) {
          setUnreadMessagesCount(
            parsed.filter((m: any) => m.status === "unread" || !m.read).length,
          );
        }
      }
    } catch {}

    try {
      const recent = JSON.parse(userStorage.getItem("mapsbridge.shares") || "[]");
      if (Array.isArray(recent))
        setRecentShares(recent.filter((item) => item.expiresAt * 1000 > Date.now()));
    } catch {}
    refreshSession();

    // Theme is always light
    setIsDark(false);
    document.documentElement.dataset.theme = "light";

    // Language is derived from useLocale() hook

    // Check URL parameters (modal and route from profile travel guide)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("modal") === "saved") {
        setIsPlannerOpen(true);
      }
      const routeParam = params.get("route");
      if (routeParam) {
        const decodedRoute = routeParam;
        setSelectedGroup(decodedRoute);
        setShowRouteCard(true);
      }

      // Load saved addresses — try API first, fallback to localStorage
      (async () => {
        try {
          const session = getStoredSession();
          if (session?.token) {
            const res = await fetch(`${API_ENDPOINT}/user/saved-addresses`, {
              headers: { Authorization: `Bearer ${session.token}` },
            });
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data.addresses) && data.addresses.length > 0) {
                addressesInitialized.current = true;
                setSavedAddresses(data.addresses);
                userStorage.setItem("mapsbridge.savedAddresses", JSON.stringify(data.addresses));
              } else {
                const stored = userStorage.getItem("mapsbridge.savedAddresses");
                const parsed = stored ? JSON.parse(stored) : [];
                if (Array.isArray(parsed) && parsed.length > 0) {
                  fetch(`${API_ENDPOINT}/user/saved-addresses`, {
                    method: "PUT",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${session.token}`,
                    },
                    body: JSON.stringify({ addresses: parsed }),
                  }).catch(() => {});
                  setSavedAddresses(parsed);
                }
                addressesInitialized.current = true;
              }
            } else {
              throw new Error("api-fail");
            }
          } else {
            throw new Error("no-session");
          }
        } catch {
          const stored = userStorage.getItem("mapsbridge.savedAddresses");
          try {
            const parsed = stored ? JSON.parse(stored) : [];
            setSavedAddresses(Array.isArray(parsed) ? parsed : []);
          } catch {
            setSavedAddresses([]);
          }
          addressesInitialized.current = true;
        }
      })();

      // Load custom tabs
      const storedTabs = userStorage.getItem("mapsbridge.customTabs");
      if (storedTabs) {
        try {
          const parsedTabs = JSON.parse(storedTabs);
          if (Array.isArray(parsedTabs)) {
            setCustomTabs(parsedTabs);
          }
        } catch {}
      }

      // Load map style & customizations
      const savedMapStyle = localStorage.getItem("mapsbridge.mapStyle") as MapStyleId;
      if (
        savedMapStyle &&
        savedMapStyle !== "sade" &&
        MAP_STYLES.some((s) => s.id === savedMapStyle)
      ) {
        setCurrentMapStyle(savedMapStyle);
      } else {
        setCurrentMapStyle("standart");
      }
      const savedPinColor = localStorage.getItem("mapsbridge.pinColor");
      if (savedPinColor) {
        setPinColor(savedPinColor);
      }
      const savedOverlay = localStorage.getItem("mapsbridge.transitOverlay");
      if (savedOverlay === "true") {
        setShowTransitOverlay(true);
      }
      const savedFilter = localStorage.getItem("mapsbridge.mapFilter");
      if (savedFilter) {
        setMapVisualFilter(savedFilter);
      }
    }
  }, []);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    if (isProfileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isProfileOpen]);

  // When Save Dialog opens, auto-focus input
  useEffect(() => {
    if (showSaveDialog) {
      setTimeout(() => {
        saveInputRef.current?.focus();
        saveInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    }
  }, [showSaveDialog]);

  function toggleLanguage() {
    const alternate = getAlternatePath(window.location.pathname);
    document.cookie = `locale=${isEnglish ? "tr" : "en"};path=/;max-age=31536000;SameSite=Strict;Secure`;
    window.location.assign(alternate);
  }

  function handleLogout() {
    signOut();
    window.location.assign("/login/");
  }

  // Sync savedAddresses to API whenever state changes (after initial load)
  useEffect(() => {
    if (!addressesInitialized.current) return;
    const session = getStoredSession();
    if (!session?.token) return;
    const timer = setTimeout(() => {
      fetch(`${API_ENDPOINT}/user/saved-addresses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ addresses: savedAddresses }),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [savedAddresses]);

  // Helper to escape HTML for leaflet popup
  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Haversine distance in kilometers
  function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function formatDistance(km: number): string {
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(1)} km`;
  }

  // Create custom Pin Icon for Leaflet (Minimalist & Modern)
  function createCustomRoutePin(
    category: PlaceCategory = "genel",
    visited: boolean = false,
    label: string = "",
  ) {
    const L = (window as any).L;
    if (!L) return null;
    const meta = CATEGORIES[category] || CATEGORIES.genel;
    const bg = visited ? "#10b981" : meta.color;
    const visitedClass = visited ? "is-visited" : "";

    return L.divIcon({
      className: `custom-route-pin ${visitedClass}`,
      html: `
        <div class="route-pin-wrapper">
          <div class="route-pin-pulse" style="background:${bg}"></div>
          <div class="route-pin-body" style="background:${bg}">
            <span class="route-pin-symbol" style="color:#ffffff; font-size:11px; font-weight:800;">
              ${visited ? "✓" : "●"}
            </span>
          </div>
          <div class="route-pin-label">${escapeHtml(label)}</div>
        </div>
      `,
      iconSize: [36, 44],
      iconAnchor: [18, 44],
      popupAnchor: [0, -44],
    });
  }

  const prevGroupRef = useRef(selectedGroup);

  // Render pins on map
  function renderGroupOnMap(
    groupName: string,
    addresses: SavedAddress[],
    currentLoc?: LocationState,
    shouldFitBounds: boolean = false,
  ) {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current) return;

    const loc = currentLoc || location;

    if (routeMarkersGroupRef.current) {
      mapInstanceRef.current.removeLayer(routeMarkersGroupRef.current);
      routeMarkersGroupRef.current = null;
    }
    if (routePolylineRef.current) {
      mapInstanceRef.current.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    // Gezi rotaları TravelPlanner tarafından OSRM ile çiziliyorsa duplicate katmanı engelle
    if (isPlannerOpen || groupName === "none") return;

    const groupItems =
      groupName === "all" ? addresses : addresses.filter((a) => (a.group || "Genel") === groupName);

    if (groupItems.length === 0) return;

    const featureGroup = L.featureGroup();
    const isDarkTheme = document.documentElement.dataset.theme === "dark";
    const lineColor = isDarkTheme ? "#38bdf8" : "#2563eb";

    // 1. Gruptaki tüm durak pinlerini oluştur ve haritaya ekle
    groupItems.forEach((item) => {
      const distKm = calculateDistanceKm(loc.lat, loc.lng, item.lat, item.lng);
      const distFormatted = formatDistance(distKm);

      const pinLabel = item.visited ? `${item.label} ✓` : `${item.label} · ${distFormatted}`;

      const icon = createCustomRoutePin(item.category || "genel", !!item.visited, pinLabel);
      if (!icon) return;

      const marker = L.marker([item.lat, item.lng], { icon });
      marker.on("click", () => {
        setHighlightedStopId(item.id);
        openSavedPin(item.id);
        setIsPlannerOpen(true);
        if (mapInstanceRef.current) {
          focusMapPin(item.lat, item.lng);
        }
      });

      marker.addTo(featureGroup);
    });

    // 2. Çizgiler:
    // Eğer belirli bir seyahat rotası seçilmişse (groupName !== 'all'), duraklar sırayla birbirine bağlayan gezi rotası çizilir.
    // Duraklar "Gidildi" işaretlendikçe aktif rota son ziyaret edilen duraktan başlayıp kalan duraklara göre dinamik yeniden oluşturulur.
    if (groupName !== "all" && groupItems.length > 1) {
      const unvisitedGroup = groupItems.filter((i) => !i.visited);
      const visitedGroup = groupItems.filter((i) => i.visited);
      let activeGroupPoints = groupItems;
      if (unvisitedGroup.length > 0 && visitedGroup.length > 0) {
        const lastVisited = visitedGroup[visitedGroup.length - 1];
        activeGroupPoints = [lastVisited, ...unvisitedGroup];
      }
      if (activeGroupPoints.length > 1) {
        const routePoints: [number, number][] = activeGroupPoints.map((item) => [
          item.lat,
          item.lng,
        ]);
        const itineraryLine = L.polyline(routePoints, {
          color: lineColor,
          weight: 3.5,
          opacity: 0.88,
          dashArray: "6, 8",
          lineCap: "round",
          lineJoin: "round",
        });
        itineraryLine.addTo(featureGroup);
      }
    }

    featureGroup.addTo(mapInstanceRef.current);
    routeMarkersGroupRef.current = featureGroup;

    if (shouldFitBounds && groupItems.length > 0) {
      try {
        mapInstanceRef.current.fitBounds(featureGroup.getBounds(), {
          padding: [75, 75],
          maxZoom: 15,
          animate: true,
          duration: 0.8,
        });
      } catch {}
    }
  }

  // Re-render group pins
  useEffect(() => {
    if (mapInstanceRef.current && (window as any).L) {
      const groupChanged = prevGroupRef.current !== selectedGroup;
      prevGroupRef.current = selectedGroup;
      renderGroupOnMap(selectedGroup, savedAddresses, location, groupChanged);
    }
  }, [selectedGroup, savedAddresses, location.lat, location.lng]);

  // Toggle "Gidildi"
  function handleToggleVisited(id: string) {
    const updated = savedAddresses.map((a) => {
      if (a.id === id) {
        return { ...a, visited: !a.visited };
      }
      return a;
    });
    if (typeof window !== "undefined") {
      try {
        userStorage.setItem("mapsbridge.savedAddresses", JSON.stringify(updated));
      } catch {
        return;
      }
    }
    setSavedAddresses(updated);
  }

  // Reverse Geocoding via Multi-tier Service (Nominatim + Photon + BigDataCloud)
  async function fetchAddress(lat: number, lng: number, select = true) {
    const request = ++pointRequest.current;
    if (select) {
      planner.setSelectedPinId(null);
      setQuickAddPoint({ lat, lng, address: "Konum sorgulanıyor..." });
    }

    try {
      const geocoded = await reverseGeocodeLocation(lat, lng);
      if (request !== pointRequest.current) return;
      setLocation({
        lat,
        lng,
        address: geocoded.address,
        district: geocoded.district,
        city: geocoded.city,
      });
      if (select) setQuickAddPoint({ lat, lng, address: geocoded.address });
      setIsPlannerOpen(true);
    } catch {
      if (request !== pointRequest.current) return;
      const fallbackAddr = `Enlem: ${lat.toFixed(5)}, Boylam: ${lng.toFixed(5)}`;
      setLocation({
        lat,
        lng,
        address: fallbackAddr,
      });
      if (select) setQuickAddPoint({ lat, lng, address: fallbackAddr });
      setIsPlannerOpen(true);
    }
  }

  // Address & POI Search via Multi-tier Service
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim() || !mapInstanceRef.current) return;
    setIsSearching(true);
    try {
      const places = await searchPlaces(searchQuery);
      if (places && places.length > 0) {
        const top = places[0];
        mapInstanceRef.current.flyTo([top.lat, top.lng], 16, { animate: true, duration: 1.2 });
        if (markerRef.current) {
          markerRef.current.setLatLng([top.lat, top.lng]);
        }
        setLocation({
          lat: top.lat,
          lng: top.lng,
          address: top.address,
          district: top.district,
          city: top.city,
        });
        pointRequest.current++;
        planner.setSelectedPinId(null);
        setQuickAddPoint({ lat: top.lat, lng: top.lng, address: top.address });
        setIsPlannerOpen(true);
        showPanelToast(`✓ "${top.label || top.address}" haritada bulundu!`);
      } else {
        showPanelToast(
          "⚠️ Aradığınız adres veya mekan bulunamadı. Lütfen ilçe, şehir veya farklı bir terim deneyin.",
        );
      }
    } catch (err) {
      console.error(err);
      showPanelToast(
        "⚠️ Arama servisine ulaşılamadı. Lütfen bağlantınızı kontrol edip tekrar deneyin.",
      );
    } finally {
      setIsSearching(false);
    }
  }

  // Current GPS Location
  function handleCurrentLocation() {
    if (!navigator.geolocation || !mapInstanceRef.current) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        mapInstanceRef.current.flyTo([latitude, longitude], 16, { animate: true, duration: 1.2 });
        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
        }
        fetchAddress(latitude, longitude);
      },
      () => {
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  // Initialize Leaflet only while Google configuration is absent.
  useEffect(() => {
    if (googleMapsEnabled) return;
    let isMounted = true;
    let resizeObserver: ResizeObserver | undefined;
    setMapStatus("loading");

    function initLeafletMap() {
      const L = (window as any).L;
      if (!L || !mapContainerRef.current || mapInstanceRef.current) return;

      const initialLat = 40.9856;
      const initialLng = 29.0289;

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
      }).setView([initialLat, initialLng], 14);
      mapInstanceRef.current = map;

      // 1. Harita Taban Modu Katmanı
      const savedStyleId =
        (typeof window !== "undefined" && localStorage.getItem("mapsbridge.mapStyle")) ||
        currentMapStyle ||
        "standart";
      const styleConfig = MAP_STYLES.find((s) => s.id === savedStyleId) || MAP_STYLES[0];
      const tileOpts: any = {
        attribution: styleConfig.attribution,
        maxZoom: styleConfig.maxZoom,
      };
      if (styleConfig.subdomains) {
        tileOpts.subdomains = styleConfig.subdomains;
      }
      const baseTile = L.tileLayer(styleConfig.url, tileOpts).addTo(map);
      tileLayerRef.current = baseTile;
      let hasVisibleTiles = false;
      baseTile.on("tileload", () => {
        hasVisibleTiles = true;
        if (isMounted) setMapStatus("ready");
      });
      baseTile.on("tileerror", () => {
        if (isMounted && !hasVisibleTiles) setMapStatus("error");
      });

      // 2. Toplu Taşıma / Raylı Sistem Katmanı
      const savedOverlay =
        (typeof window !== "undefined" &&
          localStorage.getItem("mapsbridge.transitOverlay") === "true") ||
        showTransitOverlay;
      if (savedOverlay) {
        transitOverlayRef.current = L.tileLayer(
          "https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            opacity: 0.85,
            attribution: '&copy; <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>',
          },
        ).addTo(map);
      }

      // 3. Özelleştirilmiş Pin
      const activeColor =
        (typeof window !== "undefined" && localStorage.getItem("mapsbridge.pinColor")) ||
        pinColor ||
        "#2563eb";
      const customPin = L.divIcon({
        className: "custom-map-pin",
        html: `<div class="pin-pulse" style="background:${activeColor}55;"></div><div class="pin-marker"><svg width="28" height="36" viewBox="0 0 28 36" fill="none"><path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22c0-7.732-6.268-14-14-14z" fill="${activeColor}"/><circle cx="14" cy="14" r="5" fill="#ffffff"/></svg></div>`,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
      });

      const marker = L.marker([initialLat, initialLng], {
        icon: customPin,
        draggable: true,
      }).addTo(map);

      markerRef.current = marker;
      mapInstanceRef.current = map;
      resizeObserver = new ResizeObserver(() => map.invalidateSize({ pan: false }));
      resizeObserver.observe(mapContainerRef.current!);
      map.whenReady(() => {
        if (isMounted) {
          map.invalidateSize();
          setMapStatus("ready");
        }
      });

      map.on("click", async (e: any) => {
        const session = getStoredSession();
        if (!session?.email || !session?.token) {
          setAuthModalConfig({
            title: "Haritada İşlem Yapmak İçin Üye Olun",
            subtitle:
              "Harita üzerinde yeni keşif durakları ve gezi rotaları işaretlemek için lütfen ücretsiz üye olun veya giriş yapın.",
            featureName: "Harita İşlemleri",
          });
          setShowAuthModal(true);
          return;
        }
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);

        if (isAddingPinModeRef.current && !window.matchMedia("(max-width: 767px)").matches) {
          const targetTripId = planner.activeTrip?.id || planner.trips[0]?.id || "trip-istanbul";
          const targetDay = planner.activeDayIndex || 1;
          try {
            const geocoded = await reverseGeocodeLocation(lat, lng);
            planner.addPinDirectlyToTrip(
              targetTripId,
              {
                label: geocoded.label || geocoded.address.split(",")[0] || "Yeni Durak",
                address: geocoded.address,
                lat,
                lng,
                category: geocoded.category || "genel",
                dayIndex: targetDay,
                group: "Genel",
                visited: false,
                durationMinutes: 60,
              },
              targetDay,
            );
            setIsAddingPinMode(false);
          } catch {
            planner.addPinDirectlyToTrip(
              targetTripId,
              {
                label: `Durak (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
                address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
                lat,
                lng,
                category: "genel",
                dayIndex: targetDay,
                group: "Genel",
                visited: false,
                durationMinutes: 60,
              },
              targetDay,
            );
            setIsAddingPinMode(false);
          }
          return;
        }

        setIsAddingPinMode(false);
        fetchAddress(lat, lng);
      });

      marker.on("click", () => {
        const { lat, lng } = marker.getLatLng();
        void fetchAddress(lat, lng);
      });

      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng();
        fetchAddress(lat, lng);
      });

      fetchAddress(initialLat, initialLng, false);

      setTimeout(() => {
        if (isMounted) {
          const urlParams =
            typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
          const tripIdParam = urlParams?.get("tripId");
          if (tripIdParam) {
            planner.switchTrip(tripIdParam);
            setIsPlannerOpen(true);
            setIsPlannerCollapsed(false);
          }

          const routeParam = urlParams?.get("route");
          if (routeParam) {
            const targetGrp = decodeURIComponent(routeParam);
            setSelectedGroup(targetGrp);
            setShowRouteCard(true);

            // Match trip in planner
            const matchedTrip = planner.trips.find(
              (t) => t.id === targetGrp || t.title.toLowerCase() === targetGrp.toLowerCase(),
            );
            if (matchedTrip) {
              planner.switchTrip(matchedTrip.id);
            }

            // localStorage'dan en güncel durakları oku
            let activeStops = savedAddresses;
            const freshRaw = userStorage.getItem("mapsbridge.savedAddresses");
            if (freshRaw) {
              try {
                const parsed = JSON.parse(freshRaw);
                if (Array.isArray(parsed)) {
                  activeStops = parsed;
                  setSavedAddresses(parsed);
                }
              } catch {}
            }

            renderGroupOnMap(
              targetGrp,
              activeStops,
              {
                lat: initialLat,
                lng: initialLng,
                address: "",
              },
              true,
            );
          }
        }
      }, 350);
    }

    const initialize = () => {
      if (!isMounted) return;
      try {
        initLeafletMap();
      } catch (error) {
        console.error("Map initialization failed", error);
        mapInstanceRef.current?.remove();
        mapInstanceRef.current = null;
        setMapStatus("error");
      }
    };
    const failed = () => {
      if (isMounted) setMapStatus("error");
    };
    let script = document.getElementById("leaflet-js") as HTMLScriptElement | null;
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    if ((window as any).L) initialize();
    else {
      if (mapAttempt > 0 && script) {
        script.remove();
        script = null;
      }
      const isNew = !script;
      script ||= document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.addEventListener("load", initialize);
      script.addEventListener("error", failed);
      if (isNew) document.body.appendChild(script);
    }
    const timeout = window.setTimeout(() => {
      if (!mapInstanceRef.current) failed();
    }, 15000);
    return () => {
      isMounted = false;
      clearTimeout(timeout);
      script?.removeEventListener("load", initialize);
      script?.removeEventListener("error", failed);
      resizeObserver?.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        tileLayerRef.current = null;
        transitOverlayRef.current = null;
      }
    };
  }, [mapAttempt]);

  // Reaktif Harita Taban Modu Değişimi
  useEffect(() => {
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    const style = MAP_STYLES.find((s) => s.id === currentMapStyle) || MAP_STYLES[0];

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const opts: any = {
      attribution: style.attribution,
      maxZoom: style.maxZoom,
    };
    if (style.subdomains) {
      opts.subdomains = style.subdomains;
    }

    tileLayerRef.current = L.tileLayer(style.url, opts).addTo(map);

    // Yeni katmanı en alta al (overlay'lerin altında kalması için)
    if (typeof tileLayerRef.current.bringToBack === "function") {
      tileLayerRef.current.bringToBack();
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("mapsbridge.mapStyle", currentMapStyle);
    }
  }, [currentMapStyle]);

  // Reaktif Toplu Taşıma / Raylı Sistem Katmanı
  useEffect(() => {
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    if (showTransitOverlay) {
      if (!transitOverlayRef.current) {
        transitOverlayRef.current = L.tileLayer(
          "https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            opacity: 0.85,
            attribution: '&copy; <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>',
          },
        ).addTo(map);
      }
    } else {
      if (transitOverlayRef.current) {
        map.removeLayer(transitOverlayRef.current);
        transitOverlayRef.current = null;
      }
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("mapsbridge.transitOverlay", String(showTransitOverlay));
    }
  }, [showTransitOverlay]);

  // Reaktif Pin Rengi Değişimi
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !markerRef.current) return;

    const customPin = L.divIcon({
      className: "custom-map-pin",
      html: `<div class="pin-pulse" style="background:${pinColor}55;"></div><div class="pin-marker"><svg width="28" height="36" viewBox="0 0 28 36" fill="none"><path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22c0-7.732-6.268-14-14-14z" fill="${pinColor}"/><circle cx="14" cy="14" r="5" fill="#ffffff"/></svg></div>`,
      iconSize: [28, 36],
      iconAnchor: [14, 36],
    });

    markerRef.current.setIcon(customPin);

    if (typeof window !== "undefined") {
      localStorage.setItem("mapsbridge.pinColor", pinColor);
    }
  }, [pinColor]);

  // Reaktif Harita Görsel Filtresi
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const filterObj = MAP_FILTERS.find((f) => f.id === mapVisualFilter);
    const filterVal = filterObj ? filterObj.css : "none";

    const tilePanes = mapContainerRef.current.querySelectorAll(".leaflet-tile-pane");
    tilePanes.forEach((pane: any) => {
      pane.style.filter = filterVal;
    });

    if (typeof window !== "undefined") {
      localStorage.setItem("mapsbridge.mapFilter", mapVisualFilter);
    }
  }, [mapVisualFilter, currentMapStyle]);

  // ── Travel Day Planner: Render Numbered Pins & Real Road Route on Leaflet Map ──
  useEffect(() => {
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    if (plannerMarkersGroupRef.current) {
      map.removeLayer(plannerMarkersGroupRef.current);
      plannerMarkersGroupRef.current = null;
    }
    if (plannerRouteLayerRef.current) {
      map.removeLayer(plannerRouteLayerRef.current);
      plannerRouteLayerRef.current = null;
    }

    const activePins = planner.pinsWithTime;
    if (activePins.length === 0 && planner.generalPins.length === 0) return;

    // Filter visited pins: if showVisitedOnMap is false, do not clutter the active road layer
    const pinsToRender = activePins.filter((p) => {
      if (p.visited && !planner.showVisitedOnMap) return false;
      return true;
    });

    const dayColor = planner.currentDay?.color || "#2563eb";
    const featureGroup = L.featureGroup();

    // 1. Draw Real Road Route (OSRM Polyline) or Connecting Polyline
    const routeCoordinates =
      planner.activeRoadGeometry && planner.activeRoadGeometry.coordinates.length > 1
        ? planner.activeRoadGeometry.coordinates
        : pinsToRender.length > 1
          ? pinsToRender.map((p) => [p.lat, p.lng])
          : [];

    if (routeCoordinates.length > 1) {
      const roadGroup = L.featureGroup();
      const isRoad =
        planner.activeRoadGeometry && planner.activeRoadGeometry.coordinates.length > 1;

      // Outer glow / contrast
      const glowLine = L.polyline(routeCoordinates, {
        color: dayColor,
        weight: 9,
        opacity: 0.3,
        lineCap: "round",
        lineJoin: "round",
      });
      glowLine.addTo(roadGroup);

      // Inner crisp path
      const mainLine = L.polyline(routeCoordinates, {
        color: dayColor,
        weight: 4.5,
        opacity: 0.95,
        dashArray: isRoad ? undefined : "6, 8",
        lineCap: "round",
        lineJoin: "round",
      });
      mainLine.addTo(roadGroup);

      roadGroup.addTo(map);
      plannerRouteLayerRef.current = roadGroup;
    }

    // 2. Draw Numbered Stitch Pins
    pinsToRender.forEach((pin) => {
      const isSelected = planner.selectedPinId === pin.id;
      const catMeta = DEFAULT_CATEGORY_META[pin.category] || DEFAULT_CATEGORY_META.genel;

      const markerHtml = `
        <div class="stitch-leaflet-pin ${isSelected ? "is-selected" : ""} ${pin.visited ? "is-visited" : ""}">
          ${isSelected ? '<div class="stitch-pin-pulse-beacon"></div>' : ""}
          <div class="stitch-pin-head" style="background-color: ${isSelected ? "#10B981" : pin.visited ? "#286954" : "#013628"};">
            ${pin.visited ? `<span class="material-symbols-outlined" style="font-size: 15px; color: #34D399;">check</span>` : `<span>${pin.order}</span>`}
          </div>
          <div class="stitch-pin-pill">
            <span class="stitch-pin-pill-title">${pin.order}. ${escapeHtml(pin.label)}</span>
          </div>

          ${
            isSelected
              ? `
            <div class="stitch-pin-active-popup">
              <div class="popup-photo-wrap">
                <img src="${pin.photo || "https://lh3.googleusercontent.com/aida-public/AB6AXuCxbi1qXu9TAhdNilaAgPco1Z6TCH-Db2WPP9T6rf83eTb1bjB1J9lL1dUOqKX88FwPONdy8f-XROCuNQo0lYJ3sDAu2EUh6Rbuhg9Y01UwoaJgYvLrUsq7yOKEIiTX9KtHh-C8T-DGBEM_WeefmrXyUgfVX5Ci0DdThglRCJbbhUpbSb74_a1fiIZZGl1qvPYy6YyaxbGv0H141oCfmm8dwnBQbvi4HP5kwOgm7UQN-G76o7cnikVF4g"}" alt="${escapeHtml(pin.label)}" class="popup-photo-img"/>
                <span class="popup-active-badge">Seçili Durak</span>
              </div>
              <div class="popup-title-row">
                <h4 class="popup-title">${escapeHtml(pin.label)}</h4>
                <div class="popup-rating">
                  <span class="material-symbols-outlined" style="font-size: 14px; color: #f59e0b; font-variation-settings: 'FILL' 1;">star</span>
                  <span>4.8</span>
                </div>
              </div>
              <p class="popup-desc">${pin.durationMinutes || 45} dk planlı mola • ${escapeHtml(catMeta.label)}</p>
              <div class="popup-actions-row">
                <button class="popup-btn-nav" type="button" onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}', '_blank')">Yol Tarifi</button>
                <button class="popup-btn-detail" type="button" onclick="window.dispatchEvent(new CustomEvent('mapsbridge:open_inspect_drawer', { detail: { pinId: '${pin.id}' } }))">Detay</button>
              </div>
            </div>
          `
              : ""
          }
        </div>
      `;

      const icon = L.divIcon({
        className: "stitch-leaflet-marker-wrap",
        html: markerHtml,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([pin.lat, pin.lng], { icon });

      marker.on("click", () => {
        openSavedPin(pin.id);
        setIsPlannerOpen(true);
        setIsPlannerCollapsed(false);
        focusMapPin(pin.lat, pin.lng);
      });

      marker.addTo(featureGroup);
    });

    // 3. Genel Havuz Pinlerini Haritada Göster (Atanmamış Keşif Pinleri)
    planner.generalPins.forEach((pin) => {
      const isSelected = planner.selectedPinId === pin.id;
      const catMeta = DEFAULT_CATEGORY_META[pin.category] || DEFAULT_CATEGORY_META.genel;
      const markerHtml = `
        <div class="stitch-leaflet-pool-pin ${isSelected ? "is-selected" : ""}">
          <div class="stitch-pool-pin-head" style="--pin-color: ${catMeta.color || "#475569"}">
            <span>${catMeta.emoji || "📍"}</span>
          </div>
          <div class="stitch-pin-pill">
            <span class="stitch-pin-pill-title">${escapeHtml(pin.label)}</span>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: "stitch-leaflet-marker-wrap",
        html: markerHtml,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([pin.lat, pin.lng], { icon });

      marker.on("click", () => {
        openSavedPin(pin.id);
        setIsPlannerOpen(true);
        setIsPlannerCollapsed(false);
        focusMapPin(pin.lat, pin.lng);
      });

      marker.addTo(featureGroup);
    });

    featureGroup.addTo(map);
    plannerMarkersGroupRef.current = featureGroup;

    // Auto-fit bounds on day switch if pins exist
    const fitKey = `${planner.activeTrip?.id}:${planner.activeDayIndex}`;
    if (pinsToRender.length > 0 && lastPlannerFit.current !== fitKey) {
      lastPlannerFit.current = fitKey;
      try {
        map.fitBounds(featureGroup.getBounds().pad(0.18), { maxZoom: 16 });
      } catch {}
    }
    if (planner.selectedPin && lastFocusedPin.current !== planner.selectedPin.id) {
      lastFocusedPin.current = planner.selectedPin.id;
      focusMapPin(planner.selectedPin.lat, planner.selectedPin.lng);
    }
  }, [
    planner.pinsWithTime,
    planner.generalPins,
    planner.activeRoadGeometry,
    planner.activeDayIndex,
    planner.selectedPinId,
    planner.showVisitedOnMap,
    planner.currentTargetPin?.id,
    mapStatus,
  ]);

  // Özellik 4: Detaylı Konum Kaydetme / Düzenleme (Not, Kategori, Tarih vb.)
  function handleSaveCurrentAddress() {
    if (!newLabelInput.trim()) return;
    const finalGroup =
      isCreatingNewGroup && customNewGroup.trim() ? customNewGroup.trim() : selectedGroupInput;

    let updated: SavedAddress[];

    if (editingAddressId) {
      updated = savedAddresses.map((a) => {
        if (a.id === editingAddressId) {
          return {
            ...a,
            label: newLabelInput.trim(),
            group: finalGroup,
            category: selectedCategory,
            note: newNoteInput.trim() || undefined,
            photo: newPhotoInput.trim() || undefined,
            date: newDateInput || undefined,
          };
        }
        return a;
      });
      setEditingAddressId(null);
    } else {
      const newEntry: SavedAddress = {
        id: "addr-" + Date.now(),
        label: newLabelInput.trim(),
        address: location.address,
        lat: location.lat,
        lng: location.lng,
        group: finalGroup,
        category: selectedCategory,
        visited: false,
        order: savedAddresses.filter((a) => (a.group || "Genel") === finalGroup).length + 1,
        note: newNoteInput.trim() || undefined,
        photo: newPhotoInput.trim() || undefined,
        date: newDateInput || undefined,
      };
      updated = [newEntry, ...savedAddresses];
    }

    if (typeof window !== "undefined") {
      try {
        userStorage.setItem("mapsbridge.savedAddresses", JSON.stringify(updated));
      } catch {
        return;
      }
    }
    setSavedAddresses(updated);

    // Yeni sekme oluşturulduysa sekmelere ekle
    if (
      isCreatingNewGroup &&
      customNewGroup.trim() &&
      !customTabs.includes(customNewGroup.trim())
    ) {
      const updatedTabs = [...customTabs, customNewGroup.trim()];
      setCustomTabs(updatedTabs);
      userStorage.setItem("mapsbridge.customTabs", JSON.stringify(updatedTabs));
    }

    setSelectedGroup(finalGroup);
    setNewLabelInput("");
    setNewNoteInput("");
    setNewDateInput("");
    setCustomNewGroup("");
    setIsCreatingNewGroup(false);
    setShowSaveDialog(false);
  }

  // Kaydedilen Gezi Grubunu Silme Özelliği
  function handleDeleteGroup(groupName: string) {
    if (!groupName) return;
    if (groupName === "Genel") {
      showPanelToast(
        "Varsayılan 'Genel' grubu silinemez. Ancak içerisindeki durakları silebilirsiniz.",
      );
      return;
    }
    const count = savedAddresses.filter((a) => (a.group || "Genel") === groupName).length;
    const msg =
      count > 0
        ? `"${groupName}" grubunu ve bu gruba ait ${count} durağı tamamen silmek istediğinize emin misiniz?`
        : `"${groupName}" grubunu silmek istediğinize emin misiniz?`;
    if (!window.confirm(msg)) return;

    // Durakları temizle
    const updatedAddresses = savedAddresses.filter((a) => (a.group || "Genel") !== groupName);
    setSavedAddresses(updatedAddresses);
    if (typeof window !== "undefined") {
      userStorage.setItem("mapsbridge.savedAddresses", JSON.stringify(updatedAddresses));
    }

    // Sekmelerden temizle
    const updatedTabs = customTabs.filter((t) => t !== groupName);
    setCustomTabs(updatedTabs);
    if (typeof window !== "undefined") {
      userStorage.setItem("mapsbridge.customTabs", JSON.stringify(updatedTabs));
    }

    // Herkese açık rotalardan temizle
    try {
      const pubRaw = userStorage.getItem("mapsbridge.publicRoutes");
      if (pubRaw) {
        const parsed = JSON.parse(pubRaw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((g: string) => g !== groupName);
          userStorage.setItem("mapsbridge.publicRoutes", JSON.stringify(filtered));
        }
      }
    } catch {}

    if (selectedGroup === groupName) {
      setSelectedGroup("all");
    }
    setShowRouteCard(false);
  }

  // Özellik 5: Üst Sekme Yönetimi — Sadece İsim Sorularak Yeni Sekme Ekleme ve Aktif Etme
  function handleAddNewTab() {
    const trimmed = newTabNameInput.trim();
    if (!trimmed) return;
    if (!customTabs.includes(trimmed)) {
      const updated = [...customTabs, trimmed];
      setCustomTabs(updated);
      if (typeof window !== "undefined") {
        userStorage.setItem("mapsbridge.customTabs", JSON.stringify(updated));
      }
    }
    // Yeni sekmeyi aktif et
    setSelectedGroup(trimmed);
    setShowRouteCard(true);
    setNewTabNameInput("");
    setShowAddTabModal(false);
  }

  // Gezi Yönetim Masası — Seçili rotayı kaydetme / güncelleme
  function handleSaveTripSettings() {
    if (!selectedGroup || selectedGroup === "all") return;
    const name = tripNameInput.trim() || selectedGroup;
    if (name !== selectedGroup) {
      // Rota adını değiştir: tüm durakların group alanını güncelle
      const updated = savedAddresses.map((a) => {
        if ((a.group || "Genel") === selectedGroup) {
          return { ...a, group: name };
        }
        return a;
      });
      setSavedAddresses(updated);
      if (typeof window !== "undefined") {
        userStorage.setItem("mapsbridge.savedAddresses", JSON.stringify(updated));
      }
      // customTabs güncelle
      const updatedTabs = customTabs.map((t) => (t === selectedGroup ? name : t));
      if (!updatedTabs.includes(name)) updatedTabs.push(name);
      setCustomTabs(updatedTabs);
      userStorage.setItem("mapsbridge.customTabs", JSON.stringify(updatedTabs));
      setSelectedGroup(name);
    }
    // Toplulukta yayınla / gizle
    try {
      const rawPub = localStorage.getItem("mapsbridge.publicRoutes");
      const pubList: string[] = rawPub ? JSON.parse(rawPub) : [];
      const filtered = pubList.filter((g) => g !== selectedGroup);
      if (tripIsPublic) filtered.push(name);
      localStorage.setItem("mapsbridge.publicRoutes", JSON.stringify(filtered));
    } catch {}
    setShowTripManager(false);
    setAiActionToast("✓ Gezi ayarları kaydedildi!");
    setTimeout(() => setAiActionToast(null), 2500);
  }

  // Gezi Yönetim Masası açıldığında mevcut değerleri doldur
  useEffect(() => {
    if (showTripManager && selectedGroup && selectedGroup !== "all") {
      setTripNameInput(selectedGroup);
      setTripStartDate("");
      setTripEndDate("");
      setTripTheme("Kültür & Şehir");
      try {
        const rawPub = localStorage.getItem("mapsbridge.publicRoutes");
        const pubList: string[] = rawPub ? JSON.parse(rawPub) : [];
        setTripIsPublic(pubList.includes(selectedGroup));
      } catch {
        setTripIsPublic(false);
      }
    }
  }, [showTripManager, selectedGroup]);

  // Delete address
  function handleDeleteSavedAddress(id: string) {
    const updated = savedAddresses.filter((a) => a.id !== id);
    if (typeof window !== "undefined") {
      try {
        userStorage.setItem("mapsbridge.savedAddresses", JSON.stringify(updated));
      } catch {
        return;
      }
    }
    setSavedAddresses(updated);
  }

  // Select address, fly to it and highlight
  function handleSelectSavedAddress(addr: SavedAddress) {
    setHighlightedStopId(addr.id);
    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.flyTo([addr.lat, addr.lng], 16, { animate: true, duration: 1.2 });
      markerRef.current.setLatLng([addr.lat, addr.lng]);
      setLocation({
        lat: addr.lat,
        lng: addr.lng,
        address: addr.address,
      });
    }
  }

  // Phase 8: Itinerary Reorder & Edit actions
  function handleMoveStop(stopId: string, direction: "up" | "down") {
    const currentGroupStops = savedAddresses.filter((a) => (a.group || "Genel") === selectedGroup);
    const otherStops = savedAddresses.filter((a) => (a.group || "Genel") !== selectedGroup);
    const idx = currentGroupStops.findIndex((s) => s.id === stopId);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === currentGroupStops.length - 1) return;

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    const temp = currentGroupStops[idx];
    currentGroupStops[idx] = currentGroupStops[targetIdx];
    currentGroupStops[targetIdx] = temp;

    const updated = [...otherStops, ...currentGroupStops];
    setSavedAddresses(updated);
    localStorage.setItem("mapsbridge.savedAddresses", JSON.stringify(updated));
    renderGroupOnMap(selectedGroup, updated, undefined, false);
  }

  function handleDeleteStop(stopId: string) {
    const updated = savedAddresses.filter((s) => s.id !== stopId);
    setSavedAddresses(updated);
    localStorage.setItem("mapsbridge.savedAddresses", JSON.stringify(updated));
    renderGroupOnMap(selectedGroup, updated, undefined, false);
    setAiActionToast("Durak rotadan çıkarıldı.");
    setTimeout(() => setAiActionToast(null), 2500);
  }

  function handleAddFreeTime(afterIdx: number) {
    const currentGroupStops = savedAddresses.filter((a) => (a.group || "Genel") === selectedGroup);
    const baseLat = currentGroupStops[afterIdx]?.lat || location.lat;
    const baseLng = currentGroupStops[afterIdx]?.lng || location.lng;

    const newStop: SavedAddress = {
      id: "free_" + Date.now(),
      label: "☕ Serbest Zaman & Fotoğraf Molası",
      address: "Serbest Keşif Noktası",
      note: "Dinlenme, kahve ve çevreyi keşfetme molası (1 saat)",
      category: "kahve",
      group: selectedGroup,
      lat: baseLat + 0.001,
      lng: baseLng + 0.001,
      visited: false,
    };

    const otherStops = savedAddresses.filter((a) => (a.group || "Genel") !== selectedGroup);
    currentGroupStops.splice(afterIdx + 1, 0, newStop);
    const updated = [...otherStops, ...currentGroupStops];
    setSavedAddresses(updated);
    localStorage.setItem("mapsbridge.savedAddresses", JSON.stringify(updated));
    renderGroupOnMap(selectedGroup, updated, undefined, false);
    setAiActionToast("✓ Serbest zaman bloğu rotaya eklendi!");
    setTimeout(() => setAiActionToast(null), 3000);
  }

  // Phase 7: Contextual AI Assistant (Action Engine)
  function handleRunContextualAI(actionType: string, customPrompt?: string) {
    const currentGroupStops = savedAddresses.filter((a) => (a.group || "Genel") === selectedGroup);
    const baseLat = currentGroupStops[currentGroupStops.length - 1]?.lat || location.lat;
    const baseLng = currentGroupStops[currentGroupStops.length - 1]?.lng || location.lng;

    let newStop: SavedAddress;

    if (actionType === "cafe") {
      newStop = {
        id: "ai_cafe_" + Date.now(),
        label: "☕ Butik Kahve & Tatlı Durağı",
        address: "Yerel Kafe & Fırın",
        note: "AI Tavsiyesi: Taze kavrulmuş kahve ve artisan tatlılar (45 dk)",
        category: "kahve",
        group: selectedGroup,
        lat: baseLat + 0.0012,
        lng: baseLng + 0.0015,
        visited: false,
      };
    } else if (actionType === "restaurant") {
      newStop = {
        id: "ai_dine_" + Date.now(),
        label: "🍽️ Geleneksel Akşam Trattoria & Lezzet",
        address: "Otantik Trattoria Sokağı",
        note: "AI Tavsiyesi: Şefin taze yerel spesiyalleri (1.5 saat)",
        category: "yemek",
        group: selectedGroup,
        lat: baseLat - 0.0015,
        lng: baseLng + 0.0018,
        visited: false,
      };
    } else if (actionType === "viewpoint") {
      newStop = {
        id: "ai_view_" + Date.now(),
        label: "📸 Panoramik Gün Batımı Seyir Noktası",
        address: "Şehir Seyir Terası",
        note: "AI Tavsiyesi: Şehrin çatılarına hakim gün batımı terası (1 saat)",
        category: "doga",
        group: selectedGroup,
        lat: baseLat + 0.0022,
        lng: baseLng - 0.0014,
        visited: false,
      };
    } else {
      newStop = {
        id: "ai_custom_" + Date.now(),
        label: customPrompt ? customPrompt.slice(0, 32) : "📍 Yeni Keşif Noktası",
        address: customPrompt ? `Özel Durak: ${customPrompt.slice(0, 25)}` : "Harita Noktası",
        note: `AI İsteği: "${customPrompt || "Özel durak"}" doğrultusunda eklendi`,
        category: "genel",
        group: selectedGroup,
        lat: baseLat + (Math.random() - 0.5) * 0.003,
        lng: baseLng + (Math.random() - 0.5) * 0.003,
        visited: false,
      };
    }

    const updated = [...savedAddresses, newStop];
    setSavedAddresses(updated);
    localStorage.setItem("mapsbridge.savedAddresses", JSON.stringify(updated));
    renderGroupOnMap(selectedGroup, updated, undefined, false);
    setAiActionToast(`✓ AI: "${newStop.label}" rotanıza eklendi!`);
    setTimeout(() => setAiActionToast(null), 3500);
  }

  // Kod ile Konum Bulma ve Haritada Odaklanma
  async function handleLookupCode(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const clean = lookupCodeInput.trim().toUpperCase().replace(/\s+/g, "");
    if (!clean) {
      setLookupError("Lütfen 6 haneli doğrulama kodunu girin.");
      return;
    }

    setIsLookupLoading(true);
    setLookupError("");

    try {
      const data = await readShare(clean);

      const targetLat = typeof data.lat === "string" ? parseFloat(data.lat) : Number(data.lat);
      const targetLng = typeof data.lng === "string" ? parseFloat(data.lng) : Number(data.lng);

      if (isNaN(targetLat) || isNaN(targetLng)) {
        throw new Error("Geçersiz konum koordinatları alındı.");
      }

      // Kullanıcının isteği: "her şeyi kapatıp paylaşılan pin odaklanmanı istiyorum"
      setShowCodeLookupModal(false);
      setShowSaveDialog(false);
      setIsCreated(false);
      setShowMapCustomizeModal(false);
      setIsProfileOpen(false);
      setShowAddTabModal(false);
      setIsBottomSearchExpanded(false);

      // Konum bilgisini güncelle
      setLocation({
        lat: targetLat,
        lng: targetLng,
        address: data.address || `${targetLat.toFixed(5)}, ${targetLng.toFixed(5)}`,
      });

      // Harita ve pin odaklanması
      const map = mapInstanceRef.current;
      const L = (window as any).L;
      if (map && L) {
        const customPin = L.divIcon({
          className: "custom-map-pin",
          html: `<div class="pin-pulse" style="background:${pinColor}55;"></div><div class="pin-marker"><svg width="28" height="36" viewBox="0 0 28 36" fill="none"><path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22c0-7.732-6.268-14-14-14z" fill="${pinColor}"/><circle cx="14" cy="14" r="5" fill="#ffffff"/></svg></div>`,
          iconSize: [28, 36],
          iconAnchor: [14, 36],
        });

        if (markerRef.current) {
          markerRef.current.setLatLng([targetLat, targetLng]);
          markerRef.current.setIcon(customPin);
        } else {
          const marker = L.marker([targetLat, targetLng], {
            draggable: true,
            icon: customPin,
          }).addTo(map);
          markerRef.current = marker;
        }
        map.flyTo([targetLat, targetLng], 17, { animate: true, duration: 1.4 });
      }
    } catch (err: any) {
      setLookupError(err.message || "Kod doğrulanamadı.");
    } finally {
      setIsLookupLoading(false);
    }
  }

  // Özellik 1: Paylaşım Süresi ile Paylaşım Başlatma
  async function handleCreateShare() {
    if (sharePending.current) return;
    const session = getStoredSession();
    if (!session?.token) {
      window.location.assign("/login/?next=/desk/");
      return;
    }
    sharePending.current = true;
    setIsSharing(true);
    setShareError("");
    try {
      const response = await fetch(`${API_ENDPOINT}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({
          lat: location.lat,
          lng: location.lng,
          address: location.address,
          hours,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok || !data.code || !data.token)
        throw new Error(data.error || "Paylaşım kaydedilemedi.");
      const url = `${window.location.origin}/k/?kod=${encodeURIComponent(data.token)}`;
      const updatedShares = [
        ...recentShares.filter((item) => item.expiresAt * 1000 > Date.now()),
        { code: data.code, expiresAt: data.expiresAt, url },
      ];
      setRecentShares(updatedShares);
      try {
        userStorage.setItem("mapsbridge.shares", JSON.stringify(updatedShares));
      } catch {
        setShareError("Paylaşım oluşturuldu, ancak bu cihazda geçmişe kaydedilemedi.");
      }
      setShareCode(data.code);
      setShareUrl(`${window.location.origin}/k/?kod=${encodeURIComponent(data.token)}`);
      setIsCreated(true);
      setShowDurationModal(false);
      setCopiedCode(false);
      setCopiedLink(false);
    } catch (error) {
      setShareError(
        error instanceof Error ? error.message : "Bağlantı kurulamadı. Tekrar deneyin.",
      );
    } finally {
      setIsSharing(false);
      sharePending.current = false;
    }
  }

  async function handleRevokeShare(code = shareCode) {
    const session = getStoredSession();
    if (!session?.token || sharePending.current) return;
    sharePending.current = true;
    setIsSharing(true);
    setShareError("");
    try {
      const response = await fetch(`${API_ENDPOINT}/shares/${code}/revoke`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("Paylaşım iptal edilemedi. Tekrar deneyin.");
      const updated = recentShares.filter((item) => item.code !== code);
      setRecentShares(updated);
      userStorage.setItem("mapsbridge.shares", JSON.stringify(updated));
      if (code === shareCode) {
        setIsCreated(false);
        setShareCode("");
        setShareUrl("");
      }
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "İptal başarısız.");
    } finally {
      setIsSharing(false);
      sharePending.current = false;
    }
  }

  function handleCopyCode() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  }

  function handleCopyLink() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  }

  function handleShareNative() {
    if (navigator.share) {
      navigator
        .share({
          title: "MapsBridge Konum Paylaşımı",
          text: `Konum: ${location.address}\nDoğrulama Kodu: ${shareCode}\nSüre: ${
            hours === 0 ? "Sınırsız" : `${hours} saat`
          }`,
          url: shareUrl,
        })
        .catch(() => {});
    } else {
      handleCopyLink();
    }
  }

  // Tüm Gruplar (Özel Sekmeler + Kayıtlı adres grupları)
  const allGroups = Array.from(
    new Set([
      "Genel",
      ...customTabs,
      ...savedAddresses.map((a) => a.group || "Genel").filter(Boolean),
    ]),
  );

  // Aktif grup durakları
  const activeGroupStops =
    selectedGroup === "all"
      ? savedAddresses
      : savedAddresses.filter((a) => (a.group || "Genel") === selectedGroup);

  const visitedStopsCount = activeGroupStops.filter((a) => a.visited).length;
  const progressPercent =
    activeGroupStops.length > 0
      ? Math.round((visitedStopsCount / activeGroupStops.length) * 100)
      : 0;

  // Özellik 6: Alt kısım yatay konum listesi için arama filtresi (arama yapıldığında seçili grup olsa bile tüm konumlarda arar)
  const filteredStopsForBottom = (
    bottomSearchQuery.trim() ? savedAddresses : activeGroupStops
  ).filter((s) => {
    if (!bottomSearchQuery.trim()) return true;
    const q = bottomSearchQuery.toLowerCase();
    return (
      s.label.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q) ||
      (s.note && s.note.toLowerCase().includes(q))
    );
  });

  const googlePins: Pin[] = [
    ...planner.pinsWithTime,
    ...planner.generalPins,
    ...savedAddresses
      .filter(
        (p) =>
          !planner.allPins.some((existing) => existing.id === p.id) &&
          (selectedGroup === "all" || p.group === selectedGroup),
      )
      .map((p) => ({
        ...p,
        category: p.category || "genel",
        dayIndex: p.day || 0,
        order: p.order || 1,
        group: p.group || "Genel",
        visited: !!p.visited,
      })),
  ];
  const legacyPin = savedAddresses.find((p) => p.id === planner.selectedPinId);
  const sheetPin: Pin | null =
    planner.selectedPin ||
    (legacyPin
      ? {
          ...legacyPin,
          category: legacyPin.category || "genel",
          dayIndex: legacyPin.day || 0,
          order: legacyPin.order || 1,
          group: legacyPin.group || "Genel",
          visited: !!legacyPin.visited,
        }
      : null);
  function updateSheetPin(id: string, updates: Partial<Pin>) {
    if (planner.allPins.some((p) => p.id === id)) planner.updatePinAnywhere(id, updates);
    else {
      const next = savedAddresses.map((p) =>
        p.id === id ? ({ ...p, ...updates } as SavedAddress) : p,
      );
      userStorage.setItem("mapsbridge.savedAddresses", JSON.stringify(next));
      setSavedAddresses(next);
    }
  }
  return (
    <AuthGuard
      featureName="Seyahat Haritası"
      title="Haritaya Giriş Yapın"
      subtitle="Kişisel gezi rotalarınızı oluşturmak, duraklarınızı coğrafi sıraya dizmek ve AI seyahat asistanınızı kullanmak için giriş yapmalısınız."
      fallback={<AIPromoLanding />}
    >
      <main className={`map-page ${googleMapsEnabled ? "google-map-page" : ""}`}>
        <HeaderNav savedCount={savedAddresses.length} />

        {/* Ziyaretçi Tanıtım Banner'ı */}
        {!userEmail && <PanelGuestBanner nextUrl="/desk/" />}

        {mapStatus !== "ready" && (
          <div className="map-load-status" role={mapStatus === "error" ? "alert" : "status"}>
            <p>
              {mapStatus === "loading"
                ? "Harita yükleniyor…"
                : "Harita yüklenemedi. Bağlantını kontrol edip tekrar dene."}
            </p>
            {mapStatus === "error" && (
              <button
                className="ui-button"
                type="button"
                onClick={() => setMapAttempt((value) => value + 1)}
              >
                Haritayı tekrar yükle
              </button>
            )}
          </div>
        )}
        {(sheetPin || quickAddPoint) && (
          <MobilePinSheet
            key={
              sheetPin?.id ||
              `${quickAddPoint?.lat}:${quickAddPoint?.lng}:${quickAddPoint?.googlePlaceId || ""}`
            }
            planner={planner}
            point={quickAddPoint}
            pin={sheetPin}
            onClose={closePinSheet}
            onClearPoint={() => setQuickAddPoint(null)}
            onUpdate={updateSheetPin}
            onLinkPlace={(id) => setQuickAddPoint((p) => (p ? { ...p, googlePlaceId: id } : p))}
          />
        )}
        {/* ── Docked Split View: Left Travel Planner + Interactive Map ── */}
        <div
          className={`panel-screen-body ${isPlannerCollapsed ? "sidebar-collapsed" : "sidebar-expanded"}`}
        >
          <TravelPlannerSidebar
            planner={planner}
            isCollapsed={isPlannerCollapsed}
            onToggleCollapse={() => setIsPlannerCollapsed(!isPlannerCollapsed)}
            selectedMapPoint={quickAddPoint}
            onClearSelectedMapPoint={() => setQuickAddPoint(null)}
            isAddingPinMode={isAddingPinMode}
            onToggleAddPinMode={() => {
              if (!userEmail) {
                requireAuth(
                  "Haritaya Pin Ekleme",
                  "Harita üzerinde yeni keşif noktaları ve pinler eklemek",
                  () => {},
                );
                return;
              }
              setIsAddingPinMode((prev) => !prev);
            }}
            isGuest={!userEmail}
            onRequireAuth={(featureName, actionDesc) => {
              requireAuth(featureName, actionDesc, () => {});
            }}
            onFlyToPin={(pin) => focusMapPin(pin.lat, pin.lng)}
            onFlyToCoords={(lat, lng, label) => {
              focusMapPin(lat, lng);
              markerRef.current?.setLatLng([lat, lng]);
              pointRequest.current++;
              planner.setSelectedPinId(null);
              setQuickAddPoint({ lat, lng, address: label });
            }}
            onRunOptimize={() => handleRunContextualAI("optimize")}
          />

          {googleMapsEnabled ? (
            <GooglePlannerMap
              key={mapAttempt}
              pins={googlePins}
              selectedId={planner.selectedPinId}
              point={quickAddPoint}
              path={(planner.activeRoadGeometry?.coordinates || []) as [number, number][]}
              onPoint={(point) => {
                pointRequest.current++;
                planner.setSelectedPinId(null);
                setQuickAddPoint(point);
              }}
              onPin={openSavedPin}
              onReady={(handle) => {
                googleMapRef.current = handle;
                setMapStatus("ready");
              }}
              onError={() => setMapStatus("error")}
              onAddPlaceToTrip={(place) => {
                const targetTripId = planner.activeTrip?.id || planner.trips[0]?.id || "trip-1";
                const targetDay = planner.activeDayIndex || 1;
                planner.addPinDirectlyToTrip(
                  targetTripId,
                  {
                    label: place.label,
                    address: place.address,
                    lat: place.lat,
                    lng: place.lng,
                    category: (place.category || "genel") as any,
                    dayIndex: targetDay,
                    group: "Genel",
                    visited: false,
                    durationMinutes: 60,
                    googlePlaceId: place.googlePlaceId,
                  },
                  targetDay,
                );
                interactionTracker.logPinAddToRoute({
                  label: place.label,
                  category: place.category,
                  tripId: targetTripId,
                  dayIndex: targetDay,
                  source: "map_search",
                });
                setQuickAddPoint(null);
                showPanelToast(`✓ "${place.label}" ${targetDay}. güne eklendi!`);
              }}
            />
          ) : (
            <div
              ref={mapContainerRef}
              className="map-container"
              aria-label="Seyahat planlama haritası"
              data-map-style={currentMapStyle}
            />
          )}

          {/* Unified Map Control Hub (Tek Noktada Toplanan Harita Kontrolleri) */}
          <div
            ref={mapHubRef}
            className={`stitch-map-hub-container ${planner.selectedPin ? "has-drawer-open" : ""}`}
          >
            {!isMapHubOpen ? (
              <button
                type="button"
                className="stitch-map-hub-trigger"
                onClick={() => setIsMapHubOpen(true)}
                title="Harita Görünümü ve Kontrolleri"
                aria-label="Harita Kontrol Menüsünü Aç"
              >
                <div className="stitch-hub-trigger-icon-box">
                  <span className="material-symbols-outlined text-[17px]">
                    {currentMapStyle === "uydu"
                      ? "satellite_alt"
                      : currentMapStyle === "koyu"
                        ? "dark_mode"
                        : currentMapStyle === "doga"
                          ? "terrain"
                          : "layers"}
                  </span>
                </div>
                <span className="stitch-hub-trigger-label">
                  {currentMapStyle === "uydu"
                    ? "Uydu"
                    : currentMapStyle === "koyu"
                      ? "Koyu Gece"
                      : currentMapStyle === "doga"
                        ? "Doğa / Arazi"
                        : "Standart Harita"}
                </span>
                <span className="material-symbols-outlined stitch-hub-trigger-chevron">
                  expand_more
                </span>
              </button>
            ) : (
              <div className="stitch-map-hub-card">
                {/* Header */}
                <div className="stitch-hub-card-header">
                  <div className="stitch-hub-header-left">
                    <span className="material-symbols-outlined text-[17px] text-[#047857]">
                      tune
                    </span>
                    <span>Harita Kontrolleri</span>
                  </div>
                  <button
                    type="button"
                    className="stitch-hub-close-btn"
                    onClick={() => setIsMapHubOpen(false)}
                    title="Kapat"
                    aria-label="Harita Kontrol Menüsünü Kapat"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>

                {/* Map Layer Section */}
                <div className="stitch-hub-section">
                  <span className="stitch-hub-section-label">Harita Katmanı</span>
                  <div className="stitch-hub-styles-grid">
                    {(
                      [
                        { id: "standart" as MapStyleId, label: "Standart", icon: "layers" },
                        { id: "uydu" as MapStyleId, label: "Uydu", icon: "satellite_alt" },
                        { id: "koyu" as MapStyleId, label: "Koyu", icon: "dark_mode" },
                        { id: "doga" as MapStyleId, label: "Doğa", icon: "terrain" },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        className={`stitch-hub-style-tile ${currentMapStyle === st.id ? "active" : ""}`}
                        onClick={() => {
                          setCurrentMapStyle(st.id);
                          if (typeof window !== "undefined")
                            localStorage.setItem("mapsbridge.mapStyle", st.id);
                        }}
                      >
                        <span className="material-symbols-outlined text-[16px]">{st.icon}</span>
                        <span>{st.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Transit / Rail Toggle */}
                  <div
                    className="stitch-hub-toggle-row"
                    onClick={() => {
                      const next = !showTransitOverlay;
                      setShowTransitOverlay(next);
                      if (typeof window !== "undefined")
                        localStorage.setItem("mapsbridge.transitOverlay", String(next));
                    }}
                    role="button"
                    tabIndex={0}
                    title="Raylı Sistem & Ulaşım Katmanı"
                  >
                    <div className="stitch-hub-toggle-left">
                      <span className="material-symbols-outlined text-[16px] text-emerald-600">
                        traffic
                      </span>
                      <span>Raylı Sistem & Ulaşım</span>
                    </div>
                    <div className={`stitch-hub-toggle-pill ${showTransitOverlay ? "active" : ""}`}>
                      <div className="stitch-hub-toggle-dot" />
                    </div>
                  </div>
                </div>

                {/* Navigation & Zoom Section */}
                <div className="stitch-hub-section">
                  <span className="stitch-hub-section-label">Navigasyon & Büyütme</span>
                  <div className="stitch-hub-nav-grid">
                    <button
                      type="button"
                      className="stitch-hub-nav-btn"
                      title="Büyüt (Yakınlaştır)"
                      aria-label="Haritayı Büyüt"
                      onClick={() => {
                        if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
                      }}
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      <span>Büyüt</span>
                    </button>

                    <button
                      type="button"
                      className="stitch-hub-nav-btn"
                      title="Küçült (Uzaklaştır)"
                      aria-label="Haritayı Küçült"
                      onClick={() => {
                        if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
                      }}
                    >
                      <span className="material-symbols-outlined text-[18px]">remove</span>
                      <span>Küçült</span>
                    </button>

                    <button
                      type="button"
                      className="stitch-hub-nav-btn"
                      title="Kuzeye Hizala"
                      aria-label="Kuzeye Hizala"
                      onClick={() => {
                        if (mapInstanceRef.current) {
                          mapInstanceRef.current.setView(
                            mapInstanceRef.current.getCenter(),
                            mapInstanceRef.current.getZoom(),
                            { animate: true },
                          );
                        }
                      }}
                    >
                      <span className="material-symbols-outlined text-[18px] text-sky-600">
                        explore
                      </span>
                      <span>Kuzey</span>
                    </button>

                    <button
                      type="button"
                      className="stitch-hub-nav-btn"
                      title="Mevcut Konumum"
                      aria-label="Mevcut Konumumu Bul"
                      onClick={handleCurrentLocation}
                      disabled={isLocating}
                    >
                      <span
                        className={`material-symbols-outlined text-[18px] text-emerald-600 ${isLocating ? "animate-spin" : ""}`}
                      >
                        my_location
                      </span>
                      <span>Konum</span>
                    </button>
                  </div>
                </div>

                {/* Advanced Modal Trigger Footer */}
                <div className="stitch-hub-footer">
                  <button
                    type="button"
                    className="stitch-hub-advanced-btn"
                    onClick={() => {
                      setIsMapHubOpen(false);
                      setShowMapCustomizeModal(true);
                    }}
                    title="Detaylı Harita Özelleştirme"
                  >
                    <span className="material-symbols-outlined text-[15px]">palette</span>
                    <span>Daha Fazla Özelleştirme...</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT SIDE: Stitch 6-Digit Direct Instant Share Card (Floating Overlay) */}
          {showShareCard && (
            <div className="stitch-floating-share-card" id="share-modal-card">
              <div className="share-card-head">
                <div className="share-card-title-box">
                  <span className="material-symbols-outlined text-[#286954] text-[20px]">
                    share_location
                  </span>
                  <h3 className="share-card-title">Rotayı Anında Paylaş</h3>
                </div>
                <button
                  type="button"
                  className="share-card-close-btn"
                  id="close-share-btn"
                  onClick={() => setShowShareCard(false)}
                  title="Kapat"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
              <p className="share-card-desc">
                Bu kodu giren arkadaşlarınız haritayı gerçek zamanlı olarak masalarında açar.
              </p>

              {/* 6-Digit Code Display */}
              <div className="share-code-display-box">
                <div className="share-code-inner">
                  <span className="share-code-label">BENZERSİZ ERİŞİM KODU</span>
                  <span className="share-code-value">{shareCode || "MB-8492"}</span>
                </div>
                <button
                  type="button"
                  className="share-code-copy-btn"
                  id="btn-copy-code"
                  title="Kodu Kopyala"
                  onClick={handleCopyCode}
                >
                  <span className="material-symbols-outlined text-[17px] text-white">
                    {copiedCode ? "check" : "content_copy"}
                  </span>
                </button>
              </div>

              {/* Dynamic QR Code Container */}
              <div className="share-qr-container">
                <div className="share-qr-box">
                  <QRCodeSVG
                    value={
                      shareUrl ||
                      (typeof window !== "undefined"
                        ? `${window.location.origin}/desk/?code=${shareCode || "MB-8492"}`
                        : "https://mapsbridge.com")
                    }
                    size={56}
                    level="M"
                  />
                </div>
                <div className="share-qr-meta">
                  <span className="share-qr-title">Kamerayla Oku</span>
                  <span className="share-qr-sub">
                    Mobil MapsBridge uygulaması doğrudan rota seyrini başlatır.
                  </span>
                </div>
              </div>

              {/* Expiration Setting Dropdown */}
              <div className="share-expiry-row">
                <span className="share-expiry-label">Geçerlilik Süresi:</span>
                <select
                  className="share-expiry-select"
                  value={hours}
                  onChange={(e) => {
                    setHours(Number(e.target.value));
                    handleCreateShare();
                  }}
                >
                  <option value={24}>24 Saat Geçerli</option>
                  <option value={1}>1 Saat (Hızlı Oturum)</option>
                  <option value={168}>7 Gün Geçerli</option>
                  <option value={0}>Süresiz (Kalıcı Link)</option>
                </select>
              </div>

              {/* Social Share Pills */}
              <div className="share-social-grid">
                <a
                  className="share-social-btn whatsapp"
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `MapsBridge Rota Kodu: #${shareCode || "MB-8492"}\nHaritada incele: ${shareUrl || (typeof window !== "undefined" ? window.location.href : "")}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="material-symbols-outlined text-[15px]">chat</span> WhatsApp
                </a>
                <a
                  className="share-social-btn telegram"
                  href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl || (typeof window !== "undefined" ? window.location.href : ""))}&text=${encodeURIComponent(`MapsBridge Rota Kodu: #${shareCode || "MB-8492"}`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="material-symbols-outlined text-[15px]">send</span> Telegram
                </a>
                <button type="button" className="share-social-btn link" onClick={handleCopyLink}>
                  <span className="material-symbols-outlined text-[15px]">
                    {copiedLink ? "check" : "link"}
                  </span>{" "}
                  {copiedLink ? "Kopyalandı" : "Link"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Paylaşım Sonucu Modalı (Minimal & Modern) */}
        {isCreated && (
          <div className="share-modal-overlay" onClick={() => setIsCreated(false)}>
            <div className="share-modal minimal" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setIsCreated(false)}>
                ✕
              </button>
              <button
                type="button"
                className="cancel-btn"
                disabled={isSharing}
                onClick={() => handleRevokeShare()}
              >
                Paylaşımı iptal et
              </button>
              {shareError && <p role="alert">{shareError}</p>}
              <div className="modal-badge">PAYLAŞIMA HAZIR</div>
              <h2>Konum Doğrulama Kodun</h2>
              <p className="modal-desc">
                Bu kodla{" "}
                <strong>
                  {hours === 0 ? "Süresiz" : `${hours === 168 ? "7 gün" : `${hours} saat`}`}
                </strong>{" "}
                boyunca konumunuza erişilebilir.
              </p>

              <div className="big-code-box">
                <span className="code-hint">6 HANELİ DOĞRULAMA KODU</span>
                <div className="code-display">
                  {shareCode.slice(0, 3)} {shareCode.slice(3)}
                </div>
                <button className="copy-code-button" onClick={handleCopyCode}>
                  <IconCopy className="mini-icon-svg" />
                  <span>{copiedCode ? "Kod Kopyalandı!" : "Kodu Kopyala"}</span>
                </button>
                <small className="code-info">
                  Karşı taraf <strong>"Kodla Bul"</strong> butonuna bu kodu girerek haritada
                  konumunuzu görebilir.
                </small>
              </div>

              <div className="qr-wrapper">
                <QRCodeSVG value={shareUrl} size={130} level="M" includeMargin />
              </div>

              <div className="url-box">
                <code>{shareUrl}</code>
                <button className="copy-btn" onClick={handleCopyLink}>
                  {copiedLink ? "Kopyalandı" : "Kopyala"}
                </button>
              </div>

              <div className="modal-actions">
                <a
                  className="share-btn whatsapp"
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `MapsBridge konumum: ${location.address}\nDoğrulama Kodu: ${shareCode}\nSüre: ${
                      hours === 0 ? "Sınırsız" : `${hours} saat`
                    }\nKonumu Gör: ${shareUrl}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp ile Paylaş
                </a>
                <button className="share-btn primary" onClick={handleShareNative}>
                  Bağlantıyı Paylaş
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Harita Ayarları Popover Menüsü (Sağ Alt Köşede Butonun Hemen Üstünde Açılır) */}
        {/* Harita Düzenleme & Katman Ayarları Pop-up (Stitch 1:1 Floating Card) */}
        {showMapCustomizeModal && (
          <div
            className="stitch-floating-layer-card"
            id="layer-selector-card"
            role="dialog"
            aria-modal="true"
            aria-label="Harita Görünümü"
          >
            <div className="layer-card-head flex items-center justify-between pb-1">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#286954] text-[20px]">map</span>
                <h3 className="text-[16px] font-bold text-[#013628]">Harita Görünümü</h3>
              </div>
              <button
                type="button"
                className="w-7 h-7 rounded-full bg-[#F1F5F9] hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                id="close-layer-btn"
                onClick={() => setShowMapCustomizeModal(false)}
                title="Kapat"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {/* 6 Map Style Grid (3x2) */}
            <div className="grid grid-cols-3 gap-2 my-2">
              {MAP_STYLES.map((style) => {
                const isSelected = currentMapStyle === style.id;
                return (
                  <div
                    key={style.id}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? "bg-[#ECFDF5] ring-1 ring-[#10B981] shadow-sm"
                        : "bg-white hover:bg-[#F1F5F9] border border-slate-200/70"
                    }`}
                    onClick={() => {
                      setCurrentMapStyle(style.id);
                      if (typeof window !== "undefined")
                        localStorage.setItem("mapsbridge.mapStyle", style.id);
                    }}
                  >
                    <div
                      className={`w-full h-9 rounded-lg flex items-center justify-center text-[18px] ${
                        isSelected ? "bg-[#abedd3] text-[#013628]" : "bg-[#F1F5F9] text-[#404945]"
                      }`}
                    >
                      <span className="text-[17px]">{style.icon}</span>
                    </div>
                    <span
                      className={`text-[10px] text-center font-bold truncate max-w-full ${
                        isSelected ? "text-[#013628]" : "text-[#404945]"
                      }`}
                    >
                      {style.label.split("&")[0].trim()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Overlays */}
            <div className="flex flex-col gap-2 pt-1 border-t border-slate-200/70">
              <label className="flex items-center justify-between cursor-pointer text-[12px] font-medium text-[#131b2e]">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#286954]">
                    subway
                  </span>
                  <span>Metro & Raylı Hatlar</span>
                </span>
                <input
                  type="checkbox"
                  checked={showTransitOverlay}
                  onChange={(e) => {
                    setShowTransitOverlay(e.target.checked);
                    if (typeof window !== "undefined")
                      localStorage.setItem("mapsbridge.transitOverlay", String(e.target.checked));
                  }}
                  className="accent-[#10B981] w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer text-[12px] font-medium text-[#131b2e]">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#286954]">
                    apartment
                  </span>
                  <span>3D Bina Gölgelendirmesi</span>
                </span>
                <input
                  type="checkbox"
                  checked={mapVisualFilter === "contrast"}
                  onChange={(e) => {
                    const nextFilter = e.target.checked ? "contrast" : "none";
                    setMapVisualFilter(nextFilter);
                    if (typeof window !== "undefined")
                      localStorage.setItem("mapsbridge.mapVisualFilter", nextFilter);
                  }}
                  className="accent-[#10B981] w-4 h-4 cursor-pointer"
                />
              </label>
            </div>

            {/* Route Color Picker */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200/70">
              <span className="text-[10px] text-[#404945] font-bold uppercase tracking-wider">
                Rota Vurgu Rengi
              </span>
              <div className="flex items-center justify-between pt-0.5">
                {PIN_COLORS.map((c) => {
                  const isSelected = pinColor === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`w-6 h-6 rounded-full transition-transform ${
                        isSelected ? "ring-2 ring-[#013628] scale-110" : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: c.color }}
                      title={c.name}
                      onClick={() => {
                        setPinColor(c.id);
                        if (typeof window !== "undefined")
                          localStorage.setItem("mapsbridge.pinColor", c.id);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Seyahat Manifestosu (.md) Modalı */}
        {showTripManifestoModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#111927] border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0d1424]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sky-400 text-xl">
                    description
                  </span>
                  <h3 className="text-base font-bold text-slate-100">Seyahat Manifestosu (.md)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTripManifestoModal(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
                  title="Kapat"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto">
                <p className="text-xs text-slate-400 mb-3">
                  Bu markdown dosyası seyahatinizin tüm duraklarını, konaklamalarını ve notlarını
                  içerir. AI Asistanı (
                  <a href="/ai/" className="text-emerald-400 underline hover:text-emerald-300">
                    /ai
                  </a>
                  ) sorularınızı yanıtlarken bu dosyayı okuyarak rota ve otellerinizi tam olarak
                  bilir.
                </p>
                <pre className="bg-[#0b101c] p-4 rounded-xl border border-slate-800/80 text-xs font-mono text-slate-200 overflow-x-auto whitespace-pre-wrap max-h-[50vh] leading-relaxed select-all">
                  {planner.activeTrip
                    ? tripToMarkdown(planner.activeTrip)
                    : "# Henüz aktif seyahat yok."}
                </pre>
              </div>

              <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-[#0d1424] gap-2 flex-wrap">
                <a
                  href={planner.activeTrip ? `/ai/?tripId=${planner.activeTrip.id}` : "/ai/"}
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">smart_toy</span>
                  <span>AI Asistanda Bu Rota ile Konuş</span>
                </a>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!planner.activeTrip) return;
                      await navigator.clipboard.writeText(tripToMarkdown(planner.activeTrip));
                      showPanelToast("✓ Markdown panoya kopyalandı!");
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">content_copy</span>
                    <span>Kopyala</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!planner.activeTrip) return;
                      const content = tripToMarkdown(planner.activeTrip);
                      const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${(planner.activeTrip.title || "seyahat").toLowerCase().replace(/[^a-z0-9]/gi, "_")}_manifesto.md`;
                      a.click();
                      URL.revokeObjectURL(url);
                      showPanelToast("✓ Markdown dosyası indirildi!");
                    }}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-950/40"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                    <span>İndir (.md)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fiyat Takip & Ucuz Bilet/Otel Botu Modalı */}
        {showDealTrackerModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <DealTrackerPanel
                initialDestination={
                  planner.activeTrip?.destination || planner.activeTrip?.title || ""
                }
                onClose={() => setShowDealTrackerModal(false)}
              />
            </div>
          </div>
        )}

        {/* Panel Bilgilendirme Bildirimi */}
        {panelToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-slate-900/95 text-white text-xs font-semibold px-4 py-2.5 rounded-full border border-emerald-500/30 shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <span className="material-symbols-outlined text-[16px] text-emerald-400">info</span>
            <span>{panelToast}</span>
          </div>
        )}

        {/* Oturum & İşlem Koruması Tanıtım Modalı */}
        <AuthActionModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          title={authModalConfig.title}
          subtitle={authModalConfig.subtitle}
          featureName={authModalConfig.featureName}
          nextUrl="/desk/"
        />
      </main>
    </AuthGuard>
  );
}
