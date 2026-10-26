# Implementation Plan

## Overview

LLM'in güne-atamasını (clustering) deterministik k-means'e taşır; I1 korunur, I2
sağlanır. Route akışının kalbi olduğu için önce karakterizasyon testi yazılır.

## Task Dependency Graph

```
Görev 1 (karakterizasyon testi)
   └─> Görev 2 (RouteStop<->Pin köprü)
         └─> Görev 3 (buildResearchedRoute deterministik güne-atama)
               ├─> Görev 4 (gün-içi TSP + I9 uyum)
               └─> Görev 5 (doğrulama)
```

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3", "4"] },
    { "wave": 4, "tasks": ["5"] }
  ]
}
```

## Tasks

- [x] 1. Karakterizasyon testi yaz
  - Mevcut `buildResearchedRoute` davranışını sabit girdiyle kaydet (gün sayısı, durak sayısı, her günün dolu olması)
  - `infra/lambda/tests/` veya services testine ekle; değişiklik öncesi yeşil
  - _Requirements: 4.1_

- [x] 2. RouteStop <-> Pin köprü adaptörü
  - `RouteStop`'tan `Pin`'e (id, lat, lng, category, label) ve geri (name, description, estimatedMinutes korunur) dönüşüm yardımcısı
  - Birim test: dönüşüm kayıpsız (round-trip)
  - _Requirements: 1.1_

- [x] 3. buildResearchedRoute'u deterministik güne-atamaya çevir
  - LLM'in `stop.day` çıktısını yok say; seçilen POI'leri topla
  - `autoSplitPinsIntoDays(selectedPins, estimatedDays)` ile güne dağıt (k-means)
  - Her gün dolu kontrolü korunur; I1 "araştırılmamış durak" reddi korunur
  - `npm run test:services`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 3.3_

- [x] 4. Gün-içi TSP sıralama + I9 uyumu
  - Her gün için `optimizeRouteOrder` (TSP); gün-içi seyahat ≤%25 kısıtı
  - `sortAndEnrichDayStops` timeSlot enrich korunur
  - `enforceBuffer` (I9) uygulanabilir hale getir
  - _Requirements: 2.1, 2.2, 2.3, 5.1, 5.2_

- [x] 5. Uçtan uca doğrulama
  - Karakterizasyon testi: gün/durak korunuyor
  - Determinizm: aynı girdi aynı çıktı
  - Canlı: `verify-ai-model.cjs` 2-günlü senaryo, her gün dolu
  - `npm run test:services` 0 fail; audit raporunu I2 ✅ olarak güncelle
  - _Requirements: 1.4, 3.3, 4.2, 4.3, 4.4_

## Notes

- Route "dokunursan patlar" alanı — her görev sonrası test; karakterizasyon testi ilk.
- LLM rolü daraltılıyor (yalnızca POI seçimi) — I1 korunur, I2 sağlanır.
- `UnifiedRoutePlan` şeması değişmez; downstream (narration, harita) etkilenmez.
- `stop.day` alanı parse edilebilir kalır (geriye-uyum) ama kullanılmaz.
