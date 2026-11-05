import type { UserInterest } from "./types";
/** Profil ilgi alanları (yalnızca kullanıcının seçtiği; varsayılan seçim yok, I5). */
export const AVAILABLE_INTERESTS: UserInterest[] = [
  { id: "tarih", label: "Tarih & Arkeoloji" },
  { id: "hiking", label: "Doğa Yürüyüşü" },
  { id: "gastro", label: "Gastronomi" },
  { id: "foto", label: "Fotoğrafçılık" },
  { id: "kamp", label: "Kampçılık" },
  { id: "solo", label: "Solo Seyahat" },
  { id: "deniz", label: "Deniz & Adalar" },
  { id: "dag", label: "Yüksek İrtifa Dağcılık" },
  { id: "kultur", label: "Müze & Sanat" },
  { id: "bisiklet", label: "Bisiklet Rotaları" },
  { id: "karavan", label: "Karavan & Roadtrip" },
  { id: "kahve", label: "Kahve & Kafe Keşfi" },
];
