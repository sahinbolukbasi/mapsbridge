# AI_ARCHITECTURE.md — AI-First Seyahat Asistanı ve Diyalog Motoru Şartnamesi

Bu belge, MapsBridge'in ChatGPT/Claude seviyesinde akıcı, konuşma odaklı (conversation-first), yapılandırılmış çıktılar üreten ve eyleme dönüşen (action-oriented) seyahat yapay zekâ mimarisini tanımlar.

---

## 1. Ana Ürün Vizyonu ve Temel Davranış İlkeleri

Platformun kalbinde genel amaçlı bir chatbot değil, **yalnızca seyahat, gezi, lezzet, etkinlik ve şehir deneyimi konusunda uzmanlaşmış dikey bir AI Assistant** yer alır.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        KULLANICI DOĞAL DİL GİRDİSİ                     │
│    "3 günlüğüne Roma'ya gidiyorum. Sanat, kahve ve lokal yemek severim." │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      1. İSTEM ALIMI & GÜVENLİK                         │
│  - Seyahat Dışı Kapsam Denetimi (Kod, Kripto, Siyaset Engeli)         │
│  - Prompt-Injection & DAN Savunması                                   │
│  - PII Maskeleme (TCKN, Kredi Kartı, Telefon)                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  2. NİYET ANALİZİ & PARAMETRE ÇIKARIMI                 │
│  Çıkarılan Bilgiler:                                                  │
│  - Hedef: Roma                                                         │
│  - Süre: 3 gün                                                         │
│  - İlgi Alanları: Sanat, Özel Kahve, Yerel Gastronomi                  │
│  - Eksik Bilgiler: Bütçe seviyesi, ulaşım tercihi                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│            3. DİNAMİK SORU MOTORU (Smart Travel Question Engine)       │
│  *Kullanıcıya 20 soru sorulmaz!*                                       │
│  Doğal ve samimi tek bir netleştirme sorusu üretilir:                  │
│  "Harika bir Roma turu hazırlıyorum! Ulaşımı metro ve yürüyüş          │
│   ağırlıklı mı yapalım, yoksa taksi/özel transfer tercih eder misin?"  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│              4. ÇOKLU AJAN VE ARAÇ TETİKLEME (Tool-First)              │
│  Paralel Çalışma:                                                      │
│  - PlacesAgent ➔ Tarihi merkez & müzeler                               │
│  - CafeAgent ➔ Trastevere & Monti specialty kahvecileri               │
│  - RestaurantAgent ➔ Otantik Roma trattoria'ları                      │
│  - WeatherAgent ➔ Roma 3 günlük hava tahmini                           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               5. YAPILANDIRILMIŞ ÇIKTI & KART SENTEZİ                  │
│  - Doğal Dil Açıklaması                                               │
│  - Structured JSON (Places, Restaurants, Transport)                    │
│  - Zengin Arayüz Kartları (PlaceCard, RestaurantCard, MapPreview)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    6. SOHBETTEN AKSİYONA (Chat ➔ Action)               │
│  Kullanıcı: "Bu kahvecileri 2. güne ekle."                             │
│  Sistem: Trip ➔ Day 2 ➔ Add Places (DynamoDB & Markdown Güncellenir)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Niyet Analizi ve Parametre Çıkarımı (Entity Extraction)

Assistant kullanıcının mesajından şu 20+ parametreyi arka planda otomatik olarak çıkarır:

| Parametre | Açıklama | Örnek Değer |
|---|---|---|
| `destination` | Hedef şehir veya ülke | `Roma, İtalya` |
| `travel_dates` | Kesin veya esnek tarihler | `2026-10-15 / 2026-10-18` |
| `duration_days` | Gün sayısı | `3` |
| `travelers` | Yolcu grubu bağlamı | `solo`, `couple`, `family_with_kids`, `group` |
| `budget_level` | Bütçe düzeyi | `budget`, `standard`, `premium`, `luxury` |
| `travel_style` | Gezi yaklaşımı | `highlights`, `hidden_gems`, `nightlife`, `nature` |
| `interests` | İlgi alanları dizisi | `["art", "coffee", "food", "running"]` |
| `food_preferences` | Diyet ve mutfak | `["local_food", "vegetarian", "no_pork"]` |
| `activity_level` | Günlük tempo | `relaxed` (<4 saat), `balanced`, `intensive` (>8 saat) |
| `transport_mode` | Tercih edilen ulaşım | `walking`, `public_transit`, `car`, `bike` |
| `weather_sensitivity` | Yağmur/sıcak hassasiyeti | `indoor_alternatives_required` |

---

## 3. Dinamik Soru Motoru (Smart Travel Question Engine)

Kullanıcıyı anket dolduruyormuş gibi hissettiren uzun formlar **kesinlikle yasaktır**.

### Diyalog Kuralları:
1. **Tek Turda Tek Soru İlkesi:** Her asistan yanıtında kullanıcıya en fazla 1 veya 2 açık uçlu alternatif soru yöneltilebilir.
2. **Hızlı Seçenek Butonları (Quick Options):** Soruyla birlikte tıklanabilir 2-3 hazır şık sunulur (Örn: `[🏛️ Tarih & Sanat]`, `[🍕 Sokak Lezzetleri]`, `[☕ Kahve & Bohem Sokaklar]`).
3. **Konuşmadan Öğrenme:** Kullanıcı doğrudan "3 günlük Roma" dediyse süre tekrar sorulmaz; eksik olan stil veya konaklama odağına geçilir.

---

## 4. Yapılandırılmış Yanıt Şeması (Structured AI Output)

LLM çıktısı asla ham düz metin olarak istemciye bırakılmaz; her yanıt aşağıdaki doğrulanmış JSON şemasına uyar:

```typescript
export interface StructuredAIResponse {
  // Kullanıcıya gösterilen akıcı doğal dil yanıtı
  message: string;
  
  // Tespit edilen sistem eylemi
  intent: "chat" | "clarify" | "create_trip" | "modify_day" | "find_places" | "find_transit";
  
  // Zengin görsel kartlar için yapılandırılmış veri listeleri
  places?: Array<{
    id: string;
    name: string;
    category: "culture" | "view" | "landmark" | "nature";
    lat: number;
    lng: number;
    description: string;
    suggestedDurationMinutes: number;
    recommendedTimeSlot?: "morning" | "afternoon" | "evening";
    rating?: number;
    photoUrl?: string;
  }>;

  restaurants?: Array<{
    id: string;
    name: string;
    cuisine: string;
    priceLevel: "budget" | "mid" | "fine_dining";
    address: string;
    localDish: string;
    isMichelinOrAwarded?: boolean;
    lat: number;
    lng: number;
  }>;

  events?: Array<{
    id: string;
    title: string;
    category: "concert" | "exhibition" | "festival";
    venue: string;
    startDate: string;
    ticketUrl?: string;
  }>;

  transport?: {
    recommendedMode: "walk" | "metro" | "taxi" | "bus";
    durationMinutes: number;
    estimatedCost: string;
    transitSteps: string[];
  };

  // İstemcinin doğrudan uygulayabileceği sistem aksiyonları
  actions?: Array<{
    type: "ADD_PINS_TO_DAY" | "SWITCH_TO_RAIN_ALTERNATIVE" | "OPTIMIZE_ROUTE_ORDER";
    payload: Record<string, any>;
  }>;

  // Akıllı soru motorunun ürettiği takip soruları
  followUpQuestions?: string[];
  quickReplies?: Array<{ label: string; prompt: string }>;
}
```

---

## 5. Sohbetten Eyleme Akışı (Chat ➔ Trip Action Pipeline)

Kullanıcı sohbet ederken seyahat planı arka planda otomatik olarak güncellenir:

1. **Öneri Üretimi:** AI Roma için 4 durak ve 2 restoran önerir.
2. **Kullanıcı Onayı:** Kullanıcı *"Bunları 2. güne ekle"* veya *"Colosseum kalsın, diğerlerini ekle"* der.
3. **Aksiyon Yürütme (Action Dispatcher):**
   - İlgili mekanlar `Trip.days[1].pins` dizisine eklenir.
   - OSRM rota motoru çağrılarak duraklar coğrafi en yakın komşu mantığıyla optimize edilir.
   - DynamoDB'ye atomik işlem yazılır (`UpdateItem`).
   - Eşzamanlı olarak `.md` seyahat manifestosuna işlenir.
4. **Harita Güncellemesi:** Web arayüzündeki Leaflet haritası sayfayı yenilemeden yeni pinleri ve rota çizgisini canlandırır.
