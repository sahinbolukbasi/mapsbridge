export interface FaqItem {
  q: string;
  a: string;
}

export interface CommunityStory {
  initials: string;
  name: string;
  tag: string;
  live: boolean;
  gradient: boolean;
}

export interface LandingPost {
  initials: string;
  avatarClass: string;
  name: string;
  handle: string;
  time: string;
  location: string;
  caption: string;
  routeIcon: string;
  routeTitle: string;
  routeSub: string;
  code: string;
  likes: string;
  comments: string;
  actionIcon: string;
  actionLabel: string;
  live: boolean;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "MapsBridge tam olarak nasıl çalışır?",
    a: "MapsBridge, gideceğiniz şehir ve seyahat gün sayınızı aldığında gelişmiş seyahat optimizasyon motorunu devreye sokar. İlgi alanlarınız, mekanların çalışma saatleri ve birbirlerine olan mesafeleri analiz edilir; gün gün dengeli bir rota çıkarılarak interaktif canlı haritada sunulur.",
  },
  {
    q: "6 Haneli kod nedir ve nasıl kullanılır?",
    a: "Oluşturduğunuz her rota için sistem benzersiz bir 6 haneli kod (örneğin: RM-841) üretir. Bu kodu seyahat arkadaşlarınıza SMS, WhatsApp ya da sözlü olarak iletebilirsiniz. Arkadaşınız ana sayfadaki kod kutusuna bu şifreyi girdiğinde anında aynı rotaya tam erişim sağlar; yeni hesap açmasına dahi gerek kalmaz.",
  },
  {
    q: "Haritaları ve durakları çevrimdışı kullanabilir miyim?",
    a: "Evet. Seyahate çıkmadan önce rotanızı 'Çevrimdışı Kaydet' seçeneğiyle telefonunuza indirirsiniz. İnternet bağlantınız veya yurt dışı veri paketiniz olmasa bile durak sıralaması, konum koordinatları ve notlarınız cihazınızda eksiksiz çalışır.",
  },
  {
    q: "MapsBridge ücretsiz mi?",
    a: "Evet, MapsBridge'in temel yapay zeka rota oluşturma, canlı harita düzenleme ve 6 haneli kodla rota paylaşma özellikleri tamamen ücretsizdir. Kredi kartı bilgisi vermeden dakikalar içinde rotanızı oluşturup kullanabilirsiniz.",
  },
];

export const FAQ_ITEMS_EN: FaqItem[] = [
  {
    q: "How exactly does MapsBridge work?",
    a: "When you provide your destination city and trip duration, MapsBridge engages its advanced travel optimization engine. It analyzes your interests, verified museum hours, and walking distances to generate a balanced day-by-day itinerary on a live interactive map.",
  },
  {
    q: "What is the 6-digit code and how do I use it?",
    a: "MapsBridge generates a unique 6-digit code (e.g. RM-841) for each created route. You can share this code with companions via SMS, WhatsApp, or voice. Entering this code on the homepage instantly loads the complete live route—without requiring them to sign up.",
  },
  {
    q: "Can I access maps and stops offline?",
    a: "Yes. Before your trip, download your route with offline sync. Even with roaming off or no mobile reception abroad, your stop order, coordinates, and notes remain accessible right on your device.",
  },
  {
    q: "Is MapsBridge free to use?",
    a: "Yes! MapsBridge's core AI itinerary builder, interactive map desk, and 6-digit code sharing are completely free. You can plan and share your trip in minutes without any credit card required.",
  },
];

export const COMMUNITY_STORIES: CommunityStory[] = [
  {
    initials: "ED",
    name: "Elif Demir",
    tag: "Roma 🇮🇹 Canlı",
    live: true,
    gradient: true,
  },
  {
    initials: "CY",
    name: "Canberk Y.",
    tag: "Kapadokya 🎈 2s",
    live: false,
    gradient: true,
  },
  {
    initials: "MK",
    name: "Melis Kaya",
    tag: "Tokyo 🗼 Canlı",
    live: true,
    gradient: true,
  },
  {
    initials: "BA",
    name: "Barış Akın",
    tag: "Kopenhag 🚲 5s",
    live: false,
    gradient: false,
  },
  {
    initials: "SB",
    name: "Selin & Burak",
    tag: "Bali 🌴 Dün",
    live: false,
    gradient: false,
  },
];

export const COMMUNITY_POSTS: LandingPost[] = [
  {
    initials: "ED",
    avatarClass: "community-avatar-primary",
    name: "Elif Demir",
    handle: "@elif_demir",
    time: "23 dk önce",
    location: "Roma, Trastevere 📍",
    caption:
      "Trastevere ara sokaklarında kaybolmadan önce hazırladığımız 6 haneli rota kodunu grupla paylaştık! Kimse gruptan kopmadı, tam saatinde lezzet durağındayız 🍝 #MapsBridgeRoma",
    routeIcon: "map",
    routeTitle: "3 Günlük Roma Rönesans",
    routeSub: "4.8 km · 7 Durak",
    code: "RM-841",
    likes: "1.240",
    comments: "86",
    actionIcon: "fork_right",
    actionLabel: "Rotayı Çatalla",
    live: true,
  },
  {
    initials: "CY",
    avatarClass: "community-avatar-secondary",
    name: "Canberk Yılmaz",
    handle: "@canberk_yilmaz",
    time: "2 saat önce",
    location: "Aşk Vadisi, Kapadokya 🎈",
    caption:
      "Sabah 05:30 balon uçuşu için offline rota modu hayat kurtardı! Telefon hiç çekmediği halde duraklarımızın sırası ve gün doğumu noktası kusursuz işledi 🌅 #KapadokyaSunrise",
    routeIcon: "explore",
    routeTitle: "Kapadokya Vadi & Balon",
    routeSub: "Çevrimdışı Senkronize",
    code: "KP-109",
    likes: "2.890",
    comments: "142",
    actionIcon: "share",
    actionLabel: "Rotayı İndir",
    live: false,
  },
  {
    initials: "MK",
    avatarClass: "community-avatar-tertiary",
    name: "Melis Kaya",
    handle: "@melis_kaya",
    time: "Dün",
    location: "Shibuya Crossing, Tokyo 🇯🇵",
    caption:
      "Tek başıma çıktığım Asya turunda bütçe sapma uyarısı sayesinde harcamalarımı tam dengede tuttum. Metrolar arası yürüme rotası tam nokta atışıydı ⛩️ #TokyoSolo",
    routeIcon: "account_balance_wallet",
    routeTitle: "Tokyo Metropol Keşfi",
    routeSub: "< %3 Bütçe Sapması",
    code: "TK-502",
    likes: "3.410",
    comments: "215",
    actionIcon: "bookmark",
    actionLabel: "Rotayı Kaydet",
    live: true,
  },
];
