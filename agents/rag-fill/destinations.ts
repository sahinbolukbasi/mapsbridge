/**
 * Curated destination × topic matrix for RAG KB ingestion.
 * Each entry generates one S3 document (400-token chunks).
 * valid_until = unix timestamp ~90 days from generation.
 */

export interface DestinationTopic {
  id: string;
  city: string;
  country: string;
  sourceUrl: string;
  topic: string;
  systemPrompt: string;
  userPrompt: string;
}

// 90 days in seconds
export const TTL_90_DAYS = 90 * 24 * 60 * 60;

export const DESTINATION_TOPICS: DestinationTopic[] = [
  // ── İstanbul ──────────────────────────────────────────────────
  {
    id: "istanbul-neighbourhoods",
    city: "İstanbul",
    country: "TR",
    sourceUrl: "https://goturkiye.com/istanbul",
    topic: "Semtler",
    systemPrompt: "Sen MapsBridge seyahat yazarısın. Kısa, doğrulanabilir, güncel seyahat bilgisi üret. Uydurma restoran adı, güncel fiyat veya kesin açılış saati verme.",
    userPrompt: "İstanbul'un 5-6 ana semt özetini yaz: Beyoğlu, Karaköy, Kadıköy, Beşiktaş, Fatih, Üsküdar. Her semt için baskın atmosfer, gezgin profili ve pratik bir ipucu. Max 500 kelime.",
  },
  {
    id: "istanbul-transport",
    city: "İstanbul",
    country: "TR",
    sourceUrl: "https://www.ibb.istanbul/en/News/Detail/4551",
    topic: "Ulaşım",
    systemPrompt: "Sen MapsBridge seyahat yazarısın. Kısa, doğrulanabilir seyahat bilgisi üret.",
    userPrompt: "İstanbul toplu ulaşım rehberi: İstanbulkart, metro hatları, tramvay, Metrobüs, vapur ve havalimanı bağlantıları. Bilet sistemi nasıl çalışır? Max 400 kelime.",
  },
  {
    id: "istanbul-food",
    city: "İstanbul",
    country: "TR",
    sourceUrl: "https://goturkiye.com/istanbul/taste",
    topic: "Yeme içme",
    systemPrompt: "Sen MapsBridge seyahat yazarısın. Tekil restoran adı veya güncel fiyat verme.",
    userPrompt: "İstanbul yeme-içme kültürü: kahvaltı, balık, meyhane kültürü, sokak yemekleri, simit, balık-ekmek, Karaköy simitçileri, Eminönü. Hangi semt ne ile ünlü? Max 450 kelime.",
  },
  {
    id: "istanbul-culture",
    city: "İstanbul",
    country: "TR",
    sourceUrl: "https://muze.gov.tr/muze-detay?SectionId=AYS01&DistId=MRK",
    topic: "Kültür ve müzeler",
    systemPrompt: "Sen MapsBridge seyahat yazarısın.",
    userPrompt: "İstanbul'da müze ve kültür mirası: Ayasofya, Topkapı, Arkeoloji Müzesi, Pera Müzesi, İstanbul Modern. Müze kartı avantajları, bilet sistemi hakkında genel bilgi (fiyat verme). Max 400 kelime.",
  },

  // ── Barcelona ─────────────────────────────────────────────────
  {
    id: "barcelona-neighbourhoods",
    city: "Barcelona",
    country: "ES",
    sourceUrl: "https://www.barcelona.cat/en/",
    topic: "Semtler",
    systemPrompt: "Sen MapsBridge seyahat yazarısın.",
    userPrompt: "Barcelona semtleri özeti: Gothic Quarter, Eixample, Gràcia, El Born, Barceloneta, Poblenou. Atmosfer, hedef kitle ve öne çıkan özellikler. Max 500 kelime.",
  },
  {
    id: "barcelona-gaudi",
    city: "Barcelona",
    country: "ES",
    sourceUrl: "https://www.sagradafamilia.org/en/",
    topic: "Gaudi ve mimari",
    systemPrompt: "Sen MapsBridge seyahat yazarısın. Güncel bilet fiyatı verme.",
    userPrompt: "Gaudí ve Barcelona mimarisi: Sagrada Família, Park Güell, Casa Batlló, Casa Milà, Casa Vicens. Her yapının özelliği ve ziyaret önceliği. Önceden bilet almanın önemi. Max 450 kelime.",
  },
  {
    id: "barcelona-food",
    city: "Barcelona",
    country: "ES",
    sourceUrl: "https://www.barcelona.cat/en/living-in-barcelona/food-drink",
    topic: "Yeme içme",
    systemPrompt: "Sen MapsBridge seyahat yazarısın. Tekil restoran adı verme.",
    userPrompt: "Barcelona mutfağı: tapas, pintxos, paella, pa amb tomàquet, vermouth kültürü. La Boqueria, Santa Caterina pazarları. Yeme saatleri (öğle 14:00+, akşam 21:00+). Max 400 kelime.",
  },
  {
    id: "barcelona-transport",
    city: "Barcelona",
    country: "ES",
    sourceUrl: "https://www.tmb.cat/en/home",
    topic: "Ulaşım",
    systemPrompt: "Sen MapsBridge seyahat yazarısın.",
    userPrompt: "Barcelona ulaşım: T-Casual kart, metro, FGC, Rodalies, sahil treni, bisiklet sistemi, havalimanı bağlantıları. Max 350 kelime.",
  },

  // ── Paris ─────────────────────────────────────────────────────
  {
    id: "paris-arrondissements",
    city: "Paris",
    country: "FR",
    sourceUrl: "https://en.parisinfo.com/",
    topic: "Semtler",
    systemPrompt: "Sen MapsBridge seyahat yazarısın.",
    userPrompt: "Paris semtleri: Marais (3-4), Saint-Germain (6), Montmartre (18), Bastille (11), Belleville (20), Opéra (9). Her semtin karakteri ve gezgin profili. Max 500 kelime.",
  },
  {
    id: "paris-museums",
    city: "Paris",
    country: "FR",
    sourceUrl: "https://www.louvre.fr/en",
    topic: "Müzeler",
    systemPrompt: "Sen MapsBridge seyahat yazarısın. Güncel bilet fiyatı verme.",
    userPrompt: "Paris müzeleri: Louvre, Musée d'Orsay, Centre Pompidou, Rodin Müzesi, Musée de l'Orangerie. Paris Müzeler Pass hakkında genel bilgi. Kuyruk stratejileri. Max 450 kelime.",
  },
  {
    id: "paris-food",
    city: "Paris",
    country: "FR",
    sourceUrl: "https://en.parisinfo.com/paris-restaurant-bar/thematic-guides/paris-gastronomy",
    topic: "Yeme içme",
    systemPrompt: "Sen MapsBridge seyahat yazarısın. Tekil restoran adı verme.",
    userPrompt: "Paris yeme-içme kültürü: brasserie, bistro, boulangerie, fromagerie, café culture. Arrondissement'a göre yemek karakteri. Croissant, crêpe, steak frites, jambon-beurre. Max 400 kelime.",
  },

  // ── Roma ──────────────────────────────────────────────────────
  {
    id: "roma-historic",
    city: "Roma",
    country: "IT",
    sourceUrl: "https://www.turismoroma.it/en/",
    topic: "Tarihi alanlar",
    systemPrompt: "Sen MapsBridge seyahat yazarısın. Güncel bilet fiyatı verme.",
    userPrompt: "Roma antik mirası: Kolezyum, Forum Romanum, Palatino Tepesi, Pantheon, Trastevere. Yürüyüş rotaları ve öncelik sıralaması. Max 450 kelime.",
  },
  {
    id: "roma-food",
    city: "Roma",
    country: "IT",
    sourceUrl: "https://www.turismoroma.it/it/node/48592",
    topic: "Yeme içme",
    systemPrompt: "Sen MapsBridge seyahat yazarısın.",
    userPrompt: "Roma mutfağı: cacio e pepe, carbonara, amatriciana, gricia, supplì, pizza al taglio, gelato. Hangi semtte ne yenir. Touristik tuzaklar ve ipuçları. Max 400 kelime.",
  },

  // ── Amsterdam ─────────────────────────────────────────────────
  {
    id: "amsterdam-neighbourhoods",
    city: "Amsterdam",
    country: "NL",
    sourceUrl: "https://www.iamsterdam.com/en/",
    topic: "Semtler",
    systemPrompt: "Sen MapsBridge seyahat yazarısın.",
    userPrompt: "Amsterdam semtleri: Jordaan, De Pijp, Oud-West, Oost, Noord, Centrum. Bisiklet kültürü, kanal hayatı. Max 450 kelime.",
  },
  {
    id: "amsterdam-museums",
    city: "Amsterdam",
    country: "NL",
    sourceUrl: "https://www.rijksmuseum.nl/en",
    topic: "Müzeler",
    systemPrompt: "Sen MapsBridge seyahat yazarısın. Güncel fiyat verme.",
    userPrompt: "Amsterdam müzeleri: Rijksmuseum, Van Gogh Müzesi, Anne Frank Evi, Stedelijk, EYE Film. I Amsterdam City Card hakkında genel bilgi. Önceden bilet almanın önemi. Max 400 kelime.",
  },

  // ── Tokyo ─────────────────────────────────────────────────────
  {
    id: "tokyo-neighbourhoods",
    city: "Tokyo",
    country: "JP",
    sourceUrl: "https://www.gotokyo.org/en/",
    topic: "Semtler",
    systemPrompt: "Sen MapsBridge seyahat yazarısın.",
    userPrompt: "Tokyo semtleri: Shinjuku, Shibuya, Asakusa, Harajuku, Akihabara, Shimokitazawa, Yanaka. Her semtin atmosferi ve gezgin profili. Max 500 kelime.",
  },
  {
    id: "tokyo-transport",
    city: "Tokyo",
    country: "JP",
    sourceUrl: "https://www.jreast.co.jp/e/",
    topic: "Ulaşım",
    systemPrompt: "Sen MapsBridge seyahat yazarısın.",
    userPrompt: "Tokyo ulaşım: JR Yamanote Line, Tokyo Metro, IC Card (Suica/Pasmo), Narita/Haneda bağlantıları, Shinkansen hakkında genel bilgi. Max 400 kelime.",
  },
  {
    id: "tokyo-food",
    city: "Tokyo",
    country: "JP",
    sourceUrl: "https://www.gotokyo.org/en/see-and-do/drinking-and-dining/index.html",
    topic: "Yeme içme",
    systemPrompt: "Sen MapsBridge seyahat yazarısın.",
    userPrompt: "Tokyo mutfağı: sushi, ramen, yakitori, izakaya, depachika (百貨店地下). Semtlere göre yemek yerleri. Bahşiş kültürü yok. Max 400 kelime.",
  },

  // ── Dubai ─────────────────────────────────────────────────────
  {
    id: "dubai-areas",
    city: "Dubai",
    country: "AE",
    sourceUrl: "https://www.visitdubai.com/en",
    topic: "Bölgeler",
    systemPrompt: "Sen MapsBridge seyahat yazarısın.",
    userPrompt: "Dubai bölgeleri: Downtown, Marina, JBR, Deira, Al Fahidi, Palm Jumeirah. Her bölgenin karakteri. Max 450 kelime.",
  },
  {
    id: "dubai-practical",
    city: "Dubai",
    country: "AE",
    sourceUrl: "https://www.visitdubai.com/en/articles/dubai-travel-guide",
    topic: "Pratik bilgiler",
    systemPrompt: "Sen MapsBridge seyahat yazarısın.",
    userPrompt: "Dubai pratik bilgiler: iklim ve en iyi sezon, kıyafet kuralları, Dubai Metro, Nol kart. Ramazan döneminde dikkat edilecekler. Max 400 kelime.",
  },

  // ── Antalya ───────────────────────────────────────────────────
  {
    id: "antalya-regions",
    city: "Antalya",
    country: "TR",
    sourceUrl: "https://www.goturkiye.com/antalya",
    topic: "Bölgeler",
    systemPrompt: "Sen MapsBridge seyahat yazarısın.",
    userPrompt: "Antalya bölgeleri: Kaleiçi, Lara, Konyaaltı, Kaş, Alanya, Side. Her bölgenin özelliği ve gezgin tipi. Max 450 kelime.",
  },
  {
    id: "antalya-nature",
    city: "Antalya",
    country: "TR",
    sourceUrl: "https://www.goturkiye.com/antalya/nature",
    topic: "Doğa ve plajlar",
    systemPrompt: "Sen MapsBridge seyahat yazarısın.",
    userPrompt: "Antalya doğal güzellikleri: Düden Şelalesi, Köprülü Kanyon, Olympos, Saklikent, Kaş mağaralar. Rafting ve yürüyüş imkânları. Max 400 kelime.",
  },

  // ── Londra ────────────────────────────────────────────────────
  {
    id: "london-neighbourhoods",
    city: "Londra",
    country: "GB",
    sourceUrl: "https://www.visitlondon.com/",
    topic: "Semtler",
    systemPrompt: "Sen MapsBridge seyahat yazarısın.",
    userPrompt: "Londra semtleri: Covent Garden, Shoreditch, Notting Hill, South Bank, Camden, Greenwich, Brixton. Her semtin karakteri. Max 500 kelime.",
  },
  {
    id: "london-museums",
    city: "Londra",
    country: "GB",
    sourceUrl: "https://www.britishmuseum.org/",
    topic: "Ücretsiz müzeler",
    systemPrompt: "Sen MapsBridge seyahat yazarısın.",
    userPrompt: "Londra ücretsiz müzeler: British Museum, Natural History Museum, V&A, National Gallery, Tate Modern, Science Museum. Ziyaret stratejileri. Max 400 kelime.",
  },
];
