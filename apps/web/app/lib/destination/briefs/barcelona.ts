import type { DestinationBrief } from "../types";

/**
 * Barcelona Destinasyon Brifingi
 * Kürasyon: manuel — @sahin, Ekim 2026
 * Kaynak: Wikivoyage "Barcelona" (CC BY-SA 4.0) + kuratör gözlemi
 */
export const BARCELONA_BRIEF: DestinationBrief = {
  id: "barcelona",
  level: "city",
  name: "Barcelona",
  nameLocal: "Barcelona",
  countryCode: "ES",

  cityRhythm: {
    value: {
      wakeUpTime: "09:00",
      lunchTime: "14:00-16:00",
      dinnerTime: "21:00-23:00",
      siestaExists: true,
      nightlifeStartsAt: "01:00",
      closingDayNote:
        "Pazar günleri pek çok dükkan kapalı ya da kısa saatlerle açık. Boqueria Pazarı Pazar kapalı.",
      additionalNotes: [
        "İspanya yemek saatleri ciddi — 20:00'den önce restoran bulmak zor ya da turistik demektir.",
        "Agustus'ta şehir yerel halktan boşalır; pek çok restoran ve dükkan tatile çıkar.",
        "Cumartesi gece-Pazar sabahı uyumayan kalabalıklar için metro sabah 05:00'te açılır, Cuma-Cumartesi gece boyunca çalışır.",
      ],
    },
    source: "manual:curator",
    license: "proprietary",
    attributionHtml: "MapsBridge kuratör gözlemi",
    retrievedAt: "2026-10-13",
    confidence: "verified",
  },

  neighborhoods: {
    value: [
      {
        name: "El Born / Sant Pere",
        character:
          "Tasarım butikleri, küçük tapas barları ve Picasso Müzesi'nin etrafında dönen, kendinle çelişmeyen bir mahalle. Turistik ama aşırıya kaçmamış. Gece Pla de la Boqueria tarafına yürüyerek uzanır.",
        bestFor: ["yemek", "sanat", "tasarim", "gece_hayati"],
        bestVisitTime: "aksam",
        accommodationSuitable: true,
        walkableFromCenter: true,
      },
      {
        name: "Gràcia",
        character:
          "Şehir içinde ama şehirden ayrı hissettiren, Plaza del Sol etrafında toplanmış yerel mahalle. Expat ve bohemyen karışımı. Gaudi'nin Casa Vicens burada. Düz yürünebilir, turistik kalabalıktan uzak.",
        bestFor: ["yerel_deneyim", "cafeler", "yemek", "fotograf"],
        bestVisitTime: "aksam_veya_ogle",
        accommodationSuitable: true,
        walkableFromCenter: true,
      },
      {
        name: "Eixample",
        character:
          "Modernista mimarisinin ızgara dokusu. Sagrada Família burada, Passeig de Gràcia'da Casa Batlló ve Casa Milà. Çok büyük alan, konaklama ve restoran yoğunluğu iyi. LGBTQ+ 'Gayxample' kısmı sol alt bölge.",
        bestFor: ["mimari", "konaklama", "yemek", "alisveris"],
        bestVisitTime: "her_zaman",
        accommodationSuitable: true,
        walkableFromCenter: true,
      },
      {
        name: "Barceloneta",
        character:
          "Şehir plajı ve sahil restoranları. Turistik ve kalabalık; paella burada yeme (genelde donmuş malzeme), bunun yerine Barceloneta'nın içindeki küçük balık lokantalarını ara. Yüzmek için yerli kalabalığından erken git.",
        bestFor: ["sahil", "deniz_sporları"],
        bestVisitTime: "sabah_erken",
        accommodationSuitable: false,
        walkableFromCenter: false,
      },
      {
        name: "El Raval",
        character:
          "MACBA, BARTS müzik mekanı ve Boqueria'nın arka sokaklarıyla sanatsal ve kaotik. Gece güvenlik seviyesi değişken; erken saatlerde güzel, geç saatlerde dikkatli ol.",
        bestFor: ["sanat", "muzik", "fotograf"],
        bestVisitTime: "gunduz",
        accommodationSuitable: false,
        walkableFromCenter: true,
      },
      {
        name: "Poblenou",
        character:
          "Eski sanayi dokusundan dönüşmekte olan, startup ofisleri ve kültür mekanları hızla açılan bölge. @22 inovasyon bölgesi burada. Merkeze tramvayla bağlı. Coworking ve dijital göçmen sahnesinin kalbi.",
        bestFor: ["coworking", "tasarim", "muzik"],
        bestVisitTime: "gunduz",
        accommodationSuitable: false,
        walkableFromCenter: false,
      },
    ],
    source: "manual:curator",
    license: "proprietary",
    attributionHtml: "MapsBridge kuratör gözlemi",
    retrievedAt: "2026-10-13",
    confidence: "verified",
  },

  gettingAround: {
    value: {
      transitCardName: "T-Casual (10 seferlik) veya T-Mobilitat",
      transitCardAcquisition:
        "Metro istasyonlarındaki makinelerden veya TMB uygulamasından alınır. T-Casual metro, otobüs ve bölgesel trende 1 saat içinde aktarma geçerli.",
      taxiVsApp:
        "Free Now veya Cabify uygulamaları. Sarı-siyah lisanslı taksiler güvenli; Las Ramblas çevresinde standart ücretler dışında pazarlık teklifi gelirse reddet.",
      walkability: "high",
      hillsWarning:
        "Şehir büyük ölçüde düzdür. Park Güell ve Tibidabo tepe; kablolu araç veya otobüs 116 ile çıkılır. Merkezi bölgeler yürüyüşe çok uygun.",
      airportTransferSummary:
        "El Prat'tan Aerobus (A1/A2) Plaça Catalunya'ya 35 dakika. Renfe L9 Sud metro hattı daha ucuz ama aktarma gerektiriyor. Gecenin geç saatlerinde taksi 25-35€ aralığında.",
      carRecommended: false,
      carNote: "Park imkânsız, yol ücretleri var. Kiralamayı şehir dışı günü gezisi için sakla.",
    },
    source: "manual:curator",
    license: "proprietary",
    attributionHtml: "MapsBridge kuratör gözlemi",
    retrievedAt: "2026-10-13",
    confidence: "verified",
  },

  rookieMistakes: {
    value: [
      {
        mistake: "Sagrada Família'ya önceden zaman slotu almadan gitmek",
        correction:
          "Kapıda bilet satılmıyor ya da çok kısıtlı. sagradafamilia.org'dan haftalar öncesinden al. Sabah ilk slotlar en az kalabalık.",
      },
      {
        mistake: "Las Ramblas'ta yemek yemek",
        correction:
          "Las Ramblas restoranları turistik fiyat/kalite tuzağı. 5 dakika içeriye yürü: El Born ya da Gràcia'da aynı parayı çok daha iyi harcarsın.",
      },
      {
        mistake: "La Boqueria'da atıştırmalık yemek",
        correction:
          "La Boqueria pazar olarak bitti; tur grupları ve fotoğrafçılar için bir dekor oldu. Mercat de Santa Caterina (El Born) veya Mercat de l'Abaceria (Gràcia) gerçek pazar.",
      },
      {
        mistake: "Park Güell'in tüm alanının ücretsiz olduğunu sanmak",
        correction:
          "Monumental Bölge (ikonik teraslar) ücretli ve slotlu. Çevresi ücretsiz. Bilet almadan gidersen sadece dıştan görebilirsin.",
      },
      {
        mistake: "20:00'de yemeğe çıkmak",
        correction:
          "Turistik restoranlar 20:00'de açık, yerli lokantalar 21:00-21:30'dan önce boş. Erken gidersen garson seni şaşkın karşılar.",
      },
    ],
    source: "manual:curator",
    license: "proprietary",
    attributionHtml: "MapsBridge kuratör gözlemi",
    retrievedAt: "2026-10-13",
    confidence: "verified",
  },

  overratedWithAlternatives: {
    value: [
      {
        overrated: "La Boqueria",
        why: "2010'lardan beri tur gruplarının baskısıyla orijinalliğini büyük ölçüde yitirdi. Fiyatlar yüksek, kalabalık yorucu.",
        alternative: "Mercat de Santa Caterina (El Born)",
        alternativeNote: "Wave çatısı mimari açıdan daha ilginç, yerel müşteri hâlâ geliyor.",
      },
      {
        overrated: "Barceloneta'da paella",
        why: "Çoğu yer dondurulmuş malzeme kullanıyor, turistik fiyat uyguluyor. İspanya'nın asıl paella kenti Valensiya'dır.",
        alternative: "7 Portes restaurant (Port Vell)",
        alternativeNote: "1836'dan beri açık, paella ve arroz negro için şehrin gerçek adresi.",
      },
      {
        overrated: "Tibidabo",
        why: "Manzara güzel ama ulaşım meşakkatli, park kalabalık, değer/uğraş oranı düşük.",
        alternative: "Bunker del Carmel (El Carmel tepesi)",
        alternativeNote:
          "Ücretsiz, panoramik 360° manzara, kalabalık az — özellikle gün batımında.",
      },
    ],
    source: "manual:curator",
    license: "proprietary",
    attributionHtml: "MapsBridge kuratör gözlemi",
    retrievedAt: "2026-10-13",
    confidence: "verified",
  },

  timingRules: {
    value: [
      {
        subject: "Sagrada Família",
        rule: "Önceden zaman slotu zorunlu. Sabah ilk slot (09:00) en az kalabalık. Öğleden sonra kuyruk olmasa da içerisi dolup taşıyor.",
        type: "best_time",
        severity: "blocks_visit",
      },
      {
        subject: "Picasso Müzesi",
        rule: "Her ayın ilk Pazar günü ücretsiz — kuyruk çok uzun. Hafta içi sabah 09:00 en sakin.",
        type: "queue_warning",
        severity: "degrades_experience",
      },
      {
        subject: "Park Güell (Monumental Bölge)",
        rule: "Slotlu giriş — webden rezervasyon şart. Sabah 08:00 slotu açılır açılmaz dolabilir.",
        type: "best_time",
        severity: "blocks_visit",
      },
      {
        subject: "Casa Batlló / Casa Milà",
        rule: "Günlük kapasite sınırlı. Magic Nights (gece turu) çabuk doluyor.",
        type: "queue_warning",
        severity: "degrades_experience",
      },
      {
        subject: "Genel Müzeler",
        rule: "Pazartesi birçok müze kapalı (MACBA dahil). Salı iyi başlangıç günü.",
        type: "closed_day",
        severity: "blocks_visit",
      },
      {
        subject: "La Barceloneta plajı",
        rule: "Temmuz-Ağustos sabahları 11:00'den önce git; öğleden sonra yer bulmak zor.",
        type: "best_time",
        severity: "degrades_experience",
      },
    ],
    source: "manual:curator",
    license: "proprietary",
    attributionHtml: "MapsBridge kuratör gözlemi",
    retrievedAt: "2026-10-13",
    confidence: "verified",
  },

  reservationNorms: {
    value: {
      highDemandVenues: [
        {
          name: "Sagrada Família",
          leadTimeDays: 21,
          method: "sagradafamilia.org — kule turu dahil bilet çok daha hızlı dolар.",
          note: "Yazın peak dönemde 4-6 hafta önceden alınması önerilir.",
        },
        {
          name: "Park Güell (Monumental Bölge)",
          leadTimeDays: 7,
          method: "parkguell.barcelona — tarih/saat seçerek.",
        },
        {
          name: "Casa Batlló",
          leadTimeDays: 7,
          method: "casabatllo.es — Magic Nights için 2-3 hafta önceden.",
        },
        {
          name: "Disfrutar (3 Michelin yıldızı)",
          leadTimeDays: 60,
          method: "Resmi site. Öğle yemeği servisi akşama göre biraz daha erken açılır.",
        },
      ],
      generalNote:
        "Tapas barları rezervasyon almaz; saatinde git ya da bekle. Orta kalite restoranlarda 1-2 gün öncesinden yeterli.",
    },
    source: "manual:curator",
    license: "proprietary",
    attributionHtml: "MapsBridge kuratör gözlemi",
    retrievedAt: "2026-10-13",
    confidence: "verified",
  },

  seasonality: {
    value: {
      peakMonths: [7, 8],
      offPeakMonths: [1, 2, 12],
      byMonth: {
        "1": "Soğuk ama güneşli, 10-15°C, kalabalık yok. Müzeler rahat.",
        "3": "Hava ısınıyor, Paskalya yakınıysa kalabalık artar.",
        "4": "Güzel, kalabalık henüz yönetilebilir. Sant Jordi (23 Nisan) kitap-gül festivali.",
        "5": "İdeal. Güneşli, plaj açılmış ama tıka basa değil.",
        "6": "Primer Sonar Müzik Festivali (mid-Haziran), şehir doluyor.",
        "7": "Çok kalabalık, sıcak (30°C+). Her yer kitli.",
        "8": "Yerli halk tatilde, şehir turist doluyor. Bazı restoranlar kapalı.",
        "9": "La Mercè festivali (Eylül sonu). Hava hâlâ sıcak, kalabalık düşüyor.",
        "10": "Altın dönem: ılık, az kalabalık.",
        "11": "Sakin, bazı yerler kapanıyor ama müzeler mükemmel.",
        "12": "Noel pazarları açılır, Plaça Catalunya ve Sagrada Família ışıklandırılır.",
      },
    },
    source: "manual:curator",
    license: "proprietary",
    attributionHtml: "MapsBridge kuratör gözlemi",
    retrievedAt: "2026-10-13",
    confidence: "verified",
  },

  practical: {
    value: {
      tippingNorm:
        "Restoranlarda zorunlu değil; memnunsan %5-10 bırakabilirsin. Taksi ve barlarda bozuk para bırakmak yeterli.",
      plugType: "Type F (Schuko) — İspanya 230V/50Hz. Avrupa ve Türk şarj cihazları uyumlu.",
      tapWaterSafe: true,
      cashVsCard:
        "Kart her yerde geçerli. Boqueria ve sokak pazarlarında nakit tercih edilebilir. 50-100€ nakit yeterli.",
      emergencyNumbers: { police: "091", ambulance: "061", general: "112" },
      currency: "EUR",
      paymentNote:
        "ATM'ler yaygın. Dinamik kur seçeneği sunan ATM'lerde 'reddet' — kendi bankandan işlem yaptır.",
    },
    source: "manual:curator",
    license: "proprietary",
    attributionHtml: "MapsBridge kuratör gözlemi",
    retrievedAt: "2026-10-13",
    confidence: "verified",
  },

  safetyNotes: {
    value: {
      generalLevel: "moderate_caution",
      specificNotes: [
        "Avrupa'nın en yüksek turistik yankesicilik oranlarından biri. Las Ramblas, La Boqueria çevresi ve metro L1 hattı (Plaça Espanya-Universitat) risk bölgesi.",
        "Sırt çantası önde taşı ya da fermuarlı. Masa üstüne telefon bırakma restoranlarda.",
        "Sahil alanında ve plajda eşyalara dikkat et, özellikle çanta ve değerli cihazlar.",
        "Sahte polis üniforması ile 'belge kontrol' tuzağı bildirilmiş — gerçek polisler markajlı araca/ofise götürür, sokakta para istemez.",
      ],
      originBiasNote: "FCDO tavsiyesi İngiliz pasaport sahipleri için hazırlanmıştır.",
    },
    source: "manual:curator",
    license: "proprietary",
    attributionHtml: "MapsBridge kuratör gözlemi, FCDO Spain Travel Advice",
    retrievedAt: "2026-10-13",
    confidence: "likely",
  },

  localCalendar: {
    value: [
      {
        date: "01-06",
        name: "Üç Bilge Günü (Reis Mags)",
        type: "public_holiday",
        impact: "Büyük parade önceki akşam. Pek çok dükkan kapalı.",
      },
      {
        date: "04-23",
        name: "Sant Jordi Festivali",
        type: "festival",
        impact: "Ramblas ve çevresi kitap-gül tezgahlarıyla doluyor. Harika ama kalabalık.",
      },
      {
        date: "06-24",
        name: "Sant Joan (Ateş Gecesi)",
        type: "festival",
        impact: "Havai fişek şehir genelinde, sahil partileri. Bir önceki gece uykusuz.",
      },
      {
        date: "06-01",
        name: "Sonar Müzik Festivali (yaklaşık)",
        type: "festival",
        impact: "Mid-Haziran. Otel fiyatları artıyor, şehir kalabalık.",
      },
      {
        date: "09-24",
        name: "La Mercè (şehir festivali)",
        type: "festival",
        impact:
          "Son hafta Eylül. Bedava konserler, castellers (insan kulesi), ücretsiz müze girişleri.",
      },
      {
        date: "12-25",
        name: "Noel",
        type: "public_holiday",
        impact: "Resmi tatil. Restoranlar kapalı veya sınırlı.",
      },
    ],
    source: "manual:curator",
    license: "proprietary",
    attributionHtml: "MapsBridge kuratör gözlemi",
    retrievedAt: "2026-10-13",
    confidence: "verified",
  },

  nicheAngles: {
    value: [
      {
        category: "running",
        description:
          "Sahil koşu bandı düz ve uzun. Montjuïc tepesi zorlu ama manzaralı. Ciudadela Parkı şehir içi döngü için ideal.",
        highlights: [
          "Barceloneta sahil bandı (5 km düz)",
          "Montjuïc döngüsü (~8 km)",
          "Parc de la Ciutadella",
        ],
      },
      {
        category: "cycling",
        description:
          "Şehir bisiklet altyapısı iyi. Bicing paylaşımlı bisiklet uygulaması kısa süreli ziyaretçi için biraz zor; Donkey Republic veya kiralık bisiklet daha kolay.",
        highlights: [
          "Sahilden Fòrum'a uzanan bisiklet yolu",
          "Poblenou-Glòries rotası",
          "Gràcia çevresi",
        ],
      },
      {
        category: "food_specialty",
        description:
          "Katalon mutfağı İspanyol değil — pa amb tomàquet (domates sürtülmüş ekmek), fideuà (erişte paella), crema catalana. İyi tapas için El Born ve Gràcia.",
        highlights: [
          "Bar del Pla (El Born) — klasik tapas",
          "El Xampanyet (El Born) — cava ve tapas",
          "Bodega Sepúlveda — yerli wein ve montaditos",
          "La Pepita (Gràcia) — kremalı sandwich, sıra beklenilebilir",
        ],
      },
      {
        category: "art_gallery",
        description:
          "Modernista mimarisi dışında güçlü çağdaş sahne. MACBA ücretsiz Salı, Fundació Joan Miró Montjuïc'te.",
        highlights: [
          "MACBA — ücretsiz Salı ve Cumartesi 15:00-19:30",
          "Fundació Joan Miró — Montjuïc",
          "CCCB — etkinlikler ve geçici sergiler",
          "Museu Picasso — her ayın ilk Pazar ücretsiz ama çok kalabalık",
        ],
      },
      {
        category: "coworking",
        description:
          "Poblenou @22 bölgesi Avrupa'nın en aktif coworking ekosistemleri arasında. El Born ve Gràcia'da laptop dostu kafeler çok.",
        highlights: [
          "Betahaus Barcelona (Poblenou)",
          "Utopicus Passeig de Gràcia (Eixample)",
          "Federal Café (El Born) — WiFi iyi, çalışma atmosferi güçlü",
        ],
      },
    ],
    source: "manual:curator",
    license: "proprietary",
    attributionHtml: "MapsBridge kuratör gözlemi",
    retrievedAt: "2026-10-13",
    confidence: "likely",
  },

  schemaVersion: "1.0",
  lastCuratedAt: "2026-10-13",
  curatedBy: "manual",
};
