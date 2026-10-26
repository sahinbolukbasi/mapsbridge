# Design Document

## Overview

AI'nın "doğru yanıt vermesi" için veri omurgasını kurar. Canlı doğrulama gösterdi ki kod çekirdeği çalışıyor ama (a) grounding devreye girmiyor, (b) corpus küçük, (c) maliyet config'i suboptimal. Bu tasarım, mevcut iyi-tasarlanmış mimariyi (iki-kademeli model, bundled-evidence fallback, grounding-validator) doğru CONFIG + genişletilmiş CORPUS ile çalışır hale getirir. Kod mimarisi büyük ölçüde korunur; değişiklikler config, corpus ve küçük kod düzeltmeleridir.

## Architecture

### Mevcut (doğrulanmış) mimari
- `bedrock-client.ts`: `ConverseCommand` (model-agnostic), `role: "intake"|"answer"`, inference profile ARN desteği.
- `ai-operations.ts`: `configuredModels()` = `[BEDROCK_MODEL_ID, BEDROCK_INTAKE_MODEL_ID]`; `chooseModel()` kontrollü seçim.
- `bundled-evidence.ts`: vector retrieval yoksa `data/travel/*.json` corpus'undan grounding (fallback).
- `grounding-validator.ts` / `evidence-validator.ts`: yanıt-kaynak tutarlılığı.
- `travel-rag`: S3 Vectors + Bedrock KB (deploy'a hazır).
- `ai-memory`: AgentCore memory + guardrails (deploy'a hazır).

### Hedef model kademeleri (R1 — en düşük maliyet)
| Rol | Model | Env var | Maliyet |
| --- | --- | --- | --- |
| intake / clarify / tercih | Nova Micro | `BEDROCK_INTAKE_MODEL_ID=eu.amazon.nova-micro-v1:0` | ~$0.035/1M in |
| answer / rota üretimi | Claude Haiku 4.5 | `BEDROCK_MODEL_ID=eu.anthropic.claude-haiku-4-5-20251001-v1:0` | orta |

Düz model ID yerine `eu.*` inference profile zorunlu (canlı testte kanıtlandı: düz ID `ValidationException` verir).

### Grounding akışı (R2)
```
Kullanıcı sorusu
   → bundledEvidence(payload)  [corpus eşleşmesi]
   → (varsa) RAG retrieval      [vector DB]
   → evidence passages modele bağlam olarak verilir
   → model yanıtı + citedSourceIds
   → grounding-validator: yanıt kaynaklara dayanıyor mu?
   → corpus boşsa: "doğrulanmamış bilgi" uyarısı
```

## Components and Interfaces

### R1 — Model config (config + doğrulama)
- `infra/terraform/variables.tf` + `modules/api/variables.tf`: default `bedrock_model_id` → `eu.anthropic.claude-haiku-4-5-20251001-v1:0`; yeni `bedrock_intake_model_id` default `eu.amazon.nova-micro-v1:0`.
- `apps/web/.env.local` / `.env`: aynı değerler (local test için).
- Doğrulama: `verify-ai-model.cjs` her iki kademeyle canlı çalışır.

### R2 — Grounding güçlendirme
- Supervisor'da evidence'in gerçekten modele geçtiğini ve `citedSourceIds` döndüğünü doğrula. Grounding testinde `citedSourceIds: []` çıktığı için: evidence passage'ların system/context prompt'a enjekte edildiğini ve modelin kaynak ID'leri döndürmeye yönlendirildiğini kontrol et. Gerekirse prompt'ta kaynak-zorunluluğu netleştir (davranış korunur, sadece grounding güçlenir).
- Corpus boşken uyarı: `bundled-evidence` zaten "doğrulama içermez" notu ekliyor — yanıtta göründüğünü doğrula.

### R3 — Corpus genişletme
- `data/travel/` altına pilot şehirler için şema-uyumlu, özgün-özet kayıtlar ekle (telif: birebir kopya yok).
- `bundledEvidence` alias/şehir eşleşmesini genişlet (şu an Tokyo/Roma/İstanbul/Lima).

### R4 — RAG doğrulama
- `verify-travel-rag.cjs` (esbuild yolu düzeltildi) çalıştır; KB/retrieval kodunu doğrula; fallback'in çalıştığını test et.

### R5 — Agent + hafıza
- `verify-ai-model.cjs` çok-turlu senaryosu (zaten hafızayı test ediyor) + agent enable/disable için `readEnabledAIAgents` doğrulaması.

### R6 — Uçtan uca + maliyet
- Token kullanımını raporlayan bir maliyet özeti; `test:services` AI testleri.

## Data Models

Corpus şeması (mevcut, korunur):
```json
{ "id","title","city","country","source_url","text","checked_at","valid_until","reviewer","rights","approved","visibility" }
```
DynamoDB, RAG index şeması değişmez. Yalnızca corpus kayıtları eklenir ve env config güncellenir.

## Error Handling

- Model çağrısı başarısız → mevcut error kodları (`MODEL_INVOCATION_FAILED` vb.) korunur.
- Vector retrieval yoksa → `bundledEvidence` fallback (fail-open, yanıt üretmeye devam).
- Corpus boşsa → "doğrulanmamış bilgi" uyarılı yanıt (sessiz uydurma değil).
- Inference profile yanlışsa → canlı testte yakalanır (`ValidationException`).

## Testing Strategy

1. Her config değişikliği → `verify-ai-model.cjs` canlı Bedrock ile.
2. Grounding → özel test: corpus'u olan şehir için `citedSourceIds` dolu mu.
3. Corpus → `bundledEvidence` birim testi (şehir/kategori eşleşmesi).
4. `npm run test:services` → AI servis testleri.
5. Maliyet → token usage raporu.

## Correctness Properties

### Property 1: Model kademesi maliyet doğruluğu
Intake işlemleri Nova Micro, answer işlemleri Claude Haiku kullanmalı; düz model ID asla kullanılmamalı (yalnızca inference profile).

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Grounding tutarlılığı
Corpus'ta veri olan bir soru için yanıt o kaynağa dayanmalı ve `citedSourceIds` boş olmamalıdır.

**Validates: Requirements 2.1, 2.4**

### Property 3: Doğrulanmamış bilgi uyarısı
Corpus'ta veri olmayan bir soru için yanıt, bilginin doğrulanması gerektiğini belirtmelidir (sessiz uydurma yasak).

**Validates: Requirements 2.2, 2.3**

### Property 4: Fallback dayanıklılığı
Vector retrieval kullanılamadığında sistem bundled corpus'a düşmeli ve yanıt üretmeye devam etmelidir.

**Validates: Requirements 4.2**

### Property 5: Hafıza korunumu
Çok turlu konuşmada önceki tercihler sonraki turlarda korunmalıdır.

**Validates: Requirements 5.1, 5.4**

### Property 6: Corpus şema bütünlüğü
Her corpus kaydı zorunlu alanları içermeli ve özgün özet olmalıdır (telif güvenli).

**Validates: Requirements 3.2, 3.3**
