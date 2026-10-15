import type { TravelerContact, GroupTopicRoute } from "./types";

export const DEFAULT_TRAVELER_CONTACTS: TravelerContact[] = [
  {
    id: "canberk",
    name: "Canberk Yılmaz",
    username: "canberk",
    initial: "CY",
    role: "Doğa & Dağcılık Rehberi",
    isFriend: true,
    online: true,
    interests: ["Dağcılık", "Trekking", "Kamp"],
    bio: "Likya ve Kaçkar zirve turları lideri. Rotada doğallığı ve keşfi önceler.",
  },
  {
    id: "elif",
    name: "Elif Demir",
    username: "elif_demir",
    initial: "ED",
    role: "Kültür & Müze Kaşifi",
    isFriend: true,
    online: true,
    interests: ["Müzeler", "Tarih", "Fotoğraf"],
    bio: "Antik kentler ve Kapadokya tarihi uzmanı. Kültür rotaları kurguluyor.",
  },
  {
    id: "melis",
    name: "Melis Kaya",
    username: "melis_kaya",
    initial: "MK",
    role: "Gezgin Fotoğrafçı",
    isFriend: true,
    online: false,
    interests: ["Fotoğrafçılık", "Kahve", "Mimari"],
    bio: "Sokak ve manzara fotoğrafçısı. Ege köyleri ve gurme durakları takipçisi.",
  },
  {
    id: "burak",
    name: "Burak Öz",
    username: "burak_oz",
    initial: "BO",
    role: "Kamp & Bisiklet Gezgini",
    isFriend: false,
    online: true,
    interests: ["Bikepacking", "Kamp", "Karavan"],
    bio: "Bisikletle Akdeniz turu planlıyor. Topluluk keşiflerine her zaman açık.",
  },
  {
    id: "selin",
    name: "Selin Aksoy",
    username: "selin_aksoy",
    initial: "SA",
    role: "Doğa Yürüyüşçüsü",
    isFriend: true,
    online: true,
    interests: ["Yürüyüş", "Eko-Turizm", "Botanik"],
    bio: "Hafta sonu doğa yürüyüşleri ve yerel flora keşifleri.",
  },
  {
    id: "kaan",
    name: "Kaan Öztürk",
    username: "kaan_ozturk",
    initial: "KO",
    role: "Şehir & Sokak Kaşifi",
    isFriend: false,
    online: false,
    interests: ["Şehir Turları", "Gastronomi", "Müzik"],
    bio: "Gizli şehir köşeleri, vintage kafeler ve yerel atölyeler arayan bir kaşif.",
  },
];

export const PRESET_GROUP_ROUTES: Record<string, GroupTopicRoute> = {
  kapadokya: {
    code: "KP-302",
    name: "Kapadokya Peri Bacaları & Vadi Keşfi",
    stats: "9 Durak • 18.4 km • 840m Tırmanış",
    coverImage:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBgbzFN9sn_tofBJ4zoOYV2kldz6peamsTyAlVvyfQV4UNqn1f25WuOzqrlZxr-2tFyh9OqMCPlRsf6fLEHHq6w-IFjZonglyq6qcHZE2YbIxpwx-Wsh4dC4M5qDh5E33OwOmPR3Szj-ni1QlyjjtsaP5WYsyCJUaJUF8HYVnFLzIebPasUuwACzsHA2o8elBcgFo4RAWytHm34doEyGZqeQfSuzWD241nscPR1ncOMm3bkHcrl55_CzQ",
    waypoints: [
      { num: 1, title: "Aşk Vadisi Balon Kalkışı", sub: "05:30 Buluşma Noktası" },
      { num: 2, title: "Kızılçukur Seyir Noktası", sub: "18:15 Gün Batımı Kampı" },
      { num: 3, title: "Göreme Açık Hava Müzesi", sub: "Tarihi Fresk Kiliseleri" },
      { num: 4, title: "Uçhisar Kalesi Panoraması", sub: "Zirve Seyri & Mola" },
    ],
  },
  likya: {
    code: "LK-108",
    name: "Likya Yolu Doğa & Kıyı Yürüyüşü",
    stats: "12 Durak • 42.0 km • 1.250m Tırmanış",
    coverImage:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDiLpwyngo5NBNi9lt1H15e1t-RU-EDBN32qrucWT-4d5GDcgURhhYdZuzKYQCC0rXr1Psxoz0SRfixjETBXnsaWmYDmQQ3GuRO1leeQ4s02fRulQimRhvrIkznkQk-GjaZ_upsGsaUEztfaAz2EIbBl0iKHOkVr1IOPbCahSj1T_to2vs-udokgquO8yTLCwPKxeeD-HEWLihOWJkfIHatXpQDVSg-CrVNN5azkZKZSb1D6-B11kTl8Q",
    waypoints: [
      { num: 1, title: "Ölüdeniz Başlangıç Kapısı", sub: "08:00 Toplanma" },
      { num: 2, title: "Kelebekler Vadisi Seyir Terası", sub: "Mola & Fotoğraf Çekimi" },
      { num: 3, title: "Kabak Koyu Kamp Alanı", sub: "Gün Batımı & Dinlenme" },
      { num: 4, title: "Alınca Manzara Noktası", sub: "Kıyıdan Yükseliş" },
    ],
  },
  ege: {
    code: "EG-204",
    name: "Ege Bağ Yolu & Gurme Rota",
    stats: "7 Durak • 28.5 km • Gurme Turu",
    coverImage:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBqBIhnVGRQ1gqKBQjyC_7Yr7J9nIoR2KBo6hAi5N3eMfwBt5MLD2Vp3rZUZMlSe-nBIO-b5y00RjVjuboxmHQrhBFTFeH2DbH7R157acNNY7xWhooWdbzR3Vu5aEV5BHaxeyIYO2Myq5HDX6DQWyYbGS8tRJBf3--f7b4juLWEMhjocwxEV1-RPqFUUoS0kPPlMPWqVdmAgCjJfc2SE651uxnh0SYdl-vX-VJ9Jv0S6psx3EtPJ2Lkbg",
    waypoints: [
      { num: 1, title: "Urla Sanat Sokağı", sub: "10:00 Sabah Kahvesi" },
      { num: 2, title: "Zeytinyağı Müzesi & Tadım", sub: "13:30 Yerel Üreticiler" },
      { num: 3, title: "Çeşmealtı İskele & Gün Batımı", sub: "18:45 Akşam Yemeği" },
    ],
  },
};
