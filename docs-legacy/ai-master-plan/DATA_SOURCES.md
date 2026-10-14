# DATA_SOURCES.md — Veri Kaynakları, Öncelik Hiyerarşisi & Güncelleme Boru Hattı

Bu belge, MapsBridge platformundaki dinamik seyahat verilerinin gerçek zamanlı toplanmasını, 7 katmanlı doğruluk önceliğini, entity modellerini ve veri tazelik (TTL) yaşam döngüsünü tanımlar.

---

## 1. 7 Katmanlı Veri Öncelik Hiyerarşisi (Data Priority)

Yapay zekâ modeli bir bilgi sunarken aşağıdaki hiyerarşiyi zorunlu olarak uygular; zaman bağımlı veya kritik konularda modelin kendi ezberine (LLM knowledge) asla güvenilmez:

```text
1. Platform Doğrulanmış İç Veritabanı (Platform Internal Verified DB)
   └── Editöryal onaylı mekanlar, rota şablonları, konsolosluk ve güvenlik protokolleri.
   
2. Resmi Partner API'ları (Partner APIs)
   └── Biletleme, doğrudan uçuş/tren envanteri, otel rezervasyon ağları.
   
3. Resmi Sağlayıcı API'ları (Official Provider APIs)
   └── Havalimanı uçuş bilgi ekranları, belediye toplu taşıma canlı verileri.
   
4. Güvenilir Harici API'lar (Trusted External APIs)
   └── Open-Meteo (Hava Durumu), Project OSRM (Rota Motoru), AWS Geo Places.
   
5. Güvenilir Web Kaynakları (Trusted Web Sources)
   └── Resmi şehir turizm portalları, müze resmi web siteleri.
   
6. Topluluk İçerikleri (User-Generated Content - UGC)
   └── Gezginlerin paylaştığı rota notları, fotoğraflar ve ipuçları.
   
7. LLM Ön-Eğitim Bilgisi (LLM Knowledge)
   └── Yalnızca zamandan bağımsız genel coğrafi ve tarihi anlatımlar için kullanılır.
```

---

## 2. Gerçek Zamanlı Veri Doğrulama Meta Verisi

Sistemde depolanan veya anlık çekilen her dinamik veri parçası (açık olma durumu, bilet mevcudiyeti, fiyat, hava durumu) şu meta verileri içerir:

```typescript
export interface RealtimeVerificationMetadata {
  source: string;              // Örn: "aws_geoplaces", "open_meteo", "internal_curated"
  timestamp: number;           // Verinin çekildiği an (epoch ms)
  confidence: number;          // 0.0 - 1.0 arası güven puanı
  last_verified_at: string;    // ISO 8601 doğrulama tarihi
  isTemporarilyClosed?: boolean;
}
```

---

## 3. Seyahat Varlık Modelleri (Entity Models)

Sistem aşağıdaki 18 varlık türünü zengin meta verilerle modeller:

| Varlık Türü | Kritik Alanlar ve Nitelikler |
|---|---|
| **Place & Museum & Gallery** | `id`, `name`, `category`, `subcategories`, `coordinates`, `city`, `country`, `opening_hours`, `ticket_url`, `visit_duration_minutes`, `tags`, `verified`. |
| **Restaurant & Cafe** | `cuisine`, `specialty_dish`, `price_level`, `dietary_tags` (vegan, helal), `is_michelin_awarded`, `opening_hours`, `reservation_url`. |
| **Hotel & Lodging** | `star_rating`, `neighborhood_safety_score`, `metro_distance_meters`, `amenities`, `booking_url`. |
| **Event & Concert** | `event_date`, `doors_open`, `venue_name`, `ticket_status` (`available`, `sold_out`), `ticket_provider_url`. |
| **RunningRoute & WalkingRoute**| `distance_km`, `elevation_gain_meters`, `surface_type` (`asphalt`, `trail`), `lighting_quality`, `traffic_level`. |
| **TransportStation** | `station_type` (`metro`, `train_station`, `airport`, `bus_terminal`), `city_transfer_lines`, `luggage_storage_available`. |

---

## 4. Veri Güncelleme Boru Hattı (Knowledge Pipeline)

Dış kaynaklardan veya web aramalarından elde edilen ham veriler **asla doğrudan ana veritabanına yazılmaz**. Standart 7 adımlı boru hattından geçirilir:

```text
┌──────────────┐     ┌──────────────┐     ┌────────────────┐     ┌──────────────┐
│ 1. Discover  │ ──> │ 2. Normalize │ ──> │ 3. Deduplicate │ ──> │ 4. Validate   │
│ (Ham Veri)   │     │ (Standart)   │     │ (Kopya Kontrol)│     │ (Koordinat)  │
└──────────────┘     └──────────────┘     └────────────────┘     └──────────────┘
                                                                        │
                                                                        ▼
┌──────────────┐     ┌──────────────┐     ┌────────────────┐     ┌──────────────┐
│ 7. Periyodik │ <── │ 6. Store     │ <── │ 5. Güven Skoru │ <── │ (Sıfır Hata) │
│ Doğrulama    │     │ (TTL ile DB) │     │ (Confidence)   │     │              │
└──────────────┘     └──────────────┘     └────────────────┘     └──────────────┘
```

---

## 5. Yaşam Döngüsü ve TTL Politikaları (Time-To-Live)

Veri türünün değişkenlik hızına göre katı TTL süreleri uygulanır:

| Veri Kategorisi | TTL Süresi | Yenileme Tetikleyicisi |
|---|---|---|
| **Restoran & Kafe Çalışma Saatleri** | **7 Gün** | Haftalık arka plan zamanlayıcısı |
| **Canlı Etkinlikler & Konserler** | **6 – 24 Saat** | Günlük senkronizasyon & bilet tükenme kontrolü |
| **Anlık Hava Durumu** | **3 Saat** | Kullanıcı rota görüntülediğinde |
| **Otel Fiyat & Müsaitlik Bilgisi** | **30 Gün** | Aylık partner katalog güncellemesi |
| **Şehir Anıtları & Müzeler (Statik)** | **90 Gün** | Üç aylık doğrulama turu |
| **Ulaşım Hatları & Ücret Tarifeleri** | **30 Gün** | Ay başında tarife kontrolü |

Bu sayede veritabanı şişmesi önlenir ve kullanıcıya eski/yanıltıcı seyahat bilgisi sunulmaz.
