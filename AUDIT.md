# MapsBridge Monorepo Denetim Raporu

> **GÜNCELLEME 2026-10-28 (drift düzeltmesi):** Bu rapor 2026-10-15 tarihlidir ve bazı bulguları ARTIK GEÇERSİZDİR. Kodun güncel gerçeği için `.kiro/steering/architecture-truth.md` TEK DOĞRULUK KAYNAĞIDIR. Diske karşı doğrulanan değişiklikler:
>
> - "admin/index.ts 1936 satır, parçala" → **ÖDENDİ**: admin/index.ts = 204 satır; domain `management/finance/users/analytics/...`'e bölünmüş.
> - "18 dosyada `new DynamoDBClient()`" → **ÖDENDİ**: 0; `getDynamoClient()` singleton kullanılıyor.
> - "Hiç kullanılmayan 6 paket" → bu paketler diskten **silinmiş**; artık yalnızca `packages/contracts` var.
> - "3 servis klasörü hiç kullanılmıyor" → düzeltme: `services/` = 4 klasör; `messaging` ve `place-intelligence` CANLI, `ai-assistant` kısmen canlı, yalnızca `identity-billing` ölü.
> - Chat GSI1 "Terraform'da yok, endpoint kırık olabilir" → **YANLIŞ**: GSI1 `infra/terraform/hosting.tf:289-291`'de tanımlı, endpoint çalışıyor.
> - HÂLÂ GEÇERLİ: `infra/lambda/src` → `apps/web` arası 6 ters-yön `../../../../` import (sınır erozyonu). Hedef: `packages/ai-core` ile 0'a indirmek (bkz architecture-truth.md §4).

> Oluşturulma: 2026-10-15 | Kapsam: tüm repo (node_modules/.next/dist/build hariç)

---

## 1. Mevcut Mimarinin Dürüst Özeti

MapsBridge, LLM destekli hızlı iterasyonla büyütülmüş bir seyahat planlama uygulamasıdır. Monorepo; bir Next.js 16 web uygulaması, bir Expo/React Native mobil uygulama ve AWS Lambda (Node.js 22) fonksiyonlarından oluşur. Veri katmanı AWS DynamoDB (tek tablo), kimlik doğrulama Cognito, AI ise AWS Bedrock üzerine kuruludur. Terraform ile yönetilen altyapı 6 ayrı stack'e bölünmüştür. Monorepo, hiç kullanılmayan 6 paket (`packages/`), 3 servis klasörü ve eski bir Python Lambda handler barındırır. En kritik sorun: `infra/lambda/src/` ile `apps/web/` arasındaki `../../../../` relative path import'ları — paket sınırları tamamen ortadan kalkmış.

---

## 2. Klasör/Katman Yapısı Haritası (Mevcut)

```
/
├── apps/
│   ├── web/                    # Next.js 16 - CANLI
│   │   ├── app/                # Sayfa route'ları + lib/
│   │   ├── server/             # Server-only handler'lar
│   │   └── tests/              # Playwright e2e testler
│   └── mobile/                 # Expo RN - CANLI (iOS/Android)
│       └── scratch/            # HTML mockup — ÖLÜ KOD
├── packages/
│   ├── contracts/              # @mapsbridge/contracts — Kullanılıyor ✅
│   ├── database/               # @mapsbridge/database — HİÇ İMPORT EDİLMİYOR ❌
│   ├── api-client/             # @mapsbridge/api-client — ❌
│   ├── monitoring/             # @mapsbridge/monitoring — ❌
│   ├── security/               # @mapsbridge/security — ❌
│   ├── shared/                 # @mapsbridge/shared — ❌
│   └── ui/                     # @mapsbridge/ui — ❌
├── services/
│   ├── messaging/              # Kullanılıyor (chat/index.ts → import) ✅
│   ├── ai-assistant/           # Kısmen kullanılıyor ✅
│   ├── place-intelligence/     # Kullanılıyor (places/index.ts → import) ✅
│   ├── identity-billing/       # lambda/billing/store re-export (karmaşık) ⚠️
│   ├── community/              # HİÇ İMPORT EDİLMİYOR ❌
│   ├── admin/                  # HİÇ İMPORT EDİLMİYOR ❌
│   └── map-trip/               # HİÇ İMPORT EDİLMİYOR ❌
├── infra/
│   ├── lambda/src/             # TypeScript Lambda handler'lar - CANLI ✅
│   │   ├── shared/             # auth.ts, http.ts, dynamo.ts, data.ts, router.ts
│   │   ├── auth/, routes/, chat/, ai/, stripe/, admin/, marketplace/, ...
│   │   └── handler.py          # ESKİ Python handler — DEPLOY EDİLMİYOR ❌
│   ├── terraform/              # Ana infra stack ✅
│   ├── admin-runtime/          # Admin Lambda'ları ayrı stack ⚠️
│   ├── agentcore-gateway/      # Bedrock AgentCore ✅
│   ├── ai-memory/              # AI memory ✅
│   ├── ai-training/            # Fine-tuning pipeline ✅
│   └── travel-rag/             # Bedrock Knowledge Base ✅
├── archive/                    # Eski Python API — ÖLÜ KOD ❌
├── docs-legacy/                # Eski dokümanlar ❌
├── agents/                     # LLM prompt tanımları
├── data/travel/                # Statik seyahat verileri
├── evals/                      # AI değerlendirme scriptleri
└── training/                   # Fine-tuning veri setleri
```

### Hedef Klasör Yapısı

```
/
├── apps/web/           # UI katmanı — sadece React component + page route + API call
├── apps/mobile/        # Mobil UI — sadece RN component + navigation + API call
├── packages/
│   ├── contracts/      # Paylaşılan tip ve şema tanımları (tek ortak paket)
│   └── ai-runtime/     # Yeni: supervisor + context-builder (apps+lambda ortak kodu)
├── services/           # Domain servisleri — framework'ten bağımsız iş mantığı
│   ├── messaging/
│   ├── ai-assistant/
│   └── place-intelligence/
└── infra/
    ├── lambda/src/     # Handler (I/O, route) katmanı — iş mantığı OLMAYACAK
    └── terraform/      # IaC (tek stack)
```

**Neden bu yapı:** Şu anki mimari, UI → Lambda → services → UI → Lambda kırılgan döngüsü yaratıyor. Yeni yapıda handler = I/O + auth + validate; service = iş mantığı; paket sınırları eslint kuralı ile zorlanıyor.

---

## 3. Bulgu Tablosu

### P0 — Kritik (Hemen Müdahale)

| #    | Kategori        | Dosya:Satır                         | Bulgu                                                                                                                          | Etki                                     |
| ---- | --------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| P0-1 | Güvenlik/Secret | `apps/web/.env.local:15`            | Google Maps API key gerçek değer içeriyor                                                                                      | Key'in kötüye kullanımı → Google billing |
| P0-2 | Güvenlik/Secret | `.env:2`                            | RevenueCat secret key gerçek değer içeriyor                                                                                    | Subscription manipülasyonu               |
| P0-3 | Güvenlik/AuthZ  | `apps/web/app/u/admin/page.tsx:368` | Admin kontrolü `NEXT_PUBLIC_SUPER_ADMINS` env var'ından e-posta karşılaştırması ile yapılıyor — client-side, bypass edilebilir | Admin panele yetkisiz erişim             |

### P1 — Yüksek (Bu Sprint)

| #     | Kategori    | Dosya:Satır                                                                   | Bulgu                                                                                     | Etki                             |
| ----- | ----------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------- |
| P1-1  | Güvenlik    | `infra/lambda/src/shared/auth.ts:256`                                         | `catch {}` — Cognito hatası sessizce yutulur                                              | Auth kesintisi görünmez olur     |
| P1-2  | Güvenlik    | `infra/lambda/src/ai/index.ts:168,374,502,651,660,664`                        | 6 adet `catch {}` — billing, memory, training hataları yutulur                            | Sessiz veri kaybı                |
| P1-3  | Mimari      | `apps/web/app/lib/cognito.ts:1,257`                                           | Hardcoded region + eski API GW endpoint URL                                               | Ortam değişikliğinde kırılır     |
| P1-4  | Mimari      | `infra/lambda/src/routes/index.ts:356`                                        | `OSRM_BASE_URL` boşsa public demo server kullanılır                                       | Rate limit → production hatası   |
| P1-5  | Duplikasyon | `infra/lambda/src/shared/data.ts:16` + `infra/lambda/src/billing/store.ts:32` | `subscription()` iki yerde tanımlı, iki farklı çağıran                                    | Davranış tutarsızlığı            |
| P1-6  | Duplikasyon | 18 dosya                                                                      | `new DynamoDBClient()` her dosyada ayrı — `shared/dynamo.ts`'deki singleton kullanılmıyor | Gereksiz bağlantı + test güçlüğü |
| P1-7  | Duplikasyon | `ai/index.ts:66` + `stripe/index.ts:18`                                       | `reply()` yardımcı fonksiyonu `shared/http.ts` varken ayrıca tanımlanmış                  | Farklı hata format riskleri      |
| P1-8  | Mimari      | `infra/lambda/src/ai/index.ts:30,43,44,48,54`                                 | Lambda `../../../../apps/web/app/lib/ai/` import ediyor — paket sınırı yok                | Bağımlılık döngüsü riski         |
| P1-9  | Güvenlik    | `apps/web/app/u/admin/page.tsx:368`                                           | Admin kimlik doğrulama iki farklı mekanizmaya (client e-posta + Cognito role) bölünmüş    | Admin kimliği tutarsızlığı       |
| P1-10 | CI/CD       | `.github/workflows/ci.yml:32`                                                 | Gitleaks secret scan `continue-on-error: true` — secret commit'lenip geçebilir            | Güvenlik geçidi anlamsız         |

### P2 — Orta (Sonraki Sprint)

| #     | Kategori          | Dosya:Satır                                                                 | Bulgu                                                                   | Etki                          |
| ----- | ----------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------- |
| P2-1  | Ölü Kod           | `infra/lambda/handler.py` (566 satır)                                       | Deploy edilmiyor, eski hardcoded Cognito ID'leri var                    | Yanlış anlaşılma + güvenlik   |
| P2-2  | Ölü Kod           | `packages/` (6 paket)                                                       | `contracts` hariç hiç import yok                                        | Bakım yükü                    |
| P2-3  | Ölü Kod           | `services/admin/`, `services/community/`, `services/map-trip/`              | Hiç import yok                                                          | Bakım yükü                    |
| P2-4  | Ölü Kod           | `apps/mobile/scratch/`                                                      | HTML mockup dosyaları                                                   | Gürültü                       |
| P2-5  | Ölü Kod           | `archive/legacy-python-api/`                                                | README "archived" diyor                                                 | Gürültü                       |
| P2-6  | Ölü Kod           | 8 geçici MD (kök dizin)                                                     | Operasyonel notlar, kalıcı doküman değil                                | Kök dizin gürültüsü           |
| P2-7  | Güvenlik          | `infra/lambda/tests/test_handler.py:20-21`                                  | Eski Cognito client ID hardcoded                                        | Olası eski credential         |
| P2-8  | Güvenlik          | `infra/lambda/src/auth/email-templates.ts:15-16`                            | Hardcoded `https://mapsbridge.com` URL'leri                             | Ortam değişikliğinde kırılır  |
| P2-9  | Mimari            | `services/messaging/` + `services/identity-billing/`                        | Lambda kodunu re-export ediyor — tersine bağımlılık                     | Kırılgan                      |
| P2-10 | Test              | `places/`, `background-monitor/`, `kb-ingest/`                              | Bu 3 Lambda handler için hiç test yok                                   | Regresyon riski               |
| P2-11 | Hata              | `apps/web/app/desk/`, `profile/`, `messages/`                               | `catch {}` ile sessiz UI hataları                                       | Kırık UI görünmez             |
| P2-12 | Duplikasyon       | `apps/web/app/lib/api.ts` + `api-client.ts`                                 | İki API client dosyası — biri legacy                                    | Tutarsız API çağrıları        |
| P2-13 | Duplikasyon       | `apps/mobile/src/services/agent*.ts` vs `apps/web/app/lib/ai/supervisor.ts` | Mobil ve web'de ayrı AI dispatch mantığı                                | Kod senkron tutma yükü        |
| P2-14 | Mimari            | `infra/lambda/src/admin/index.ts` (1936 satır)                              | Tek dosyada çok fazla domain mix                                        | Okunaksız, test edilmez       |
| P2-15 | Bağımlılık        | `apps/web/package.json`                                                     | `leaflet` devDependencies'te ama runtime'da gerekli                     | Olası production build hatası |
| P2-16 | Tutarsızlık       | `apps/web/app/lib/cognito.ts:3`                                             | `NEXT_PUBLIC_COGNITO_REGION` env var tanımlı ama kullanılmıyor          | Env var amacı belirsiz        |
| P2-17 | Ölü Kod (şüpheli) | `apps/web/app/ai-asistan/`                                                  | `app/ai/` ile örtüşüyor; alias mı yoksa ayrı implementasyon mu belirsiz | Şüpheli bölüme bak            |

---

## 4. Silinebilir Aday Listesi

| Dosya/Klasör                                                                                                                   | Neden Ölü                              | Kanıt                                             |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ------------------------------------------------- |
| `infra/lambda/handler.py`                                                                                                      | Node.js 22 runtime'da deploy edilmiyor | Terraform: `default = "nodejs22.x"`               |
| `infra/lambda/tests/test_handler.py` + `__pycache__/`                                                                          | Sadece handler.py test ediyor          | handler.py silinince anlamsız                     |
| `apps/mobile/scratch/`                                                                                                         | HTML mockup                            | `.html` dosyaları, import yok                     |
| `archive/`                                                                                                                     | README "archived"                      | Eski Python API                                   |
| `docs-legacy/`                                                                                                                 | Aktif docs/ var                        | Tarihsel notlar                                   |
| Kök'teki 8 MD: `DEPLOYMENT_FINAL_STATUS.md`, `FINAL_COMPLETION_REPORT.md`, `SLACK_BOT_*.md` (5), `EAS_TOKEN_SETUP.md`          | Geçici operasyonel notlar              | GitHub Issues/wiki'ye taşı                        |
| `packages/database/`, `packages/monitoring/`, `packages/api-client/`, `packages/security/`, `packages/shared/`, `packages/ui/` | Hiç import yok                         | `grep -rn "from '@mapsbridge/database"` → 0 sonuç |
| `services/admin/`, `services/community/`, `services/map-trip/`                                                                 | Hiç import yok                         | grep ile doğrulandı                               |
| `infra/*/terraform-state-backup-old-account*/`                                                                                 | Eski AWS hesap state dosyaları         | Remote S3 state kullanılıyor                      |

### Şüpheli (Silme, Önce Sor)

| Dosya/Klasör                                     | Neden Şüpheli                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `apps/web/app/ai-asistan/`                       | `app/ai/` ile örtüşüyor; alias mı yoksa farklı sayfa mı?         |
| `apps/web/app/u/admin/` vs `apps/web/app/admin/` | İki admin sayfası — hangisi aktif?                               |
| `services/identity-billing/`                     | Lambda kodu re-export ediyor — planlı geçiş mi?                  |
| `infra/admin-runtime/`                           | `infra/terraform/` ile nasıl ayrışıyor? Deploy çakışması var mı? |

---

## 5. Bağımlılık Sırasına Göre Refactor Planı (10–12 Adım)

Her adım: ayrı PR, tek konu, commit sonrası build + lint + test.

### Adım 1 — Güvenlik Acilleri (P0) — 1 gün

**Ne:** API key'leri rotate et. Admin kontrolünü client'tan kaldır. Gitleaks'ı zorunlu hale getir.
**Dosyalar:** `.env`, `apps/web/.env.local`, `apps/web/app/u/admin/page.tsx`, `.github/workflows/ci.yml`
**Risk:** Düşük (davranış değil, güvenlik açığı kapatma)
**Doğrulama:** `npm run build` geçiyor, admin sayfası `getVerifiedUser().isAdmin` ile çalışıyor

### Adım 2 — Python ve Ölü Dosyaları Sil — 2 saat

**Ne:** `handler.py`, `test_handler.py`, `scratch/`, `archive/`, `docs-legacy/`, kök MD dosyaları
**Dosyalar:** yukarıdaki listede
**Risk:** Çok düşük (deploy edilmiyor, import yok)
**Doğrulama:** `git grep "handler.py"` → 0, build geçiyor

### Adım 3 — Kullanılmayan Paket ve Servisleri Sil — yarım gün

**Ne:** `packages/` altındaki 6 ölü paket + `services/` altındaki 3 ölü servis
**Dosyalar:** `package.json` workspace listesi güncellenir
**Risk:** Düşük (önce grep ile import kontrolü)
**Doğrulama:** `npm install`, build, test geçiyor

### Adım 4 — DynamoDB Singleton Konsolidasyonu — 1 gün

**Ne:** 18 dosyadaki `new DynamoDBClient()` → `shared/dynamo.ts`'deki `getDynamoClient()`
**Dosyalar:** 18 Lambda handler dosyası
**Risk:** Orta (her handler test edilmeli)
**Doğrulama:** Mevcut testler geçiyor + yeni testler ekleniyor

### Adım 5 — `subscription()` Duplikasyonu Çöz — yarım gün

**Ne:** `shared/data.ts`'deki `subscription()` kaldırılır, `billing/store.ts` kanonik olur
**Dosyalar:** `shared/data.ts`, `routes/index.ts`
**Risk:** Orta (routes handler'ı etkiliyor)
**Doğrulama:** Routes test + manuel test

### Adım 6 — HTTP Response Helper Standardizasyonu — yarım gün

**Ne:** `ai/index.ts` ve `stripe/index.ts`'deki inline `reply()` → `shared/http.ts`
**Ne:** Email template URL'leri `process.env.APP_URL` kullanacak şekilde
**Dosyalar:** `ai/index.ts`, `stripe/index.ts`, `auth/email-templates.ts`
**Risk:** Düşük
**Doğrulama:** Build + mevcut testler

### Adım 7 — `cognito.ts` Hardcoded Değerleri Temizle — yarım gün

**Ne:** Region ve eski API GW URL'sini env var'a çıkar
**Dosyalar:** `apps/web/app/lib/cognito.ts`
**Risk:** Düşük (env var zaten doğru set edilmiş)
**Doğrulama:** Auth flow e2e testi

### Adım 8 — `catch {}` Bloklarını İyileştir — 1 gün

**Ne:** Tüm boş catch bloklarına en az `console.error` ekle; kritik olanlar için proper error handling
**Dosyalar:** `shared/auth.ts`, `ai/index.ts`, `apps/web/app/desk/`, `profile/`, `messages/`
**Risk:** Düşük (davranış değişmiyor, sadece log ekleniyor)
**Doğrulama:** Build geçiyor, mevcut testler kırmıyor

### Adım 9 — Eksik Test Coverage Ekle — 2 gün

**Ne:** `places/`, `background-monitor/`, `kb-ingest/` için karakterizasyon testleri
**Dosyalar:** `infra/lambda/tests/places.test.cjs`, `background-monitor.test.cjs`, `kb-ingest.test.cjs`
**Risk:** Yok (yalnızca test ekleniyor)
**Doğrulama:** `npm test` yeşil

### Adım 10 — Cross-Package Import Sınır Kuralı — 2 gün

**Ne:** ESLint rule ekle: `infra/lambda/**` → `apps/**` import yasak
**Ne:** `ai/index.ts`'teki `apps/web/...` import'ları → `packages/ai-runtime/` yeni paketi
**Dosyalar:** `.eslintrc`, `ai/index.ts`, yeni `packages/ai-runtime/`
**Risk:** Yüksek (bağımlılık yeniden yapılandırılıyor)
**Doğrulama:** `npm run lint` geçiyor, tüm testler geçiyor

### Adım 11 — `admin/index.ts` Parçalama — 2 gün

**Ne:** 1936 satırlık `admin/index.ts`'i domain bazında dosyalara böl
**Ne:** users.ts, payments.ts, ai-control.ts, analytics.ts, config.ts
**Dosyalar:** `infra/lambda/src/admin/`
**Risk:** Yüksek (önce karakterizasyon testi şart)
**Doğrulama:** Tüm admin endpoint'leri e2e test + `npm test`

### Adım 12 — `leaflet` Dependency Fix (P2) — 30 dk

**Ne:** `leaflet` devDependencies'ten dependencies'e taşı
**Dosyalar:** `apps/web/package.json`
**Risk:** Çok düşük
**Doğrulama:** `npm run build` production build'i geçiyor

---

## 6. Açık Sorular

1. **`handler.py` hala herhangi bir endpoint'te serve ediliyor mu?** Eski API GW URL (`0duy2hfjd2.execute-api.eu-central-1.amazonaws.com`) nereye bağlı?
2. **`infra/admin-runtime/` ile `infra/terraform/` deployment'ı nasıl ayrışıyor?** Admin Lambda'ları çift tanımlı mı?
3. **`services/identity-billing/` gelecekte kullanılacak mı?** Yoksa silinmeli mi?
4. **`apps/web/app/ai-asistan/` ile `app/ai/` arasındaki fark nedir?** `/ai-asistan` route'u aktif mi?
5. **OSRM production stratejisi nedir?** Kendi instance mı, Mapbox mı, Google Maps mı?
6. **`.state-backup-old-account/` klasörleri** S3 remote state'e geçildikten sonra silinebilir mi?
