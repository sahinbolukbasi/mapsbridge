# Requirements Document

## Introduction

Invariant I2 der ki: "Rota geometrisi ve zamanlama deterministik koddur, LLM çıktısı
değil. Clustering, TSP ve temporal fitting algoritmalardır." Denetim
(`maps-bridge-invariant-audit.md`) `buildResearchedRoute`'un POI'lerin hangi güne
atanacağını (clustering) LLM çıktısından (`stop.day`) aldığını tespit etti — bu I2'nin
kısmi ihlalidir.

Deterministik k-means (`autoSplitPinsIntoDays`) ve TSP (`optimizeRouteOrder`) zaten
kodda mevcut ama route üretim akışında (`supervisor.ts` → `buildResearchedRoute`)
kullanılmıyor. Bu spec, LLM'in rolünü spec'e uygun şekilde daraltır: LLM yalnızca
araştırılmış POI havuzundan hangi yerlerin dahil edileceğini seçer (I1); güne-atama
(clustering) ve gün-içi sıralama (TSP) deterministik kod yapar (I2).

**Kapsam dışı:** POI seçimi (LLM'de kalır, I1 ile korunur); narration (S5); yeni AWS
kaynağı. Bu spec yalnızca güne-atama ve sıralamanın deterministik koda taşınmasıdır.

## Glossary

- **Güne-atama (day clustering):** Bir POI'nin seyahatin kaçıncı gününe düşeceğinin kararı. Spec gereği coğrafi k-means ile deterministik olmalı.
- **Gün-içi sıralama (intra-day ordering):** Bir gün içindeki durakların ziyaret sırası. TSP (2-opt/nearest-neighbor) ile deterministik.
- **`autoSplitPinsIntoDays`:** Mevcut deterministik k-means clustering fonksiyonu (`routing-service.ts`).
- **`buildResearchedRoute`:** Mevcut route kurucu; şu an LLM'in `stop.day` atamasını kullanıyor.
- **Karakterizasyon testi:** Değişiklik öncesi mevcut davranışı kaydeden, regresyonu yakalayan test.

## Requirements

### Requirement 1: Güne-Atama Deterministik Olmalı

**User Story:** Bir ürün sahibi olarak, POI'lerin günlere dağıtımının coğrafi mantıkla
(aynı bölge aynı gün) yapılmasını istiyorum; böylece rota gezilebilir ve LLM'in
tutarsız gün atamasına bağımlı olmaz.

#### Acceptance Criteria

1. WHEN bir rota üretildiğinde THEN POI'lerin güne-ataması `autoSplitPinsIntoDays` (deterministik k-means) ile yapılmalıdır, LLM'in `stop.day` çıktısıyla değil.
2. WHEN LLM POI seçtiğinde THEN yalnızca hangi araştırılmış yerlerin dahil edileceğini belirlemeli (I1 korunur); güne-atama kararını vermemelidir.
3. WHEN gün sayısı k ise THEN k-means k=gün ile coğrafi kümeleme yapmalı; her gün en az bir durak içermelidir.
4. WHEN güne-atama tamamlandığında THEN sonuç deterministik olmalı — aynı girdi aynı çıktıyı vermeli.

### Requirement 2: Gün-İçi Sıralama Deterministik Olmalı

**User Story:** Bir kullanıcı olarak, bir gün içindeki durakların coğrafi olarak
mantıklı sırada olmasını istiyorum; böylece gereksiz ileri-geri gezinmem.

#### Acceptance Criteria

1. WHEN bir günün durakları sıralandığında THEN TSP (`optimizeRouteOrder` nearest-neighbor/2-opt) ile deterministik sıralama yapılmalıdır.
2. WHEN gün-içi seyahat süresi hesaplandığında THEN gün-içi seyahat aktif saatlerin ≤%25'i olmalıdır (spec S3 kısıtı).
3. WHILE sıralama yapılırken timeSlot (morning/afternoon/evening) ipuçları korunabilir ama coğrafi tutarlılık önceliklidir.

### Requirement 3: I1 Korunumu (POI Seçimi LLM'de)

**User Story:** Bir güvenlik mühendisi olarak, LLM'in hâlâ yalnızca araştırılmış
yerlerden seçtiğinden emin olmak istiyorum; I2 düzeltmesi I1'i bozmamalıdır.

#### Acceptance Criteria

1. WHEN LLM bir POI seçtiğinde THEN o POI `research.places` içinde olmalıdır (olmayan → hata, mevcut davranış korunur).
2. WHEN güne-atama deterministik yapıldığında THEN POI'lerin isim/koordinat/adres verisi hâlâ datastore'dan gelmelidir, üretilmemelidir.
3. WHEN değişiklik tamamlandığında THEN I1 denetim testi (araştırılmamış yer reddi) hâlâ geçmelidir.

### Requirement 4: Regresyon ve Davranış Korunumu

**User Story:** Bir geliştirici olarak, bu değişikliğin mevcut route akışını bozmamasını
istiyorum; route "dokunursan patlar" alanıdır.

#### Acceptance Criteria

1. WHEN değişiklikten önce THEN mevcut `buildResearchedRoute` davranışı için karakterizasyon testi yazılmalıdır.
2. WHEN değişiklik yapıldığında THEN mevcut AI servis testleri (`npm run test:services`) 0 başarısızlıkla geçmelidir.
3. WHEN canlı test yapıldığında THEN `verify-ai-model.cjs` çok-günlü rota senaryosu geçmeli; her gün durak içermelidir.
4. WHEN rota üretildiğinde THEN gün sayısı, toplam durak ve her günün dolu olması korunmalıdır.

### Requirement 5: I9 ile Uyum

**User Story:** Bir ürün sahibi olarak, deterministik clustering'in I9 (%20 tampon) ile
birlikte çalışmasını istiyorum.

#### Acceptance Criteria

1. WHEN güne-atama yapıldıktan sonra THEN her gün için I9 buffer kontrolü (`enforceBuffer`) uygulanabilmelidir.
2. IF bir gün aşırı yoğunsa THEN en düşük öncelikli durak düşürülüp yeniden kümelenebilmelidir.
