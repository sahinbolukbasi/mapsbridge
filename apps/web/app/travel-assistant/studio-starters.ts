// Oturumlu asistanın karşılama önerileri (FEAT-013, I11): her metin [i18n anahtarı, TR yedeği]
// çiftidir; bileşen `t(...pair)` ile çevirir. Öneriye dokunmak yalnızca bu metni sıradan bir
// kullanıcı mesajı olarak gönderir (sunucu kredi zinciri değişmez). Emoji/bayrak yok (R3, G28).
import type { IconName } from "../lib/icon-paths";

export type Text = readonly [key: string, fallback: string];

export type DestinationStarter = { id: string; city: Text; country: Text; prompt: Text };
export type ActivityStarter = { id: string; icon: IconName; label: Text; desc: Text; prompt: Text };
export type GuideStarter = { id: string; city: Text; topic: Text; prompt: Text };

const CITY = {
  rome: ["studio.city.rome", "Roma"],
  paris: ["studio.city.paris", "Paris"],
  istanbul: ["studio.city.istanbul", "İstanbul"],
  barcelona: ["studio.city.barcelona", "Barcelona"],
  amsterdam: ["studio.city.amsterdam", "Amsterdam"],
  cappadocia: ["studio.city.cappadocia", "Kapadokya"],
  london: ["studio.city.london", "Londra"],
  tokyo: ["studio.city.tokyo", "Tokyo"],
  dubai: ["studio.city.dubai", "Dubai"],
  antalya: ["studio.city.antalya", "Antalya"],
} as const satisfies Record<string, Text>;

const COUNTRY = {
  italy: ["studio.country.italy", "İtalya"],
  france: ["studio.country.france", "Fransa"],
  turkey: ["studio.country.turkey", "Türkiye"],
  spain: ["studio.country.spain", "İspanya"],
  netherlands: ["studio.country.netherlands", "Hollanda"],
  uk: ["studio.country.uk", "İngiltere"],
  japan: ["studio.country.japan", "Japonya"],
} as const satisfies Record<string, Text>;

export const POPULAR_DESTINATIONS: readonly DestinationStarter[] = [
  {
    id: "rome",
    city: CITY.rome,
    country: COUNTRY.italy,
    prompt: [
      "studio.dest.rome.prompt",
      "Roma'da 3 günlük tarih, sanat ve lezzet odaklı bir rota oluştur",
    ],
  },
  {
    id: "paris",
    city: CITY.paris,
    country: COUNTRY.france,
    prompt: [
      "studio.dest.paris.prompt",
      "Paris'te 3 günlük kültür, müze ve cafe odaklı bir gezi planla",
    ],
  },
  {
    id: "istanbul",
    city: CITY.istanbul,
    country: COUNTRY.turkey,
    prompt: [
      "studio.dest.istanbul.prompt",
      "İstanbul'da 2 günlük butik kahve, galeri ve Boğaz rotası oluştur",
    ],
  },
  {
    id: "barcelona",
    city: CITY.barcelona,
    country: COUNTRY.spain,
    prompt: [
      "studio.dest.barcelona.prompt",
      "Barcelona'da 3 günlük Gaudi, sahil ve tapas rotası planla",
    ],
  },
  {
    id: "amsterdam",
    city: CITY.amsterdam,
    country: COUNTRY.netherlands,
    prompt: [
      "studio.dest.amsterdam.prompt",
      "Amsterdam'da 2 günlük müze, kanal ve bisiklet rotası oluştur",
    ],
  },
  {
    id: "cappadocia",
    city: CITY.cappadocia,
    country: COUNTRY.turkey,
    prompt: [
      "studio.dest.cappadocia.prompt",
      "Kapadokya'da 2 günlük balon, vadi ve yeraltı şehri rotası oluştur",
    ],
  },
  {
    id: "london",
    city: CITY.london,
    country: COUNTRY.uk,
    prompt: [
      "studio.dest.london.prompt",
      "Londra'da 3 günlük tarihi yerler, pub ve pazar rotası planla",
    ],
  },
  {
    id: "tokyo",
    city: CITY.tokyo,
    country: COUNTRY.japan,
    prompt: [
      "studio.dest.tokyo.prompt",
      "Tokyo'da 4 günlük tapınak, anime, ramen ve teknoloji rotası oluştur",
    ],
  },
];

export const ACTIVITY_STARTERS: readonly ActivityStarter[] = [
  {
    id: "food",
    icon: "food",
    label: ["studio.activity.food.label", "Yerel lezzetler"],
    desc: ["studio.activity.food.desc", "Otantik restoranlar ve sokak yemekleri"],
    prompt: [
      "studio.activity.food.prompt",
      "Gideceğim şehirde mutlaka denenmesi gereken yerel yemekler ve en iyi restoranlar",
    ],
  },
  {
    id: "hotel",
    icon: "bed",
    label: ["studio.activity.hotel.label", "Otel ve konaklama"],
    desc: ["studio.activity.hotel.desc", "Bölge ve bütçe önerileri"],
    prompt: [
      "studio.activity.hotel.prompt",
      "Merkezi, güvenli ve bütçe dostu otel semtleri ve butik otel önerileri",
    ],
  },
  {
    id: "coffee",
    icon: "food",
    label: ["studio.activity.coffee.label", "Kahve ve mekan"],
    desc: ["studio.activity.coffee.desc", "Sessiz cafeler ve çalışma mekanları"],
    prompt: [
      "studio.activity.coffee.prompt",
      "Şehirde en iyi butik kahveciler, sessiz çalışma mekanları ve atmosferik kafeler",
    ],
  },
  {
    id: "nightlife",
    icon: "sparkle",
    label: ["studio.activity.nightlife.label", "Gece hayatı"],
    desc: ["studio.activity.nightlife.desc", "Barlar, canlı müzik ve rooftop"],
    prompt: [
      "studio.activity.nightlife.prompt",
      "Şehrin en iyi gece mekanları, rooftop barları ve canlı müzik noktaları",
    ],
  },
  {
    id: "photo",
    icon: "camera",
    label: ["studio.activity.photo.label", "Fotoğraf rotası"],
    desc: ["studio.activity.photo.desc", "Manzara ve gizli köşeler"],
    prompt: [
      "studio.activity.photo.prompt",
      "Instagram için en iyi fotoğraf noktaları, gizli köşeler ve gün batımı manzaraları",
    ],
  },
  {
    id: "budget",
    icon: "coin",
    label: ["studio.activity.budget.label", "Bütçe gezisi"],
    desc: ["studio.activity.budget.desc", "500€ altı kompakt tur"],
    prompt: [
      "studio.activity.budget.prompt",
      "500€ altı bütçeyle 3 günlük kompakt bir şehir gezisi planla, ücretsiz aktiviteler dahil",
    ],
  },
];

// Hızlı rehberler KB belgelerine eşlenir; seçim aya göre döner (getSeasonalGuides).
export const KB_QUICK_GUIDES: readonly GuideStarter[] = [
  {
    id: "istanbul-districts",
    city: CITY.istanbul,
    topic: ["studio.guide.topic.districts", "Semtler"],
    prompt: [
      "studio.guide.istanbul-districts.prompt",
      "İstanbul'un semtleri hakkında bilgi ver: Beyoğlu, Kadıköy, Karaköy",
    ],
  },
  {
    id: "barcelona-gaudi",
    city: CITY.barcelona,
    topic: ["studio.guide.topic.gaudi", "Gaudi"],
    prompt: [
      "studio.guide.barcelona-gaudi.prompt",
      "Barcelona'da Gaudí eserleri: Sagrada Família ve Park Güell ziyaret rehberi",
    ],
  },
  {
    id: "paris-museums",
    city: CITY.paris,
    topic: ["studio.guide.topic.museums", "Müzeler"],
    prompt: [
      "studio.guide.paris-museums.prompt",
      "Paris müzeleri rehberi: Louvre, Orsay ve Paris Müze Kartı",
    ],
  },
  {
    id: "tokyo-transit",
    city: CITY.tokyo,
    topic: ["studio.guide.topic.transit", "Ulaşım"],
    prompt: [
      "studio.guide.tokyo-transit.prompt",
      "Tokyo toplu ulaşım rehberi: JR, metro ve Suica kart nasıl kullanılır?",
    ],
  },
  {
    id: "rome-food",
    city: CITY.rome,
    topic: ["studio.guide.topic.cuisine", "Mutfak"],
    prompt: [
      "studio.guide.rome-food.prompt",
      "Roma mutfağı: cacio e pepe, carbonara ve pizza al taglio nerede yenir?",
    ],
  },
  {
    id: "amsterdam-museums",
    city: CITY.amsterdam,
    topic: ["studio.guide.topic.museums", "Müzeler"],
    prompt: [
      "studio.guide.amsterdam-museums.prompt",
      "Amsterdam müzeleri: Rijksmuseum, Van Gogh ve I Amsterdam City Card",
    ],
  },
  {
    id: "dubai-practical",
    city: CITY.dubai,
    topic: ["studio.guide.topic.practical", "Pratik"],
    prompt: [
      "studio.guide.dubai-practical.prompt",
      "Dubai seyahati pratik bilgiler: iklim, kıyafet kuralları ve metro rehberi",
    ],
  },
  {
    id: "london-free",
    city: CITY.london,
    topic: ["studio.guide.topic.free", "Ücretsiz"],
    prompt: [
      "studio.guide.london-free.prompt",
      "Londra'da ücretsiz müzeler: British Museum, Natural History Museum ziyaret rehberi",
    ],
  },
  {
    id: "antalya-nature",
    city: CITY.antalya,
    topic: ["studio.guide.topic.nature", "Doğa"],
    prompt: [
      "studio.guide.antalya-nature.prompt",
      "Antalya'da doğa: Düden Şelalesi, Köprülü Kanyon ve Kaş rehberi",
    ],
  },
  {
    id: "istanbul-transit",
    city: CITY.istanbul,
    topic: ["studio.guide.topic.transit", "Ulaşım"],
    prompt: [
      "studio.guide.istanbul-transit.prompt",
      "İstanbul toplu ulaşım rehberi: İstanbulkart, metro, tramvay ve vapur",
    ],
  },
  {
    id: "barcelona-food",
    city: CITY.barcelona,
    topic: ["studio.guide.topic.food", "Yemek"],
    prompt: [
      "studio.guide.barcelona-food.prompt",
      "Barcelona mutfağı: tapas, vermouth kültürü ve La Boqueria pazarı",
    ],
  },
  {
    id: "paris-districts",
    city: CITY.paris,
    topic: ["studio.guide.topic.districts", "Semtler"],
    prompt: [
      "studio.guide.paris-districts.prompt",
      "Paris semtleri: Marais, Montmartre, Saint-Germain ve Bastille karakterleri",
    ],
  },
];

/** Aya göre döndürülmüş rehber seçimi (önceki davranış: offset = ay × 3). */
export function getSeasonalGuides(count = 6, month = new Date().getMonth()): GuideStarter[] {
  const offset = (month * 3) % KB_QUICK_GUIDES.length;
  const rotated = [...KB_QUICK_GUIDES.slice(offset), ...KB_QUICK_GUIDES.slice(0, offset)];
  return rotated.slice(0, count);
}

export type RouteStyleKey = "calm" | "classic" | "explorer";
export const ROUTE_STYLES: readonly {
  key: RouteStyleKey;
  icon: IconName;
  label: Text;
  hint: Text;
}[] = [
  {
    key: "calm",
    icon: "walk",
    label: ["studio.style.calm", "Sakin rota"],
    hint: ["studio.style.calm.hint", "Az yürüyüş · uzun molalar"],
  },
  {
    key: "classic",
    icon: "map",
    label: ["studio.style.classic", "Klasik rota"],
    hint: ["studio.style.classic.hint", "Dengeli tempo · temel duraklar"],
  },
  {
    key: "explorer",
    icon: "compass",
    label: ["studio.style.explorer", "Kaşif rota"],
    hint: ["studio.style.explorer.hint", "Yerel noktalar · derin keşif"],
  },
];
