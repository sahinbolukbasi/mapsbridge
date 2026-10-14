# MapsBridge (AdresKöprü) — Kapsamlı Sistem Analizi ve Hedef Mimari Refactoring Planı

> **Durum:** Aşama 1 — Kod Değişikliği Öncesi Eksiksiz Sistem Analizi ve Geçiş Planı  
> **Tarih:** 26 Eylül 2026  
> **Hedef:** Mevcut çalışan özellikleri ve iş mantığını %100 koruyarak; SOLID, Domain-Driven Design (DDD), Clean Architecture, Multi-Agent AI ve Monorepo standartlarına aşamalı (strangler fig) geçiş.

---

## 1. Current System Summary (Mevcut Sistemin Özeti)

### 1.1 Sistemin Amacı
**MapsBridge (AdresKöprü)**; harita merkezli, yapay zekâ (AWS Bedrock) destekli, gizlilik ve açık rıza odaklı, çok günlük seyahat rotası planlama, gerçek zamanlı koordinasyon ve güvenli süreli konum paylaşım platformudur.

Sistem, gizli arka plan takibi yapmaz; kullanıcının açık rızasıyla seçtiği pinleri, rotaları ve profilleri süreli veya kalıcı olarak paylaşmasına olanak tanır.

### 1.2 Kullanıcı Yetenekleri ve İşlemleri
1. **Harita Masası (Desk):** İnteraktif harita (Leaflet) üzerinde adres arama, pin bırakma, mekan detaylarını inceleme, OSRM motoru ile rota mesafesi ve süresi hesaplama.
2. **Çok Günlük Gezi Planlayıcı (Trip Planner):** Gün bazlı durak gruplama, sürükle-bırak durak sıralama, rota kilitleri, zaman çizelgesi optimizasyonu.
3. **Süreli Konum Paylaşımı (`/k/?kod=...`):** 1 saatten 7 güne kadar geçerli, 6 haneli tahmin edilemez kodla konum paylaşma, alıcıya sadece izinli verileri gösterme, tek tıkla anında yayından kaldırma (`revoke`).
4. **AI Seyahat Asistanı (`/ai`):** AWS Bedrock (Claude 3 Haiku / Nova) tabanlı çoklu ajan mimarisi ile kişiselleştirilmiş rota üretimi, sohbet, eksik parametre netleştirme (`clarify`), tercih hafızası (`memory-service`), harita masasına tek tıkla aktarım.
5. **Gezgin Profili & Topluluk:** Kamusal profil oluşturma (`/[username]`), topluluk rotalarını vitrinde inceleme ve kendi masasına kopyalama, blog/yazı paylaşımı.
6. **Gerçek Zamanlı Mesajlaşma (`/mesajlar`):** WebSocket tabanlı gezi grubu koordinasyonu, rota ve koordinat pin kartları paylaşımı.
7. **Pazar Yeri (Marketplace):** Gezi rehberleri ve blog içeriklerini yayınlama, satın alma, Stripe ile güvenli ödeme.
8. **Yönetim Masası (`/admin`, `/u/admin`):** Sistem metrikleri, FinOps maliyet ve token tüketimi izleme, kullanıcı askıya alma/açma, iade yönetimi, içerik moderasyonu.

### 1.3 Teknoloji Yığını (Gerçek Çalışan Kod Kaynaklı)
- **Frontend:** Next.js 16.3.4, React 19.0.0, Leaflet 1.9.4, TypeScript 5.8, QRCode React. Saf Vanilla CSS (Tailwind kullanılmıyor). Next.js statik SPA çıktısı (`output: "export"`) olarak derlenip AWS S3 + CloudFront üzerinden servis ediliyor.
- **Backend:** 
  - AWS Lambda (Node.js 22, ARM64 / Graviton), `esbuild` ile paketlenen modüller (`auth`, `routes`, `chat`, `marketplace`, `stripe`, `admin`, `ai`).
  - API Gateway HTTP API (v2) ve WebSocket API ($connect, $disconnect, send_message, typing, mark_read).
  - *Legacy Kalıntı:* `services/api/` altında Python 3.12 (FastAPI) servisi ve `infra/lambda/handler.py` (33.4KB Python monolit).
- **Veritabanı:** 
  - **Aktif Birincil:** Amazon DynamoDB Tek Tablo Tasarımı (`adreskopru-{env}-data`), Partition Key (`PK`) ve Sort Key (`SK`), Pay-Per-Request (On-Demand), TTL ile otomatik temizlik.
  - **WebSocket Oturumları:** `adreskopru-{env}-connections` DynamoDB tablosu (`expiresAt` TTL).
  - *Terraform'da Tanımlı Pasif Katman:* Aurora Serverless v2 PostgreSQL 17 (PostGIS) ve ElastiCache Serverless Redis (`infra/terraform/modules/database/`).
- **Kimlik Doğrulama:** Amazon Cognito User Pool (`email` tabanlı, doğrulama kodlu) + Google OAuth 2.0 Token Client + Node tarafında `getVerifiedUser` JWT imza/süre doğrulaması.
- **Asenkron Kuyruk & Background Jobs:** AWS SQS (Stripe Webhook olayları için ana kuyruk ve DLQ), Node.js `memory-worker.ts` arka plan asistan işleri.
- **Yapay Zekâ (AI / LLM):** AWS Bedrock Runtime & Agent Runtime (Claude 3 Haiku, Amazon Nova Micro), AWS Geo Places API, Google Places entegrasyonu, Yerel & Uzak Seyahat RAG Bilgi Bankası.
- **Ödeme:** Stripe Checkout Sessions, Customer Portal, Webhook Signature Verification (`stripe-signature`).
- **Test Altyapısı:** Node.js yerleşik test runner (`node --test`), 110 adet geçen test (0 hata), Playwright e2e/mobil test suite'i.

---

## 2. Current Architecture (Mevcut Mimarinin Haritası)

### 2.1 Mevcut Sistem Akış Şeması

```text
                               ┌─────────────────────────────┐
                               │    Kullanıcı (Tarayıcı)     │
                               └──────────────┬──────────────┘
                                              │
                        ┌─────────────────────┴─────────────────────┐
                        │                                           │ (Statik Varlıklar)
                        ▼ (API & WS İstekleri)                      ▼
         ┌───────────────────────────────┐            ┌───────────────────────────┐
         │ CloudFront / API Gateway (v2) │            │   CloudFront CDN + S3     │
         └──────────────┬────────────────┘            │ (Next.js 16 SPA Export)   │
                        │                             └───────────────────────────┘
         ┌──────────────┴────────────────────────┬─────────────────────────────┐
         │ (HTTP REST / JSON)                    │ (WSS)                       │ (OAuth/Auth)
         ▼                                       ▼                             ▼
┌─────────────────────────────────┐   ┌───────────────────────┐   ┌──────────────────────────┐
│      AWS Lambda Handlers        │   │   WebSocket Lambda    │   │      Amazon Cognito      │
│  (Node.js 22 Graviton ARM64)    │   │  (Oturum & Mesajlaşma)│   │  (User Pool, JWT Verify) │
│                                 │   └───────────┬───────────┘   └─────────────┬────────────┘
│ ├── auth (Profil, şifre, reset) │               │                             │
│ ├── routes (OSRM, duraklar, gün)│               │                             │
│ ├── ai (Multi-agent supervisor) │               │                             │
│ ├── stripe (Checkout, portal)   │               │                             │
│ ├── marketplace (Rehber, blog)  │               │                             │
│ └── admin (Metrik, FinOps, log) │               │                             │
└────────────────┬────────────────┘               │                             │
                 │                                │                             │
                 ├────────────────────────────────┴─────────────────────────────┤
                 │                                                              │
                 ▼                                                              ▼
┌─────────────────────────────────┐                           ┌──────────────────────────────────┐
│      Amazon DynamoDB Data       │                           │      Dış Servis Entegrasyonları  │
│ (Single-Table Design: PK/SK/TTL)│                           │                                  │
│                                 │                           │ ├── AWS Bedrock (Claude 3/Nova)  │
│ ├── USER#<sub> / ROUTE#<id>     │                           │ ├── AWS Geo Places & Google Maps │
│ ├── SHARE#<code> / METADATA     │                           │ ├── Project OSRM (Yol Tarifi)    │
│ ├── THREAD#<id> / CHAT#<id>     │                           │ ├── Stripe API & Webhook (SQS)   │
│ ├── BILLING#CHECKOUT#<id>       │                           │ └── Amazon SES (E-posta Kodları) │
│ └── SYSTEM#CONFIG / META        │                           └──────────────────────────────────┘
└─────────────────────────────────┘
```

### 2.2 Mevcut Gelir ve Kredi Akış Şeması

```text
User
 │
 ├──► Kayıt & E-posta Doğrulama ──► +5 Hoş Geldin Kredisi (Welcome Gift)
 │
 ├──► Ücretli Paket Seçimi
 │     ├── Abonelik (Subscription): Explorer (100 Kredi), Pro (500 Kredi), Agency (2500 Kredi)
 │     └── Kredi Paketi (One-time): 50, 300, 1000, 3000 Kredi
 │
 ├──► Stripe Checkout Session (İdempotency-Key & Server Price Validation)
 │     │
 │     ▼
 │    Stripe Payment Processed
 │     │
 │     ▼ Webhook (stripe-signature kontrolü)
 │    AWS SQS ──► Stripe Lambda Handler
 │     │
 │     ▼ Atomik DynamoDB İşlemi
 │    USER#<sub> STRIPE_CUSTOMER & WALLET (Kredi Yükleme + RECEIPT)
 │
 └──► Özellik Kullanımı (Usage & Metering)
       │
       ├──► AI Netleştirme (Clarify) ────► 0 Kredi (Ücretsiz)
       ├──► AI Seyahat Sohbeti (Chat) ──► 1 Kredi
       └──► AI Rota Üretimi (Route)  ──► 5 Kredi
             │
             ▼ Atomik Rezervasyon Akışı
            reserveAI(sub, requestId) ──► Bedrock Multi-Agent ──► finishAI(deduct/refund)
```

---

## 3. Business Model (İş Modeli ve Birim İktisadı)

### 3.1 Ürün ve Hedef Kitle
- **Problem:** Seyahat planlaması parçalıdır; rota çizimi harita araçlarında, otel/ulaşım ayrı sekmelerde, gezi tavsiyeleri AI sohbet pencerelerinde kaybolur. Ayrıca kullanıcılar konumlarını üçüncü parti reklam takipçilerine kaptırmadan güvenle paylaşmak ister.
- **Kullanıcı Kitlesi:** Bireysel gezginler, rota hazırlayan seyahat tutkunları, gezi grupları, seyahat bloggerları ve butik seyahat danışmanları/ajansları.

### 3.2 Gelir Modelleri
1. **Abonelikler (MRR):**
   - **Explorer:** 199 TL/ay (100 Kredi/ay)
   - **Pro:** 499 TL/ay (500 Kredi/ay + Öncelikli Model + Rota İndirme)
   - **Agency:** 1.499 TL/ay (2.500 Kredi/ay + Toplu Rota Yönetimi)
2. **Kredi Paketleri (Kullandıkça Öde / Pay-as-you-go):**
   - Başlangıç (50 Kredi): 89 TL
   - Popüler (300 Kredi): 299 TL
   - Gezgin Usta (1.000 Kredi): 749 TL
   - Pro Kaşif (3.000 Kredi): 1.899 TL
3. **Pazar Yeri (Marketplace Komisyonu):** Gezginlerin hazırladığı özel rotaların ve rehberlerin satışından platform komisyonu (%15-%20).

### 3.3 Birim Maliyet (FinOps & Unit Economics)

```text
Kullanıcı Geliri (1 AI Rota = 5 Kredi ≈ 4,50 TL ortalama)
 - AWS Bedrock Maliyeti (Input/Output Token Claude 3 Haiku: ~0,05 - 0,15 TL)
 - AWS Geo Places / Google Maps API Maliyeti: (~0,10 - 0,30 TL)
 - DynamoDB Okuma/Yazma (WCU/RCU payı: ~0,001 TL)
 - Lambda & CloudFront Trafik Maliyeti: (~0,005 TL)
 - Stripe Komisyonu (%2,9 + sabit ücret): (~0,35 TL)
 = Brüt Kâr Marjı (Gross Margin): %80 - %88
```

---

## 4. Problems (Teknik Borçlar ve Mimari Problemler)

1. **Katman Sınırı İhlali (Coupling):**
   - `apps/web/server/ai-handler.ts` Next.js frontend projesinin içinde bulunmasına rağmen Lambda fonksiyonu olarak derleniyor.
   - `infra/lambda/src/ai/index.ts` dosyası doğrudan `../../../../apps/web/server/ai-handler` dosyasını import ediyor.
   - `apps/web/server/ai-handler.ts` ise `../../../infra/lambda/src/shared/auth` ve `billing/store` dosyalarını çağırıyor. İki ayrı katman birbirine kördüğüm şeklinde bağlanmış durumda.
2. **Çift Backend ve Ölü Kod Kalıntıları:**
   - `services/api/` altında eski FastAPI (Python) servisi duruyor.
   - `infra/lambda/handler.py` içinde 33.4KB'lık eski Python monolit kodu var.
   - Aktif sistem tamamen TypeScript/Node.js 22 Lambdalarına geçmiş olmasına rağmen bu dosyalar repo içinde kafa karışıklığı yaratıyor.
3. **Veritabanı Çelişkisi ve Maliyet Riski:**
   - Çalışan kod DynamoDB Single-Table kullanıyor.
   - Terraform içinde (`infra/terraform/modules/database/main.tf`) Aurora Serverless v2 PostgreSQL 17 (PostGIS) ve ElastiCache Redis tanımlanmış. Bu durum VPC ve altyapı maliyetini şişirme riski taşıyor ve hangi veritabanının gerçek kaynak olduğu konusunda belirsizlik yaratıyor.
4. **State ve Depolama İkiliği:**
   - Frontend `localStorage` üzerinde `mapsbridge.travelPlanner` ve `user-storage.ts` tutarken, aynı zamanda bulut `USER#<sub>/ROUTE#<id>` kayıtları yapıyor. Çevrimdışı/çevrimiçi durumlarında veri senkronizasyonu merkezi bir repository/store katmanından yönetilmiyor.
5. **Organizasyon / Multi-Tenancy Eksikliği:**
   - Tablolar yalnızca bireysel `USER#<sub>` bazlı tasarlanmış. B2B / Ajans abonelikleri için `ORGANIZATION#<orgId>` seviyesinde tenant izolasyonu ve rol bazlı erişim kontrolü (RBAC) henüz bulunmuyor.

---

## 5. Security Risks (Güvenlik Riskleri ve İnceleme)

1. **Doğrulanmış Kimlik vs. Kaynak Sahipliği:**
   - `auth.ts` Cognito token'ını güvenle doğruluyor; ancak endpoint bazında kullanıcının yalnızca kendi `ROUTE` veya `THREAD` nesnesine eriştiğini garanti eden Policy/Guardian mekanizması controller seviyesinde dağınık şekilde yapılıyor.
2. **Korsan/Süresi Dolmuş Paylaşım Linkleri:**
   - `/k/?kod=...` paylaşımlarında DynamoDB TTL silinene kadar alıcı tarafında maskeleme `shared/` katmanında yapılıyor; hassas koordinatların alıcıya sızmaması için DTO seviyesinde sıkı filtreleme sürdürülmeli.
3. **Secret Yönetimi:**
   - Stripe anahtarları ve AWS konfigürasyonları ortam değişkenleri ve SSM Parameter Store üzerinden okunuyor. Repository içinde hardcoded secret bulunmuyor (güvenli). Ancak `.env.local` ve benzeri dosyaların `.gitignore` dışına çıkmaması kuralı sıkılaştırılmalı.
4. **Rate Limiting:**
   - API Gateway seviyesinde throttling var; ancak unauthenticated endpoint'ler (`/shares/{code}`, `/profiles/{username}`) için IP bazlı rate limit altyapısı CloudFront WAF veya Redis ile güçlendirilmeli.

---

## 6. Target Architecture (Hedef Mimari & Clean Architecture)

Sistem; gereksiz microservice karmaşasına girilmeden, **Modüler Monorepo + Clean Architecture + DDD (Domain-Driven Design)** prensipleriyle yapılandırılmalıdır:

```text
User / Client
     │
     ▼
API Layer (Transport / Controller / Routing / HTTP / WS)
     │
     ▼
Application Layer (Use-Cases, Commands, Queries, DTOs, Handlers)
     │
     ▼
Domain Layer (Pure Business Logic: Entities, Value Objects, Domain Events, Interfaces)
     │
     ▲
Infrastructure Layer (DynamoDB Adapter, Bedrock Client, Stripe SDK, Cognito Adapter, OSRM)
```

### Katman Sorumlulukları
- **Domain Katmanı:** Sıfır dış bağımlılık. DynamoDB, Stripe, AWS, HTTP bilmez. Saf TypeScript tipleri, seyahat planı doğrulama kuralları, kredi düşüm kuralları, seyahat profili mantığı.
- **Application Katmanı:** Use-case bazlı akışlar (`CreateTripCommand`, `ReserveAICreditsCommand`, `PublishProfileCommand`, `ProcessStripeWebhookCommand`).
- **Infrastructure Katmanı:** Dış servis adaptörleri (`DynamoDBRepository`, `BedrockSupervisorClient`, `StripeBillingGateway`, `CognitoAuthService`).
- **API Katmanı:** AWS Lambda event'lerini alan, yetkilendirmeyi kontrol eden, DTO doğrulaması yapan ve Application katmanına delege eden ince controller katmanı.

---

## 7. Target Folder Structure (Önerilen Monorepo Klasör Yapısı)

```text
/
├── apps/
│   ├── web/                        # Next.js 16 SPA Frontend (Vanilla CSS, Leaflet)
│   │   ├── src/
│   │   │   ├── app/                # Sayfalar ve Sayfa Rotaları
│   │   │   ├── features/           # Domain/Feature bazlı UI bileşenleri
│   │   │   │   ├── auth/           # Giriş, kayıt, doğrulama
│   │   │   │   ├── trip-planner/   # Harita masası, duraklar, OSRM
│   │   │   │   ├── ai-assistant/   # AI chat, rota kartları, netleştirme
│   │   │   │   ├── billing/        # Paketler, cüzdan, Stripe modal
│   │   │   │   ├── profile/        # Gezgin profili, ayarlar
│   │   │   │   ├── messaging/      # Canlı mesajlaşma
│   │   │   │   └── admin/          # Admin dashboard, FinOps
│   │   │   ├── components/         # Shared atomik UI bileşenleri
│   │   │   ├── hooks/              # Custom React hook'ları
│   │   │   └── services/           # Merkezi API istemcileri (contracts ile tiplendirilmiş)
│   │   └── package.json
│   │
│   └── backend/                    # Birleşik Serverless Backend Lambdaları
│       ├── src/
│       │   ├── Domain/             # Saf İş Mantığı (Entities, Rules, Value Objects)
│       │   │   ├── Identity/
│       │   │   ├── Trip/
│       │   │   ├── AI/
│       │   │   ├── Billing/
│       │   │   └── Messaging/
│       │   │
│       │   ├── Application/        # Use-Cases, Commands, Queries, Handlers
│       │   │   ├── Trip/
│       │   │   ├── AI/
│       │   │   ├── Billing/
│       │   │   └── Admin/
│       │   │
│       │   ├── Infrastructure/     # Dış Adaptörler
│       │   │   ├── Database/       # DynamoDB Single-Table Repository
│       │   │   ├── AI/             # Bedrock Multi-Agent, Geo Places
│       │   │   ├── Billing/        # Stripe SDK Adaptörü
│       │   │   └── Auth/           # Cognito JWT Validator
│       │   │
│       │   └── Api/                # Lambda Handlers (Transport Layer)
│       │       ├── auth/
│       │       ├── routes/
│       │       ├── ai/
│       │       ├── stripe/
│       │       ├── chat/
│       │       ├── marketplace/
│       │       └── admin/
│       │
│       └── package.json
│
├── packages/
│   ├── contracts/                  # API İstek/Yanıt Tipleri & JSON Schemas
│   ├── shared/                     # Ortak Yardımcılar, Hata Sınıfları, Tarih Formatları
│   └── ui/                         # Ortak Stil Sabitleri, İkonlar, Temalar
│
├── infrastructure/
│   ├── terraform/                  # Terraform Altyapı Tanımları
│   │   ├── modules/
│   │   └── environments/
│   └── scripts/                    # Derleme, Test, FinOps ve Doğrulama Betikleri
│
├── tests/
│   ├── unit/                       # Domain ve Use-Case testleri
│   ├── integration/                # Lambda + DynamoDB mock testleri (Mevcut 110 test)
│   ├── e2e/                        # Playwright seyahat akış testleri
│   └── security/                   # Token, Yetki, Webhook İmza testleri
│
├── docs/                           # Detaylı Mimari ve Süreç Dokümantasyonu
│   └── adr/                        # Architecture Decision Records
│
├── agents/                         # Uzman AI Agent Rolleri ve Sözleşmeleri
│   ├── architect.md
│   ├── planner.md
│   ├── backend.md
│   ├── frontend.md
│   ├── database.md
│   ├── devops.md
│   ├── security.md
│   ├── test.md
│   └── sre.md
│
├── AGENTS.md                       # Ana AI Agent Geliştirme Sözleşmesi
├── docs/product/overview.md                      # Proje Tanımı ve Vizyonu
├── docs/architecture/system.md                 # Sistem Mimarisi ve Veri Akışları
├── docs/product/business-model.md               # İş ve Kredi Modeli
├── docs/architecture/domain.md                       # Bounded Context Sınırları
├── docs/development/coding-standards.md                        # Kodlama Standartları ve Kurallar
├── docs/development/workflow.md                     # Görev Yönlendirme ve Akış
├── docs/development/tasks.md                        # İş Listesi ve Geliştirme Durumu
├── docs/architecture/decisions.md                    # Mimari Karar Kayıtları (ADR Özetleri)
├── docs/operations/security.md                     # Güvenlik ve KVKK/GDPR Prensipleri
├── docs/development/testing.md                      # Test Stratejisi
├── docs/operations/deployment.md                   # Dağıtım ve CI/CD Rehberi
└── README.md                       # Genel Giriş Dokümanı
```

---

## 8. Migration Strategy (Aşamalı Geçiş ve Strangler Fig Stratejisi)

Çalışan sistem asla bozulmayacak, her faz tamamlandığında `npm test && npm run test:backend` çalıştırılacak ve **110/110 test yeşil** kalacaktır:

### Phase 1 — Naming Standardization (İsimlendirme Standardizasyonu)
- Kod tabanındaki Türkçe teknik isimleri İngilizce standartlarına kavuşturma.
- Magic string'ler ve magic number'lar yerine strongly-typed enum/constants kullanma (`packages/contracts` ve domain modelleri).
- UI dili Türkçe kalırken, değişken, fonksiyon, sınıf ve DTO isimlerini İngilizce yapma.

### Phase 2 — Folder and Namespace Cleanup (Klasör ve Namespace Düzenlemesi)
- Monorepo `workspaces` düzeninin standardize edilmesi (`apps/web`, `packages/contracts`, `packages/shared`).
- `apps/web/server` ve `infra/lambda` arasındaki modül yollarının netleştirilmesi.
- Karışık veya geçici isimlendirmelerin temizlenmesi.

### Phase 3 — Domain Boundary Refactoring (Domain Sınırları ve Zengin Modeller)
- `Domain/` mantığının anemic modelden (düz POJO) çıkarılarak invariantları koruyan zengin varlıklara (`Trip`, `Wallet`, `RouteStop`) dönüştürülmesi.
- Bounded context sınırlarının (`Identity`, `Trip`, `AI`, `Billing`, `Messaging`, `Marketplace`, `Admin`) ayrıştırılması.

### Phase 4 — Application Layer Cleanup (Use-Case Odaklı Katman)
- Monolitik servisler yerine Use-Case komut ve sorguları (`Commands`, `Queries`, `Handlers`).
- İdempotent kredi rezervasyonu (`ReserveAICreditsUseCase`) ve ödeme işleme use-case'lerinin standartlaştırılması.

### Phase 5 — Infrastructure Isolation (Altyapı İzolasyonu ve Bağımlılık Yönü)
- DynamoDB, Bedrock, Stripe, Cognito adaptörlerinin arayüzler (`IRepository`, `IPaymentGateway`, `IAIProvider`) arkasına alınması.
- Dairesel bağımlılıkların (özellikle `ai-handler` ⇄ `infra/lambda`) sıfırlanması.

### Phase 6 — Frontend Refactoring (Feature-Driven UI & Devasa Dosyaların Parçalanması)
- `apps/web/app/topluluk/page.tsx` (3.346 satır), `panel/page.tsx` (2.727 satır), `mesajlar/page.tsx` (1.946 satır) God Component'larının feature modüllerine ayrılması (`features/community/`, `features/trip-planner/`, `features/messaging/`).
- Saf Vanilla CSS modülleri ve custom hook'lar ile UI ve iş mantığının ayrıştırılması.

### Phase 7 — Testability Improvements (Test Edilebilirlik İyileştirmeleri)
- Global/static state bağımlılıklarının azaltılması.
- Mock edilebilir gateway/repository abstraction'ları ile test kapsamının korunması ve genişletilmesi.

### Phase 8 — Static Analysis and Quality Gates (Statik Analiz ve Kalite Kapıları)
- `npm run typecheck` (TypeScript strict mode) ile 0 hata standardı.
- Test piramidi: `npm test && npm run test:backend` ile 110 test doğrulaması.
- `npm run eval:ai` ile Bedrock multi-agent güvenlik ve diyalog değerlendirmesi.

### Phase 9 — Dead Code Cleanup (Ölü ve Kullanılmayan Kodların Temizliği)
- Kullanılmayan importlar, artık referans verilmeyen geçici fonksiyonlar ve ölü dosyaların tespiti ve güvenli temizliği.
- Legacy referansların kontrollü belgelenmesi.

### Phase 10 — Final Validation & Reporting (Nihai Doğrulama ve Rapor)
- Uçtan uca sistem testi, derleme (`npm run build`) kontrolü.
- `docs/reports/refactoring-2026-09-26.md` oluşturulması (Before, Changes, After, Breaking Changes).

---

## 9. Documentation Strategy (Oluşturulacak `.md` Dosyaları)

1. `AGENTS.md`: Agentların repo üzerinde çalışma kuralları, dosya erişim yetkileri, handoff protokolleri.
2. `docs/product/overview.md`: Projenin amacı, vizyonu, kapsamı, kullanıcı yolculukları.
3. `docs/architecture/system.md`: Sistem topolojisi, Clean Architecture katmanları, veri akışları.
4. `docs/product/business-model.md`: Fiyatlandırma, paketler, kredi muhasebesi, FinOps maliyet hesabı.
5. `docs/architecture/domain.md`: Bounded context tanımları (`Identity`, `Trip`, `AI`, `Billing`, `Messaging`, `Marketplace`, `Admin`).
6. `docs/development/coding-standards.md`: Kodlama standartları (TypeScript strict, Vanilla CSS, error handling, backward compatibility).
7. `docs/development/workflow.md`: Task routing (Hangi değişiklik hangi adımlardan ve agentlardan geçer).
8. `docs/development/tasks.md`: Güncel görev listesi ve backlog.
9. `docs/architecture/decisions.md`: Mimari kararlar (DynamoDB Tek Tablo, Next.js SPA Export, Graviton ARM64, Bedrock Claude 3).
10. `docs/operations/security.md`: KVKK/GDPR, JWT token doğrulama, Stripe imza kontrolü, veri maskeleme.
11. `docs/development/testing.md`: Test piramidi, test çalıştırma rehberi, kabul kriterleri.
12. `docs/operations/deployment.md`: AWS Terraform dağıtımı, CloudFront önbellek temizliği, Lambda derleme.

---

## 10. AI Development Strategy (Vibe Coding & Multi-Agent Standardı)

### 10.1 Token ve Context Tasarrufu
Bir agent bir task aldığında bütün projeyi context'e yüklemeyecek:
- Database görevi -> Sadece `docs/architecture/domain.md` ve `docs/architecture/database.md`
- Frontend görevi -> Sadece `docs/development/coding-standards.md` ve ilgili `features/` bileşeni
- Altyapı görevi -> Sadece `docs/operations/deployment.md` ve `infrastructure/`

### 10.2 Uzman Roller (`agents/`)
- `architect.md`: Sistem bütünlüğü, katman sınırları, ADR denetimi.
- `planner.md`: Task analizi, etki alanı tespiti, planlama.
- `backend.md`: Domain, Application, Lambda ve Clean Architecture mantığı.
- `frontend.md`: UI bileşenleri, state, Leaflet, erişilebilirlik.
- `database.md`: DynamoDB şeması, PK/SK modelleme, indeksler, TTL.
- `devops.md`: Terraform, CI/CD, build scriptleri, CloudFront/S3.
- `security.md`: Yetki kontrolü, secret tarama, webhook doğrulaması.
- `test.md`: Birim, entegrasyon, regresyon testleri.
- `sre.md`: FinOps, loglama, hata izleme, CloudWatch metrikleri.

---

## 11. Estimated Impact (Değişikliklerin Etki Analizi)

| Değişiklik Alanı | Risk Düzeyi | Beklenen Fayda | Etkilenen Modüller | Migrasyon İhtiyacı |
|---|---|---|---|---|
| **1. Dokümantasyon & Agent Yapısı** | **Düşük (Sıfır Risk)** | Net görev dağılımı, AI modellerinin hatasız kod üretmesi, geliştirici rehberi | Hiçbir kod etkilenmez | Yok |
| **2. Ortak Tipler & Contracts** | **Düşük** | Frontend-Backend arası tip güvenliği, sözleşme garantisi | `apps/web`, `infra/lambda` | Ortak tipler import edilecek |
| **3. AI Handler & Backend Refactoring** | **Orta** | Dairesel importların kalkması, bağımsız test edilebilirlik, Clean Architecture | `server/ai-handler.ts`, `infra/lambda/src/` | Esbuild build path güncellemesi, 110 testin yeşil kalması |
| **4. Eski Python Kodlarının Arşivlenmesi** | **Çok Düşük** | Repo temizliği, gereksiz karmaşanın ve disk yükünün kalkması | `services/api/`, `handler.py` | Arşive kaldırma / temizleme |
| **5. Frontend Feature Modülerleştirme** | **Düşük** | Bakımı kolay, okunabilir ve genişletilebilir UI kodu | `apps/web/app/` | Relative import yollarının düzenlenmesi |
| **6. Altyapı ve FinOps Netleştirmesi** | **Düşük** | AWS fatura kontrolü, kaynakların sadeleşmesi | `infra/terraform/` | Terraform plan/apply doğrulaması |

---

## 12. Sonraki Adım ve Onay

Bu analiz ve plan doğrultusunda:
1. Mevcut hiçbir çalışan iş mantığı bozulmamıştır.
2. 110/110 test çalışır durumdadır.
3. Onayınız ile birlikte **Faz 1: Çekirdek Dokümantasyon Sözleşmeleri (`AGENTS.md`, `docs/product/overview.md`, `docs/architecture/system.md`, `docs/product/business-model.md` vb.) ve `agents/` Uzman Rolleri** oluşturulmaya başlanacaktır.
