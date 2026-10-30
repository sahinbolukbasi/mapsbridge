import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Share,
  Linking,
  Platform,
  Modal,
  Dimensions,
  ActivityIndicator,
  FlatList,
  PanResponder,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { WebView } from "react-native-webview";
import { tripStore, TripStop, ActiveRoute } from "../services/tripStore";
import { trainingService } from "../services/api";
import {
  SunIcon,
  MoonIcon,
  SatelliteIcon,
  PinIcon,
  MapPinIcon,
  MonumentIcon,
  ChatIcon,
  SearchIcon,
  SettingsIcon,
  PlusIcon,
  Share2Icon,
  QrCodeIcon,
  DirectionsIcon,
  WalkIcon,
  ClockIcon,
  LightbulbIcon,
  PlanIcon,
  TrainIcon,
  RobotIcon,
  SparkIcon,
} from "../components/Icons";
import { ScreenTourModal } from "../components/ScreenTourModal";

import { AccessibleStopList, SafeArea, mapLabel, motion } from "../ui";
import { tokens, withAlpha } from "../theme";
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const CARD_WIDTH = Math.min(SCREEN_W - 44, 340);
const CARD_GAP = 12;
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

const _CATEGORY_FILTERS = [
  { id: "TÜMÜ", label: "TÜMÜ" },
  { id: "TARİHİ YER", label: "TARİHİ YER" },
  { id: "MÜZE", label: "MÜZE" },
  { id: "KAHVE & MOLA", label: "KAHVE & MOLA" },
  { id: "YEME-İÇME", label: "YEME-İÇME" },
];

interface MapScreenProps {
  onOpenProfile?: () => void;
  onOpenPlan?: () => void;
  onOpenAi?: () => void;
  focusedStopId?: string | null;
  onClearFocus?: () => void;
}

export interface PlaceReview {
  author: string;
  rating: number;
  text: string;
  relativeTime: string;
}

export interface ClickedPlaceInfo {
  name: string;
  address: string;
  category: string;
  lat: number;
  lng: number;
  rating?: number;
  userRatingsTotal?: number;
  photoUrl?: string;
  isPoi: boolean;
  description?: string;
  reviews?: PlaceReview[];
}

export function MapScreen({
  onOpenProfile: _onOpenProfile,
  onOpenPlan,
  onOpenAi,
  focusedStopId,
  onClearFocus,
}: MapScreenProps) {
  const [activeRoute, setActiveRoute] = useState<ActiveRoute>(tripStore.getActiveRoute());
  const [allRoutes, setAllRoutes] = useState<ActiveRoute[]>(tripStore.getAllRoutes());
  const [selectedCategory, _setSelectedCategory] = useState("TÜMÜ");
  const [currentStopIdx, setCurrentStopIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{
      name: string;
      formatted_address?: string;
      geometry?: { location?: { lat: number; lng: number } };
      types?: string[];
      rating?: number;
      category?: string;
      photoUrl?: string;
    }>
  >([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [activeTileLayer, setActiveTileLayer] = useState<"light" | "dark" | "satellite">("light");

  // Route line display settings
  const [showRouteLines, setShowRouteLines] = useState<boolean>(true);
  const [useRoadRouting, setUseRoadRouting] = useState<boolean>(false); // true = follow roads, false = straight lines
  const [showMyLocation, setShowMyLocation] = useState<boolean>(false);
  const [_myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Route selector modal
  const [showRouteModal, setShowRouteModal] = useState<boolean>(false);
  // Map settings modal
  const [showMapSettingsModal, setShowMapSettingsModal] = useState<boolean>(false);

  // Clicked Map Point Details (Google Maps API integration)
  const [clickedPlace, setClickedPlace] = useState<ClickedPlaceInfo | null>(null);
  const [isLoadingPlace, setIsLoadingPlace] = useState<boolean>(false);
  const [isPendingAddStop, setIsPendingAddStop] = useState<boolean>(tripStore.getPendingAddStop());

  // Collapsible / expandable bottom popup with smooth spring animation
  const [isPopupExpanded, _setIsPopupExpanded] = useState<boolean>(true);
  const setIsPopupExpanded = (val: boolean | ((prev: boolean) => boolean)) => {
    motion.layoutNext(LayoutAnimation.Presets.easeInEaseOut);
    _setIsPopupExpanded(val);
  };

  // Share target for QR Code, Transit & Turn-by-Turn Directions
  const [shareTarget, setShareTarget] = useState<{
    name: string;
    address: string;
    lat: number;
    lng: number;
  } | null>(null);

  // PanResponder to handle drag up / drag down gestures from ANY point of the bottom sheet
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Intercept vertical drag when movement is distinctly vertical
        return (
          Math.abs(gestureState.dy) > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
        );
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        // Intercept strong vertical drags even if child views are present
        return (
          Math.abs(gestureState.dy) > 16 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.5
        );
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 18) {
          // Dragged down -> smooth collapse
          setIsPopupExpanded(false);
        } else if (gestureState.dy < -18) {
          // Dragged up -> smooth expand
          setIsPopupExpanded(true);
        }
      },
    }),
  ).current;

  const webViewRef = useRef<WebView>(null);
  const stopsTrackScrollRef = useRef<ScrollView>(null);
  const stopsCarouselRef = useRef<FlatList<TripStop>>(null);

  // Subscribe to tripStore updates
  useEffect(() => {
    setIsPendingAddStop(tripStore.getPendingAddStop());
    const unsubscribe = tripStore.subscribe(() => {
      setActiveRoute({ ...tripStore.getActiveRoute() });
      setAllRoutes([...tripStore.getAllRoutes()]);
      setIsPendingAddStop(tripStore.getPendingAddStop());
    });
    return unsubscribe;
  }, []);

  // Location tracking
  useEffect(() => {
    let locationInterval: ReturnType<typeof setInterval> | null = null;

    if (showMyLocation) {
      // Get initial location
      getCurrentLocation();
      // Update location every 10 seconds
      locationInterval = setInterval(getCurrentLocation, 10000);
    }

    return () => {
      if (locationInterval) {
        clearInterval(locationInterval);
      }
    };
  }, [showMyLocation]);

  // Get current location (requests native iOS/Android location permission via WebView)
  const getCurrentLocation = () => {
    webViewRef.current?.injectJavaScript(`
      if (window.requestUserLocation) {
        window.requestUserLocation();
      }
      true;
    `);
  };

  // Toggle location tracking
  const toggleLocationTracking = () => {
    if (!showMyLocation) {
      setShowMyLocation(true);
      getCurrentLocation();
    } else {
      setShowMyLocation(false);
    }
  };

  // Filter stops by selected category
  const filteredStops = activeRoute.stops.filter((s) => {
    if (selectedCategory === "TÜMÜ") return true;
    return s.category?.toUpperCase() === selectedCategory.toUpperCase();
  });

  const currentStop = filteredStops[currentStopIdx] || filteredStops[0] || activeRoute.stops[0];

  // Handle external focusedStopId (e.g. from PlanScreen)
  useEffect(() => {
    if (focusedStopId && activeRoute.stops.length > 0) {
      const idx = activeRoute.stops.findIndex((s) => s.id === focusedStopId);
      if (idx >= 0) {
        setCurrentStopIdx(idx);
        flyToStop(activeRoute.stops[idx]);
        setClickedPlace(null);
        setIsPopupExpanded(true);
        stopsCarouselRef.current?.scrollToOffset({
          offset: idx * (CARD_WIDTH + CARD_GAP),
          animated: true,
        });
      }
      if (onClearFocus) onClearFocus();
    }
  }, [focusedStopId, activeRoute.stops]);

  // Sync stops with WebView whenever stops or currentStop change
  useEffect(() => {
    if (!webViewRef.current) return;
    const stopsPayload = activeRoute.stops.map((s, idx) => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      category: s.category,
      index: idx + 1,
      isSelected: s.id === currentStop?.id,
      visited: s.visited || false,
    }));

    webViewRef.current.injectJavaScript(`
      if (window.updateMapStops) {
        window.updateMapStops(${JSON.stringify(stopsPayload)});
      }
      true;
    `);
  }, [activeRoute.stops, currentStop?.id]);

  // Handle Map Click: Fetch Google Places / Geocode API
  const handleMapLocationClick = async (lat: number, lng: number) => {
    setIsLoadingPlace(true);
    setClickedPlace(null);

    // Drop temporary marker on Leaflet map immediately
    webViewRef.current?.injectJavaScript(`
      if (window.addTemporaryPin) {
        window.addTemporaryPin(${lat}, ${lng}, "Konum Araştırılıyor...");
      }
      true;
    `);

    try {
      // 1. Google Places (New) searchNearby API for venue/POI with detailed editorial summary and user reviews
      const placesRes = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.primaryTypeDisplayName,places.photos,places.editorialSummary,places.reviews",
        },
        body: JSON.stringify({
          locationRestriction: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: 60.0,
            },
          },
          languageCode: "tr",
        }),
      });

      const placesData = await placesRes.json();

      if (placesData.places && placesData.places.length > 0) {
        const topPoi = placesData.places[0];
        const category = topPoi.primaryTypeDisplayName?.text || getCategoryFromTypes(topPoi.types);
        let photoUrl: string | undefined;
        if (topPoi.photos?.[0]?.name) {
          try {
            const photoRes = await fetch(
              `https://places.googleapis.com/v1/${topPoi.photos[0].name}/media?maxHeightPx=400&maxWidthPx=400&skipHttpRedirect=true&key=${GOOGLE_MAPS_API_KEY}`,
            );
            const photoData = await photoRes.json();
            photoUrl = photoData.photoUri;
          } catch {}
        }

        const reviews: PlaceReview[] = (topPoi.reviews || []).slice(0, 4).map((r: { authorAttribution?: { displayName?: string }; rating?: number; text?: { text?: string }; originalText?: { text?: string }; relativePublishTimeDescription?: string }) => ({
          author: r.authorAttribution?.displayName || "Gezgin",
          rating: r.rating || 5,
          text: r.text?.text || r.originalText?.text || "",
          relativeTime: r.relativePublishTimeDescription || "",
        }));

        const info: ClickedPlaceInfo = {
          name: topPoi.displayName?.text || "Seçilen Mekan",
          address: topPoi.formattedAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          category,
          lat: topPoi.location?.latitude || lat,
          lng: topPoi.location?.longitude || lng,
          rating: topPoi.rating || 4.8,
          userRatingsTotal: topPoi.userRatingCount || 150,
          photoUrl,
          isPoi: true,
          description: topPoi.editorialSummary?.text,
          reviews: reviews.length > 0 ? reviews : undefined,
        };

        setClickedPlace(info);
        setIsPopupExpanded(true);
        trainingService.recordMapInteraction({
          lat: info.lat,
          lng: info.lng,
          name: info.name,
          category: info.category,
          action: "map_click",
        });

        webViewRef.current?.injectJavaScript(`
          if (window.addTemporaryPin) {
            window.addTemporaryPin(${lat}, ${lng}, "${(topPoi.displayName?.text || "Mekan").replace(/"/g, "")}");
          }
          true;
        `);
        return;
      }

      // 2. Fallback: Google Reverse Geocode API for street/address
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&language=tr`;
      const geoRes = await fetch(geocodeUrl);
      const geoData = await geoRes.json();

      if (geoData.results && geoData.results.length > 0) {
        const first = geoData.results[0];
        const name =
          first.address_components?.[1]?.long_name ||
          first.address_components?.[0]?.long_name ||
          "İşaretlenen Konum";

        const info: ClickedPlaceInfo = {
          name,
          address: first.formatted_address,
          category: "MEKAN",
          lat,
          lng,
          rating: 4.8,
          isPoi: false,
        };

        setClickedPlace(info);
        setIsPopupExpanded(true);

        webViewRef.current?.injectJavaScript(`
          if (window.addTemporaryPin) {
            window.addTemporaryPin(${lat}, ${lng}, "${name.replace(/"/g, "")}");
          }
          true;
        `);
      } else {
        setClickedPlace({
          name: "Seçilen Nokta",
          address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          category: "MEKAN",
          lat,
          lng,
          isPoi: false,
        });
        setIsPopupExpanded(true);
      }
    } catch (err) {
      console.warn("Maps API click lookup error:", err);
      setClickedPlace({
        name: "Seçilen Nokta",
        address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        category: "MEKAN",
        lat,
        lng,
        isPoi: false,
      });
      setIsPopupExpanded(true);
    } finally {
      setIsLoadingPlace(false);
    }
  };

  // Handle WebView messages (pin clicks, map clicks, map ready)
  const handleWebViewMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "PIN_SELECT" && data.id) {
        const idx = filteredStops.findIndex((s) => s.id === data.id);
        if (idx >= 0) {
          const stop = filteredStops[idx];
          setCurrentStopIdx(idx);
          setClickedPlace(null);
          setIsPopupExpanded(true);
          stopsTrackScrollRef.current?.scrollTo({ x: idx * 48, animated: true });
          stopsCarouselRef.current?.scrollToOffset({
            offset: idx * (CARD_WIDTH + CARD_GAP),
            animated: true,
          });
          trainingService.recordMapInteraction({
            lat: stop.lat,
            lng: stop.lng,
            name: stop.name,
            category: stop.category,
            action: "pin_select",
          });
        }
      }

      if (data.type === "PIN_FOCUS" && data.id) {
        const idx = filteredStops.findIndex((s) => s.id === data.id);
        if (idx >= 0) {
          const stop = filteredStops[idx];
          setCurrentStopIdx(idx);
          setClickedPlace(null);
          setIsPopupExpanded(true);
          flyToStop(stop, 18);
          stopsTrackScrollRef.current?.scrollTo({ x: idx * 48, animated: true });
          stopsCarouselRef.current?.scrollToOffset({
            offset: idx * (CARD_WIDTH + CARD_GAP),
            animated: true,
          });
        }
      }

      if (data.type === "MAP_CLICK") {
        handleMapLocationClick(data.lat, data.lng);
      }

      if (data.type === "MAP_READY") {
        const stopsPayload = activeRoute.stops.map((s, idx) => ({
          id: s.id,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          category: s.category,
          index: idx + 1,
          isSelected: idx === currentStopIdx,
          visited: s.visited || false,
        }));
        webViewRef.current?.injectJavaScript(`
          if (window.updateMapStops) window.updateMapStops(${JSON.stringify(stopsPayload)});
          true;
        `);
      }

      if (data.type === "LOCATION_FOUND") {
        setMyLocation({ lat: data.lat, lng: data.lng });
      }

      if (data.type === "LOCATION_ERROR") {
        Alert.alert(
          "Konum İzni Gerekli",
          "Konumunuzu haritada gösterebilmek ve en yakın noktaları listelemek için lütfen Ayarlar'dan konum erişimine izin verin.",
        );
        setShowMyLocation(false);
      }
    } catch {}
  };

  // Google Maps Places Text Search
  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;

    try {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.location,places.rating,places.types,places.primaryTypeDisplayName,places.photos",
        },
        body: JSON.stringify({
          textQuery: q,
          languageCode: "tr",
        }),
      });
      const data = await res.json();

      if (data.places && data.places.length > 0) {
        const mapped = data.places.map((p: { displayName?: { text?: string }; formattedAddress?: string; location: { latitude: number; longitude: number }; rating?: number; primaryTypeDisplayName?: { text?: string }; types?: string[]; photos?: { name: string }[] }) => ({
          name: p.displayName?.text || "Mekan",
          formatted_address: p.formattedAddress,
          geometry: { location: { lat: p.location.latitude, lng: p.location.longitude } },
          rating: p.rating,
          category: p.primaryTypeDisplayName?.text || getCategoryFromTypes(p.types),
          photoUrl: p.photos?.[0]?.name
            ? `https://places.googleapis.com/v1/${p.photos[0].name}/media?maxHeightPx=600&maxWidthPx=800&key=${GOOGLE_MAPS_API_KEY}`
            : undefined,
        }));
        setSearchResults(mapped.slice(0, 6));
        setShowSearchResults(true);
        return;
      }
    } catch {}
    // Fallback preset places
    const presets: Record<string, { lat: number; lng: number; name: string }> = {
      ayasofya: { lat: 41.0086, lng: 28.9802, name: "Ayasofya" },
      sultanahmet: { lat: 41.0054, lng: 28.9768, name: "Sultanahmet" },
      galata: { lat: 41.0256, lng: 28.9741, name: "Galata Kulesi" },
      kapalıçarşı: { lat: 41.0108, lng: 28.968, name: "Kapalıçarşı" },
      topkapı: { lat: 41.0115, lng: 28.9833, name: "Topkapı Sarayı" },
    };
    const key = Object.keys(presets).find((k) => q.toLowerCase().includes(k));
    if (key) {
      const p = presets[key];
      webViewRef.current?.injectJavaScript(`
          if (window.map) window.map.flyTo([${p.lat}, ${p.lng}], 16, { animate: true, duration: 1.0 });
          true;
        `);
    } else {
      Alert.alert("Arama", `"${q}" konumuna odaklanıldı.`);
    }
  };

  // Add search result to active route
  const handleSelectSearchResult = (place: { name?: string; geometry?: { location?: { lat: number; lng: number } }; types?: string[]; formatted_address?: string; rating?: number }) => {
    const loc = place.geometry?.location;
    if (!loc) return;

    setShowSearchResults(false);
    setSearchQuery("");

    webViewRef.current?.injectJavaScript(`
      if (window.map) window.map.flyTo([${loc.lat}, ${loc.lng}], 17, { animate: true, duration: 1.0 });
      if (window.addTemporaryPin) window.addTemporaryPin(${loc.lat}, ${loc.lng}, "${place.name}");
      true;
    `);

    const newStop: TripStop = {
      id: `stop-${Date.now()}`,
      name: place.name || "İsimsiz",
      category: getCategoryFromTypes(place.types),
      time: "15:00",
      duration: "45 dk",
      address: place.formatted_address || place.name || "",
      lat: loc.lat,
      lng: loc.lng,
      rating: place.rating || 4.8,
      photoUrl: (place as { photoUrl?: string }).photoUrl,
      walkTimeFromPrev: "~8 dk yürüyüş",
      distanceFromPrev: "500m",
    };

    Alert.alert(place.name || "Mekan", place.formatted_address || "Rotanıza eklemek ister misiniz?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Rotaya Ekle",
        onPress: () => tripStore.addStop(newStop),
      },
    ]);
  };

  // Add clicked place to active route
  const handleAddClickedPlaceToRoute = () => {
    if (!clickedPlace) return;
    const newStop: TripStop = {
      id: `stop-${Date.now()}`,
      name: clickedPlace.name,
      category: clickedPlace.category,
      time: "15:30",
      duration: "45 dk",
      address: clickedPlace.address,
      lat: clickedPlace.lat,
      lng: clickedPlace.lng,
      rating: clickedPlace.rating || 4.8,
      photoUrl: clickedPlace.photoUrl,
      walkTimeFromPrev: "~6 dk yürüyüş",
      distanceFromPrev: "400m",
    };
    const wasPending = tripStore.getPendingAddStop();
    tripStore.addStop(newStop);
    trainingService.recordMapInteraction({
      lat: newStop.lat,
      lng: newStop.lng,
      name: newStop.name,
      category: newStop.category,
      action: "route_add",
    });
    tripStore.clearPendingAddStop();
    setIsPendingAddStop(false);
    setClickedPlace(null);

    if (wasPending) {
      Alert.alert("Durak Eklendi", `"${newStop.name}" seyahat rotanıza eklendi!`, [
        { text: "Haritada Kal", style: "cancel" },
        { text: "Plana Dön", onPress: onOpenPlan },
      ]);
    } else {
      Alert.alert("Başarılı", `"${newStop.name}" aktif rotanıza eklendi!`);
    }
  };

  // Step navigation (next / prev)
  const handleNextStop = () => {
    if (filteredStops.length === 0) return;
    const nextIdx = (currentStopIdx + 1) % filteredStops.length;
    setCurrentStopIdx(nextIdx);
    flyToStop(filteredStops[nextIdx]);
    setClickedPlace(null);
    stopsTrackScrollRef.current?.scrollTo({ x: nextIdx * 48, animated: true });
    stopsCarouselRef.current?.scrollToOffset({
      offset: nextIdx * (CARD_WIDTH + CARD_GAP),
      animated: true,
    });
  };

  const handlePrevStop = () => {
    if (filteredStops.length === 0) return;
    const prevIdx = (currentStopIdx - 1 + filteredStops.length) % filteredStops.length;
    setCurrentStopIdx(prevIdx);
    flyToStop(filteredStops[prevIdx]);
    setClickedPlace(null);
    stopsTrackScrollRef.current?.scrollTo({ x: prevIdx * 48, animated: true });
    stopsCarouselRef.current?.scrollToOffset({
      offset: prevIdx * (CARD_WIDTH + CARD_GAP),
      animated: true,
    });
  };

  const lastStopTapTime = useRef<{ [stopId: string]: number }>({});
  const stopTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flyToStop = (stop: TripStop, zoom = 16) => {
    webViewRef.current?.injectJavaScript(`
      if (window.map) window.map.flyTo([${stop.lat}, ${stop.lng}], ${zoom}, { animate: true, duration: 0.8 });
      true;
    `);
  };

  const handleStopPress = (stop: TripStop, sIdx: number) => {
    const now = Date.now();
    const lastTime = lastStopTapTime.current[stop.id] || 0;

    if (now - lastTime < 350) {
      // İki kere tıklama -> Konuma odaklan (zoom 18)
      if (stopTapTimer.current) {
        clearTimeout(stopTapTimer.current);
        stopTapTimer.current = null;
      }
      lastStopTapTime.current[stop.id] = 0;
      setCurrentStopIdx(sIdx);
      flyToStop(stop, 18);
      setIsPopupExpanded(true);
    } else {
      lastStopTapTime.current[stop.id] = now;
      stopTapTimer.current = setTimeout(() => {
        // Tek tıklama -> Konumu aç ve detay kartını göster
        setCurrentStopIdx(sIdx);
        flyToStop(stop, 16);
        setIsPopupExpanded(true);
        stopsCarouselRef.current?.scrollToOffset({
          offset: sIdx * (CARD_WIDTH + CARD_GAP),
          animated: true,
        });
        stopsTrackScrollRef.current?.scrollTo({ x: sIdx * 48, animated: true });
      }, 250);
    }
  };

  // Launch navigation - Ask user which map application to open
  const handleStartDirections = (lat?: number, lng?: number, name?: string) => {
    const targetLat = lat || currentStop?.lat;
    const targetLng = lng || currentStop?.lng;
    const targetName = name || currentStop?.name || "Seçilen Durak";
    if (!targetLat || !targetLng) return;

    Alert.alert(
      "Yol Tarifi - Harita Seçin",
      `"${targetName}" konumuna gitmek için hangi haritayı kullanmak istersiniz?`,
      [
        {
          text: "Google Haritalar",
          onPress: () => {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}&travelmode=walking`;
            Linking.openURL(url).catch(() => Alert.alert("Hata", "Google Haritalar açılamadı."));
          },
        },
        {
          text: "Apple Haritalar",
          onPress: () => {
            const url = `http://maps.apple.com/?daddr=${targetLat},${targetLng}&q=${encodeURIComponent(targetName)}`;
            Linking.openURL(url).catch(() => Alert.alert("Hata", "Apple Haritalar açılamadı."));
          },
        },
        {
          text: "Yandex Haritalar",
          onPress: () => {
            const naviUrl = `yandexnavi://build_route_on_map?lat_to=${targetLat}&lon_to=${targetLng}`;
            Linking.openURL(naviUrl).catch(() => {
              Linking.openURL(`https://yandex.com.tr/harita/?rtext=~${targetLat},${targetLng}`);
            });
          },
        },
        {
          text: "Uygulama İçi Canlı Rota",
          onPress: () => {
            webViewRef.current?.injectJavaScript(`
              if (window.map) {
                window.map.flyTo([${targetLat}, ${targetLng}], 18, { animate: true, duration: 0.8 });
              }
              true;
            `);
          },
        },
        { text: "Vazgeç", style: "cancel" },
      ],
    );
  };

  // Share Modal Opener for QR, Transit and Navigation
  const handleShare = (target?: { name: string; address: string; lat: number; lng: number }) => {
    const toShare =
      target ||
      (currentStop
        ? {
            name: currentStop.name,
            address: currentStop.address,
            lat: currentStop.lat,
            lng: currentStop.lng,
          }
        : null);
    if (toShare) {
      setShareTarget(toShare);
    }
  };

  // Select map tiles directly (light, dark, satellite)
  const handleSelectTileLayer = (layerKey: "light" | "dark" | "satellite") => {
    setActiveTileLayer(layerKey);
    webViewRef.current?.injectJavaScript(`
      if (window.switchLayer) window.switchLayer("${layerKey}");
      true;
    `);
  };

  // Toggle map tiles (light, dark, satellite)
  const _handleToggleLayers = () => {
    const next =
      activeTileLayer === "light" ? "dark" : activeTileLayer === "dark" ? "satellite" : "light";
    handleSelectTileLayer(next);
  };

  // Recenter to user's location or route center
  const _handleMyLocation = () => {
    if (currentStop) {
      flyToStop(currentStop);
    } else {
      webViewRef.current?.injectJavaScript(`
        if (window.fitAllStops) window.fitAllStops();
        true;
      `);
    }
  };

  // Initial stops payload for immediate injection
  const initialStopsJson = JSON.stringify(
    activeRoute.stops.map((s, idx) => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      category: s.category,
      index: idx + 1,
      isSelected: s.id === currentStop?.id,
      visited: s.visited || false,
    })),
  );

  // High-performance Leaflet HTML with click-to-query integration
  const leafletHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body, #map { width: 100%; height: 100%; background: ${tokens.color.surfaceBrand}; }
          .leaflet-control-attribution, .leaflet-control-zoom { display: none !important; }
          .stop-pin { display: flex; flex-direction: column; align-items: center; cursor: pointer; }
          .stop-pin-circle {
            width: 34px; height: 34px; border-radius: 17px;
            background: ${tokens.color.surface}; border: 2.5px solid ${tokens.color.primary};
            color: ${tokens.color.textBrand}; font-family: -apple-system, sans-serif;
            font-size: 13px; font-weight: 800;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 3px 10px ${withAlpha(tokens.color.primary, 0.25)};
            transition: all 0.2s ease;
          }
          .stop-pin-label {
            margin-top: 3px; padding: 2px 8px; border-radius: 999px;
            background: ${withAlpha(tokens.color.surface, 0.95)}; color: ${tokens.color.text};
            font-size: 10px; font-weight: 700; white-space: nowrap;
            box-shadow: 0 2px 6px ${withAlpha(tokens.color.black, 0.12)};
          }
          .active-stop-pin .stop-pin-circle {
            width: 40px; height: 40px; border-radius: 20px;
            background: ${tokens.color.primary}; color: ${tokens.color.onPrimary};
            border: 2.5px solid ${tokens.color.accentStrong};
            box-shadow: 0 0 0 8px ${withAlpha(tokens.color.accentStrong, 0.25)}, 0 6px 16px ${withAlpha(tokens.color.primary, 0.35)};
            transform: scale(1.1);
          }
          .active-stop-pin .stop-pin-label {
            background: ${tokens.color.primary}; color: ${tokens.color.onPrimary};
          }
          .visited-badge {
            position: absolute; top: -3px; right: -3px;
            width: 14px; height: 14px; border-radius: 7px;
            background: ${tokens.color.accent}; color: white; font-size: 9px;
            display: flex; align-items: center; justify-content: center;
            border: 1.5px solid white;
          }
          .temp-pin .stop-pin-circle {
            background: ${tokens.color.accent}; color: white; border-color: ${tokens.color.primary};
            box-shadow: 0 0 0 8px ${withAlpha(tokens.color.accent, 0.35)};
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          window.INIT_STOPS = ${initialStopsJson};

          var map, currentTile, markersGroup, polylineLayer, tempMarker;
          var allLatLngs = [];
          var tileLayers = {};

          function initMap() {
            if (typeof L === 'undefined') {
              setTimeout(initMap, 50);
              return;
            }

            try {
              map = L.map('map', {
                zoomControl: false,
                attributionControl: false,
              }).setView([41.0082, 28.9784], 14);
              window.map = map;

              tileLayers = {
                light: L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=tr', {
                  maxZoom: 20,
                  subdomains: ['0', '1', '2', '3']
                }),
                dark: L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=tr', {
                  maxZoom: 20,
                  subdomains: ['0', '1', '2', '3']
                }),
                satellite: L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=tr', {
                  maxZoom: 20,
                  subdomains: ['0', '1', '2', '3']
                })
              };

              currentTile = tileLayers.light.addTo(map);
              markersGroup = L.layerGroup().addTo(map);

              // Map Click Listener -> Send coordinates to React Native for Google Maps API query
              map.on('click', function(e) {
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'MAP_CLICK',
                    lat: e.latlng.lat,
                    lng: e.latlng.lng
                  }));
                }
              });

              window.switchLayer = function(layerKey) {
                if (tileLayers[layerKey]) {
                  map.removeLayer(currentTile);
                  currentTile = tileLayers[layerKey].addTo(map);
                }
              };

              window.updateMapStops = function(stops) {
                if (!map || !markersGroup) return;
                markersGroup.clearLayers();
                allLatLngs = [];
                if (!stops || stops.length === 0) return;

                stops.forEach(function(s) {
                  allLatLngs.push([s.lat, s.lng]);
                  var isSel = s.isSelected;
                  var html = '<div class="stop-pin ' + (isSel ? 'active-stop-pin' : '') + '">' +
                    '<div style="position:relative;">' +
                      '<div class="stop-pin-circle">' + s.index + '</div>' +
                      (s.visited ? '<div class="visited-badge">✓</div>' : '') +
                    '</div>' +
                    '<div class="stop-pin-label">' + s.name + '</div>' +
                  '</div>';

                  var icon = L.divIcon({ className: '', html: html, iconSize: [90, 56], iconAnchor: [45, 20] });
                  var m = L.marker([s.lat, s.lng], { icon: icon }).addTo(markersGroup);
                  var lastMarkerClick = 0;
                  var markerClickTimer = null;

                  m.on('click', function(e) {
                    L.DomEvent.stopPropagation(e);
                    var currentTime = Date.now();
                    if (currentTime - lastMarkerClick < 350) {
                      // İki kere tıklama -> Konuma odaklan (zoom 18)
                      if (markerClickTimer) {
                        clearTimeout(markerClickTimer);
                        markerClickTimer = null;
                      }
                      lastMarkerClick = 0;
                      map.flyTo([s.lat, s.lng], 18, { animate: true, duration: 0.8 });
                      if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PIN_FOCUS', id: s.id }));
                      }
                    } else {
                      lastMarkerClick = currentTime;
                      markerClickTimer = setTimeout(function() {
                        // Tek tıklama -> Konumu aç ve detaylarını getir
                        map.panTo([s.lat, s.lng], { animate: true, duration: 0.5 });
                        if (window.ReactNativeWebView) {
                          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PIN_SELECT', id: s.id }));
                        }
                      }, 250);
                    }
                  });

                  m.on('dblclick', function(e) {
                    L.DomEvent.stopPropagation(e);
                    if (markerClickTimer) {
                      clearTimeout(markerClickTimer);
                      markerClickTimer = null;
                    }
                    map.flyTo([s.lat, s.lng], 18, { animate: true, duration: 0.8 });
                    if (window.ReactNativeWebView) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PIN_FOCUS', id: s.id }));
                    }
                  });

                  if (isSel) {
                    map.panTo([s.lat, s.lng], { animate: true, duration: 0.6 });
                  }
                });

                if (polylineLayer) map.removeLayer(polylineLayer);
                if (allLatLngs.length > 1) {
                  // Pre-draw dashed line
                  polylineLayer = L.polyline(allLatLngs, {
                    color: '${tokens.color.successStrong}', weight: 4, dashArray: '6, 6',
                    opacity: 0.6, lineCap: 'round', lineJoin: 'round'
                  }).addTo(map);

                  // Follow real streets and roads via OSRM walking router
                  try {
                    var osrmCoords = stops.map(function(st) { return st.lng + ',' + st.lat; }).join(';');
                    fetch('https://router.project-osrm.org/route/v1/walking/' + osrmCoords + '?overview=full&geometries=geojson')
                      .then(function(res) { return res.json(); })
                      .then(function(data) {
                        if (data && data.routes && data.routes.length > 0 && data.routes[0].geometry) {
                          var coords = data.routes[0].geometry.coordinates;
                          var roadLatLngs = coords.map(function(c) { return [c[1], c[0]]; });
                          if (polylineLayer) map.removeLayer(polylineLayer);
                          polylineLayer = L.polyline(roadLatLngs, {
                            color: '${tokens.color.successStrong}', weight: 5,
                            opacity: 0.95, lineCap: 'round', lineJoin: 'round'
                          }).addTo(map);
                        }
                      })
                      .catch(function(err) {});
                  } catch(e) {}
                }
              };

              window.fitAllStops = function() {
                if (map && allLatLngs.length > 0) {
                  map.fitBounds(L.latLngBounds(allLatLngs), { padding: [60, 60] });
                }
              };

              window.addTemporaryPin = function(lat, lng, label) {
                if (!map) return;
                if (tempMarker) map.removeLayer(tempMarker);
                var icon = L.divIcon({
                  className: '',
                  html: '<div class="stop-pin temp-pin"><div class="stop-pin-circle"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${tokens.color.onPrimary}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div><div class="stop-pin-label">' + label + '</div></div>',
                  iconSize: [90, 56], iconAnchor: [45, 20]
                });
                tempMarker = L.marker([lat, lng], { icon: icon }).addTo(map);
                map.panTo([lat, lng], { animate: true, duration: 0.6 });
              };

              // User location marker
              var userLocationMarker = null;
              var userLocationAccuracy = null;
              window.updateUserLocation = function(lat, lng, accuracy) {
                if (!map) return;
                if (userLocationMarker) {
                  userLocationMarker.setLatLng([lat, lng]);
                } else {
                  var userIcon = L.divIcon({
                    className: '',
                    html: '<div style="width:20px;height:20px;background:${tokens.color.infoIcon};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px ${withAlpha(tokens.color.infoIcon, 0.5)};"></div>',
                    iconSize: [20, 20], iconAnchor: [10, 10]
                  });
                  userLocationMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
                }
                if (accuracy) {
                  if (userLocationAccuracy) map.removeLayer(userLocationAccuracy);
                  userLocationAccuracy = L.circle([lat, lng], {
                    radius: accuracy,
                    color: '${tokens.color.infoIcon}',
                    fillColor: '${tokens.color.infoIcon}',
                    fillOpacity: 0.15,
                    weight: 1
                  }).addTo(map);
                }
              };

              // Request user location with native geolocation
              window.requestUserLocation = function() {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    function(pos) {
                      var lat = pos.coords.latitude;
                      var lng = pos.coords.longitude;
                      var acc = pos.coords.accuracy;
                      if (window.updateUserLocation) {
                        window.updateUserLocation(lat, lng, acc);
                      }
                      if (map) {
                        map.panTo([lat, lng], { animate: true, duration: 0.8 });
                      }
                      if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'LOCATION_FOUND',
                          lat: lat,
                          lng: lng,
                          accuracy: acc
                        }));
                      }
                    },
                    function(err) {
                      if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'LOCATION_ERROR',
                          message: err ? err.message : 'Konum alınamadı'
                        }));
                      }
                    },
                    { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
                  );
                } else {
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'LOCATION_ERROR',
                      message: 'Konum desteği bulunamadı'
                    }));
                  }
                }
              };

              // Toggle route lines visibility
              window.toggleRouteLines = function(show) {
                if (polylineLayer) {
                  if (show) {
                    map.addLayer(polylineLayer);
                  } else {
                    map.removeLayer(polylineLayer);
                  }
                }
              };

              // Update route lines with road-based routing (using Google Directions API would require server)
              window.updateRouteLines = function(useRoadRouting) {
                if (polylineLayer) map.removeLayer(polylineLayer);
                if (allLatLngs.length > 1) {
                  if (useRoadRouting) {
                    // Road-based routing: use dashed line for visual indication
                    polylineLayer = L.polyline(allLatLngs, {
                      color: '${tokens.color.accent}', weight: 5, dashArray: '12, 8',
                      opacity: 0.85, lineCap: 'round', lineJoin: 'round'
                    }).addTo(map);
                  } else {
                    // Straight lines (default)
                    polylineLayer = L.polyline(allLatLngs, {
                      color: '${tokens.color.accent}', weight: 4, dashArray: '8, 6',
                      opacity: 0.9, lineCap: 'round', lineJoin: 'round'
                    }).addTo(map);
                  }
                }
              };

              // Immediately plot stops
              if (window.INIT_STOPS && window.INIT_STOPS.length > 0) {
                window.updateMapStops(window.INIT_STOPS);
                window.fitAllStops();
              }

              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
              }
            } catch (err) {}
          }

          if (document.readyState === 'complete' || document.readyState === 'interactive') {
            initMap();
          } else {
            window.addEventListener('DOMContentLoaded', initMap);
          }
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      {/* Full-Screen Map Canvas */}
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: leafletHtml, baseUrl: "https://unpkg.com" }}
        style={styles.fullMap}
        accessible={true}
        accessibilityLabel={mapLabel(filteredStops.length)}
        importantForAccessibility="no-hide-descendants"
        onMessage={handleWebViewMessage}
        scrollEnabled={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        geolocationEnabled={true}
      />
      <AccessibleStopList
        day={activeRoute.day}
        stops={filteredStops}
        onSelectStop={(_, i) => handleStopPress(filteredStops[i], i)}
      />

      {/* Top Floating Area: Clean Search (Stitch Screen 5) */}
      <SafeArea style={styles.topFloatingArea}>
        {/* Floating Search Pill - Improved padding */}
        <View style={[styles.searchRow, { paddingHorizontal: 20 }]}>
          <View style={[styles.searchPill, { marginHorizontal: 0 }]}>
            <View style={{ marginRight: 8 }}>
              <SearchIcon size={16} color={tokens.color.successStrong} />
            </View>
            <TextInput
              placeholder="İl, ilçe, mekan ara..."
              placeholderTextColor={tokens.color.textSubtle}
              style={[styles.searchInput, { paddingHorizontal: 8 }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={{ padding: 6 }}
                onPress={() => {
                  setSearchQuery("");
                  setShowSearchResults(false);
                }}
              >
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ fontSize: 13, color: tokens.color.textSubtle }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Durak Seçim Modu Floating Banner (Plan ekranından 'Durak Ekle' tıklandığında görünür) */}
        {isPendingAddStop && (
          <View style={styles.pendingAddStopBanner}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={styles.pulsingDot} />
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.pendingAddStopText} numberOfLines={1}>
                📍 Haritada eklemek istediğiniz mekana dokunun
              </Text>
            </View>
            <TouchableOpacity
              style={styles.pendingAddStopCancelBtn}
              onPress={() => {
                tripStore.clearPendingAddStop();
                setIsPendingAddStop(false);
              }}
              activeOpacity={0.7}
            >
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.pendingAddStopCancelText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeArea>

      {/* Autocomplete Search Results Overlay */}
      {showSearchResults && (
        <View style={styles.searchResultsOverlay}>
          <ScrollView style={styles.searchResultsScroll}>
            {searchResults.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.searchResultItem}
                onPress={() => handleSelectSearchResult(item)}
              >
                <View style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.searchResultName}>{item.name}</Text>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.searchResultAddr} numberOfLines={1}>
                    {item.formatted_address}
                  </Text>
                </View>
                {item.rating && <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.searchResultRating}>★ {item.rating}</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Left Floating Route Overview Pill - Removed per request */}

      {/* Right Floating Controls (Map Settings & My Location) */}
      <View style={styles.rightFloatingControls}>
        {/* Map Settings Button */}
        <TouchableOpacity
          style={[
            styles.floatingControlBtn,
            showMapSettingsModal && styles.floatingControlBtnActive,
          ]}
          onPress={() => setShowMapSettingsModal(true)}
          activeOpacity={0.8}
        >
          <SettingsIcon size={18} color={tokens.color.textBrand} />
        </TouchableOpacity>

        {/* My Location Button */}
        <TouchableOpacity
          style={[styles.floatingControlBtn, showMyLocation && styles.floatingControlBtnActive]}
          onPress={toggleLocationTracking}
          activeOpacity={0.8}
        >
          {showMyLocation && <View style={styles.gpsPulseDot} />}
          <Text maxFontSizeMultiplier={tokens.font.maxScale.body}
            style={[
              styles.floatingControlIcon,
              showMyLocation && { color: tokens.color.textBrand, fontWeight: "900" },
            ]}
          >
            ⌖
          </Text>
        </TouchableOpacity>
      </View>

      {/* Loading Indicator for Google Maps POI Query */}
      {isLoadingPlace && (
        <View style={styles.poiLoadingPill}>
          <ActivityIndicator size="small" color={tokens.color.accent} />
          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.poiLoadingText}>Mekan bilgisi alınıyor...</Text>
        </View>
      )}

      {/* Bottom Sheet: Draggable from ANY point to smoothly expand / collapse */}
      <View
        {...panResponder.panHandlers}
        style={[
          styles.bottomSheetContainer,
          !isPopupExpanded && styles.bottomSheetContainerCollapsed,
        ]}
      >
        {/* Drag Handle Bar (Aşağı/Yukarı Kaydırarak Büyüt/Küçült ya da Dokunarak Aç/Kapa) */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setIsPopupExpanded((prev) => !prev)}
          style={styles.dragHandleTouchArea}
        >
          <View style={styles.dragHandle} />
        </TouchableOpacity>

        {/* If user clicked a place on the map: Show Google Places Details */}
        {clickedPlace ? (
          !isPopupExpanded ? (
            /* Collapsed Clicked Place Capsule */
            <View style={styles.collapsedRow} {...panResponder.panHandlers}>
              <View
                style={{
                  flex: 1,
                  marginRight: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <MapPinIcon size={15} color={tokens.color.successStrong} />
                <View style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.collapsedTitle} numberOfLines={1}>
                    {clickedPlace.name}
                  </Text>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.collapsedSub} numberOfLines={1}>
                    {clickedPlace.category} • ★ {clickedPlace.rating || 4.8}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.collapsedActionPill}
                onPress={handleAddClickedPlaceToRoute}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <PlusIcon size={12} color={tokens.color.onPrimary} />
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.collapsedActionPillText}>Ekle</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.collapsedActionPill, { backgroundColor: tokens.color.surfaceBrand }]}
                onPress={() => setShareTarget(clickedPlace)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Share2Icon size={12} color={tokens.color.textBrand} />
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={[styles.collapsedActionPillText, { color: tokens.color.textBrand }]}>Paylaş</Text>
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            /* Expanded Clicked Place Card */
            <View style={styles.cardContent}>
              {/* Clicked Place Top Header Bar with Live Indicator & Actions */}
              <View style={styles.clickedPlaceTopRow}>
                <View style={styles.liveIndicatorRow}>
                  <View style={styles.pulsingDot} />
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.cardHeaderTitle}>HARİTADAN SEÇİLEN MEKAN</Text>
                </View>

                <View style={styles.clickedPlaceHeaderRightActions}>
                  <TouchableOpacity
                    style={styles.aiAskButtonPill}
                    onPress={() => {
                      setClickedPlace(null);
                      onOpenAi?.();
                    }}
                    activeOpacity={0.8}
                  >
                    <RobotIcon size={13} color={tokens.color.onPrimary} />
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.aiAskButtonText}>AI Sor</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.closeCircleBtn}
                    onPress={() => setClickedPlace(null)}
                    activeOpacity={0.7}
                  >
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.closeCircleBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.stopCardMain}>
                <View style={{ flex: 1 }}>
                  <View style={styles.categoryRatingRow}>
                    <View style={styles.categoryPill}>
                      <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.categoryPillText}>{clickedPlace.category}</Text>
                    </View>
                    {clickedPlace.rating && (
                      <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.ratingBadge}>
                        ★ {clickedPlace.rating} ({clickedPlace.userRatingsTotal || 120})
                      </Text>
                    )}
                  </View>

                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.stopTitle} numberOfLines={1}>
                    {clickedPlace.name}
                  </Text>
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}
                  >
                    <PinIcon size={12} color={tokens.color.accent} />
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.stopAddress} numberOfLines={2}>
                      {clickedPlace.address}
                    </Text>
                  </View>
                </View>

                {clickedPlace.photoUrl ? (
                  <Image
                    source={{ uri: clickedPlace.photoUrl }}
                    style={styles.stopThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.stopThumb, styles.stopThumbFallback]}>
                    <PinIcon size={24} color={tokens.color.accent} />
                  </View>
                )}
              </View>

              {/* Mekan Hakkında Detaylı Bilgi & Açıklama */}
              {clickedPlace.description ? (
                <View style={styles.placeDescBox}>
                  <View style={styles.placeDescTitleRow}>
                    <View style={{ marginRight: 5 }}>
                      <MonumentIcon size={13} color={tokens.color.textBrand} />
                    </View>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.placeDescLabel}>MEKAN HAKKINDA</Text>
                  </View>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.placeDescText}>{clickedPlace.description}</Text>
                </View>
              ) : null}

              {/* Gerçek Gezgin Yorumları */}
              {clickedPlace.reviews && clickedPlace.reviews.length > 0 ? (
                <View style={styles.reviewsBox}>
                  <View style={styles.reviewsBoxTitleRow}>
                    <View style={{ marginRight: 5 }}>
                      <ChatIcon size={13} color={tokens.color.textBrand} />
                    </View>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.reviewsBoxHeader}>GEZGİN YORUMLARI</Text>
                  </View>
                  <ScrollView
                    style={styles.reviewsScroll}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                  >
                    {clickedPlace.reviews.map((rev, rIdx) => (
                      <View key={rIdx} style={styles.reviewItem}>
                        <View style={styles.reviewItemHeader}>
                          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.reviewAuthor}>{rev.author}</Text>
                          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.reviewRating}>
                            {"★".repeat(Math.min(5, Math.max(1, Math.round(rev.rating))))}{" "}
                            {rev.relativeTime}
                          </Text>
                        </View>
                        <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.reviewText} numberOfLines={3}>
                          {rev.text}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {/* Clicked Place Actions: Sadece Rotaya Ekle ve QR/Yol Tarifi Paylaş */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={handleAddClickedPlaceToRoute}
                  activeOpacity={0.85}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <PlusIcon size={15} color={tokens.color.onPrimary} />
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.primaryActionBtnText}>Bu Mekanı Rotaya Ekle</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareActionBtn}
                  onPress={() => setShareTarget(clickedPlace)}
                  activeOpacity={0.85}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <QrCodeIcon size={15} color={tokens.color.textBrand} />
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.shareActionBtnText}>QR Kod & Yol Tarifi Paylaş</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )
        ) : !activeRoute || activeRoute.stops.length === 0 ? (
          /* NO ROUTE EMPTY STATE (Hemen Rotanı Planla CTA) */
          !isPopupExpanded ? (
            <View style={styles.collapsedRow}>
              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  marginRight: 8,
                }}
              >
                <View style={styles.emptyCollapsedIconWrap}>
                  <PlanIcon size={18} color={tokens.color.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.collapsedTitle} numberOfLines={1}>
                    Henüz Rota Bulunmuyor
                  </Text>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.collapsedSub} numberOfLines={1}>
                    Yeni seyahat rotanı hemen oluştur
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.emptyPlanCtaBtn}
                onPress={() => onOpenPlan?.()}
                activeOpacity={0.8}
              >
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.emptyPlanCtaBtnText}>Hemen Rotanı Planla</Text>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ color: tokens.color.onPrimary, fontSize: 13, fontWeight: "800" }}>➔</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyRouteExpandedCard}>
              <View style={styles.emptyRouteExpandedIconCircle}>
                <PlanIcon size={30} color={tokens.color.accent} />
              </View>
              <View style={styles.emptyRouteBadgeRow}>
                <View style={styles.pulsingDot} />
                <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.emptyRouteBadgeText}>YENİ SEYAHAT PLANI</Text>
              </View>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.emptyRouteExpandedTitle}>Seyahat Rotanı Başlat</Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.emptyRouteExpandedSubtitle}>
                Haritada henüz aktif bir rota bulunmuyor. İster AI asistan ile ister adım adım
                duraklarını ekleyerek mükemmel seyahatini planla.
              </Text>
              <TouchableOpacity
                style={styles.emptyRouteExpandedPrimaryBtn}
                onPress={() => onOpenPlan?.()}
                activeOpacity={0.85}
              >
                <SparkIcon size={18} color={tokens.color.onPrimary} />
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.emptyRouteExpandedPrimaryBtnText}>Hemen Rotanı Planla</Text>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ color: tokens.color.onPrimary, fontSize: 15, fontWeight: "900" }}>➔</Text>
              </TouchableOpacity>
              <View style={styles.emptyRouteHintRow}>
                <LightbulbIcon size={14} color={tokens.color.warningStrong} />
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.emptyRouteHintText}>
                  İpucu: Haritada herhangi bir mekana dokunarak da ilk durağını ekleyebilirsin.
                </Text>
              </View>
            </View>
          )
        ) : /* Active Route Stops */
        !isPopupExpanded ? (
          /* Collapsed Route Stop Capsule */
          <View style={styles.collapsedRow}>
            <View style={styles.collapsedStopBadge}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.collapsedStopBadgeText}>{currentStopIdx + 1}</Text>
            </View>
            <View style={{ flex: 1, marginHorizontal: 8 }}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.collapsedTitle} numberOfLines={1}>
                {currentStop?.name || "Durak"}
              </Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.collapsedSub} numberOfLines={1}>
                {currentStop?.walkTimeFromPrev || "~4 dk"} •{" "}
                {currentStop?.distanceFromPrev || "320m"}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.collapsedNavPill}
              onPress={() => handleStartDirections()}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <DirectionsIcon size={13} color={tokens.color.onPrimary} />
                <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.collapsedNavPillText}>Yol Tarifi</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.collapsedArrowBtn} onPress={handleNextStop}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.collapsedArrowBtnText}>›</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Expanded Route Stop Card with Horizontal Swipeable Carousel */
          <View style={styles.cardContent}>
            {/* Route Header Status Banner & Route Selector Dropdown */}
            <View style={styles.routeHeaderBanner}>
              <TouchableOpacity
                style={styles.routeSelectorBtn}
                onPress={() => setShowRouteModal(true)}
                activeOpacity={0.8}
              >
                <View style={styles.pulsingDot} />
                <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.routeHeaderTitle} numberOfLines={1}>
                  {activeRoute.name} • 1. Gün
                </Text>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ fontSize: 12, color: tokens.color.link }}>▼</Text>
              </TouchableOpacity>

              <View style={styles.stopsCountBadge}>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.stopsCountText}>{activeRoute.stops.length} Durak</Text>
              </View>
            </View>

            {/* Route Stepper Track: 1 - 2 - 3 - 4 - 5 with Prev / Next Buttons */}
            <View style={styles.routeStepperRow}>
              <TouchableOpacity
                style={styles.stepperArrowBtn}
                onPress={handlePrevStop}
                activeOpacity={0.7}
              >
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.stepperArrowText}>◀</Text>
              </TouchableOpacity>

              <ScrollView
                ref={stopsTrackScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.stepperScrollTrack}
              >
                {filteredStops.map((stop, sIdx) => {
                  const isCurrent = sIdx === currentStopIdx;
                  return (
                    <TouchableOpacity
                      key={stop.id}
                      style={[styles.stepCirclePill, isCurrent && styles.stepCirclePillActive]}
                      onPress={() => {
                        handleStopPress(stop, sIdx);
                        stopsCarouselRef.current?.scrollToOffset({
                          offset: sIdx * (CARD_WIDTH + CARD_GAP),
                          animated: true,
                        });
                      }}
                    >
                      <Text maxFontSizeMultiplier={tokens.font.maxScale.body}
                        style={[styles.stepCircleText, isCurrent && styles.stepCircleTextActive]}
                      >
                        {sIdx + 1}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={styles.stepperArrowBtn}
                onPress={handleNextStop}
                activeOpacity={0.7}
              >
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.stepperArrowText}>▶</Text>
              </TouchableOpacity>
            </View>

            {/* Horizontal Swipeable Stop Cards Carousel (Sağa Sola Kaydırmalı) */}
            <FlatList<TripStop>
              ref={stopsCarouselRef}
              data={filteredStops}
              keyExtractor={(item: TripStop) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + CARD_GAP}
              decelerationRate="fast"
              contentContainerStyle={styles.carouselContainer}
              getItemLayout={(_, index) => ({
                length: CARD_WIDTH + CARD_GAP,
                offset: (CARD_WIDTH + CARD_GAP) * index,
                index,
              })}
              onMomentumScrollEnd={(e) => {
                const offsetX = e.nativeEvent.contentOffset.x;
                const newIdx = Math.max(
                  0,
                  Math.min(filteredStops.length - 1, Math.round(offsetX / (CARD_WIDTH + CARD_GAP))),
                );
                if (newIdx !== currentStopIdx) {
                  setCurrentStopIdx(newIdx);
                  flyToStop(filteredStops[newIdx]);
                  stopsTrackScrollRef.current?.scrollTo({ x: newIdx * 48, animated: true });
                }
              }}
              renderItem={({ item: stop, index: sIdx }: { item: TripStop; index: number }) => {
                return (
                  <TouchableOpacity
                    activeOpacity={0.96}
                    onPress={() => handleStopPress(stop, sIdx)}
                    style={[styles.stopCarouselCard, { width: CARD_WIDTH, marginRight: CARD_GAP }]}
                  >
                    {/* Stop Card Main */}
                    <View style={styles.stopCardMain}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.categoryRatingRow}>
                          <View style={styles.categoryPill}>
                            <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.categoryPillText}>
                              {sIdx + 1}. DURAK • {stop.category}
                            </Text>
                          </View>
                          <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.ratingBadge}>★ {stop.rating || 4.8}</Text>
                        </View>

                        <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.stopTitle} numberOfLines={1}>
                          {stop.name}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            marginTop: 3,
                          }}
                        >
                          <MapPinIcon size={12} color={tokens.color.successStrong} />
                          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.stopAddress} numberOfLines={1}>
                            {stop.address}
                          </Text>
                        </View>
                      </View>

                      {stop.photoUrl ? (
                        <Image
                          source={{ uri: stop.photoUrl }}
                          style={styles.stopThumb}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.stopThumb, styles.stopThumbFallback]}>
                          <MonumentIcon size={24} color={tokens.color.successStrong} />
                        </View>
                      )}
                    </View>

                    {/* Walking & Timing Micro-stats */}
                    <View style={styles.microStatsCard}>
                      <View style={styles.microStatItem}>
                        <View style={styles.microStatIconBox}>
                          <WalkIcon size={14} color={tokens.color.successStrong} />
                        </View>
                        <View>
                          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.microStatTitle}>
                            {stop.walkTimeFromPrev || "~4 dk yürüyüş"}
                          </Text>
                          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.microStatSub}>
                            {stop.distanceFromPrev || "320m"} mesafe
                          </Text>
                        </View>
                      </View>

                      <View style={styles.microStatDivider} />

                      <View style={styles.microStatItem}>
                        <View style={styles.microStatIconBox}>
                          <ClockIcon size={14} color={tokens.color.successStrong} />
                        </View>
                        <View>
                          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.microStatTitle}>Tahmini süre: {stop.duration}</Text>
                          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.microStatSub}>İdeal gezi payı</Text>
                        </View>
                      </View>
                    </View>

                    {/* Traveler Pro-Tip Delight Note */}
                    {stop.notes && (
                      <View style={styles.travelerNoteBox}>
                        <View style={{ marginRight: 6, marginTop: 2 }}>
                          <LightbulbIcon size={14} color={tokens.color.warningStrong} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.travelerNoteLabel}>GEZGİN NOTU</Text>
                          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.travelerNoteText} numberOfLines={2}>
                            {stop.notes}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Action CTAs */}
                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={styles.primaryActionBtn}
                        onPress={() => handleStartDirections(stop.lat, stop.lng, stop.name)}
                        activeOpacity={0.88}
                      >
                        <DirectionsIcon size={14} color={tokens.color.onPrimary} />
                        <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.primaryActionBtnText}>Yol Tarifi Başlat</Text>
                        <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ fontSize: 14, color: tokens.color.onPrimary }}>➔</Text>
                      </TouchableOpacity>

                      <View style={styles.secondaryActionsSplit}>
                        <TouchableOpacity
                          style={[styles.secondaryBtn, stop.visited && styles.visitedBtnActive]}
                          onPress={() => tripStore.toggleVisited(stop.id)}
                        >
                          <Text maxFontSizeMultiplier={tokens.font.maxScale.body}
                            style={[
                              styles.secondaryBtnText,
                              stop.visited && { color: tokens.color.textBrand, fontWeight: "800" },
                            ]}
                          >
                            {stop.visited ? "✓ Tamamlandı" : "○ Ziyaret Edildi"}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.secondaryBtn,
                            { flexDirection: "row", alignItems: "center", gap: 4 },
                          ]}
                          onPress={() =>
                            handleShare({
                              name: stop.name,
                              address: stop.address,
                              lat: stop.lat,
                              lng: stop.lng,
                            })
                          }
                        >
                          <Share2Icon size={12} color={tokens.color.link} />
                          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.secondaryBtnText}>Paylaş & QR</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.secondaryBtn,
                            { flexDirection: "row", alignItems: "center", gap: 4 },
                          ]}
                          onPress={onOpenPlan}
                        >
                          <PlanIcon size={12} color={tokens.color.link} />
                          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.secondaryBtnText}>Plan</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}
      </View>

      {/* Route Switcher Modal */}
      <Modal visible={showRouteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalTitle}>Rotayı Değiştir</Text>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalSub}>Haritada incelemek istediğiniz rotayı seçin</Text>

            <ScrollView style={{ maxHeight: 260, marginVertical: 12 }}>
              {allRoutes.map((r) => {
                const isActive = r.id === activeRoute.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.routeModalItem, isActive && styles.routeModalItemActive]}
                    onPress={() => {
                      tripStore.switchActiveRoute(r.id);
                      setCurrentStopIdx(0);
                      setShowRouteModal(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text maxFontSizeMultiplier={tokens.font.maxScale.body}
                        style={[
                          styles.routeModalName,
                          isActive && { color: tokens.color.textBrand, fontWeight: "800" },
                        ]}
                      >
                        {r.name}
                      </Text>
                      <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.routeModalStopsCount}>
                        {r.stops.length} Durak • Akıcı Sıralı
                      </Text>
                    </View>
                    {isActive && (
                      <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ color: tokens.color.accent, fontWeight: "900", fontSize: 16 }}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowRouteModal(false)}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalCloseBtnText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Comprehensive Share Modal (QR Kod + Toplu Taşıma + Canlı Yol Tarifi) */}
      <Modal
        visible={!!shareTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setShareTarget(null)}
      >
        <View style={styles.shareModalBackdrop}>
          <View style={styles.shareModalCard}>
            <View style={styles.shareModalHeader}>
              <View style={{ flex: 1 }}>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.shareModalSubtitle}>YOL TARİFİ & PAYLAŞIM</Text>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.shareModalTitle} numberOfLines={1}>
                  {shareTarget?.name}
                </Text>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.shareModalAddress} numberOfLines={1}>
                  {shareTarget?.address}
                </Text>
              </View>
              <TouchableOpacity style={styles.shareCloseBtn} onPress={() => setShareTarget(null)}>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.shareCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* QR Code Container */}
            <View style={styles.qrCodeBox}>
              {shareTarget && (
                <Image
                  source={{
                    uri: `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodeURIComponent(
                      `https://www.google.com/maps/dir/?api=1&destination=${shareTarget.lat},${shareTarget.lng}&travelmode=transit`,
                    )}`,
                  }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              )}
              <View style={styles.qrHintRow}>
                <View style={{ marginRight: 6 }}>
                  <QrCodeIcon size={14} color={tokens.color.successStrong} />
                </View>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.qrHintText}>
                  Kamerayla okutulduğunda hedefe anında canlı yol tarifi açılır.
                </Text>
              </View>
            </View>

            {/* Direction & Share Options */}
            <View style={styles.shareOptionsCol}>
              {/* Toplu Taşıma Yol Tarifi */}
              <TouchableOpacity
                style={styles.shareOptionBtn}
                onPress={() => {
                  if (!shareTarget) return;
                  const transitUrl = `https://www.google.com/maps/dir/?api=1&destination=${shareTarget.lat},${shareTarget.lng}&travelmode=transit`;
                  Linking.openURL(transitUrl);
                }}
              >
                <View style={[styles.shareOptionIconBox, { backgroundColor: tokens.color.infoBg }]}>
                  <TrainIcon size={18} color={tokens.color.accentSky} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.shareOptionTitle}>Toplu Taşıma Yol Tarifi</Text>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.shareOptionSub}>
                    Metro, otobüs, marmaray ve vapur hatları
                  </Text>
                </View>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ fontSize: 16, color: tokens.color.accentSky }}>➔</Text>
              </TouchableOpacity>

              {/* Araç ve Yürüyüş Yol Tarifi */}
              <TouchableOpacity
                style={styles.shareOptionBtn}
                onPress={() => {
                  if (!shareTarget) return;
                  const url = Platform.select({
                    ios: `maps://app?daddr=${shareTarget.lat},${shareTarget.lng}`,
                    default: `https://www.google.com/maps/dir/?api=1&destination=${shareTarget.lat},${shareTarget.lng}`,
                  });
                  Linking.openURL(url);
                }}
              >
                <View style={[styles.shareOptionIconBox, { backgroundColor: tokens.color.warningBgStrong }]}>
                  <DirectionsIcon size={18} color={tokens.color.warningStrong} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.shareOptionTitle}>Yol Tarifi & Navigasyon</Text>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.shareOptionSub}>Bulunduğun konumdan anlık yönlendirme</Text>
                </View>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ fontSize: 16, color: tokens.color.warningStrong }}>➔</Text>
              </TouchableOpacity>

              {/* Sistem Paylaşımı (WhatsApp, Mesajlar, Link) */}
              <TouchableOpacity
                style={styles.shareOptionBtn}
                onPress={async () => {
                  if (!shareTarget) return;
                  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${shareTarget.lat},${shareTarget.lng}&travelmode=transit`;
                  await Share.share({
                    title: shareTarget.name,
                    message: `${shareTarget.name}\n${shareTarget.address}\n\nCanlı Yol Tarifi:\n${navUrl}`,
                    url: navUrl,
                  });
                }}
              >
                <View style={[styles.shareOptionIconBox, { backgroundColor: tokens.color.surfaceBrandStrong }]}>
                  <Share2Icon size={18} color={tokens.dataPalette.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.shareOptionTitle}>WhatsApp & Mesajla Paylaş</Text>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.shareOptionSub}>Bağlantı ve konum koordinatlarını ilet</Text>
                </View>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ fontSize: 16, color: tokens.dataPalette.green }}>➔</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Map Settings Modal */}
      <Modal
        visible={showMapSettingsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMapSettingsModal(false)}
      >
        <View style={styles.mapSettingsBackdrop}>
          <View style={styles.mapSettingsCard}>
            <View style={styles.mapSettingsHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <SettingsIcon size={16} color={tokens.color.textBrand} />
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.mapSettingsTitle}>Harita Ayarları</Text>
              </View>
              <TouchableOpacity onPress={() => setShowMapSettingsModal(false)} activeOpacity={0.7}>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.mapSettingsClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Route Lines Toggle */}
            <View style={styles.mapSettingItem}>
              <View style={styles.mapSettingLeft}>
                <View style={styles.softIconBox}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.softIconText}>⇄</Text>
                </View>
                <View>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.mapSettingLabel}>Rota Çizgileri</Text>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.mapSettingSub}>Duraklar arası bağlantı çizgileri</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.mapSettingToggle, showRouteLines && styles.mapSettingToggleActive]}
                onPress={() => {
                  const newValue = !showRouteLines;
                  setShowRouteLines(newValue);
                  webViewRef.current?.injectJavaScript(`
                    if (window.toggleRouteLines) window.toggleRouteLines(${newValue});
                    true;
                  `);
                }}
              >
                <View
                  style={[
                    styles.mapSettingToggleKnob,
                    showRouteLines && styles.mapSettingToggleKnobActive,
                  ]}
                />
              </TouchableOpacity>
            </View>

            {/* Road-based Routing Toggle */}
            <View style={styles.mapSettingItem}>
              <View style={styles.mapSettingLeft}>
                <View style={styles.softIconBox}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.softIconText}>⤹</Text>
                </View>
                <View>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.mapSettingLabel}>Yol Bazlı Rotalama</Text>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.mapSettingSub}>Yolları takip eden rota çizgileri</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.mapSettingToggle, useRoadRouting && styles.mapSettingToggleActive]}
                onPress={() => {
                  const newValue = !useRoadRouting;
                  setUseRoadRouting(newValue);
                  webViewRef.current?.injectJavaScript(`
                    if (window.updateRouteLines) window.updateRouteLines(${newValue});
                    true;
                  `);
                }}
              >
                <View
                  style={[
                    styles.mapSettingToggleKnob,
                    useRoadRouting && styles.mapSettingToggleKnobActive,
                  ]}
                />
              </TouchableOpacity>
            </View>

            {/* Map Layer Selection */}
            <View style={styles.mapSettingSection}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.mapSettingSectionTitle}>Harita Görünümü</Text>
              <View style={styles.mapLayerOptions}>
                {[
                  { key: "light", label: "Standart", iconType: "sun" },
                  { key: "dark", label: "Koyu", iconType: "moon" },
                  { key: "satellite", label: "Uydu", iconType: "satellite" },
                ].map((layer) => {
                  const isActive = activeTileLayer === layer.key;
                  return (
                    <TouchableOpacity
                      key={layer.key}
                      style={[styles.mapLayerOption, isActive && styles.mapLayerOptionActive]}
                      onPress={() =>
                        handleSelectTileLayer(layer.key as "light" | "dark" | "satellite")
                      }
                    >
                      {layer.iconType === "sun" && (
                        <SunIcon size={18} color={isActive ? tokens.color.onPrimary : tokens.color.warningStrong} />
                      )}
                      {layer.iconType === "moon" && (
                        <MoonIcon size={18} color={isActive ? tokens.color.onPrimary : tokens.dataPalette.indigo} />
                      )}
                      {layer.iconType === "satellite" && (
                        <SatelliteIcon size={18} color={isActive ? tokens.color.onPrimary : tokens.color.successStrong} />
                      )}
                      <Text maxFontSizeMultiplier={tokens.font.maxScale.body}
                        style={[
                          styles.mapLayerOptionText,
                          isActive && styles.mapLayerOptionTextActive,
                        ]}
                      >
                        {layer.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      </Modal>
      <ScreenTourModal screen="map" />
    </View>
  );
}

function getCategoryFromTypes(types?: string[]): string {
  if (!types) return "MEKAN";
  if (types.includes("museum")) return "MÜZE";
  if (types.includes("cafe") || types.includes("bakery")) return "KAHVE & MOLA";
  if (types.includes("restaurant") || types.includes("food")) return "YEME-İÇME";
  if (types.includes("church") || types.includes("mosque") || types.includes("place_of_worship"))
    return "TARİHİ YER";
  if (types.includes("tourist_attraction") || types.includes("point_of_interest"))
    return "TARİHİ YER";
  return "MEKAN";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.bg,
  },
  fullMap: {
    ...(StyleSheet.absoluteFill as unknown as Record<string, unknown>),
    backgroundColor: tokens.color.surfaceBrand,
  },
  liveIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: tokens.color.textBrand,
    letterSpacing: 0.3,
  },
  topFloatingArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 8 : 36,
    zIndex: 20,
  },
  searchRow: {
    marginBottom: 8,
  },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.color.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 44,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: tokens.color.text,
    height: "100%",
  },
  voiceMicBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.color.surfaceBrand,
    alignItems: "center",
    justifyContent: "center",
  },
  filterPillsRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 4,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: tokens.color.surface,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  filterPillActive: {
    backgroundColor: tokens.color.primary,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: tokens.color.textMuted,
    letterSpacing: 0.3,
  },
  filterPillTextActive: {
    color: tokens.color.onPrimary,
  },
  searchResultsOverlay: {
    position: "absolute",
    top: Platform.OS === "ios" ? 110 : 130,
    left: 16,
    right: 16,
    maxHeight: 260,
    backgroundColor: tokens.color.surface,
    borderRadius: 18,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 30,
    overflow: "hidden",
  },
  searchResultsScroll: {
    maxHeight: 240,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.surfaceTint,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.color.textBrand,
  },
  searchResultAddr: {
    fontSize: 11,
    color: tokens.color.textSubtle,
    marginTop: 1,
  },
  searchResultRating: {
    fontSize: 12,
    fontWeight: "700",
    color: tokens.color.accent,
  },
  routeOverviewPill: {
    position: "absolute",
    top: Platform.OS === "ios" ? 115 : 135,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: withAlpha(tokens.color.surface, 0.95),
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  routeOverviewText: {
    fontSize: 11,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  rightFloatingControls: {
    position: "absolute",
    top: Platform.OS === "ios" ? 115 : 135,
    right: 16,
    gap: 8,
    zIndex: 10,
  },
  floatingControlBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: withAlpha(tokens.color.surface, 0.96),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  gpsPulseDot: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.color.accent,
  },
  poiLoadingPill: {
    position: "absolute",
    top: Platform.OS === "ios" ? 160 : 180,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tokens.color.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 25,
  },
  poiLoadingText: {
    fontSize: 12,
    fontWeight: "700",
    color: tokens.color.textBrand,
  },
  bottomSheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SCREEN_H * 0.8,
    backgroundColor: tokens.color.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
    paddingTop: 6,
    paddingBottom: Platform.OS === "ios" ? 24 : 10,
    paddingHorizontal: 16,
    shadowColor: tokens.color.primary,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 20,
  },
  bottomSheetContainerCollapsed: {
    paddingBottom: 4,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  dragHandleTouchArea: {
    paddingTop: 4,
    paddingBottom: 4,
    alignItems: "center",
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: tokens.color.neutral300,
    alignSelf: "center",
    marginBottom: 4,
  },
  expandCollapseRow: {
    alignItems: "center",
    marginBottom: 2,
  },
  expandCollapseText: {
    fontSize: 10,
    fontWeight: "700",
    color: tokens.color.link,
    letterSpacing: 0.2,
  },
  collapsedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  collapsedTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  collapsedSub: {
    fontSize: 11,
    color: tokens.color.textSubtle,
    marginTop: 1,
  },
  collapsedActionPill: {
    backgroundColor: tokens.color.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    marginRight: 6,
  },
  collapsedActionPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: tokens.color.onPrimary,
  },
  collapsedCloseBtn: {
    padding: 6,
  },
  collapsedCloseBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.color.textSubtle,
  },
  collapsedStopBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tokens.color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  collapsedStopBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: tokens.color.onPrimary,
  },
  collapsedNavPill: {
    backgroundColor: tokens.color.surfaceBrand,
    borderWidth: 1,
    borderColor: tokens.color.successBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 6,
  },
  collapsedNavPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  collapsedArrowBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: tokens.color.surfaceTint,
    alignItems: "center",
    justifyContent: "center",
  },
  collapsedArrowBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  carouselContainer: {
    paddingVertical: 4,
  },
  stopCarouselCard: {
    borderRadius: 18,
    backgroundColor: tokens.color.surface,
  },
  cardContent: {
    flexDirection: "column",
  },
  clickedPlaceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  closeCardBtn: {
    padding: 6,
  },
  closeCardText: {
    fontSize: 16,
    fontWeight: "700",
    color: tokens.color.textSubtle,
  },
  routeHeaderBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  routeSelectorBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: tokens.color.accent,
  },
  routeHeaderTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: tokens.color.textBrand,
    flexShrink: 1,
  },
  stopsCountBadge: {
    backgroundColor: tokens.color.surfaceTint,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  stopsCountText: {
    fontSize: 10,
    fontWeight: "700",
    color: tokens.color.textMuted,
  },
  routeStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 4,
  },
  stepperArrowBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: tokens.color.surfaceTint,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperArrowText: {
    fontSize: 11,
    color: tokens.color.textBrand,
    fontWeight: "800",
  },
  stepperScrollTrack: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 6,
  },
  stepCirclePill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: tokens.color.surfaceTint,
    borderWidth: 1,
    borderColor: tokens.color.surfaceTint,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCirclePillActive: {
    backgroundColor: tokens.color.primary,
    borderColor: tokens.color.accentStrong,
    transform: [{ scale: 1.15 }],
  },
  stepCircleText: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.color.textMuted,
  },
  stepCircleTextActive: {
    color: tokens.color.onPrimary,
    fontWeight: "900",
  },
  stopCardMain: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 6,
    marginBottom: 8,
  },
  categoryRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  categoryPill: {
    backgroundColor: tokens.color.surfaceBrand,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: tokens.color.textBrand,
    letterSpacing: 0.2,
  },
  ratingBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.color.link,
  },
  stopTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: tokens.color.textBrand,
    letterSpacing: -0.2,
  },
  stopAddress: {
    fontSize: 11,
    color: tokens.color.textSubtle,
    marginTop: 2,
  },
  stopThumb: {
    width: 58,
    height: 58,
    borderRadius: 14,
  },
  stopThumbFallback: {
    backgroundColor: tokens.color.surfaceBrand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tokens.color.surfaceBrandStrong,
  },
  microStatsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: tokens.color.bg,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  microStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  microStatIconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.color.neutral200,
    alignItems: "center",
    justifyContent: "center",
  },
  microStatTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.color.textBrand,
  },
  microStatSub: {
    fontSize: 9,
    color: tokens.color.textSubtle,
  },
  microStatDivider: {
    width: 1,
    height: 20,
    backgroundColor: tokens.color.neutral200,
  },
  travelerNoteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: tokens.color.surfaceBrand,
    padding: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  travelerNoteLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: tokens.color.link,
    marginBottom: 1,
  },
  travelerNoteText: {
    fontSize: 11,
    color: tokens.color.textBrand,
    lineHeight: 15,
  },
  actionsRow: {
    flexDirection: "column",
    gap: 6,
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: tokens.color.brandHover,
    paddingVertical: 11,
    borderRadius: 999,
    shadowColor: tokens.color.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryActionBtnText: {
    color: tokens.color.onPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryActionsSplit: {
    flexDirection: "row",
    gap: 6,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: tokens.color.surfaceTint,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  visitedBtnActive: {
    backgroundColor: tokens.color.surfaceBrandSoft,
  },
  secondaryBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.color.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: withAlpha(tokens.color.black, 0.5),
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: tokens.color.surface,
    borderRadius: 24,
    padding: 20,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: tokens.color.textBrand,
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 12,
    color: tokens.color.textSubtle,
    marginBottom: 12,
  },
  routeModalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: tokens.color.bg,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  routeModalItemActive: {
    backgroundColor: tokens.color.surfaceBrand,
    borderColor: tokens.color.accent,
  },
  routeModalName: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.color.neutral700,
  },
  routeModalStopsCount: {
    fontSize: 11,
    color: tokens.color.textSubtle,
    marginTop: 2,
  },
  modalCloseBtn: {
    backgroundColor: tokens.color.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6,
  },
  modalCloseBtnText: {
    color: tokens.color.onPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  shareActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.surfaceBrand,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.color.successBorder,
  },
  shareActionBtnText: {
    color: tokens.color.textBrand,
    fontSize: 13,
    fontWeight: "800",
  },
  placeDescBox: {
    backgroundColor: tokens.color.bg,
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  placeDescTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  placeDescLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: tokens.color.textBrand,
    letterSpacing: 0.5,
  },
  placeDescText: {
    fontSize: 11.5,
    color: tokens.color.neutral700,
    lineHeight: 16,
  },
  reviewsBox: {
    backgroundColor: tokens.color.surface,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: tokens.color.neutral100,
  },
  reviewsBoxTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  reviewsBoxHeader: {
    fontSize: 10,
    fontWeight: "800",
    color: tokens.color.link,
    letterSpacing: 0.5,
  },
  reviewsScroll: {
    maxHeight: 120,
  },
  reviewItem: {
    backgroundColor: tokens.color.bg,
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
  },
  reviewItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  reviewAuthor: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.color.surfaceInverseStrong,
  },
  reviewRating: {
    fontSize: 10,
    fontWeight: "700",
    color: tokens.color.warningIcon,
  },
  reviewText: {
    fontSize: 10.5,
    color: tokens.color.textMuted,
    lineHeight: 14,
  },
  shareModalBackdrop: {
    flex: 1,
    backgroundColor: withAlpha(tokens.color.black, 0.6),
    justifyContent: "flex-end",
  },
  shareModalCard: {
    backgroundColor: tokens.color.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 20,
  },
  shareModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  shareModalSubtitle: {
    fontSize: 10,
    fontWeight: "800",
    color: tokens.color.accent,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  shareModalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  shareModalAddress: {
    fontSize: 12,
    color: tokens.color.textSubtle,
    marginTop: 2,
  },
  shareCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.color.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  shareCloseText: {
    fontSize: 14,
    color: tokens.color.textSubtle,
    fontWeight: "700",
  },
  qrCodeBox: {
    alignItems: "center",
    backgroundColor: tokens.color.bg,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: tokens.color.border,
    marginBottom: 14,
  },
  qrImage: {
    width: 170,
    height: 170,
    borderRadius: 12,
    backgroundColor: tokens.color.surface,
  },
  qrHintRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 8,
  },
  qrHintText: {
    fontSize: 11,
    color: tokens.color.textMuted,
    textAlign: "center",
    flex: 1,
    lineHeight: 15,
  },
  shareOptionsCol: {
    gap: 8,
  },
  shareOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.color.surface,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: tokens.color.border,
    gap: 12,
  },
  shareOptionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  shareOptionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: tokens.color.text,
  },
  shareOptionSub: {
    fontSize: 11,
    color: tokens.color.textSubtle,
    marginTop: 1,
  },
  // Clicked Place Top Header & Action styles
  clickedPlaceTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    marginBottom: 8,
  },
  clickedPlaceHeaderRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aiAskButtonPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: tokens.color.primary,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    shadowColor: tokens.color.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  aiAskButtonText: {
    fontSize: 12,
    color: tokens.color.onPrimary,
    fontWeight: "800",
  },
  closeCircleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: tokens.color.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  closeCircleBtnText: {
    fontSize: 15,
    color: tokens.color.textSubtle,
    fontWeight: "800",
  },
  // Active button state
  floatingControlBtnActive: {
    backgroundColor: tokens.color.primary,
  },
  // Map Settings Modal styles
  mapSettingsBackdrop: {
    flex: 1,
    backgroundColor: withAlpha(tokens.color.black, 0.5),
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  mapSettingsCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: tokens.color.surface,
    borderRadius: 20,
    padding: 20,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  mapSettingsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  mapSettingsTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: tokens.color.text,
  },
  mapSettingsClose: {
    fontSize: 18,
    color: tokens.color.textSubtle,
    padding: 4,
  },
  mapSettingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.neutral100,
  },
  mapSettingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mapSettingIcon: {
    fontSize: 20,
  },
  mapSettingLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.color.text,
  },
  mapSettingSub: {
    fontSize: 11,
    color: tokens.color.textSubtle,
    marginTop: 2,
  },
  mapSettingToggle: {
    width: 48,
    height: 26,
    borderRadius: 13,
    backgroundColor: tokens.color.neutral200,
    padding: 2,
  },
  mapSettingToggleActive: {
    backgroundColor: tokens.color.accent,
  },
  mapSettingToggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tokens.color.surface,
    transform: [{ translateX: 0 }],
  },
  mapSettingToggleKnobActive: {
    transform: [{ translateX: 22 }],
  },
  mapSettingSection: {
    marginTop: 16,
  },
  mapSettingSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: tokens.color.textSubtle,
    marginBottom: 12,
  },
  mapLayerOptions: {
    flexDirection: "row",
    gap: 10,
  },
  mapLayerOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: tokens.color.bg,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  mapLayerOptionActive: {
    backgroundColor: tokens.color.primary,
    borderColor: tokens.color.primary,
  },
  mapLayerOptionText: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.color.textSubtle,
    marginTop: 6,
  },
  mapLayerOptionTextActive: {
    color: tokens.color.onPrimary,
  },
  softIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: tokens.color.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  softIconText: {
    fontSize: 16,
    color: tokens.color.textBrand,
    fontWeight: "700",
  },
  floatingControlIcon: {
    fontSize: 18,
    color: tokens.color.textBrand,
    fontWeight: "700",
  },
  pendingAddStopBanner: {
    marginTop: 8,
    backgroundColor: tokens.color.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 1,
    borderColor: tokens.color.accent,
  },
  pendingAddStopText: {
    color: tokens.color.onPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  pendingAddStopCancelBtn: {
    backgroundColor: withAlpha(tokens.color.surface, 0.18),
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginLeft: 8,
  },
  pendingAddStopCancelText: {
    color: tokens.color.warningBgStrong,
    fontSize: 11,
    fontWeight: "800",
  },
  emptyCollapsedIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.color.surfaceBrand,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyPlanCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.color.successStrong,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    shadowColor: tokens.color.successStrong,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyPlanCtaBtnText: {
    color: tokens.color.onPrimary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  emptyRouteExpandedCard: {
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  emptyRouteExpandedIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.color.surfaceBrand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: tokens.color.successBorder,
    marginBottom: 12,
  },
  emptyRouteBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.color.surfaceBrand,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.color.successBorder,
    marginBottom: 10,
  },
  emptyRouteBadgeText: {
    color: tokens.color.successStrong,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  emptyRouteExpandedTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: tokens.color.textBrand,
    marginBottom: 6,
    textAlign: "center",
  },
  emptyRouteExpandedSubtitle: {
    fontSize: 13,
    color: tokens.color.textMuted,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  emptyRouteExpandedPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: tokens.color.primary,
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: tokens.color.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 14,
  },
  emptyRouteExpandedPrimaryBtnText: {
    color: tokens.color.onPrimary,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  emptyRouteHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.color.warningBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.color.warningBorder,
    width: "100%",
  },
  emptyRouteHintText: {
    fontSize: 11,
    color: tokens.color.warning,
    fontWeight: "600",
    flex: 1,
  },
});
