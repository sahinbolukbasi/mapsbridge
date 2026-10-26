# Design Document

## Overview

`buildResearchedRoute` şu an LLM'in `stop.day` çıktısını güne-atama olarak kullanıyor
(I2 kısmi ihlali). Çözüm: LLM POI seçsin (I1), güne-atama `autoSplitPinsIntoDays`
(deterministik k-means) ile yapılsın, gün-içi sıralama `optimizeRouteOrder` (TSP) ile.
Mevcut deterministik araçlar zaten var; bu spec onları route akışına bağlar.

## Architecture

### Mevcut akış (I2 ihlali)
```
LLM output.data.route.stops[] -> her stop'ta {placeId, day}
  -> buildResearchedRoute: place = research.places[placeId]  (I1 ✓)
     stop.day = LLM'in verdiği gün                            (I2 ✗ — clustering LLM'de)
  -> sortAndEnrichDayStops (gün-içi, deterministik ✓)
```

### Hedef akış (I2 uyumlu)
```
LLM output.data.route.stops[] -> her stop'ta {placeId}  (day YOK SAYILIR)
  -> buildResearchedRoute:
     1. Seçilen POI'leri research.places'ten topla      (I1 ✓)
     2. autoSplitPinsIntoDays(selectedPins, estimatedDays)  (I2 ✓ deterministik k-means)
     3. her gün için optimizeRouteOrder (TSP)               (I2 ✓ deterministik)
     4. sortAndEnrichDayStops (timeSlot enrich)
     5. enforceBuffer opsiyonel (I9 uyum)
```

LLM'in `day` çıktısı yok sayılır (geriye-uyumluluk: alan hâlâ parse edilebilir ama
kullanılmaz). Bu, LLM'in rolünü spec'e indirger: yalnızca POI seçimi.

## Components and Interfaces

### Değişen: `buildResearchedRoute` (supervisor.ts)
- Girdi aynı (`candidate`, `context`, `research`).
- `stop.day` yerine: seçilen POI'leri topla → `autoSplitPinsIntoDays` ile güne dağıt.
- `autoSplitPinsIntoDays` `Pin[]` alır; `RouteStop`↔`Pin` köprü adaptörü gerekir (lat/lng/id/category map'leme).
- Çıktı tipi (`UnifiedRoutePlan`) değişmez — downstream (narration, map) etkilenmez.

### Köprü adaptörü
```
RouteStop -> Pin:  { id, lat, lng, category, label=name, ... }
autoSplitPinsIntoDays(pins, days) -> { days: [{dayIndex, pins}] }
Pin -> RouteStop:  geri dönüşümde name/description/estimatedMinutes korunur
```

### Yeniden kullanılan (değişmeyen)
- `autoSplitPinsIntoDays` (routing-service.ts) — deterministik k-means
- `optimizeRouteOrder` (routing-service.ts) — TSP
- `sortAndEnrichDayStops` (supervisor.ts) — timeSlot enrich
- `enforceBuffer` (scheduler.ts) — I9

## Data Models

`UnifiedRoutePlan` ve `RouteStop` şeması DEĞİŞMEZ. `stop.day` artık deterministik
hesaplanır, LLM'den gelmez. Downstream tüketiciler (harita, narration, map-sync)
aynı veri yapısını alır.

## Error Handling

- LLM araştırılmamış POI seçerse → mevcut "Araştırılmamış durak" hatası korunur (I1).
- `autoSplitPinsIntoDays` boş havuz → mevcut "Rota oluşturulamadı" hatası.
- Clustering bir günü boş bırakırsa → mevcut "her gün durak içermeli" kontrolü devrede.

## Testing Strategy

1. **Karakterizasyon testi (önce):** mevcut `buildResearchedRoute` çıktısını kaydet.
2. **Birim test:** `autoSplitPinsIntoDays` deterministik (aynı girdi→aynı çıktı).
3. **Entegrasyon:** değişiklik sonrası her gün dolu, toplam durak korunuyor.
4. **Canlı:** `verify-ai-model.cjs` 2-günlü senaryo geçmeli.
5. `npm run test:services` 0 fail.

## Correctness Properties

### Property 1: Güne-atama determinizmi
Aynı POI seti + gün sayısı için güne-atama her zaman aynı sonucu vermeli.

**Validates: Requirements 1.1, 1.4**

### Property 2: LLM clustering yapmaz
Route çıktısındaki `stop.day` LLM'in verdiği değere değil, k-means sonucuna eşit olmalı.

**Validates: Requirements 1.1, 1.2**

### Property 3: I1 korunumu
Güne-atama değişikliği sonrası LLM hâlâ yalnızca araştırılmış POI seçebilmeli.

**Validates: Requirements 3.1, 3.3**

### Property 4: Her gün dolu
k-means sonrası her gün (1..k) en az bir durak içermeli.

**Validates: Requirements 1.3, 4.4**

### Property 5: Regresyon yokluğu
Mevcut servis testleri ve canlı rota senaryosu değişiklik sonrası geçmeli.

**Validates: Requirements 4.2, 4.3**
