# Requirements Document

## Introduction

Bu spec, feature geliştirmeye başlamadan önce MapsBridge çekirdek mimarisini sağlamlaştırmayı ve web + admin panelinin AWS üzerinde hatasız çalıştığını kanıtlamayı hedefler. Kapsam, üç audit raporunun (`AUDIT.md`, `SECURITY-FINDINGS.md`, `SECRETS-AUDIT.md`) güncel koda karşı doğrulanmasıyla belirlendi; çoğu madde zaten kapalı olduğundan yalnızca **gerçekten açık** olanlar dahil edildi (bkz. `docs/development/audit-status.md`).

Davranış değişikliği hedeflenmez; amaç tutarlılık, görünürlük ve doğrulanabilirliktir. Tüm değişiklikler mevcut testleri yeşil bırakmalıdır.

**Kapsam dışı:** `admin/index.ts` parçalama (zaten modüler, 204 satır); eksik test ekleme (admin/places/kb-ingest/background-monitor testleri zaten var); JWT → HttpOnly cookie (ayrı güvenlik spec'i); GSI1 migration ve Terraform IAM/VPC/OIDC (canlı altyapı, ayrı spec); secret rotation (hesap paneli işlemi).

## Glossary

- **Singleton DynamoDB client**: `shared/dynamo.ts` içindeki `getDynamoClient()` ile döndürülen, Lambda container ömrü boyunca yeniden kullanılan tek `DynamoDBClient` örneği.
- **SSRF**: Server-Side Request Forgery — sunucunun, kullanıcı girdisiyle manipüle edilmiş bir URL'ye istek yapmaya zorlanması.
- **Canary / Synthetics**: Canlı endpoint'lerin sağlığını periyodik test eden otomatik kontroller (`npm run monitor:synthetics`).
- **Handler**: `infra/lambda/src/<domain>/` altındaki, bir API route'una bağlı Lambda giriş fonksiyonu.

## Requirements

### Requirement 1: DynamoDB Client Tutarlılığı

**User Story:** Bir bakımcı olarak, tüm Lambda handler'larının tek bir paylaşılan DynamoDB client singleton'ı kullanmasını istiyorum; böylece bağlantı yeniden kullanımı tutarlı olur ve testlerde mock'lama kolaylaşır.

#### Acceptance Criteria

1. WHEN bir Lambda handler DynamoDB'ye erişmesi gerektiğinde THEN handler `shared/dynamo.ts`'deki `getDynamoClient()` fonksiyonunu kullanmalıdır (doğrudan `new DynamoDBClient()` değil).
2. IF bir handler özel bir bölge veya config gerektiriyorsa (singleton'a uymuyorsa) THEN bu durum kodda yorumla gerekçelendirilmeli AND bu spec'in design dokümanında istisna olarak listelenmelidir.
3. WHEN konsolidasyon tamamlandığında THEN `shared/dynamo.ts` dışındaki hiçbir dosyada gerekçesiz `new DynamoDBClient(` çağrısı kalmamalıdır.
4. WHEN her dosya değiştirildiğinde THEN `npm run test:backend` 0 başarısızlıkla geçmelidir.

### Requirement 2: Konfigürasyon Sağlamlaştırma

**User Story:** Bir operatör olarak, ortam-bağımlı değerlerin (region, API endpoint, uygulama URL'si) hardcoded olmamasını istiyorum; böylece ortam değiştiğinde sistem kırılmaz.

#### Acceptance Criteria

1. WHEN `apps/web/app/lib/cognito.ts` bir AWS region veya API Gateway endpoint'ine ihtiyaç duyduğunda THEN değer environment variable'dan okunmalı, hardcoded olmamalıdır.
2. IF environment variable tanımlı değilse THEN mevcut davranışı bozmayan güvenli bir varsayılan kullanılmalı AND bu durum belgelenmelidir.
3. WHEN e-posta şablonları (`auth/email-templates.ts`) bir uygulama URL'si ürettiğinde THEN URL `process.env.APP_URL` (veya eşdeğeri) üzerinden gelmelidir.
4. WHEN değişiklikler tamamlandığında THEN `npm run typecheck` temiz geçmelidir.

### Requirement 3: discoverCity Girdi Doğrulama (SSRF Önleme)

**User Story:** Bir güvenlik mühendisi olarak, dış servislere giden URL'lerin kullanıcı girdisiyle manipüle edilememesini istiyorum; böylece SSRF riski ortadan kalkar.

#### Acceptance Criteria

1. WHEN `places/index.ts` içindeki `discoverCity` dış bir URL oluşturduğunda THEN `city` ve `country` parametreleri URL-encode edilmelidir.
2. WHEN bu parametreler doğrulandığında THEN yalnızca beklenen karakter kümesine (harf, boşluk, tire, virgül) izin veren bir doğrulama uygulanmalıdır.
3. IF parametreler doğrulamadan geçemezse THEN handler güvenli bir hata (400) dönmeli AND dış çağrı yapılmamalıdır.
4. WHEN değişiklik tamamlandığında THEN mevcut `places` testleri geçmeli AND yeni doğrulama için en az bir test eklenmelidir.

### Requirement 4: Web ve Admin Panel Sıfır-Hata Garantisi

**User Story:** Bir ürün sahibi olarak, web ve admin panelinin tip-güvenli olmasını ve hatasız derlenmesini istiyorum; böylece feature geliştirmeye sağlam bir temelden başlarım.

#### Acceptance Criteria

1. WHEN `npm run typecheck` çalıştırıldığında THEN 0 TypeScript hatasıyla geçmelidir.
2. WHEN `npm run build` çalıştırıldığında THEN statik export 0 hatayla tamamlanmalıdır.
3. WHEN admin panelinin tüm sekmeleri (overview, modules, credits, users, routes, payments, reports, audit, system ve workspace-tabanlı sekmeler) derlendiğinde THEN tip hatası olmamalıdır.
4. WHEN `npm run test:all` çalıştırıldığında THEN tüm testler 0 başarısızlıkla geçmelidir.

### Requirement 5: AWS Çalışma Doğrulaması

**User Story:** Bir operatör olarak, çekirdek endpoint'lerin canlı AWS üzerinde sağlıklı yanıt verdiğini kanıtlamak istiyorum; böylece "AWS üzerinde çalışıyor" iddiası ölçülür.

#### Acceptance Criteria

1. WHEN `npm run monitor:synthetics` çalıştırıldığında THEN canary sonuçları toplanmalı AND hangi endpoint'lerin sağlıklı/sağlıksız olduğu raporlanmalıdır.
2. IF herhangi bir canary başarısız olursa THEN başarısızlık `docs/development/audit-status.md`'ye kaydedilmeli AND kök neden analizi yapılmalıdır.
3. WHEN doğrulama tamamlandığında THEN kod değişikliği gerektirmeyen (yalnızca gözlem) bir doğrulama raporu üretilmelidir.
4. WHILE doğrulama sürerken hiçbir adım canlı AWS altyapısını (deploy, terraform apply, tablo değişikliği) değiştirmemelidir.
