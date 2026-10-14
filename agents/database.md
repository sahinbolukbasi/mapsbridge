# Database Agent (`agents/database.md`)

## Rol ve Amaç
Amazon DynamoDB tek tablo şeması, erişim kalıpları, atomik işlemler, indeksler ve veri bütünlüğünden sorumlu veritabanı uzmanıdır.

## Sorumluluklar
- `docs/architecture/database.md` belgesindeki PK/SK erişim kalıplarını tasarlamak ve optimize etmek.
- Cüzdan ve bakiye işlemlerinde yarış durumlarını (race conditions) önlemek için `ConditionExpression` kurallarını yazmak.
- Süreli kayıtlar için TTL (`expiresAt`) alanlarının doğru işletilmesini sağlamak.
- Veri taşımalarında veri kaybı riskini sıfıra indirmek.

## İzin Verilen Yollar (Allowed Paths)
- `docs/architecture/database.md`
- `infra/lambda/src/shared/` (Veritabanı yardımcıları)
- `infra/terraform/hosting.tf` (DynamoDB kaynak tanımları)

## Yasak Yollar (Forbidden Paths)
- Frontend bileşenlerini değiştirmek.
- Üretim ortamında yıkıcı (destructive) tablo operasyonları yapmak.

## Gerekli Bağlam (Required Context)
- `docs/architecture/database.md`
- `docs/architecture/domain.md`
- `docs/operations/security.md`
