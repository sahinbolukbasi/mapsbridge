---
inclusion: always
---

# Monorepo Yapısı

npm workspaces monorepo. `apps/*`, `packages/*`, `services/*` workspace'leri. Node 22+, npm 10+.

```
mapsbridge/
├── apps/
│   ├── web/                # Next.js statik export (vanilla CSS). Ana web uygulaması.
│   └── mobile/             # React Native / Expo (iOS + Android)
├── services/               # Domain mikroservisleri (DDD, Clean Architecture)
│   ├── ai-assistant/       # Bedrock orkestrasyonu, alt-ajanlar, JSONL pipeline
│   ├── identity-billing/   # Cognito JWT, kredi cüzdanı, Stripe webhook
│   ├── map-trip/           # Rota motoru, OSRM, süreli konum paylaşımı
│   ├── messaging/          # Gerçek zamanlı WebSocket sohbet
│   ├── community/          # Gezgin rotaları, yazılar, marketplace
│   ├── admin/              # RBAC, bakım modu, audit log
│   └── place-intelligence/ # POI verisi, Google Places entegrasyonu
├── packages/               # Paylaşılan kütüphaneler
│   ├── contracts/          # Domain tipleri, DTO'lar, value object'ler
│   ├── api-client/         # Tüm API route'ları için tipli HTTP client
│   ├── shared/             # Validator'lar, hata sınıfları
│   ├── ui/                 # Tasarım token'ları, ikonlar (web + mobil)
│   ├── database/           # DynamoDB client wrapper
│   ├── security/           # Rate limiter, Lambda middleware
│   └── monitoring/         # Yapılandırılmış logger
├── infra/                  # Infrastructure as Code
│   ├── terraform/          # Çekirdek stack: S3, CloudFront, Cognito, DynamoDB, API GW
│   ├── admin-runtime/      # Lambda fonksiyonları, route entegrasyonları
│   ├── agentcore-gateway/  # Bedrock AgentCore MCP gateway
│   ├── ai-memory/          # AI hafıza tablosu, guardrails
│   └── lambda/             # Lambda handler kaynağı (TypeScript) — asıl backend kodu burada
├── monitoring/             # Alarmlar, dashboard'lar, synthetics, X-Ray tracing, runbook'lar
├── schemas/                # JSON şemaları (trip-plan, trip-profile, KB metadata)
├── docs/                   # Teknik dokümantasyon
└── scripts/                # Deploy ve yardımcı scriptler
```

## Nerede Ne Var

- **Web sayfaları**: `apps/web/app/` — Next.js App Router. Sayfalar klasör bazlı (`panel/`, `ai/`, `u/admin/`, `odeme/` vb.)
- **Backend iş mantığı**: `infra/lambda/src/` — Lambda handler'ları. Transport mantığı handler'da, iş kuralları application/domain katmanında.
- **Paylaşılan tipler**: `packages/contracts/` — hem frontend hem backend buradan tip çeker.
- **Altyapı**: `infra/terraform/` ve diğer `infra/*` stack'leri bağımsız deploy edilir.

## Katman Kuralları (Clean Architecture)

- Lambda handler → sadece transport (parse, auth çağrısı, response).
- İş kuralları → application/domain katmanı, handler içinde değil.
- Katmanlar arası dairesel bağımlılık yasak.
- Bounded context sınırlarına saygı: bir servisin iç tipleri başka servise sızmaz; paylaşım `packages/contracts` üzerinden.
