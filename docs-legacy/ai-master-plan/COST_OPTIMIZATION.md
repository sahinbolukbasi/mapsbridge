# COST_OPTIMIZATION.md — FinOps, Çok Katmanlı Önbellek & Semantik Cache Şartnamesi

Bu belge, MapsBridge'in yapay zekâ birim maliyetlerini (Unit Economics) kontrol altında tutan FinOps telemetrisini, çok katmanlı varlık önbelleklerini ve semantik önbellek (Semantic Cache) mimarisini tanımlar.

---

## 1. FinOps ve İstek Başına Telemetri (Per-Request Cost Accounting)

Platformda yapılan **her AI isteği, her alt ajan çalıştırması ve her harici API çağrısı** atomik olarak kaydedilir. Körlemesine fatura ödemek yerine intent bazlı birim maliyetler takip edilir:

```typescript
export interface AICostTelemetryRecord {
  requestId: string;
  userId: string;
  tripId?: string;
  timestamp: number;
  
  // Model ve Tokenlar
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  
  // Ajan ve Toollar
  agentInvolved: string;
  toolCallsCount: number;
  
  // Performans ve Finans
  latencyMs: number;
  cacheHit: boolean;
  estimatedCostUsd: number;
  creditsCharged: number;
}
```

### Intent Bazlı Ortalama Hedef Maliyetler (Target Unit Economics):
| Niyet / Görev Türü | Ortalama Süre | Hedeflenen Token | Hedeflenen Birim Maliyet |
|---|---|---|---|
| **Karşılama & Netleştirme (Intake)** | < 250 ms | 120 token | **$0.00004** (0 Kredi) |
| **Öneri Arama (Restoran / Kafe / Müze)** | < 750 ms | 450 token | **$0.0008** (1 Kredi) |
| **Ulaşım ve Şehir İçi Rehber** | < 600 ms | 350 token | **$0.0006** (1 Kredi) |
| **3 Günlük Tam Rota Sentezi** | < 2400 ms | 1800 token | **$0.024** (5 Kredi) |

---

## 2. Çok Katmanlı Varlık Önbelleği (Destination Entity Caches)

Aynı şehirdeki popüler noktalar veya müzeler her kullanıcı için tekrar tekrar dış API'lardan sorgulanmaz. Ayrıştırılmış 6 alt önbellek kullanılır:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        İSTEMCİ / AI ORCHESTRATOR                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     HEDEF ÖNBELLEK KATMANI (TTL-Driven)                │
├──────────────────────┬──────────────────────┬──────────────────────────┤
│ 1. PlaceCache        │ 2. RestaurantCache   │ 3. EventCache            │
│ (Müzeler, Anıtlar)   │ (Yemek, Kafeler)     │ (Konser, Sergiler)       │
│ TTL: 14 Gün          │ TTL: 7 Gün           │ TTL: 6 - 24 Saat         │
├──────────────────────┼──────────────────────┼──────────────────────────┤
│ 4. WeatherCache      │ 5. TransportCache    │ 6. FlightCache           │
│ (3 Saatlik Tahmin)   │ (Metro, Otobüs)      │ (Uçuş Fiyat Trendi)      │
│ TTL: 3 Saat          │ TTL: 30 Gün          │ TTL: 6 Saat              │
└──────────────────────┴──────────────────────┴──────────────────────────┘
```

---

## 3. Semantik Önbellek (Semantic Caching)

Kullanıcılar farklı kelimelerle aynı anlamı taşıyan sorular sorabilir:
- Soru A: *"Roma'da en iyi espresso nerede içilir?"*
- Soru B: *"Roma specialty kahve dükkanları öner."*

### Semantik Önbellek Çalışma Prensibi:
1. **Embedding Üretimi:** Kullanıcı sorgusu Titan Text Embeddings V2 ile hızlıca 256 boyutlu vektöre dönüştürülür.
2. **Kosinüs Benzerliği (Cosine Similarity):** Önbellekteki geçmiş sorgularla karşılaştırılır. Eğer benzerlik **≥ 0.94** ise semantik eşleşme kabul edilir.
3. **Kişiselleştirme ve Tazelik Filtresi:**
   - Önbellek anahtarı `Hash(City + TargetDate + DietaryRestrictions + Pace)` parametrelerini içerir.
   - Farklı diyete sahip kullanıcılar (Örn: vegan bir kullanıcı) genel etobur önbellek cevabını alamaz.
4. **Tasarruf:** Semantik önbellek isabetlerinde (Cache Hit) model çağrılmaz; yanıt **< 80 ms** içinde ve **sıfır token maliyetiyle** döner.
