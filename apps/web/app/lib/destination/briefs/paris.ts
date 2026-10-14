import type { DestinationBrief } from "../types";

/**
 * Paris Destinasyon Brifingi
 * Kürasyon: manuel — @sahin, Ekim 2026
 * Kaynak: Wikivoyage "Paris" (CC BY-SA 4.0) + kuratör gözlemi
 */
export const PARIS_BRIEF: DestinationBrief = {
  id: "paris",
  level: "city",
  name: "Paris",
  nameLocal: "Paris",
  countryCode: "FR",

  cityRhythm: {
    value: {
      wakeUpTime: "08:00",
      lunchTime: "12:00-14:00",
      dinnerTime: "19:30-21:30",
      siestaExists: false,
      nightlifeStartsAt: "22:00",
      closingDayNote:
        "Pazar günleri bakkallar sabah açık, öğleden sonra kapalı. Pek çok dükkan kapalı. Restoranların bir kısmı Pazar-Pazartesi kapalı.",
      additionalNotes: [
        "Ağustos'ta yerli Parisli tatile çıkar; birçok restoran ve butik kapısını kapatır.",
        "Ekmek kültürü ciddiye alınır — boulangerie'ler erken açılır (07:00) ve birçoğu 13:00-16:00 arası kapalıdır.",
        "Müzeler büyük çoğunlukla Pazartesi veya Salı kapalı — karıştırmamak için her mekan ayrı kontrol et.",
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
        name: "Le Marais (3. ve 4. arrondissement)",
        character:
          "Paris'in en yoğun yaşayan tarihi mahallesi: Orta Çağ sokak dokusu, Yahudi çeyreği (Rue des Rosiers), LGBTQ+ kültür merkezi, müzeler ve butikler bir arada. Pazar sabahı Marché des Enfants Rouges en canlı hali. Hafta sonu yürünmesi zevkli.",
        bestFor: ["tarih", "yemek", "sanat", "alisveris", "cafeler"],
        bestVisitTime: "her_zaman",
        accommodationSuitable: true,
        walkableFromCenter: true,
      },
      {
        name: "Saint-Germain-des-Prés (6. arrondissement)",
        character:
          "Sartre ve Beauvoir'ın kafaları biriktiği zamanların entelektüel kalbiydi. Artık pahalı ve turistik. Café de Flore ve Les Deux Magots'ta kafe içmek tarihe dokunmak gibi ama bir kez yeter. Gerçek yerel hayat için Montparnasse'a yürü.",
        bestFor: ["tarihi_atmosfer", "cafeler", "alisveris"],
        bestVisitTime: "sabah",
        accommodationSuitable: true,
        walkableFromCenter: true,
      },
      {
        name: "Montmartre (18. arrondissement)",
        character:
          "Sacré-Cœur'ün çevresindeki tepe turistik ama sabah erken çok güzel. Saat 10:00'dan sonra tur grupları geliyor. Place du Tertre ressam tuzağı; yerine Rue Lepic'e yürü. Gece hayatı için Pigalle aşağısı.",
        bestFor: ["manzara", "fotograf", "tarihi_atmosfer"],
        bestVisitTime: "sabah_erken",
        accommodationSuitable: false,
        walkableFromCenter: false,
      },
      {
        name: "Canal Saint-Martin (10. arrondissement)",
        character:
          "Bohem ve hipster Paris burada. Kanalın kenarında kitap okuyan gençler, küçük kafeler, independent butikler. Brunch mekanları Cuma-Pazar öğleden önce çok kalabalık. Turist yok denilecek kadar az — bu da artısı.",
        bestFor: ["yerel_deneyim", "cafeler", "fotograf"],
        bestVisitTime: "ogle_veya_aksam",
        accommodationSuitable: true,
        walkableFromCenter: false,
      },
      {
        name: "Belleville (11. ve 20. arrondissement)",
        character:
          "Paris'in en kozmopolit, en az keşfedilmiş yakası. Çin, Kuzey Afrika ve Ortadoğu mutfakları yan yana. Artan genç sanatçı topluluğu. Parc de Belleville'den manzara şehrin en iyilerinden biri ve ücretsiz.",
        bestFor: ["yerel_deneyim", "yemek", "fotograf", "manzara"],
        bestVisitTime: "ogle_veya_aksam",
        accommodationSuitable: false,
        walkableFromCenter: false,
      },
      {
        name: "Oberkampf (11. arrondissement)",
        character:
          "Gecenin en canlı bar sokağı. Daha az turistik, daha çok yerel. Hafta içi bile bar sahnesi aktif. Yemek için mükemmel bistro seçenekleri.",
        bestFor: ["gece_hayati", "yemek"],
        bestVisitTime: "aksam",
        accommodationSuitable: true,
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
      transitCardName: "Navigo Easy veya t+ bilet",
      transitCardAcquisition:
        "Navigo Easy kart 2€, üstüne 10'lu karnet yükle. Metro + RER + otobüste geçerli. Havalimanı için RER B ayrı ücret.",
      taxiVsApp:
        "Bolt ve Uber çalışıyor. Gece geç saatlerde uygulama daha güvenli. Tren ve metro grevi haberi varsa önceden kontrol et (RATP strikes normaldir).",
      walkability: "high",
      hillsWarning: "Paris büyük ölçüde düz. Tek istisna Montmartre tepesi.",
      airportTransferSummary:
        "CDG'den RER B ile Paris Kuzey (Gare du Nord) 25-35 dakika, sonra metro. Roissy Bus Opéra'ya 60 dakika. Gece geç saatlerde Le Bus Direct önerilir. Taksi yaklaşık 50-70€.",
      carRecommended: false,
      carNote:
        "Paris içi araç gereksiz ve pahalı. LEZ (Düşük Emisyon Bölgesi) kısıtlaması var — yabancı plakalı araçlar ceza riski taşır.",
      ferryNote: "Bateaux Mouches turistik; Seine'de düzenli taşıma servisi yok.",
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
        mistake: "Eyfel Kulesi'ne önceden bilet almadan gitmek",
        correction:
          "Kuyruk 2-4 saat olabilir. toureiffel.paris'ten zaman slotlu bilet al, en az 3-4 hafta önceden. Asansör kuyruğu merdiven kuyruğundan uzun; kondisyon iyiyse merdiven tercih et.",
      },
      {
        mistake: "Louvre'a tüm gün planlamak",
        correction:
          "Louvre'da 3 saat yorucu ama yeterli — neyi göreceğini önceden belirle. Mona Lisa için 20 dakika kalabalık savar; onun yerine Vermeer, Raphael veya antik Yunan eserleri salonları nefes kesici ve boş.",
      },
      {
        mistake: "Müze tatil günlerini karıştırmak",
        correction:
          "Louvre = Salı kapalı. Musée d'Orsay = Pazartesi kapalı. Versailles = Pazartesi kapalı. Her birini gitmeden bir kez daha kontrol et.",
      },
      {
        mistake: "Louvre yakınındaki restoranlarda yemek",
        correction:
          "1. arrondissementtaki restoranlar aşırı turistik. 10-15 dakika yürü: Marais, Palais-Royal veya Les Halles.",
      },
      {
        mistake: "Müzeleri serbest giriş günlerinde ziyaret etmek",
        correction:
          "Her ayın ilk Pazar günü pek çok müze ücretsiz — kuyruğu da ücretsiz. Sabah 09:00'da kapıda ol ya da başka bir gün öde.",
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
        overrated: "Mona Lisa",
        why: "43x53 cm küçük tablo, dev bir kalabalık, cam arkasından zorla bir bakış. Beklenti hayal kırıklığıyla sonuçlanır.",
        alternative: "Louvre'da Vermeer odası veya Deniz Zaferi heykeli",
        alternativeNote: "Aynı Louvre'da, kalabalık yok, kalitesi mağlup edilemez.",
      },
      {
        overrated: "Moulin Rouge gösterisi",
        why: "150€+ bilet, beklentiyi karşılamayan şov, turistik lokasyon. Bir kültür deneyiminden çok bir gece eğlencesi.",
        alternative: "Opéra Comique veya Théâtre du Châtelet",
        alternativeNote: "Gerçek Paris sanat sahnesi, daha uygun fiyat.",
      },
      {
        overrated: "Champs-Élysées alışveriş",
        why: "Çoğu büyük marka burada — ama Londra veya İstanbul'da da var. Atmosfer turistik ve sıradan.",
        alternative: "Galerie Vivienne veya Palais-Royal passaj",
        alternativeNote: "19. yüzyıl kapalı çarşı mimarisi, özgün butikler, fotoğraf için de harika.",
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
        subject: "Louvre",
        rule: "Salı kapalı. Cuma 18:00-21:45 arası indirimli ve daha az kalabalık.",
        type: "closed_day",
        severity: "blocks_visit",
      },
      {
        subject: "Musée d'Orsay",
        rule: "Pazartesi kapalı. Perşembe 18:00-21:45 gecesi saati",
        type: "closed_day",
        severity: "blocks_visit",
      },
      {
        subject: "Versailles",
        rule: "Pazartesi kapalı. Salı sabahı açılışı en az kalabalık dönem.",
        type: "closed_day",
        severity: "blocks_visit",
      },
      {
        subject: "Eyfel Kulesi",
        rule: "Akşam 18:00-22:00 arası en kalabalık. Sabah ilk saat (09:00) veya gece ışık şovunu görmek istiyorsan 21:00 sonrası.",
        type: "best_time",
        severity: "degrades_experience",
      },
      {
        subject: "Boulangeries",
        rule: "Çoğu 07:00-13:00 açık. Öğleden sonra kapandıklarını bilmeden plan yapma.",
        type: "closed_day",
        severity: "blocks_visit",
      },
      {
        subject: "Montmartre",
        rule: "Sabah 08:00-10:00 arası — turist yok, Paris gerçekliği. Saat 11:00'den sonra tur grubu seli başlar.",
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
          name: "Eyfel Kulesi",
          leadTimeDays: 21,
          method: "toureiffel.paris — asansör slotlu, merdiven bilet gün içi de alınabilir.",
          note: "Yaz aylarında 6 hafta önceden almak önerilir.",
        },
        {
          name: "Versailles",
          leadTimeDays: 7,
          method: "en.chateauversailles.fr — slotlu bilet. Büyük Trianon ayrı bilet.",
        },
        {
          name: "Louvre",
          leadTimeDays: 3,
          method: "ticketlouvre.fr — zaman slotlu giriş. Ücretsiz gün kotası ayrı.",
        },
        {
          name: "Le Meurice, L'Ambroisie, Septime (fine dining)",
          leadTimeDays: 60,
          method: "Resmi siteler veya TheFork. Septime öğle yemeği slot dolmadan arar.",
        },
      ],
      generalNote:
        "Brasserie ve bistro kültüründe akşam için 1-2 gün öncesi yeter. Öğle yemeği için rezervasyona gerek duyulmaz.",
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
      offPeakMonths: [1, 2],
      byMonth: {
        "1": "Yağmurlu ve soğuk (5°C). Müzeler boş, restoranlar rahat. Sonrası Yılbaşı indirimi (soldes).",
        "3": "Hava ısınıyor, ilkbahar görünüyor. Kalabalık henüz normal seviyede.",
        "4": "Güzel, Paskalya kalabalığı geliyor. Versailles zirveye çıkıyor.",
        "5": "Cannes Film Festivali (orta Mayıs) Paris'e taşmaz ama atmosfer kalabalık.",
        "6": "Paris Müzik Günü (21 Haziran) — şehir genelinde bedava konserler.",
        "7": "Bastille Günü (14 Temmuz) büyük kutlama. Turist zirve.",
        "8": "Yerli Parisli tatilde, bazı restoranlar kapalı. Kalabalık ve boş bir şehir karışımı.",
        "9": "Moda Haftası (Eylül sonları). Kalabalık artar, otel fiyatları yükselir.",
        "10": "Sonbahar sarısı Paris'te çok güzel. Müzeler için harika dönem.",
        "11": "Sakin, gökyüzü gri ama şehir rahat.",
        "12": "Noel pazarları ve ışık dekorasyonları. Seyahat fiyatları yükselir.",
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
        "Servise dahil (service compris) her zaman faturada. Ekstra bahşiş zorunlu değil; memnunsan 1-2€ bırakmak takdir edilir.",
      plugType: "Type E (Fransız-Belçika tipi) — 230V/50Hz. Türk ve Avrupa şarj cihazları çoğunlukla uyumlu, tip kontrolü yap.",
      tapWaterSafe: true,
      cashVsCard:
        "Kart neredeyse her yerde geçerli. Bazı küçük kafeler ve pazarlar minimum tutar gerektirebilir. 50-100€ nakit yeterli.",
      dressCodes:
        "Dini mekanlarda (Notre-Dame, Sacré-Cœur) omuzlar örtülü olmalı. Üst düzey restoranlar smart casual bekler.",
      emergencyNumbers: { police: "17", ambulance: "15", general: "112" },
      currency: "EUR",
      paymentNote:
        "ATM'ler yaygın; banka kartı ile çekim DCC seçeneğini reddet.",
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
        "Metro hatlarında (özellikle 13. hat ve Gare du Nord çevresi) yankesicilik bildirimleri yüksek. Telefonu görünür şekilde tutma.",
        "Eyfel Kulesi civarında sahte imza/dilekçe tuzağı yaygın — durma, saygılıca geç.",
        "Gece geç saatlerde Pigalle alt bölgelerinde dikkatli ol.",
        "Gare du Nord çevresinde gece geç saatlerde yalnız yürümekten kaçın.",
      ],
      originBiasNote: "FCDO tavsiyesi İngiliz pasaport sahipleri için hazırlanmıştır.",
    },
    source: "manual:curator",
    license: "proprietary",
    attributionHtml: "MapsBridge kuratör gözlemi, FCDO France Travel Advice",
    retrievedAt: "2026-10-13",
    confidence: "likely",
  },

  localCalendar: {
    value: [
      { date: "01-01", name: "Yılbaşı", type: "public_holiday", impact: "Pek çok şey kapalı." },
      { date: "05-01", name: "İşçi Bayramı", type: "public_holiday", impact: "Tüm müze ve restoranların büyük kısmı kapalı." },
      { date: "05-08", name: "2. Dünya Savaşı Zafer Günü", type: "public_holiday", impact: "Resmi tatil." },
      { date: "06-21", name: "Fête de la Musique", type: "festival", impact: "Şehir genelinde ücretsiz konserler. Fantastik atmosfer." },
      { date: "07-14", name: "Bastille Günü", type: "festival", impact: "Askeri geçit töreni Champs-Élysées'de. Akşam havai fişek. Pek çok bölge kapalı." },
      { date: "09-01", name: "Paris Moda Haftası (yaklaşık)", type: "festival", impact: "Eylül sonu, otel ve restoran dolup taşıyor." },
      { date: "10-01", name: "Nuit Blanche (yaklaşık)", type: "festival", impact: "Ekim başı bir gece sanat mekânları sabaha kadar açık." },
      { date: "12-25", name: "Noel", type: "public_holiday", impact: "Şehir büyük ölçüde kapalı." },
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
        description: "Paris koşu parkurları çeşitli ama Pazar sabahları bazı yollar araçlara kapanır. Jardin des Tuileries-Luxembourg bağlantısı güzel.",
        highlights: [
          "Bois de Boulogne döngüleri (8-15 km arası seçenek)",
          "Canal Saint-Martin ve Canal de l'Ourcq düz bandı",
          "Jardin des Tuileries sabah koşu döngüsü (~2 km)",
        ],
      },
      {
        category: "food_specialty",
        description: "Fransız mutfağı bölgesel. Paris'in kendi spesyalitesi: brasserie kültürü, steak-frites, onion soup, crème brûlée. Fırın kültürü ayrı bir dal.",
        highlights: [
          "Du Pain et des Idées — Paris'in en iyi boulangerie'lerinden, Canal Saint-Martin",
          "Bistrot Paul Bert (11e) — steak-frites ve Fransız klasiği",
          "L'Avant Comptoir (6e) — ayakta tapas tarzı bar",
          "Marché d'Aligre (12e) — pazar saatlerinde, Pazar hariç her gün",
        ],
      },
      {
        category: "art_gallery",
        description: "Paris müze yoğunluğu inanılmaz. Bağımsız galeriler için Le Marais ve Saint-Germain-des-Prés.",
        highlights: [
          "Fondation Louis Vuitton (Bois de Boulogne) — çağdaş sanat ve mimari",
          "Palais de Tokyo — gece 22:00'ye kadar açık, çağdaş",
          "Centre Pompidou — modern sanat, çarşamba akşamları geç saate kadar açık",
          "Musée Rodin — bahçesi öğle yemeği için de mükemmel",
        ],
      },
      {
        category: "coworking",
        description: "Paris'te coworking altyapısı gelişiyor. Marais ve Oberkampf bölgesinde laptop dostu kafeler yoğun.",
        highlights: [
          "WeWork Paris — Châtelet ve Opéra lokasyonları",
          "Anticafé (Louvre yakını) — saatlik ücret, sınırsız içecek",
          "Café de Flore / Les Deux Magots — fotoğraf için evet, çalışmak için hayır",
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
