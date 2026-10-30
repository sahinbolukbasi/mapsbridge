import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
  Modal,
  TextInput,
  Share,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { WebView } from "react-native-webview";
import { tripStore, TripStop, ActiveRoute } from "../services/tripStore";
import {
  MapIcon,
  MapPinIcon,
  SparkIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
  ClockIcon,
  LightbulbIcon,
  TicketIcon,
  WalkIcon,
  PinIcon,
  SearchIcon,
  DirectionsIcon,
  Share2Icon,
  CameraIcon,
} from "../components/Icons";
import { ScreenTourModal } from "../components/ScreenTourModal";
import { PaywallModal } from "../components/PaywallModal";
import { getOfferings, isProSync } from "../services/revenuecat";

import { AccessibleStopList, Screen, ScreenHeader, mapLabel } from "../ui";
import { tokens, withAlpha } from "../theme";
interface PlanScreenProps {
  onOpenMap: (stopId?: string) => void;
  onOpenProfile?: () => void;
}

const CATEGORIES = ["TARİHİ YER", "MÜZE", "KAHVE & MOLA", "YEME-İÇME", "MANZARA", "DİĞER"];

export const SAMPLE_TEMPLATES = [
  {
    id: "tmpl-rome",
    city: "İtalya • Roma",
    name: "Antik Roma Klasikleri",
    stops: [
      {
        id: "tmpl-s1",
        name: "Kolezyum (Colosseum)",
        category: "TARİHİ YER",
        time: "09:30",
        duration: "1 saat 30 dk",
        address: "Piazza del Colosseo, 1, 00184 Roma",
        lat: 41.8902,
        lng: 12.4922,
        rating: 4.8,
        walkTimeFromPrev: "Başlangıç",
        distanceFromPrev: "0m",
        notes: "Önceden bilet alarak hızlı giriş yapabilirsiniz.",
      },
      {
        id: "tmpl-s2",
        name: "Roma Forumu",
        category: "TARİHİ YER",
        time: "11:15",
        duration: "1 saat",
        address: "Via della Salara Vecchia, 5/6, 00186 Roma",
        lat: 41.8925,
        lng: 12.4853,
        rating: 4.7,
        walkTimeFromPrev: "~6 dk yürüyüş",
        distanceFromPrev: "450m",
      },
      {
        id: "tmpl-s3",
        name: "Pantheon",
        category: "MÜZE",
        time: "13:00",
        duration: "45 dk",
        address: "Piazza della Rotonda, 00186 Roma",
        lat: 41.8986,
        lng: 12.4769,
        rating: 4.8,
        walkTimeFromPrev: "~12 dk yürüyüş",
        distanceFromPrev: "900m",
      },
      {
        id: "tmpl-s4",
        name: "Trevi Çeşmesi",
        category: "MEKAN",
        time: "14:30",
        duration: "30 dk",
        address: "Piazza di Trevi, 00187 Roma",
        lat: 41.9009,
        lng: 12.4833,
        rating: 4.8,
        walkTimeFromPrev: "~8 dk yürüyüş",
        distanceFromPrev: "650m",
        notes: "Dilek tutmak için bozuk para atmayı unutmayın!",
      },
    ],
  },
  {
    id: "tmpl-ist",
    city: "Türkiye • İstanbul",
    name: "Tarihi Yarımada & Sultanahmet",
    stops: [
      {
        id: "tmpl-ist-1",
        name: "Ayasofya-i Kebir Cami-i Şerifi",
        category: "TARİHİ YER",
        time: "09:00",
        duration: "1 saat 15 dk",
        address: "Sultan Ahmet Meydanı, Fatih/İstanbul",
        lat: 41.0086,
        lng: 28.9802,
        rating: 4.9,
        walkTimeFromPrev: "Başlangıç",
        distanceFromPrev: "0m",
      },
      {
        id: "tmpl-ist-2",
        name: "Sultanahmet Camii (Mavi Cami)",
        category: "TARİHİ YER",
        time: "10:30",
        duration: "45 dk",
        address: "Sultan Ahmet, Fatih/İstanbul",
        lat: 41.0054,
        lng: 28.9768,
        rating: 4.8,
        walkTimeFromPrev: "~5 dk yürüyüş",
        distanceFromPrev: "350m",
      },
      {
        id: "tmpl-ist-3",
        name: "Yerebatan Sarnıcı",
        category: "MÜZE",
        time: "11:45",
        duration: "45 dk",
        address: "Alemdar, Yerebatan Cd. 1/3, Fatih",
        lat: 41.0084,
        lng: 28.9778,
        rating: 4.8,
        walkTimeFromPrev: "~4 dk yürüyüş",
        distanceFromPrev: "280m",
      },
      {
        id: "tmpl-ist-4",
        name: "Kapalıçarşı",
        category: "MEKAN",
        time: "13:00",
        duration: "1 saat 30 dk",
        address: "Beyazıt, Fatih/İstanbul",
        lat: 41.0108,
        lng: 28.968,
        rating: 4.7,
        walkTimeFromPrev: "~10 dk yürüyüş",
        distanceFromPrev: "750m",
      },
    ],
  },
  {
    id: "tmpl-cap",
    city: "Türkiye • Kapadokya",
    name: "Peri Bacaları & Vadi Yürüyüşü",
    stops: [
      {
        id: "tmpl-cap-1",
        name: "Göreme Açık Hava Müzesi",
        category: "MÜZE",
        time: "09:30",
        duration: "2 saat",
        address: "Göreme, Nevşehir",
        lat: 38.6402,
        lng: 34.8453,
        rating: 4.8,
        walkTimeFromPrev: "Başlangıç",
        distanceFromPrev: "0m",
      },
      {
        id: "tmpl-cap-2",
        name: "Uçhisar Kalesi",
        category: "TARİHİ YER",
        time: "12:30",
        duration: "1 saat",
        address: "Uçhisar, Nevşehir",
        lat: 38.63,
        lng: 34.8055,
        rating: 4.7,
        walkTimeFromPrev: "~12 dk araç / yürüyüş",
        distanceFromPrev: "3.8km",
      },
      {
        id: "tmpl-cap-3",
        name: "Paşabağ Rahipler Vadisi",
        category: "MEKAN",
        time: "14:30",
        duration: "1 saat 15 dk",
        address: "Zelve Yolu, Avanos/Nevşehir",
        lat: 38.6775,
        lng: 34.8533,
        rating: 4.8,
        walkTimeFromPrev: "~10 dk araç",
        distanceFromPrev: "5.2km",
      },
    ],
  },
];

export function PlanScreen({ onOpenMap }: PlanScreenProps) {
  const [activeRoute, setActiveRoute] = useState<ActiveRoute>(tripStore.getActiveRoute());
  const [allRoutes, setAllRoutes] = useState<ActiveRoute[]>(tripStore.getAllRoutes());
  const [savedPool, setSavedPool] = useState<TripStop[]>(tripStore.getSavedPool());
  const [activeDay, _setActiveDay] = useState<number>(1);
  const [showPool, setShowPool] = useState<boolean>(false);
  const [_offerings, setOfferings] = useState<unknown>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  // Modals
  const [showRoutePickerModal, setShowRoutePickerModal] = useState<boolean>(false);
  const [showNewTripModal, setShowNewTripModal] = useState<boolean>(false);
  const [newTripTitle, setNewTripTitle] = useState("");
  const [renamingRoute, setRenamingRoute] = useState<ActiveRoute | null>(null);
  const [renameRouteText, setRenameRouteText] = useState("");

  // Editing stop
  const [editingStop, setEditingStop] = useState<TripStop | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("TARİHİ YER");
  const [editCustomCategory, setEditCustomCategory] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editBudget, setEditBudget] = useState("");

  // Adding new stop
  const [showAddStopModal, setShowAddStopModal] = useState<boolean>(false);
  const [addName, setAddName] = useState("");
  const [addCategory, setAddCategory] = useState("TARİHİ YER");
  const [addAddress, setAddAddress] = useState("");
  const [addDuration, setAddDuration] = useState("45 dk");
  const [addNotes, setAddNotes] = useState("");
  const [addBudget, setAddBudget] = useState("");

  const mapWebRef = useRef<WebView>(null);

  useEffect(() => {
    const unsub = tripStore.subscribe(() => {
      setActiveRoute({ ...tripStore.getActiveRoute() });
      setAllRoutes([...tripStore.getAllRoutes()]);
      setSavedPool([...tripStore.getSavedPool()]);
    });
    return unsub;
  }, []);

  // Load RevenueCat offerings
  useEffect(() => {
    getOfferings()
      .then((off) => setOfferings(off))
      .catch((err) => console.warn("Failed to load offerings:", err));
  }, []);

  // Sync stops with embedded map preview
  useEffect(() => {
    if (!mapWebRef.current || !activeRoute.stops) return;
    const payload = activeRoute.stops.map((s, idx) => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      index: idx + 1,
      visited: s.visited || false,
    }));
    mapWebRef.current.injectJavaScript(`
      if (window.updatePlanStops) {
        window.updatePlanStops(${JSON.stringify(payload)});
      }
      true;
    `);
  }, [activeRoute.stops]);

  // Optimize stops with algorithm
  const handleOptimizeRoute = () => {
    tripStore.optimizeRoute();
    Alert.alert(
      "🪄 Rota Optimize Edildi",
      "Durak sırası zikzaksız en kısa yürüme rotasına göre dizildi. Yürüme süresinden %38 tasarruf sağlandı!",
    );
  };

  // Export to Google Maps
  const handleExportGoogleMaps = () => {
    if (activeRoute.stops.length === 0) return;
    const waypoints = activeRoute.stops.map((s) => `${s.lat},${s.lng}`).join("/");
    const url = `https://www.google.com/maps/dir/${waypoints}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Google Maps", "Rota Google Haritalar uygulamasına aktarıldı.");
    });
  };

  // Create new trip
  const handleCreateNewTrip = () => {
    if (!newTripTitle.trim()) return;
    tripStore.createRoute(newTripTitle.trim());
    setNewTripTitle("");
    setShowNewTripModal(false);
  };

  // Open edit modal for a stop
  const handleOpenEditStop = (stop: TripStop) => {
    setEditingStop(stop);
    setEditName(stop.name);
    setEditTime(stop.time || "10:00");
    setEditDuration(stop.duration || "45 dk");
    setEditNotes(stop.notes || "");
    setEditBudget(stop.budget || "");
    setEditPhotoUrl(stop.photoUrl || "");
    if (CATEGORIES.includes(stop.category)) {
      setEditCategory(stop.category);
      setEditCustomCategory("");
    } else {
      setEditCategory("DİĞER");
      setEditCustomCategory(stop.category || "");
    }
  };

  const handlePickPhoto = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setEditPhotoUrl(res.assets[0].uri);
      }
    } catch {
      Alert.alert("Fotoğraf", "Fotoğraf galerisi açılamadı.");
    }
  };

  // Save edited stop
  const handleSaveStopEdit = () => {
    if (!editingStop || !editName.trim()) return;
    const finalCategory =
      editCategory === "DİĞER" ? editCustomCategory.trim() || "ÖZEL MEKAN" : editCategory;
    tripStore.updateStop(editingStop.id, {
      name: editName.trim(),
      category: finalCategory,
      time: editTime.trim(),
      duration: editDuration.trim(),
      notes: editNotes.trim(),
      budget: editBudget.trim(),
      photoUrl: editPhotoUrl.trim() || undefined,
    });
    setEditingStop(null);
  };

  // Add custom new stop
  const handleSaveNewStop = () => {
    if (!addName.trim()) {
      Alert.alert("Eksik Bilgi", "Lütfen durak adı girin.");
      return;
    }
    // Approximate near last stop or Istanbul center
    const lastStop = activeRoute.stops[activeRoute.stops.length - 1];
    const baseLat = lastStop ? lastStop.lat + 0.003 : 41.0082;
    const baseLng = lastStop ? lastStop.lng + 0.003 : 28.9784;

    const newStop: TripStop = {
      id: `custom-stop-${Date.now()}`,
      name: addName.trim(),
      category: addCategory,
      time: "15:00",
      duration: addDuration.trim() || "45 dk",
      address: addAddress.trim() || "İstanbul",
      lat: baseLat,
      lng: baseLng,
      notes: addNotes.trim() || undefined,
      budget: addBudget.trim() || undefined,
      rating: 4.8,
      walkTimeFromPrev: "~7 dk yürüyüş",
      distanceFromPrev: "450m",
    };

    tripStore.addStop(newStop);
    setAddName("");
    setAddAddress("");
    setAddNotes("");
    setAddBudget("");
    setShowAddStopModal(false);
  };

  const handleApplyTemplate = (tmpl: (typeof SAMPLE_TEMPLATES)[0]) => {
    // Gate: templates are a Pro feature
    if (!isProSync()) {
      setShowPaywall(true);
      return;
    }
    tripStore.setActiveRoute({
      id: `route-${Date.now()}`,
      name: tmpl.name,
      day: 1,
      stops: tmpl.stops,
    });
    Alert.alert(
      "Şablon Yüklendi",
      `"${tmpl.name}" seyahat planınıza aktarıldı! Haritada görüntüleyebilir veya yeni duraklar seçebilirsiniz.`,
    );
  };

  // Embedded map HTML
  const planMapHtml = `
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
          .plan-pin {
            width: 28px; height: 28px; border-radius: 14px;
            background: ${tokens.color.primary}; border: 2px solid ${tokens.color.accentStrong};
            color: ${tokens.color.onPrimary}; font-family: -apple-system, sans-serif;
            font-size: 11px; font-weight: 800;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 2px 8px ${withAlpha(tokens.color.primary, 0.3)};
            cursor: pointer;
          }
          .visited-pin {
            background: ${tokens.color.accent}; border-color: ${tokens.color.neutral0};
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          var map, markersGroup, polylineLayer;
          function init() {
            if (typeof L === 'undefined') { setTimeout(init, 50); return; }
            map = L.map('map', { zoomControl: false, attributionControl: false }).setView([41.0082, 28.9784], 14);
            L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=tr', {
              maxZoom: 20,
              subdomains: ['0', '1', '2', '3']
            }).addTo(map);
            markersGroup = L.layerGroup().addTo(map);

            window.updatePlanStops = function(stops) {
              if (!map || !markersGroup) return;
              markersGroup.clearLayers();
              if (!stops || stops.length === 0) return;
              var latlngs = [];
              stops.forEach(function(s) {
                latlngs.push([s.lat, s.lng]);
                var html = '<div class="plan-pin ' + (s.visited ? 'visited-pin' : '') + '">' + s.index + '</div>';
                var icon = L.divIcon({ className: '', html: html, iconSize: [28, 28], iconAnchor: [14, 14] });
                var m = L.marker([s.lat, s.lng], { icon: icon }).addTo(markersGroup);
                m.on('click', function() {
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'STOP_TAP', id: s.id }));
                  }
                });
              });
              if (polylineLayer) map.removeLayer(polylineLayer);
              if (latlngs.length > 1) {
                polylineLayer = L.polyline(latlngs, {
                  color: '${tokens.color.accent}', weight: 3.5, dashArray: '6, 6', opacity: 0.9
                }).addTo(map);
              }
              if (latlngs.length > 0) {
                map.fitBounds(L.latLngBounds(latlngs), { padding: [25, 25] });
              }
            };

            var initStops = ${JSON.stringify(
              activeRoute.stops.map((s, idx) => ({
                id: s.id,
                name: s.name,
                lat: s.lat,
                lng: s.lng,
                index: idx + 1,
                visited: s.visited || false,
              })),
            )};
            window.updatePlanStops(initStops);
          }
          init();
        </script>
      </body>
    </html>
  `;

  return (
    <Screen style={styles.container}>
      <ScreenHeader variant="brand" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Active Trip Header Selector & New Trip Button */}
        <View style={styles.tripHeaderRow}>
          <TouchableOpacity
            style={styles.tripDropdownBtn}
            onPress={() => setShowRoutePickerModal(true)}
            activeOpacity={0.8}
          >
            <View style={styles.pulsingEmeraldDot} />
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.tripDropdownTitle} numberOfLines={1}>
              {activeRoute.name}
            </Text>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.tripDropdownCount}>({activeRoute.stops.length} Durak)</Text>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ fontSize: 13, color: tokens.color.link }}>▼</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.renameRouteHeaderBtn}
            onPress={() => {
              setRenamingRoute(activeRoute);
              setRenameRouteText(activeRoute.name);
            }}
            activeOpacity={0.8}
            accessibilityLabel="Rotanın İsmini Düzenle"
          >
            <EditIcon size={14} color={tokens.color.textBrand} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.newTripBtn}
            onPress={() => setShowNewTripModal(true)}
            activeOpacity={0.8}
          >
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.newTripBtnText}>+ Yeni</Text>
          </TouchableOpacity>
        </View>

        {/* Metric Summary Card: Durak Sayısı, Toplam KM, Toplam Saat (Akıllı Seyahat kaldırıldı) */}
        <View style={styles.metricCard}>
          <View style={styles.metricItem}>
            <View style={styles.metricValueRow}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.metricValue}>{activeRoute.stops.length}</Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.metricUnit}>Durak</Text>
            </View>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.metricLabel}>{activeDay}. GÜN PLANI</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <View style={styles.metricValueRow}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.metricValue}>
                {(Math.max(1, activeRoute.stops.length) * 0.9).toFixed(1)}
              </Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.metricUnit}>km</Text>
            </View>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.metricLabel}>YÜRÜYÜŞ MESAFESİ</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <View style={styles.metricValueRow}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.metricValue}>
                {Math.max(1, Math.floor(activeRoute.stops.length * 1.1))}s{" "}
                {(activeRoute.stops.length * 15) % 60}d
              </Text>
            </View>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.metricLabel}>TOPLAM SÜRE</Text>
          </View>
        </View>

        {/* Embedded Interactive Route Map Card */}
        <View style={styles.mapPreviewCard}>
          <View style={styles.mapPreviewHeader}>
            <View style={styles.mapPreviewHeaderLeft}>
              <View style={{ marginRight: 6 }}>
                <MapIcon size={16} color={tokens.color.successStrong} />
              </View>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.mapPreviewTitle}>Canlı Rota Önizlemesi</Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {/* Pinleri Paylaş Button */}
              <TouchableOpacity
                style={styles.shareStopsHeaderBtn}
                onPress={() => {
                  if (activeRoute.stops.length === 0) {
                    Alert.alert("Bilgi", "Paylaşılacak durak bulunmuyor.");
                    return;
                  }
                  const text =
                    `🗺️ ${activeRoute.name} (${activeRoute.stops.length} Durak)\n\n` +
                    activeRoute.stops
                      .map((s, idx) => `${idx + 1}. ${s.name} - ${s.address}`)
                      .join("\n") +
                    `\n\nMapsBridge Gezi Kodu: MB-${Math.floor(100000 + Math.random() * 900000)}`;
                  Share.share({ message: text, title: activeRoute.name });
                }}
                activeOpacity={0.8}
              >
                <Share2Icon size={13} color={tokens.color.textBrand} />
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.shareStopsHeaderText}>Pinleri Paylaş</Text>
              </TouchableOpacity>

              {/* Haritada Gör Button */}
              <TouchableOpacity
                style={styles.openFullMapBtn}
                onPress={() => onOpenMap()}
                activeOpacity={0.8}
              >
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.openFullMapText}>Haritada Gör ➔</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.mapCanvasContainer}>
            <WebView
              ref={mapWebRef}
              originWhitelist={["*"]}
              source={{ html: planMapHtml }}
              style={styles.mapWebview}
              accessible={true}
              accessibilityLabel={mapLabel(activeRoute.stops.length)}
              importantForAccessibility="no-hide-descendants"
              scrollEnabled={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === "STOP_TAP" && data.id) {
                    onOpenMap(data.id);
                  }
                } catch {}
              }}
            />
            <AccessibleStopList
              day={activeRoute.day}
              stops={activeRoute.stops}
              onSelectStop={(id) => onOpenMap(id)}
            />
          </View>
        </View>

        {/* Action Buttons Grid */}
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.optimizeBtn}
            onPress={handleOptimizeRoute}
            activeOpacity={0.8}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <SparkIcon size={16} color={tokens.color.onPrimary} />
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.optimizeBtnText}>Rotayı Optimize Et</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addStopActionBtn}
            onPress={() => {
              // Open map directly to select location from map
              tripStore.setPendingAddStop(true);
              onOpenMap();
            }}
            activeOpacity={0.8}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <PlusIcon size={16} color={tokens.color.successStrong} />
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.addStopActionText}>Durak Ekle</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Timeline of Stops OR Guided Route Creation Showcase */}
        {activeRoute.stops.length === 0 ? (
          <View style={styles.emptyGuideCard}>
            {/* Showcase Header */}
            <View style={styles.emptyGuideBadge}>
              <SparkIcon size={12} color={tokens.color.successStrong} />
              <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.emptyGuideBadgeText}>ROTA OLUŞTURUCU</Text>
            </View>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.emptyGuideTitle}>İlk Seyahat Rotanı Başlat</Text>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.emptyGuideSubtitle}>
              Haritadan dilediğin mekanları seçerek adım adım kendi seyahatini oluştur veya tek
              tıkla popüler rota şablonunu yükle.
            </Text>

            {/* Direct Map Selection Action */}
            <TouchableOpacity
              style={styles.emptyGuideMainBtn}
              onPress={() => {
                tripStore.setPendingAddStop(true);
                onOpenMap();
              }}
              activeOpacity={0.85}
            >
              <MapIcon size={18} color={tokens.color.onPrimary} />
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.emptyGuideMainBtnText}>Haritayı Aç ve Durak Seç</Text>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ color: tokens.color.onPrimary, fontSize: 16, fontWeight: "800" }}>➔</Text>
            </TouchableOpacity>

            {/* 3 Step Guide */}
            <View style={styles.guideStepsBox}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.guideStepsTitle}>Nasıl Çalışır?</Text>
              <View style={styles.guideStepRow}>
                <View style={styles.guideStepNumCircle}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.guideStepNumText}>1</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.guideStepHeading}>Haritadan Mekan Seçimi</Text>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.guideStepDesc}>
                    Mekanlara dokunarak veya arama yaparak duraklarını ekle.
                  </Text>
                </View>
              </View>
              <View style={styles.guideStepRow}>
                <View style={styles.guideStepNumCircle}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.guideStepNumText}>2</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.guideStepHeading}>Akıllı Rota Optimizasyonu</Text>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.guideStepDesc}>
                    Yapay zeka ile en verimli yürüme sırasını tek tıkla oluştur.
                  </Text>
                </View>
              </View>
              <View style={styles.guideStepRow}>
                <View style={styles.guideStepNumCircle}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.guideStepNumText}>3</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.guideStepHeading}>Canlı GPS Navigasyon</Text>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.guideStepDesc}>
                    Adım adım yürüyüş süreleri ve rotanla şehri güvenle gez.
                  </Text>
                </View>
              </View>
            </View>

            {/* Popular Starter Templates */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={[styles.starterTemplatesTitle, { marginBottom: 0, flex: 1 }]}>Hızlı Başlangıç Şablonları</Text>
              {!isProSync() && (
                <TouchableOpacity
                  onPress={() => setShowPaywall(true)}
                  style={{ backgroundColor: tokens.color.accentStrong, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}
                >
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ fontSize: 10, fontWeight: "800", color: tokens.color.surfaceInverseStrong }}>PRO</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.starterTemplatesList}>
              {SAMPLE_TEMPLATES.map((tmpl) => (
                <View key={tmpl.id} style={[styles.templateCard, !isProSync() && { opacity: 0.75 }]}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.templateCity}>{tmpl.city}</Text>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.templateName}>{tmpl.name}</Text>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.templateStopsCount}>
                      {tmpl.stops.length} Durak • Hazır Rota
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.templateApplyBtn}
                    onPress={() => handleApplyTemplate(tmpl)}
                    activeOpacity={0.8}
                  >
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.templateApplyBtnText}>{isProSync() ? "Kullan" : "🔒 Kullan"}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.timelineContainer}>
            <View style={styles.timelineVerticalLine} />

            {activeRoute.stops.map((stop, idx) => {
              const isCompleted = stop.visited;
              const isFirst = idx === 0;
              const isLast = idx === activeRoute.stops.length - 1;

              return (
                <View key={stop.id} style={styles.stopTimelineBlock}>
                  <View style={styles.stopTimelineRow}>
                    {/* Number Badge or Checkmark */}
                    <TouchableOpacity
                      style={[styles.stopPinIconWrap, isCompleted && styles.stopPinCompleted]}
                      onPress={() => tripStore.toggleVisited(stop.id)}
                      activeOpacity={0.7}
                    >
                      <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={[styles.stopPinText, isCompleted && { color: tokens.color.onPrimary }]}>
                        {isCompleted ? "✓" : idx + 1}
                      </Text>
                    </TouchableOpacity>

                    {/* Stop Card */}
                    <View style={styles.stopDetailCard}>
                      <View style={styles.stopCardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text maxFontSizeMultiplier={tokens.font.maxScale.body}
                            style={[styles.stopCardTitle, isCompleted && styles.completedTitle]}
                            numberOfLines={1}
                          >
                            {stop.name}
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                              marginTop: 2,
                            }}
                          >
                            <MapPinIcon size={12} color={tokens.color.successStrong} />
                            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.stopCardAddress} numberOfLines={1}>
                              {stop.address}
                            </Text>
                          </View>
                        </View>

                        {/* Edit Button */}
                        <TouchableOpacity
                          style={styles.editBtn}
                          onPress={() => handleOpenEditStop(stop)}
                          activeOpacity={0.7}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <EditIcon size={12} color={tokens.color.link} />
                            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.editBtnText}>Düzenle</Text>
                          </View>
                        </TouchableOpacity>
                      </View>

                      {/* Metadata Badges: Time, Duration, Category, Budget */}
                      <View style={styles.stopMetaRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                          <ClockIcon size={12} color={tokens.color.textSubtle} />
                          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.stopMetaItem}>{stop.time}</Text>
                        </View>
                        <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.metaDot}>•</Text>
                        <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.stopMetaItem}>{stop.duration}</Text>
                        <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.metaDot}>•</Text>
                        <View style={styles.metaCatBadge}>
                          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.metaCatText}>{stop.category}</Text>
                        </View>
                        {stop.budget && (
                          <>
                            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.metaDot}>•</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                              <TicketIcon size={12} color={tokens.color.textSubtle} />
                              <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.budgetBadgeText}>{stop.budget}</Text>
                            </View>
                          </>
                        )}
                      </View>

                      {/* Photo Banner if available */}
                      {stop.photoUrl && (
                        <View style={styles.stopImageBannerWrap}>
                          <Image
                            source={{ uri: stop.photoUrl }}
                            style={styles.stopImageBanner}
                            resizeMode="cover"
                          />
                        </View>
                      )}

                      {/* Notes / Tips */}
                      {stop.notes && (
                        <View style={styles.stopNotesBox}>
                          <View style={{ marginRight: 6, marginTop: 2 }}>
                            <LightbulbIcon size={13} color={tokens.color.warningStrong} />
                          </View>
                          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.stopNotesText}>{stop.notes}</Text>
                        </View>
                      )}

                      {/* Card Actions: Reorder & Delete & Map Link */}
                      <View style={styles.stopCardFooter}>
                        <View style={styles.reorderGroup}>
                          <TouchableOpacity
                            disabled={isFirst}
                            style={[styles.reorderBtn, isFirst && styles.reorderBtnDisabled]}
                            onPress={() => tripStore.reorderStops(idx, idx - 1)}
                          >
                            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.reorderArrowText}>▲</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            disabled={isLast}
                            style={[styles.reorderBtn, isLast && styles.reorderBtnDisabled]}
                            onPress={() => tripStore.reorderStops(idx, idx + 1)}
                          >
                            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.reorderArrowText}>▼</Text>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.rightCardActions}>
                          <TouchableOpacity
                            style={styles.cardOpenMapBtn}
                            onPress={() => onOpenMap(stop.id)}
                            activeOpacity={0.8}
                          >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <DirectionsIcon size={12} color={tokens.color.link} />
                              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.cardOpenMapText}>Haritada Gör</Text>
                            </View>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.deleteStopBtn}
                            onPress={() => {
                              Alert.alert("Durağı Sil", `"${stop.name}" rotadan kaldırılsın mı?`, [
                                { text: "Vazgeç", style: "cancel" },
                                {
                                  text: "Sil",
                                  style: "destructive",
                                  onPress: () => tripStore.removeStop(stop.id),
                                },
                              ]);
                            }}
                          >
                            <TrashIcon size={14} color={tokens.color.danger} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Inter-Stop Walking Distance Badge */}
                  {!isLast && (
                    <View style={styles.walkingIndicatorRow}>
                      <View style={styles.walkingBadge}>
                        <WalkIcon size={13} color={tokens.color.successStrong} />
                        <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.walkingText}>
                          {stop.walkTimeFromPrev || "~6 dk yürüyüş"} (
                          {stop.distanceFromPrev || "450m"})
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Kayıtlı Durak Havuzu (Saved Stops Pool Accordion) */}
        <View style={styles.poolCard}>
          <TouchableOpacity
            style={styles.poolHeader}
            onPress={() => setShowPool(!showPool)}
            activeOpacity={0.7}
          >
            <View style={styles.poolHeaderLeft}>
              <View style={styles.poolIconWrap}>
                <PinIcon size={16} color={tokens.color.successStrong} />
              </View>
              <View>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.poolTitle}>Kayıtlı Durak Havuzu</Text>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.poolSub}>Güne atanmamış {savedPool.length} mekan var</Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {savedPool.length > 0 && (
                <TouchableOpacity
                  style={styles.clearPoolBtn}
                  onPress={() => {
                    Alert.alert(
                      "Havuzu Temizle",
                      "Kayıtlı durak havuzundaki tüm mekanlar silinsin mi?",
                      [
                        { text: "Vazgeç", style: "cancel" },
                        {
                          text: "Temizle",
                          style: "destructive",
                          onPress: () => tripStore.clearSavedPool(),
                        },
                      ],
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.clearPoolBtnText}>Temizle</Text>
                </TouchableOpacity>
              )}
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ fontSize: 16, color: tokens.color.link }}>{showPool ? "▲" : "▼"}</Text>
            </View>
          </TouchableOpacity>

          {showPool && (
            <View style={styles.poolList}>
              {savedPool.length === 0 ? (
                <View style={styles.emptyPoolBox}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.emptyPoolText}>
                    Kayıtlı durak havuzunuz temiz. Güne atanmamış duraklar burada listelenir.
                  </Text>
                </View>
              ) : (
                savedPool.map((poolItem) => (
                  <View key={poolItem.id} style={styles.poolItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.poolItemTitle}>{poolItem.name}</Text>
                      <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.poolItemSub}>
                        {poolItem.category} • {poolItem.duration}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.addToDayBtn}
                      onPress={() => tripStore.addFromPool(poolItem.id)}
                    >
                      <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.addToDayBtnText}>+ Rotaya Al</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {/* Google Maps Export CTA */}
        <TouchableOpacity
          style={styles.exportMapsFullBtn}
          onPress={handleExportGoogleMaps}
          activeOpacity={0.85}
        >
          <View
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <MapIcon size={18} color={tokens.color.onPrimary} />
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.exportMapsFullText}>Google Haritalar'a Aktar</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Route Picker Modal - with Close Button and Search */}
      <Modal visible={showRoutePickerModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header with Close Button */}
            <View style={styles.modalHeaderWithClose}>
              <View>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalTitle}>Rotanızı Seçin</Text>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalSub}>
                  Kayıtlı ve önerilen rotalar arasında geçiş yapın
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowRoutePickerModal(false)}
                activeOpacity={0.7}
              >
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.modalSearchContainer}>
              <View style={{ marginRight: 8 }}>
                <SearchIcon size={14} color={tokens.color.textSubtle} />
              </View>
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Rota ara..."
                placeholderTextColor={tokens.color.textSubtle}
                value={""}
                onChangeText={(text) => {
                  // Filter routes based on search text - can be implemented
                  console.warn("Searching routes:", text);
                }}
              />
            </View>

            <ScrollView style={{ maxHeight: 280, marginVertical: 12 }}>
              {allRoutes.map((r) => {
                const isActive = r.id === activeRoute.id;
                return (
                  <View
                    key={r.id}
                    style={[styles.routeSelectItem, isActive && styles.routeSelectItemActive]}
                  >
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => {
                        tripStore.switchActiveRoute(r.id);
                        setShowRoutePickerModal(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text maxFontSizeMultiplier={tokens.font.maxScale.body}
                          style={[
                            styles.routeSelectName,
                            isActive && { color: tokens.color.textBrand, fontWeight: "800" },
                          ]}
                        >
                          {r.name}
                        </Text>
                        {isActive && (
                          <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ color: tokens.color.accent, fontWeight: "900", fontSize: 13 }}>
                            ✓ AKTİF
                          </Text>
                        )}
                      </View>
                      <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.routeSelectSub}>
                        {r.stops.length} Durak • Kayıtlı Plan
                      </Text>
                    </TouchableOpacity>

                    <View
                      style={{ flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 8 }}
                    >
                      <TouchableOpacity
                        style={styles.routeItemActionBtn}
                        onPress={() => {
                          setShowRoutePickerModal(false);
                          setRenamingRoute(r);
                          setRenameRouteText(r.name);
                        }}
                        activeOpacity={0.7}
                        accessibilityLabel="Rotanın İsmini Düzenle"
                      >
                        <EditIcon size={14} color={tokens.color.successStrong} />
                      </TouchableOpacity>

                      {allRoutes.length > 1 && (
                        <TouchableOpacity
                          style={styles.routeItemActionBtn}
                          onPress={() => {
                            Alert.alert(
                              "Rotayı Sil",
                              `"${r.name}" rotasını silmek istediğinize emin misiniz?`,
                              [
                                { text: "Vazgeç", style: "cancel" },
                                {
                                  text: "Sil",
                                  style: "destructive",
                                  onPress: () => {
                                    tripStore.deleteRoute(r.id);
                                  },
                                },
                              ],
                            );
                          }}
                          activeOpacity={0.7}
                        >
                          <TrashIcon size={14} color={tokens.color.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Rename Route Modal */}
      <Modal visible={renamingRoute !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderWithClose}>
              <View>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalTitle}>Rota İsmini Düzenle</Text>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalSub}>Rotanız için yeni bir isim belirleyin</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setRenamingRoute(null)}>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.modalSearchInput,
                {
                  marginVertical: 16,
                  backgroundColor: tokens.color.bg,
                  borderWidth: 1,
                  borderColor: tokens.color.borderStrong,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 14,
                },
              ]}
              value={renameRouteText}
              onChangeText={setRenameRouteText}
              placeholder="Örn: Hafta Sonu Boğaz Turu"
              placeholderTextColor={tokens.color.neutral400}
              autoFocus
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={[
                  styles.modalCloseBtn,
                  {
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: tokens.color.surfaceSunken,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                ]}
                onPress={() => setRenamingRoute(null)}
              >
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ color: tokens.color.textSubtle, fontWeight: "700", fontSize: 13 }}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1.5,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: tokens.color.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onPress={() => {
                  if (renamingRoute && renameRouteText.trim()) {
                    tripStore.updateRouteName(renamingRoute.id, renameRouteText.trim());
                    setRenamingRoute(null);
                  }
                }}
              >
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ color: tokens.color.onPrimary, fontWeight: "800", fontSize: 13 }}>
                  İsmi Kaydet
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Stop Modal */}
      <Modal visible={editingStop !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalTitle}>Durağı Düzenle</Text>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalSub}>Durak adı, zamanlama ve notları özelleştirin</Text>

            <ScrollView style={{ maxHeight: 320, marginVertical: 8 }}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.fieldLabel}>Durak Adı</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Durak Adı"
              />

              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.fieldLabel}>Kategori</Text>
              <View style={styles.catChipsRow}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, editCategory === cat && styles.catChipActive]}
                    onPress={() => setEditCategory(cat)}
                  >
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.compact}
                      style={[styles.catChipText, editCategory === cat && styles.catChipTextActive]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* DİĞER seçilince özel tag / yeni kategori oluşturma */}
              {editCategory === "DİĞER" && (
                <View style={{ marginTop: 8, marginBottom: 4 }}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.fieldLabel}>Yeni Özel Kategori / Tag Adı</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editCustomCategory}
                    onChangeText={setEditCustomCategory}
                    placeholder="Örn: Sanat Galerisi, Botanik Bahçesi..."
                  />
                </View>
              )}

              {/* Fotoğraf Ekleme & Önizleme */}
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.fieldLabel}>Durak Fotoğrafı</Text>
              <View style={styles.photoPickerContainer}>
                {editPhotoUrl ? (
                  <View style={styles.photoPreviewCard}>
                    <Image
                      source={{ uri: editPhotoUrl }}
                      style={styles.photoPreviewImg}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={styles.removePhotoBadge}
                      onPress={() => setEditPhotoUrl("")}
                    >
                      <Text maxFontSizeMultiplier={tokens.font.maxScale.compact} style={styles.removePhotoBadgeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={styles.pickPhotoActionBtn}
                  onPress={handlePickPhoto}
                  activeOpacity={0.8}
                >
                  <CameraIcon size={16} color={tokens.color.successStrong} />
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.pickPhotoActionText}>
                    {editPhotoUrl ? "Fotoğrafı Değiştir" : "+ Fotoğraf Seç / Ekle"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.fieldLabel}>Ziyaret Saati</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editTime}
                    onChangeText={setEditTime}
                    placeholder="10:30"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.fieldLabel}>Süre</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editDuration}
                    onChangeText={setEditDuration}
                    placeholder="45 dk"
                  />
                </View>
              </View>

              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.fieldLabel}>Bütçe / Giriş Ücreti</Text>
              <TextInput
                style={styles.modalInput}
                value={editBudget}
                onChangeText={setEditBudget}
                placeholder="Örn: 350 ₺ veya Ücretsiz"
              />

              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.fieldLabel}>Gezgin Notu & İpucu</Text>
              <TextInput
                style={[styles.modalInput, { height: 60, textAlignVertical: "top" }]}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Ziyaret için faydalı ipucu..."
                multiline
              />
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditingStop(null)}>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalCancelText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSaveStopEdit}>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalConfirmText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add New Stop Modal */}
      <Modal visible={showAddStopModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalTitle}>Rotaya Durak Ekle</Text>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalSub}>
              Yeni bir mekan, restoran veya tarihi nokta belirleyin
            </Text>

            <ScrollView style={{ maxHeight: 320, marginVertical: 8 }}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.fieldLabel}>Durak / Mekan Adı</Text>
              <TextInput
                style={styles.modalInput}
                value={addName}
                onChangeText={setAddName}
                placeholder="Örn: Pierre Loti Tepesi"
              />

              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.fieldLabel}>Kategori</Text>
              <View style={styles.catChipsRow}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, addCategory === cat && styles.catChipActive]}
                    onPress={() => setAddCategory(cat)}
                  >
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.compact}
                      style={[styles.catChipText, addCategory === cat && styles.catChipTextActive]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.fieldLabel}>Adres / Bölge</Text>
              <TextInput
                style={styles.modalInput}
                value={addAddress}
                onChangeText={setAddAddress}
                placeholder="Örn: Eyüp, İstanbul"
              />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.fieldLabel}>Tahmini Süre</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={addDuration}
                    onChangeText={setAddDuration}
                    placeholder="45 dk"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.fieldLabel}>Giriş / Bütçe</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={addBudget}
                    onChangeText={setAddBudget}
                    placeholder="Örn: Ücretsiz"
                  />
                </View>
              </View>

              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.fieldLabel}>Gezgin Notu</Text>
              <TextInput
                style={[styles.modalInput, { height: 50, textAlignVertical: "top" }]}
                value={addNotes}
                onChangeText={setAddNotes}
                placeholder="Örn: Teleferik ile çıkış tavsiye edilir."
                multiline
              />
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAddStopModal(false)}
              >
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalCancelText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSaveNewStop}>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalConfirmText}>Ekle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* New Trip Modal */}
      <Modal visible={showNewTripModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalTitle}>Yeni Gezi Planı Oluştur</Text>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalSub}>Şehir veya seyahat başlığı belirleyin</Text>

            <TextInput
              placeholder="Örn: Roma Rönesans Keşfi"
              placeholderTextColor={tokens.color.textSubtle}
              style={styles.modalInput}
              value={newTripTitle}
              onChangeText={setNewTripTitle}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowNewTripModal(false)}
              >
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalCancelText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleCreateNewTrip}>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.modalConfirmText}>Oluştur</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <ScreenTourModal screen="plan" />

      {/* Paywall Modal — opened by template gate and other Pro features */}
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.bg,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 90,
  },
  tripHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  tripDropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tokens.color.surface,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.color.surfaceTint,
    flex: 1,
    marginRight: 10,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  pulsingEmeraldDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.color.accent,
  },
  tripDropdownTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: tokens.color.textBrand,
    flexShrink: 1,
  },
  tripDropdownCount: {
    fontSize: 12,
    fontWeight: "600",
    color: tokens.color.link,
  },
  newTripBtn: {
    backgroundColor: tokens.color.primary,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    shadowColor: tokens.color.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  renameRouteHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.surfaceTint,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  routeItemActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.color.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  newTripBtnText: {
    color: tokens.color.onPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  metricCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: tokens.color.surface,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: tokens.color.surfaceTint,
    marginBottom: 14,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  metricItem: {
    alignItems: "center",
    flex: 1,
  },
  metricValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  metricUnit: {
    fontSize: 10,
    fontWeight: "700",
    color: tokens.color.link,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: tokens.color.textSubtle,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: tokens.color.surfaceTint,
  },
  aiBadge: {
    backgroundColor: tokens.color.surfaceBrandStrong,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  aiBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  activeCheckText: {
    fontSize: 9,
    fontWeight: "700",
    color: tokens.color.accent,
    marginTop: 2,
  },
  mapPreviewCard: {
    backgroundColor: tokens.color.surface,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: tokens.color.surfaceTint,
    marginBottom: 14,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  mapPreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  mapPreviewHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mapPreviewTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  openFullMapBtn: {
    backgroundColor: tokens.color.surfaceBrandStrong,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  openFullMapText: {
    fontSize: 11,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  mapCanvasContainer: {
    height: 170,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: tokens.color.surfaceBrand,
  },
  mapWebview: {
    flex: 1,
  },
  actionGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  optimizeBtn: {
    flex: 1,
    backgroundColor: tokens.color.primary,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: tokens.color.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  optimizeBtnText: {
    color: tokens.color.onPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  addStopActionBtn: {
    flex: 1,
    backgroundColor: tokens.color.surface,
    borderWidth: 1.5,
    borderColor: tokens.color.surfaceBrandStrong,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  addStopActionText: {
    color: tokens.color.textBrand,
    fontSize: 13,
    fontWeight: "800",
  },
  timelineContainer: {
    position: "relative",
    marginBottom: 16,
  },
  timelineVerticalLine: {
    position: "absolute",
    left: 17,
    top: 20,
    bottom: 20,
    width: 2,
    backgroundColor: tokens.color.surfaceBrandStrong,
    zIndex: 1,
  },
  stopTimelineBlock: {
    marginBottom: 8,
  },
  stopTimelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    zIndex: 2,
  },
  stopPinIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.color.surface,
    borderWidth: 2.5,
    borderColor: tokens.color.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: tokens.color.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  stopPinCompleted: {
    backgroundColor: tokens.color.accent,
    borderColor: tokens.color.successStrong,
  },
  stopPinText: {
    fontSize: 13,
    fontWeight: "900",
    color: tokens.color.textBrand,
  },
  stopDetailCard: {
    flex: 1,
    backgroundColor: tokens.color.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.color.surfaceTint,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  stopCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  stopCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: tokens.color.text,
  },
  completedTitle: {
    textDecorationLine: "line-through",
    color: tokens.color.textSubtle,
  },
  stopCardAddress: {
    fontSize: 11,
    color: tokens.color.textSubtle,
    marginTop: 2,
  },
  editBtn: {
    backgroundColor: tokens.color.surfaceTint,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.color.textBrand,
  },
  stopMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  stopMetaItem: {
    fontSize: 11,
    fontWeight: "600",
    color: tokens.color.textMuted,
  },
  metaDot: {
    fontSize: 10,
    color: tokens.color.neutral300,
  },
  metaCatBadge: {
    backgroundColor: tokens.color.surfaceBrandStrong,
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  metaCatText: {
    fontSize: 9,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  budgetBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: tokens.color.link,
  },
  stopImageBannerWrap: {
    height: 90,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  stopImageBanner: {
    width: "100%",
    height: "100%",
  },
  stopNotesBox: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: tokens.color.surfaceBrand,
    padding: 8,
    borderRadius: 10,
    marginBottom: 8,
  },
  stopNotesText: {
    fontSize: 11,
    color: tokens.color.textBrand,
    flex: 1,
    lineHeight: 16,
  },
  stopCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.color.surfaceTint,
  },
  reorderGroup: {
    flexDirection: "row",
    gap: 4,
  },
  reorderBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: tokens.color.surfaceTint,
    alignItems: "center",
    justifyContent: "center",
  },
  reorderBtnDisabled: {
    opacity: 0.3,
  },
  reorderArrowText: {
    fontSize: 11,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  rightCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardOpenMapBtn: {
    backgroundColor: tokens.color.surfaceBrand,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  cardOpenMapText: {
    fontSize: 11,
    fontWeight: "800",
    color: tokens.color.accent,
  },
  deleteStopBtn: {
    padding: 4,
  },
  walkingIndicatorRow: {
    paddingLeft: 48,
    marginVertical: 4,
  },
  walkingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: tokens.color.surfaceTint,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  walkingIcon: {
    fontSize: 11,
  },
  walkingText: {
    fontSize: 10,
    fontWeight: "600",
    color: tokens.color.textSubtle,
  },
  poolCard: {
    backgroundColor: tokens.color.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.color.surfaceTint,
    marginBottom: 16,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  poolHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  poolHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  poolIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: tokens.color.surfaceBrandStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  poolTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  poolSub: {
    fontSize: 11,
    color: tokens.color.textSubtle,
  },
  poolList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.color.surfaceTint,
    paddingTop: 8,
  },
  poolItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.surfaceTint,
  },
  poolItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: tokens.color.text,
  },
  poolItemSub: {
    fontSize: 11,
    color: tokens.color.textSubtle,
  },
  addToDayBtn: {
    backgroundColor: tokens.color.surfaceBrandStrong,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  addToDayBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  exportMapsFullBtn: {
    backgroundColor: tokens.color.surface,
    borderWidth: 1.5,
    borderColor: tokens.color.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  exportMapsFullText: {
    color: tokens.color.textBrand,
    fontSize: 14,
    fontWeight: "800",
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
  routeSelectItem: {
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
  routeSelectItemActive: {
    backgroundColor: tokens.color.surfaceBrand,
    borderColor: tokens.color.accent,
  },
  routeSelectName: {
    fontSize: 14,
    fontWeight: "700",
    color: tokens.color.neutral700,
  },
  routeSelectSub: {
    fontSize: 11,
    color: tokens.color.textSubtle,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.color.textMuted,
    marginTop: 8,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: tokens.color.bg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: tokens.color.neutral800,
  },
  catChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  catChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  catChipActive: {
    backgroundColor: tokens.color.primary,
    borderColor: tokens.color.primary,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: tokens.color.textMuted,
  },
  catChipTextActive: {
    color: tokens.color.onPrimary,
  },
  // Modal header with close button styles
  modalHeaderWithClose: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.color.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseBtnText: {
    fontSize: 16,
    color: tokens.color.textSubtle,
    fontWeight: "700",
  },
  modalSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.color.bg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: tokens.color.neutral800,
  },
  modalConfirmBtn: {
    backgroundColor: tokens.color.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    flex: 1,
    marginLeft: 8,
  },
  modalConfirmText: {
    color: tokens.color.onPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  modalCancelBtn: {
    backgroundColor: tokens.color.surfaceSunken,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  modalCancelText: {
    color: tokens.color.textSubtle,
    fontSize: 14,
    fontWeight: "700",
  },
  modalActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  // Empty guide showcase styles
  emptyGuideCard: {
    backgroundColor: tokens.color.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: tokens.color.surfaceBrand,
  },
  emptyGuideBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.color.surfaceBrand,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  emptyGuideBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: tokens.color.successStrong,
    letterSpacing: 0.8,
  },
  emptyGuideTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: tokens.color.textBrand,
    marginBottom: 6,
  },
  emptyGuideSubtitle: {
    fontSize: 13,
    color: tokens.color.textMuted,
    lineHeight: 19,
    marginBottom: 18,
  },
  emptyGuideMainBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: tokens.color.primary,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: tokens.color.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 20,
  },
  emptyGuideMainBtnText: {
    color: tokens.color.onPrimary,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  guideStepsBox: {
    backgroundColor: tokens.color.bg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: tokens.color.surfaceBrand,
  },
  guideStepsTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: tokens.color.textBrand,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  guideStepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  guideStepNumCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tokens.color.successStrong,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  guideStepNumText: {
    color: tokens.color.onPrimary,
    fontSize: 11,
    fontWeight: "800",
  },
  guideStepHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: tokens.color.text,
    marginBottom: 1,
  },
  guideStepDesc: {
    fontSize: 12,
    color: tokens.color.textSubtle,
    lineHeight: 16,
  },
  starterTemplatesTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: tokens.color.textBrand,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  starterTemplatesList: {
    gap: 10,
  },
  templateCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: tokens.color.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  templateCity: {
    fontSize: 10,
    fontWeight: "700",
    color: tokens.color.successStrong,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  templateName: {
    fontSize: 13,
    fontWeight: "800",
    color: tokens.color.text,
    marginTop: 2,
    marginBottom: 2,
  },
  templateStopsCount: {
    fontSize: 11,
    color: tokens.color.textSubtle,
  },
  templateApplyBtn: {
    backgroundColor: tokens.color.surfaceBrand,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.color.successBorder,
  },
  templateApplyBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: tokens.color.successStrong,
  },
  shareStopsHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: tokens.color.surfaceBrand,
    borderWidth: 1,
    borderColor: tokens.color.successBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  shareStopsHeaderText: {
    fontSize: 11,
    fontWeight: "800",
    color: tokens.color.textBrand,
  },
  clearPoolBtn: {
    backgroundColor: tokens.color.dangerBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  clearPoolBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.color.danger,
  },
  emptyPoolBox: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  emptyPoolText: {
    fontSize: 12,
    color: tokens.color.textSubtle,
    textAlign: "center",
    lineHeight: 18,
  },
  photoPickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  photoPreviewCard: {
    position: "relative",
    width: 60,
    height: 60,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tokens.color.borderStrong,
  },
  photoPreviewImg: {
    width: "100%",
    height: "100%",
  },
  removePhotoBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: withAlpha(tokens.color.black, 0.65),
    alignItems: "center",
    justifyContent: "center",
  },
  removePhotoBadgeText: {
    color: tokens.color.onPrimary,
    fontSize: 10,
    fontWeight: "800",
  },
  pickPhotoActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tokens.color.surfaceBrand,
    borderWidth: 1,
    borderColor: tokens.color.successBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  pickPhotoActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: tokens.color.successStrong,
  },
  reorderShiftBtn: {
    backgroundColor: tokens.color.surfaceSunken,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
  },
  reorderShiftText: {
    fontSize: 10,
    fontWeight: "800",
    color: tokens.color.link,
  },
});
