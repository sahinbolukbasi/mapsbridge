---
inclusion: always
---

# Monorepo Yapısı

npm workspaces monorepo. `apps/*`, `packages/*`, `services/*` workspace'leri. Node 22+, npm 10+.

> Doğrulama (2026-10-28): bu ağaç diske karşı doğrulandı. Eski sürüm diskte olmayan servis/paketleri (map-trip, community, admin servisleri; api-client, shared, ui, database, security, monitoring paketleri) listeliyordu — düzeltildi. Drift-guard (PLAN FAZ1/adım 2) bu listeyi diskle karşılaştırıp sapmayı CI'da yakalar.

```
mapsbridge/
├── apps/
│   ├── web/                # Next.js statik export (vanilla CSS). Ana web uygulaması.
│   └── mobile/             # React Native / Expo (iOS + Android)
├── services/               # Paylaşılan domain servisleri (framework-bağımsız iş mantığı). DİSKTEKİ GERÇEK: 4 klasör.
│   ├── ai-assistant/       # Guardrails (I1/I5 PII maskeleme), scoring, route-clustering (I2), model-router. KISMEN CANLI (apps/web üzerinden import). → HEDEF: packages/ai-core'a konsolide (bkz architecture-truth.md).
│   ├── identity-billing/   # Cüzdan servisi iskeleti. ÖLÜ — hiçbir canlı kod import etmiyor (grep=0). Gerçek billing infra/lambda/src/billing/store.ts'de. → HEDEF: silinecek (kullanıcı onayı).
│   ├── messaging/          # Gerçek zamanlı sohbet domain/application. CANLI (infra/lambda/src/chat/index.ts:36 import eder).
│   └── place-intelligence/ # POI/Place Intelligence domain/application/infrastructure. CANLI (infra/lambda/src/places/index.ts import eder). Tek tam Clean Architecture örneği.
├── packages/               # Paylaşılan kütüphaneler. DİSKTEKİ GERÇEK: sadece 1 paket.
│   └── contracts/          # Domain tipleri, DTO'lar, value object'ler. TEK canlı paylaşım kanalı (web + services + lambda tip çeker). → HEDEF: büyüyecek.
├── infra/                  # Infrastructure as Code
│   ├── terraform/          # Çekirdek stack: S3, CloudFront, Cognito, DynamoDB (GSI1 dahil), API GW
│   ├── admin-runtime/      # Ayrı Lambda stack
│   ├── agentcore-gateway/  # Bedrock AgentCore MCP gateway
│   ├── ai-memory/          # AI hafıza tablosu, guardrails
│   └── lambda/             # Lambda handler kaynağı (TypeScript) — ASIL CANLI BACKEND KODU BURADA
├── monitoring/             # Alarmlar, dashboard'lar, synthetics, X-Ray tracing, runbook'lar
├── schemas/                # JSON şemaları (trip-plan, trip-profile, KB metadata)
├── docs/                   # Teknik dokümantasyon
└── scripts/                # Deploy ve yardımcı scriptler
```

## Nerede Ne Var

- **Web sayfaları**: `apps/web/app/` — Next.js App Router. Sayfalar klasör bazlı (`ai/`, `u/admin/`, `checkout/` vb.)
- **Backend iş mantığı**: `infra/lambda/src/` — ASIL canlı backend. Her alt-klasör de-facto bir bounded context (ai, billing, stripe, chat, places, admin, routes, auth, shared...).
- **Paylaşılan tipler**: `packages/contracts/` — hem frontend hem backend buradan tip çeker.
- **Altyapı**: `infra/terraform/` ve diğer `infra/*` stack'leri bağımsız deploy edilir.

## Gerçek vs Hedef (önemli)

- **GERÇEK (bugün):** Canlı backend `infra/lambda/src`'de; handler'lar transport + iş kuralı + persistence'ı iç içe tutuyor ("handler sadece transport" kuralı henüz tam uygulanmıyor). `services/*`'ın bir kısmı canlı (messaging, place-intelligence), ai-assistant kısmen, identity-billing ölü. `infra/lambda/src` → `apps/web` arası 6 ters-yön import var (sınır erozyonu).
- **HEDEF:** `infra/lambda/src/<context>/` içinde `handler.ts` / `*.service.ts` / `*.repo.ts` katmanlaması; lambda→apps importu 0; `packages/ai-core` ile AI çekirdeği tek yerde. Ayrıntı: `.kiro/steering/architecture-truth.md`.

## Katman Kuralları (Clean Architecture — hedef)

- Lambda handler → sadece transport (parse, auth çağrısı, response). [bugün tam değil, hedef bu]
- İş kuralları → application/domain (`*.service.ts`), handler içinde değil.
- Persistence → infrastructure (`*.repo.ts`), iş kuralından ayrı (DIP).
- Katmanlar arası dairesel bağımlılık yasak. Backend ASLA frontend'e (`apps/web`) bağımlı olmaz.
- Bounded context sınırlarına saygı: paylaşım `packages/contracts` (ve ileride `packages/ai-core`) üzerinden; relative `../../../../` import YASAK (ESLint `no-restricted-imports`).
