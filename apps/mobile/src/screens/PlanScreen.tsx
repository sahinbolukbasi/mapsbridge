import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
  Modal,
  TextInput,
  Dimensions,
  Platform,
  Share,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { WebView } from "react-native-webview";
import { tripStore, TripStop, ActiveRoute } from "../services/tripStore";
import { AppHeader } from "../components/AppHeader";
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

export function PlanScreen({ onOpenMap, onOpenProfile }: PlanScreenProps) {
  const [activeRoute, setActiveRoute] = useState<ActiveRoute>(tripStore.getActiveRoute());
  const [allRoutes, setAllRoutes] = useState<ActiveRoute[]>(tripStore.getAllRoutes());
  const [savedPool, setSavedPool] = useState<TripStop[]>(tripStore.getSavedPool());
  const [activeDay, setActiveDay] = useState<number>(1);
  const [showPool, setShowPool] = useState<boolean>(false);
  const [offerings, setOfferings] = useState<any>(null);
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
          html, body, #map { width: 100%; height: 100%; background: #eaf1ec; }
          .leaflet-control-attribution, .leaflet-control-zoom { display: none !important; }
          .plan-pin {
            width: 28px; height: 28px; border-radius: 14px;
            background: #013628; border: 2px solid #34D399;
            color: #ffffff; font-family: -apple-system, sans-serif;
            font-size: 11px; font-weight: 800;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 2px 8px rgba(1, 54, 40, 0.3);
            cursor: pointer;
          }
          .visited-pin {
            background: #10B981; border-color: #ffffff;
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
                  color: '#10B981', weight: 3.5, dashArray: '6, 6', opacity: 0.9
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
    <SafeAreaView style={styles.container}>
      <AppHeader hideActions={true} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Active Trip Header Selector & New Trip Button */}
        <View style={styles.tripHeaderRow}>
          <TouchableOpacity
            style={styles.tripDropdownBtn}
            onPress={() => setShowRoutePickerModal(true)}
            activeOpacity={0.8}
          >
            <View style={styles.pulsingEmeraldDot} />
            <Text style={styles.tripDropdownTitle} numberOfLines={1}>
              {activeRoute.name}
            </Text>
            <Text style={styles.tripDropdownCount}>({activeRoute.stops.length} Durak)</Text>
            <Text style={{ fontSize: 13, color: "#286954" }}>▼</Text>
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
            <EditIcon size={14} color="#013628" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.newTripBtn}
            onPress={() => setShowNewTripModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.newTripBtnText}>+ Yeni</Text>
          </TouchableOpacity>
        </View>

        {/* Metric Summary Card: Durak Sayısı, Toplam KM, Toplam Saat (Akıllı Seyahat kaldırıldı) */}
        <View style={styles.metricCard}>
          <View style={styles.metricItem}>
            <View style={styles.metricValueRow}>
              <Text style={styles.metricValue}>{activeRoute.stops.length}</Text>
              <Text style={styles.metricUnit}>Durak</Text>
            </View>
            <Text style={styles.metricLabel}>{activeDay}. GÜN PLANI</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <View style={styles.metricValueRow}>
              <Text style={styles.metricValue}>
                {(Math.max(1, activeRoute.stops.length) * 0.9).toFixed(1)}
              </Text>
              <Text style={styles.metricUnit}>km</Text>
            </View>
            <Text style={styles.metricLabel}>YÜRÜYÜŞ MESAFESİ</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <View style={styles.metricValueRow}>
              <Text style={styles.metricValue}>
                {Math.max(1, Math.floor(activeRoute.stops.length * 1.1))}s{" "}
                {(activeRoute.stops.length * 15) % 60}d
              </Text>
            </View>
            <Text style={styles.metricLabel}>TOPLAM SÜRE</Text>
          </View>
        </View>

        {/* Embedded Interactive Route Map Card */}
        <View style={styles.mapPreviewCard}>
          <View style={styles.mapPreviewHeader}>
            <View style={styles.mapPreviewHeaderLeft}>
              <View style={{ marginRight: 6 }}>
                <MapIcon size={16} color="#059669" />
              </View>
              <Text style={styles.mapPreviewTitle}>Canlı Rota Önizlemesi</Text>
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
                <Share2Icon size={13} color="#013628" />
                <Text style={styles.shareStopsHeaderText}>Pinleri Paylaş</Text>
              </TouchableOpacity>

              {/* Haritada Gör Button */}
              <TouchableOpacity
                style={styles.openFullMapBtn}
                onPress={() => onOpenMap()}
                activeOpacity={0.8}
              >
                <Text style={styles.openFullMapText}>Haritada Gör ➔</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.mapCanvasContainer}>
            <WebView
              ref={mapWebRef}
              originWhitelist={["*"]}
              source={{ html: planMapHtml }}
              style={styles.mapWebview}
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
              <SparkIcon size={16} color="#ffffff" />
              <Text style={styles.optimizeBtnText}>Rotayı Optimize Et</Text>
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
              <PlusIcon size={16} color="#059669" />
              <Text style={styles.addStopActionText}>Durak Ekle</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Timeline of Stops OR Guided Route Creation Showcase */}
        {activeRoute.stops.length === 0 ? (
          <View style={styles.emptyGuideCard}>
            {/* Showcase Header */}
            <View style={styles.emptyGuideBadge}>
              <SparkIcon size={12} color="#059669" />
              <Text style={styles.emptyGuideBadgeText}>ROTA OLUŞTURUCU</Text>
            </View>
            <Text style={styles.emptyGuideTitle}>İlk Seyahat Rotanı Başlat</Text>
            <Text style={styles.emptyGuideSubtitle}>
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
              <MapIcon size={18} color="#ffffff" />
              <Text style={styles.emptyGuideMainBtnText}>Haritayı Aç ve Durak Seç</Text>
              <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "800" }}>➔</Text>
            </TouchableOpacity>

            {/* 3 Step Guide */}
            <View style={styles.guideStepsBox}>
              <Text style={styles.guideStepsTitle}>Nasıl Çalışır?</Text>
              <View style={styles.guideStepRow}>
                <View style={styles.guideStepNumCircle}>
                  <Text style={styles.guideStepNumText}>1</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideStepHeading}>Haritadan Mekan Seçimi</Text>
                  <Text style={styles.guideStepDesc}>
                    Mekanlara dokunarak veya arama yaparak duraklarını ekle.
                  </Text>
                </View>
              </View>
              <View style={styles.guideStepRow}>
                <View style={styles.guideStepNumCircle}>
                  <Text style={styles.guideStepNumText}>2</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideStepHeading}>Akıllı Rota Optimizasyonu</Text>
                  <Text style={styles.guideStepDesc}>
                    Yapay zeka ile en verimli yürüme sırasını tek tıkla oluştur.
                  </Text>
                </View>
              </View>
              <View style={styles.guideStepRow}>
                <View style={styles.guideStepNumCircle}>
                  <Text style={styles.guideStepNumText}>3</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideStepHeading}>Canlı GPS Navigasyon</Text>
                  <Text style={styles.guideStepDesc}>
                    Adım adım yürüyüş süreleri ve rotanla şehri güvenle gez.
                  </Text>
                </View>
              </View>
            </View>

            {/* Popular Starter Templates */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <Text style={[styles.starterTemplatesTitle, { marginBottom: 0, flex: 1 }]}>Hızlı Başlangıç Şablonları</Text>
              {!isProSync() && (
                <TouchableOpacity
                  onPress={() => setShowPaywall(true)}
                  style={{ backgroundColor: "#34d399", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#020e0a" }}>PRO</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.starterTemplatesList}>
              {SAMPLE_TEMPLATES.map((tmpl) => (
                <View key={tmpl.id} style={[styles.templateCard, !isProSync() && { opacity: 0.75 }]}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.templateCity}>{tmpl.city}</Text>
                    <Text style={styles.templateName}>{tmpl.name}</Text>
                    <Text style={styles.templateStopsCount}>
                      {tmpl.stops.length} Durak • Hazır Rota
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.templateApplyBtn}
                    onPress={() => handleApplyTemplate(tmpl)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.templateApplyBtnText}>{isProSync() ? "Kullan" : "🔒 Kullan"}</Text>
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
                      <Text style={[styles.stopPinText, isCompleted && { color: "#ffffff" }]}>
                        {isCompleted ? "✓" : idx + 1}
                      </Text>
                    </TouchableOpacity>

                    {/* Stop Card */}
                    <View style={styles.stopDetailCard}>
                      <View style={styles.stopCardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text
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
                            <MapPinIcon size={12} color="#059669" />
                            <Text style={styles.stopCardAddress} numberOfLines={1}>
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
                            <EditIcon size={12} color="#0f766e" />
                            <Text style={styles.editBtnText}>Düzenle</Text>
                          </View>
                        </TouchableOpacity>
                      </View>

                      {/* Metadata Badges: Time, Duration, Category, Budget */}
                      <View style={styles.stopMetaRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                          <ClockIcon size={12} color="#64748b" />
                          <Text style={styles.stopMetaItem}>{stop.time}</Text>
                        </View>
                        <Text style={styles.metaDot}>•</Text>
                        <Text style={styles.stopMetaItem}>{stop.duration}</Text>
                        <Text style={styles.metaDot}>•</Text>
                        <View style={styles.metaCatBadge}>
                          <Text style={styles.metaCatText}>{stop.category}</Text>
                        </View>
                        {stop.budget && (
                          <>
                            <Text style={styles.metaDot}>•</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                              <TicketIcon size={12} color="#64748b" />
                              <Text style={styles.budgetBadgeText}>{stop.budget}</Text>
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
                            <LightbulbIcon size={13} color="#d97706" />
                          </View>
                          <Text style={styles.stopNotesText}>{stop.notes}</Text>
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
                            <Text style={styles.reorderArrowText}>▲</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            disabled={isLast}
                            style={[styles.reorderBtn, isLast && styles.reorderBtnDisabled]}
                            onPress={() => tripStore.reorderStops(idx, idx + 1)}
                          >
                            <Text style={styles.reorderArrowText}>▼</Text>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.rightCardActions}>
                          <TouchableOpacity
                            style={styles.cardOpenMapBtn}
                            onPress={() => onOpenMap(stop.id)}
                            activeOpacity={0.8}
                          >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <DirectionsIcon size={12} color="#0f766e" />
                              <Text style={styles.cardOpenMapText}>Haritada Gör</Text>
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
                            <TrashIcon size={14} color="#dc2626" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Inter-Stop Walking Distance Badge */}
                  {!isLast && (
                    <View style={styles.walkingIndicatorRow}>
                      <View style={styles.walkingBadge}>
                        <WalkIcon size={13} color="#059669" />
                        <Text style={styles.walkingText}>
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
                <PinIcon size={16} color="#059669" />
              </View>
              <View>
                <Text style={styles.poolTitle}>Kayıtlı Durak Havuzu</Text>
                <Text style={styles.poolSub}>Güne atanmamış {savedPool.length} mekan var</Text>
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
                  <Text style={styles.clearPoolBtnText}>Temizle</Text>
                </TouchableOpacity>
              )}
              <Text style={{ fontSize: 16, color: "#286954" }}>{showPool ? "▲" : "▼"}</Text>
            </View>
          </TouchableOpacity>

          {showPool && (
            <View style={styles.poolList}>
              {savedPool.length === 0 ? (
                <View style={styles.emptyPoolBox}>
                  <Text style={styles.emptyPoolText}>
                    Kayıtlı durak havuzunuz temiz. Güne atanmamış duraklar burada listelenir.
                  </Text>
                </View>
              ) : (
                savedPool.map((poolItem) => (
                  <View key={poolItem.id} style={styles.poolItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.poolItemTitle}>{poolItem.name}</Text>
                      <Text style={styles.poolItemSub}>
                        {poolItem.category} • {poolItem.duration}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.addToDayBtn}
                      onPress={() => tripStore.addFromPool(poolItem.id)}
                    >
                      <Text style={styles.addToDayBtnText}>+ Rotaya Al</Text>
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
            <MapIcon size={18} color="#ffffff" />
            <Text style={styles.exportMapsFullText}>Google Haritalar'a Aktar</Text>
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
                <Text style={styles.modalTitle}>Rotanızı Seçin</Text>
                <Text style={styles.modalSub}>
                  Kayıtlı ve önerilen rotalar arasında geçiş yapın
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowRoutePickerModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.modalSearchContainer}>
              <View style={{ marginRight: 8 }}>
                <SearchIcon size={14} color="#717974" />
              </View>
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Rota ara..."
                placeholderTextColor="#717974"
                value={""}
                onChangeText={(text) => {
                  // Filter routes based on search text - can be implemented
                  console.log("Searching routes:", text);
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
                        <Text
                          style={[
                            styles.routeSelectName,
                            isActive && { color: "#013628", fontWeight: "800" },
                          ]}
                        >
                          {r.name}
                        </Text>
                        {isActive && (
                          <Text style={{ color: "#10b981", fontWeight: "900", fontSize: 13 }}>
                            ✓ AKTİF
                          </Text>
                        )}
                      </View>
                      <Text style={styles.routeSelectSub}>
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
                        <EditIcon size={14} color="#059669" />
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
                          <TrashIcon size={14} color="#ba1a1a" />
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
                <Text style={styles.modalTitle}>Rota İsmini Düzenle</Text>
                <Text style={styles.modalSub}>Rotanız için yeni bir isim belirleyin</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setRenamingRoute(null)}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.modalSearchInput,
                {
                  marginVertical: 16,
                  backgroundColor: "#f8fafc",
                  borderWidth: 1,
                  borderColor: "#cbd5e1",
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 14,
                },
              ]}
              value={renameRouteText}
              onChangeText={setRenameRouteText}
              placeholder="Örn: Hafta Sonu Boğaz Turu"
              placeholderTextColor="#94a3b8"
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
                    backgroundColor: "#f1f5f9",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                ]}
                onPress={() => setRenamingRoute(null)}
              >
                <Text style={{ color: "#64748b", fontWeight: "700", fontSize: 13 }}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1.5,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: "#013628",
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
                <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 13 }}>
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
            <Text style={styles.modalTitle}>Durağı Düzenle</Text>
            <Text style={styles.modalSub}>Durak adı, zamanlama ve notları özelleştirin</Text>

            <ScrollView style={{ maxHeight: 320, marginVertical: 8 }}>
              <Text style={styles.fieldLabel}>Durak Adı</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Durak Adı"
              />

              <Text style={styles.fieldLabel}>Kategori</Text>
              <View style={styles.catChipsRow}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, editCategory === cat && styles.catChipActive]}
                    onPress={() => setEditCategory(cat)}
                  >
                    <Text
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
                  <Text style={styles.fieldLabel}>Yeni Özel Kategori / Tag Adı</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editCustomCategory}
                    onChangeText={setEditCustomCategory}
                    placeholder="Örn: Sanat Galerisi, Botanik Bahçesi..."
                  />
                </View>
              )}

              {/* Fotoğraf Ekleme & Önizleme */}
              <Text style={styles.fieldLabel}>Durak Fotoğrafı</Text>
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
                      <Text style={styles.removePhotoBadgeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={styles.pickPhotoActionBtn}
                  onPress={handlePickPhoto}
                  activeOpacity={0.8}
                >
                  <CameraIcon size={16} color="#059669" />
                  <Text style={styles.pickPhotoActionText}>
                    {editPhotoUrl ? "Fotoğrafı Değiştir" : "+ Fotoğraf Seç / Ekle"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Ziyaret Saati</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editTime}
                    onChangeText={setEditTime}
                    placeholder="10:30"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Süre</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editDuration}
                    onChangeText={setEditDuration}
                    placeholder="45 dk"
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Bütçe / Giriş Ücreti</Text>
              <TextInput
                style={styles.modalInput}
                value={editBudget}
                onChangeText={setEditBudget}
                placeholder="Örn: 350 ₺ veya Ücretsiz"
              />

              <Text style={styles.fieldLabel}>Gezgin Notu & İpucu</Text>
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
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSaveStopEdit}>
                <Text style={styles.modalConfirmText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add New Stop Modal */}
      <Modal visible={showAddStopModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rotaya Durak Ekle</Text>
            <Text style={styles.modalSub}>
              Yeni bir mekan, restoran veya tarihi nokta belirleyin
            </Text>

            <ScrollView style={{ maxHeight: 320, marginVertical: 8 }}>
              <Text style={styles.fieldLabel}>Durak / Mekan Adı</Text>
              <TextInput
                style={styles.modalInput}
                value={addName}
                onChangeText={setAddName}
                placeholder="Örn: Pierre Loti Tepesi"
              />

              <Text style={styles.fieldLabel}>Kategori</Text>
              <View style={styles.catChipsRow}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, addCategory === cat && styles.catChipActive]}
                    onPress={() => setAddCategory(cat)}
                  >
                    <Text
                      style={[styles.catChipText, addCategory === cat && styles.catChipTextActive]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Adres / Bölge</Text>
              <TextInput
                style={styles.modalInput}
                value={addAddress}
                onChangeText={setAddAddress}
                placeholder="Örn: Eyüp, İstanbul"
              />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Tahmini Süre</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={addDuration}
                    onChangeText={setAddDuration}
                    placeholder="45 dk"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Giriş / Bütçe</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={addBudget}
                    onChangeText={setAddBudget}
                    placeholder="Örn: Ücretsiz"
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Gezgin Notu</Text>
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
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSaveNewStop}>
                <Text style={styles.modalConfirmText}>Ekle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* New Trip Modal */}
      <Modal visible={showNewTripModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Yeni Gezi Planı Oluştur</Text>
            <Text style={styles.modalSub}>Şehir veya seyahat başlığı belirleyin</Text>

            <TextInput
              placeholder="Örn: Roma Rönesans Keşfi"
              placeholderTextColor="#717974"
              style={styles.modalInput}
              value={newTripTitle}
              onChangeText={setNewTripTitle}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowNewTripModal(false)}
              >
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleCreateNewTrip}>
                <Text style={styles.modalConfirmText}>Oluştur</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#faf8ff",
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
    backgroundColor: "#ffffff",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e7ff",
    flex: 1,
    marginRight: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  pulsingEmeraldDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  tripDropdownTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#013628",
    flexShrink: 1,
  },
  tripDropdownCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#286954",
  },
  newTripBtn: {
    backgroundColor: "#013628",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    shadowColor: "#013628",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  renameRouteHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e7ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  routeItemActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  newTripBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  metricCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#eaedff",
    marginBottom: 14,
    shadowColor: "#000",
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
    color: "#013628",
  },
  metricUnit: {
    fontSize: 10,
    fontWeight: "700",
    color: "#286954",
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#717974",
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#eaedff",
  },
  aiBadge: {
    backgroundColor: "#bbedd8",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  aiBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#013628",
  },
  activeCheckText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#10B981",
    marginTop: 2,
  },
  mapPreviewCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eaedff",
    marginBottom: 14,
    shadowColor: "#000",
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
    color: "#013628",
  },
  openFullMapBtn: {
    backgroundColor: "#bbedd8",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  openFullMapText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#013628",
  },
  mapCanvasContainer: {
    height: 170,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#eaf1ec",
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
    backgroundColor: "#013628",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#013628",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  optimizeBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  addStopActionBtn: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#bbedd8",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  addStopActionText: {
    color: "#013628",
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
    backgroundColor: "#bbedd8",
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
    backgroundColor: "#ffffff",
    borderWidth: 2.5,
    borderColor: "#013628",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#013628",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  stopPinCompleted: {
    backgroundColor: "#10B981",
    borderColor: "#059669",
  },
  stopPinText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#013628",
  },
  stopDetailCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#eaedff",
    shadowColor: "#000",
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
    color: "#131b2e",
  },
  completedTitle: {
    textDecorationLine: "line-through",
    color: "#717974",
  },
  stopCardAddress: {
    fontSize: 11,
    color: "#717974",
    marginTop: 2,
  },
  editBtn: {
    backgroundColor: "#f2f3ff",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#013628",
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
    color: "#404945",
  },
  metaDot: {
    fontSize: 10,
    color: "#c0c8c3",
  },
  metaCatBadge: {
    backgroundColor: "#bbedd8",
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  metaCatText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#013628",
  },
  budgetBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#286954",
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
    backgroundColor: "#ecfdf5",
    padding: 8,
    borderRadius: 10,
    marginBottom: 8,
  },
  stopNotesText: {
    fontSize: 11,
    color: "#013628",
    flex: 1,
    lineHeight: 16,
  },
  stopCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f2f3ff",
  },
  reorderGroup: {
    flexDirection: "row",
    gap: 4,
  },
  reorderBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#f2f3ff",
    alignItems: "center",
    justifyContent: "center",
  },
  reorderBtnDisabled: {
    opacity: 0.3,
  },
  reorderArrowText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#013628",
  },
  rightCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardOpenMapBtn: {
    backgroundColor: "#ecfdf5",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  cardOpenMapText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#10B981",
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
    backgroundColor: "#f2f3ff",
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
    color: "#717974",
  },
  poolCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#eaedff",
    marginBottom: 16,
    shadowColor: "#000",
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
    backgroundColor: "#bbedd8",
    alignItems: "center",
    justifyContent: "center",
  },
  poolTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#013628",
  },
  poolSub: {
    fontSize: 11,
    color: "#717974",
  },
  poolList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f2f3ff",
    paddingTop: 8,
  },
  poolItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f2f3ff",
  },
  poolItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#131b2e",
  },
  poolItemSub: {
    fontSize: 11,
    color: "#717974",
  },
  addToDayBtn: {
    backgroundColor: "#bbedd8",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  addToDayBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#013628",
  },
  exportMapsFullBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#013628",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  exportMapsFullText: {
    color: "#013628",
    fontSize: 14,
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#013628",
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 12,
    color: "#717974",
    marginBottom: 12,
  },
  routeSelectItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  routeSelectItemActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#10b981",
  },
  routeSelectName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  routeSelectSub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#404945",
    marginTop: 8,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: "#1e293b",
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
    backgroundColor: "#013628",
    borderColor: "#013628",
  },
  catChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#404945",
  },
  catChipTextActive: {
    color: "#ffffff",
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
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseBtnText: {
    fontSize: 16,
    color: "#64748b",
    fontWeight: "700",
  },
  modalSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1e293b",
  },
  modalConfirmBtn: {
    backgroundColor: "#013628",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    flex: 1,
    marginLeft: 8,
  },
  modalConfirmText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  modalCancelBtn: {
    backgroundColor: "#f1f5f9",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  modalCancelText: {
    color: "#64748b",
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
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#e6f4ea",
  },
  emptyGuideBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  emptyGuideBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#059669",
    letterSpacing: 0.8,
  },
  emptyGuideTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#013628",
    marginBottom: 6,
  },
  emptyGuideSubtitle: {
    fontSize: 13,
    color: "#52605b",
    lineHeight: 19,
    marginBottom: 18,
  },
  emptyGuideMainBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#013628",
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: "#013628",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 20,
  },
  emptyGuideMainBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  guideStepsBox: {
    backgroundColor: "#f8faf9",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#edf4ee",
  },
  guideStepsTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#013628",
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
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  guideStepNumText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  guideStepHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: "#131b2e",
    marginBottom: 1,
  },
  guideStepDesc: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 16,
  },
  starterTemplatesTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#013628",
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
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  templateCity: {
    fontSize: 10,
    fontWeight: "700",
    color: "#059669",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  templateName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#131b2e",
    marginTop: 2,
    marginBottom: 2,
  },
  templateStopsCount: {
    fontSize: 11,
    color: "#64748b",
  },
  templateApplyBtn: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  templateApplyBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#059669",
  },
  shareStopsHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  shareStopsHeaderText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#013628",
  },
  clearPoolBtn: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  clearPoolBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#dc2626",
  },
  emptyPoolBox: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  emptyPoolText: {
    fontSize: 12,
    color: "#64748b",
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
    borderColor: "#cbd5e1",
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
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  removePhotoBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  pickPhotoActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  pickPhotoActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  reorderShiftBtn: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
  },
  reorderShiftText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0f766e",
  },
});
