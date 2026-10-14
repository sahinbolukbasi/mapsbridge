import type { DestinationBrief } from "../types";

/**
 * İstanbul Destinasyon Brifingi
 * Kürasyon: manuel — @sahin, Ekim 2026
 * Kaynak: Wikivoyage "Istanbul" (CC BY-SA 4.0) + kuratör gözlemi
 */
export const ISTANBUL_BRIEF: DestinationBrief = {
  id: "istanbul",
  level: "city",
  name: "Istanbul",
  nameLocal: "İstanbul",
  countryCode: "TR",

  cityRhythm: {
    value: {
      wakeUpTime: "08:00",
      lunchTime: "12:30-14:00",
      dinnerTime: "20:00-22:30",
      siestaExists: false,
      nightlifeStartsAt: "23:00",
      closingDayNote: "Kapalıçarşı Pazar günü kapalı. Mısır Çarşısı genelde açık.",
      additionalNotes: [
        "Ramazan ayında pek çok lokanta gündüz servisi yapmaz, akşam iftar saatlerinde çok kalabalık.",
        "Pazartesi pek çok müze kapalı — Topkapı, Arkeoloji Müzesi, Yerebatan dahil.",
        "Cuma namazında (13:00-14:00) çevredeki sokaklar kapanır; Sultanahmet ve Eminönü bölgesinde planı ona göre yap.",
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
        name: "Sultanahmet",
        character:
          "Tarihin yoğunlaştığı, turistik baskının da yoğunlaştığı bölge. Ayasofya, Topkapı ve Hipodrom'a yürüme mesafesi. Yemek kalitesi fiyatın gerisinde kalır; konaklama için uygun ama değer/para oranı düşük.",
        bestFor: ["tarihi_yerler", "kolay_gezinti"],
        bestVisitTime: "sabah_erken",
        accommodationSuitable: true,
        walkableFromCenter: true,
      },
      {
        name: "Beyoğlu / Taksim",
        character:
          "Restoran, müzik mekanı ve sanat galerileri İstiklal'in iki yanında. İstiklal Caddesi kendisi kalabalık ve sıkışık; Asmalımescit, Nevizade ve Cihangir sokakları gerçek karakter taşıyor. Taksim Meydanı kendisi görülecek bir yer değil.",
        bestFor: ["gece_hayati", "yemek", "sanat", "cafeler"],
        bestVisitTime: "aksam",
        accommodationSuitable: true,
        walkableFromCenter: true,
      },
      {
        name: "Kadıköy",
        character:
          "İstanbul'un yerli hafta sonu rutininin büyük kısmı burada. Balık pazarı, Moda'nın sahil yürüyüşü ve Çiya gibi Güneydoğu mutfağının en iyi örnekleri. Avrupalı yakaya göre daha sakin, daha az turistik, fiyatlar düşük. Vapur ile geçmek yarım saat bile sürmez.",
        bestFor: ["yemek", "yerel_deneyim", "kahve", "sahil"],
        bestVisitTime: "sabah_veya_ogle",
        accommodationSuitable: false,
        walkableFromCenter: false,
      },
      {
        name: "Karaköy / Galata",
        character:
          "Boğaz'ın tam önünde, şehrin en hızlı değişen mahallesi. Müze Gazhane ve İstanbul Modern burada. Sabahları sakin, öğleden sonra genç kalabalık, akşam canlı bar sahnesi. Liman bölgesine yakınlığı ulaşım kolaylığı sağlar.",
        bestFor: ["sanat", "cafeler", "fotograf", "gece_hayati"],
        bestVisitTime: "ogle_veya_aksam",
        accommodationSuitable: true,
        walkableFromCenter: true,
      },
      {
        name: "Balat / Fener",
        character:
          "Haliç kıyısında, rengarenk ahşap evleri ve Rum/Yahudi tarihi mirasıyla şehrin en fotojenik mahallesi. Sabah erken gelirsen tur grubu yok. Pazar sabahı Balat, en otantik halini gösterir.",
        bestFor: ["fotograf", "tarihi_yerler", "sanat"],
        bestVisitTime: "sabah_erken",
        accommodationSuitable: false,
        walkableFromCenter: false,
      },
      {
        name: "Beşiktaş / Ortaköy",
        character:
          "Yerel hayatın yoğun aktığı, pazar ve balıkçı dükkânlarının olduğu kıta yakası. Ortaköy iskele meydanı Boğaz manzarasıyla sembolik; wafflesi fotoğrafçılar için, midyesi yerli için.",
        bestFor: ["yerel_deneyim", "yemek", "sahil"],
        bestVisitTime: "sabah_veya_aksam",
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
      transitCardName: "İstanbulkart",
      transitCardAcquisition:
        "Havalimanı, büyük metro istasyonları ve büyük durumak bölgelerindeki makinelerden alınır. 100 TL depozito, üstüne bakiye yüklenir. Feribot dahil tüm toplu taşımada geçerli.",
      taxiVsApp:
        "BiTaksi veya iTaksi uygulamalarını kullan, sokakta durdurulan taksiler tartışmalı ücretlendirme riski taşır. Uber bölgesel kısıtlamalar nedeniyle İstanbul'da çalışmıyor.",
      walkability: "medium",
      hillsWarning:
        "Avrupa yakası tepeli. Sultanahmet'ten Beyoğlu'na yürümek Galata Köprüsü üzerinden kolaydır ama Galata Kulesi çevresinde dik yokuşlar var. Elektrikli scooter kiralama iyi alternatif.",
      airportTransferSummary:
        "İstanbul Havalimanı'ndan metro M11 hattı ile yaklaşık 38 dakikada Gayrettepe, oradan M2 aktarmasıyla merkeze. HAVAŞ otobüsleri de var, trafik saatlerine dikkat. Sabiha Gökçen'den şehre vapur + metro kombinasyonu genelde Anadolu yakası için daha mantıklı.",
      carRecommended: false,
      carNote:
        "Şehir içi araç felakettir. Park bulmak neredeyse imkânsız, trafik saatlerde durur. Tek istisna: şehir dışı günü gezisi (Belgrad Ormanı, Şile).",
      ferryNote:
        "Vapur (İDO/Şehir Hatları) şehrin en keyifli ulaşım aracı. Eminönü ↔ Kadıköy 20 dakika, Boğaz turu teknik olarak ücretsiz aktarma.",
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
        mistake: "Sultanahmet'te akşam yemeği",
        correction:
          "Sultanahmet restoranları yüksek fiyatlı ve düşük kaliteli. Akşam yemeği için Karaköy, Beyoğlu veya Kadıköy'e geç.",
      },
      {
        mistake: "Araç kiralamak",
        correction:
          "Şehir içi araçla gezilmez. Toplu taşıma + vapur kombinasyonu hem daha hızlı hem daha ucuz.",
      },
      {
        mistake: "Kapalıçarşı'nın ana girişine yakın dükkanlardan alışveriş yapmak",
        correction:
          "Fiyatlar giriş kapılarına yakın çarşının içine doğru dramatik şekilde düşer. Derin sokaklara git.",
      },
      {
        mistake: "Pazartesi Topkapı veya büyük müzelere gitmek",
        correction:
          "Pek çok büyük müze Pazartesi kapalı. Perşembe veya Cuma erken sabah en az kalabalık zamanlar.",
      },
      {
        mistake: "Mısır Çarşısı'nda baharattan başka bir şey satın almak",
        correction:
          "Fiyatlar turistik lokasyona göre belirlenmiş. Türk kahvesi, lokum ve baharat için bakkallar çok daha uygun.",
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
        overrated: "Topkapı Sarayı Harem turu",
        why: "Çok kalabalık, kalabalıkla birlikte yaklaşık 3 saat kapıda geçer, yorucu. Mekan güzel ama deneyim çoğunlukla hayal kırıklığı.",
        alternative: "Dolmabahçe Sarayı",
        alternativeNote:
          "Daha az kalabalık, Osmanlı'nın farklı bir dönemini gösteriyor, rehberli tur dahil.",
      },
      {
        overrated: "Boğaz turisti teknesi",
        why: "Touristik fiyatla vaat edilen manzaranın büyük kısmını ücretsiz İstanbulkart'lı vapur ile görürsün.",
        alternative: "Eminönü–Anadolu Kavağı şehir hattı vapuru",
        alternativeNote: "Gidiş-dönüş yaklaşık 6 saat, İstanbulkart geçerli, aynı Boğaz manzarası.",
      },
      {
        overrated: "Pierre Loti Tepesi kablo arabası",
        why: "Kablo arabası genelde uzun kuyruklu. Manzara güzel ama 20 dakika yürüyerek de çıkılır.",
        alternative: "Yürüyerek çık, Eyüp Sultan Camii ile birleştir",
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
        subject: "Ayasofya",
        rule: "Sabah 9'da aç, öğleden sonra tur grupları doluyor. Namaz vakitlerinde kapalı (sabah, öğle, ikindi, akşam, yatsı — her biri 30-45 dk).",
        type: "best_time",
        severity: "degrades_experience",
      },
      {
        subject: "Topkapı Sarayı",
        rule: "Pazartesi kapalı. Son giriş kapanıştan 1 saat önce.",
        type: "closed_day",
        severity: "blocks_visit",
      },
      {
        subject: "Arkeoloji Müzesi",
        rule: "Pazartesi kapalı.",
        type: "closed_day",
        severity: "blocks_visit",
      },
      {
        subject: "Kapalıçarşı",
        rule: "Pazar günü kapalı. Öğle-ikindi saatleri en kalabalık.",
        type: "closed_day",
        severity: "blocks_visit",
      },
      {
        subject: "Genel müzeler",
        rule: "Pazartesi kapalı — planını buna göre yap.",
        type: "closed_day",
        severity: "blocks_visit",
      },
      {
        subject: "Boğaz vapuru / Şehir Hatları",
        rule: "Sabah 07:00-09:00 ve akşam 17:00-19:30 arası işe gidiş-dönüş seferleri. Turistik amaçla bu saatleri atla.",
        type: "avoid_time",
        severity: "degrades_experience",
      },
      {
        subject: "Balat",
        rule: "Pazar sabahı, özellikle 08:00-11:00 arası. Tur grupları 11:00'den sonra gelir.",
        type: "best_time",
        severity: "fyi",
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
          name: "Ayasofya-i Kebir Camii Şerifi",
          leadTimeDays: 0,
          method: "Rezervasyon gerekmez, giriş ücretsiz. Namaz vakitlerinde kapalı.",
        },
        {
          name: "Topkapı Sarayı",
          leadTimeDays: 3,
          method: "muze.gov.tr üzerinden çevrimiçi — yoğun sezonda (Temmuz-Ağustos) 1 hafta öncesinden al.",
        },
        {
          name: "Kapadokya gezisi (günübirlik)",
          leadTimeDays: 14,
          method: "Organize tur veya uçuş+araç. İstanbul üsüne zaten 1 saatlik uçuş.",
          note: "İstanbul ziyaretiyle aynı geziye eklenebilir, ama ayrı bir hedef olarak planla.",
        },
      ],
      generalNote:
        "İstanbul'da çoğu restoran rezervasyon kabul eder ama zorunlu değildir. İkiz Meyhane gibi tarihi mekânlar için 2-3 gün önceden rezervasyon yap.",
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
        "1": "Soğuk ve ıslak, turistik kalabalık yok. Müzeler rahat.",
        "3": "Erken ilkbahar: çiçeklenme başlıyor, kalabalık artmadan önce iyi an.",
        "4": "Lale festivali (Nisan başı). Emirgan Korusu ve Gülhane Parkı tam bu sürede.",
        "5": "Hava ideal, kalabalık henüz yönetilebilir. En iyi ay.",
        "7": "Çok kalabalık, 35°C+. Tüm popüler yerlerde kuyruk.",
        "8": "Zirve sezon. Konaklama fiyatı yüksek, kalabalık bunaltıcı.",
        "9": "Hava hâlâ güzel, kalabalık düşüyor. İkinci en iyi dönem.",
        "10": "Sonbahar renkleri, serin, minimal kuyruk. Harika.",
        "12": "Düşük sezon, Noel yok ama Yılbaşı trafiği var.",
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
        "Restoranlarda %10-15 normaldir ama zorunlu değil. Taksimetrede bahşiş beklenmiyor. Berberde 20-50 TL.",
      plugType: "Type F (Schuko) — Türkiye 220V/50Hz. Avrupa şarj cihazları doğrudan çalışır.",
      tapWaterSafe: false,
      cashVsCard:
        "Kart büyük yerlerde sorunsuz çalışır. Bazı balık lokantaları ve semt esnafı nakit tercih eder. 500-1000 TL nakit bulundurmak güvenli.",
      dressCodes:
        "Camilere girerken omuzlar ve dizler örtülü olmalı. Başörtüsü kadınlar için bazı camilerde zorunlu (Ayasofya dahil). Giriş kapılarında şal veya örtü bulunur.",
      emergencyNumbers: { police: "155", ambulance: "112", general: "112" },
      currency: "TRY (Türk Lirası)",
      paymentNote:
        "USD/EUR nakit kambiyolarda bozdurulur. ATM'lerde yerel bankaları tercih et (yapı kredi, garanti), turistik ATM'ler komisyon oranı yüksek.",
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
        "İstiklal Caddesi ve Sultanahmet'te yankesicilik riski yüksek. Bilet kuyruklarında ve kalabalıkta dikkatli ol.",
        "Taksim Meydanı ve çevresinde geceleri saat 23:00 sonrası askerî ve polis varlığı yüksek; bu normaldir.",
        "Taksi dolandırıcılığı: tur başında sayacın sıfırlandığından emin ol, gece geç saatlerde uygulama kullan.",
        "Kalabalık vapur iskele önlerinde çanta hırsızlığı bildirilmiştir.",
      ],
      originBiasNote: "FCDO tavsiyesi İngiliz pasaport sahipleri için hazırlanmıştır. Türk vatandaşları için koşullar farklı olabilir.",
    },
    source: "manual:curator",
    license: "proprietary",
    attributionHtml: "MapsBridge kuratör gözlemi, FCDO Turkey Travel Advice",
    retrievedAt: "2026-10-13",
    confidence: "likely",
  },

  localCalendar: {
    value: [
      { date: "01-01", name: "Yılbaşı", type: "public_holiday", impact: "Resmi tatil, pek çok dükkan kapalı." },
      { date: "04-23", name: "Ulusal Egemenlik ve Çocuk Bayramı", type: "public_holiday", impact: "Resmi tatil." },
      { date: "05-01", name: "İşçi Bayramı", type: "public_holiday", impact: "Resmi tatil; Taksim Meydanı erişim kısıtlaması olabilir." },
      { date: "05-19", name: "Atatürk'ü Anma, Gençlik ve Spor Bayramı", type: "public_holiday", impact: "Resmi tatil." },
      { date: "07-15", name: "Demokrasi ve Milli Birlik Günü", type: "public_holiday", impact: "Resmi tatil; köprüler akşam yürüyüşe kapatılır." },
      { date: "08-30", name: "Zafer Bayramı", type: "public_holiday", impact: "Resmi tatil." },
      { date: "10-29", name: "Cumhuriyet Bayramı", type: "public_holiday", impact: "Resmi tatil; ana caddelerde tören." },
      { date: "04-01", name: "Lale Festivali (yaklaşık)", type: "festival", impact: "Emirgan Korusu ve Gülhane'de zirve kalabalık. Nisan başı-ortası." },
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
        description: "Boğaz kenarı koşu parkurları ve ormanlık alanlar. Flat tercih edenlere Yenikapı sahil bandı (6 km düz). Tepeli için Çamlıca tepesi.",
        highlights: ["Yenikapı sahil bandı", "Maçka Parkı döngüsü", "Emirgan Korusu"],
      },
      {
        category: "food_specialty",
        description: "İstanbul yemeği farklı bölgelerden göçün karışımı. Güneydoğu mutfağı (Kadıköy Çiya), sahil balıkçısı (Beşiktaş), meyhane kültürü (Nevizade).",
        highlights: [
          "Çiya Sofrası — Güneydoğu meze ve kebap, Kadıköy",
          "Nevizade sokağı meyhane akşamı",
          "Karaköy Güllüoğlu — simit ve börek sabah rutiní",
          "Midye dolma — Eminönü veya Boğazkesen cadde satıcıları",
        ],
      },
      {
        category: "art_gallery",
        description: "İstanbul Bienali (Eylül-Kasım çift yıllarda), İstanbul Modern yeni binada (Karaköy), SALT Galata mimari arşivi ücretsiz.",
        highlights: [
          "İstanbul Modern — Renzo Piano binası, Karaköy",
          "SALT Galata — ücretsiz giriş, güçlü arşiv",
          "Müze Gazhane — dönüştürülmüş gaz fabrikası, Kadıköy",
        ],
      },
      {
        category: "coworking",
        description: "Dijital göçmen varlığı son yıllarda arttı. Beyoğlu ve Karaköy en yoğun coworking bölgesi.",
        highlights: [
          "Kolektif İstanbul — Maslak ve Levent şubeleri",
          "Bay Kafe Beşiktaş — güçlü WiFi, laptop dostu sabah",
          "Moda ve Kadıköy'deki birçok kafe gün içi çalışmaya açık",
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
