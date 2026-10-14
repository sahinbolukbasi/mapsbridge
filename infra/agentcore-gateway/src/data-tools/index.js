'use strict';

const FCDO_BASE = 'https://www.gov.uk/api/content/foreign-travel-advice';
const TRAVELPAYOUTS_BASE = 'https://api.travelpayouts.com/v1/prices/cheap';

// City name → main airport IATA code
const CITY_TO_IATA = {
  // Turkey
  istanbul: 'IST', ankara: 'ESB', izmir: 'ADB', antalya: 'AYT', bodrum: 'BJV',
  kapadokya: 'NAV', cappadocia: 'NAV', fethiye: 'DLM',
  // Western Europe
  paris: 'CDG', lyon: 'LYS', nice: 'NCE', bordeaux: 'BOD',
  roma: 'FCO', rome: 'FCO', milano: 'MXP', milan: 'MXP',
  florence: 'FLR', floransa: 'FLR', venedik: 'VCE', venice: 'VCE', napoli: 'NAP',
  barcelona: 'BCN', madrid: 'MAD', sevilla: 'SVQ', ibiza: 'IBZ',
  amsterdam: 'AMS',
  berlin: 'BER', munih: 'MUC', munich: 'MUC', hamburg: 'HAM', frankfurt: 'FRA',
  viyana: 'VIE', vienna: 'VIE',
  zurih: 'ZRH', zurich: 'ZRH', cenevre: 'GVA', geneva: 'GVA',
  bruksel: 'BRU', brussels: 'BRU',
  prag: 'PRG', prague: 'PRG',
  varsova: 'WAW', warsaw: 'WAW', krakow: 'KRK',
  budapeste: 'BUD', budapest: 'BUD',
  lizbon: 'LIS', lisbon: 'LIS', porto: 'OPO',
  atina: 'ATH', athens: 'ATH', santorini: 'JTR', mykonos: 'JMK',
  // UK
  londra: 'LHR', london: 'LHR', edinburgh: 'EDI', manchester: 'MAN',
  // Scandinavian
  kopenhag: 'CPH', copenhagen: 'CPH',
  stockholm: 'ARN', oslo: 'OSL', helsinki: 'HEL',
  // Eastern Europe
  dubrovnik: 'DBV', zagreb: 'ZAG', split: 'SPU',
  // Middle East & North Africa
  dubai: 'DXB', abu_dhabi: 'AUH',
  kahire: 'CAI', cairo: 'CAI', hurghada: 'HRG',
  marakesh: 'RAK', marrakesh: 'RAK', fes: 'FEZ',
  // Asia
  tokyo: 'NRT', osaka: 'KIX', kyoto: 'KIX',
  bangkok: 'BKK', phuket: 'HKT', chiang_mai: 'CNX',
  bali: 'DPS', jakarta: 'CGK',
  singapur: 'SIN', singapore: 'SIN',
  seoul: 'ICN',
  hong_kong: 'HKG',
  pekin: 'PEK', beijing: 'PEK', shanghai: 'PVG',
  yeni_delhi: 'DEL', new_delhi: 'DEL', mumbai: 'BOM', goa: 'GOI',
  // Americas
  new_york: 'JFK', miami: 'MIA', los_angeles: 'LAX', chicago: 'ORD', las_vegas: 'LAS',
  meksika_kenti: 'MEX', cancun: 'CUN',
  buenos_aires: 'EZE',
  rio: 'GIG', sao_paulo: 'GRU',
};

function cityToIata(destination) {
  const normalized = destination.toLowerCase()
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  // If it's already a valid IATA code (3 uppercase letters), return as-is
  if (/^[A-Z]{3}$/.test(destination)) return destination;
  return CITY_TO_IATA[normalized] || null;
}

// City → FCDO country slug mapping (most common destinations)
const CITY_TO_COUNTRY_SLUG = {
  // Turkey
  istanbul: 'turkey', ankara: 'turkey', izmir: 'turkey', antalya: 'turkey',
  kapadokya: 'turkey', cappadocia: 'turkey', bodrum: 'turkey', fethiye: 'turkey',
  // Western Europe
  paris: 'france', lyon: 'france', nice: 'france', bordeaux: 'france',
  roma: 'italy', rome: 'italy', milano: 'italy', florence: 'italy', venedik: 'italy', venice: 'italy', napoli: 'italy',
  barcelona: 'spain', madrid: 'spain', sevilla: 'spain', ibiza: 'spain',
  amsterdam: 'netherlands',
  berlin: 'germany', munih: 'germany', munich: 'germany', hamburg: 'germany', frankfurt: 'germany',
  viyana: 'austria', vienna: 'austria',
  zürih: 'switzerland', zurich: 'switzerland', cenevre: 'switzerland', geneva: 'switzerland',
  brüksel: 'belgium', brussels: 'belgium',
  prag: 'czech-republic', prague: 'czech-republic',
  varşova: 'poland', warsaw: 'poland', krakow: 'poland',
  budapeşte: 'hungary', budapest: 'hungary',
  lizbon: 'portugal', lisbon: 'portugal', porto: 'portugal',
  atina: 'greece', athens: 'greece', santorini: 'greece', mykonos: 'greece',
  // UK
  londra: 'uk', london: 'uk', edinburgh: 'uk', manchester: 'uk',
  // Scandinavian
  kopenhag: 'denmark', copenhagen: 'denmark',
  stockholm: 'sweden', oslo: 'norway', helsinki: 'finland',
  // Eastern Europe
  dubrovnik: 'croatia', zagreb: 'croatia', split: 'croatia',
  // Middle East & Africa
  dubai: 'united-arab-emirates', abu_dhabi: 'united-arab-emirates',
  kahire: 'egypt', cairo: 'egypt', hurghada: 'egypt',
  marakeş: 'morocco', marrakesh: 'morocco', fes: 'morocco',
  // Asia
  tokyo: 'japan', osaka: 'japan', kyoto: 'japan',
  bangkok: 'thailand', phuket: 'thailand', chiang_mai: 'thailand',
  bali: 'indonesia', jakarta: 'indonesia',
  singapur: 'singapore', singapore: 'singapore',
  seoul: 'south-korea',
  hong_kong: 'hong-kong',
  pekin: 'china', beijing: 'china', shanghai: 'china',
  yeni_delhi: 'india', new_delhi: 'india', mumbai: 'india', goa: 'india',
  // Americas
  new_york: 'usa', miami: 'usa', los_angeles: 'usa', chicago: 'usa', las_vegas: 'usa',
  meksika_kenti: 'mexico', cancun: 'mexico',
  buenos_aires: 'argentina',
  rio: 'brazil', sao_paulo: 'brazil',
};

function cityToCountrySlug(destination) {
  const normalized = destination.toLowerCase()
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return CITY_TO_COUNTRY_SLUG[normalized] || normalized;
}

function parseAdvisoryLevel(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('advise against all travel') || t.includes('against all travel to')) return 'avoid';
  if (t.includes('advise against all but essential') || t.includes('essential travel only') || t.includes('non-essential')) return 'avoid_non_essential';
  if (t.includes('some risk') || t.includes('heightened risk') || t.includes('exercise caution')) return 'some_risk';
  return 'normal';
}

const ADVISORY_LABELS = {
  normal: 'Normal seyahat tavsiyesi',
  some_risk: 'Dikkatli olun',
  avoid_non_essential: 'Zorunlu olmayan seyahatten kaçının',
  avoid: 'Seyahat önerilmiyor',
};

async function handleGetAdvisory(input) {
  const destination = (input.destination || '').trim();
  if (!destination) return { error: 'destination gerekli', unavailable: true };

  const slug = input.country_slug || cityToCountrySlug(destination);

  try {
    const res = await fetch(`${FCDO_BASE}/${slug}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return {
        country: destination, countrySlug: slug, level: 'normal', levelLabel: 'Bilgi alınamadı',
        summary: '', lastChecked: new Date().toISOString(), sourceUrl: `https://www.gov.uk/foreign-travel-advice/${slug}`,
        disclaimer: 'Güncel tavsiyeler için T.C. Dışişleri Bakanlığı sitesini kontrol ediniz.',
        unavailable: true,
      };
    }
    const data = await res.json();

    // FCDO "summary" part
    const parts = Array.isArray(data.details?.parts) ? data.details.parts : [];
    const summaryPart = parts.find(p => p.slug === 'summary' || p.slug === 'before-you-travel');
    const rawSummary = summaryPart?.body || data.details?.summary || data.description || '';
    // Strip HTML tags
    const summary = rawSummary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);

    const level = parseAdvisoryLevel(summary);

    // Latest change note
    const changeHistory = Array.isArray(data.details?.change_history) ? data.details.change_history : [];
    const latestChange = changeHistory.length > 0 ? changeHistory[changeHistory.length - 1] : null;

    return {
      country: data.title || destination,
      countrySlug: slug,
      level,
      levelLabel: ADVISORY_LABELS[level] || 'Normal',
      summary,
      lastChecked: new Date().toISOString(),
      ...(latestChange?.note ? { changeNote: latestChange.note } : {}),
      sourceUrl: `https://www.gov.uk/foreign-travel-advice/${slug}`,
      disclaimer: 'Planlama amaçlıdır. Yolculuk öncesi İngiltere Dışişleri Bakanlığı ve T.C. Dışişleri Bakanlığı kaynaklarını doğrulayınız. Bu bilgi giriş hakkı veya vize garantisi sağlamaz.',
    };
  } catch (err) {
    return {
      country: destination, countrySlug: slug, level: 'normal', levelLabel: 'Bilgi alınamadı',
      summary: '', lastChecked: new Date().toISOString(),
      sourceUrl: `https://www.gov.uk/foreign-travel-advice/${slug}`,
      disclaimer: 'Güncel tavsiyeler için T.C. Dışişleri Bakanlığı sitesini kontrol ediniz.',
      unavailable: true,
    };
  }
}

async function handleSearchFlights(input) {
  const rawDest = (input.destination || '').trim();
  const destIata = cityToIata(rawDest) || rawDest.toUpperCase();
  const destination = destIata;
  const origin = (input.origin || 'IST').trim().toUpperCase();
  const currency = (input.currency || 'EUR').trim().toUpperCase();
  const token = process.env.TRAVELPAYOUTS_TOKEN;

  if (!token || !destination || destination.length < 2) {
    return {
      destination: rawDest, deals: [], note: token ? 'Hedef havalimanı kodu bulunamadı.' : 'Uçuş fiyatı servisi yapılandırılmadı.',
      source: 'unavailable', checkedAt: new Date().toISOString(),
    };
  }

  try {
    const params = new URLSearchParams({ origin, destination, currency, limit: '5', token });
    const res = await fetch(`${TRAVELPAYOUTS_BASE}?${params}`, { signal: AbortSignal.timeout(4000) });

    if (!res.ok) {
      return { destination: rawDest, deals: [], note: 'Uçuş fiyatları şu an alınamıyor.', source: 'unavailable', checkedAt: new Date().toISOString() };
    }

    const data = await res.json();
    if (!data.success || !data.data) {
      return { destination: rawDest, deals: [], note: 'Sonuç bulunamadı.', source: 'unavailable', checkedAt: new Date().toISOString() };
    }

    const deals = [];
    const now = Date.now();
    for (const [orig, months] of Object.entries(data.data)) {
      for (const [month, info] of Object.entries(months)) {
        if (info.expires_at && new Date(info.expires_at).getTime() < now) continue;
        const marker = process.env.TRAVELPAYOUTS_MARKER || '';
        deals.push({
          origin: orig,
          destination,
          price: info.price,
          currency,
          departureMonth: month,
          affiliateLink: `https://www.aviasales.com/search/${orig}${month.replace('-', '')}${destination}1?marker=${marker}`,
          expiresAt: info.expires_at || new Date(now + 48 * 3600 * 1000).toISOString(),
        });
      }
    }
    deals.sort((a, b) => a.price - b.price);
    const cheapest = deals[0];
    const marker = process.env.TRAVELPAYOUTS_MARKER || '';

    return {
      destination: rawDest,
      deals: deals.slice(0, 3),
      cheapestPrice: cheapest?.price,
      cheapestCurrency: cheapest ? currency : undefined,
      note: cheapest
        ? `${cheapest.origin}'dan ${rawDest}'a ${currency} ${cheapest.price}'dan itibaren (${cheapest.departureMonth})`
        : 'Bu rota için önbelleğe alınmış fiyat bulunamadı.',
      source: 'travelpayouts_cache',
      checkedAt: new Date().toISOString(),
      affiliateLinkBase: `https://www.aviasales.com/search/${origin}${destination}1?marker=${marker}`,
    };
  } catch (err) {
    return { destination: rawDest, deals: [], note: 'Uçuş fiyatları alınırken hata oluştu.', source: 'unavailable', checkedAt: new Date().toISOString() };
  }
}

exports.handler = async (event) => {
  const toolName = event.toolName;
  const toolUseId = event.toolUseId || 'unknown';
  const input = event.input || {};

  try {
    let result;
    if (toolName === 'search_flights') {
      result = await handleSearchFlights(input);
    } else if (toolName === 'get_advisory') {
      result = await handleGetAdvisory(input);
    } else {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    return {
      toolUseId,
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  } catch (err) {
    console.error('[data-tools] Error:', err?.message);
    return {
      toolUseId,
      isError: true,
      content: [{ type: 'text', text: err instanceof Error ? err.message : 'Tool execution failed' }],
    };
  }
};
