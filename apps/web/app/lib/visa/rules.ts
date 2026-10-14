/**
 * Static entry rules — Turkish passport holders (Türk vatandaşı) travelling to
 * the 3 initial MapsBridge destinations.
 *
 * IMPORTANT: These are reference snapshots, NOT legal advice.
 * Rules must be re-verified before each release. See §9.2.
 * Record format: all §9.2 mandatory fields populated.
 *
 * Verified against:
 *  - Türkiye Dışişleri Bakanlığı — https://www.mfa.gov.tr (retrieval: 2026-10)
 *  - IATA Timatic proxy (via AgentCore advisory tool)
 */

import type { EntryRule, EntryRuleQueryResult } from "./types";

export const DISCLAIMER_TR =
  "Bu bilgi yalnızca başlangıç referans amaçlıdır. " +
  "Giriş koşulları kısa sürede değişebilir. " +
  "Seyahat öncesinde mutlaka Türkiye Dışişleri Bakanlığı (mfa.gov.tr), " +
  "hedef ülkenin büyükelçiliği veya resmi konsolosluğu ile iletişime geçin. " +
  "MapsBridge bu bilgilerin doğruluğundan sorumlu tutulamaz.";

const RULES: EntryRule[] = [
  // ── Istanbul (Turkey) — domestic travel ────────────────────────────────────
  {
    id: "tr-tr-domestic",
    destinationCountry: "Turkey",
    destinationIso2: "TR",
    passportCountry: "Turkey",
    passportIso2: "TR",
    requirementLevel: "not_required",
    notes: [
      "Türk vatandaşları için yurt içi seyahat — pasaport veya T.C. kimlik kartı yeterli.",
      "Seyahat belgesi olarak nüfus cüzdanı geçerlidir.",
    ],
    sourceName: "T.C. Dışişleri Bakanlığı",
    sourceUrl: "https://www.mfa.gov.tr",
    retrievedAt: "2026-10-01",
    disclaimer: DISCLAIMER_TR,
  },

  // ── Barcelona / Spain (Schengen) — Turkish passport ─────────────────────────
  {
    id: "tr-es-schengen",
    destinationCountry: "Spain",
    destinationIso2: "ES",
    passportCountry: "Turkey",
    passportIso2: "TR",
    requirementLevel: "visa_required",
    maxStayDays: 90,
    notes: [
      "Türk pasaport sahipleri Schengen vizesi almak zorundadır.",
      "Kısa dönem ziyaret (turizm/iş) için C tipi Schengen vizesi gereklidir.",
      "Maksimum 90 gün / her 180 günde bir.",
      "ETIAS (Avrupa Seyahat Bilgi ve Yetkilendirme Sistemi) uygulamaya girdiğinde ek gereksinim oluşabilir — resmi kaynakları takip edin.",
      "Başvuru: İspanya Büyükelçiliği veya Konsolosluğu'na seyahatten en az 15 gün önce.",
    ],
    sourceName: "T.C. Dışişleri Bakanlığı / İspanya Dışişleri Bakanlığı",
    sourceUrl: "https://www.mfa.gov.tr/vizeler.tr.mfa",
    retrievedAt: "2026-10-01",
    disclaimer: DISCLAIMER_TR,
  },

  // ── Paris / France (Schengen) — Turkish passport ─────────────────────────────
  {
    id: "tr-fr-schengen",
    destinationCountry: "France",
    destinationIso2: "FR",
    passportCountry: "Turkey",
    passportIso2: "TR",
    requirementLevel: "visa_required",
    maxStayDays: 90,
    notes: [
      "Türk pasaport sahipleri Schengen vizesi almak zorundadır.",
      "Kısa dönem ziyaret (turizm/iş) için C tipi Schengen vizesi gereklidir.",
      "Maksimum 90 gün / her 180 günde bir.",
      "Başvuru: Fransa Konsolosluğu'na veya yetkili vize merkezine (VFS Global) seyahatten en az 15 iş günü önce.",
      "ETIAS uygulamaya girdiğinde ek gereksinim oluşabilir — resmi kaynakları takip edin.",
    ],
    sourceName: "T.C. Dışişleri Bakanlığı / France-Visas",
    sourceUrl: "https://france-visas.gouv.fr",
    retrievedAt: "2026-10-01",
    disclaimer: DISCLAIMER_TR,
  },

  // ── Rome / Italy (Schengen) — Turkish passport ──────────────────────────────
  {
    id: "tr-it-schengen",
    destinationCountry: "Italy",
    destinationIso2: "IT",
    passportCountry: "Turkey",
    passportIso2: "TR",
    requirementLevel: "visa_required",
    maxStayDays: 90,
    notes: [
      "Türk pasaport sahipleri Schengen vizesi almak zorundadır.",
      "Kısa dönem ziyaret (turizm/iş) için C tipi Schengen vizesi gereklidir.",
      "Maksimum 90 gün / her 180 günde bir.",
      "Başvuru: İtalya Büyükelçiliği veya Konsolosluğu'na ya da yetkili vize merkezine (VFS Global / BLS International) seyahatten en az 15 iş günü önce.",
      "ETIAS uygulamaya girdiğinde ek gereksinim oluşabilir — resmi kaynakları takip edin.",
    ],
    sourceName: "T.C. Dışişleri Bakanlığı / Farnesina (İtalya Dışişleri Bakanlığı)",
    sourceUrl: "https://vistoperitalia.esteri.it",
    retrievedAt: "2026-10-01",
    disclaimer: DISCLAIMER_TR,
  },

  // ── Amsterdam / Netherlands (Schengen) — Turkish passport ────────────────────
  {
    id: "tr-nl-schengen",
    destinationCountry: "Netherlands",
    destinationIso2: "NL",
    passportCountry: "Turkey",
    passportIso2: "TR",
    requirementLevel: "visa_required",
    maxStayDays: 90,
    notes: [
      "Türk pasaport sahipleri Schengen vizesi almak zorundadır.",
      "Kısa dönem ziyaret (turizm/iş) için C tipi Schengen vizesi gereklidir.",
      "Maksimum 90 gün / her 180 günde bir.",
      "Başvuru: Hollanda Büyükelçiliği veya yetkili vize merkezi (VFS Global) aracılığıyla seyahatten en az 15 iş günü önce.",
      "ETIAS uygulamaya girdiğinde ek gereksinim oluşabilir — resmi kaynakları takip edin.",
    ],
    sourceName: "T.C. Dışişleri Bakanlığı / Hollanda Dışişleri ve Savunma Bakanlığı",
    sourceUrl: "https://www.government.nl/topics/visa-for-the-netherlands",
    retrievedAt: "2026-10-01",
    disclaimer: DISCLAIMER_TR,
  },

  // ── London / United Kingdom — Turkish passport (post-Brexit) ─────────────────
  {
    id: "tr-gb-visa",
    destinationCountry: "United Kingdom",
    destinationIso2: "GB",
    passportCountry: "Turkey",
    passportIso2: "TR",
    requirementLevel: "visa_required",
    maxStayDays: 180,
    notes: [
      "Brexit sonrasında Türk pasaport sahipleri Birleşik Krallık vizesi almak zorundadır.",
      "Kısa ziyaret (Standard Visitor Visa) için başvuru UK Visas & Immigration (UKVI) üzerinden yapılır.",
      "Başvuru çevrimiçi olarak yapılabilir: https://www.gov.uk/standard-visitor-visa",
      "Seyahatten önce vizeyi başvurun; biyometrik randevu gerekebilir.",
      "ETA (Elektronik Seyahat Yetkisi) planları henüz Türk vatandaşlarını kapsamamaktadır; resmi kaynakları takip edin.",
    ],
    sourceName: "UK Home Office / UKVI",
    sourceUrl: "https://www.gov.uk/standard-visitor-visa",
    retrievedAt: "2026-10-01",
    disclaimer: DISCLAIMER_TR,
  },

  // ── New York / USA — Turkish passport (ESTA) ─────────────────────────────────
  {
    id: "tr-us-esta",
    destinationCountry: "United States",
    destinationIso2: "US",
    passportCountry: "Turkey",
    passportIso2: "TR",
    requirementLevel: "visa_required",
    maxStayDays: 0,
    notes: [
      "Türk vatandaşları ABD Vizesi Muafiyet Programı'na (Visa Waiver Program / ESTA) dahil DEĞİLDİR.",
      "Turistik veya iş amaçlı seyahat için B-1/B-2 vizesi gereklidir.",
      "Başvuru: ABD Büyükelçiliği veya Konsolosluğu — https://tr.usembassy.gov",
      "Mülakat randevusu gerekebilir; maksimum kalış süresi giriş görevlisi tarafından belirlenir.",
      "Kesin koşullar için lütfen ABD Büyükelçiliği resmi sayfasını ziyaret edin.",
    ],
    sourceName: "ABD Büyükelçiliği Ankara / U.S. Department of State",
    sourceUrl: "https://tr.usembassy.gov/visas/nonimmigrant-visas/",
    retrievedAt: "2026-10-01",
    disclaimer: DISCLAIMER_TR,
  },

  // ── Tokyo / Japan — Turkish passport ─────────────────────────────────────────
  {
    id: "tr-jp-visa",
    destinationCountry: "Japan",
    destinationIso2: "JP",
    passportCountry: "Turkey",
    passportIso2: "TR",
    requirementLevel: "visa_required",
    maxStayDays: 0,
    notes: [
      "Türk vatandaşları Japonya için önceden vize almak zorundadır.",
      "Turistik amaçlı kısa süreli ziyaret için Japonya Büyükelçiliği'ne başvurulması gerekir.",
      "Japonya'nın Türk vatandaşlarına visa-free veya e-vize imkânı tanıyan ikili bir anlaşması bulunmamaktadır (2026 itibarıyla).",
      "Başvuru: Japonya Büyükelçiliği Ankara — https://www.tr.emb-japan.go.jp",
      "Başvuru belgelerini seyahatten en az 2-4 hafta önce tamamlayın.",
    ],
    sourceName: "Japonya Büyükelçiliği Ankara / Ministry of Foreign Affairs of Japan",
    sourceUrl: "https://www.mofa.go.jp/j_info/visit/visa/index.html",
    retrievedAt: "2026-10-01",
    disclaimer: DISCLAIMER_TR,
  },
];

const RULE_INDEX = new Map<string, EntryRule>(RULES.map(r => [r.id, r]));

function ruleKey(passportIso2: string, destinationIso2: string): string {
  return `${passportIso2.toLowerCase()}-${destinationIso2.toLowerCase()}`;
}

// Build lookup index by (passport, destination)
const LOOKUP = new Map<string, EntryRule>();
for (const rule of RULES) {
  LOOKUP.set(ruleKey(rule.passportIso2, rule.destinationIso2), rule);
}

// City → ISO2 map for convenience
const CITY_ISO2: Record<string, string> = {
  istanbul: "TR",
  turkey: "TR",
  barcelona: "ES",
  spain: "ES",
  paris: "FR",
  france: "FR",
  rome: "IT",
  roma: "IT",
  italy: "IT",
  amsterdam: "NL",
  netherlands: "NL",
  hollanda: "NL",
  london: "GB",
  "united kingdom": "GB",
  uk: "GB",
  "new york": "US",
  "newyork": "US",
  usa: "US",
  "united states": "US",
  tokyo: "JP",
  japan: "JP",
  japonya: "JP",
};

export function getEntryRule(
  destinationId: string,
  passportIso2 = "TR"
): EntryRuleQueryResult {
  const destIso2 = CITY_ISO2[destinationId.toLowerCase().replace(/\s+/g, "")];
  if (!destIso2) {
    return {
      rule: null,
      canSurface: false,
      fallbackUrl: "https://www.mfa.gov.tr/vizeler.tr.mfa",
    };
  }

  const rule = LOOKUP.get(ruleKey(passportIso2, destIso2)) ?? null;
  if (!rule) {
    return {
      rule: null,
      canSurface: false,
      fallbackUrl: "https://www.mfa.gov.tr/vizeler.tr.mfa",
    };
  }

  // §9.2: only surface if all mandatory fields are present
  const canSurface =
    rule.sourceName.trim().length > 0 &&
    rule.sourceUrl.trim().length > 0 &&
    rule.retrievedAt.trim().length > 0 &&
    rule.disclaimer.trim().length > 0;

  return { rule, canSurface };
}

/** Get all rules for a given passport country (for checklist / prepare phase). */
export function getEntryRulesForPassport(passportIso2 = "TR"): EntryRule[] {
  return RULES.filter(r => r.passportIso2.toUpperCase() === passportIso2.toUpperCase());
}

export { RULE_INDEX };
