---
inclusion: always
---

# Mimari Gerçek (Architecture Truth) — Tek Doğruluk Kaynağı

> Bu dosya **kodun gerçek halini** (steering'in ideal anlatısını değil) ve **hedef mimariyi** bir arada tutar.
> Kod ile bu dosya çelişirse: ya kod yanlış ya bu dosya eskimiş — drift-guard (PLAN FAZ1/adım 2) farkı CI'da kırmızı yapar. Sessiz sapma yok.
> Doğrulama: 2026-10-28, diske karşı grep/wc ile teyit edildi. Kaynak: `.agents/tasks/target-architecture-2026-10-28/report.md`.

## 1. GERÇEK — canlı backend nerede

- Asıl backend: `infra/lambda/src/`. `services/*` DEĞİL.
- `services/*` durumu: `messaging` ve `place-intelligence` CANLI (lambda import eder); `ai-assistant` kısmen canlı (apps/web üzerinden); `identity-billing` ÖLÜ (grep=0).
- `packages/`: `contracts` (canlı, tek runtime paylaşım kanalı) + `design-tokens` (UI token kaynağı; yalnızca üretim zamanı, runtime import yok).

## 2. GERÇEK — karmaşıklık sıcak noktaları (ölçülü)

Kullanıcının hissettiği karmaşıklığın üç somut kaynağı:

1. **Sınır erozyonu (en büyük ağrı):** `infra/lambda/src` → `apps/web` arası **6 ters-yön import** (backend UI'ye bağımlı — Clean Architecture'ın en net ihlali). Baseline dosyalar:
   `ai-memory/index.ts`, `ai-memory/worker.ts`, `operations/tracker-worker.ts`, `ai/training-worker.ts`, `ai/index.ts`, `billing/store.ts`.
   Neden derleniyor: `infra/lambda/tsconfig.json rootDir="../.."` (repo kökü) + esbuild bundle. ESLint `no-restricted-imports` yakalıyor ama sadece `"warn"`.
2. **God-file + handler=iş-mantığı:** En büyük 4 dosya transport + iş kuralı + persistence'ı tek yerde topluyor:
   `admin/management.ts` (~868), `routes/index.ts` (~812), `ai/index.ts` (~696), `billing/store.ts` (~531).
3. **Çift/ölü yapı + doküman drift:** `identity-billing` ölü; steering/AUDIT koddan sapmıştı (bu tur düzeltildi).

## 3. GERÇEK — çoktan ödenmiş borçlar (AUDIT.md'nin eskidiği yerler)

- `admin/index.ts` = **204 satır** (AUDIT "1936" diyordu — bölünmüş; domain `management/finance/users/analytics/...`'e dağıtılmış).
- `new DynamoDBClient()` = **0** (AUDIT "18" diyordu — `getDynamoClient()` singleton'a geçilmiş).
- Chat GSI1 **Terraform'da tanımlı** (`infra/terraform/hosting.tf:289-291`) ve çalışıyor — danger-zones #5'teki "kırık" uyarısı geçersizdi (bu tur düzeltildi).

## 4. HEDEF mimari (pragmatik — Seçenek B, onaylandı)

Lambda gerçeğine saygı: mikroservis-DDD değil; "handler ince + domain/application/infrastructure alt-katman + sınır ESLint ile zorlanır".

```
infra/lambda/src/<context>/
├── handler.ts            # SADECE transport: parse, auth çağrısı, response. İNCE.
├── <context>.service.ts  # application: iş kuralları (AWS SDK YOK, port/repo alır)
└── <context>.repo.ts     # infrastructure: DynamoDB/Cognito/Stripe/Bedrock adaptörü
```

- `packages/ai-core` (YENİ): supervisor, context-builder, guardrails (I1/I5), planning, scoring, clustering (I2). `apps/web/server/ai/*` + `services/ai-assistant` buraya birleşir → lambda→apps importu 0'a iner.
- `packages/contracts`: büyür (lambda'nın da ihtiyaç duyduğu AI tipleri buraya).
- `services/`: yalnızca çok-tüketicili canlı domain (bugün `messaging`, `place-intelligence`). `identity-billing` silinir.
- Sınır zorlama: ESLint `no-restricted-imports: "error"` + `lambda/tsconfig rootDir="src"` + mimari-sınır testi.

**Neden daha fazlası değil:** ayrı repo/deploy/event-bus eklemek serverless'ta over-engineering. Her Lambda zaten bir deploy birimi; onu bölmek yerine içini katmanlamak Clean Architecture faydasının %90'ını, taşıma maliyetiyle verir.

## 5. Kalıcı mimari ilkeler (yeni kod bunlara uyar)

- **Backend frontend'e bağımlı olamaz.** `infra/lambda/src` içinden `apps/web`'e import YASAK.
- **Handler ince.** Yeni iş kuralı `*.service.ts`'e, DynamoDB erişimi `*.repo.ts`'e. Handler'a iş mantığı eklenmez.
- **Bir sayfa = bir bileşen = bir canonical URL.** Eş-anlamlı URL'ler 301 redirect/rewrite (veri), ayrı fiziksel `page.tsx` değil. (apps/web `ROUTE_MAP` ilkesi.)
- **Paylaşım `packages/*` üzerinden.** Relative `../../../../` cross-workspace import YASAK.
- **Deterministik kod LLM'den ayrı** (I2): clustering/TSP/temporal-fitting algoritmik; `packages/ai-core` içinde test'li.

## 6. Göç kuralı (strangler-fig)

Hedefe big-bang değil, küçük/bağımsız/geri-alınabilir adımlarla gidilir (PLAN FAZ2 R1-R8). Her adım karakterizasyon testi arkasında. Bir refactor adımı herhangi bir invariant testini (`eval:ai`, `route-clustering`, `guardrails`) kırarsa: DUR, geri al, escalate.

## 7. Gözlemlenebilirlik (gerçek durum, 2026-10-28)

- **monitoring/services/\*.json** adları koddaki `services/*` klasörleri DEĞİL, mantıksal ürün yetenek alanlarıdır. Her JSON'da `_note` ile canlı kod eşlemesi var. `map-trip`→routes/shares, `community`→marketplace/articles, `identity-billing`→auth/billing/stripe (klasör ölü ama işlev canlı, monitör korunur).
- **Structured logger EKSİK:** `packages/monitoring` paketi silinmiş; logging 21 lambda dosyasında dağınık `console.*` + lokal yardımcılarla yapılıyor. Tek tip trace-id/korelasyon yok. → HEDEF (FAZ 2): tek structured logger (ör. `packages/ai-core` ya da yeni `packages/observability`), X-Ray trace-id entegrasyonu. Bu bir refactor işi; FAZ 1'de yalnızca gerçek belgelendi.
- **monitoring/ altyapısı sağlam:** alarms/, dashboards/, synthetics/ (`npm run monitor:synthetics`), tracing/, runbooks/ mevcut.

## 8. Spec: bu-projede-olan-ai-chat — RAG/korpus/metrik güçlendirmesi (2026-11-09)

> Kaynak spec: `.kiro/specs/bu-projede-olan-ai-chat/{requirements,design,tasks}.md`.
> AI seyahat asistanını üç eksende güçlendirdi (brownfield): RAG grounding, korpus
> büyütme (fine-tune YOK), konuşma-önce deneyim. Hepsi 12 invariant'a bağlı.

### Yeni/değişen kod (hepsi mevcut sınır kurallarına uyar)

- **`apps/web/app/lib/ai/city-aliases.ts`** (YENİ): şehir alias tek kaynağı. `retrieval.canonicalCity` + `bundled-evidence` oradan türer (sessiz drift biter).
- **`apps/web/app/lib/ai/knowledge-base/kb-repo.ts`** (YENİ): KB entity/source/conflict kalıcılık katmanı. DIP — DynamoDB client DIŞARIDAN enjekte (DynamoDeps), ORM yok, tek-tablo KB_PATTERNS. `kb-store.ts` saf domain kalır.
- **`kb-store.ts`** (genişledi): `resolveByReliability` + `applyConflictResolution` (official>institutional>major_publication>ugc; ambiguous→addConflict).
- **`research-queue.ts`** (genişledi): `entityRef` + `planResearchJobs` (eksik entity → high-priority iş, dedup; I7 önceden hesaplama).
- **`infra/lambda/src/ai/kb-freshness-worker.ts`** (YENİ, zamanlı lambda): bayat KB entity TTL temizliği. **SELF-CONTAINED** — `apps/web`'den import ETMEZ (ters-import baseline 6'da kalır, §2); `isStale`+kaskad silme knowledge-base kb-store/kb-repo ile aynı davranışın yerel kopyası. Metrik: KBScanned/KBPruned/KBOldestAgeSeconds/Heartbeat (MapsBridge/AI). **DEPLOY ADIMI:** Terraform/Step Functions zamanlamasına bağlanmalı (henüz bağlı değil).
- **`shared/ai-operations.ts`** (genişledi): `aiMetric()` EMF yayıcı (MapsBridge/AI) + `recordAIOperation` opsiyonel `retrievalStatus`/`evidenceCounts` (geriye uyumlu). `ai/index.ts` iki başarı yolu bunları geçer.
- **`retrieval.ts`/`bundled-evidence.ts`/`types.ts`/`supervisor.ts`**: `TravelEvidence.counts` + `mergeEvidence` doldurur + `MultiAgentResponse.evidenceCounts` → RequestLatency/RetrievalOutcome/EvidenceMerged metriği.
- **`apps/web/server/ai/promotion.ts`** (YENİ): onaylı diyalog → RAG korpusu (olgu, tarihli) + few-shot (üslup, `toStyleOnly` olgu kırpar). **FINE-TUNE YOK** (I1): olgu RAG'da, üslup few-shot'ta.
- **`sub-agents/dispatcher.ts`** (genişledi): I10 koşullu tetik (`isAgentRelevant`/`explicitlyWantsCar` — car-rental metro şehrinde `carRecommended=false` + açık istek yoksa tetiklenmez, olgudan/demografiden değil I5) + I2 deterministik sınır (`ROUTE_GEOMETRY_KEYS`/`assertNoRouteGeometry`/`SubAgentData` + `@ts-expect-error` derleme kanıtı).
- **`prompts.ts`**: I11 dil eşleme talimatı eklendi (ANSWER_PROMPT + CHAT_STREAM_PROMPT); **PROMPT_VERSION v8→v9** (prompt=spec değişikliği).

### Doküman düzeltmeleri (spec vs kod drift)

- Eğitim kaydı `privacyReview` başlangıç değeri **`required`** (design/requirements "pending" demişti → gerçeğe hizalandı).

### Kalite kapısı

- **CI (çevrimdışı):** `ci-services.yml` → `golden-eval-gate` job, `eval:golden:validate` (100 golden vaka + kategori/id/beklenti doğrular; Bedrock gerektirmez). Kapı mantığı `golden-eval-gate.test.cjs` ile korunur.
- **Canlı (release/operatör):** `eval:ai --golden` gerçek Bedrock'a bağlı + ücretli; prompt değişikliklerinde (ör. v9) ve release öncesi koşulur — regresyonda (passRate/grounding/route/decision-safety/p95) bloke.

### Doğrulama (2026-11-09)

typecheck web+backend temiz; test:backend 381/0, test:services 80/80, test:web 1117/0; danger-zones (billing/auth/routes/chat/stripe) 124/0; drift-guard yeşil (ters-import 6). Yeni testler: bundled-evidence, city-aliases, rag-degradation, grounding-guards, kb-repo, kb-freshness-worker, kb-conflict-resolution, research-queue-planner, dispatcher-conditional, dispatcher-degradation, dispatcher-i2-boundary, training-consent, guardrails-mask, google-content, promotion, training-metrics, clarification-discipline, ai-stream-sse, context-too-large, language-matching, memory-promotion-i6, forget-and-demographics, scope-no-charge, affiliate-separation-i8, model-critical-path, ai-operations-metrics, golden-eval-gate.

### Faz sonrası iyileştirme adayları (davranış dondurma ilkesiyle bu spec'te düzeltilmedi)

- `supervisor.ts` fiyat-doğrulama regex'i sembol-önce biçimde (`€320`) yalnız ilk rakamı yakalıyor.
- `user-memory/types.ts` `isSensitiveData` İngilizce `allerg` yakalıyor, Türkçe tek-l `alerji` yakalamıyor (TR eş-anlamlı genişletme).

## 9. Modüler AI Core (`packages/ai-core`) & 7/24 Otonom Ajan Laboratuvarı (2026-11-12)

- **`packages/ai-core`** eklendi (`architecture-manifest.ts`, `curated-city-intelligence.ts`, `route-optimizer.ts`, `autonomous-lab.ts`): Web, Mobil ve Admin panellerine tek bir modüler mikroservis katmanı olarak hizmet verir.
- **2D Ana Eksenli (Principal-Axis) Rota Kümeleme & Küratörlü Yedekleme**: Doğu-Batı uzanımlı şehirlerde (İstanbul, Roma, Paris, Lizbon) yakalar arası zikzakları önler; çok kaynaklı mekan araştırmasını küratörlü yerel cevherlerle zenginleştirir.
- **Birleşik Alt Ajan (Sub-Agent) Matrisi & Canlı Admin Kontrolü**: 12 alt ajan (`context`, `discovery`, `route`, `food`, `transit`, `city-transit`, `hotel-deal`, `flight`, `car-rental`, `city-intel`, `emergency`, `dynamic-replanning`) ve 7/24 otonom arka plan ajanları Admin Panel üzerinden canlı yönetilir.
