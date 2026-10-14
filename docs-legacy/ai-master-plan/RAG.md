# RAG.md — Hibrit Arama, Vektör Bilgi Tabanı & Çok Boyutlu Skorlama Motoru

Bu belge, MapsBridge'in RAG (Retrieval-Augmented Generation) mimarisini, Hibrit Arama (Vektör + Anahtar Kelime + Coğrafi Yarıçap) motorunu ve Restoran/Mekan/Etkinlik çok kriterli puanlama algoritmalarını tanımlar.

---

## 1. Hibrit Arama Mimarisi (Hybrid Search Architecture)

Yalnızca vektör (embedding) araması yapmak seyahat alanında yetersizdir; çünkü kullanıcılar kesin coğrafi konum ("Kadıköy"), kategori ("Kafe") ve mesafe kısıtları ("yürüme mesafesinde") belirtirler. Sistem 3 arama boyutunu birleştirir:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        KULLANICI ARAMA SORGUSU                         │
│           "Kadıköy Moda sahilinde deniz manzaralı sakin bir kahve"      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│ 1. COĞRAFİ FİLTRE│       │ 2. VEKTÖR ARAMASI│       │ 3. KATEGORİ &    │
│ (Geo Bounding)   │       │ (Semantic Embed) │       │    METİN FİLTRESİ│
│ Kadıköy/Moda     │       │ "deniz manzarası │       │ Category: Cafe   │
│ 1.5 km yarıçap   │       │  sakin atmosfer" │       │ OpenNow: True    │
└────────┬─────────┘       └────────┬─────────┘       └────────┬─────────┘
         │                          │                          │
         └──────────────────────────┼──────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     HİBRİT ADAY BİRLEŞTİRME VE ELEME                   │
│         Coğrafya dışındakiler elenir; semantik ve etiket eşleşir.      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  ÇOK BOYUTLU PUANLAMA (Scoring Engine)                 │
│      Kullanıcı profili, puan, mesafe, popülerlik ağırlıkları uygulanır. │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               LLM SENTEZİ & DOĞAL DİL AÇIKLAMASI                       │
│  "Kahveye ve sakin yerlere ilgin olduğu için Moda İskelesi yanındaki   │
│   özel kahveciyi seçtim."                                              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Restoran Keşif ve Puanlama Motoru (Restaurant Discovery Engine)

Restoran önerileri yalnızca Google/TripAdvisor puanına göre yapılmaz. Turist tuzaklarını eleyen ve yerel deneyimi öne çıkaran 10 parametreli formül kullanılır:

```text
FinalRestaurantScore = 
    (UserPreferenceMatch     * 0.25) +
    (LocalExperienceScore    * 0.15) +
    (DietCompatibility       * 0.15) +
    (OpenNowScore            * 0.10) +
    (DistanceScore           * 0.10) +
    (TravelRouteCompatibility* 0.10) +
    (ReviewQualityScore      * 0.05) +
    (PriceMatch              * 0.05) +
    (RatingScore             * 0.05)
```

### Parametre Açıklamaları:
- **`LocalExperienceScore`:** Mekanın turistler yerine yerel halk tarafından tercih edilme oranı.
- **`DietCompatibility`:** Kullanıcının vegan/vejetaryen/helal kısıtlarına %100 uyumu (uyumsuzsa doğrudan 0 puan alır ve elenir).
- **`TravelRouteCompatibility`:** Mekanın o günkü gezi rotasının üzerinde veya çok yakınında olması (ters yöne yolculuk yapılmasını engeller).
- **`OpenNowScore`:** Kullanıcının yemek yemeyi planladığı saat diliminde açık olması.

---

## 3. Gezilecek Yerler Puanlama Motoru (Place Recommendation Engine)

Müzeler, tarihi alanlar ve anıtlar için uygulanan puanlama modeli:

```text
FinalPlaceScore = 
    (InterestMatch           * 0.30) +
    (LocalUniqueness         * 0.20) +
    (TripScheduleCompatibility* 0.15) +
    (WeatherCompatibility    * 0.15) +
    (DistanceScore           * 0.10) +
    (CrowdLevelScore         * 0.10)
```

### Dinamik Hava Uyum Denetimi (`WeatherCompatibility`):
- Eğer hava tahmininde yağmur veya şiddetli rüzgar varsa:
  - Açık hava parkurları ve seyir tepelerinin skoru **0.2'ye düşürülür**.
  - Kapalı müzeler, saraylar ve sanat galerilerinin skoru **çarpanla 1.4 katına çıkarılır**.
  - Kullanıcıya açıklama yapılır: *"Bugün öğleden sonra yağmur beklendiği için yürüyüş yerine Vatikan Müzeleri ziyaretini öne aldım."*

---

## 4. Etkinlik Eşleştirme Motoru (Event Discovery Engine)

EventsAgent aşağıdaki 15 kategoride canlı etkinlik tarar:
`concert`, `festival`, `art_exhibition`, `museum_event`, `sports_event`, `theatre`, `opera`, `stand_up`, `conference`, `fair`, `food_festival`, `local_event`, `community_event`, `nightlife_event`.

### Katı Eşleştirme Kuralları:
1. **Tarih Çakışması:** Etkinliğin başlama/bitiş tarihi kullanıcının o şehirde bulunduğu günlerle tam olarak kesişmelidir.
2. **Kişiselleştirilmiş Öneri:** Kullanıcı müzik türü olarak "Jazz" belirtmişse pop/rock konserleri yerine caz kulübü performansları önceliklendirilir.
3. **Bilet Durumu:** Tükenmiş (Sold Out) etkinliklerde kullanıcıya açıkça bilet kalmadığı veya kapı girişi bilgisi belirtilir.
