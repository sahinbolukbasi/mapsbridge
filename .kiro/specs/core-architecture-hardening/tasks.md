# Implementation Plan

## Overview

Bu plan, çekirdek mimari sağlamlaştırmayı küçük, geri alınabilir ve her adımda test edilen görevlere böler. Asıl iş R1 (DynamoDB singleton konsolidasyonu); R2/R3 küçük sağlamlaştırma; R4/R5 doğrulama. Hiçbir görev davranış değiştirmez ve mevcut testleri gevşetmez.

## Task Dependency Graph

```
Görev 1 (singleton genişletme)
   ├─> Görev 2.1 (admin/* migrate)
   ├─> Görev 2.2 (routes migrate)
   ├─> Görev 2.3 (ws + auth migrate)
   └─> Görev 3 (özel-config migrate)
Görev 4 (config doğrulama)      [bağımsız]
Görev 5.1 (SSRF encode) ─> Görev 5.2 (SSRF test)   [bağımsız]
Görev 6 (sıfır-hata doğrulama)  [2.x, 3, 4, 5 sonrası]
Görev 7 (AWS canary)            [6 sonrası, yalnızca gözlem]
```

- Görev 1, tüm 2.x ve 3 görevlerinin ön koşuludur (singleton imzası önce genişletilmeli).
- Görev 4 ve Görev 5 bağımsızdır, herhangi bir sırada yapılabilir.
- Görev 6, kod değişikliği içeren tüm görevlerden sonra çalışır.
- Görev 7 en sonda, yalnızca gözlem amaçlı.


```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2.1", "2.2", "2.3", "3", "4", "5.1"] },
    { "wave": 3, "tasks": ["5.2"] },
    { "wave": 4, "tasks": ["6"] },
    { "wave": 5, "tasks": ["7"] }
  ]
}
```

## Tasks

- [x] 1. `getDynamoClient()` singleton'ını opsiyonel config alacak şekilde genişlet
  - `shared/dynamo.ts`'de `getDynamoClient(options?: { maxAttempts?: number })` imzasını uygula
  - Özel config verildiğinde ayrı örnek, verilmediğinde paylaşılan singleton dönsün
  - `npm run test:backend` ile mevcut davranışın korunduğunu doğrula
  - _Requirements: 1.1, 1.2_

- [x] 2. Standart DynamoDB çağrılarını singleton'a migrate et (özel-config olmayanlar)
- [x] 2.1 `admin/*` dosyalarını migrate et
  - `admin/analytics.ts` (6), `admin/management.ts` (2), `admin/moderation.ts` (5), `admin/users.ts` (5), `admin/finance.ts` (1), `admin/system.ts` (2) içindeki `new DynamoDBClient({ region: process.env.AWS_REGION })` → `getDynamoClient()`
  - Gereksiz `DynamoDBClient` import'larını kaldır
  - `npm run test:backend`
  - _Requirements: 1.1, 1.3, 1.4_
- [x] 2.2 `routes/index.ts` içindeki 11 çağrıyı migrate et
  - Tüm `new DynamoDBClient({ region: process.env.AWS_REGION })` → `getDynamoClient()`
  - `npm run test:backend` (routes testleri yeşil kalmalı)
  - _Requirements: 1.1, 1.3, 1.4_
- [x] 2.3 `ws/*` ve `auth.ts` çağrılarını migrate et
  - `ws/onconnect.ts`, `ws/ondisconnect.ts`, `ws/onmessage.ts`, `shared/auth.ts` (2 çağrı — `{ region }`)
  - auth.ts "dokunursan patlar" alanı: yalnızca client örnekleme satırı değişir, mantık değişmez
  - `npm run test:backend` (auth + ws testleri yeşil)
  - _Requirements: 1.1, 1.3, 1.4_

- [x] 3. Özel-config DynamoDB çağrılarını istisna tablosuna göre migrate et
  - `shared/ai-operations.ts` → `getDynamoClient({ maxAttempts: 1 })`
  - `ai/training-worker.ts` → `getDynamoClient({ maxAttempts: 2 })`
  - `operations/tracker-worker.ts` → `getDynamoClient()` (fallback AWS_REGION ile eşdeğer)
  - `kb-ingest/index.ts` → REGION sabiti AWS_REGION ile aynıysa `getDynamoClient()`, değilse yorumla gerekçelendir
  - Her dosyadan sonra `npm run test:backend`
  - _Requirements: 1.2, 1.3, 1.4_

- [x] 4. Konfigürasyon fallback tutarlılığını doğrula ve belgele
  - `cognito.ts:269` API GW fallback'inin `api-client.ts` `API_ENDPOINT` ile aynı olduğunu doğrula
  - `email-templates.ts`'in `process.env.APP_URL` kullandığını doğrula (değişiklik gerekmezse belgele)
  - Bulguları `docs/development/audit-status.md`'ye yaz
  - `npm run typecheck`
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 5. `discoverCity` SSRF korumasını güçlendir ve test ekle
- [x] 5.1 URL-encode garantisi
  - `places/index.ts` → `discoverCity`'ye giden `city`/`country`'nin dış URL'de encode edildiğini doğrula; collector katmanında eksikse `encodeURIComponent` ekle
  - Mevcut injection/URL-şeması reddi guard'ını koru
  - _Requirements: 3.1, 3.2, 3.3_
- [x] 5.2 Doğrulama testi ekle
  - `infra/lambda/tests/places.test.cjs`'e: (a) injection karakterli şehir reddi, (b) URL şemalı girdi reddi, (c) geçerli girdinin encode edilmesi için test
  - `npm run test:backend`
  - _Requirements: 3.3, 3.4_

- [x] 6. Web ve admin panel sıfır-hata doğrulaması
  - `npm run typecheck` → 0 hata
  - `npm run build` → statik export 0 hata
  - Admin panelinin tüm sekmelerinin (overview, modules, credits, users, routes, payments, reports, audit, system, workspace) tip-güvenli derlendiğini doğrula
  - `npm run test:all` → 0 başarısızlık
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 7. AWS canlı çalışma doğrulaması (yalnızca gözlem)
  - `npm run monitor:synthetics` çalıştır, canary sonuçlarını topla
  - Sağlıklı/sağlıksız endpoint'leri `docs/development/audit-status.md`'ye raporla
  - Başarısız canary varsa kök neden analizi yaz (düzeltme ayrı iş olabilir)
  - Hiçbir deploy / terraform apply / tablo değişikliği YAPMA
  - _Requirements: 5.1, 5.2, 5.3, 5.4_


## Notes

- auth.ts ve billing çekirdeği "dokunursan patlar" alanıdır: yalnızca client örnekleme satırı değişir, iş mantığına dokunulmaz; her adımda `npm run test:backend` çalıştırılır.
- Görev 7 hiçbir koşulda canlı AWS altyapısını değiştirmez (deploy/terraform/tablo yok) — yalnızca synthetics gözlemi.
- Her kod görevi ayrı commit olarak ele alınmalı; bir görev başarısız olursa sonraki göreve geçilmeden düzeltilir.
