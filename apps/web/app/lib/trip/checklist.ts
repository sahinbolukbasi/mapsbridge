/**
 * Trip preparation checklist generator.
 *
 * Returns phase-aware checklist sections for the "prepare" and "orient" phases.
 * Content is static — no model inference. Destination-specific items come from
 * the DestinationBrief (passed in by caller).
 */

export type ChecklistCategory =
  "documents" | "bookings" | "packing" | "health" | "money" | "digital" | "on_arrival";

export type ChecklistPriority = "must" | "should" | "nice";

export interface ChecklistItem {
  id: string;
  category: ChecklistCategory;
  label: string;
  hint?: string;
  priority: ChecklistPriority;
  done: boolean;
}

export interface ChecklistSection {
  title: string;
  category: ChecklistCategory;
  items: ChecklistItem[];
}

function item(
  id: string,
  category: ChecklistCategory,
  label: string,
  priority: ChecklistPriority,
  hint?: string,
): ChecklistItem {
  return { id, category, label, hint, priority, done: false };
}

// ── Static base checklist — always shown ─────────────────────────────────────

const BASE_SECTIONS: ChecklistSection[] = [
  {
    title: "Belgeler",
    category: "documents",
    items: [
      item(
        "doc-passport",
        "documents",
        "Pasaport geçerlilik kontrolü (son 6 ay)",
        "must",
        "Birçok ülke pasaportun en az 6 ay geçerli olmasını şart koşar.",
      ),
      item(
        "doc-visa",
        "documents",
        "Vize gereksinimi kontrol edildi",
        "must",
        "Vize zorunluluğu değişebilir — resmi büyükelçilik sitesini kontrol et.",
      ),
      item(
        "doc-id",
        "documents",
        "Kimlik kartı veya pasaport fotokopisi ayrıca saklandı",
        "should",
      ),
      item(
        "doc-travel-insurance",
        "documents",
        "Seyahat sigortası satın alındı ve poliçe bilgileri erişilebilir",
        "must",
      ),
    ],
  },
  {
    title: "Rezervasyonlar",
    category: "bookings",
    items: [
      item("book-flight", "bookings", "Uçak bileti onaylandı ve e-bilet kaydedildi", "must"),
      item("book-hotel", "bookings", "Konaklama onay e-postası kaydedildi", "must"),
      item("book-checkin", "bookings", "Online check-in yapıldı (varsa)", "should"),
      item("book-airport", "bookings", "Havalimanı transferi / ulaşım planlandı", "should"),
    ],
  },
  {
    title: "Para & Kart",
    category: "money",
    items: [
      item(
        "money-notify",
        "money",
        "Banka / kredi kartı yurt dışı bildirim yapıldı",
        "must",
        "Bankana haber vermezsen kartın bloke edilebilir.",
      ),
      item("money-cash", "money", "Kısa ödeme için nakit alındı", "should"),
      item("money-backup", "money", "Yedek kart veya acil nakit hazırlandı", "should"),
    ],
  },
  {
    title: "Dijital Hazırlık",
    category: "digital",
    items: [
      item(
        "digital-offline-map",
        "digital",
        "Google Maps / Maps.me offline haritası indirildi",
        "must",
      ),
      item("digital-sim", "digital", "Yerel SIM veya eSIM planlandı", "should"),
      item("digital-apps", "digital", "Yerel ulaşım uygulaması indirildi (varsa)", "should"),
      item(
        "digital-photos-backup",
        "digital",
        "Önemli belgeler fotoğraflanıp buluta yüklendi",
        "should",
      ),
      item(
        "digital-emergency-numbers",
        "digital",
        "Acil numaralar (büyükelçilik, sigorta hattı) kaydedildi",
        "must",
      ),
    ],
  },
  {
    title: "Sağlık",
    category: "health",
    items: [
      item(
        "health-meds",
        "health",
        "Sürekli kullanılan ilaçlar yeterli miktarda hazırlandı",
        "must",
      ),
      item(
        "health-prescriptions",
        "health",
        "İlaç reçeteleri fotokopisi alındı (yurt dışı için)",
        "should",
      ),
      item("health-vaccine", "health", "Bölge için gerekli aşılar kontrol edildi", "should"),
    ],
  },
];

// ── Destination-specific additions ───────────────────────────────────────────

interface DestinationChecklistHints {
  documents?: ChecklistItem[];
  bookings?: ChecklistItem[];
  money?: ChecklistItem[];
  on_arrival?: ChecklistItem[];
}

const DESTINATION_EXTRAS: Record<string, DestinationChecklistHints> = {
  istanbul: {
    money: [
      item(
        "ist-money-lira",
        "money",
        "Türk Lirası hazırlandı (özellikle Kapalıçarşı için)",
        "should",
        "Bazı esnaf kartlı ödemelere ek ücret uygular.",
      ),
    ],
    on_arrival: [
      item(
        "ist-istanbulkart",
        "on_arrival",
        "İstanbulkart alındı (havalimanı / metro çıkışında)",
        "must",
        "Tüm toplu taşıma için geçerli; nakit geçmez.",
      ),
      item("ist-customs", "on_arrival", "Havalimanı gümrük formları dolduruldu", "should"),
    ],
    bookings: [
      item(
        "ist-museums",
        "bookings",
        "Ayasofya / Topkapı giriş saati rezervasyonu yapıldı",
        "should",
        "Yoğun sezonlarda uzun kuyruklar olabilir.",
      ),
    ],
  },
  barcelona: {
    bookings: [
      item(
        "bcn-sagrada",
        "bookings",
        "Sagrada Família bileti rezervasyonu yapıldı (3 hafta önceden)",
        "must",
        "Kapıda bilet satılmıyor.",
      ),
      item(
        "bcn-casa-batllo",
        "bookings",
        "Casa Batlló / Casa Milà girilmek isteniyorsa rezervasyon yapıldı",
        "should",
      ),
    ],
    on_arrival: [
      item("bcn-t-casual", "on_arrival", "T-Casual metro kartı alındı (10 yolculuk)", "must"),
      item("bcn-roaming", "on_arrival", "Bölge 1 içi kartın yüklü olduğu kontrol edildi", "should"),
    ],
  },
  paris: {
    bookings: [
      item(
        "par-louvre",
        "bookings",
        "Louvre için zaman dilimi rezervasyonu yapıldı (salı hariç, kapalı)",
        "must",
        "Salıları kapalı!",
      ),
      item(
        "par-versailles",
        "bookings",
        "Versailles ziyaret planlandıysa pazartesi dışında rezervasyon yapıldı",
        "should",
      ),
      item(
        "par-eiffel",
        "bookings",
        "Eyfel Kulesi katı rezervasyonu yapıldı (en az 2 hafta önceden)",
        "must",
      ),
    ],
    money: [
      item(
        "par-type-e",
        "money",
        "Tip E priz adaptörü hazırlandı",
        "must",
        "Fransa'da Tip E prize ihtiyaç var.",
      ),
    ],
    on_arrival: [
      item(
        "par-navigo",
        "on_arrival",
        "Navigo Easy kart alındı (CDG havalimanı RER B dahil)",
        "must",
      ),
    ],
  },
};

// ── Builder ───────────────────────────────────────────────────────────────────

export interface ChecklistGeneratorOptions {
  destination?: string;
  /** Caller can inject additional booking items (from DestinationBrief.reservationNorms). */
  reservationReminders?: string[];
}

export function generateChecklist(opts: ChecklistGeneratorOptions): ChecklistSection[] {
  const sections: ChecklistSection[] = BASE_SECTIONS.map((s) => ({
    ...s,
    items: [...s.items],
  }));

  const destKey = (opts.destination ?? "").toLowerCase().replace(/\s+/g, "");
  const extras = DESTINATION_EXTRAS[destKey];

  if (extras) {
    for (const [cat, extraItems] of Object.entries(extras) as [
      ChecklistCategory,
      ChecklistItem[],
    ][]) {
      const existing = sections.find((s) => s.category === cat);
      if (existing) {
        existing.items.push(...extraItems);
      } else {
        sections.push({
          title: cat === "on_arrival" ? "Varışta Yapılacaklar" : cat,
          category: cat,
          items: extraItems,
        });
      }
    }
  }

  // Inject reservation reminders from DestinationBrief
  if (opts.reservationReminders?.length) {
    const bookingSection = sections.find((s) => s.category === "bookings");
    const injected = opts.reservationReminders
      .slice(0, 3)
      .map((reminder, i) => item(`dyn-res-${i}`, "bookings", reminder, "should"));
    if (bookingSection) {
      bookingSection.items.push(...injected);
    }
  }

  // On-arrival section heading
  const onArrival = sections.find((s) => s.category === "on_arrival");
  if (onArrival) onArrival.title = "Varışta Yapılacaklar";

  return sections.filter((s) => s.items.length > 0);
}

/** Returns count of must-do items not yet done. */
export function pendingMustCount(sections: ChecklistSection[]): number {
  return sections.flatMap((s) => s.items).filter((i) => i.priority === "must" && !i.done).length;
}
