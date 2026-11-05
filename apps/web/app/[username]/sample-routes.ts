// Örnek gezgin profillerinin (/gezgin/, /traveler/, /demo/, /kasif/) örnek rotaları (F2).
// Bunlar gerçek bir kullanıcıya ait DEĞİLDİR ve sayfada "Örnek profil" rozetiyle gösterilir.
// Puan, fiyat, takipçi ya da süre gibi sayısal iddia içermez; durak sayısı yalnızca listedeki
// duraklardan sayılır. Koordinatlar yer adlarının yaklaşık konumudur (statik veri, LLM değil).

/** Örnek profil kullanıcı adları = [username] generateStaticParams. */
export const SAMPLE_PROFILE_USERNAMES = ["gezgin", "traveler", "demo", "kasif"] as const;

export function isSampleProfile(username: string): boolean {
  return (SAMPLE_PROFILE_USERNAMES as readonly string[]).includes(username.trim().toLowerCase());
}

export type SampleStop = { label: string; lat: number; lng: number };
export type SampleRoute = {
  id: string;
  title: string;
  summary: { tr: string; en: string };
  category: { tr: string; en: string };
  image: string;
  stops: SampleStop[];
};

export const SAMPLE_ROUTES: SampleRoute[] = [
  {
    id: "ist-tarihi",
    title: "İstanbul Tarihi Yarımada & Gizli Geçitler",
    summary: {
      tr: "Sultanahmet, Süleymaniye ve Balat arasında tarihi yarımada yürüyüşü.",
      en: "A walk across the historic peninsula from Sultanahmet to Süleymaniye and Balat.",
    },
    category: { tr: "Yürüyüş", en: "Walking" },
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA9auz0nMBA4KRXGYite_AL45bw5Dhivt2lu5tIfS587bQePKqSUIWHRIATmlPycVGpU_aa4FmAuio7MquobSV_ywCgZicVFy3N5V7RBlp_HbbGO_l2Zkqt92jTI9_3PXkLbm1cvXfRZk8vA9LtoncC9lHXPTNzLR0bmKCCluRy1i4QDgDvAxI4MiuoEBeg2Ktqa45F6xQBB-8UGDujf2ENpeLAT_98xuLniwJhERS2X7jigCdfGko6SA",
    stops: [
      { label: "Sultanahmet Meydanı & Dikilitaş", lat: 41.0064, lng: 28.9768 },
      { label: "Büyük Valide Han Çatısı", lat: 41.0145, lng: 28.9692 },
      { label: "Süleymaniye Külliyesi & Çay Terasları", lat: 41.0165, lng: 28.9639 },
      { label: "Balat Antika Mezatları & Fener Rum Patrikhanesi", lat: 41.0298, lng: 28.9515 },
    ],
  },
  {
    id: "kapadokya-vadi",
    title: "Kapadokya Vadi & Gün Doğumu Balon Rotası",
    summary: {
      tr: "Aşk Vadisi, Kızılçukur ve Çavuşin arasında vadi rotası.",
      en: "A valley route between Love Valley, Red Valley and Çavuşin.",
    },
    category: { tr: "Doğa ve fotoğraf", en: "Nature and photography" },
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDj77hONrKmR8Fj8zu5NotnVeEZKEbBCjiHWPDDdPNHXPfNBawa4jOVv4lb0DULeshMOo9EYfGUBuB93gFvv2Y4_bY3Mt04r0050Hxm-540eN8ryevPBa-s65G8oYTJJIQHd-_Okm8socXdtFrxC3Ky55ADOpJPQLP8lKS3CUAR5TX5SoBr7ula4ikR9mbmpFOl0Zn6Z4MISYycRfOK7ZvKNBnCxDHgfEpBv7jtfwSEXJQmN93daNsUrA",
    stops: [
      { label: "Aşk Vadisi Gün Doğumu Seyir Tepesi", lat: 38.6655, lng: 34.8234 },
      { label: "Kızılçukur (Red Valley) Gün Batımı", lat: 38.6534, lng: 34.8623 },
      { label: "Çavuşin Eski Rum Köyü ve Kaya Kilisesi", lat: 38.6732, lng: 34.8412 },
    ],
  },
  {
    id: "roma-ronesans",
    title: "Roma Rönesans & Sokak Lezzetleri",
    summary: {
      tr: "Pantheon, Trastevere ve Campo de' Fiori arasında yeme-içme rotası.",
      en: "A food route between the Pantheon, Trastevere and Campo de' Fiori.",
    },
    category: { tr: "Yeme-içme", en: "Food" },
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDz5hKKLgZz2HEqo4RXPFdclKdZAUotPOUCJyIiFHGoEZ0HKCg7Gt91-pbyU6XcH1PV-uepmwupLCyqXL18UoxQ9W1k8zSa-nuNCZ6WlZn2p8VyvB04eeHvguxhuOXaLwf4KNdRzvmPJ10nHjkGYM3OShinvgnjjEtwoLQAW5APi75hzUXu4bqerJannuLp2w1-a8rWwll8xzWeTZyZ8tQN8K6uAi6DcPN0xeie2Cc-1RFwDJNwpqRD6w",
    stops: [
      { label: "Pantheon & Piazza Navona", lat: 41.8986, lng: 12.4769 },
      { label: "Trastevere Dar Sokaklar & Trattorialar", lat: 41.8885, lng: 12.4705 },
      { label: "Campo de' Fiori Sabah Pazarı", lat: 41.8956, lng: 12.4722 },
    ],
  },
  {
    id: "likya-trek",
    title: "Likya Yolu Özet Doğa Parkuru",
    summary: {
      tr: "Ölüdeniz, Kelebekler Vadisi ve Kabak arasında doğa parkuru.",
      en: "A nature trail between Ölüdeniz, Butterfly Valley and Kabak.",
    },
    category: { tr: "Doğa yürüyüşü", en: "Hiking" },
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAGcSmACLBMWI88qVo2gw7LDCnJq-siLZSBHZzr38vCYPXLCF82kxB4tcI4axfC_Y-NvCr2FGZGuTyR11_stFP0P5iyu_V3wR_yRxjZOwwJ4ykc4uEULf3_fea_j4r78ka7V6oNOMdh27KJRc4TovJrHfBhb7tf4wU94HfJb50KLpMdLa-EwY_Tdd3ZRa_NlJsLsWcouW_D2lum1viu0Wh8L8aT_isPH5xIjhxAubARC5XZU12Fk3XHqA",
    stops: [
      { label: "Ölüdeniz - Ovacık Likya Başlangıç Kapısı", lat: 36.5742, lng: 29.1415 },
      { label: "Kelebekler Vadisi Zirve Patikası", lat: 36.4952, lng: 29.1311 },
      { label: "Kabak Koyu & Cennet Koyu Kamping", lat: 36.4621, lng: 29.1245 },
    ],
  },
];
