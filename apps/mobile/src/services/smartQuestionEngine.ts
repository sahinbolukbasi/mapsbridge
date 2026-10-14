/**
 * @mapsbridge/service-ai-assistant
 * Smart Travel Question Engine (Dinamik Soru Motoru)
 *
 * Kullanıcıyı 20 soruyla boğmak yerine, diyalog akışında yalnızca en kritik
 * eksik parametreyi belirleyip doğal ve samimi bir soru ile 2-3 hızlı seçenek sunar.
 *
 * Akış: destination → duration → style → pace → budget → food → companions → mobility
 * Tüm parametreler toplandıktan sonra SmartQuestionEngine null döner → rota oluşturulabilir.
 */

export interface QuestionContext {
  destination?: string;
  durationDays?: number;
  datesMentioned?: boolean;
  budgetSpecified?: boolean;
  styleSpecified?: boolean;
  foodSpecified?: boolean;
  mobilitySpecified?: boolean;
  paceSpecified?: boolean;
  companionsSpecified?: boolean;
  accommodationSpecified?: boolean;
}

export interface QuickOption {
  label: string;
  prompt: string;
}

export interface GeneratedQuestion {
  question: string;
  category:
    | "destination"
    | "duration"
    | "style"
    | "budget"
    | "pace"
    | "food"
    | "mobility"
    | "companions"
    | "accommodation";
  quickOptions: QuickOption[];
  hint?: string; // ekranda küçük açıklama metni
}

export class SmartQuestionEngine {
  /**
   * Evaluates missing context and formulates the single most relevant next question.
   * Returns null when all critical parameters are collected → ready to generate route.
   */
  public static formulateNextInquiry(
    context: QuestionContext,
    currentCity?: string
  ): GeneratedQuestion | null {
    const city = context.destination || currentCity;

    // ── 1. Hedef şehir / ülke eksikse ────────────────────────────────────────
    if (!city) {
      return {
        question: "Hangi şehre veya ülkeye seyahat etmeyi planlıyorsunuz? 🌍",
        category: "destination",
        hint: "Şehir, ülke veya bölge adı yazabilirsiniz.",
        quickOptions: [
          { label: "🏛️ Roma, İtalya", prompt: "Roma için gezi planlamak istiyorum." },
          { label: "🗼 Paris, Fransa", prompt: "Paris için gezi planlamak istiyorum." },
          { label: "🌸 Tokyo, Japonya", prompt: "Tokyo için gezi planlamak istiyorum." },
          { label: "🕌 İstanbul", prompt: "İstanbul için gezi planlamak istiyorum." },
        ],
      };
    }

    // ── 2. Gün / Süre eksikse ────────────────────────────────────────────────
    if (!context.durationDays) {
      return {
        question: `${city} seyahatiniz kaç gün sürecek? 📅`,
        category: "duration",
        hint: "Gün sayısı rotanın derinliğini belirler.",
        quickOptions: [
          { label: "⚡ 1 Gün (Hızlı Keşif)", prompt: `${city} için 1 günlük yoğun plan hazırla.` },
          { label: "🗺️ 2-3 Gün (Klasik)", prompt: `${city} için 3 günlük plan hazırla.` },
          { label: "✨ 4-5 Gün (Kapsamlı)", prompt: `${city} için 5 günlük plan hazırla.` },
          { label: "🌟 1 Hafta+", prompt: `${city} için 7 günlük detaylı plan hazırla.` },
        ],
      };
    }

    // ── 3. Gezi tarzı eksikse ─────────────────────────────────────────────────
    if (!context.styleSpecified) {
      return {
        question: `${city} gezinizi nasıl şekillendirelim? 🎯`,
        category: "style",
        hint: "Birden fazla seçenek yazabilirsiniz, kombine de olur.",
        quickOptions: [
          { label: "🏛️ Tarih & Kültür", prompt: `${city} tarihi yerler, müzeler ve mimari odaklı olsun.` },
          { label: "🍕 Gastronomi & Kahve", prompt: `${city} yerel lezzetler, sokak yemekleri ve özel kahveciler ağırlıklı olsun.` },
          { label: "🌿 Gizli Köşeler & Doğa", prompt: `${city} turist kalabalığından uzak gizli noktalar ve doğal alanlar olsun.` },
          { label: "🛍️ Alışveriş & Modern", prompt: `${city} alışveriş, modern mimari ve canlı mahalleler olsun.` },
        ],
      };
    }

    // ── 4. Bütçe eksikse ─────────────────────────────────────────────────────
    if (!context.budgetSpecified) {
      return {
        question: `${city} için günlük bütçeniz ne kadar? 💳`,
        category: "budget",
        hint: "Giriş ücretleri, yemek ve ulaşım dahil kişi başı tahmini.",
        quickOptions: [
          { label: "💚 Ekonomik (kişi/gün €30-60)", prompt: `${city} için bütçe dostu, ücretsiz ve uygun fiyatlı yerler öner.` },
          { label: "💛 Orta Segment (€60-120)", prompt: `${city} için orta bütçeli kaliteli deneyimler planla.` },
          { label: "💎 Premium (€120+)", prompt: `${city} için konforlu, özel deneyimli ve premium rotalar oluştur.` },
        ],
      };
    }

    // ── 5. Günlük tempo eksikse ───────────────────────────────────────────────
    if (!context.paceSpecified) {
      return {
        question: "Günlük gezi temposunu nasıl ayarlayalım? 🚶",
        category: "pace",
        hint: "Bu tercih günde kaç durak önereceğimizi belirler.",
        quickOptions: [
          { label: "🔥 Yoğun (5-7 durak/gün)", prompt: "Günde 10-15 bin adım yürüyebilirim, çok yoğun plan olsun." },
          { label: "⚖️ Dengeli (3-4 durak/gün)", prompt: "Orta tempolu, kafe molalı dengeli bir plan olsun." },
          { label: "☕ Sakin (2-3 durak/gün)", prompt: "Rahat, uzun duraklar ve bol mola içeren sakin plan olsun." },
        ],
      };
    }

    // ── 6. Yemek tercihi eksikse ─────────────────────────────────────────────
    if (!context.foodSpecified) {
      return {
        question: "Yemek konusunda özel bir tercihiniz var mı? 🍽️",
        category: "food",
        hint: "Diyet kısıtlamalarınıza göre öneriler filtreleriz.",
        quickOptions: [
          { label: "🥩 Fark etmez, her şey", prompt: "Yemek konusunda kısıtımım yok, yerel spesiyaliteleri öner." },
          { label: "🥗 Vejetaryen / Vegan", prompt: "Vejetaryen veya vegan dostu restoranlar öner." },
          { label: "🕌 Helal Ürünler", prompt: "Helal onaylı veya helal dostu mekanlar öner." },
          { label: "🦐 Deniz ürünsüz", prompt: "Deniz ürünü ve balık içermeyen öneriler sun." },
        ],
      };
    }

    // ── 7. Kimlerle seyahat eksikse ───────────────────────────────────────────
    if (!context.companionsSpecified) {
      return {
        question: "Bu seyahatte kimlerle birlikte olacaksınız? 👥",
        category: "companions",
        hint: "Gruba göre uygun mekanlar ve tempoyu ayarlarız.",
        quickOptions: [
          { label: "🧳 Yalnız Gezgin", prompt: "Yalnız seyahat ediyorum, güvenli ve sosyalleşme fırsatlı yerler öner." },
          { label: "💑 Çift", prompt: "Partnerimle seyahat ediyoruz, romantik ve özel anlar içeren rota olsun." },
          { label: "👨‍👩‍👧 Aile & Çocuk", prompt: "Aile olarak gidiyoruz, çocuk dostu ve eğlenceli mekanlar önce gelsin." },
          { label: "👫 Arkadaş Grubu", prompt: "Arkadaş grubuyla gidiyoruz, sosyal ve eğlenceli rotalar olsun." },
        ],
      };
    }

    // Tüm kritik parametreler mevcut → rota oluşturulabilir
    return null;
  }

  /**
   * Detects if a user message provides the answer to a given question category.
   * Used to update QuestionContext from free-text user input.
   */
  public static extractContextFromMessage(
    message: string,
    currentContext: QuestionContext
  ): Partial<QuestionContext> {
    const norm = (message || "").toLocaleLowerCase("tr");
    const updates: Partial<QuestionContext> = {};

    // Gün tespiti
    const dayMatch = norm.match(/(\d+)\s*gün/i);
    if (dayMatch && !currentContext.durationDays) {
      updates.durationDays = parseInt(dayMatch[1], 10);
    }

    // Bütçe tespiti
    if (/ekonomik|ucuz|bütçe|para\s*sız|uygun\s*fiyat/iu.test(norm)) {
      updates.budgetSpecified = true;
    } else if (/orta|normal\s*bütçe|makul/iu.test(norm)) {
      updates.budgetSpecified = true;
    } else if (/lüks|premium|pahal|konfor|birinci\s*sınıf/iu.test(norm)) {
      updates.budgetSpecified = true;
    }

    // Tempo tespiti
    if (/yoğun|hızlı|çok\s*yer|maksimum/iu.test(norm)) {
      updates.paceSpecified = true;
    } else if (/sakin|rahat|yavaş|mola/iu.test(norm)) {
      updates.paceSpecified = true;
    } else if (/dengeli|orta\s*tempo/iu.test(norm)) {
      updates.paceSpecified = true;
    }

    // Stil tespiti
    if (/tarih|müze|kültür|mimari|antik|sanat/iu.test(norm)) {
      updates.styleSpecified = true;
    } else if (/yemek|lezzet|gastro|kafe|restoran|mutfak/iu.test(norm)) {
      updates.styleSpecified = true;
    } else if (/doğa|gizli|yerel|kalabalık\s*sız/iu.test(norm)) {
      updates.styleSpecified = true;
    } else if (/alışveriş|modern|trend/iu.test(norm)) {
      updates.styleSpecified = true;
    }

    // Yemek tercihi tespiti
    if (/vegan|vejetaryen|helal|deniz\s*ürün|balık\s*sız|fark\s*etmez/iu.test(norm)) {
      updates.foodSpecified = true;
    }

    // Birlikte seyahat tespiti
    if (/yalnız|tek\s*başıma|solo/iu.test(norm)) {
      updates.companionsSpecified = true;
    } else if (/çift|partnerim|eşim|sevgilim/iu.test(norm)) {
      updates.companionsSpecified = true;
    } else if (/aile|çocuk|bebek|ebeveyn/iu.test(norm)) {
      updates.companionsSpecified = true;
    } else if (/arkadaş|grup|ekip/iu.test(norm)) {
      updates.companionsSpecified = true;
    }

    // Hareket kabiliyeti
    if (/tekerlekli|engelli|yürüyemem|az\s*yürü/iu.test(norm)) {
      updates.mobilitySpecified = true;
    }

    return updates;
  }

  /**
   * Checks if the context is complete enough to generate a route.
   * Minimum required: destination + duration + style
   * Recommended: also budget or pace
   */
  public static isReadyToGenerate(context: QuestionContext): boolean {
    return !!(
      context.destination &&
      context.durationDays &&
      context.styleSpecified
    );
  }

  /**
   * Builds a structured prompt summary from the collected context.
   * This is injected into the AI prompt to ensure the model has all parameters.
   */
  public static buildContextSummary(context: QuestionContext): string {
    const parts: string[] = [];
    if (context.destination) parts.push(`Şehir: ${context.destination}`);
    if (context.durationDays) parts.push(`Süre: ${context.durationDays} gün`);
    if (context.styleSpecified) parts.push("Stil: belirtildi");
    if (context.budgetSpecified) parts.push("Bütçe: belirtildi");
    if (context.paceSpecified) parts.push("Tempo: belirtildi");
    if (context.foodSpecified) parts.push("Yemek tercihi: belirtildi");
    if (context.companionsSpecified) parts.push("Seyahat grubu: belirtildi");
    return parts.join(" | ");
  }
}
