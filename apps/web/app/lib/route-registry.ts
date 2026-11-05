// Route registry (design §4.2, §5): kanonik rotaların ve eş-anlamlı (LEGACY) URL'lerin TEK veri
// kaynağı. PageHeader başlığı, <title>/canonical/hreflang (routeMetadata), dil anahtarı
// (getAlternatePath), header varyantı (SiteChrome) ve guard G4/G9 buradan okur.
// Bağımlılıksızdır (ui-audit Node type-stripping ile de yükler); erasable TS sözdizimi kullanılır.

export type PageLayout = "content" | "reading" | "form" | "landing" | "app" | "sidebar";
/**
 * Chrome varyantı (G19, design §5.2 / R5): sayfa CSS'i chrome'u override etmez.
 * immersive: footer yok, sayfa header altı ekranı doldurur, mobil alt menü görünür.
 * focus: yalın header (logo + dil + Geri), alt menü ve footer yok (form sayfaları).
 */
export type ChromeVariant = "default" | "wide" | "wide-compact" | "immersive" | "focus";
export const CHROME_VARIANTS: readonly ChromeVariant[] = [
  "default",
  "wide",
  "wide-compact",
  "immersive",
  "focus",
];
/** Footer sütunu (design §5.3, F29): footer bağlantıları yalnızca bu alandan üretilir. */
export type FooterGroup = "product" | "resources" | "legal";
export const FOOTER_GROUPS: readonly FooterGroup[] = ["product", "resources", "legal"];
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
  /** chrome varyantı (varsayılan "default") */
  chrome?: ChromeVariant;
  /** footer sütunu; sütun içi sıra bu dizideki sıradır */
  footer?: FooterGroup;
  /** kısa menü etiketi (design §5.1 adlandırma sözlüğü); footer'da title yerine kullanılır */
  nav?: Readonly<Record<RouteLocale, string>>;
}

const t = (tr: string, en: string): Readonly<Record<RouteLocale, string>> => ({ tr, en });

// Sıra footer sütunlarının sırasıdır (design §5.3): ürün → kaynaklar → yasal, sonra diğerleri.
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
    path: "/maps/",
    file: "app/maps/page.tsx",
    layout: "app",
    title: t("Rota planlayıcı", "Route planner"),
    description: t(
      "Durakları günlere ekle, sürükleyerek sırala ve durak sırasını gerçek yol ağı üzerinden optimize et. Her günün süresini ve mesafesini haritada gör.",
      "Add stops to days, drag to reorder and optimise the order over the real road network. See each day's time and distance on the map.",
    ),
    sitemap: true,
    // Bilinçli değer: bugünkü kod index + sitemap'te; GSC §3.6 noindex öneriyordu (F-16).
    robots: "index",
    protected: true,
    chrome: "immersive",
    footer: "product",
    nav: t("Planla", "Plan"),
  },
  {
    path: "/travel-assistant/",
    file: "app/travel-assistant/page.tsx",
    layout: "app",
    title: t("Gezi asistanı", "Travel assistant"),
    description: t(
      "Gezini kendi cümlelerinle anlat, birkaç soruyla netleştir; asistan rotanı gün gün haritada oluştursun ve düzenlesin. Mekan bilgileri veriden gelir, uydurulmaz.",
      "Describe your trip in your own words and settle the details in a few taps; the assistant builds and edits your route day by day on the map. Place details come from data, never made up.",
    ),
    sitemap: true,
    robots: "index",
    chrome: "immersive",
    footer: "product",
    nav: t("Asistan", "Assistant"),
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
    footer: "product",
    nav: t("Topluluk", "Community"),
  },
  {
    path: "/mobile-apps/",
    file: "app/mobile-apps/page.tsx",
    layout: "landing",
    title: t("Mobil uygulamalar", "Mobile apps"),
    description: t(
      "MapsBridge'i telefonunda kullan: gün gün planlayıcı, gezi asistanı ve paylaşım kodları küçük ekranda da aynı hesapla çalışır.",
      "Use MapsBridge on your phone: the day-by-day planner, the travel assistant and share codes work on a small screen with the same account.",
    ),
    sitemap: true,
    robots: "index",
    footer: "product",
  },
  {
    path: "/checkout/",
    file: "app/checkout/page.tsx",
    layout: "content",
    title: t("Plan ve kredi", "Plans and credits"),
    sitemap: false,
    robots: "noindex",
    // Geçici "Planlar ve kredi" yuvası: FEAT-005'te /pricing/'e taşınır (plan D6).
    footer: "product",
    nav: t("Planlar", "Plans"),
  },
  {
    path: "/how-it-works/",
    file: "app/how-it-works/page.tsx",
    layout: "landing",
    title: t("Nasıl çalışır", "How it works"),
    description: t(
      "Üç turda taslak rota: gezini anlat, iki soruyu yanıtla, rotan haritada. Sonrasını rota üzerinde birlikte iyileştir.",
      "A draft route in three turns: describe your trip, answer two questions, see your route on the map. Then refine it on the route itself.",
    ),
    sitemap: true,
    robots: "index",
    footer: "resources",
  },
  {
    path: "/articles/",
    file: "app/articles/page.tsx",
    layout: "content",
    title: t("Yazılar", "Articles"),
    sitemap: false,
    robots: "index",
    footer: "resources",
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
    footer: "resources",
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
    footer: "resources",
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
    footer: "resources",
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
    footer: "legal",
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
    footer: "legal",
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
    footer: "legal",
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
    path: "/messages/",
    file: "app/messages/page.tsx",
    layout: "app",
    title: t("Mesajlar", "Messages"),
    sitemap: false,
    robots: "noindex",
    chrome: "immersive",
    nav: t("Mesajlar", "Messages"),
  },
  {
    path: "/profile/",
    file: "app/profile/page.tsx",
    layout: "sidebar",
    title: t("Profilim", "My profile"),
    sitemap: false,
    robots: "noindex",
    chrome: "wide",
    nav: t("Profil", "Profile"),
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
    path: "/k/",
    file: "app/k/page.tsx",
    layout: "content",
    title: t("Konum paylaşımı", "Location share"),
    sitemap: false,
    robots: "noindex",
  },
  {
    path: "/login/",
    file: "app/login/page.tsx",
    layout: "form",
    title: t("Giriş yap", "Sign in"),
    sitemap: false,
    robots: "noindex",
    chrome: "focus",
  },
  {
    path: "/register/",
    file: "app/register/page.tsx",
    layout: "form",
    title: t("Hesap oluştur", "Create account"),
    sitemap: false,
    robots: "noindex",
    chrome: "focus",
  },
  {
    path: "/reset-password/",
    file: "app/reset-password/page.tsx",
    layout: "form",
    title: t("Şifre sıfırlama", "Reset password"),
    sitemap: false,
    robots: "noindex",
    chrome: "focus",
  },
  {
    path: "/verify/",
    file: "app/verify/page.tsx",
    layout: "form",
    title: t("Hesabını doğrula", "Verify your account"),
    sitemap: false,
    robots: "noindex",
    chrome: "focus",
  },
  {
    path: "/auth/callback/",
    file: "app/auth/callback/page.tsx",
    layout: "form",
    title: t("Oturum doğrulanıyor", "Verifying session"),
    sitemap: false,
    robots: "noindex",
    chrome: "focus",
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
/** Footer sütunu (design §5.3): registry sırasıyla; footer bileşeni bağlantı yazmaz, buradan alır. */
export function footerRoutes(group: FooterGroup): readonly CanonicalRoute[] {
  return CANONICAL_ROUTES.filter((r) => r.footer === group);
}
/** Menü etiketi: kısa `nav` varsa o, yoksa sayfa başlığı (design §5.1). */
export function routeLabel(route: CanonicalRoute, locale: RouteLocale): string {
  return (route.nav ?? route.title)[locale];
}
/**
 * Menü öğesi etkin mi (aria-current): LEGACY önce hedefe çözülür; "/" yalnızca ana sayfada
 * ("/" ya da "/en/"), diğerleri kendisi ve alt yolları için etkin.
 */
export function isNavActive(pathname: string, href: string): boolean {
  const p = normalizePath(pathname);
  const current = LEGACY_REDIRECTS[p] ?? p;
  const target = normalizePath(href);
  if (target === "/" || target === "/en/") return current === "/" || current === "/en/";
  return current === target || current.startsWith(target);
}
