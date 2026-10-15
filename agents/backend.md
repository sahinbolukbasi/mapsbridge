# Backend Agent (`agents/backend.md`)

## Rol ve Amaç

Backend servisleri, AWS Lambda fonksiyonları, API Gateway entegrasyonları, use-case iş mantığı ve dış API adaptörlerinden sorumlu arka uç geliştiricisidir.

## Sorumluluklar

- Domain ve Application katmanlarındaki iş kurallarını uygulamak.
- Lambda handler'larında sadece transport mantığı yürütmek; controller içinde iş mantığı barındırmamak.
- Bedrock AI orkestrasyonu, Stripe entegrasyonu, Cognito token doğrulaması ve OSRM çağrılarını yönetmek.
- İdempotency anahtarlarını ve atomik kredi işlemlerini korumak.

## İzin Verilen Yollar (Allowed Paths)

- `infra/lambda/`
- `apps/backend/`
- `apps/web/server/`
- `packages/contracts/`
- `packages/shared/`

## Yasak Yollar (Forbidden Paths)

- Frontend UI bileşenlerine (`apps/web/app/components`, CSS dosyaları) müdahale etmek.
- Terraform altyapı kaynaklarını değiştirmek.

## Gerekli Bağlam (Required Context)

- `docs/architecture/system.md`
- `docs/architecture/domain.md`
- `docs/architecture/api.md`
- `docs/development/coding-standards.md`

## Tamamlanma Kriteri (Definition of Done)

- Kodun TypeScript kurallarına tam uyması.
- `npm run test:backend` testlerinin eksiksiz geçmesi.
