// Breakpoint kümesi ve donmuş legacy @media koşulları (design D18, guard G13).
// Yeni kod yalnızca BREAKPOINTS değerlerini (ve .98 eşleniklerini) kullanır. Küme dışındaki
// bugünkü koşullar aşağıda DEĞERİYLE donar; liste yalnızca küçülebilir (normalizasyon yapılmaz,
// çünkü en yakın breakpoint'e taşımak yerleşimin kırıldığı genişliği kaydırır).
// Ölçüm (C2.1b, 2026-10-30): apps/web/app/**/*.css, yorumlar atılmış, @media başına; 64 koşul,
// 26 farklı küme dışı değer, 20 dosya. Anahtar apps/web/app'e göre yol, query boşlukları
// tek boşluğa indirilmiş ve küçük harfli @media metnidir. C4: u/u.css silindi (63 koşul, 19 dosya).
// C16: u/admin/admin.css yeniden yazıldı, ai-dashboard.css silindi (6 koşul ve 2 dosya düştü).
// C12: checkout.css ölü kurallar silindi (480px ve 900px düştü).

export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;

/** @media genişlik değerleri için izinli küme: breakpoint'ler ve max-width için .98 eşlenikleri. */
export const BREAKPOINT_VALUES: ReadonlyArray<number> = Object.values(BREAKPOINTS).flatMap((v) => [
  v,
  v - 0.02,
]);

export type LegacyBreakpoint = { query: string; count: number };

export const legacyBreakpoints: Record<string, ReadonlyArray<LegacyBreakpoint>> = {
  "travel-assistant/assistant.css": [
    { query: "(max-width: 600px)", count: 1 },
    { query: "(max-width: 767px)", count: 1 },
    { query: "(min-width: 1025px)", count: 1 },
    { query: "(min-width: 641px) and (max-width: 1024px)", count: 1 },
  ],
  "checkout/checkout.css": [{ query: "(max-width: 600px)", count: 1 }],
  "community/community.css": [
    { query: "(max-width: 1023px)", count: 1 },
    { query: "(max-width: 767px)", count: 3 },
  ],
  "components/trip/travel-planner.css": [
    { query: "(max-width: 820px)", count: 2 },
    { query: "(min-width: 769px) and (max-width: 1024px)", count: 1 },
  ],
  "maps/maps.css": [
    { query: "(max-width: 1279px)", count: 1 },
    { query: "(max-width: 767px)", count: 3 },
    { query: "(max-width: 820px)", count: 7 },
    { query: "(max-width: 900px)", count: 1 },
    { query: "(min-width: 821px)", count: 1 },
  ],
  "how-it-works/how-it-works.css": [{ query: "(min-width: 992px)", count: 1 }],
  "login/login.css": [{ query: "(max-width: 500px)", count: 1 }],
  "messages/messages.css": [
    { query: "(max-width: 1023px)", count: 1 },
    { query: "(min-width: 1024px) and (max-width: 1439px)", count: 1 },
    { query: "(min-width: 1440px)", count: 1 },
    { query: "(min-width: 1920px)", count: 1 },
  ],
  "operations.css": [{ query: "(max-width: 700px)", count: 1 }],
  "profile/profile.css": [{ query: "(max-width: 767px)", count: 2 }],
  "register/register.css": [{ query: "(max-width: 500px)", count: 1 }],
  "styles/tokens.css": [{ query: "(max-width: 767px)", count: 1 }],
  "styles.css": [
    { query: "(max-width: 1279px)", count: 1 },
    { query: "(max-width: 767px)", count: 3 },
  ],
};
