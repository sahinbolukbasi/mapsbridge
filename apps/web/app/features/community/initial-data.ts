import type { CommunityPost, GroupTrip, MarketRoute } from "./types";

export interface GroupChatMessage {
  id: string;
  tripId: string;
  senderUsername: string;
  senderDisplayName: string;
  text: string;
  isAnnouncement?: boolean;
  createdAt: string;
  attachedRoute?: {
    title: string;
    stopsCount: number;
    destination: string;
  };
}

export interface TravelBuddy {
  id: string;
  name: string;
  username: string;
  avatar: string;
  matchScore: number;
  matchReason: string;
  targetDestination: string;
  travelDates: string;
  travelStyle: string;
  interests: string[];
  mutualRoutesCount: number;
  bio: string;
  isVerified: boolean;
}

export const PRESET_TRAVEL_PHOTOS = [
  {
    label: "🏛️ Roma Kolezyum",
    url: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=900&auto=format&fit=crop&q=80",
  },
  {
    label: "🎈 Kapadokya Balonlar",
    url: "https://images.unsplash.com/photo-1609856878074-cf31e21ccb6b?w=900&auto=format&fit=crop&q=80",
  },
  {
    label: "🌊 Boğaz & Kız Kulesi",
    url: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=900&auto=format&fit=crop&q=80",
  },
  {
    label: "🌿 Ege & Likya Koyu",
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&auto=format&fit=crop&q=80",
  },
];

export const INITIAL_MARKET_ROUTES: MarketRoute[] = [
  {
    id: "mkt_1",
    sellerUsername: "elif_demir",
    sellerName: "Elif Demir",
    sellerAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    title: "Roma'nın Gizli Lezzet & Trattoria Rotası",
    destination: "Roma, İtalya",
    category: "Gastronomi",
    description:
      "Turistik kalabalıktan uzak, yerel halkın tercih ettiği asırlık trattoria'lar, el yapımı dondurmacılar ve gizli şarap mahzenleri. Her durakta rezervasyon önerisi dahildir.",
    coverImage:
      "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=900&auto=format&fit=crop&q=80",
    stopCount: 18,
    durationLabel: "3 Gün",
    price: 0,
    currency: "TRY",
    rating: 4.9,
    reviewCount: 38,
    status: "active",
    salesCount: 184,
    createdAt: "2 hafta önce",
    stops: [
      {
        label: "Trattoria da Enzo al 29",
        address: "Via dei Vascellari 29, Trastevere",
        lat: 41.8885,
        lng: 12.4764,
        category: "yemek",
      },
      {
        label: "Roscioli Salumeria con Cucina",
        address: "Via dei Giubbonari 21, Roma",
        lat: 41.8942,
        lng: 12.4735,
        category: "yemek",
      },
      {
        label: "Frigidarium Dondurma",
        address: "Via del Governo Vecchio 112",
        lat: 41.8978,
        lng: 12.4705,
        category: "kahve",
      },
      {
        label: "Sant'Eustachio Il Caffè",
        address: "Piazza di S. Eustachio 82",
        lat: 41.8981,
        lng: 12.4746,
        category: "kahve",
      },
    ],
  },
  {
    id: "mkt_2",
    sellerUsername: "sahin",
    sellerName: "Şahin Bölükbaşı",
    sellerAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
    title: "Kapadokya Profesyonel Fotoğraf & Gün Batımı Rotası",
    destination: "Kapadokya, Türkiye",
    category: "Fotoğrafçılık",
    description:
      "Gün doğumu balon kalkış açıları, tripod noktaları, ışık saatleri ve gizli vadi patikaları. Fotoğraf tutkunları için hazırlanmış rehber.",
    coverImage:
      "https://images.unsplash.com/photo-1609856878074-cf31e21ccb6b?w=900&auto=format&fit=crop&q=80",
    stopCount: 14,
    durationLabel: "2 Gün",
    price: 0,
    currency: "TRY",
    rating: 5.0,
    reviewCount: 29,
    status: "active",
    salesCount: 142,
    createdAt: "1 hafta önce",
    stops: [
      {
        label: "Aşk Vadisi Seyir Tepesi",
        address: "Aşk Vadisi, Çavuşin",
        lat: 38.6587,
        lng: 34.8322,
        category: "manzara",
      },
      {
        label: "Kızılçukur Vadisi Gün Batımı",
        address: "Ortahisar, Nevşehir",
        lat: 38.6558,
        lng: 34.8624,
        category: "manzara",
      },
      {
        label: "Paşabağları Peribacaları",
        address: "Zelve Yolu, Paşabağ",
        lat: 38.6775,
        lng: 34.8543,
        category: "tarih",
      },
    ],
  },
  {
    id: "mkt_3",
    sellerUsername: "melis_kaya",
    sellerName: "Melis Kaya",
    sellerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    title: "İstanbul Tarihi Yarımada & Boğaz Klasikleri",
    destination: "İstanbul, Türkiye",
    category: "Şehir Gezisi",
    description:
      "Sultanahmet, Ayasofya, Yerebatan, Kapalıçarşı ve Galata hattını içeren, yürüyerek keşfetmeye uygun tamamen ücretsiz kültürel gezi rotası.",
    coverImage:
      "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=900&auto=format&fit=crop&q=80",
    stopCount: 12,
    durationLabel: "2 Gün",
    price: 0,
    currency: "TRY",
    rating: 4.8,
    reviewCount: 64,
    status: "active",
    salesCount: 220,
    createdAt: "3 hafta önce",
    stops: [
      {
        label: "Sultanahmet Camii",
        address: "Sultan Ahmet, Fatih",
        lat: 41.0054,
        lng: 28.9768,
        category: "tarih",
      },
      {
        label: "Ayasofya-i Kebîr Câmi-i Şerîfi",
        address: "Ayasofya Meydanı, Fatih",
        lat: 41.0086,
        lng: 28.9802,
        category: "tarih",
      },
      {
        label: "Yerebatan Sarnıcı",
        address: "Alemdar, Yerebatan Cd.",
        lat: 41.0084,
        lng: 28.9778,
        category: "muze",
      },
      {
        label: "Galata Kulesi",
        address: "Bereketzade, Beyoğlu",
        lat: 41.0256,
        lng: 28.9741,
        category: "manzara",
      },
    ],
  },
];

export const INITIAL_DEMO_POSTS: CommunityPost[] = [
  {
    id: "post_1",
    authorUsername: "elif_demir",
    authorDisplayName: "Elif Demir",
    authorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    authorFollowersCount: 14200,
    category: "Tarih & Kültür",
    locationTag: "Kolezyum, Roma",
    hashtags: ["#Roma", "#AntikMiras", "#Tarih"],
    content:
      "Roma'da Kolezyum ve Forum Romanum'u sabah 08:30 ilk saatinde ziyaret etmek seyahatimizin en iyi kararı oldu! Kalabalık bastırmadan antik mermer sütunlar arasında yürüyüp Palatino tepesinden şehri izlemek büyüleyici. Rota duraklarımı haritada paylaştım, mutlaka kaydedin! 🏛️✨",
    image:
      "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=900&auto=format&fit=crop&q=80",
    tags: ["Roma", "Tarih", "SeyahatTavsiyesi"],
    linkedRoute: {
      title: "Roma Rönesans & Antik Miras",
      stopCount: 4,
      destination: "Roma, İtalya",
      stops: [
        {
          label: "Kolezyum",
          address: "Piazza del Colosseo, 1, Roma",
          lat: 41.8902,
          lng: 12.4922,
          category: "tarih",
        },
        {
          label: "Forum Romanum",
          address: "Via della Salara Vecchia, Roma",
          lat: 41.8925,
          lng: 12.4853,
          category: "tarih",
        },
        {
          label: "Pantheon",
          address: "Piazza della Rotonda, Roma",
          lat: 41.8986,
          lng: 12.4769,
          category: "kultur",
        },
        {
          label: "Trevi Çeşmesi",
          address: "Piazza di Trevi, Roma",
          lat: 41.9009,
          lng: 12.4833,
          category: "turistik",
        },
      ],
    },
    likesCount: 38,
    likedByMe: false,
    repostCount: 14,
    viewsCount: 420,
    savesCount: 34,
    comments: [
      {
        id: "c1",
        username: "canberk_yilmaz",
        displayName: "Canberk Yılmaz",
        text: "Kolezyum biletini hangi siteden aldın acaba? Harika kare!",
        createdAt: "2 saat önce",
      },
    ],
    createdAt: "3 saat önce",
  },
  {
    id: "post_2",
    authorUsername: "canberk_yilmaz",
    authorDisplayName: "Canberk Yılmaz",
    authorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    authorFollowersCount: 9800,
    category: "Doğa & Yürüyüş",
    locationTag: "Aşk Vadisi, Kapadokya",
    hashtags: ["#Kapadokya", "#BalonTuru", "#Doğa"],
    content:
      "Kapadokya vadilerinde gün doğumu yürüyüşü... Aşk Vadisi ve Paşabağları arasında bisiklet rotası çıkarttık. Gökyüzü rengarenk sıcak hava balonlarıyla dolduğunda zaman duruyor sanki. Önümüzdeki ay bu rotaya grup gezisiyle çıkacağız! 🎈🌄",
    image:
      "https://images.unsplash.com/photo-1609856878074-cf31e21ccb6b?w=900&auto=format&fit=crop&q=80",
    tags: ["Kapadokya", "Doğa", "BalonTuru"],
    linkedRoute: {
      title: "Kapadokya Vadiler & Gün Doğumu",
      stopCount: 3,
      destination: "Nevşehir, Türkiye",
      stops: [
        {
          label: "Göreme Balon Kalkış Alanı",
          address: "Göreme, Nevşehir",
          lat: 38.6431,
          lng: 34.8289,
          category: "doga",
        },
        {
          label: "Aşk Vadisi Seyir Tepesi",
          address: "Aşk Vadisi, Çavuşin",
          lat: 38.6587,
          lng: 34.8322,
          category: "manzara",
        },
        {
          label: "Paşabağları Peribacaları",
          address: "Zelve Yolu, Paşabağ",
          lat: 38.6775,
          lng: 34.8543,
          category: "tarih",
        },
      ],
    },
    likesCount: 56,
    likedByMe: true,
    repostCount: 22,
    viewsCount: 680,
    savesCount: 52,
    comments: [],
    createdAt: "6 saat önce",
  },
];

export const INITIAL_DEMO_TRIPS: GroupTrip[] = [
  {
    id: "trip_1",
    organizerUsername: "sahin",
    organizerName: "Şahin Bölükbaşı",
    organizerAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
    organizerRole: "Gezi Lideri",
    title: "4 Günlük Roma & Antik Miras Gezginler Buluşması",
    destination: "Roma, İtalya",
    dates: "18 - 22 Ekim 2026",
    capacity: 6,
    pricePerPerson: 0,
    meetingPoint: "Colosseo Metro Çıkışı (Kafe önü)",
    style: "Kültür & Yürüyüş",
    description:
      "Roma sokaklarını yürüyerek keşfedeceğimiz, yerel trattoria'larda akşam yemeği yiyeceğimiz 6 kişilik samimi bir seyahat arkadaşı grubu. Rota duraklarımız hazır, masrafları ortak paylaşacağız.",
    routeStops: [
      {
        label: "Kolezyum",
        address: "Piazza del Colosseo, Roma",
        lat: 41.8902,
        lng: 12.4922,
        category: "tarih",
      },
      {
        label: "Pantheon",
        address: "Piazza della Rotonda, Roma",
        lat: 41.8986,
        lng: 12.4769,
        category: "kultur",
      },
      {
        label: "Trastevere Sokakları",
        address: "Trastevere, Roma",
        lat: 41.8894,
        lng: 12.4705,
        category: "gastronomi",
      },
    ],
    attendees: [
      {
        id: "att_1",
        username: "elif_demir",
        displayName: "Elif Demir",
        note: "Fotoğraf çekmeyi çok seviyorum, sabah erken turlara seve seve katılırım!",
        status: "approved",
        joinedAt: "Dün",
      },
      {
        id: "att_2",
        username: "canberk_yilmaz",
        displayName: "Canberk Yılmaz",
        note: "İtalyanca temel seviyede biliyorum, araç gerekirse destek olurum.",
        status: "approved",
        joinedAt: "3 saat önce",
      },
    ],
    createdAt: "2 gün önce",
  },
  {
    id: "trip_2",
    organizerUsername: "melis_kaya",
    organizerName: "Melis Kaya",
    organizerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    organizerRole: "Lisanslı Rehber",
    title: "Kapadokya Gün Doğumu Fotoğraf & Vadi Yürüyüşü Turu",
    destination: "Kapadokya, Türkiye",
    dates: "5 - 8 Kasım 2026",
    capacity: 8,
    pricePerPerson: 450,
    meetingPoint: "Göreme Meydanı Saat Kulesi",
    style: "Rehberli Tur & Fotoğraf",
    description:
      "Profesyonel rehberlik eşliğinde en iyi gün doğumu noktaları, vadi yürüyüşü ve yerel çömlek atölyesi deneyimi. Katılım ücretine yerel rehberlik ve özel araç transferi dahildir.",
    routeStops: [
      {
        label: "Göreme Açık Hava Müzesi",
        address: "Göreme, Nevşehir",
        lat: 38.6405,
        lng: 34.8454,
        category: "tarih",
      },
      {
        label: "Kızılçukur Vadisi Gün Batımı",
        address: "Ortahisar, Nevşehir",
        lat: 38.6558,
        lng: 34.8624,
        category: "manzara",
      },
    ],
    attendees: [
      {
        id: "att_3",
        username: "gezgin_ali",
        displayName: "Ali Kaya",
        note: "Fotoğraf makinem hazır, sabırsızlıkla bekliyorum!",
        status: "approved",
        joinedAt: "1 gün önce",
        paid: true,
      },
    ],
    createdAt: "3 gün önce",
  },
];

export const INITIAL_MESSAGES: GroupChatMessage[] = [
  {
    id: "gm_1",
    tripId: "trip_1",
    senderUsername: "sahin",
    senderDisplayName: "Şahin Bölükbaşı (Organizatör)",
    text: "📢 Organizatör Duyurusu: Arkadaşlar merhaba! Kolezyum biletlerini sabah 08:30 seansına aldık. Buluşma noktamız metro çıkışındaki kafe önüdür.",
    isAnnouncement: true,
    createdAt: "Dün 18:30",
  },
  {
    id: "gm_2",
    tripId: "trip_1",
    senderUsername: "elif_demir",
    senderDisplayName: "Elif Demir",
    text: "Harika haber, ben de fotoğraf ekipmanımı hazırladım!",
    isAnnouncement: false,
    createdAt: "Dün 19:15",
  },
];

export const DEMO_TRAVEL_BUDDIES: TravelBuddy[] = [
  {
    id: "buddy_1",
    name: "Cemre Aksoy",
    username: "cemre_aksoy",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
    matchScore: 96,
    matchReason: "Ortak İlgi: Tarih & Kültür, 3. Nesil Kahveciler, Roma Planı",
    targetDestination: "Roma, İtalya",
    travelDates: "12 - 18 Ekim 2026",
    travelStyle: "Kültür Kaşifi & Fotoğraf Tutkunu",
    interests: ["Tarih & Kültür", "Kahve & Mola", "Yürüyüş"],
    mutualRoutesCount: 3,
    bio: "Antik kentleri yürüyerek adım adım gezmeyi ve lokal trattoria'ları keşfetmeyi seviyorum. Roma için yol arkadaşı arıyorum!",
    isVerified: true,
  },
  {
    id: "buddy_2",
    name: "Murat Çetin",
    username: "murat_cetin",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
    matchScore: 92,
    matchReason: "Ortak İlgi: Doğa Yürüyüşü, Sırt Çantası, Kapadokya Planı",
    targetDestination: "Kapadokya, Türkiye",
    travelDates: "24 - 28 Ekim 2026",
    travelStyle: "Doğa & Macera Gezgini",
    interests: ["Doğa & Yürüyüş", "Fotoğrafçılık", "Kamp"],
    mutualRoutesCount: 2,
    bio: "Vadilerde gün doğumu yürüyüşleri ve balon fotoğrafçılığı için gezi arkadaşı arıyorum. Rotaları paylaşımlı yürüyebiliriz.",
    isVerified: true,
  },
  {
    id: "buddy_3",
    name: "Seda Yıldırım",
    username: "seda_yildirim",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150",
    matchScore: 88,
    matchReason: "Ortak İlgi: Şehir Gezisi, Gastronomi, İstanbul Rotaları",
    targetDestination: "İstanbul, Türkiye",
    travelDates: "Hafta Sonu Gezileri",
    travelStyle: "Gurme & Şehir Kaşifi",
    interests: ["Gastronomi", "Tarih & Kültür", "Şehir Gezisi"],
    mutualRoutesCount: 4,
    bio: "İstanbul'un tarihi yarımada sokakları ve lezzet duraklarını hafta sonları organize ediyoruz. Yeni insanlarla tanışmayı seviyorum.",
    isVerified: true,
  },
  {
    id: "buddy_4",
    name: "Tolga Demir",
    username: "tolga_demir",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150",
    matchScore: 85,
    matchReason: "Ortak İlgi: Bisiklet & Tarih, Ege & Akdeniz Rotaları",
    targetDestination: "İzmir & Ege Kıyıları",
    travelDates: "5 - 10 Kasım 2026",
    travelStyle: "Sırt Çantalı & Bisiklet",
    interests: ["Doğa & Yürüyüş", "Bisiklet", "Tarih & Kültür"],
    mutualRoutesCount: 1,
    bio: "Ege kıyı şeridinde antik kentleri ve koyları bisikletle geziyorum. Tempomuza ayak uyduracak gezi arkadaşlarına açığım.",
    isVerified: false,
  },
];
