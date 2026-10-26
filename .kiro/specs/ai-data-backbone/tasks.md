# Implementation Plan

## Overview

AI veri omurgasını kurar: maliyet-optimal model kademeleri, grounding güçlendirme, corpus genişletme, RAG + agent/hafıza doğrulaması. Her adım canlı Bedrock ile doğrulanır. Deploy gerektirmez — kod+config+corpus'u "deploy edilince doğru+ucuz çalışır" durumuna getirir.

## Task Dependency Graph

```
Görev 1 (model kademeleri config)
   └─> Görev 6 (uçtan uca + maliyet)
Görev 2 (corpus genişletme)
   └─> Görev 3 (grounding güçlendirme)
         └─> Görev 6
Görev 4 (RAG doğrulama)      [bağımsız]
Görev 5 (agent + hafıza)     [bağımsız]
```

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2", "4", "5"] },
    { "wave": 2, "tasks": ["3"] },
    { "wave": 3, "tasks": ["6"] }
  ]
}
```

## Tasks

- [x] 1. Maliyet-optimal model kademelerini yapılandır
  - `infra/terraform/variables.tf` + `modules/api/variables.tf`: `bedrock_model_id` default → `eu.anthropic.claude-haiku-4-5-20251001-v1:0`; yeni `bedrock_intake_model_id` default `eu.amazon.nova-micro-v1:0`; `modules/api/main.tf`'e `BEDROCK_INTAKE_MODEL_ID` env ekle
  - `apps/web/.env.local` ve `.env`: aynı iki değeri ekle (local test)
  - Canlı doğrula: `verify-ai-model.cjs` Haiku ile + ayrı bir Nova Micro intake çağrısı
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Corpus'u genişlet
  - `data/travel/` altına pilot şehirler (İstanbul, Roma, Tokyo, Lima, New York, Paris, Barcelona) için yemek/ulaşım/genel kategorilerinde şema-uyumlu, özgün-özet kayıtlar ekle
  - Her kayıt: id, city, country, text (özgün özet, birebir kopya değil), checked_at, valid_until, approved:true, rights, visibility
  - `bundledEvidence` alias listesini yeni şehirlerle genişlet
  - `bundledEvidence` birim testi: şehir/kategori eşleşmesi
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Grounding ve kaynak doğrulamayı güçlendir
  - Canlı grounding testiyle `citedSourceIds` boş dönme nedenini teşhis et (evidence modele geçiyor mu, prompt kaynak-ID istiyor mu)
  - Corpus'u olan şehir için `citedSourceIds` dolu dönmeli; gerekirse prompt'ta kaynak-zorunluluğunu netleştir (davranış korunur)
  - Corpus boş şehir için yanıtta "doğrulanmamış bilgi" uyarısı göründüğünü doğrula
  - `grounding-validator`/`evidence-validator` akışını canlı test et
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 4. RAG bağlantısını doğrula
  - `verify-travel-rag.cjs` çalıştır (esbuild yolu düzeltildi), KB/retrieval kodunu + fallback'i doğrula
  - Vector retrieval kullanılamazken `bundledEvidence` fallback'inin devreye girdiğini kanıtla
  - Bulguları raporla (canlı AWS'e dokunmadan)
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5. Agent ve hafıza sistemini doğrula
  - Çok-turlu hafıza: `verify-ai-model.cjs` ikinci senaryo (önceki tercihler korunuyor) — canlı kanıt
  - `readEnabledAIAgents` ile agent enable/disable mantığını doğrula (admin kontrolü)
  - Bir agent kapatıldığında diğerlerinin çalışmaya devam ettiğini test et
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 6. Uçtan uca doğrulama ve maliyet raporu
  - `verify-ai-model.cjs` + grounding testi canlı Bedrock ile geçmeli
  - Bir rota üretiminin token kullanımı + tahmini maliyetini raporla (Nova Micro vs Haiku karşılaştırması)
  - `npm run test:services` AI testleri 0 fail
  - Sonuçları `docs/development/audit-status.md`'ye kaydet
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

## Notes

- AI çekirdeği "dokunursan patlar" billing akışına yakın: kredi sunucuda düşülür, bu spec kredi mantığına dokunmaz.
- Model config değişiklikleri davranış değil maliyet/kalite kademesini etkiler — her değişiklik canlı Bedrock'la doğrulanır.
- Corpus kayıtlarında telif: kaynak metin birebir kopyalanmaz, özgün kısa özet yazılır.
- Hiçbir görev canlı AWS altyapısını (deploy/terraform apply) değiştirmez.
