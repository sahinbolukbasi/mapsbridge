# Mevcut Durum — Maps Bridge Sistem Keşfi

> Tarih: 2026-10-13 · Keşfeden: Claude Code · Kaynak: repo statik analizi  
> Bu belge yeni platform entegrasyonu için temel çıkarım noktasıdır.

---

## 1. Uygulama Katmanı

### Dil, Framework, Runtime

| Katman           | Teknoloji                              |
| ---------------- | -------------------------------------- |
| Tüm servisler    | TypeScript 5.8+, strict mode           |
| Web frontend     | Next.js 16.3.4, React 19.0.0           |
| Mobil            | Expo 57, React Native 0.86.3, React 19 |
| Backend runtime  | Node.js 22.x, ARM64 (Graviton)         |
| Paket yöneticisi | npm + npm workspaces (monorepo)        |

### Repo Yapısı

Monorepo. Workspaces: `apps/*`, `packages/*`, `services/*`.

```
apps/
  web/          → Next.js 16 SPA + Server Actions
  mobile/       → Expo 57 (iOS + Android)
services/   (DİSK GERÇEĞİ: yalnızca 3 canlı domain servisi)
  ai-assistant/ → AI guardrails/scoring/clustering (kısmen canlı, apps/web üzerinden)
  messaging/    → Gerçek zamanlı sohbet domain/application (canlı)
  place-intelligence/ → Çok kaynaklı mekan toplama ve normalizasyon (canlı)
  # NOT: admin/community/map-trip/identity-billing ARTIK YOK. Gerçek billing/auth/
  # stripe/admin canlı backend'i infra/lambda/src altındadır (bkz. architecture-truth.md).
packages/
  contracts/    → credit-costs.ts, domain tipleri — tek kaynak
  shared/       → Paylaşılan yardımcılar
  api-client/   → API istemcisi
  ui/           → UI bileşenleri
  database/     → Veritabanı yardımcıları
infra/
  terraform/    → Ana altyapı (Lambda, DynamoDB, Aurora, Cognito, Bedrock)
  agentcore-gateway/ → AgentCore Gateway Terraform (AWS provider ~> 6.0)
  ai-memory/    → AgentCore Memory Terraform (AWS provider ~> 6.0)
  lambda/       → Lambda handler kodu (doğrudan deploy edilen)
```

### API Yüzeyi

**HTTP API Gateway v2 (REST)** — GraphQL yok.

Tüm endpoint'ler `infra/terraform/main.tf:43-138` içinde tanımlı:

| Alan        | Endpoint'ler                                                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI          | `POST /ai/route-planner`                                                                                                                            |
| Auth/Profil | `POST /auth/reset-password`, `/auth/change-password`, `/auth/refresh`, `/profile/publish`, `/profile/unpublish`, `GET /profiles/{username}`         |
| Rotalar     | `GET/POST /routes`, `GET/PUT/DELETE /routes/{id}`, `POST /routes/{id}/share`, `GET /routes/{id}/osrm/{profile}`                                     |
| Marketplace | `GET/POST /marketplace/guides`, `/marketplace/blogs`                                                                                                |
| Ödeme       | Stripe: `/stripe/plans`, `/stripe/checkout`, `/stripe/portal`, `/stripe/subscription`, `/stripe/wallet`, `/stripe/balance/topup`, `/stripe/webhook` |
| Admin       | 40+ `/admin/*` endpoint'i                                                                                                                           |
| Chat        | `GET/POST /chat/threads`, `/chat/threads/{id}/messages`                                                                                             |
| WebSocket   | Connect / Message / Disconnect Lambda'ları                                                                                                          |

### Auth Mekanizması

**AWS Cognito User Pool** — merkezi. `infra/lambda/src/shared/auth.ts:39`.

- Her istek için `GetUser` API çağrısıyla **online** token doğrulaması.
- Google / Apple federe kimlik: email'den `canonicalUserIdFromEmail()` ile deterministic user ID üretimi.
- `custom:role` alanıyla admin rolü.
- Süspansiyon: DynamoDB `USER#{userId}` → `META`.suspended kontrolü.
- **Ek rate limiting katmanı yok** (Redis TTL tabanlı tek nokta kontrol).

---

## 2. Mevcut Claude / AI Entegrasyonu

### SDK ve Provider

**AWS Bedrock** kullanılıyor. Doğrudan Anthropic API yok.

SDK: `@aws-sdk/client-bedrock-runtime` → `BedrockRuntimeClient`, `ConverseCommand`.  
Region: `eu-central-1`.  
Dosya: `apps/web/app/lib/ai/bedrock-client.ts`.

### Model Katmanları (4 Tier)

`services/ai-assistant/src/application/model-router.ts:22-55`:

| Tier | Model ID                                       | Kullanım                           | Kredi maliyeti |
| ---- | ---------------------------------------------- | ---------------------------------- | -------------- |
| T1   | `eu.amazon.nova-micro-v1:0`                    | Selamlama, çok kısa soru           | 0 (ücretsiz)   |
| T2   | `eu.amazon.nova-lite-v1:0`                     | Standart sohbet, 1-3 günlük plan   | 0,5 kredi      |
| T3   | `eu.anthropic.claude-haiku-4-5-20251001-v1:0`  | 4+ gün, çok şehir plan             | 2 kredi        |
| T4   | `eu.anthropic.claude-3-5-sonnet-20241022-v2:0` | Yeniden planlama, tam optimizasyon | 5 kredi        |

### Streaming

`ConverseCommand` kullanılıyor ama **synchronous invoke** — streaming endpoint yok.

### Multi-Agent Yapısı

`apps/web/app/lib/ai/supervisor.ts:30`: `runMultiAgentSupervisor()` — 19 alt-ajan:
`art-culture`, `budget-luxury`, `car-rental`, `city-intel`, `city-transit`, `devops`, `discovery`, `dynamic-replanning`, `emergency`, `events-concert`, `flight`, `food`, `hotel-deal`, `lodging`, `nightlife`, `route`, `sports`, `ticket-tracker`, `transit-stay`.

### Prompt Yönetimi

`apps/web/app/lib/ai/prompts.ts:3` — versiyon: `travel-dialogue-v4`.  
`INTAKE_PROMPT` (Türkçe niyet analizi) ve `ANSWER_PROMPT` (İngilizce yanıt, Türkçe JSON araç) ayrı dosyalar.

### Bedrock Guardrails

`infra/terraform/guardrails.tf:4` — `aws_bedrock_guardrail.travel_guardrail`:

- İçerik filtreleri: HATE / VIOLENCE / INSULTS / PROMPT_ATTACK → HIGH
- PII anonimizasyon: EMAIL, PHONE, CREDIT_DEBIT_CARD_NUMBER
- Contextual grounding: 0.70 grounding, 0.65 relevance

**Eksik:** Vize/giriş kurallarında koşulsuz "gidebilirsin" çıktısını engelleyen guardrail tanımı yok (Bölüm 7.4 gereksinimi).

### Bedrock Knowledge Base (RAG)

`infra/terraform/ai.tf:11` — `aws_bedrockagent_knowledge_base.travel`:

- Embedding: `amazon.titan-embed-text-v2:0`
- Backend: OpenSearch Serverless, indeks: `travel-index`
- `enable_bedrock = true` değişkeniyle koşullu — prod'da aktif mi doğrulanmadı.

### AgentCore Memory

`infra/ai-memory/main.tf:30` — `aws_bedrockagentcore_memory.travel`:

- Strateji 1: `TravelPreferences` (USER_PREFERENCE tipi)
- Strateji 2: `TripSummaries` (SUMMARIZATION tipi)
- 30 günlük event expiry
- Ayrı DynamoDB tablosu: `${prefix}-ai-memory` (PAY_PER_REQUEST)

**Durum:** Terraform tanımı mevcut ancak gerçekte deploy edilip edilmediği ve aktif olup olmadığı doğrulanmadı.

### AgentCore Gateway

`infra/agentcore-gateway/main.tf` — `aws_bedrockagentcore_gateway`:

- Lambda tabanlı Places tool (AWS Geo Places API entegrasyonu)
- ARM64, Node.js 22.x

**Durum:** Terraform tanımı mevcut, deploy durumu bilinmiyor.

### Training Data Collector

`services/ai-assistant/src/application/training-collector.ts:22` — Canlı konuşmalardan Nova/Bedrock fine-tuning için JSONL veri topluyor. PII maskeleme var.

---

## 3. Veri Katmanı

### Veritabanları

| Motor                  | Versiyon        | Nerede                      | Ne için                                |
| ---------------------- | --------------- | --------------------------- | -------------------------------------- |
| DynamoDB               | —               | `adreskopru-prod-data`      | Ana tablo (single-table design)        |
| Aurora Serverless v2   | PostgreSQL 17.2 | VPC içi, `modules/database` | Coğrafi sorgular (PostGIS)             |
| ElastiCache Serverless | Redis           | VPC içi                     | Token rate-limit, route cache, session |
| DynamoDB               | —               | `${prefix}-ai-memory`       | AgentCore Memory state                 |

### DynamoDB Şeması (Ana Tablo)

Single-table design, PK/SK:

| PK                   | SK                      | İçerik                     |
| -------------------- | ----------------------- | -------------------------- |
| `PLACE#{city}`       | `{source}#{sourceId}`   | Normalize mekan verisi     |
| `CITY#{city}`        | `DISCOVERY#META`        | Şehir keşif meta           |
| `TRAINING#{city}`    | `{category}#{language}` | Eğitim dokümanı            |
| `PLACE_INDEX#{city}` | `{category}`            | Kategori indeksi           |
| `USER#{userId}`      | `META`                  | Kullanıcı meta/süspansiyon |
| `USER#{userId}`      | `CREDITS`               | Kredi cüzdanı              |
| `USER#{userId}`      | `SUBSCRIPTION`          | Abonelik                   |
| `USER#{userId}`      | `AI_CHAT#{convId}`      | Konuşma geçmişi            |

GSI1: `GSI1PK = PLACE_CAT#{city}`, `GSI1SK = {category}#{name}`.  
TTL alanı: `expiresAt`. Billing: PROVISIONED (5→1000 RCU auto-scaling).

### PostGIS / pgvector

- **PostGIS:** Kurulu (`shared_preload_libraries` içinde).
- **pgvector:** Kurulu DEĞİL. Vektör depolama OpenSearch Serverless üzerinde.
- Aurora şemasında POI, mekan, rota için özel tablo **yok** — bu veriler DynamoDB'de.

### Mevcut Dış Veri Kaynakları ve Kalıcı Depolama

**Bu bölüm entegrasyon riskini doğrudan belirliyor.**

| Kaynak                      | Kullanım                                                                                                               | Kalıcı mı saklanan?                                                                | Risk                                                                                                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google Places API (New)** | `services/place-intelligence/src/infrastructure/google-places-collector.ts` — `textQuery` ile ful mekan listesi çekimi | **EVET — DynamoDB'ye yazılıyor** `storePlaces()` via `place-store.ts`. TTL=30 gün. | **KRİTİK** — `rating`, `photos`, `editorialSummary` field mask'te var ve DynamoDB'ye yazılıyor. Google Maps Platform ToS §3.2.3/§3.2.4 bu alanların cache'lenmesine izin vermiyor. |
| **Overpass API (OSM)**      | `services/place-intelligence/src/infrastructure/overpass-collector.ts`                                                 | EVET — DynamoDB'ye yazılıyor                                                       | OSM verisini ayrı `osm.*` şemasında tutma zorunluluğu (ODbL). Şu an DynamoDB'de kaynak karmalaşmış.                                                                                |
| **Foursquare Places API**   | `services/place-intelligence/src/infrastructure/foursquare-collector.ts`                                               | EVET — DynamoDB'ye yazılıyor                                                       | FSQ ToS kontrolü gerekiyor                                                                                                                                                         |
| **OSRM (public demo)**      | `router.project-osrm.org` — üretim rotaları için                                                                       | Hayır                                                                              | Demo sunucu üretimde kullanılıyor; SLA yok, rate limit yok. Üretim için uygun değil.                                                                                               |

### Cache Katmanı

ElastiCache Serverless Redis: token rate-limit, route segment cache, session.  
CloudFront: SPA + statik asset dağıtımı.

---

## 4. Altyapı

### AWS Hesabı ve Region

- Region: `eu-central-1`
- Proje adı: `adreskopru`
- Hedef hesap (migration): `865369794421` — şu an bu hesapta ne olduğu bilinmiyor.

### Terraform

| Parametre                          | Değer                                                                |
| ---------------------------------- | -------------------------------------------------------------------- |
| Terraform versiyonu                | `>= 1.9.0`                                                           |
| AWS provider (ana)                 | `~> 5.0`                                                             |
| AWS provider (AgentCore modülleri) | `~> 6.0`                                                             |
| State                              | **local** — `infra/terraform/terraform.tfstate`. Remote backend yok. |
| Ortam ayrımı                       | `dev / staging / prod` değişkeni                                     |

**Kritik:** Local Terraform state üretimde ciddi risk. Remote backend (S3 + DynamoDB lock) kurulmadan yeni hesaba migration yapılmamalı.

### Compute

Tüm backend: **AWS Lambda** (per-domain fonksiyon). ARM64, 256 MB, 28s timeout.  
ECS / Fargate / EC2: yok.

### VPC Yapısı

- CIDR: `10.0.0.0/20`
- Sadece private subnet'ler — NAT Gateway yok.
- VPC Endpoint'leri: S3 (Gateway), Bedrock Runtime (Interface), CloudWatch (Interface), SQS (Interface).

### S3 Bucket'ları

`media`, `guides`, `analytics`, `athena`, `{name}-kb-raw-data` (Knowledge Base ham verisi).

### Maliyet Koruyucusu

AWS Budgets: **aylık $50 limit** (`infra/terraform/main.tf:174`). Bu rakam yeni platform bileşenleri eklendikçe yetersiz kalacak — Faz 0 sonunda revize edilmeli.

### CI/CD

GitHub Actions. `main` → prod deploy, `develop` → staging deploy.  
Steps: typecheck → unit test → backend test → synthetics → web build → mobile build → Docker push → deploy.  
Terraform validate CI'da çalışıyor. `terraform apply` CI'da çalışmıyor (manuel).

### Gözlemlenebilirlik

- AWS X-Ray tracing (`monitoring/tracing/xray-tracer.ts`)
- CloudWatch namespace: `MapsBridge/TravelAI`
- Lambda p99 > 2000ms alarmı
- DynamoDB throttle ≥ 1 alarmı
- AI failure rate > %2, P95 latency > 15s, timeout > %5 alarmları
- AgentCore Observability: Terraform tanımında görünmüyor — eksik.

---

## 5. Entegrasyon Noktaları

Yeni platformun mevcut sisteme bağlandığı yerler ve her birinin geri dönük uyumluluk riski:

### EP-1: AI Lambda → Bedrock model çağrısı

**Dosya:** `apps/web/app/lib/ai/bedrock-client.ts`  
**Değişiklik:** Provider arayüzü arkasına alınacak (strangler pattern), Bedrock ikinci implementasyon olarak eklenecek.  
**Risk:** Düşük — `BEDROCK_MODEL_ID` env var zaten var, feature flag ile geçiş mümkün.

### EP-2: place-intelligence → Google Places collector

**Dosya:** `services/place-intelligence/src/infrastructure/google-places-collector.ts`  
**Değişiklik:** `rating`, `photos`, `editorialSummary` field mask'ten çıkarılacak; `place_id` + `lat/lng` TTL'li ayrı tabloya taşınacak.  
**Risk:** **YÜKSEK** — Bu değişiklik mevcut `PLACE#` DynamoDB kayıtlarını etkiliyor. Mevcut kayıtlarda yasak alanlar var; migration gerekiyor.

### EP-3: routes Lambda → OSRM proxy

**Dosya:** `infra/lambda/src/routes/index.ts`, `OSRM_BASE_URL` env var  
**Değişiklik:** `OSRM_BASE_URL` env var self-hosted Valhalla/MOTIS'e işaret edecek.  
**Risk:** Düşük — env var zaten ayrıştırılmış, kod değişmiyor.

### EP-4: DynamoDB `PLACE#{city}` → yeni Postgres POI tabloları

**Dosya:** `services/place-intelligence/src/infrastructure/place-store.ts`  
**Değişiklik:** Overture/FSQ verisi için `overture.*` / `fsq.*` şemalarında Aurora tablolar açılacak; Google verisi yalnızca on-demand kalacak.  
**Risk:** Orta — place-intelligence servisinin storage adapter'ı yeniden yazılacak. Mevcut DynamoDB kalıpları geçiş boyunca çift yazma gerektiriyor.

### EP-5: AgentCore Memory → kullanıcı tercih katmanı

**Dosya:** `infra/ai-memory/main.tf`, DynamoDB `USER#{userId}` kaydı  
**Değişiklik:** Kullanıcı tercihleri DynamoDB'den AgentCore Memory'ye migrate edilecek.  
**Risk:** Orta — `TravelPreferences` stratejisi zaten tanımlı. Mevcut kullanıcıların tercih verisini taşımak tek seferlik migration işi.

### EP-6: Supervisor agents → AgentCore Gateway tool yüzeyi

**Dosya:** `apps/web/app/lib/ai/supervisor.ts`  
**Değişiklik:** 19 alt-ajan Gateway tool'larına dönüştürülecek; supervisor tek tool yüzeyi görecek.  
**Risk:** Orta-yüksek — mevcut supervisor mimarisinin yeniden yazımı. Faz 1'de, mevcut yol çalışırken paralel geliştirme.

---

## 6. Kritik Eksiklikler ve Açık Borçlar

| #   | Bulgu                                                                                    | Öncelik    | Bloker mı                                           |
| --- | ---------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------- |
| B1  | Google Places: `rating`, `photos`, `editorialSummary` DynamoDB'de kalıcı saklanıyor      | **KRİTİK** | Evet — Faz 0 kabul kriterine giriyor                |
| B2  | Terraform state local — remote backend yok                                               | **YÜKSEK** | Evet — yeni hesaba migration öncesinde düzeltilmeli |
| B3  | `router.project-osrm.org` (demo) üretimde kullanılıyor — SLA, rate limit yok             | YÜKSEK     | Faz 1'de self-hosted geçiş                          |
| B4  | AWS Budgets $50/ay — yeni bileşenler eklenince anlık aşılır                              | YÜKSEK     | Faz 0'da revize                                     |
| B5  | pgvector kurulu değil — pgvector kurulumu yeni bir Aurora parametre grubu gerektirebilir | Orta       | Faz 1 narrative search için                         |
| B6  | AgentCore Memory ve Gateway deploy durumu bilinmiyor                                     | Orta       | Doğrulama gerekiyor                                 |
| B7  | AgentCore Observability Terraform'da tanımlanmamış                                       | Orta       | Faz 1 öncesinde eklenmeli                           |
| B8  | Vize/advisory guardrail eksik                                                            | Orta       | Faz 0 gereksinimi                                   |
| B9  | `reports/` ve `research_notes/` klasörleri repoda yok                                    | —          | Araştırma materyali okunmadı                        |

---

## 7. Sistem Özeti

```
CloudFront + S3 (SPA)
    │
    ▼
API Gateway HTTP v2  ←  Cognito JWT Authorizer  ←  WAF (prod/staging)
    │
    ├── auth / routes / chat / marketplace / stripe / admin / ai
    │       (Node22 Lambda, ARM64, 256 MB, 28s)
    │
    ├── AI Lambda ──► Bedrock ConverseAPI
    │                   ├── Nova Micro/Lite (T1/T2)
    │                   ├── Claude Haiku 4.5 (T3)
    │                   ├── Claude 3.5 Sonnet (T4)
    │                   ├── Guardrails (HATE/VIOLENCE/PII)
    │                   ├── Knowledge Base (titan-embed → OpenSearch Serverless)
    │                   └── AgentCore Memory (TravelPreferences + TripSummaries)
    │
    └── routes Lambda ──► router.project-osrm.org [DEMO — risk]

DynamoDB adreskopru-prod-data  (single-table, PROVISIONED)
Aurora Serverless v2 PG17 + PostGIS  (şema yok, veri yok, hazır)
ElastiCache Serverless Redis  (rate-limit + cache)
```

---

_Sonraki adım: Bölüm 11 sorularının kurucuya tek seferde iletilmesi._
