# TOOLS.md — Tool-First Mimarisi & Araç Sözleşmeleri Şartnamesi

Bu belge, MapsBridge AI Asistanı'nın halüsinasyon görmesini engelleyen, gerçek zamanlı verilere ulaşmasını sağlayan ve seyahat planları üzerinde somut değişiklikler yapmasını mümkün kılan **18 temel aracın (Tools)** girdi/çıktı sözleşmelerini ve sağlayıcı yedeklilik (fallback) mimarisini tanımlar.

---

## 1. Tool-First Mimari İlkesi

Yapay zekâ modelleri mekan çalışma saatlerini, konser tarihlerini, otel fiyatlarını veya rota mesafelerini ezberden (tahminle) üretmez. Bunun yerine model, **Tool Use / Function Calling** mekanizması ile doğrudan harici API'ları ve iç veritabanını çağırır.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          KULLANICI MESAJI                              │
│         "Floransa'da yarın akşam saat 20:00'de açık makarna yeri bul"  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        LLM FUNCTION CALLING                           │
│  Araç: find_restaurants                                               │
│  Parametreler: { city: "Florence", cuisine: "pasta", openAt: "20:00" } │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         TOOL EXECUTION KATMANI                         │
│  1. İç Doğrulanmış Veritabanı Arama (DynamoDB / Knowledge Base)        │
│  2. Harici Sağlayıcı API (Google Places / Location)                   │
│  3. Açık/Kapalı Durumu Doğrulama (get_opening_hours)                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  YAPILANDIRILMIŞ CEVAP VE KART ÜRETİMİ                 │
│  Model doğrulanmış mekanları alır ve kullanıcıya onaylı kartlar sunar.  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 18 Standart Tool Sözleşmesi

### 1. `find_places`
- **Açıklama:** Belirli bir şehir veya koordinat yarıçapında turistik ve kültürel yerleri arar.
- **Girdi:**
  ```json
  { "city": "string", "category": "culture|view|nature|all", "radiusMeters": 5000, "limit": 10 }
  ```
- **Çıktı:** `PlaceCardData[]` (id, name, lat, lng, category, rating, visitDurationMinutes).

### 2. `find_restaurants`
- **Açıklama:** Mutfak türü, bütçe ve diyet kısıtlarına göre restoran ve yemek mekanları bulur.
- **Girdi:**
  ```json
  { "city": "string", "cuisine": "italian|vegan|local", "priceLevel": "budget|mid|luxury", "nearCoord": {"lat": 0, "lng": 0} }
  ```
- **Çıktı:** `RestaurantCardData[]` (id, name, specialtyDish, priceLevel, address, rating).

### 3. `find_events`
- **Açıklama:** Seyahat tarihlerinde gerçekleşen konser, festival, sergi ve kültürel etkinlikleri listeler.
- **Girdi:**
  ```json
  { "city": "string", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "category": "concert|art|festival" }
  ```
- **Çıktı:** `EventCardData[]` (id, title, venue, dates, ticketUrl, priceRange).

### 4. `find_hotels`
- **Açıklama:** Bütçe ve seyahat tarzına uygun otel, pansiyon ve konaklama fırsatlarını çeker.
- **Girdi:**
  ```json
  { "city": "string", "checkIn": "YYYY-MM-DD", "checkOut": "YYYY-MM-DD", "guests": 2, "style": "boutique|budget|luxury" }
  ```
- **Çıktı:** `HotelDealData[]` (name, neighborhood, pricePerNight, bookingUrl, highlights).

### 5. `find_flights`
- **Açıklama:** İki şehir arasındaki uçuş seçeneklerini, süreleri ve tahmini fiyatları karşılaştırır.
- **Girdi:**
  ```json
  { "origin": "IST", "destination": "FCO", "date": "YYYY-MM-DD", "cabin": "economy|business" }
  ```
- **Çıktı:** `FlightOptionData[]` (airline, departure, arrival, durationMinutes, priceEstimate, bookingUrl).

### 6. `find_train`
- **Açıklama:** Şehirlerarası tren rotalarını ve hızlı tren alternatiflerini bulur.
- **Girdi:**
  ```json
  { "fromCity": "string", "toCity": "string", "date": "YYYY-MM-DD" }
  ```
- **Çıktı:** `TrainOptionData[]` (operator, departureStation, arrivalStation, durationMinutes, direct).

### 7. `find_bus`
- **Açıklama:** Şehirlerarası veya bölgesel otobüs seferlerini listeler.
- **Girdi:**
  ```json
  { "fromCity": "string", "toCity": "string", "date": "YYYY-MM-DD" }
  ```
- **Çıktı:** `BusOptionData[]` (company, departureTime, priceEstimate).

### 8. `get_weather`
- **Açıklama:** Hedef şehrin 7 günlük hava tahminini ve yağmur olasılığını sorgular.
- **Girdi:**
  ```json
  { "city": "string", "date": "YYYY-MM-DD" }
  ```
- **Çıktı:** `WeatherData` (temperatureC, condition, precipitationProb, isOutdoorSafe).

### 9. `calculate_route`
- **Açıklama:** Duraklar arası en uygun OSRM rota geometrisini, mesafeyi ve yürüyüş/sürüş süresini hesaplar.
- **Girdi:**
  ```json
  { "coordinates": [{"lat": 41.89, "lng": 12.49}, {"lat": 41.90, "lng": 12.48}], "mode": "walking|driving" }
  ```
- **Çıktı:** `RouteGeometryData` (totalDistanceMeters, totalDurationMinutes, polylineGeometry).

### 10. `get_public_transport`
- **Açıklama:** İki nokta arasındaki metro, otobüs veya tramvay aktarma adımlarını hesaplar.
- **Girdi:**
  ```json
  { "fromCoord": {"lat": 0, "lng": 0}, "toCoord": {"lat": 0, "lng": 0}, "city": "string" }
  ```
- **Çıktı:** `TransitDirectionsData` (lines, transfers, travelTimeMinutes, ticketAdvice).

### 11. `get_place_details`
- **Açıklama:** Belirli bir mekanın detaylı fotoğraflarını, puanını, adresini ve ziyaretçi yorumlarını getirir.
- **Girdi:**
  ```json
  { "placeId": "string" }
  ```
- **Çıktı:** `PlaceDetailData` (photos, phone, website, userReviewsSummary, accessibility).

### 12. `get_opening_hours`
- **Açıklama:** Mekanın belirtilen gün ve saatte açık olup olmadığını doğrular.
- **Girdi:**
  ```json
  { "placeId": "string", "targetTimestamp": 1727435000 }
  ```
- **Çıktı:** `HoursVerification` (isOpenNow, closesAt, isTemporarilyClosed, weeklySchedule).

### 13. `create_trip`
- **Açıklama:** Kullanıcının hesabında yeni bir seyahat masası ve boş gün şablonları oluşturur.
- **Girdi:**
  ```json
  { "title": "string", "destination": "string", "days": 3 }
  ```
- **Çıktı:** `TripCreatedResult` (tripId, redirectUrl).

### 14. `add_place_to_trip`
- **Açıklama:** Belirtilen mekanı kullanıcının seyahat planındaki belirli bir güne ekler.
- **Girdi:**
  ```json
  { "tripId": "string", "dayIndex": 1, "placeId": "string", "label": "string", "lat": 0, "lng": 0 }
  ```
- **Çıktı:** `PinAddedResult` (pinId, updatedDayPinCount).

### 15. `move_place_to_day`
- **Açıklama:** Var olan bir durağı başka bir güne taşır veya gün içindeki sırasını değiştirir.
- **Girdi:**
  ```json
  { "tripId": "string", "pinId": "string", "targetDayIndex": 2, "newOrder": 3 }
  ```
- **Çıktı:** `PinMovedResult` (success, recalculatedDuration).

### 16. `optimize_itinerary`
- **Açıklama:** Belirli bir gündeki durakları coğrafi mesafeyi en aza indirecek şekilde otomatik sıralar.
- **Girdi:**
  ```json
  { "tripId": "string", "dayIndex": 1 }
  ```
- **Çıktı:** `OptimizedDayResult` (savedMinutes, newSequence).

### 17. `search_internal_database`
- **Açıklama:** MapsBridge doğrulanmış seyahat bilgi tabanında hızlı anahtar kelime ve vektör araması yapar.
- **Girdi:**
  ```json
  { "query": "string", "city": "string", "limit": 10 }
  ```
- **Çıktı:** `InternalEntityResult[]` (entities, confidenceScores).

### 18. `search_web`
- **Açıklama:** İç veritabanında bulunmayan son dakika etkinlikleri veya geçici kapanmalar için güvenilir kaynaklardan canlı arama yapar.
- **Girdi:**
  ```json
  { "searchTerms": "string", "allowedDomains": ["official_city_guide", "museum_domain"] }
  ```
- **Çıktı:** `WebVerificationResult` (snippets, sourceUrls, verifiedTimestamp).

---

## 3. Sağlayıcı Soyutlaması ve Hata Yönetimi (Provider Abstraction & Fallback)

Bir dış veri sağlayıcısı kesintiye uğradığında sistem asla hata verip durmaz:

| Servis Türü | Birincil Sağlayıcı (Primary) | İkincil Sağlayıcı (Secondary) | Nihai Fallback (Fallback) |
|---|---|---|---|
| **Harita & Durak Arama** | AWS Geo Places / Location | Google Places API (MCP) | İç Doğrulanmış Vektör Veritabanı |
| **Rota Hesaplama** | Project OSRM Routing Engine | Haversine Heuristic Coğrafi Matris | Doğrusal Mesafe Tahmini |
| **Hava Durumu** | Open-Meteo Weather API | AWS Bedrock Knowledge Base İklim Profili | Mevsimsel Tipik İklim Tablosu |
| **Uçuş & Biletler** | Partner API (Skyscanner / Kiwi) | Havayolu Doğrudan Bağlantısı | Genel Fiyat Aralığı Kılavuzu |
| **LLM Model** | AWS Bedrock (Nova / Claude) | Yedek Bölge (Frankfurt ➔ İrlanda) | Statik Akıllı Şablon Motoru |
