// Route registry (design §4.2, §5): kanonik rotaların ve eş-anlamlı (LEGACY) URL'lerin TEK veri
// kaynağı. PageHeader başlığı, <title>/canonical/hreflang (routeMetadata), dil anahtarı
// (getAlternatePath), header varyantı (SiteChrome) ve guard G4/G9 buradan okur.
// Bağımlılıksızdır (ui-audit Node type-stripping ile de yükler); erasable TS sözdizimi kullanılır.

export type PageLayout = "content" | "reading" | "form" | "landing" | "app" | "sidebar";
/** Header varyantı (G19): sayfa CSS'i chrome'u override etmez. */
export type ChromeVariant = "default" | "wide" | "wide-compact";
export type RouteLocale = "tr" | "en";
export type RoutePath = `/${string}`;

export interface CanonicalRoute {
  /** trailing slash'lı */
  path: RoutePath;
  /** app/ altındaki page.tsx yolu (apps/web'e göre; guard G4) */
  file: string;
  layout: PageLayout;
  /** PageHeader ve <title> için tek kaynak */
  title: Readonly<Record<RouteLocale, string>>;
  /** sitemap:true ise zorunlu (routeMetadata + test); meta description */
  description?: Readonly<Record<RouteLocale, string>>;
  /** generate-seo.cjs PAGES ve public/sitemap.xml ile eşit olmalı (AC-13) */
  sitemap: boolean;
  /** "/maps/" için "index" bilinçli değerdir (GSC §3.6 sapması, F-16) */
  robots: "index" | "noindex";
  /** yalnızca gerçek dil varyantı ("/" ↔ "/en/") */
  alternate?: RoutePath;
  /** CloudFront protectedPrefixes ile bilgi amaçlı eşleşme */
  protected?: boolean;
  /** dinamik segmentli dosyalar: üretilen path'ler (generateStaticParams ile eşit, AC-14) */
  staticParams?: readonly RoutePath[];
  /** header varyantı (varsayılan "default") */
  chrome?: ChromeVariant;
}

const t = (tr: string, en: string): Readonly<Record<RouteLocale, string>> => ({ tr, en });

export const CANONICAL_ROUTES: readonly CanonicalRoute[] = [
  {
    path: "/",
    file: "app/page.tsx",
    layout: "landing",
    title: t("Seyahatini planla, birlikte keşfet", "Plan your journey, discover together"),
    description: t(
      "AI seyahat asistanı, kişisel haritalar ve gezgin rehberleriyle yolculuğunu planla. Duraklarını kaydet ve deneyimlerini paylaş.",
      "Plan a trip with your AI travel assistant, save places on your map and discover guides from fellow travelers.",
    ),
    // D15: "/" self-canonical; sitemap yalnızca "/en/" içerir (GSC DECISION HIGH-1).
    sitemap: false,
    robots: "index",
    alternate: "/en/",
  },
  {
    path: "/en/",
    file: "app/en/page.tsx",
    layout: "landing",
    title: t("Seyahatini planla, birlikte keşfet", "Plan your journey, discover together"),
    description: t(
      "AI seyahat asistanı, kişisel haritalar ve gezgin rehberleriyle yolculuğunu planla. Duraklarını kaydet ve deneyimlerini paylaş.",
      "Plan a trip with your AI travel assistant, save places on your map and discover guides from fellow travelers.",
    ),
    sitemap: true,
    robots: "index",
    alternate: "/",
  },
  {
    path: "/about/",
    file: "app/about/page.tsx",
    layout: "reading",
    title: t("Hakkımızda", "About us"),
    description: t(
      "MapsBridge: yapay zeka destekli seyahat planlama ve güvenli konum paylaşımı platformu. Misyonumuz, seyahatin kendisini kolaylaştırmak.",
      "MapsBridge: an AI-assisted travel planning and secure location sharing platform. Our mission is to make the journey itself easier.",
    ),
    sitemap: true,
    robots: "index",
  },
  {
    path: "/contact/",
    file: "app/contact/page.tsx",
    layout: "reading",
    title: t("İletişim", "Contact"),
    description: t(
      "MapsBridge ile iletişime geçin. Soru, öneri ve destek talepleriniz için bize ulaşın.",
      "Get in touch with MapsBridge for questions, suggestions and support requests.",
    ),
    sitemap: true,
    robots: "index",
  },
  {
    path: "/cookies/",
    file: "app/cookies/page.tsx",
    layout: "reading",
    title: t("Çerez politikası", "Cookie policy"),
    description: t(
      "MapsBridge çerez ve depolama tercihleri hakkında bilgi.",
      "Information about MapsBridge cookie and storage preferences.",
    ),
    sitemap: true,
    robots: "index",
  },
  {
    path: "/privacy/",
    file: "app/privacy/page.tsx",
    layout: "reading",
    title: t("Gizlilik politikası", "Privacy policy"),
    description: t(
      "MapsBridge gizlilik politikası ve kişisel verilerin kullanımı.",
      "MapsBridge privacy policy and how personal data is used.",
    ),
    sitemap: true,
    robots: "index",
  },
  {
    path: "/terms/",
    file: "app/terms/page.tsx",
    layout: "reading",
    title: t("Kullanım koşulları", "Terms of use"),
    description: t(
      "MapsBridge hizmetlerinin kullanım koşulları.",
      "Terms of use for MapsBridge services.",
    ),
    sitemap: true,
    robots: "index",
  },
  {
    path: "/support/",
    file: "app/support/page.tsx",
    layout: "content",
    title: t("Yardım ve destek", "Help and support"),
    description: t(
      "Hesap, rota veya ödeme konularında destek ekibimizle iletişime geçin.",
      "Contact our support team about your account, routes or payments.",
    ),
    sitemap: true,
    robots: "index",
  },
  {
    path: "/how-it-works/",
    file: "app/how-it-works/page.tsx",
    layout: "landing",
    title: t("Nasıl Çalışır? · MapsBridge Akıllı Seyahat Kılavuzu", "How it works"),
    description: t(
      "MapsBridge ile seyahat planlama, yapay zeka optimizasyonu, canlı harita masası ve 6 haneli kodla paylaşım nasıl çalışır? Adım adım keşfedin.",
      "How travel planning, AI optimization, the live map desk and 6-digit code sharing work in MapsBridge, step by step.",
    ),
    sitemap: true,
    robots: "index",
  },
  {
    path: "/mobile-apps/",
    file: "app/mobile-apps/page.tsx",
    layout: "landing",
    title: t("Mobil uygulamalar", "Mobile apps"),
    description: t(
      "Web Harita Masasında hazırladığınız rotalar, anında iPhone ve Android cihazınıza senkronize oluyor. Çevrimdışı navigasyon, saha modu ve canlı durak rehberliği ile keşfe hazır olun.",
      "Routes you prepare on the web map desk sync instantly to your iPhone and Android device, with offline navigation, field mode and live stop guidance.",
    ),
    sitemap: true,
    robots: "index",
  },
  {
    path: "/travel-assistant/",
    file: "app/travel-assistant/page.tsx",
    layout: "app",
    title: t("Seyahat asistanı", "Travel assistant"),
    description: t(
      "Yapay zeka asistanı bütçenize, ilgi alanlarınıza, tempo tercihinize ve seyahat tarihinize göre saniyeler içinde optimize edilmiş rota, durak saatleri ve canlı rota paylaşım bağlantısını üretir.",
      "The AI assistant builds an optimized route, stop times and a live route sharing link in seconds, based on your budget, interests, pace and travel dates.",
    ),
    sitemap: true,
    robots: "index",
  },
  {
    path: "/maps/",
    file: "app/maps/page.tsx",
    layout: "app",
    title: t("Harita masası", "Map desk"),
    description: t(
      "Büyük ekranda mimari hassasiyetle çoklu gün katmanları, akıllı durak havuzu ve topografik irtifa analizleriyle seyahatinizi planlayın.",
      "Plan your trip on a large screen with multi-day layers, a smart stop pool and topographic elevation analysis.",
    ),
    sitemap: true,
    // Bilinçli değer: bugünkü kod index + sitemap'te; GSC §3.6 noindex öneriyordu (F-16).
    robots: "index",
    protected: true,
  },
  {
    path: "/welcome/",
    file: "app/welcome/page.tsx",
    layout: "landing",
    title: t("Hoş geldiniz", "Welcome"),
    description: t(
      "Devam etmek için hesabınıza giriş yapın veya yeni bir hesap oluşturun.",
      "Sign in to your account or create a new one to continue.",
    ),
    sitemap: true,
    robots: "index",
  },
  {
    path: "/community/",
    file: "app/community/page.tsx",
    layout: "sidebar",
    title: t("Gezgin rehberleri ve seyahat topluluğu", "Traveler guides and community"),
    description: t(
      "Destinasyonlara göre ücretsiz ve ücretli seyahat rehberlerini keşfet. Gezgin deneyimlerini incele ve grup gezilerine katıl.",
      "Discover free and paid travel guides by destination, read traveler stories and join group trips.",
    ),
    sitemap: true,
    robots: "index",
    chrome: "wide-compact",
  },
  {
    path: "/articles/",
    file: "app/articles/page.tsx",
    layout: "content",
    title: t("Yazılar", "Articles"),
    sitemap: false,
    robots: "index",
  },
  {
    path: "/auth/callback/",
    file: "app/auth/callback/page.tsx",
    layout: "form",
    title: t("Oturum doğrulanıyor", "Verifying session"),
    sitemap: false,
    robots: "noindex",
  },
  {
    path: "/messages/",
    file: "app/messages/page.tsx",
    layout: "app",
    title: t("Mesajlar", "Messages"),
    sitemap: false,
    robots: "noindex",
    chrome: "wide-compact",
  },
  {
    path: "/checkout/",
    file: "app/checkout/page.tsx",
    layout: "content",
    title: t("Plan ve kredi", "Plans and credits"),
    sitemap: false,
    robots: "noindex",
  },
  {
    path: "/profile/",
    file: "app/profile/page.tsx",
    layout: "sidebar",
    title: t("Seyahat kimliğim", "My travel identity"),
    sitemap: false,
    robots: "noindex",
    chrome: "wide",
  },
  {
    path: "/profile/edit/",
    file: "app/profile/edit/page.tsx",
    layout: "content",
    title: t("Profili düzenle", "Edit profile"),
    sitemap: false,
    robots: "noindex",
  },
  {
    path: "/profile/photo/",
    file: "app/profile/photo/page.tsx",
    layout: "form",
    title: t("Profil fotoğrafı", "Profile photo"),
    sitemap: false,
    robots: "noindex",
  },
  {
    path: "/[username]/",
    file: "app/[username]/page.tsx",
    layout: "content",
    // <title>/description generateMetadata'da kullanıcı adıyla dinamik (publicMetadata).
    title: t("Gezgin profili", "Traveler profile"),
    sitemap: false,
    robots: "index",
    staticParams: ["/gezgin/", "/traveler/", "/demo/", "/kasif/"],
  },
  {
    path: "/login/",
    file: "app/login/page.tsx",
    layout: "form",
    title: t("Giriş yap", "Sign in"),
    sitemap: false,
    robots: "noindex",
  },
  {
    path: "/register/",
    file: "app/register/page.tsx",
    layout: "form",
    title: t("Hesap oluştur", "Create account"),
    sitemap: false,
    robots: "noindex",
  },
  {
    path: "/reset-password/",
    file: "app/reset-password/page.tsx",
    layout: "form",
    title: t("Şifre sıfırlama", "Reset password"),
    sitemap: false,
    robots: "noindex",
  },
  {
    path: "/verify/",
    file: "app/verify/page.tsx",
    layout: "form",
    title: t("Hesabını doğrula", "Verify your account"),
    sitemap: false,
    robots: "noindex",
  },
  {
    path: "/k/",
    file: "app/k/page.tsx",
    layout: "content",
    title: t("Konum paylaşımı", "Location share"),
    sitemap: false,
    robots: "noindex",
  },
  {
    path: "/u/admin/",
    file: "app/u/admin/page.tsx",
    layout: "sidebar",
    title: t("Yönetim paneli", "Admin panel"),
    sitemap: false,
    robots: "noindex",
    protected: true,
  },
];

/** Eş-anlamlı URL → kanonik hedef (design §5.1). Her anahtarın page.tsx'i yalnızca LegacyRedirect. */
export const LEGACY_REDIRECTS: Readonly<Record<RoutePath, RoutePath>> = {
  "/ai/": "/travel-assistant/",
  "/ai-asistan/": "/travel-assistant/",
  "/gezi-asistani/": "/travel-assistant/",
  "/desk/": "/maps/",
  "/harita/": "/maps/",
  "/haritalar/": "/maps/",
  "/mobil-uygulamalar/": "/mobile-apps/",
  "/forgot-password/": "/reset-password/",
  "/sifre-sifirla/": "/reset-password/",
  "/u/": "/checkout/",
  "/admin/": "/u/admin/",
};

/** "/x" → "/x/"; query/hash atılır. */
export function normalizePath(pathname: string): RoutePath {
  const bare = (pathname || "/").split(/[?#]/)[0] || "/";
  const lead = bare.startsWith("/") ? bare : `/${bare}`;
  return (lead.endsWith("/") ? lead : `${lead}/`) as RoutePath;
}

/** Kanonik kayıt (staticParams path'leri dinamik kayda çözülür); yoksa undefined. */
export function findRoute(pathname: string): CanonicalRoute | undefined {
  const p = normalizePath(pathname);
  return CANONICAL_ROUTES.find((r) => r.path === p || (r.staticParams ?? []).includes(p));
}

export function localeOfPath(pathname: string): RouteLocale {
  const p = normalizePath(pathname);
  return p === "/en/" || p.startsWith("/en/") ? "en" : "tr";
}

/** staticParams açılmış tüm kanonik path'ler (sıralı). */
export function expandPaths(): readonly RoutePath[] {
  return CANONICAL_ROUTES.flatMap((r) => (r.staticParams ? [...r.staticParams] : [r.path])).sort();
}

/**
 * Dil alternatifi (design §4.2, D13): LEGACY önce hedefe çözülür; kanonik kaydın `alternate`'i
 * varsa o, yoksa path'in kendisi (self). Registry dışı path'lerde de path döner (/en/<p> üretilmez).
 */
export function resolveAlternate(pathname: string): RoutePath {
  const p = normalizePath(pathname);
  const target = LEGACY_REDIRECTS[p] ?? p;
  return CANONICAL_ROUTES.find((r) => r.path === target)?.alternate ?? target;
}
