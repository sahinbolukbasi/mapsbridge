# OBSERVABILITY.md — Dağıtık İzleme, Yanıt Hızı Hedefleri & AI Kalite Sistemi

Bu belge, MapsBridge'in uçtan uca dağıtık izleme (Distributed Tracing) altyapısını, gecikme (latency) hedeflerini ve kullanıcı etkileşimlerine dayalı yapay zekâ kalite ölçüm motorunu tanımlar.

---

## 1. Dağıtık İzleme (Distributed Tracing: `x-correlation-id`)

Kullanıcının tarayıcısında başlayan bir seyahat isteği, backend Lambda fonksiyonları, Bedrock çağrıları ve harici API istekleri boyunca tek bir korelasyon kimliği ile takip edilir:

```text
Kullanıcı Talebi (Client)
   │ [x-correlation-id: req-9821-ab34]
   ▼
API Gateway HTTP v2
   │
   ▼
TravelOrchestrator Lambda
   │
   ├─► Trace 1: IntentDetection (Nova Micro) [140 ms]
   ├─► Trace 2: UserProfileRetrieval (DynamoDB) [18 ms]
   │
   ├─► Trace 3: Parallel Specialist Agents
   │      ├─► PlacesAgent ──► AWS Location API [320 ms]
   │      ├─► CafeAgent ──► Semantic Cache Hit [45 ms]
   │      └─► WeatherAgent ──► Open-Meteo API [110 ms]
   │
   ├─► Trace 4: RecommendationRankingEngine [8 ms]
   ├─► Trace 5: Bedrock Converse API Synthesis (Claude Haiku) [680 ms]
   │
   ▼
İstemciye Yanıt ve Kartların Teslimi (Toplam: 1.32 saniye)
```

---

## 2. Katı Yanıt Hızı Hedefleri (Service Level Objectives - SLO)

Kullanıcı deneyiminin ChatGPT akıcılığında kalması için katı gecikme bütçeleri belirlenmiştir:

| İstek Türü | Hedeflenen P95 Gecikme | Maksimum Kabul Edilebilir Süre | Strateji |
|---|---|---|---|
| **Basit Sohbet / Netleştirme** | **< 1.2 saniye** | 2.0 saniye | Nova Micro doğrudan karşılama veya Haiku hızlı sohbet. |
| **Öneri Listesi (Restoran / Kafe)** | **< 2.2 saniye** | 3.0 saniye | Paralel tool çağrısı + önbellek kullanımı. |
| **Harici Tool / Arama (Uçuş/Otel)** | **< 3.8 saniye** | 5.0 saniye | Asenkron API entegrasyonu + skeleton yükleme kartları. |
| **Karmaşık Çok Günlük Rota** | **Kademeli (Progressive)** | 4.5 saniye | Önce gün başlıkları ve genel duraklar (Skeleton Plan) gösterilir, detaylı açıklamalar ve OSRM geometrisi arkadan tamamlanır. |

---

## 3. Yapay Zekâ Kalite Ölçüm Sistemi (AI Quality & Feedback Signals)

Asistanın ürettiği önerilerin başarısı sadece modelin kendine güvenine değil, **kullanıcının gerçek hayattaki tıklama ve kullanım davranışlarına** göre puanlanır:

```typescript
export interface UserFeedbackSignal {
  userId: string;
  recommendationId: string;
  placeId: string;
  interactionType: 
    | "ADD_TO_TRIP"    // Çok Güçlü Pozitif (+1.0)
    | "SAVE_TO_BOOKMARKS" // Güçlü Pozitif (+0.8)
    | "OPEN_MAP"       // Orta Pozitif (+0.5)
    | "LIKE"           // Açık Pozitif (+0.7)
    | "VISITED"        // En Yüksek Başarı (+2.0)
    | "REMOVE_FROM_TRIP" // Güçlü Negatif (-1.0)
    | "DISLIKE"        // Açık Negatif (-0.8)
    | "IGNORED";       // Nötr / Hafif Negatif (-0.1)
  timestamp: number;
}
```

### Kalite Puanı Hesaplama:
- Bir mekan önerisi 100 kullanıcıya gösterildiğinde en az 25'i tarafından rotaya ekleniyorsa (`Conversion Rate ≥ %25`), o mekan "Yüksek Öneri Kalitesi" etiketi alır ve Knowledge Base'de öne çıkarılır.
- Önerilip sürekli seyahat planından silinen mekanların skoru otomatik olarak düşürülür.
