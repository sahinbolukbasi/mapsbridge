import { EmergencyInfo } from "../types";

/**
 * Emergency & Consulate Sub-Agent
 * Provides static Turkish consular reference contacts, 24/7 hotlines,
 * local emergency service numbers, and legal protocols for passport loss or emergencies abroad.
 */
export function getDeterministicEmergencyLine(destination: string): string {
  const isUS = /new york|abd|usa|amerika|los angeles|chicago/iu.test(destination);
  const localNumber = isUS ? "911" : "112";
  return `⚠️ ACİL DURUM: Hayati tehlike durumunda derhal ${localNumber}'i arayınız. Bu asistan tıbbi veya hukuki teşhis koyamaz.`;
}

export function runEmergencyAgent(
  destination: string,
  prompt: string,
): {
  info: EmergencyInfo;
  durationMs: number;
  deterministicNotice: string;
} {
  const startTime = Date.now();
  const text = destination.toLowerCase();
  const notice = getDeterministicEmergencyLine(destination);

  let emergencyInfo: EmergencyInfo;

  if (
    text.includes("new york") ||
    text.includes("nyc") ||
    text.includes("amerika") ||
    text.includes("usa") ||
    text.includes("abd")
  ) {
    emergencyInfo = {
      destinationCountry: "Amerika Birleşik Devletleri (New York)",
      turkishEmbassyConsulate: {
        title: "T.C. New York Başkonsolosluğu (Türkevi / Turkish Center)",
        address: "825 3rd Ave, New York, NY 10022 (46. Cadde köşesi, Türkevi Binası)",
        phone: "+1 646 560 2100",
        emergencyHotline:
          "+90 312 292 29 29 (T.C. Dışişleri Bakanlığı 7/24 Konsolosluk Çağrı Merkezi)",
        email: "consulate.newyork@mfa.gov.tr",
        workingHours: "Hafta içi 09:00 - 16:30 (Acil nöbetçi konsolosluk hattı 7/24)",
      },
      localEmergencyNumbers: {
        police: "911 (Polis / İtfaiye / Ambulans - Tek Acil Numara)",
        ambulance: "911",
        fire: "911",
        generalEmergency: "911 (Hayati Acil) / 311 (Acil Olmayan Belediye Hizmetleri)",
      },
      safetyAndPassportTips: [
        "Pasaport / Cüzdan Çalınması: Derhal en yakın NYPD karakoluna (precinct) giderek 'Police Incident Report' tutanağı alın. Bu tutanak ve T.C. kimlik kartınızla Türkevi'ndeki T.C. New York Başkonsolosluğu'na başvurarak 'Geçici Pasaport' (Seyahat Belgesi) alabilirsiniz.",
        "Sağlık Acili: Hayati tehlikede 911'i arayarak ambulans isteyin. Hafif yaralanma veya hastalıkta 'Urgent Care' kliniklerine başvurabilirsiniz. Seyahat sağlık sigortanızın acil numarasını hazır bulundurun.",
        "Hukuki Durum / Gözaltı: Polis gözaltısında sessiz kalma ve avukat talep etme (Miranda Rights) hakkınız vardır; derhal T.C. New York Başkonsolosluğu'na bilgi verilmesini talep ediniz.",
        ...(/(fırtına|kasırga|hava|afet|deprem)/iu.test(prompt)
          ? [
              "Şiddetli Hava ve Afet Durumu: Açık alanlardan ve pencerelerden uzak durup kapalı ve güvenli bir binaya veya metro istasyonuna sığının. NYC Emergency Management yönergelerine uyun.",
            ]
          : []),
        ...(/(çocuk|kayıp|kaybettim)/iu.test(prompt)
          ? [
              "Kayıp Kişi / Çocuk: Derhal 911'i arayarak polis ekiplerine ve alan güvenlik görevlilerine çocuğunuzun eşkal ve son görülen yer bilgisini bildirin.",
            ]
          : []),
      ],
    };
  } else if (
    text.includes("roma") ||
    text.includes("italya") ||
    text.includes("rome") ||
    text.includes("italy")
  ) {
    emergencyInfo = {
      destinationCountry: "İtalya (Roma)",
      turkishEmbassyConsulate: {
        title: "T.C. Roma Büyükelçiliği & Konsolosluk Şubesi",
        address: "Via Palestro, 28, 00185 Roma RM, İtalya (Termini İstasyonu yakınında)",
        phone: "+39 06 445941 / +39 06 44594200",
        emergencyHotline:
          "+90 312 292 29 29 (T.C. Dışişleri Bakanlığı 7/24 Konsolosluk Çağrı Merkezi)",
        email: "ambasciata.roma@mfa.gov.tr",
        workingHours: "Hafta içi 09:00 - 17:00 (Acil nöbetçi konsolosluk hattı 7/24)",
      },
      localEmergencyNumbers: {
        police: "113 (Polizia di Stato) / 112 (Carabinieri)",
        ambulance: "118 (Pronto Soccorso)",
        fire: "115 (Vigili del Fuoco)",
        generalEmergency: "112 (Avrupa Birliği Tek Acil Numara)",
      },
      safetyAndPassportTips: [
        "Pasaport Kaybı Durumunda: Vakit kaybetmeden en yakın 'Carabinieri' veya 'Polizia' karakoluna giderek 'Denuncia di Furto/Smarrimento' (Kayıp/Çalıntı Tutanağı) düzenletin.",
        "Geçici Pasaport (Pasavan): Karakol tutanağı, 2 adet biyometrik fotoğraf ve T.C. Kimlik Kartınız ile Via Palestro 28'deki T.C. Roma Konsolosluk Şubesi'ne başvurun. Türkiye'ye dönüş için aynı gün Geçici Seyahat Belgesi verilir.",
        "Yankesicilik Uyarısı: Kolezyum çevresi, Termini İstasyonu ve 64 numaralı Vatikan otobüsünde sırt çantalarınızı önünüzde tutun ve pasaportunuzun orijinali yerine otel kasasında bırakıp telefonunuzda fotoğrafını taşıyın.",
      ],
    };
  } else if (text.includes("tokyo") || text.includes("japonya") || text.includes("japan")) {
    emergencyInfo = {
      destinationCountry: "Japonya (Tokyo)",
      turkishEmbassyConsulate: {
        title: "T.C. Tokyo Büyükelçiliği",
        address: "2-33-6 Jingumae, Shibuya-ku, Tokyo 150-0001, Japonya",
        phone: "+81 3 6439 5700",
        emergencyHotline:
          "+90 312 292 29 29 (T.C. Dışişleri Bakanlığı 7/24 Konsolosluk Çağrı Merkezi)",
        email: "embassy.tokyo@mfa.gov.tr",
        workingHours: "Hafta içi 09:00 - 17:00",
      },
      localEmergencyNumbers: {
        police: "110 (Polis / Keisatsu)",
        ambulance: "119 (Ambulans & İtfaiye)",
        fire: "119",
        generalEmergency: "#7119 (Tıbbi Danışma ve Acil Yönlendirme)",
      },
      safetyAndPassportTips: [
        "Koban (Mahalle Karakolları): Japonya'da kaybolan eşyalar veya kimlikler genelde birkaç saat içinde en yakın mahalle karakoluna (Kōban) teslim edilir. Öncelikle oraya danışın.",
        "Deprem & Doğal Afet Güvenliği: 'Yurekuru Call' veya 'Safety Tips' uygulamasını telefonunuza indirin. Deprem anında binaların içinde kalın ve başınızı koruyun.",
        "Pasaport Kaybı: Kōban'dan 'Ishitsutodoke' (Kayıp Belgesi) alarak Shibuya Jingumae'deki Türk Büyükelçiliği'ne başvurun.",
      ],
    };
  } else if (text.includes("fransa") || text.includes("paris")) {
    emergencyInfo = {
      destinationCountry: "Fransa (Paris)",
      turkishEmbassyConsulate: {
        title: "T.C. Paris Başkonsolosluğu",
        address: "44 Rue de Sèvres, 92100 Boulogne-Billancourt, Fransa",
        phone: "+33 1 47 12 30 30",
        emergencyHotline: "+90 312 292 29 29 (T.C. Dışişleri Bakanlığı 7/24)",
        email: "consulat.paris@mfa.gov.tr",
        workingHours: "Hafta içi 08:30 - 16:30",
      },
      localEmergencyNumbers: {
        police: "17 (Police Nationale)",
        ambulance: "15 (SAMU)",
        fire: "18 (Sapeurs-Pompiers)",
        generalEmergency: "112 (Genel Acil)",
      },
      safetyAndPassportTips: [
        "Pasaport Kaybı: Commissariat de Police'ten 'Déclaration de perte' belgesi alıp Paris Başkonsolosluğu'na gidin.",
        "Metro Güvenliği: Gare du Nord, Châtelet ve Eyfel Kulesi çevresinde imza toplama veya altın yüzük hilelerine karşı dikkatli olun.",
      ],
    };
  } else if (
    text.includes("kapadokya") ||
    text.includes("nevşehir") ||
    text.includes("türkiye") ||
    text.includes("ege") ||
    text.includes("istanbul")
  ) {
    emergencyInfo = {
      destinationCountry: "Türkiye",
      turkishEmbassyConsulate: {
        title: "T.C. İçişleri & Dışişleri Bakanlığı Kamu Hizmetleri",
        address: "Türkiye Geneli",
        phone: "112 (Tek Acil Çağrı Merkezi)",
        emergencyHotline: "+90 312 292 29 29 (Konsolosluk Çağrı Merkezi) / 112 Acil",
        workingHours: "7/24 Kesintisiz",
      },
      localEmergencyNumbers: {
        police: "112 (Polis İmdat)",
        ambulance: "112 (Acil Sağlık)",
        fire: "112 (İtfaiye)",
        generalEmergency: "112 (Tek Acil Çağrı Numarası - Tüm Kurumlar)",
      },
      safetyAndPassportTips: [
        "Türkiye içinde tüm acil yardım kurumları (Polis, Jandarma, Ambulans, İtfaiye, Orman Yangını, Sahil Güvenlik) tek bir numara olan 112 altında birleşmiştir.",
        "Kimlik/Cüzdan Kaybı: En yakın İlçe Emniyet Müdürlüğü veya Jandarma Karakolu'na bildirimde bulunup tutanak alabilir, e-Devlet üzerinden kimlik kaybı bildirimi yapabilirsiniz.",
        "Yabancı Turistler İçin: 112 hattında İngilizce, Almanca, Rusça ve Arapça dillerinde tercüman desteği sunulmaktadır.",
      ],
    };
  } else {
    // Universal Global Fallback
    emergencyInfo = {
      destinationCountry: destination || "Yurtdışı Seyahat Noktası",
      turkishEmbassyConsulate: {
        title: "T.C. Dışişleri Bakanlığı Konsolosluk Çağrı Merkezi & Temsilcilikler",
        address: "İlgili ülkedeki T.C. Büyükelçiliği / Başkonsolosluğu",
        phone: "+90 312 292 29 29 (7/24 Kesintisiz Konsolosluk Çağrı Merkezi)",
        emergencyHotline: "+90 312 292 29 29 (Tüm dünyadan doğrudan erişilebilir)",
        email: "iletisim@mfa.gov.tr",
        workingHours: "Konsolosluk Çağrı Merkezi 7 gün 24 saat kesintisiz hizmet vermektedir.",
      },
      localEmergencyNumbers: {
        police: "112 (Avrupa & Çoğu Ülke) / 911 (Amerika)",
        ambulance: "112 / 911",
        fire: "112 / 911",
        generalEmergency: "112 (Uluslararası GSM Acil Numarası)",
      },
      safetyAndPassportTips: [
        "Pasaportunuzun kaybolması durumunda derhal yerel polis karakoluna müracaat ederek kayıp tutanağı alınız.",
        "T.C. Dışişleri Bakanlığı Konsolosluk Çağrı Merkezi'ni (+90 312 292 29 29) arayarak en yakın Türk misyonunun adres ve nöbetçi irtibat bilgilerini alabilirsiniz.",
        "Yurtdışına çıkmadan önce pasaportunuzun ve vizelerinizin dijital kopyalarını bulut depolamanızda veya e-postanızda saklayınız.",
      ],
    };
  }

  return {
    info: emergencyInfo,
    durationMs: Date.now() - startTime,
    deterministicNotice: notice,
  };
}
