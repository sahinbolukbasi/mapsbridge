/**
 * §11.9 Local context layer
 *
 * Provides city-specific etiquette, safety, practical, and cultural notes
 * that are injected into the system prompt to ground model suggestions.
 *
 * Static data for Phase 1 cities: Istanbul, Barcelona, Paris, Rome.
 */

export interface LocalContextEntry {
  city: string;
  category: "etiquette" | "safety" | "practical" | "language" | "food_culture" | "dress_code";
  title: string;
  body: string; // max 150 chars
  severity: "info" | "warning" | "critical";
  sourceUrl?: string;
}

// ── Static data ───────────────────────────────────────────────────────────────

const LOCAL_CONTEXT_DATA: LocalContextEntry[] = [
  // ── İSTANBUL ──────────────────────────────────────────────────────────────

  {
    city: "istanbul",
    category: "safety",
    title: "Kapalıçarşı yankesici uyarısı",
    body: "Kapalıçarşı ve çevresi yoğun kalabalıkta çanta hırsızlığı yaşanabilir. Değerli eşyaları ön cepli çantada taşı.",
    severity: "warning",
    sourceUrl: "https://www.gov.uk/foreign-travel-advice/turkey",
  },
  {
    city: "istanbul",
    category: "dress_code",
    title: "Camilerde kıyafet kuralı",
    body: "Camiye girerken omuzları ve dizleri örtmek zorunlu; kapı girişinde başörtüsü ve şal ödünç alınabilir.",
    severity: "warning",
  },
  {
    city: "istanbul",
    category: "practical",
    title: "Su güvenliği",
    body: "İstanbul çeşme suyu içilebilir; şişe su tercihen kullanılır. Çay ve kahve güvenlidir.",
    severity: "info",
  },
  {
    city: "istanbul",
    category: "food_culture",
    title: "Bahşiş normu",
    body: "Restoranlarda %10 bahşiş normaldir; seyyar satıcılarda beklenmez. Taxim bölgesinde servis bedeli fişe yansıyabilir.",
    severity: "info",
  },
  {
    city: "istanbul",
    category: "practical",
    title: "Nakit mi kart mı?",
    body: "Büyük restoranlar ve mağazalar kart kabul eder. Çarşılar, minibüsler ve küçük kahvelerde nakit şart.",
    severity: "info",
  },
  {
    city: "istanbul",
    category: "practical",
    title: "İstanbulkart zorunluluğu",
    body: "Metro, tramvay ve Marmaray için İstanbulkart şart; nakit ile biniş katsayılı ücretlendirme yapılabilir.",
    severity: "warning",
  },
  {
    city: "istanbul",
    category: "etiquette",
    title: "Pazarlık kültürü",
    body: "Kapalıçarşı ve halı dükkanlarında pazarlık beklenir; süpermarket ve zincir mağazalarda fiyatlar sabittir.",
    severity: "info",
  },

  // ── BARCELONA ─────────────────────────────────────────────────────────────

  {
    city: "barcelona",
    category: "practical",
    title: "La Boqueria kalabalık yönetimi",
    body: "La Boqueria sabah 10'dan itibaren çok kalabalıklaşır; 09:00'da gelin veya Santa Caterina Pazarı'nı tercih edin.",
    severity: "info",
  },
  {
    city: "barcelona",
    category: "safety",
    title: "La Rambla ve Barceloneta hırsızlık",
    body: "Las Ramblas ve plaj bölgesi yankesici açısından riskli; çantayı önde taşı, bant ile cüzdanı sakla.",
    severity: "warning",
    sourceUrl: "https://www.gov.uk/foreign-travel-advice/spain",
  },
  {
    city: "barcelona",
    category: "practical",
    title: "Siesta saatleri",
    body: "Küçük dükkanlar 14:00–17:00 arası kapalı olabilir. Süpermarket ve alışveriş merkezleri açık kalır.",
    severity: "info",
  },
  {
    city: "barcelona",
    category: "food_culture",
    title: "Bahşiş normu",
    body: "Restoranlarda %5–10 isteğe bağlı bahşiş normaldir; zorunlu değil. Kafelerde bozuk para bırakmak yeterlidir.",
    severity: "info",
  },
  {
    city: "barcelona",
    category: "safety",
    title: "Plajda çanta hırsızlığı",
    body: "Barceloneta ve Bogatell plajlarında yüzerken çanta gözetimsiz bırakma; kiralık kasa veya su geçirmez kılıf kullan.",
    severity: "warning",
  },
  {
    city: "barcelona",
    category: "practical",
    title: "T-Casual metro kartı",
    body: "10 yolculukluk T-Casual kartı tekli bilete göre çok ucuz; havalimanı hattı ayrı fiyatlandırılır.",
    severity: "info",
  },
  {
    city: "barcelona",
    category: "etiquette",
    title: "Katalanca hassasiyeti",
    body: 'Yerel halk Katalanca konuşur; İspanyolca ile başlayabilirsin ama "Parla català?" sormak iyi bir jest olur.',
    severity: "info",
  },

  // ── PARIS ─────────────────────────────────────────────────────────────────

  {
    city: "paris",
    category: "practical",
    title: "Müze kuyruk yönetimi",
    body: "Louvre ve Musée d'Orsay için çevrimiçi zaman dilimi bileti al; kapı kuyruğu 2 saati bulabilir.",
    severity: "warning",
    sourceUrl: "https://www.louvre.fr",
  },
  {
    city: "paris",
    category: "etiquette",
    title: "Kafe etiği",
    body: 'Kafede "Bonjour" ile başlamak礼 礼礼; masada uzun süre oturulabilir, servis genellikle yavaştır.',
    severity: "info",
  },
  {
    city: "paris",
    category: "practical",
    title: "Grevler (grèves)",
    body: "Fransa'da toplu taşıma grevi sık görülür. Metro/RER öncesi gün akşamı RATP uygulamasını kontrol et.",
    severity: "warning",
    sourceUrl: "https://www.ratp.fr",
  },
  {
    city: "paris",
    category: "practical",
    title: "Çeşme suyu güvenli",
    body: 'Paris çeşme suyu Avrupa\'nın en kaliteli şehir sularından biridir; ücretsiz "Wallace" çeşmelerinden içilebilir.',
    severity: "info",
  },
  {
    city: "paris",
    category: "practical",
    title: "Pazar günü kapanışları",
    body: "Küçük dükkanlar ve birçok bakkal Pazar günü kapalı; büyük süpermarketler kısmen açık kalır.",
    severity: "info",
  },
  {
    city: "paris",
    category: "food_culture",
    title: "Servis dahil (service compris)",
    body: "Fransız yasası gereği restoran fişine %15 servis dahildir; ekstra bahşiş zorunlu değil ama takdir edilir.",
    severity: "info",
  },
  {
    city: "paris",
    category: "language",
    title: "Fransızcayla başla",
    body: 'Yerel halk, İngilizce bilse de karşılamayı Fransızca yapmanı takdir eder: "Bonjour, parlez-vous anglais?"',
    severity: "info",
  },

  // ── ROME ──────────────────────────────────────────────────────────────────

  {
    city: "rome",
    category: "practical",
    title: "ZTL (Zona a Traffico Limitato) — kritik",
    body: "Tarihi merkezde araçla girmek ZTL cezası gerektirir (€100–250+). Kiralık araç kullanıyorsan otele önceden sor.",
    severity: "critical",
    sourceUrl: "https://www.comune.roma.it/web/it/ztl.page",
  },
  {
    city: "rome",
    category: "dress_code",
    title: "Bazilika kıyafet kuralı",
    body: "Vatikan, San Giovanni ve büyük bazilikalarda omuz ve diz örtülü olmalı; şort ve kolsuz üst ile girilmez.",
    severity: "warning",
  },
  {
    city: "rome",
    category: "food_culture",
    title: "Turistik menü markası",
    body: '"Menü turistico" görünüşte ucuz ama kalitesi düşük olabilir. Sokak tabelalarını atla; Google Harita yerel yorumlarını tercih et.',
    severity: "info",
  },
  {
    city: "rome",
    category: "practical",
    title: "Çeşme suyu güvenli",
    body: '"Nasoni" adlı Roma çeşme suyu içilebilir ve serbesttir; şişe satın almak gerekmiyor.',
    severity: "info",
  },
  {
    city: "rome",
    category: "practical",
    title: "Pazar günü müze saatleri",
    body: "Vatikan Müzesi Pazar günleri kapalıdır (son Pazar hariç ücretsiz). Çoğu devlet müzesi Pazartesi kapalıdır.",
    severity: "warning",
    sourceUrl: "https://www.museivaticani.va",
  },
  {
    city: "rome",
    category: "etiquette",
    title: "Çeşme / fontana kenarında yemek yasak",
    body: "Trevi Çeşmesi ve bazı tarihi fontan bölgelerinde yemek yemek cezalı; €250 ceza uygulanabilir.",
    severity: "warning",
  },
  {
    city: "rome",
    category: "food_culture",
    title: "Coperto (kuver bedeli)",
    body: 'Restoranlarda €1–3 arası "coperto" ekmek ve masa servisi için fişe yansır; haksız değil, normaldir.',
    severity: "info",
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns local context entries for a city. Normalises the city name to
 * lowercase for matching.
 */
export function getLocalContext(city: string): LocalContextEntry[] {
  const normalised = city.toLowerCase().trim();
  return LOCAL_CONTEXT_DATA.filter((e) => e.city === normalised);
}

/**
 * Converts a list of LocalContextEntry items into a compact block suitable
 * for injection into the system prompt.
 *
 * Critical items are promoted to the top regardless of insertion order.
 */
export function localContextToPromptSnippet(entries: LocalContextEntry[]): string {
  if (entries.length === 0) return "";

  // Sort: critical first, then warning, then info
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  const sorted = [...entries].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const lines: string[] = ["## Yerel Bağlam"];

  for (const e of sorted) {
    const prefix = e.severity === "critical" ? "🚨" : e.severity === "warning" ? "⚠️" : "ℹ️";
    const sourceNote = e.sourceUrl ? ` [kaynak: ${e.sourceUrl}]` : "";
    lines.push(`${prefix} [${e.category}] **${e.title}**: ${e.body}${sourceNote}`);
  }

  return lines.join("\n");
}
