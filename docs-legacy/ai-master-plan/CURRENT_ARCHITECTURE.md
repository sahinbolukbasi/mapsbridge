# CURRENT_ARCHITECTURE.md — Mevcut Mimari Değerlendirmesi & Durum Analizi

Bu belge, MapsBridge sisteminin güncel üretim mimarisini, veri akışlarını, mevcut frontend/backend/AI katmanlarını, çalışan yeteneklerini ve yeni AI-First Seyahat Asistanı vizyonuna geçiş için gereken teknik boşluk analizini (Gap Analysis) sunar.

---

## 1. Yönetici Özeti ve Mevcut Durum

MapsBridge; harita merkezli seyahat planlama, rota optimizasyonu, süreli konum paylaşımı ve AWS Bedrock tabanlı seyahat danışmanlığı sunan canlı bir platformdur.

| Metrik / Bileşen | Mevcut Durum |
|---|---|
| **Frontend Mimarisi** | Next.js 16.3.4 App Router (Turbopack), SPA Statik Export (`output: "export"`), 38 statik sayfa, Saf Vanilla CSS |
| **Backend Mimarisi** | AWS Lambda (Node.js 22 ARM64 esbuild paketleri), API Gateway HTTP v2 & WebSocket API |
| **Veritabanı** | Amazon DynamoDB Single-Table Design (`adreskopru-prod-data`), PK/SK indeksleme, TTL, Transactional Writes |
| **Kimlik & Güvenlik** | Amazon Cognito User Pool (`eu-central-1_TKABiLn5f`), JWT doğrulaması, Stripe Webhook HMAC denetimi |
| **Harita & Rota** | Project OSRM Routing API, Leaflet 1.9 harita katmanı, OpenStreetMap karoları |
| **AI Motoru** | AWS Bedrock Runtime, Amazon Nova Micro (`eu.amazon.nova-micro-v1:0`), Claude 3.5 Haiku, Converse API |
| **Monorepo Paketleri** | `@mapsbridge/contracts`, `@mapsbridge/shared`, `@mapsbridge/ui` (`packages/`) |
| **Mikroservisler** | 6 adet bağımsız servis (`services/`): `ai-assistant`, `identity-billing`, `map-trip`, `messaging`, `community`, `admin-service` |
| **İzleme & Telemetri** | `monitoring/`: Backend metrikleri, Core Web Vitals, 6 servis SLO'su, CloudWatch P1/P2 alarmları, Canary Synthetics (5/5 geçer) |
| **Test Güvencesi** | **230/230 Yeşil Test** (120 birim/AI testi + 110 backend entegrasyon testi) |

---

## 2. Mevcut Sistem Topolojisi

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│                           İSTEMCİ KATMANI (Next.js SPA)                           │
│  apps/web/app: /desk/ (Harita), /ai/ (Asistan), /community/, /messages/, /checkout/ │
└──────────────────────────┬────────────────────────────────────────────────────────┘
                           │ HTTPS (Fetch) & WSS (WebSocket)
                           ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                        AWS API GATEWAY HTTP v2 & WEBSOCKET                        │
│             https://0duy2hfjd2.execute-api.eu-central-1.amazonaws.com             │
└──────────────────────────┬────────────────────────────────────────────────────────┘
                           │ Event / Direct Proxy
        ┌──────────────────┼────────────────────────┬──────────────────────┐
        ▼                  ▼                        ▼                      ▼
┌────────────────┐ ┌────────────────┐     ┌────────────────┐    ┌──────────────────┐
│ auth-handler   │ │ routes-handler │     │ ai-handler     │    │ billing-handler  │
│ (Cognito Auth) │ │ (OSRM & Trip)  │     │ (Bedrock/Nova) │    │ (Stripe Webhook) │
└───────┬────────┘ └───────┬────────┘     └───────┬────────┘    └────────┬─────────┘
        │                  │                      │                      │
        └──────────────────┴──────────┬───────────┴──────────────────────┘
                                      │ Single-Table IAM Access
                                      ▼
             ┌───────────────────────────────────────────────────┐
             │       Amazon DynamoDB (adreskopru-prod-data)      │
             │   PK: USER#, ROUTE#, SHARE#, THREAD#, BILLING#    │
             └───────────────────────────────────────────────────┘
```

---

## 3. Mevcut AI Katmanı Analizi (`apps/web/app/lib/ai/`)

Platformda hâlihazırda gelişmiş bir AI çekirdeği bulunmaktadır:

### 3.1 Mevcut AI Modülleri
1. **`supervisor.ts` (MultiAgentSupervisor):**
   - İstemci veya Lambda tarafından çağrılan ana orkestratör.
   - Guardrail denetimi yapar, kullanıcı mesajını intake modeline gönderir, `clarify`, `chat` veya `plan` kararı alır.
   - Çoklu alt ajanı (`transitStayAgent`, `discoveryAgent`, `emergencyAgent`) eşzamanlı çalıştırır.
2. **`sub-agents/` (14 Uzman Alt Ajan):**
   - `route-agent.ts`: Durak sıralama ve rota oluşturma.
   - `food-agent.ts`: Yerel gastronomi ve restoran filtreleme.
   - `lodging-agent.ts` & `hotel-deal-agent.ts`: Konaklama ve otel fiyat benchmark'ı.
   - `city-transit-agent.ts` & `transit-stay-agent.ts`: Metro, otobüs ve transfer hatları.
   - `emergency-agent.ts`: 112/911 acil numaraları, NYPD ve Türkevi konsolosluk protokolleri.
   - `discovery-agent.ts`: Yerel gizli noktalar ve mimari duraklar.
   - `flight-agent.ts`, `car-rental-agent.ts`, `ticket-tracker-agent.ts`, `sports-agent.ts`, `city-intel-agent.ts`, `devops-agent.ts`.
3. **`guardrails.ts`:**
   - Seyahat kapsam kalkanı (`validateTravelScope`): Seyahat dışı soruları 0 krediyle reddeder.
   - Prompt-injection kalkanı (`validateTopicSafety`): DAN mode, sistem promptunu sızdırma girişimlerini engeller.
   - PII maskeleme (`maskPII`): TC Kimlik, Kredi Kartı, Telefon, E-posta verilerini temizler.
4. **`retrieval.ts` & `place-research.ts`:**
   - AWS Bedrock Knowledge Base ve Amazon Location Service (GeoPlaces) üzerinden doğrulanmış mekan araması.
5. **`feasibility.ts`:**
   - Rota fizibilite denetleyicisi: Günlük süre (>8.5 saat uyarısı), yağmur alternatifleri, bütçe aşımı ve zaman çakışması kontrolü.

---

## 4. Mevcut Durum ile Hedef Vizyon Arasındaki Boşluk Analizi (Gap Analysis)

| Alan | Mevcut Durum | Hedeflenen ChatGPT Seviyesi Seyahat Platformu |
|---|---|---|
| **Sohbet Akışı (Dialogue)** | Prompt gönderilir, tek seferde büyük rota veya metin döner. | **Conversation-First:** Doğal, akıcı diyalog. Eksik parametreleri kullanıcıyı sıkmadan parça parça soran akıllı soru motoru. |
| **Ajan Orkestrasyonu** | Supervisor 3-4 alt ajanı sabit çağırır. | **25+ Uzman Ajan:** Kullanıcı niyetine göre (intent routing) dinamik ve paralel tetiklenen tam otonom alt ajanlar. |
| **Tool-First Mimari** | Bilgilerin bir kısmı statik/heuristic kurallarla üretilir. | **18 Standart Tool:** Uçuş, tren, otobüs, canlı etkinlik, hava durumu, mekan çalışma saatleri doğrudan tool çağrılarıyla canlı çekilir. |
| **Kullanıcı Profili & Hafıza** | Basit context ve opt-in AgentCore hafızası var. | **4 Katmanlı Hafıza:** Session, Trip, User Travel Profile (öğrenilen tercihler; şeffaf ve düzenlenebilir) ve Platform Knowledge. |
| **Mekan & Restoran Skorlama** | Basit kategori eşleşmesi. | **Çok Boyutlu Skorlama:** Yerel deneyim, diyet uyumu, açık olma durumu, hava durumu, rota rotası uyumluluğu. |
| **Dinamik Rota Yeniden Planlama** | Rota oluşturulduktan sonra statiktir. | **Canlı İntelligent Replanning:** "Geç uyandım", "Yağmur başladı", "Restoran kapalıymış" komutlarında rotayı anında yeniden optimize etme. |
| **Model Yönlendirme (Routing)** | Nova Micro ve Claude Haiku arasında manuel ayrım. | **Akıllı Model Router:** Görev karmaşıklığına göre Low-cost / Medium / High-reasoning (Sonnet) modelleri arasında otomatik geçiş. |
| **Real-time Veri Entegrasyonu** | Sadece statik korpus ve kısıtlı Location API. | **7 Katmanlı Veri Önceliği:** Doğrulanmış platform verisi, resmi API'lar, canlı hava durumu, etkinlik ve bilet kaynakları. |

---

## 5. Korunacak Kritik Değerler ve Sınırlar

1. **230/230 Test Asla Bozulmayacak:** Mevcut 120 birim/AI testi ve 110 backend entegrasyon testi her aşamada yeşil kalmalıdır.
2. **FinOps & Kredi Bütünlüğü:** `reserveAI` ve `finishAI` mekanizmaları korunacak; yetersiz bakiye ile rota üretilemeyecek, reddedilen isteklerde bakiye düşülmeyecektir.
3. **Clean Architecture İzolasyonu:** Frontend doğrudan backend kodunu import etmeyecek; AI orkestrasyonu backend servisleri üzerinde çalışacaktır.
4. **Veritabanı Şeması:** Mevcut DynamoDB Single-Table Design anahtarları (`USER#`, `ROUTE#`, `SHARE#`) geriye dönük uyumlu kalacaktır.
