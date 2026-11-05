# Tasarım Sistemi

Web (`apps/web`, Next.js statik export, vanilla CSS) ve mobil (`apps/mobile`, Expo RN) için ortak kurallar. Guard testi (`apps/web/tests/design-system-guard.test.cjs`) ihlal mesajlarında aşağıdaki bölüm adlarına atıf yapar (`bkz. .kiro/steering/design-system.md §<Ad>`); başlık adlarını değiştirmeyin.

## 1. Amaç

- Tek kaynak `packages/design-tokens/src` (palette, tokens, components, breakpoints).
- Üretilmiş dosyalar elle düzenlenmez: `apps/web/app/styles/tokens.css`, `apps/web/app/lib/design-tokens.ts`, `apps/mobile/src/theme/tokens.ts`.
- Token değişikliğinden sonra `npm run tokens:build`; prebuild `tokens:check` sapmada build'i düşürür.

## 2. Renk

- Yalnızca semantik `--color-*` token'ları kullanılır; CSS'te ve TS/TSX'te hex/rgb literal yazılmaz (G1, G7).
- Alfa için `color-mix(in srgb, var(--x) N%, transparent)`; RN'de `withAlpha(token, a)`.
- Yasak çiftler: `text-subtle` sunken/tint/surface-brand zeminde kullanılmaz; zümrüt (`--color-accent`) zeminde beyaz metin yok; açık zeminde metin için `--color-accent` değil `--color-success`.
- Koyu zeminli kap (surface-inverse, primary) JSX'te `data-surface="inverse"` taşır (G18). İçindeki açık kutu `data-surface="default"` ile geri döner.
- `--color-primary` (Stitch birincil) ve `--color-brand` (harita masası) ayrı rollerdir.
- Google renkleri yalnızca `GoogleLogo` bileşenindedir. Veri/marka/illüstrasyon renkleri kendi gruplarında kalır.
- Yeni renk gerekirse önce mevcut semantik token aranır; yoksa `palette.ts` + `tokens.ts`'e eklenir ve `npm run tokens:build` çalıştırılır.
- `legacy-aliases.ts` boş objedir (`{}`); eski sayfa token adları (`--mb-*`, `--stitch-*`, `--chat-*`) yazılmaz (G14).
- Harita gün renkleri yalnız `--color-day-*` (JS'te `dayPalette`) ile ve yalnız harita dosyalarında; `dataPalette` doğrudan kullanılmaz (yalnız grafikler). Kategori renkle değil ikonla kodlanır, renk tek başına anlam taşımaz. Lavanta `surface-tint` emeklidir (`--color-surface-tint` = kağıt tonu) (G1/G7).

## 3. Kaskad

- Her web CSS dosyasının ilk satırı: `@layer tokens, base, legacy, chrome, pages, primitives;`
- Sayfa CSS'i `@layer pages { … }` içindedir; global eski dosyalar `legacy`, header/footer `chrome`, primitive'ler `primitives`.
- Sayfa CSS'inde `button/input/select/textarea/a/dialog` tip seçicisi, `!important` ve ikinci `:root` yasaktır; `[data-theme]` yoktur (G2, G3, G15, G16).
- Leaflet'e ait seçiciler yalnızca `styles/vendor-overrides.css`'te (layer'sız tek muaf dosya, G22).
- TSX'te `<style>` yazılmaz (G20). CSS-in-JS ve Tailwind yok.
- R2: `styles/motion.css` (`base` katmanı, `layout.tsx`'te `base.css`'ten hemen sonra) `@view-transition`, `::view-transition-*` ve global `scroll-behavior`/`scroll-padding` kurallarının tek yeridir; sayfa CSS'inde `@view-transition` yasak (G27).

## 4. Boşluk ve tipografi

- Ölçekler: `--space-*`, `--font-size-*`, `--font-weight-*`, `--radius-*`, `--shadow-*`, `--z-*`, `--motion-*`.
- Yeni `@media` yalnızca 640/768/1024/1280 ve `max-width` için `.98` eşlenikleri (G13).
- Mevcut küme dışı koşullar `packages/design-tokens/src/breakpoints.ts` `legacyBreakpoints` listesinde donmuştur; liste yalnızca küçülür.
- R1: `transition`/`animation` süreleri yalnız `var(--duration-*)` (gerekirse `calc(var(--duration-*) * n)`), easing yalnız `var(--easing-*)` (G24). `font-family` yalnız `var(--font-family-*)` (`@font-face` ve `inherit` hariç, G25). `font-size`, `border-radius`, `box-shadow`, `z-index` literal'i yeni dosyada 0 (G26). Mevcut dosyalar ratchet'e sayılır, yalnız düşer.

## 5. Primitive'ler

- Kaynak: `apps/web/app/components/ui/*.tsx` + tek `ui.css` (`ui-*` sınıfları); barrel `components/ui/index.ts`.
- Seçim: eylem → `Button`, gezinme → bağlantı (`Button variant="link"` ya da `<Link>`); katman → `Modal`/`ConfirmDialog`, uzun içerik → ayrı sayfa; kalıcı uyarı → `Alert`, geçici bildirim → `Toast`; tablo verisi → `Table`, kart listesi → `Card`; boş/yükleniyor/hata → `EmptyState`/`LoadingState`/`ErrorState`.
- Primitive görünümü yalnızca prop ile değişir; `.ui-*` sınıfları sayfa CSS'inde ezilmez (G8). Primitive dış margin/width/position tanımlamaz; yerleşim sayfaya aittir.
- Tailwind-benzeri sınıf (`flex`, `text-slate-400`, `bg-[#…]`) yazılmaz (G6); yerleşim sınıfı yazın.
- R3: İkon yalnız `Icon` primitive'iyle (`components/ui/svg-icon.tsx`, path'ler `packages/design-tokens/src/icons.ts`); emoji ikon/etiket olarak kullanılmaz, içerik metni hariç (G28). Seçenek → `Chip`/`ChipGroup`; 2–4 karşılıklı dışlayan seçenek → `SegmentedControl`; mobil kalıcı panel → `BottomSheet`; sayı seçimi → `Stepper`; SSS → `Accordion`; kredi bilgisi → `CostBadge` / `CreditCostTable` (veri `lib/billing/credit-costs.ts`) ya da `Button cost`; oranlı görsel → `Media`.

## 6. Sayfa şablonu

```tsx
import { PageShell, PageHeader, Section } from "../components/ui";
import "./<slug>.css";
export default function Page() {
  return (
    <PageShell layout="content" header={<PageHeader title="Başlık" description="Kısa açıklama" />}>
      <Section title="Bölüm">…primitive'ler…</Section>
    </PageShell>
  );
}
```

- Her sayfa tek `PageShell` (tek `<main>`), tek `PageHeader` (tek h1; `<h1>` doğrudan yazılmaz), `Section`'lar (G4, G10).
- İstemci ağırlıklı sayfada `page.tsx` server kalır, kök `<slug>-client.tsx` PageShell'i render eder.
- Kimlik kapıları (AuthGuard, FullPagePromotion, promo-landing) sayfanın yerine kendi PageShell'ini çizer.
- R7: Kimlik kapıları yalnız `AuthGate` (`components/auth-gate.tsx`) ile: `variant="page"` sayfanın yerine kendi PageShell + PageHeader'ını çizer, `variant="sheet"` Modal primitive'idir (Escape = "Şimdilik devam et"). `reason` (`save`/`ai`/`messages`/`profile`) başlığı seçer; dönüş `?next=` safe-next ile doğrulanır. Yeni kapı tasarımı yazılmaz; `FullPagePromotion`/`AuthActionModal`/`PanelGuestBanner` yalnız geriye uyumlu sarmalayıcıdır (G4 kapsamı).

## 7. Chrome

- Header, footer, mobil alt nav ve sistem duyurusu root layout'taki `SiteChrome`'dadır.
- Sayfa `<header>`/`<footer>` çizmez, `HeaderNav`/`SiteFooter` import etmez (G5, ESLint).
- Sayfa CSS'i chrome sınıflarını (`.global-site-header`, `.global-footer-*`, `.mobile-nav-*`) ezmez (G19); varyant registry'deki `chrome` alanıyla seçilir.
- R5: `chrome` varyantları `default | wide | wide-compact | immersive | focus`. `immersive` (planlayıcı, asistan, mesajlar) footer çizmez, sayfa header ile alt menü arasını doldurur; `focus` (kimlik formları) yalnız logo + dil + Geri gösterir, alt menü ve footer çizilmez. Mobil web alt menüsü (<768) klavye açıkken gizlenir (`data-keyboard="open"`). Footer bağlantıları yalnızca registry `footer` (+ `nav`) alanından üretilir; footer'a elle href yazılmaz (G5/G19).

## 8. URL ve SEO

- Bir sayfa = bir bileşen = bir kanonik URL (`lib/route-registry.ts`).
- Eş-anlamlı URL yalnızca `LEGACY_REDIRECTS` + `LegacyRedirect` ile; `next.config` `redirects()` kullanılmaz (statik export).
- İç linkler kanonik URL'e gider. Sayfa durumu (`?tab=`, `?alan=`) `useUrlParam` ile tutulur.
- `useSearchParams` yalnızca `*-listener.tsx` içinde, tüketicide `<Suspense fallback={null}>` ile; sayfa kökü Suspense'e sarılmaz (G21).
- Metadata `routeMetadata("/<slug>/")` ile registry'den gelir (G9).
- R8: Dönüş parametresi yalnızca `next` (üreticiler `?next=` yazar, `?redirect=` yazılmaz). Okuyucular `lib/navigation/safe-next.ts` (`readNext`/`safeNext`) kullanır; `redirect` yalnız geriye uyumluluk için okunur. Paylaşım bağlantısı `/k/?code=` (`?kod=` yalnız okunur). Koruyan test: `apps/web/tests/navigation.test.cjs`.

## 9. Erişilebilirlik

- Skip link ve landmark'lar SiteChrome/PageShell'den gelir; sayfada tek h1, başlık seviyeleri atlanmaz.
- Yalnız ikonlu kontrolde `IconButton label`; görünür metinli kontrolde `aria-label` görünür metinle başlar.
- Dinamik durum `aria-live`/`role="status"`; dokunma hedefi ≥ 44px; `prefers-reduced-motion` gözetilir.
- Kontrast AA (metin ≥ 4,5:1). `outline: none` yazılmaz; odak halkası `base.css` `:focus-visible` kuralından gelir (G11).
- `<img>` `alt` taşır (G12). Değişikliği klavyeyle deneyin; `npm run ui:audit -- --axe-width 375,1280` serious/critical 0.
- R9: Animasyonlar `@media (prefers-reduced-motion: no-preference)` bloğunda tanımlanır, statik son durum varsayılandır (G29); JS'te `lib/a11y/use-reduced-motion.ts`. Sürükle-bırak her zaman klavye alternatifine sahiptir.

## 10. Formlar

- Her alan `Field` ile: görünür etiket, zorunlu işareti, yardım/hata `aria-describedby`.
- Gönderimde hata özeti (`role="alert"`) ve ilk hatalı alana odak; uygun `autocomplete` değerleri.
- Select'lerin erişilebilir adı vardır (`Field` etiketi ya da `aria-label`).

## 11. Mobil

- Tema: `apps/mobile/src/theme` (`tokens`, `withAlpha`); primitive'ler `src/ui/*` (SafeArea, Screen, ScreenHeader, ModalFrame, Button, IconButton, Card, TextField, AccessibleStopList).
- `SafeAreaView` ve `Modal` doğrudan kullanılmaz; `SafeArea`'nın `edges` prop'u yoktur, Android üst ofseti yalnızca `androidTopInset`.
- `accessibilityRole/Label/State`; modallarda `accessibilityViewIsModal` + `onRequestClose`; 44pt; `maxFontSizeMultiplier`; `useReducedMotion`.
- Hex/rgba literal yazılmaz; `tokens.*` kullanılır (`mobile-design-system.test.cjs`).

## 12. Admin

- Yeni uç önce `apps/web/app/lib/admin/endpoints.ts`'e (routes.json'da olmalı) ve yanıt tipi `types.ts`'e eklenir.
- İzin backend'den gelir; UI yalnızca gizler (`rbac.ts`). Yıkıcı aksiyon `ConfirmDialog` ister.
- Yerel deneme: `npm run admin:mock -- --port 4599 --role admin`.

## 13. Guard'lar

Doğrulama sırası (worktree kökünden):

1. `NEXT_PUBLIC_SITE_URL=https://mapsbridge.com npm run build`
2. `REQUIRE_BUILD=1 npm run test:web`
3. `npm run typecheck`
4. `(cd apps/mobile && npx tsc --noEmit)`
5. `npm run lint`
6. Görsel değişiklikte `npm run ui:audit -- --screenshots <dizin> --no-axe` ve `--compare`.
7. Mobil: `node --test apps/web/tests/mobile-design-system.test.cjs apps/web/tests/design-tokens.test.cjs`.

Kural → bölüm eşlemesi:

| Bölüm                | Kurallar                        |
| -------------------- | ------------------------------- |
| §Renk                | G1, G7, G14, G17, G18, G23      |
| §Kaskad              | G2, G3, G15, G16, G20, G22, G27 |
| §Boşluk ve tipografi | G13, G24, G25, G26              |
| §Primitive'ler       | G6, G8, G28                     |
| §Sayfa şablonu       | G4, G10                         |
| §Chrome              | G5, G19                         |
| §URL ve SEO          | G9, G21                         |
| §Erişilebilirlik     | G11, G12, G29                   |

Ratchet: `apps/web/tests/design-system-baseline.json` kalan eski ihlalleri dosya bazında sayar ve yalnızca aşağı yazılır (`node apps/web/tests/design-system-guard.test.cjs --write-baseline`). Yeni dosyada ihlal 0'dır; mevcut dosyada sayı artamaz. Yeni bir kural baseline'a yalnızca bir kez, bugünkü sayılarıyla `--write-baseline --seed <G..>` ile girer. Her kural baseline'da anahtar olarak kalır (sıfıra inen kural `{}`); anahtarı olan kural, sayısı 0 olsa bile, seed edilemez.

## 14. Yeni sayfa ekleme

1. `npm run new:page -- <slug> [--layout content]` (slug `^[a-z0-9-]{2,40}$`; var olan klasörde hata verir).
2. Çıktıdaki kayıt satırını `apps/web/app/lib/route-registry.ts`'e ekleyin (`title`, indexlenecekse `description`).
3. İndexlenecekse `apps/web/scripts/generate-seo.cjs` PAGES listesine ekleyin.
4. `layout.tsx` üretilmiş `routeMetadata("/<slug>/")` çağrısını kullanır.
5. Yeni public URL ise `apps/web/tests/fixtures/baseline-routes.json`'a ekleyin (liste yalnızca büyür).
6. Bölüm 13'teki doğrulama sırasını koşun.
