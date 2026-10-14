# Sistem Mimarisi ve Veri Akışları

## 1. Mimari Prensipler

- **Clean Architecture & Separation of Concerns:** İş kuralları (Domain) teknoloji ve framework bağımlılıklarından izoledir.
- **Serverless & Cloud-Native:** AWS Lambda (Graviton ARM64), DynamoDB On-Demand, S3, CloudFront ve API Gateway kullanılarak operasyonel bakım minimuma indirilir.
- **Tek Doğruluk Kaynağı (Single Source of Truth):** Veritabanında DynamoDB Single-Table Design kullanılır; çelişkili veya senkronize olmayan çoklu veritabanı kullanımından kaçınılır.
- **Güvenlik ve Doğrulanmış Kimlik:** İstemciden gelen hiçbir iddia körü körüne kabul edilmez; Cognito User Pool JWT'si ve Stripe imzası sunucu tarafında doğrulanır.
- **FinOps & Kredi Muhasebesi:** AI ve harici API çağrıları öncesinde atomik kredi rezervasyonu yapılır (`reserveAI`), işlem başarısız olursa iade edilir (`finishAI`).

---

## 2. Sistem Topolojisi

```text
                               ┌─────────────────────────────┐
                               │   Kullanıcı Web Tarayıcısı  │
                               └──────────────┬──────────────┘
                                              │
                        ┌─────────────────────┴─────────────────────┐
                        │                                           │
                        ▼                                           ▼
         ┌───────────────────────────────┐            ┌───────────────────────────┐
         │ API Gateway HTTP & WS API v2  │            │     CloudFront CDN + S3   │
         │ (api.mapsbridge.com)          │            │ (Next.js 16 SPA Export)   │
         └──────────────┬────────────────┘            └───────────────────────────┘
                        │
         ┌──────────────┴────────────────────────┬─────────────────────────────┐
         │                                       │                             │
         ▼                                       ▼                             ▼
┌─────────────────────────────────┐   ┌───────────────────────┐   ┌──────────────────────────┐
│        HTTP API Lambdas         │   │   WebSocket Lambda    │   │      Amazon Cognito      │
│  (Node.js 22 ARM64 esbuild)     │   │  (Bağlantı & Mesajlar)│   │ (Kullanıcı Havuzu & JWT) │
│                                 │   └───────────┬───────────┘   └──────────────────────────┘
│ ├── Auth Handler                │               │
│ ├── Routes & Trip Handler       │               │
│ ├── AI Multi-Agent Handler      │               │
│ ├── Stripe Billing Handler      │               │
│ ├── Marketplace Handler         │               │
│ └── Admin / FinOps Handler      │               │
└────────────────┬────────────────┘               │
                 │                                │
                 ├────────────────────────────────┴─────────────────────────────┐
                 │                                                              │
                 ▼                                                              ▼
┌─────────────────────────────────┐                           ┌──────────────────────────────────┐
│      Amazon DynamoDB Data       │                           │    Harici Servis ve Entegrasyon  │
│ (Single-Table Design: PK/SK/TTL)│                           │                                  │
│                                 │                           │ ├── AWS Bedrock (Claude / Nova)  │
│ ├── USER#<sub> / ROUTE#<id>     │                           │ ├── AWS Geo Places & Google Maps │
│ ├── SHARE#<code> / METADATA     │                           │ ├── Project OSRM (Rota & Mesafe) │
│ ├── THREAD#<id> / CHAT#<id>     │                           │ ├── Stripe API (Checkout/Portal) │
│ ├── BILLING#CHECKOUT#<id>       │                           │ └── AWS SQS (Stripe Webhook DLQ) │
│ └── SYSTEM#CONFIG / META        │                           └──────────────────────────────────┘
└─────────────────────────────────┘
```

---

## 3. Katman Sorumlulukları (Clean Architecture)

### 3.1 Domain Katmanı (`Domain/`)
Sistemin kalbidir. Hiçbir dış kütüphaneye, veritabanına, HTTP veya AWS SDK'sına bağımlı değildir.
- **Entities & Value Objects:** `Trip`, `TripDay`, `Stop`, `Coordinate`, `Wallet`, `CreditTransaction`, `UserRole`.
- **Domain Rules:** Kredi yeterlilik kontrolleri, seyahat günü ve durak sınırları, koordinat geçerlilik kuralları (-90/+90 lat, -180/+180 lng).
- **Interfaces:** `ITripRepository`, `IBillingGateway`, `IAIService`, `IAuthService`.

### 3.2 Application Katmanı (`Application/`)
Kullanım senaryolarını (Use-Cases) orkestre eder.
- **Commands & Queries:**
  - `CreateTripCommand`, `UpdateTripDayOrderCommand`, `ShareTripLocationCommand`
  - `ReserveAICreditsCommand`, `ProcessAIStreamCommand`
  - `CreateStripeCheckoutSessionCommand`, `HandleStripeWebhookCommand`
- **Application Services & DTOs:** Giriş verilerini doğrular, domain nesnelerini çağırır ve repository üzerinden durumu kalıcı hale getirir.

### 3.3 Infrastructure Katmanı (`Infrastructure/`)
Dış dünyayla konuşan adaptörleri içerir.
- **Database:** DynamoDB Single-Table DocumentClient adaptörü, transactional write komutları.
- **AI Adaptörleri:** AWS Bedrock Runtime istemcisi, Geo Places istemcisi, RAG ve context builder.
- **Billing:** Stripe Node SDK sarmalayıcısı, idempotency anahtarı yönetimi.
- **Auth:** Cognito User Pool `GetUser` ve JWT doğrulayıcı adaptör.

### 3.4 API Katmanı (`Api/`)
AWS Lambda ve API Gateway transport katmanıdır.
- İstek gövdesini (body) ayrıştırır, HTTP başlıklarından yetki token'ını alır.
- Controller içinde iş mantığı barındırmaz; doğrudan ilgili Application Command/Query Handler'ını tetikler.
- Standartlaştırılmış HTTP yanıtları (`statusCode`, `headers: {'content-type':'application/json'}`, `body`) üretir.

---

## 4. Frontend Mimarisi (`apps/web/`)

Next.js 16 App Router altyapısı üzerinde, statik SPA modunda (`output: "export"`) çalışır.
- **Features Modeli:**
  - `features/trip-planner/`: Harita, Leaflet pinleri, OSRM rota optimizasyonu, sürükle-bırak duraklar.
  - `features/ai-assistant/`: Asistan sohbeti, netleştirme kartları, zengin seyahat planı önizlemesi.
  - `features/billing/`: Kredi satın alma, paket karşılaştırma, Stripe modal yönlendirmesi.
  - `features/messaging/`: WebSocket tabanlı seyahat grubu sohbeti.
- **Stil Yaklaşımı:** Saf Vanilla CSS. Sıfır CSS-in-JS çalışma zamanı maliyeti, yüksek performans ve modern renk paletleri.
- **İstemci Depolama:** Tarayıcı tarafında `localStorage` (çevrimdışı taslaklar) ve sunucu DynamoDB senkronizasyonu.

---

## 5. Mikroservisler ve Paylaşılan Paketler (`services/` & `packages/`)

Sistem monolitik yapıdan kurtarılmış ve kurumsal sınırları net 6 bağımsız mikroservise ve ortak paketlere bölünmüştür:
- **`services/ai-assistant`**: AWS Bedrock, Nova Micro, Claude Haiku, RAG sorgulama ve eğitim verisi boru hattı.
- **`services/identity-billing`**: Cognito kimlik doğrulama, kullanıcı cüzdanı, kredi muhasebesi ve Stripe entegrasyonu.
- **`services/map-trip`**: Harita masası rotaları, durak hesaplama, OSRM rota optimizasyonu ve süreli TTL pin paylaşımı.
- **`services/messaging`**: Gerçek zamanlı WebSocket mesajlaşma, kanal yönetimi ve seyahat grubu sohbeti.
- **`services/community`**: Gezgin profilleri, herkese açık gezi rehberleri ve topluluk pazaryeri.
- **`services/admin-service`**: Moderatör/Destek/Admin denetimi, sistem bakım modu ve audit loglama.
- **`packages/contracts` & `packages/shared`**: Ortak DTO'lar, değer nesneleri ve hata sınıfları.
- **`packages/ui` (`@mapsbridge/ui`)**: Web ve mobil (React Native) için ortak tasarım sistemi belirteçleri ve SVG ikon seti.

---

## 6. Gözlemlenebilirlik ve Dağıtık Telemetri (`monitoring/`)

Bütün sistem operasyonel metrikler, alarmlar ve canlı denetimlerle korunur:
- **CloudWatch Pano & Alarmlar:** `monitoring/dashboards/` ve `monitoring/alarms/` ile P1/P2 hata eşikleri takip edilir.
- **Canary Synthetics:** `monitoring/synthetics/canary-runner.cjs` her 5 dakikada bir CloudFront ve API Gateway uç noktalarını doğrular.
- **X-Ray Dağıtık İzleme:** `monitoring/tracing/` ile her HTTP ve WebSocket isteği `x-correlation-id` ile uçtan uca izlenir.
