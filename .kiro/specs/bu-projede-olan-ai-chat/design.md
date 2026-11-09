# Tasarım — Kapsamlı Seyahat AI Sohbet Asistanı

## Genel Bakış

Bu tasarım, canlı AI seyahat asistanını **mevcut mimari üzerinde (brownfield)** güçlendirir. Üç eksen:

1. **Daha derin kaynaklı yanıt (RAG grounding)** — `retrieveTravelEvidence` + `bundledEvidence` + `researchPlaces` hattının kapsamı ve kalitesi artar, kanıt birleştirme deterministik ve ölçülebilir olur.
2. **RAG/vektör DB olgunluğu + korpus büyütme** — Bedrock Knowledge Base (OpenSearch Serverless vektör store) tazelik/kapsama/geri-çağrım metrikleriyle izlenir; onaylı diyaloglardan korpus + few-shot distilasyon döngüsü kurulur (fine-tune yok — I1).
3. **Konuşma-önce deneyim** — streaming, netleştirme disiplini (I3/I4), gecikme bütçesi (I7) ve `CONTEXT_TOO_LARGE` kurtarma yolu olgunlaştırılır.

**Mimari ilke:** Supervisor akışı (intake → RAG/araştırma → deterministik rota → anlatım) ve 12 invariant korunur. Yeni iş kuralı handler'a değil, `apps/web/app/lib/ai/*` ve `server/ai/*` application katmanına eklenir; LLM asla deterministik rota algoritmasını (kümeleme/TSP/temporal fitting) devralmaz (I2).

### Değişen / dokunulan dosyalar (gerçek kod haritası)

| Alan | Dosya | Rol |
| --- | --- | --- |
| Orkestratör | `apps/web/app/lib/ai/supervisor.ts` | Akış, kanıt birleştirme, netleştirme, streaming |
| RAG retrieval | `apps/web/app/lib/ai/retrieval.ts` | Bedrock KB vektör sorgusu + metadata filtresi |
| Yerel kanıt | `apps/web/app/lib/ai/bundled-evidence.ts` | KB kapalıyken yedek korpus + `mergeEvidence` |
| KB entity | `apps/web/app/lib/ai/knowledge-base/{types,kb-store,research-queue}.ts` | Tarihli/güven-skorlu entity + araştırma kuyruğu |
| Yer araştırma | `apps/web/app/lib/ai/place-research.ts`, `places-search/handler.ts` | Gerçek durak havuzu (I1 dayanağı) |
| Sub-agent | `apps/web/app/lib/ai/sub-agents/*` + `dispatcher.ts` | Alan uzmanları, koşullu tetik (I10) |
| Hafıza | `apps/web/server/ai/{context-builder,memory-service,memory-worker}.ts` | Profil/oturum ayrımı (I6), maskeleme (I5) |
| Eğitim hattı | `apps/web/server/ai/training-outbox.ts`, `infra/lambda/src/ai/training-worker.ts`, `training/travel/*` | Onay → karantina → korpus |
| Handler | `infra/lambda/src/ai/index.ts` | Transport, idempotency, kredi rezervasyonu, SSE |
| Gözlemlenebilirlik | `infra/lambda/src/shared/ai-operations.ts`, `ai-finops.ts` | Operasyon + maliyet kaydı |
| Değerlendirme | `evals/`, `npm run eval:ai` | Regresyon kapısı |
| Altyapı | `infra/ai-memory/*`, Bedrock KB Terraform | Vektör store, guardrails |

## Mimari

### Uçtan uca istek akışı

```
İstemci (apps/web/app/ai/page.tsx)
   │  POST /ai  { prompt, requestId, conversationId, conversationHistory, trainingConsent }
   ▼
Lambda handler (infra/lambda/src/ai/index.ts)
   │  auth → emailVerified → AI control → normalizeRequest → idempotency(requestId)
   │  reserveAI (kredi, atomik)  ── danger-zone #1
   ▼
Supervisor (supervisor.ts)
   ├─ 1. Güvenlik + kapsam (validateTopicSafety / validateTravelScope)   [I kapsam]
   ├─ 2. Intake (Haiku, JSON) → action: clarify | chat | plan             [S0]
   ├─ 3. Netleştirme gerekiyorsa → ≤2 soru + 2–4 seçenek, DUR            [I3/I4]
   ├─ 4. Kanıt toplama (paralel):
   │       • retrieveTravelEvidence  (Bedrock KB vektör, 3s timeout)      [RAG]
   │       • bundledEvidence         (yerel yedek korpus)
   │       • researchPlaces          (gerçek durak havuzu)               [I1]
   │       • callFlightSearchTool / callAdvisoryTool (doğrulanmış)       [I8]
   │     → mergeEvidence (dedupe by URL, ≤6 pasaj)
   ├─ 5. Deterministik rota (mode=route): kümeleme/TSP/temporal fitting  [I2]
   ├─ 6. Anlatım: JSON (route) veya streaming (chat, SSE token)          [S5/konuşma]
   └─ 7. Doğrulama: fiyat/kaynak grounding, rota edit kontratı          [I1]
   ▼
finishAI (kredi kesin/iade) + recordAIOperation + createTrainingJob(consent)
   ▼
Yanıt { orchestratorSummary, route?, sources, agentsInvolved, cost, suggestedChips }
```

### Katman diyagramı (hedef)

```
┌────────────────────────── apps/web ──────────────────────────┐
│ app/ai/page.tsx  (UI: streaming, chips, kaynak rozetleri)     │
│ server/ai/*      (context-builder, memory, training-outbox)   │
│ app/lib/ai/*     (supervisor, retrieval, KB, sub-agents)      │  ← AI çekirdeği
└───────────────────────────────────────────────────────────────┘
          ▲ import (tip + çalışma zamanı)
┌────────────────────── infra/lambda/src ──────────────────────┐
│ ai/index.ts (transport)  billing/store.ts (kredi)            │
│ shared/{auth,ai-operations,ai-finops,dynamo}.ts              │
└───────────────────────────────────────────────────────────────┘
          │ RAG                 │ metrik
          ▼                     ▼
  Bedrock KB (OpenSearch     CloudWatch (MapsBridge/AI,
  Serverless vektör store)    MapsBridge/Training)
```

> Not (architecture-truth.md): bugün `infra/lambda/src/ai/index.ts` → `apps/web` yönünde import var (sınır erozyonu, baseline'da). Bu spec bu importu **artırmaz**; yeni AI mantığı `apps/web/app/lib/ai`'de kalır, lambda yalnızca çağırır.

## Bileşenler ve Arayüzler

### 1. RAG grounding derinleştirme (`retrieval.ts` + `bundled-evidence.ts`)

**Mevcut davranış korunur**, şu güçlendirmeler yapılır:

- **Kanıt birleştirme ölçülebilir:** `mergeEvidence` sonucu `{status, passages, counts: {remote, local, deduped}}` döndürür; `recordAIOperation` bu sayıları `evidenceCounts` olarak kaydeder. (Gereksinim 3.4, 8.1)
- **Şehir kanonikleştirme genişler:** `canonicalCity` alias tablosu + `bundled-evidence` alias tablosu tek kaynağa (`apps/web/app/lib/ai/city-aliases.ts`) taşınır; iki dosya oradan import eder (sessiz drift önlenir).
- **Metadata filtresi katı kalır:** `visibility=public`, `approved=true`, `valid_until > now`, HTTPS-only URL, `checked_at` geçerli tarih. Kişisel veri `maskPII` ile maskelenir (Gereksinim 3.1, I5).
- **Timeout bütçesi:** retrieval `AbortSignal.timeout(3000)`; aşılırsa `status:"unavailable"` + `bundledEvidence` devreye girer (I7). (Gereksinim 3.3)

**Arayüz (değişen):**

```ts
export interface TravelEvidence {
  status: "disabled" | "available" | "empty" | "unavailable";
  passages: Array<TravelSource & { text: string }>;
  counts?: { remote: number; local: number; merged: number }; // YENİ — ölçüm
}
```

### 2. KB entity + araştırma kuyruğu dayanıklılaştırma

- **Kalıcılık:** `research-queue.ts` ve `kb-store.ts` bugün saf in-memory. Lambda yeniden çağrılarında kaybolmaması için `KB_PATTERNS` DynamoDB desenleriyle (`KB#<id>/META`, `SOURCE#`, `CONFLICT#`) kalıcı hale getiren ince bir `kb-repo.ts` eklenir (single-table, DocumentClient — ORM yok).
- **TTL/tazelik:** `KB_TTL_DAYS` kullanılır; `pruneStaleEntities` zamanlanmış worker'da (mevcut `memory-worker.ts` deseni) çalışır, pruned sayısı metrik olur. (Gereksinim 3.2, 3.4)
- **Çelişki:** çoklu kaynak aynı alanda ayrışırsa `addConflict` + reliability sırası (`official > institutional > major_publication > ugc`) ile otomatik seçim; çözülemezse `resolveConflict` için işaretlenir.
- **Araştırma kuyruğu:** `shouldEnqueue` tekrarları engeller; eksik şehir/entity için async `enqueueJob` (yüksek öncelik: kullanıcı beklerken olmayan durak). Bu, I7'yi korumak için **önceden hesaplama** kanalıdır.

### 3. Sub-agent kapsamı ve koşullu tetik (`sub-agents/dispatcher.ts`)

- **Tetik:** `dispatchSubAgents` yalnızca (a) istekte alan sinyali varsa ve (b) `readEnabledAIAgents` ile etkinse sub-agent çağırır. (Gereksinim 2.1)
- **Koşullu UI (I10):** vizesiz destinasyona `visa-agent` çağrılmaz; metro şehrine `car-rental-agent` çağrılmaz — karar `destination-context.ts` olgularından (vize gereksinimi, transit varlığı), demografiden değil (I5).
- **Degradasyon:** her sub-agent `try/catch`, başarısızsa `agentsInvolved`'da `status:"failed"` + yanıt o alan olmadan tamamlanır. (Gereksinim 2.2, 2.4)
- **Deterministik sınır:** sub-agent çıktısı yalnızca kanıt/anlatım; skor/kümeleme/zamanlama alanlarını **yazamaz** (tip düzeyinde ayrı payload). (Gereksinim 2.5, I2)

### 4. Korpus büyütme / "LLM eğitimi" döngüsü (fine-tune YOK)

```
Diyalog (trainingConsent=true)
   │ createTrainingJob  (consent.scope = "current_turn", reviewed=false)
   ▼
DynamoDB TRAINING_PARTITION  (durable outbox)
   │ training-worker.ts (zamanlı, bounded batch 25)
   │   • privacyReview !== "approved"        → bekLet
   │   • isGoogleDerived                     → sil (K3, Gereksinim 4.3)
   │   • geçerli + onaylı                    → maskPII → S3 quarantine/*.jsonl
   ▼
İnsan onayı (privacyReview=approved)  →  korpus promotion
   ├─ RAG korpusu (Bedrock KB'ye tarihli/kaynaklı entity olarak)
   └─ Few-shot örnek havuzu (prompts.ts — anlatım kalitesi, olgu değil)
   ▼
Değerlendirme (npm run eval:ai)  →  regresyon yoksa yayına
```

- **Varsayılan opt-out:** `trainingConsent !== true` ise hiçbir şey toplanmaz (Gereksinim 4.1).
- **Karantina → onay:** canlı korpusa yalnızca `privacyReview="approved"` sonrası geçer (Gereksinim 4.2).
- **Maskeleme:** `maskPII` kimlik/PII'yi korpustan çıkarır; ilgi alanları demografiden türetilmez (Gereksinim 4.4, I5).
- **Fine-tune neden yok:** temel modeli fine-tune etmek olgusal halüsinasyonu modele gömme riski taşır (I1). Bunun yerine olgular RAG korpusunda (tarihli, kaynaklı, silinebilir), üslup few-shot'ta kalır.
- **Kalite kapısı:** `eval:ai` referans senaryolarda gerilerse promotion bloke (Gereksinim 4.5, 8.2).

### 5. Konuşma-önce deneyim

- **Streaming:** chat modunda `invokeBedrockChatStream` + `writeSse(meta,"token",...)`; `index.ts` `streamHandler` (Function URL RESPONSE_STREAM). İlk token hedefi düşük gecikme. (Gereksinim 5.1)
- **Netleştirme disiplini:** `generateConciergeQuestion` tur başına ≤2 soru + `quickOptions` (2–4); `answeredSlots` aynı slotu iki kez sormayı engeller (I3/I4). (Gereksinim 5.2, 5.3)
- **Gecikme bütçesi (I7):** supervisor zaman bütçesi (`24500 - elapsed`), retrieval 3s timeout, in-trip yolunda ağır iş önceden hesaplanır (araştırma kuyruğu). (Gereksinim 5.4)
- **Bağlam taşması:** `isContextSizeError` → bir kez agresif budama (`keepTurns=2`) → yine aşarsa `CONTEXT_TOO_LARGE` + kurtarma mesajı; belirsiz 503 yok. (Gereksinim 5.5)
- **Dil eşleme:** çıktı kullanıcı diliyle, varsayılan Türkçe (I11). (Gereksinim 5.6)

### 6. Hafıza (profil/oturum)

- **I6 promotion:** oturum override'ı profile yalnızca ≥3 farklı oturum tekrarında yazılır (`memory-service.ts`). Oturum profili mutasyona uğratmaz.
- **Maskeleme + demografi yasağı (I5):** `retrievePersonalMemory` kişisel içeriği maskeyle taşır; ilgi yalnızca söylenen/yapılandan.
- **Unutma:** "tercihlerimi unut" → `changeMemory({reset:true})` / `forgetAIPreferences`; `generation` artar, eski işlem kimlikleri 409 ("silinen geçmişe ait").

### 7. Güvenlik, kredi, gözlemlenebilirlik

- **Kredi (danger-zone #1):** `reserveAI` atomik; `authorizeAI` üretim maliyetini onaylar; doğrulama başarısızsa `finishAI(false)` iade. Krediler yalnızca sunucuda. (Gereksinim 7.2, 7.3)
- **Idempotency:** `AI#<requestId>` kaydı; `succeeded` → replay, `reserved` → `REQUEST_IN_PROGRESS`. (Gereksinim 7.3)
- **Model yönlendirme:** intake/anlatım = Haiku (kritik yol), batch distilasyon = Sonnet (çevrimdışı). Büyük model kritik yolda çağrılmaz. (Gereksinim 7.4)
- **Operasyon kaydı:** `recordAIOperation` (model, responseMode, maliyet, süre, agent sonuçları) + `requestCostSummary`. (Gereksinim 8.1)
- **Metrikler:** `MapsBridge/AI` (istek, gecikme, retrievalStatus dağılımı, evidenceCounts) ve `MapsBridge/Training` (OldestPendingAge, Exported, SkippedThirdPartyContent). (Gereksinim 3.4, 8.4)

## Veri Modelleri

### Kanıt pasajı (RAG çıktısı)

```ts
interface TravelSource { id: string; title: string; url: string; checkedAt: string; }
interface Passage extends TravelSource { text: string; } // ≤1800 karakter, HTTPS kaynak
```

### KB entity (DynamoDB — `KB_PATTERNS`)

```
PK=KB#<id>  SK=META      → { type, country, city, name, geo, payload, confidence, ttlDays, createdAt, updatedAt, expiresAt }
PK=KB#<id>  SK=SOURCE#*  → { url, publisher, fetchedAt, contentHash, reliability }
PK=KB#<id>  SK=CONFLICT#* → { field, values[], resolvedBy?, resolvedAt? }
```

### Eğitim işi (outbox → karantina)

```
PK=TRAINING_PARTITION  SK=<jobId>
record = { id(sha256), reviewed:false, privacyReview:"required"|"approved", consent:{version,scope:"current_turn",grantedAt}, source:"live_curated", messages[maskPII], metadata, createdAt, expiresAt }
```

## Hata Yönetimi

| Durum | Davranış | İlgili |
| --- | --- | --- |
| RAG yapılandırılmamış | `status:"disabled"`, yerel kanıtla devam | Gereksinim 3.5 |
| RAG timeout (>3s) | abort → `bundledEvidence` | Gereksinim 3.3, I7 |
| Yetersiz gerçek durak | `clarify`, uydurma rota yok, plan değişmez | Gereksinim 1.4, I1 |
| Doğrulanmamış fiyat | yanıt reddedilir (fiyat regex + verifiedPrices) | Gereksinim 1.3, I8 |
| Bağlam taşması | 1 kez bud → `CONTEXT_TOO_LARGE` + kurtarma | Gereksinim 5.5 |
| Kredi yetersiz / üretim hatası | `BillingError` / `finishAI(false)` iade | Gereksinim 7.2 |
| Sub-agent hatası | `status:"failed"`, o alan olmadan tamamla | Gereksinim 2.2 |
| Seyahat dışı / injection | reddet, kredi harcama | Gereksinim 7.1 |

## Test Stratejisi

- **Birim (node:test .cjs):** `retrieval` metadata filtresi + maskeleme; `mergeEvidence` dedupe/counts; `kb-store` TTL/çelişki/prune; `research-queue` tekrar engelleme; `bundled-evidence` şehir eşleme; `training-worker` karantina + K3 + maskeleme.
- **Backend (danger-zone):** `infra/lambda/tests/billing.test.cjs` (kredi atomikliği), `chat.test.cjs`, `routes.test.cjs` — dokunulursa `npm run test:backend`.
- **Servis:** `services/ai-assistant` guardrails (I1/I5 maskeleme) `npm run test:services`.
- **Değerlendirme kapısı:** `npm run eval:ai` — intake doğruluğu, netleştirme disiplini (≤2 soru), grounding (kaynaksız olgu yok), fiyat doğrulama; korpus promotion öncesi zorunlu, regresyonda bloke.
- **Env notu:** yeni worktree'de `retrieval.test.cjs` lambda node_modules'üne bağlı → `cd infra/lambda && npm ci` (bilinen env kuralı).
- **Doğrulama sırası (her AI değişikliğinden sonra):** `npm run typecheck` → ilgili `test:backend`/`test:services` → `npm run eval:ai`. Geçmeden iş tamamlanmış sayılmaz.

## İzlenebilirlik (Gereksinim → Tasarım)

| Gereksinim | Karşılandığı yer |
| --- | --- |
| 1 Grounding | §1 retrieval + §Hata (yetersiz durak, fiyat) |
| 2 Sub-agent | §3 dispatcher + koşullu tetik |
| 3 RAG olgunluk | §1 counts + §2 KB TTL/metrik |
| 4 Korpus büyütme | §4 eğitim döngüsü |
| 5 Konuşma | §5 streaming/netlik/gecikme |
| 6 Hafıza | §6 profil/oturum |
| 7 Güvenlik/kredi | §7 |
| 8 Gözlemlenebilirlik | §7 metrik + §Test eval kapısı |
