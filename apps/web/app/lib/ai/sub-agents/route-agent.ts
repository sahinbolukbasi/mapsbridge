import {
  isRoutePlan,
  UnifiedRoutePlan,
  RouteStop as _RouteStop,
  TravelerProfileContext,
} from "../types";
import { invokeBedrockJSON } from "../bedrock-client";

const ROUTE_SYSTEM_PROMPT = `Sen profesyonel bir Rota Planlama Ajanısın (Route Planner Agent).
Görevin: Kullanıcının belirttiği şehir veya bölge için gün gün optimize edilmiş, coğrafi sıraya göre mantıklı durakları olan bir seyahat rotası JSON'ı oluşturmak.

Kurallar:
1. Her durak için gerçek koordinatlar (lat, lng), tahmini süre ve açıklama ver.
2. Duraklar aynı gün içinde coğrafi olarak birbirine yakın olsun (yürüme/metro mesafesi).
3. JSON formatı:
{
  "title": "Rota Başlığı",
  "summary": "1-2 cümlelik rota özeti",
  "estimatedDays": 3,
  "theme": "Ana tema",
  "destination": "Şehir / Ülke",
  "stops": [
    {
      "id": "stop_1",
      "name": "Mekan Adı",
      "lat": 41.8902,
      "lng": 12.4922,
      "day": 1,
      "description": "Kısa ve ilgi çekici açıklama",
      "suggestedDuration": "2 saat",
      "category": "tarih" | "manzara" | "lezzet" | "kultur" | "doga" | "fotograf"
    }
  ]
}
Yalnızca geçerli JSON döndür.`;

export async function runRouteAgent(
  prompt: string,
  profileContext?: TravelerProfileContext,
  personaDirective?: string,
): Promise<{ route: UnifiedRoutePlan; source: "bedrock" | "fallback"; durationMs: number }> {
  const startTime = Date.now();

  const augmentedPrompt = `Kullanıcı İsteği: "${prompt}"
${personaDirective ? `Kullanıcı Tercihleri: ${personaDirective}` : ""}`;

  // 1. Bedrock denemesi
  const bedrockRes = await invokeBedrockJSON<UnifiedRoutePlan>(augmentedPrompt, {
    systemPrompt: ROUTE_SYSTEM_PROMPT,
    temperature: 0.2,
    maxTokens: 2500,
  });

  if (bedrockRes.success && isRoutePlan(bedrockRes.data)) {
    return {
      route: bedrockRes.data,
      source: "bedrock",
      durationMs: Date.now() - startTime,
    };
  }

  // 2. Akıllı Deterministik Fallback Rota Motoru
  const fallbackRoute = generateSmartRouteFallback(prompt);
  return {
    route: fallbackRoute,
    source: "fallback",
    durationMs: Date.now() - startTime,
  };
}

function generateSmartRouteFallback(prompt: string): UnifiedRoutePlan {
  const p = prompt.toLowerCase();

  if (p.includes("roma") || p.includes("italya") || p.includes("rome") || p.includes("italy")) {
    return {
      title: "3 Günlük Roma Rönesans ve Antik Miras Rotası",
      summary:
        "Antik Kolezyum'dan Vatikan'ın büyüleyici sanat galerilerine, Trevi Çeşmesi'nden Trastevere'nin otantik akşam sokaklarına uzanan özel Roma keşfi.",
      estimatedDays: 3,
      theme: "Antik Tarih & İtalyan Gastronomisi",
      destination: "Roma, İtalya",
      stops: [
        {
          id: "rome_1",
          name: "Kolezyum & Forum Romanum",
          lat: 41.8902,
          lng: 12.4922,
          day: 1,
          description: "Görkemli amfitiyatro ve antik Roma İmparatorluğu'nun kalbi.",
          suggestedDuration: "3 saat",
          category: "tarih",
        },
        {
          id: "rome_2",
          name: "Trevi Çeşmesi (Fontana di Trevi)",
          lat: 41.9009,
          lng: 12.4833,
          day: 1,
          description: "Barok heykeltıraşlık harikası ve geleneksel para atma ritüeli.",
          suggestedDuration: "45 dakika",
          category: "fotograf",
        },
        {
          id: "rome_3",
          name: "Pantheon Tapınağı",
          lat: 41.8986,
          lng: 12.4769,
          day: 1,
          description: "Oculus deliğinden süzülen ışık huzmesi ve kusursuz kubbe mimarisi.",
          suggestedDuration: "1 saat",
          category: "tarih",
        },
        {
          id: "rome_4",
          name: "Vatikan Müzeleri & San Pietro Bazilikası",
          lat: 41.9029,
          lng: 12.4534,
          day: 2,
          description: "Michelangelo freskleri, Sistina Şapeli ve Hristiyan aleminin anıt mabedi.",
          suggestedDuration: "4 saat",
          category: "kultur",
        },
        {
          id: "rome_5",
          name: "Castel Sant'Angelo & Ponte Sant'Angelo",
          lat: 41.9031,
          lng: 12.4663,
          day: 2,
          description: "Hadrianus Mozolesi ve Bernini'nin melek heykelleriyle süslü köprü.",
          suggestedDuration: "1.5 saat",
          category: "tarih",
        },
        {
          id: "rome_6",
          name: "Trastevere & Otantik Trattoria Deneyimi",
          lat: 41.8893,
          lng: 12.4704,
          day: 2,
          description: "Cacio e pepe, el yapımı taze makarna ve sarmaşıklı sokaklarda akşam turu.",
          suggestedDuration: "2.5 saat",
          category: "lezzet",
        },
        {
          id: "rome_7",
          name: "Villa Borghese & Pincio Seyir Terası",
          lat: 41.9142,
          lng: 12.4921,
          day: 3,
          description:
            "Roma'nın en asil yeşil parkı ve Piazza del Popolo'ya tepeden bakan gün batımı terası.",
          suggestedDuration: "2.5 saat",
          category: "manzara",
        },
        {
          id: "rome_8",
          name: "İspanyol Merdivenleri & Via Condotti",
          lat: 41.906,
          lng: 12.4828,
          day: 3,
          description: "Tarihi meydan, çiçekli merdivenler ve Roma'nın en zarif butik caddesi.",
          suggestedDuration: "1.5 saat",
          category: "fotograf",
        },
      ],
    };
  }

  if (
    p.includes("kapadokya") ||
    p.includes("cappadocia") ||
    p.includes("göreme") ||
    p.includes("balon")
  ) {
    return {
      title: "Kapadokya Büyülü Vadiler & Balon Rotası",
      summary:
        "Peri bacalarının gölgesinde gün doğumu sıcak hava balon seyri, yeraltı şehirleri ve kaya oyma manastırlar.",
      estimatedDays: 2,
      theme: "Doğa Harikası & Jeolojik Miras",
      destination: "Kapadokya, Nevşehir",
      stops: [
        {
          id: "kap_1",
          name: "Göreme Açık Hava Müzesi",
          lat: 38.6401,
          lng: 34.8451,
          day: 1,
          description: "Kaya içine oyulmuş manastırlar ve bin yıllık Bizans freskleri.",
          suggestedDuration: "2.5 saat",
          category: "tarih",
        },
        {
          id: "kap_2",
          name: "Aşk Vadisi (Love Valley)",
          lat: 38.6621,
          lng: 34.8214,
          day: 1,
          description: "Görkemli peri bacaları arasında doğa yürüyüşü ve fotoğraf molası.",
          suggestedDuration: "1.5 saat",
          category: "doga",
        },
        {
          id: "kap_3",
          name: "Uçhisar Kalesi Zirvesi",
          lat: 38.6301,
          lng: 34.8055,
          day: 1,
          description:
            "Tüm Kapadokya coğrafyasına 360 derece hakim en yüksek volkanik kaya kalesi.",
          suggestedDuration: "1.5 saat",
          category: "manzara",
        },
        {
          id: "kap_4",
          name: "Gün Doğumu Balon Seyir Tepesi",
          lat: 38.6512,
          lng: 34.8344,
          day: 2,
          description:
            "Sabahın ilk ışıklarıyla yüzlerce sıcak hava balonunun göğe yükseldiği eşsiz görsel şölen.",
          suggestedDuration: "2 saat",
          category: "fotograf",
        },
        {
          id: "kap_5",
          name: "Derinkuyu Yeraltı Şehri",
          lat: 38.3739,
          lng: 34.7348,
          day: 2,
          description:
            "Sekiz kat derinliğe inen antik sığınak, havalandırma bacaları ve taş kapılar.",
          suggestedDuration: "2 saat",
          category: "tarih",
        },
      ],
    };
  }

  if (p.includes("tokyo") || p.includes("japonya") || p.includes("japan")) {
    return {
      title: "Tokyo Fütüristik Metropol ve Geleneksel Tapınaklar",
      summary:
        "Asakusa'nın tütsü kokulu tapınaklarından Akihabara'nın neon ışıklarına, Shibuya kavşağından Meiji Tapınağı korusuna Tokyo macerası.",
      estimatedDays: 3,
      theme: "Fütürizm & Geleneksel Japon Kültürü",
      destination: "Tokyo, Japonya",
      stops: [
        {
          id: "tok_1",
          name: "Senso-ji Tapınağı & Nakamise Dori",
          lat: 35.7148,
          lng: 139.7967,
          day: 1,
          description: "Tokyo'nun en eski Budist tapınağı ve tarihi Japon atıştırmalık caddesi.",
          suggestedDuration: "2.5 saat",
          category: "tarih",
        },
        {
          id: "tok_2",
          name: "Akihabara Elektrik Şehri",
          lat: 35.6984,
          lng: 139.7731,
          day: 1,
          description: "Neon binalar, anime kültürü ve fütüristik teknoloji mağazaları.",
          suggestedDuration: "2 saat",
          category: "kultur",
        },
        {
          id: "tok_3",
          name: "Meiji Jingu & Yoyogi Korusu",
          lat: 35.6764,
          lng: 139.6993,
          day: 2,
          description: "Yüz bin ağaçlı devasa ormanın ortasındaki huzur dolu Şinto mabedi.",
          suggestedDuration: "2 saat",
          category: "doga",
        },
        {
          id: "tok_4",
          name: "Shibuya Scramble & Hachiko Heykeli",
          lat: 35.6595,
          lng: 139.7005,
          day: 2,
          description: "Dünyanın en yoğun yaya geçidi ve sadık köpek Hachiko anıtı.",
          suggestedDuration: "1.5 saat",
          category: "fotograf",
        },
        {
          id: "tok_5",
          name: "Shinjuku Omoide Yokocho & Gyoen",
          lat: 35.6938,
          lng: 139.7001,
          day: 3,
          description: "Tarihi yakitori sokakları ve geleneksel peyzaj bahçeleri.",
          suggestedDuration: "3 saat",
          category: "lezzet",
        },
      ],
    };
  }

  // Universal Default Route for other destinations
  return {
    title: "Seçkin Şehir Keşfi & Kültür Rotası",
    summary:
      "Şehrin en gözde tarihi yapıları, panoramik manzaraları ve yerel gastronomi duraklarını kapsayan optimize gezi planı.",
    estimatedDays: 2,
    theme: "Şehir Kültürü & Mimari",
    destination: prompt.slice(0, 40),
    stops: [
      {
        id: "gen_1",
        name: "Tarihi Şehir Meydanı & Anıtlar",
        lat: 41.0086,
        lng: 28.9802,
        day: 1,
        description: "Şehrin kalbinin attığı tarihi merkez, simgesel anıtlar ve mimari yapılar.",
        suggestedDuration: "2.5 saat",
        category: "tarih",
      },
      {
        id: "gen_2",
        name: "Şehir Müzesi & Sanat Galerisi",
        lat: 41.0115,
        lng: 28.9833,
        day: 1,
        description: "Bölgenin zengin kültürel geçmişini sergileyen ulusal koleksiyon.",
        suggestedDuration: "2 saat",
        category: "kultur",
      },
      {
        id: "gen_3",
        name: "Eski Çarşı & Yerel Lezzet Sokağı",
        lat: 41.0108,
        lng: 28.968,
        day: 1,
        description: "Geleneksel el sanatları dükkanları ve yöresel tatların sunulduğu lokantalar.",
        suggestedDuration: "2 saat",
        category: "lezzet",
      },
      {
        id: "gen_4",
        name: "Panoramik Seyir Tepesi & Park",
        lat: 41.0256,
        lng: 28.9741,
        day: 2,
        description: "Şehri kuşbakışı gören gün batımı terası ve dinlenme alanı.",
        suggestedDuration: "1.5 saat",
        category: "manzara",
      },
      {
        id: "gen_5",
        name: "Kültür & Sanat Bulvarı",
        lat: 41.0369,
        lng: 28.985,
        day: 2,
        description: "Canlı kafeler, kitapçılar ve akşam yürüyüşü için ideal atmosferik cadde.",
        suggestedDuration: "2 saat",
        category: "fotograf",
      },
    ],
  };
}
