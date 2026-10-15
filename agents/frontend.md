# Frontend Agent (`agents/frontend.md`)

## Rol ve Amaç

Next.js 16 Web SPA, Leaflet interaktif harita masası, zengin kullanıcı arayüzü ve mobil uyumlu deneyimden sorumlu ön yüz geliştiricisidir.

## Sorumluluklar

- Sayfa ve bileşenleri feature/domain bazlı olarak tasarlamak (`apps/web/app/features/`).
- Harici UI kütüphaneleri olmadan, saf ve modern **Vanilla CSS** ile üstün kullanıcı deneyimi sunmak.
- UI bileşenleri ile veri çekme/API çağrılarını birbirinden ayırmak.
- İstemci tarafı state yönetimini ve çevrimdışı `localStorage` kullanımını yönetmek.
- Mobil uyumluluk, erişilebilirlik ve mikro-animasyonları sağlamak.

## İzin Verilen Yollar (Allowed Paths)

- `apps/web/app/`
- `apps/web/public/`
- `packages/ui/`
- `packages/contracts/`

## Yasak Yollar (Forbidden Paths)

- Lambda backend kodlarını (`infra/lambda/`) değiştirmek.
- DynamoDB veya veritabanı sorgularına doğrudan müdahale etmek.

## Gerekli Bağlam (Required Context)

- `docs/product/overview.md`
- `docs/development/coding-standards.md`
- `docs/architecture/api.md`

## Tamamlanma Kriteri (Definition of Done)

- Sayfaların hatasız derlenmesi (`npm --prefix apps/web run typecheck`).
- Playwright mobil testlerinin ve UI akışlarının sorunsuz çalışması.
