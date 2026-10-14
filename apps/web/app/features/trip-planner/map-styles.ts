export type PlaceCategory = "kahve" | "yemek" | "muze" | "alisveris" | "otel" | "doga" | "genel";

export interface CategoryMeta {
  id: PlaceCategory;
  emoji: string;
  label: string;
  color: string;
}

export const CATEGORIES: Record<PlaceCategory, CategoryMeta> = {
  kahve: { id: "kahve", emoji: "☕", label: "Kahve & Kafe", color: "#8b5cf6" },
  yemek: { id: "yemek", emoji: "🍽️", label: "Yemek & Restoran", color: "#f97316" },
  muze: { id: "muze", emoji: "🏛️", label: "Müze & Tarih", color: "#3b82f6" },
  alisveris: { id: "alisveris", emoji: "🛍️", label: "Alışveriş & Çarşı", color: "#ec4899" },
  otel: { id: "otel", emoji: "🏨", label: "Otel & Konaklama", color: "#06b6d4" },
  doga: { id: "doga", emoji: "🌳", label: "Doğa & Park", color: "#10b981" },
  genel: { id: "genel", emoji: "📍", label: "Genel Ziyaret", color: "#6366f1" },
};

export type MapStyleId = "sade" | "transit" | "standart" | "koyu" | "uydu" | "doga";

export interface MapStyleOption {
  id: MapStyleId;
  label: string;
  badge?: string;
  description: string;
  icon: string;
  url: string;
  subdomains?: string;
  attribution: string;
  maxZoom: number;
}

export const MAP_STYLES: MapStyleOption[] = [
  {
    id: "standart",
    label: "Standart Sokak",
    badge: "Önerilen",
    description: "Detaylı cadde, sokak, bina sınırları ve Türkçe yerleşimler",
    icon: "🗺️",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    subdomains: "abc",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  {
    id: "sade",
    label: "Sade Pastel",
    badge: "Açık Tema",
    description: "Gözü yormayan açık pastel yollar ve yerleşimler, dikkat dağıtmaz",
    icon: "🏙️",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    subdomains: "abc",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  {
    id: "transit",
    label: "Toplu Taşıma & Şehir",
    badge: "Ulaşım",
    description: "Metro, tramvay, istasyonlar ve seyahat hatları",
    icon: "🚇",
    url: "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=tr",
    subdomains: "0123",
    attribution: '&copy; Google Maps',
    maxZoom: 20,
  },
  {
    id: "koyu",
    label: "Koyu Minimal",
    badge: "Gece Modu",
    description: "Karanlık tema ve parlayan konum işaretçileri",
    icon: "🌙",
    url: "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=tr",
    subdomains: "0123",
    attribution: '&copy; Google Maps',
    maxZoom: 20,
  },
  {
    id: "uydu",
    label: "Uydu & Hibrit",
    badge: "Fotoğraf",
    description: "Yüksek çözünürlüklü gerçek uydu görüntüsü ve arazi yapısı",
    icon: "🛰️",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    subdomains: "abc",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  {
    id: "doga",
    label: "Doğa & Arazi",
    badge: "Topografya",
    description: "Yükselti konturları, ormanlar ve yürüyüş patikaları",
    icon: "🏔️",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    subdomains: "abc",
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
  },
];

export const PIN_COLORS = [
  { id: "#2563eb", name: "Okyanus Mavisi", color: "#2563eb" },
  { id: "#10b981", name: "Zümrüt Yeşili", color: "#10b981" },
  { id: "#8b5cf6", name: "Kraliyet Moru", color: "#8b5cf6" },
  { id: "#f97316", name: "Mercan Turuncusu", color: "#f97316" },
  { id: "#ec4899", name: "Gül Pembesi", color: "#ec4899" },
  { id: "#ef4444", name: "Yakut Kırmızısı", color: "#ef4444" },
];

export const MAP_FILTERS = [
  { id: "none", label: "Standart", css: "none" },
  { id: "vibrant", label: "Canlı & Doygun", css: "saturate(1.25) contrast(1.05)" },
  { id: "contrast", label: "Yüksek Kontrast", css: "contrast(1.2) brightness(0.98)" },
  { id: "warm", label: "Sıcak Günbatımı", css: "sepia(0.18) saturate(1.15)" },
];
