"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { userStorage } from "../lib/user-storage";
import { AuthActionModal } from "../components/auth-gate";
import { getStoredSession } from "../lib/cognito";
import { isFollowingUser, toggleFollowUser } from "../lib/follow-system";
import "./public-profile.css";
import { PageHeader, PageShell } from "../components/ui";

export interface SavedAddressItem {
  id: string;
  label: string;
  address?: string;
  note?: string;
  category?: string;
  group?: string;
  lat: number;
  lng: number;
  visited?: boolean;
  photo?: string;
}

export interface DirectMessageItem {
  id: string;
  fromUsername: string;
  toUsername: string;
  routeTitle: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface RouteCardItem {
  id: string;
  title: string;
  badgeTag: string;
  badgeType: "featured" | "free" | "trek";
  rating: number;
  ratingCount: number;
  duration: string;
  stopsCount: number;
  category: string;
  description: string;
  priceTag: string;
  priceLabel: string;
  routeCode?: string;
  image: string;
  stops: SavedAddressItem[];
}

export default function PublicProfileClient({ initialUsername }: { initialUsername: string }) {
  const [username] = useState(initialUsername.toLowerCase());
  const [toast, setToast] = useState<string | null>(null);

  // Profile data with Stitch defaults
  const [displayName, setDisplayName] = useState(
    initialUsername ? initialUsername.charAt(0).toUpperCase() + initialUsername.slice(1) : "Gezgin",
  );
  const [userHandle, setUserHandle] = useState(`@${username}`);
  const [locationText, setLocationText] = useState("İstanbul, Türkiye");
  const [joinDate, _setJoinDate] = useState("Üyelik: Mayıs 2022");
  const [bioText, setBioText] = useState(
    "Akdeniz ve Uzak Doğu yollarında yürüyen, gastronomi ve antik kent tutkunu. Rotalarımı yerel halkın keşfedilmemiş ipuçları, optimize edilmiş toplu taşıma bağlantıları ve bizzat test edilmiş yürüyüş süreleriyle titizlikle hazırlıyorum.",
  );
  const [avatarUrl, setAvatarUrl] = useState(
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBNDffBXjAztvobCIL2d0SZrVhNMEaSshkO6euPsbKNr3gMpliHBUupTGJlw6ZIW73pHwRG_VV7mvHUFdcTNSgHro6JQNduyeZY9pPSF91fvK-UgtX0EwiIKmSCWIuLff1ERD7SWlHYv4zp7Frgk0ttga7YUjnuF75Tvicezr1dWHtOaI_lMNMXKysEX1bM2uighGFRpr4wrFGZMXw9iG2s_r97KMyWEid9Q_W4qZVoKSQRrsO_rO93UA",
  );
  const [coverUrl, setCoverUrl] = useState(
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBRa6IhHenaRkLdslFsWnaGz58pf3b5RlZpMP1M2Gb9jjsmqm5RO0v-5S7gQLJlKJcQTQINNvDCXBWmytQI5vUBU_9fPg5IXclDuicY7Sv4S-7xQk4qXPJ6KL3FuMemW2Xg3knuWeoEas2arWPN_WLKfQLgQ3tZMwaeV3A8CTGblnjk-6uEw7V0y7eO9sbYS5kHjqBHimT7FDBmQi7U-N4X4ufmwcRDFpgAZdiHSrzL3jpte-ZhYEQA7w",
  );

  // Follow & Favorite state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(2800);
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Tabs & filters
  const [activeTab, setActiveTab] = useState<"rotalar" | "rehberler" | "galeri" | "yorumlar">(
    "rotalar",
  );
  const [routeFilter, setRouteFilter] = useState<"all" | "free" | "market">("all");
  const [cityFilter, setCityFilter] = useState<string>("all");

  // Interactive Route Modals
  const [previewRoute, setPreviewRoute] = useState<{
    name: string;
    stops: SavedAddressItem[];
  } | null>(null);
  const [selectedPlanRoute, setSelectedPlanRoute] = useState<RouteCardItem | null>(null);
  interface LeafletMap {
    remove(): void;
    fitBounds(bounds: unknown, opts?: Record<string, unknown>): void;
  }

  interface LeafletLib {
    map(el: HTMLElement, opts?: Record<string, unknown>): LeafletMap;
    tileLayer(url: string, opts?: Record<string, unknown>): { addTo(map: LeafletMap): void };
    divIcon(opts: Record<string, unknown>): unknown;
    marker(
      latlng: [number, number],
      opts?: Record<string, unknown>,
    ): { addTo(map: LeafletMap): { bindPopup(html: string): unknown } };
    polyline(
      latlngs: [number, number][],
      opts?: Record<string, unknown>,
    ): { addTo(map: LeafletMap): void };
    latLngBounds(latlngs: [number, number][]): unknown;
  }

  const mapModalRef = useRef<HTMLDivElement>(null);
  const leafletInstanceRef = useRef<LeafletMap | null>(null);

  // Direct Message & Group Modals
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageRoute, setMessageRoute] = useState("");
  const [msgText, setMsgText] = useState("");
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupNote, setGroupNote] = useState("");

  // Auth Modal
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalConfig, setAuthModalConfig] = useState({
    title: "MapsBridge Üyeliği Gereklidir",
    subtitle: "Bu işlemi gerçekleştirmek için lütfen ücretsiz üye olun veya giriş yapın.",
    featureName: "Gezgin Özelliği",
  });

  const [_isOwnProfile, setIsOwnProfile] = useState(false);

  function showToastMessage(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  const requireAuth = (featureName: string, actionDesc: string, onAuthenticated?: () => void) => {
    const session = getStoredSession();
    if (!session?.email || !session?.token) {
      setAuthModalConfig({
        title: `${featureName} İçin Giriş Yapın`,
        subtitle: `${actionDesc} için ücretsiz bir MapsBridge hesabı oluşturun veya giriş yapın.`,
        featureName,
      });
      setShowAuthModal(true);
      return false;
    }
    if (onAuthenticated) onAuthenticated();
    return true;
  };

  // Load user data from localStorage or demo defaults
  useEffect(() => {
    try {
      const session = getStoredSession();
      let ownUser = session?.email ? session.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "") : "";
      const rawDetails = userStorage.getItem("mapsbridge.userProfileDetails");
      if (rawDetails) {
        const details = JSON.parse(rawDetails);
        if (details.username) ownUser = details.username;
        if (details.username?.toLowerCase() === username.toLowerCase()) {
          if (details.fullName) setDisplayName(details.fullName);
          if (details.username) setUserHandle(`@${details.username}`);
          if (details.city) setLocationText(`${details.city}, ${details.country || "Türkiye"}`);
          if (details.bio) setBioText(details.bio);
        }
      }
      const savedAvatar = userStorage.getItem("mapsbridge.userAvatar");
      if (savedAvatar && ownUser && username.toLowerCase() === ownUser.toLowerCase()) {
        setAvatarUrl(savedAvatar);
      }
      const savedCover = userStorage.getItem("mapsbridge.userCoverPhoto");
      if (savedCover && ownUser && username.toLowerCase() === ownUser.toLowerCase()) {
        setCoverUrl(savedCover);
      }

      setIsOwnProfile(Boolean(ownUser && ownUser.toLowerCase() === username.toLowerCase()));
    } catch {
      // ignore
    }

    setIsFollowing(isFollowingUser(username));
  }, [username]);

  function handleToggleFollow() {
    if (
      !requireAuth(
        "Gezgini Takip Et",
        "Bu gezgini takip etmek ve yeni rotalarından anında haberdar olmak",
      )
    )
      return;
    const nowFollowing = toggleFollowUser(username);
    setIsFollowing(nowFollowing);
    setFollowerCount((prev) => (nowFollowing ? prev + 1 : prev - 1));
    showToastMessage(
      nowFollowing ? `✓ ${userHandle} takip ediliyor!` : `Takip bırakıldı: ${userHandle}`,
    );
  }

  function handleBookmarkToggle() {
    setIsBookmarked(!isBookmarked);
    showToastMessage(
      !isBookmarked ? "★ Gezgin favorilerinize eklendi!" : "Favorilerden çıkarıldı.",
    );
  }

  function handleShareProfile() {
    const url =
      typeof window !== "undefined" ? window.location.href : `https://mapsbridge.com/@${username}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      showToastMessage("✓ Profil bağlantısı panoya kopyalandı!");
    } else {
      showToastMessage(url);
    }
  }

  // Predefined Rich Route Cards matching Stitch Screen
  const routeCards: RouteCardItem[] = [
    {
      id: "ist-tarihi",
      title: "İstanbul Tarihi Yarımada & Gizli Geçitler",
      badgeTag: "TOPLULUK SEÇİMİ",
      badgeType: "featured",
      rating: 4.9,
      ratingCount: 94,
      duration: "3 Günlük",
      stopsCount: 14,
      category: "Yürüyüş",
      description:
        "Turistik kalabalıklardan uzak, 500 yıllık hanlar, çatı terasları ve geleneksel ustaların gizli atölyeleri.",
      priceTag: "₺120",
      priceLabel: "ROTA ERİŞİMİ",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuA9auz0nMBA4KRXGYite_AL45bw5Dhivt2lu5tIfS587bQePKqSUIWHRIATmlPycVGpU_aa4FmAuio7MquobSV_ywCgZicVFy3N5V7RBlp_HbbGO_l2Zkqt92jTI9_3PXkLbm1cvXfRZk8vA9LtoncC9lHXPTNzLR0bmKCCluRy1i4QDgDvAxI4MiuoEBeg2Ktqa45F6xQBB-8UGDujf2ENpeLAT_98xuLniwJhERS2X7jigCdfGko6SA",
      stops: [
        {
          id: "ist-1",
          label: "Sultanahmet Meydanı & Dikilitaş",
          lat: 41.0064,
          lng: 28.9768,
          note: "Erken sabah sessizliğinde Bizans ve Osmanlı mirası.",
        },
        {
          id: "ist-2",
          label: "Büyük Valide Han Çatısı",
          lat: 41.0145,
          lng: 28.9692,
          note: "Haliç panoraması ve tarihi kubbe manzaraları.",
        },
        {
          id: "ist-3",
          label: "Süleymaniye Külliyesi & Çay Terasları",
          lat: 41.0165,
          lng: 28.9639,
          note: "Mimar Sinan'ın şaheseri ve boğaz rüzgarı.",
        },
        {
          id: "ist-4",
          label: "Balat Antika Mezatları & Fener Rum Patrikhanesi",
          lat: 41.0298,
          lng: 28.9515,
          note: "Renkli cumbalı evler ve geleneksel lezzetler.",
        },
      ],
    },
    {
      id: "kapadokya-vadi",
      title: "Kapadokya Vadi & Gün Doğumu Balon Rotası",
      badgeTag: "ÜCRETSİZ ROTA",
      badgeType: "free",
      rating: 4.8,
      ratingCount: 52,
      duration: "2 Günlük",
      stopsCount: 9,
      category: "Doğa & Fotoğraf",
      description:
        "Aşk Vadisi ve Kızılçukur'da en berrak balon izleme koordinatları ve mağara kahvaltı noktaları.",
      priceTag: "KP-302",
      priceLabel: "ROTA KODU",
      routeCode: "KP-302",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDj77hONrKmR8Fj8zu5NotnVeEZKEbBCjiHWPDDdPNHXPfNBawa4jOVv4lb0DULeshMOo9EYfGUBuB93gFvv2Y4_bY3Mt04r0050Hxm-540eN8ryevPBa-s65G8oYTJJIQHd-_Okm8socXdtFrxC3Ky55ADOpJPQLP8lKS3CUAR5TX5SoBr7ula4ikR9mbmpFOl0Zn6Z4MISYycRfOK7ZvKNBnCxDHgfEpBv7jtfwSEXJQmN93daNsUrA",
      stops: [
        {
          id: "kap-1",
          label: "Aşk Vadisi Gün Doğumu Seyir Tepesi",
          lat: 38.6655,
          lng: 34.8234,
          note: "Yüzlerce sıcak hava balonunun kalkış anı.",
        },
        {
          id: "kap-2",
          label: "Kızılçukur (Red Valley) Gün Batımı",
          lat: 38.6534,
          lng: 34.8623,
          note: "Kızıl tüf kayalarında eşsiz ışık kırılmaları.",
        },
        {
          id: "kap-3",
          label: "Çavuşin Eski Rum Köyü ve Kaya Kilisesi",
          lat: 38.6732,
          lng: 34.8412,
          note: "Tarihi freskler ve teras kafeler.",
        },
      ],
    },
    {
      id: "roma-ronesans",
      title: "Roma Rönesans & Sokak Lezzetleri",
      badgeTag: "ÜCRETSİZ ROTA",
      badgeType: "free",
      rating: 5.0,
      ratingCount: 31,
      duration: "4 Günlük",
      stopsCount: 18,
      category: "Gastronomi",
      description:
        "Pantheon civarındaki en eski fırınlar, Testaccio pazar turu ve Trastevere akşam trattoria rotası.",
      priceTag: "RM-408",
      priceLabel: "ROTA KODU",
      routeCode: "RM-408",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDz5hKKLgZz2HEqo4RXPFdclKdZAUotPOUCJyIiFHGoEZ0HKCg7Gt91-pbyU6XcH1PV-uepmwupLCyqXL18UoxQ9W1k8zSa-nuNCZ6WlZn2p8VyvB04eeHvguxhuOXaLwf4KNdRzvmPJ10nHjkGYM3OShinvgnjjEtwoLQAW5APi75hzUXu4bqerJannuLp2w1-a8rWwll8xzWeTZyZ8tQN8K6uAi6DcPN0xeie2Cc-1RFwDJNwpqRD6w",
      stops: [
        {
          id: "rm-1",
          label: "Pantheon & Piazza Navona",
          lat: 41.8986,
          lng: 12.4769,
          note: "Rönesans heykelleri ve yüzyıllık espresso barları.",
        },
        {
          id: "rm-2",
          label: "Trastevere Dar Sokaklar & Trattorialar",
          lat: 41.8885,
          lng: 12.4705,
          note: "Otantik Roma cacio e pepe ve fırın lezzetleri.",
        },
        {
          id: "rm-3",
          label: "Campo de' Fiori Sabah Pazarı",
          lat: 41.8956,
          lng: 12.4722,
          note: "Taze peynirler, zeytinyağı ve el yapımı makarnalar.",
        },
      ],
    },
    {
      id: "likya-trek",
      title: "Likya Yolu Özet Doğa Parkuru",
      badgeTag: "DOĞA PARKURU",
      badgeType: "trek",
      rating: 4.9,
      ratingCount: 67,
      duration: "3 Günlük",
      stopsCount: 11,
      category: "Trekking",
      description:
        "Kabak Koyu, Cennet Koyu ve Kelebekler Vadisi zirvesinden geçen, su kaynakları işaretli 42 km etap.",
      priceTag: "₺95",
      priceLabel: "ROTA ERİŞİMİ",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAGcSmACLBMWI88qVo2gw7LDCnJq-siLZSBHZzr38vCYPXLCF82kxB4tcI4axfC_Y-NvCr2FGZGuTyR11_stFP0P5iyu_V3wR_yRxjZOwwJ4ykc4uEULf3_fea_j4r78ka7V6oNOMdh27KJRc4TovJrHfBhb7tf4wU94HfJb50KLpMdLa-EwY_Tdd3ZRa_NlJsLsWcouW_D2lum1viu0Wh8L8aT_isPH5xIjhxAubARC5XZU12Fk3XHqA",
      stops: [
        {
          id: "lyk-1",
          label: "Ölüdeniz - Ovacık Likya Başlangıç Kapısı",
          lat: 36.5742,
          lng: 29.1415,
          note: "Akdeniz'in turkuaz manzarasına tırmanış.",
        },
        {
          id: "lyk-2",
          label: "Kelebekler Vadisi Zirve Patikası",
          lat: 36.4952,
          lng: 29.1311,
          note: "Kanyon manzarası ve çam kokulu orman yolu.",
        },
        {
          id: "lyk-3",
          label: "Kabak Koyu & Cennet Koyu Kamping",
          lat: 36.4621,
          lng: 29.1245,
          note: "Deniz kenarı dinlenme ve doğal su kaynakları.",
        },
      ],
    },
  ];

  // Filter routes
  const filteredRoutes = routeCards.filter((r) => {
    if (routeFilter === "free" && r.badgeType !== "free") return false;
    if (routeFilter === "market" && r.badgeType === "free") return false;
    if (cityFilter !== "all") {
      if (cityFilter === "İstanbul" && !r.title.includes("İstanbul")) return false;
      if (cityFilter === "Kapadokya" && !r.title.includes("Kapadokya")) return false;
      if (cityFilter === "Roma" && !r.title.includes("Roma")) return false;
    }
    return true;
  });

  // Leaflet Map Initializer
  useEffect(() => {
    if (!previewRoute) {
      if (leafletInstanceRef.current) {
        leafletInstanceRef.current.remove();
        leafletInstanceRef.current = null;
      }
      return;
    }

    let isMounted = true;

    function initMap() {
      if (!isMounted || !mapModalRef.current || !(window as Window & { L?: LeafletLib }).L) return;
      const L = (window as Window & { L?: LeafletLib }).L!;

      if (leafletInstanceRef.current) {
        leafletInstanceRef.current.remove();
        leafletInstanceRef.current = null;
      }

      const stops = previewRoute?.stops || [];
      if (stops.length === 0) return;

      const map = L.map(mapModalRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      });
      leafletInstanceRef.current = map;

      L.tileLayer("https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=tr", {
        maxZoom: 20,
        subdomains: ["0", "1", "2", "3"],
        attribution: "&copy; Google Maps",
      }).addTo(map);

      const latlngs: [number, number][] = [];

      stops.forEach((stop, idx) => {
        latlngs.push([stop.lat, stop.lng]);

        const pinHtml = `
          <div style="
            background: #013628;
            color: #ffffff;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 800;
            box-shadow: 0 4px 12px rgba(1,54,40,0.45);
            border: 2px solid #ffffff;
          ">
            ${idx + 1}
          </div>
        `;

        const customIcon = L.divIcon({
          html: pinHtml,
          className: "custom-map-pin",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -18],
        });

        const popupContent = `
          <div style="padding: 4px; font-family: inherit; max-width: 240px;">
            <strong style="font-size: 14px; color: #013628; display: block; margin-bottom: 4px;">#${idx + 1} ${stop.label}</strong>
            ${stop.note ? `<p style="font-size: 12px; color: #404945; margin: 0 0 6px; line-height: 1.4;">${stop.note}</p>` : ""}
            <a href="https://maps.google.com/?q=${stop.lat},${stop.lng}" target="_blank" rel="noopener" style="display:inline-block; font-size: 11px; font-weight: 700; color: #10b981; text-decoration: none;">
              🧭 Google Haritalar'da Aç &rarr;
            </a>
          </div>
        `;

        L.marker([stop.lat, stop.lng], { icon: customIcon }).addTo(map).bindPopup(popupContent);
      });

      if (latlngs.length > 1) {
        L.polyline(latlngs, {
          color: "#10b981",
          weight: 4,
          opacity: 0.85,
          dashArray: "6, 8",
        }).addTo(map);
      }

      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }

    if (!(window as Window & { L?: LeafletLib }).L) {
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => {
        if (isMounted) initMap();
      };
      document.body.appendChild(script);
    } else {
      setTimeout(initMap, 80);
    }

    return () => {
      isMounted = false;
    };
  }, [previewRoute]);

  // Send Message Submit
  function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!requireAuth("Mesaj Gönder", "Gezgine doğrudan mesaj göndermek")) return;
    if (!msgText.trim()) return;

    try {
      const raw = localStorage.getItem("mapsbridge.directMessages");
      const list: DirectMessageItem[] = raw ? JSON.parse(raw) : [];
      list.unshift({
        id: "msg-" + Date.now(),
        fromUsername: "ziyaretci",
        toUsername: username,
        routeTitle: messageRoute || "Genel Seyahat Danışma",
        message: msgText.trim(),
        createdAt: new Date().toISOString(),
        read: false,
      });
      localStorage.setItem("mapsbridge.directMessages", JSON.stringify(list));
      showToastMessage(`✓ Mesajınız ${displayName} adlı gezgine iletildi!`);
      setShowMessageModal(false);
      setMsgText("");
    } catch {
      showToastMessage("Mesaj gönderilemedi, lütfen tekrar deneyin.");
    }
  }

  // Handle Group Trip Request
  function handleGroupRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!requireAuth("Gezi Grubu", "Ortak gezi grubuna katılım talebi iletmek")) return;
    showToastMessage("✓ Gezi grubu katılım talebiniz rota liderine iletildi!");
    setShowGroupModal(false);
    setGroupNote("");
  }

  return (
    <PageShell layout="landing" className="public-profile-root">
      {/* Tek h1 (AC-34): görsel başlık sayfa içinde <p> olarak kalır; kabuk başlığı ekran okuyucuya. */}
      <PageHeader variant="hidden" title={displayName} />

      <div className="pub-profile-main">
        {/* 2. Sticky Preview Mode Notification Banner */}
        <aside className="pub-preview-banner">
          <div className="pub-preview-banner-inner">
            <div className="pub-preview-banner-left">
              <span className="pub-pulse-dot" />
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "18px", color: "var(--stitch-mint-glow)" }}
              >
                visibility
              </span>
              <span>
                <strong>Ön İzleme Modu:</strong> Şu anda profilinizin diğer topluluk üyelerine nasıl
                göründüğünü inceliyorsunuz.
              </span>
            </div>
            <div>
              <Link href="/profile/edit" className="pub-banner-btn">
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                  edit
                </span>
                <span>Düzenlemeye Dön</span>
              </Link>
            </div>
          </div>
        </aside>

        {/* 3. Panoramic Nature Cover Hero */}
        <section className="pub-hero-section">
          <div className="pub-panoramic-cover">
            <div className="pub-cover-image" style={{ backgroundImage: `url('${coverUrl}')` }} />
            <div className="pub-cover-overlay" data-surface="inverse" />
            <div className="pub-floating-location-chip" data-surface="inverse">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "16px", color: "var(--stitch-mint-glow)" }}
              >
                photo_camera
              </span>
              <span>Dolomitler Alpleri, İtalya • Son Sefer</span>
            </div>
          </div>

          {/* 4. Overlapping Profile Masthead Card */}
          <div className="pub-masthead-container">
            <div className="pub-masthead-card">
              <div className="pub-masthead-top">
                <div className="pub-identity-block">
                  <div className="pub-avatar-frame">
                    <div className="pub-avatar-img-wrap">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={displayName} />
                      ) : (
                        <div className="pub-avatar-fallback">{displayName.charAt(0)}</div>
                      )}
                    </div>
                    <span className="pub-status-badge" title="Aktif Gezgin">
                      <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                        check
                      </span>
                    </span>
                  </div>

                  <div className="pub-user-details">
                    <div className="pub-name-row">
                      <p className="pub-user-name">{displayName}</p>
                      <span className="pub-badge-pill pro">
                        <span
                          className="material-symbols-outlined fill"
                          style={{ fontSize: "13px", color: "var(--stitch-emerald-accent)" }}
                        >
                          workspace_premium
                        </span>
                        PRO KAŞİF
                      </span>
                      <span className="pub-badge-pill verified">
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "13px", color: "var(--stitch-secondary)" }}
                        >
                          verified
                        </span>
                        DOĞRULANMIŞ ROTA MİMARI
                      </span>
                    </div>

                    <div className="pub-meta-row">
                      <span className="pub-handle-link">{userHandle}</span>
                      <span className="pub-meta-item">
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "16px", color: "var(--stitch-emerald-accent)" }}
                        >
                          location_on
                        </span>
                        {locationText}
                      </span>
                      <span className="pub-meta-item">
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                          calendar_today
                        </span>
                        {joinDate}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Social Micro Links & Action Triggers */}
                <div className="pub-actions-group">
                  <div className="pub-social-links-capsule">
                    <button
                      type="button"
                      className="pub-social-btn"
                      title="Gezgin Portfolyosu"
                      onClick={() => showToastMessage("Gezgin harita portföyü")}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                        travel_explore
                      </span>
                    </button>
                    <button
                      type="button"
                      className="pub-social-btn"
                      title="Kişisel Seyahat Bloğu"
                      onClick={() =>
                        showToastMessage("Kişisel web sitesi bağlantısı henüz eklenmemiş.")
                      }
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                        language
                      </span>
                    </button>
                  </div>

                  <button
                    type="button"
                    className="pub-circle-action-btn"
                    title="Favorilere Ekle"
                    onClick={handleBookmarkToggle}
                  >
                    <span
                      className={`material-symbols-outlined ${isBookmarked ? "fill" : ""}`}
                      style={{ fontSize: "20px", color: isBookmarked ? "#f59e0b" : "inherit" }}
                    >
                      bookmark
                    </span>
                  </button>

                  <button
                    type="button"
                    className="pub-circle-action-btn"
                    title="Profili Paylaş"
                    onClick={handleShareProfile}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                      share
                    </span>
                  </button>

                  <button
                    type="button"
                    className="pub-btn-secondary"
                    onClick={() => {
                      setMessageRoute("Genel Seyahat Danışma");
                      setShowMessageModal(true);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                      chat_bubble_outline
                    </span>
                    <span>Mesaj Gönder</span>
                  </button>

                  <button
                    type="button"
                    className={`pub-btn-primary ${isFollowing ? "following" : ""}`}
                    onClick={handleToggleFollow}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                      {isFollowing ? "check" : "person_add"}
                    </span>
                    <span>{isFollowing ? "Takip Ediliyor" : "Takip Et"}</span>
                  </button>
                </div>
              </div>

              {/* Bio Paragraph */}
              <p className="pub-bio-text">{bioText}</p>

              {/* Community Stat Bar Ribbon */}
              <div className="pub-stats-ribbon">
                <div className="pub-stat-item">
                  <span className="pub-stat-num">
                    {followerCount >= 1000
                      ? `${(followerCount / 1000).toFixed(1)}K`
                      : followerCount}
                  </span>
                  <span className="pub-stat-label">Takipçi • 340 Takip</span>
                </div>
                <div className="pub-stat-item">
                  <span className="pub-stat-num">24 Rota</span>
                  <span className="pub-stat-label">Yayınlanan Koleksiyon</span>
                </div>
                <div className="pub-stat-item">
                  <span className="pub-stat-num">14.8K</span>
                  <span className="pub-stat-label">Rota İndirme & Kaydetme</span>
                </div>
                <div className="pub-stat-item">
                  <span className="pub-stat-num">
                    4.9
                    <span
                      className="material-symbols-outlined fill"
                      style={{ fontSize: "18px", color: "var(--color-warning-icon)" }}
                    >
                      star
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--stitch-on-surface-variant)",
                        fontWeight: 500,
                      }}
                    >
                      / 5.0
                    </span>
                  </span>
                  <span className="pub-stat-label">186 Gezgin Değerlendirmesi</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. 12-Column Main Showcase Workspace */}
        <section className="pub-workspace-section">
          <div className="pub-workspace-grid">
            {/* Left 8 Columns */}
            <div className="pub-left-col">
              {/* Navigation Tabs */}
              <div className="pub-nav-tabs-bar">
                <button
                  type="button"
                  className={`pub-tab-pill ${activeTab === "rotalar" ? "active" : ""}`}
                  onClick={() => setActiveTab("rotalar")}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    route
                  </span>
                  <span>Yayınlanan Rotalar ({routeCards.length})</span>
                </button>
                <button
                  type="button"
                  className={`pub-tab-pill ${activeTab === "rehberler" ? "active" : ""}`}
                  onClick={() => setActiveTab("rehberler")}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    menu_book
                  </span>
                  <span>Topluluk Rehberleri & Notlar (8)</span>
                </button>
                <button
                  type="button"
                  className={`pub-tab-pill ${activeTab === "galeri" ? "active" : ""}`}
                  onClick={() => setActiveTab("galeri")}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    photo_library
                  </span>
                  <span>Fotoğraf Galerisi (124)</span>
                </button>
                <button
                  type="button"
                  className={`pub-tab-pill ${activeTab === "yorumlar" ? "active" : ""}`}
                  onClick={() => setActiveTab("yorumlar")}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    reviews
                  </span>
                  <span>Gezgin Yorumları (186)</span>
                </button>
              </div>

              {/* Tab 1: Rotalar */}
              {activeTab === "rotalar" && (
                <>
                  {/* Filter Sub-bar */}
                  <div className="pub-filter-subbar">
                    <div className="pub-filter-left">
                      <button
                        type="button"
                        className={`pub-filter-pill ${routeFilter === "all" ? "active" : ""}`}
                        onClick={() => setRouteFilter("all")}
                      >
                        Tümü
                      </button>
                      <button
                        type="button"
                        className={`pub-filter-pill ${routeFilter === "free" ? "active" : ""}`}
                        onClick={() => setRouteFilter("free")}
                      >
                        Ücretsiz Keşifler
                      </button>
                      <button
                        type="button"
                        className={`pub-filter-pill ${routeFilter === "market" ? "active" : ""}`}
                        onClick={() => setRouteFilter("market")}
                      >
                        Özel Rota Pazarı
                      </button>
                    </div>

                    <div className="pub-filter-right">
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "18px", color: "var(--stitch-outline)" }}
                      >
                        tune
                      </span>
                      <span>Şehir Filtrele:</span>
                      <button
                        type="button"
                        className={`pub-city-chip ${cityFilter === "İstanbul" ? "active" : ""}`}
                        onClick={() =>
                          setCityFilter(cityFilter === "İstanbul" ? "all" : "İstanbul")
                        }
                      >
                        İstanbul
                      </button>
                      <button
                        type="button"
                        className={`pub-city-chip ${cityFilter === "Kapadokya" ? "active" : ""}`}
                        onClick={() =>
                          setCityFilter(cityFilter === "Kapadokya" ? "all" : "Kapadokya")
                        }
                      >
                        Kapadokya
                      </button>
                      <button
                        type="button"
                        className={`pub-city-chip ${cityFilter === "Roma" ? "active" : ""}`}
                        onClick={() => setCityFilter(cityFilter === "Roma" ? "all" : "Roma")}
                      >
                        Roma
                      </button>
                    </div>
                  </div>

                  {/* 2-Column Route Cards Grid */}
                  <div className="pub-routes-grid">
                    {filteredRoutes.map((route) => (
                      <article key={route.id} className="pub-route-card">
                        <div className="pub-route-media">
                          <img src={route.image} alt={route.title} />

                          <div className="pub-route-badge-left">
                            {route.badgeType === "featured" && (
                              <span
                                style={{
                                  padding: "0.3rem 0.75rem",
                                  borderRadius: "9999px",
                                  background:
                                    "color-mix(in srgb, var(--color-surface-inverse) 80%, transparent)",
                                  backdropFilter: "blur(8px)",
                                  color: "var(--stitch-mint-glow)",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  letterSpacing: "0.06em",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                }}
                              >
                                <span
                                  className="material-symbols-outlined fill"
                                  style={{ fontSize: "13px" }}
                                >
                                  star
                                </span>
                                {route.badgeTag}
                              </span>
                            )}
                            {route.badgeType === "free" && (
                              <span
                                style={{
                                  padding: "0.3rem 0.75rem",
                                  borderRadius: "9999px",
                                  background:
                                    "color-mix(in srgb, var(--color-surface-brand) 95%, transparent)",
                                  backdropFilter: "blur(8px)",
                                  color: "var(--stitch-secondary)",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  letterSpacing: "0.06em",
                                }}
                              >
                                {route.badgeTag}
                              </span>
                            )}
                            {route.badgeType === "trek" && (
                              <span
                                style={{
                                  padding: "0.3rem 0.75rem",
                                  borderRadius: "9999px",
                                  background:
                                    "color-mix(in srgb, var(--color-surface-inverse) 80%, transparent)",
                                  backdropFilter: "blur(8px)",
                                  color: "var(--stitch-mint-glow)",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  letterSpacing: "0.06em",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                }}
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: "13px" }}
                                >
                                  landscape
                                </span>
                                {route.badgeTag}
                              </span>
                            )}
                          </div>

                          <div className="pub-route-rating-right">
                            <span
                              className="material-symbols-outlined fill"
                              style={{ fontSize: "15px", color: "var(--color-warning-icon)" }}
                            >
                              star
                            </span>
                            <span>{route.rating.toFixed(1)}</span>
                            <span
                              style={{
                                color: "var(--stitch-outline)",
                                fontSize: "11px",
                                fontWeight: 400,
                              }}
                            >
                              ({route.ratingCount})
                            </span>
                          </div>
                        </div>

                        <div className="pub-route-content">
                          <div>
                            <div className="pub-route-meta-row">
                              <span
                                style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: "15px", color: "var(--stitch-secondary)" }}
                                >
                                  schedule
                                </span>
                                {route.duration}
                              </span>
                              <span>•</span>
                              <span
                                style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: "15px", color: "var(--stitch-secondary)" }}
                                >
                                  pin_drop
                                </span>
                                {route.stopsCount} Durak
                              </span>
                              <span>•</span>
                              <span style={{ color: "var(--stitch-secondary)", fontWeight: 600 }}>
                                {route.category}
                              </span>
                            </div>

                            <h2 className="pub-route-title">{route.title}</h2>
                            <p className="pub-route-desc">{route.description}</p>
                          </div>

                          <div className="pub-route-footer">
                            <div className="pub-route-price-box">
                              <span className="pub-route-price-label">{route.priceLabel}</span>
                              <span className="pub-route-price-val">{route.priceTag}</span>
                            </div>

                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              {route.priceTag.startsWith("₺") ? (
                                <button
                                  type="button"
                                  className="pub-route-cta-btn primary"
                                  onClick={() => setSelectedPlanRoute(route)}
                                >
                                  <span>Planı İncele</span>
                                  <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: "16px" }}
                                  >
                                    arrow_forward
                                  </span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="pub-route-cta-btn secondary"
                                  onClick={() =>
                                    setPreviewRoute({ name: route.title, stops: route.stops })
                                  }
                                >
                                  <span
                                    className="material-symbols-outlined"
                                    style={{
                                      fontSize: "16px",
                                      color: "var(--stitch-emerald-accent)",
                                    }}
                                  >
                                    map
                                  </span>
                                  <span>Haritada Aç</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>

                  {/* Load more button */}
                  <div className="pub-load-more-wrap">
                    <button
                      type="button"
                      className="pub-load-more-btn"
                      onClick={() =>
                        showToastMessage(
                          "Tüm rotalar listelendi (12 arşivlenmiş rota daha mevcut).",
                        )
                      }
                    >
                      <span>Daha Fazla Rota Yükle (12 Kalan)</span>
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                        expand_more
                      </span>
                    </button>
                  </div>
                </>
              )}

              {/* Tab 2: Topluluk Rehberleri & Notlar */}
              {activeTab === "rehberler" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div className="pub-sidebar-card">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "22px", color: "var(--stitch-secondary)" }}
                      >
                        menu_book
                      </span>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: "1.1rem",
                          color: "var(--stitch-primary)",
                          fontWeight: 700,
                        }}
                      >
                        Roma'da 48 Saatte Ne Yenir? Gastronomi Rehberi
                      </h3>
                    </div>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "var(--stitch-on-surface-variant)",
                        margin: 0,
                        lineHeight: 1.6,
                      }}
                    >
                      Trastevere fırınlarından Testaccio şarküterilerine, Roma sokaklarının en iyi
                      cacio e pepe ve tiramisu durakları. Rezervasyonsuz gidilebilecek yerel
                      adresler.
                    </p>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingTop: "0.5rem",
                      }}
                    >
                      <span style={{ fontSize: "12px", color: "var(--stitch-outline)" }}>
                        4 gün önce güncellendi • 1.2K Okuma
                      </span>
                      <button
                        type="button"
                        className="pub-route-cta-btn secondary"
                        onClick={() => showToastMessage("Rehber açıldı.")}
                      >
                        Rehberi Oku
                      </button>
                    </div>
                  </div>

                  <div className="pub-sidebar-card">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "22px", color: "var(--stitch-secondary)" }}
                      >
                        tips_and_updates
                      </span>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: "1.1rem",
                          color: "var(--stitch-primary)",
                          fontWeight: 700,
                        }}
                      >
                        Kapadokya'da Balon Kaçırmama & En İyi Vadi Konumları
                      </h3>
                    </div>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "var(--stitch-on-surface-variant)",
                        margin: 0,
                        lineHeight: 1.6,
                      }}
                    >
                      Hava durumu ve rüzgar yönüne göre balonların hangi vadide uçacağını anlama
                      formülü. Gün doğumu için en sakin kaya terasları.
                    </p>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingTop: "0.5rem",
                      }}
                    >
                      <span style={{ fontSize: "12px", color: "var(--stitch-outline)" }}>
                        2 hafta önce • 3.4K Okuma
                      </span>
                      <button
                        type="button"
                        className="pub-route-cta-btn secondary"
                        onClick={() => showToastMessage("Rehber açıldı.")}
                      >
                        Rehberi Oku
                      </button>
                    </div>
                  </div>

                  <div className="pub-sidebar-card">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "22px", color: "var(--stitch-secondary)" }}
                      >
                        backpack
                      </span>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: "1.1rem",
                          color: "var(--stitch-primary)",
                          fontWeight: 700,
                        }}
                      >
                        Likya Yolu Sırt Çantası & Su Kaynakları Kontrol Listesi
                      </h3>
                    </div>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "var(--stitch-on-surface-variant)",
                        margin: 0,
                        lineHeight: 1.6,
                      }}
                    >
                      Kabak Koyu - Cennet Koyu etabında çalışan su çeşmeleri, hafif kamp ekipmanı ve
                      acil durum GPS koordinatları listesi.
                    </p>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingTop: "0.5rem",
                      }}
                    >
                      <span style={{ fontSize: "12px", color: "var(--stitch-outline)" }}>
                        1 ay önce • 2.8K Okuma
                      </span>
                      <button
                        type="button"
                        className="pub-route-cta-btn secondary"
                        onClick={() => showToastMessage("Rehber açıldı.")}
                      >
                        Rehberi Oku
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Fotoğraf Galerisi */}
              {activeTab === "galeri" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  {[
                    {
                      title: "Kapadokya Gün Doğumu",
                      src: "https://lh3.googleusercontent.com/aida-public/AB6AXuDj77hONrKmR8Fj8zu5NotnVeEZKEbBCjiHWPDDdPNHXPfNBawa4jOVv4lb0DULeshMOo9EYfGUBuB93gFvv2Y4_bY3Mt04r0050Hxm-540eN8ryevPBa-s65G8oYTJJIQHd-_Okm8socXdtFrxC3Ky55ADOpJPQLP8lKS3CUAR5TX5SoBr7ula4ikR9mbmpFOl0Zn6Z4MISYycRfOK7ZvKNBnCxDHgfEpBv7jtfwSEXJQmN93daNsUrA",
                    },
                    {
                      title: "Dolomitler Alpleri Geçidi",
                      src: "https://lh3.googleusercontent.com/aida-public/AB6AXuBRa6IhHenaRkLdslFsWnaGz58pf3b5RlZpMP1M2Gb9jjsmqm5RO0v-5S7gQLJlKJcQTQINNvDCXBWmytQI5vUBU_9fPg5IXclDuicY7Sv4S-7xQk4qXPJ6KL3FuMemW2Xg3knuWeoEas2arWPN_WLKfQLgQ3tZMwaeV3A8CTGblnjk-6uEw7V0y7eO9sbYS5kHjqBHimT7FDBmQi7U-N4X4ufmwcRDFpgAZdiHSrzL3jpte-ZhYEQA7w",
                    },
                    {
                      title: "İstanbul Tarihi Yarımada",
                      src: "https://lh3.googleusercontent.com/aida-public/AB6AXuA9auz0nMBA4KRXGYite_AL45bw5Dhivt2lu5tIfS587bQePKqSUIWHRIATmlPycVGpU_aa4FmAuio7MquobSV_ywCgZicVFy3N5V7RBlp_HbbGO_l2Zkqt92jTI9_3PXkLbm1cvXfRZk8vA9LtoncC9lHXPTNzLR0bmKCCluRy1i4QDgDvAxI4MiuoEBeg2Ktqa45F6xQBB-8UGDujf2ENpeLAT_98xuLniwJhERS2X7jigCdfGko6SA",
                    },
                    {
                      title: "Roma Trastevere Sokakları",
                      src: "https://lh3.googleusercontent.com/aida-public/AB6AXuDz5hKKLgZz2HEqo4RXPFdclKdZAUotPOUCJyIiFHGoEZ0HKCg7Gt91-pbyU6XcH1PV-uepmwupLCyqXL18UoxQ9W1k8zSa-nuNCZ6WlZn2p8VyvB04eeHvguxhuOXaLwf4KNdRzvmPJ10nHjkGYM3OShinvgnjjEtwoLQAW5APi75hzUXu4bqerJannuLp2w1-a8rWwll8xzWeTZyZ8tQN8K6uAi6DcPN0xeie2Cc-1RFwDJNwpqRD6w",
                    },
                    {
                      title: "Likya Yolu Akdeniz Patikası",
                      src: "https://lh3.googleusercontent.com/aida-public/AB6AXuAGcSmACLBMWI88qVo2gw7LDCnJq-siLZSBHZzr38vCYPXLCF82kxB4tcI4axfC_Y-NvCr2FGZGuTyR11_stFP0P5iyu_V3wR_yRxjZOwwJ4ykc4uEULf3_fea_j4r78ka7V6oNOMdh27KJRc4TovJrHfBhb7tf4wU94HfJb50KLpMdLa-EwY_Tdd3ZRa_NlJsLsWcouW_D2lum1viu0Wh8L8aT_isPH5xIjhxAubARC5XZU12Fk3XHqA",
                    },
                  ].map((img, i) => (
                    <div
                      key={i}
                      style={{
                        borderRadius: "18px",
                        overflow: "hidden",
                        height: "180px",
                        position: "relative",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                    >
                      <img
                        src={img.src}
                        alt={img.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          bottom: 0,
                          insetInline: 0,
                          padding: "0.5rem 0.75rem",
                          background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
                          color: "var(--color-on-primary)",
                          fontSize: "11px",
                          fontWeight: 600,
                        }}
                      >
                        {img.title}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 4: Gezgin Yorumları */}
              {activeTab === "yorumlar" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {[
                    {
                      name: "Canberk Y.",
                      route: "Kapadokya Vadi Gezgini",
                      stars: 5,
                      time: "3 gün önce",
                      text: "Bu özenle hazırlanmış rota sayesinde klasik turların hiç bilmediği gizli vadileri keşfettik. Gün doğumu koordinatı tek kelimeyle mükemmeldi. Kesinlikle tavsiye ederim!",
                    },
                    {
                      name: "Selin D.",
                      route: "İstanbul Tarihi Yarımada",
                      stars: 5,
                      time: "1 hafta önce",
                      text: "Yıllardır İstanbul'da yaşamama rağmen bilmediğim hanları ve çatı geçitlerini bu rotayla öğrendim. ₺120 fazlasıyla hak ediliyor.",
                    },
                    {
                      name: "Mehmet K.",
                      route: "Likya Yolu Trekking",
                      stars: 5,
                      time: "2 hafta önce",
                      text: "Su kaynakları koordinatları hayat kurtardı. Patika açıklamaları ve kamp noktası tavsiyeleri kusursuzdu.",
                    },
                  ].map((rev, i) => (
                    <div key={i} className="pub-sidebar-card">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                          <div className="pub-reviewer-avatar">{rev.name.charAt(0)}</div>
                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: "14px",
                                color: "var(--stitch-primary)",
                              }}
                            >
                              {rev.name}
                            </div>
                            <div
                              style={{
                                fontSize: "11px",
                                color: "var(--stitch-on-surface-variant)",
                              }}
                            >
                              {rev.route} • {rev.time}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", color: "var(--color-warning-icon)" }}>
                          {[...Array(rev.stars)].map((_, s) => (
                            <span
                              key={s}
                              className="material-symbols-outlined fill"
                              style={{ fontSize: "16px" }}
                            >
                              star
                            </span>
                          ))}
                        </div>
                      </div>
                      <blockquote className="pub-review-quote">“{rev.text}”</blockquote>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right 4 Columns Sidebar */}
            <div className="pub-right-col">
              {/* Gezgin Rozetleri */}
              <div className="pub-sidebar-card">
                <div className="pub-sidebar-card-header">
                  <h3 className="pub-sidebar-card-title">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "20px", color: "var(--stitch-secondary)" }}
                    >
                      military_tech
                    </span>
                    <span>Gezgin Rozetleri</span>
                  </h3>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      color: "var(--stitch-on-surface-variant)",
                    }}
                  >
                    4 KAZANILDI
                  </span>
                </div>

                <div className="pub-badges-grid">
                  <div className="pub-badge-item">
                    <div className="pub-badge-icon-box">
                      <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                        public
                      </span>
                    </div>
                    <span className="pub-badge-title">18 Ülke Gezgini</span>
                    <span className="pub-badge-sub">Global Kaşif</span>
                  </div>

                  <div className="pub-badge-item">
                    <div className="pub-badge-icon-box">
                      <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                        architecture
                      </span>
                    </div>
                    <span className="pub-badge-title">Usta Rota Mimarı</span>
                    <span className="pub-badge-sub">20+ Tamamlanan</span>
                  </div>

                  <div className="pub-badge-item">
                    <div className="pub-badge-icon-box">
                      <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                        tips_and_updates
                      </span>
                    </div>
                    <span className="pub-badge-title">50+ Yerel Tavsiye</span>
                    <span className="pub-badge-sub">Küratör</span>
                  </div>

                  <div className="pub-badge-item">
                    <div className="pub-badge-icon-box">
                      <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                        recommend
                      </span>
                    </div>
                    <span className="pub-badge-title">Topluluk Yıldızı</span>
                    <span className="pub-badge-sub">%98 Memnuniyet</span>
                  </div>
                </div>
              </div>

              {/* Favori Seyahat Tarzı */}
              <div className="pub-sidebar-card">
                <h3 className="pub-sidebar-card-title">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "20px", color: "var(--stitch-secondary)" }}
                  >
                    loyalty
                  </span>
                  <span>Favori Seyahat Tarzı</span>
                </h3>

                <div className="pub-styles-chips">
                  <span className="pub-style-chip">
                    <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                      museum
                    </span>
                    Tarih & Kültür
                  </span>
                  <span className="pub-style-chip">
                    <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                      hiking
                    </span>
                    Doğa Yürüyüşü
                  </span>
                  <span className="pub-style-chip">
                    <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                      restaurant
                    </span>
                    Yerel Gastronomi
                  </span>
                  <span className="pub-style-chip">
                    <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                      nordic_walking
                    </span>
                    Solo Macera
                  </span>
                </div>
              </div>

              {/* Collaborative CTA */}
              <div className="pub-collaborate-card">
                <div>
                  <span className="pub-collab-tag">TOPLULUK DENEYİMİ</span>
                  <h3 className="pub-collab-title">{displayName.split(" ")[0]} ile Birlikte Gez</h3>
                  <p className="pub-collab-desc">
                    Gelecek rotalarında ortak gezi grubuna dahil olabilir veya planın için doğrudan
                    özel danışmanlık talep edebilirsin.
                  </p>
                </div>

                <div className="pub-collab-actions">
                  <button
                    type="button"
                    className="pub-collab-btn-highlight"
                    onClick={() => setShowGroupModal(true)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                      group_add
                    </span>
                    <span>Ortak Gezi Grubu Oluştur</span>
                  </button>

                  <button
                    type="button"
                    className="pub-collab-btn-ghost"
                    onClick={() => {
                      setMessageRoute("Rotalar Hakkında Soru");
                      setShowMessageModal(true);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                      help_outline
                    </span>
                    <span>Rotalar Hakkında Soru Sor</span>
                  </button>
                </div>
              </div>

              {/* Son Gezgin İncelemesi */}
              <div className="pub-sidebar-card">
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      color: "var(--stitch-on-surface-variant)",
                    }}
                  >
                    SON GEZGİN İNCELEMESİ
                  </span>
                  <div style={{ display: "flex", color: "var(--color-warning-icon)" }}>
                    {[...Array(5)].map((_, i) => (
                      <span
                        key={i}
                        className="material-symbols-outlined fill"
                        style={{ fontSize: "15px" }}
                      >
                        star
                      </span>
                    ))}
                  </div>
                </div>

                <blockquote className="pub-review-quote">
                  “Bu özenle hazırlanmış rota sayesinde klasik turların hiç bilmediği gizli vadileri
                  keşfettik. Gün doğumu koordinatı tek kelimeyle mükemmeldi. Kesinlikle tavsiye
                  ederim!”
                </blockquote>

                <div className="pub-reviewer-meta">
                  <div className="pub-reviewer-avatar">CY</div>
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "13px",
                        color: "var(--stitch-on-surface)",
                      }}
                    >
                      Canberk Y.
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--stitch-on-surface-variant)" }}>
                      Kapadokya Vadi Gezgini • 3 gün önce
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="pub-toast" role="status">
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "18px", color: "var(--stitch-mint-glow)" }}
          >
            check_circle
          </span>
          <span>{toast}</span>
        </div>
      )}

      {/* Map Preview Modal */}
      {previewRoute && (
        <div className="pub-modal-backdrop" onClick={() => setPreviewRoute(null)}>
          <div className="pub-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="pub-modal-header">
              <h3 className="pub-modal-title">{previewRoute.name} — Harita Önizlemesi</h3>
              <button type="button" className="pub-icon-btn" onClick={() => setPreviewRoute(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="pub-modal-body">
              <div
                ref={mapModalRef}
                style={{
                  width: "100%",
                  height: "360px",
                  borderRadius: "16px",
                  overflow: "hidden",
                  boxShadow: "inset 0 0 10px rgba(0,0,0,0.1)",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <h4
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "var(--stitch-primary)",
                  }}
                >
                  Rota Durakları ({previewRoute.stops.length})
                </h4>
                {previewRoute.stops.map((s, idx) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.75rem",
                      padding: "0.5rem 0",
                      borderBottom: "1px solid var(--stitch-surface-container-low)",
                    }}
                  >
                    <span
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "var(--stitch-primary)",
                        color: "var(--color-on-primary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <strong style={{ fontSize: "13px", color: "var(--stitch-on-surface)" }}>
                        {s.label}
                      </strong>
                      {s.note && (
                        <p
                          style={{
                            margin: "2px 0 0",
                            fontSize: "12px",
                            color: "var(--stitch-on-surface-variant)",
                          }}
                        >
                          {s.note}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pub-modal-footer">
              <button
                type="button"
                className="pub-btn-secondary"
                onClick={() => setPreviewRoute(null)}
              >
                Kapat
              </button>
              <Link
                href={`/maps/?route=${encodeURIComponent(previewRoute.name)}`}
                className="pub-btn-primary"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                  edit_location_alt
                </span>
                <span>Bu Rotayı Harita Masama Aktar</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Plan Details / Purchase Sheet */}
      {selectedPlanRoute && (
        <div className="pub-modal-backdrop" onClick={() => setSelectedPlanRoute(null)}>
          <div className="pub-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="pub-modal-header">
              <h3 className="pub-modal-title">{selectedPlanRoute.title}</h3>
              <button
                type="button"
                className="pub-icon-btn"
                onClick={() => setSelectedPlanRoute(null)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="pub-modal-body">
              <img
                src={selectedPlanRoute.image}
                alt={selectedPlanRoute.title}
                style={{ width: "100%", height: "200px", objectFit: "cover", borderRadius: "16px" }}
              />
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--stitch-on-surface-variant)",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {selectedPlanRoute.description}
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "0.75rem",
                  background: "var(--stitch-canvas-base)",
                  padding: "1rem",
                  borderRadius: "16px",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", color: "var(--stitch-on-surface-variant)" }}>
                    Süre
                  </div>
                  <div style={{ fontWeight: 700, color: "var(--stitch-primary)" }}>
                    {selectedPlanRoute.duration}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "var(--stitch-on-surface-variant)" }}>
                    Durak Sayısı
                  </div>
                  <div style={{ fontWeight: 700, color: "var(--stitch-primary)" }}>
                    {selectedPlanRoute.stopsCount} Durak
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "var(--stitch-on-surface-variant)" }}>
                    Kategori
                  </div>
                  <div style={{ fontWeight: 700, color: "var(--stitch-primary)" }}>
                    {selectedPlanRoute.category}
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: "0.5rem",
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--stitch-on-surface-variant)",
                      display: "block",
                    }}
                  >
                    ROTA PAKETİ ÜCRETİ
                  </span>
                  <span
                    style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--stitch-primary)" }}
                  >
                    {selectedPlanRoute.priceTag}
                  </span>
                </div>
                <button
                  type="button"
                  className="pub-btn-primary"
                  onClick={() => {
                    if (
                      !requireAuth("Rota Satın Al", "Özel seyahat rotasını kütüphanenize eklemek")
                    )
                      return;
                    showToastMessage(
                      `✓ "${selectedPlanRoute.title}" rotası satın alındı ve kütüphanenize eklendi!`,
                    );
                    setSelectedPlanRoute(null);
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    shopping_bag
                  </span>
                  <span>Rotayı Hemen Al & Haritaya Ekle</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Direct Message Modal */}
      {showMessageModal && (
        <div className="pub-modal-backdrop" onClick={() => setShowMessageModal(false)}>
          <div className="pub-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="pub-modal-header">
              <h3 className="pub-modal-title">{displayName} ile İletişim</h3>
              <button
                type="button"
                className="pub-icon-btn"
                onClick={() => setShowMessageModal(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSendMessage}>
              <div className="pub-modal-body">
                <div>
                  <label
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "var(--stitch-on-surface)",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    İlgili Rota veya Konu
                  </label>
                  <input
                    type="text"
                    value={messageRoute}
                    onChange={(e) => setMessageRoute(e.target.value)}
                    placeholder="Örn: Kapadokya Vadi Rotası hakkında..."
                    style={{
                      width: "100%",
                      padding: "0.65rem 1rem",
                      borderRadius: "12px",
                      border: "1px solid var(--stitch-outline-variant)",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "var(--stitch-on-surface)",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    Mesajınız
                  </label>
                  <textarea
                    rows={4}
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                    placeholder="Merhaba, rotandaki ikinci gün durağı hakkında bir soru sormak istiyorum..."
                    required
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "12px",
                      border: "1px solid var(--stitch-outline-variant)",
                      fontSize: "14px",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>
              <div className="pub-modal-footer">
                <button
                  type="button"
                  className="pub-btn-secondary"
                  onClick={() => setShowMessageModal(false)}
                >
                  İptal
                </button>
                <button type="submit" className="pub-btn-primary">
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    send
                  </span>
                  <span>Mesajı İlet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Trip Modal */}
      {showGroupModal && (
        <div className="pub-modal-backdrop" onClick={() => setShowGroupModal(false)}>
          <div className="pub-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="pub-modal-header">
              <h3 className="pub-modal-title">Ortak Gezi Grubuna Katıl</h3>
              <button
                type="button"
                className="pub-icon-btn"
                onClick={() => setShowGroupModal(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleGroupRequest}>
              <div className="pub-modal-body">
                <p
                  style={{
                    fontSize: "14px",
                    color: "var(--stitch-on-surface-variant)",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {displayName} tarafından planlanan gelecek gezilere ve ortak keşif etkinliklerine
                  dahil olmak için katılım talebi oluşturun.
                </p>
                <div>
                  <label
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "var(--stitch-on-surface)",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    Tercih Ettiğin Bölge ve Notun
                  </label>
                  <textarea
                    rows={3}
                    value={groupNote}
                    onChange={(e) => setGroupNote(e.target.value)}
                    placeholder="Örn: İtalya veya Alpler doğa yürüyüşü rotalarında ortak gruba katılmak isterim."
                    required
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "12px",
                      border: "1px solid var(--stitch-outline-variant)",
                      fontSize: "14px",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>
              <div className="pub-modal-footer">
                <button
                  type="button"
                  className="pub-btn-secondary"
                  onClick={() => setShowGroupModal(false)}
                >
                  Vazgeç
                </button>
                <button type="submit" className="pub-btn-primary">
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    check
                  </span>
                  <span>Talebi Gönder</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auth Gate Modal */}
      {showAuthModal && (
        <AuthActionModal
          isOpen={showAuthModal}
          title={authModalConfig.title}
          subtitle={authModalConfig.subtitle}
          featureName={authModalConfig.featureName}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </PageShell>
  );
}
