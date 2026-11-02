# Design Document

## Overview

Bu tasarım, çekirdek mimari sağlamlaştırma işini davranış değişikliği olmadan uygular. Kod inceleme sonucu, audit raporlarındaki maddelerin çoğunun zaten kapalı olduğu doğrulandı; bu nedenle tasarım **gerçekten açık** olan noktalara odaklanır:

- **R1 (asıl iş):** 16 dosyada 41 adet elle `new DynamoDBClient(...)` çağrısının `shared/dynamo.ts` singleton'ına taşınması — özel-config istisnaları korunarak.
- **R2 (küçük):** `cognito.ts` ve `email-templates.ts` zaten env-driven; yalnızca fallback tutarlılığı ve belgeleme.
- **R3 (küçük):** `places/index.ts` zaten injection/URL-şeması reddi yapıyor; URL-encode garantisi + test eklenir.
- **R4/R5 (doğrulama):** typecheck + build + test:all + synthetics ile kanıt.

## Architecture

### Mevcut Durum (doğrulanmış)

`shared/dynamo.ts` zaten bir singleton sağlıyor:

```ts
let clientInstance: DynamoDBClient | null = null;
export function getDynamoClient(): DynamoDBClient {
  if (!clientInstance) clientInstance = new DynamoDBClient({ region: process.env.AWS_REGION });
  return clientInstance;
}
```

12 dosya bunu kullanıyor; 16 dosya hâlâ `new DynamoDBClient(...)` yapıyor. Çağrıların dağılımı:

| Kategori      | Dosyalar                                                                                                    | Config                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Standart      | `admin/*` (analytics, management, moderation, users, finance, system), `routes/index.ts`, `ws/*`, `auth.ts` | `{ region: process.env.AWS_REGION }` — singleton ile birebir uyumlu |
| Özel config   | `shared/ai-operations.ts`                                                                                   | `{ region, maxAttempts: 1 }`                                        |
| Özel config   | `ai/training-worker.ts`                                                                                     | `{ maxAttempts: 2 }`                                                |
| Özel fallback | `operations/tracker-worker.ts`                                                                              | `{ region: AWS_REGION \|\| "eu-central-1" }`                        |
| Özel değişken | `kb-ingest/index.ts`                                                                                        | `{ region: REGION }` (modül sabiti)                                 |

### Hedef Tasarım

`getDynamoClient()` opsiyonel bir config parametresi kabul edecek şekilde genişletilir. Özel config isteyen çağrılar kendi örneğini almaya devam eder; standart çağrılar paylaşılan singleton'a döner.

```ts
// shared/dynamo.ts
let clientInstance: DynamoDBClient | null = null;

export function getDynamoClient(options?: { maxAttempts?: number }): DynamoDBClient {
  // Özel config istenirse ayrı örnek döndür (singleton'ı kirletme)
  if (options && Object.keys(options).length > 0) {
    return new DynamoDBClient({ region: process.env.AWS_REGION, ...options });
  }
  if (!clientInstance) {
    clientInstance = new DynamoDBClient({ region: process.env.AWS_REGION });
  }
  return clientInstance;
}
```

**İstisnalar (Requirement 1, kriter 2 gereği belgelenmiştir):**

- `ai-operations.ts` → `getDynamoClient({ maxAttempts: 1 })` — hızlı-başarısızlık davranışı korunur.
- `ai/training-worker.ts` → `getDynamoClient({ maxAttempts: 2 })` — retry davranışı korunur.
- `tracker-worker.ts` → fallback `"eu-central-1"` zaten singleton'ın `AWS_REGION` davranışıyla örtüşür; Lambda'da `AWS_REGION` her zaman set olduğundan standart singleton kullanılabilir.
- `kb-ingest/index.ts` → modül seviyesinde `REGION` sabiti; `AWS_REGION` ile aynıysa singleton'a taşınır.

## Components and Interfaces

### Değişecek Dosyalar (R1)

1. `shared/dynamo.ts` — `getDynamoClient` opsiyonel config alır.
2. 16 handler dosyası — `new DynamoDBClient(...)` → `getDynamoClient(...)`. Her dosya ayrı ve mevcut `import` satırları (`DynamoDBClient` import'u gereksizse kaldırılır) güncellenir.

### Değişecek Dosyalar (R2)

- `apps/web/app/lib/cognito.ts` — satır 269'daki API GW fallback'i doğrulanır; env var zaten var (`NEXT_PUBLIC_API_BASE_URL`), yalnızca fallback'in `api-client.ts`'teki `API_ENDPOINT` ile tutarlı olması sağlanır. Davranış değişmez.
- `auth/email-templates.ts` — zaten `process.env.APP_URL` kullanıyor; değişiklik gerekmez, yalnızca doğrulanır.

### Değişecek Dosyalar (R3)

- `places/index.ts` — mevcut reddetme guard'ı korunur; `discoverCity`'ye giden `city`/`country`'nin dış URL'de `encodeURIComponent` ile encode edildiği doğrulanır (collector katmanında). Eksikse eklenir.
- `infra/lambda/tests/places.test.cjs` — injection/URL reddi ve encode için en az bir yeni test.

## Data Models

Veri modeli değişmez. Hiçbir DynamoDB şeması, PK/SK pattern'i veya item yapısı değiştirilmez. Singleton değişikliği yalnızca client örnekleme biçimini etkiler, sorgu/komut davranışını değil.

## Error Handling

- Singleton değişikliğinde `maxAttempts` gibi retry ayarları korunur; aksi halde retry davranışı sessizce değişir (regresyon riski). İstisna tablosu bunu önler.
- `discoverCity` guard'ı: geçersiz girdi → `badRequest(400)`, dış çağrı yapılmaz (mevcut davranış korunur, güçlendirilir).
- Konfigürasyon fallback'leri: env yoksa güvenli varsayılan + log (davranış korunur).

## Testing Strategy

1. **Birim/handler testleri:** Her dosya değişikliğinden sonra `npm run test:backend` (mevcut 231 test yeşil kalmalı).
2. **Yeni test:** `places.test.cjs`'e SSRF/encode doğrulaması için test eklenir.
3. **Tip güvenliği:** `npm run typecheck` (web) + backend esbuild bundle doğrulaması.
4. **Build:** `npm run build` statik export 0 hata.
5. **Tam suite:** `npm run test:all`.
6. **Canlı doğrulama (R5):** `npm run monitor:synthetics` — yalnızca gözlem, altyapıya dokunmaz. Sonuç `docs/development/audit-status.md`'ye raporlanır.

## Rollout / Risk

- Her gereksinim ayrı adımda, kendi doğrulamasıyla uygulanır (küçük, geri alınabilir commit'ler).
- `shared/dynamo.ts` "dokunursan patlar" listesinde değil ama tüm handler'ların ortak bağımlılığı — önce bu genişletilir, sonra çağrı yerleri migrate edilir.
- Billing/auth çekirdeği (reserveAI, getVerifiedUser) davranışı DEĞİŞMEZ; yalnızca client örnekleme biçimi değişir ve her adımda test edilir.

## Correctness Properties

Bu değişikliklerin davranış-koruyucu olduğunu garantileyen özellikler:

### Property 1: DynamoDB işlem eşdeğerliği

Bir handler'ın ürettiği DynamoDB komutları (PutItem, Query, TransactWriteItems vb.) singleton geçişinden önce ve sonra birebir aynı olmalıdır — yalnızca client örneğinin kaynağı değişir.

**Validates: Requirements 1.1, 1.3**

### Property 2: Retry davranışı korunumu

`maxAttempts` özel ayarı olan handler'lar (ai-operations, training-worker) geçiş sonrası aynı `maxAttempts` değeriyle çalışmalıdır.

**Validates: Requirements 1.2**

### Property 3: Bölge tutarlılığı

Tüm singleton tüketicileri `process.env.AWS_REGION` ile aynı bölgeyi kullanmalıdır; Lambda runtime'da bu değişken her zaman tanımlıdır.

**Validates: Requirements 1.1**

### Property 4: Girdi doğrulama monotonluğu (R3)

`discoverCity` guard'ı, önceden reddedilen hiçbir girdiyi artık kabul etmemelidir — koruma yalnızca güçlenir, gevşemez.

**Validates: Requirements 3.2, 3.3**

### Property 5: Konfigürasyon geri-uyumluluğu (R2)

Env var tanımlıyken davranış, değişiklik öncesiyle aynı olmalıdır; yalnızca env var yokken fallback devreye girer.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 6: Test değişmezliği

Mevcut 231 backend testi ve web testleri, hiçbir test gevşetilmeden veya silinmeden yeşil kalmalıdır.

**Validates: Requirements 1.4, 3.4, 4.4**
