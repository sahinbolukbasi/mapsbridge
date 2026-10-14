# MEMORY.md — 4 Katmanlı Hafıza Mimarisi & Şeffaf Tercih Öğrenimi

Bu belge, MapsBridge platformundaki 4 katmanlı yapay zekâ hafıza sistemini, token maliyetini düşüren seçici geri çağırma (retrieval) mekanizmasını ve kullanıcının tam kontrolündeki **Öğrenilen Seyahat Tercihleri (Learned Travel Profile)** modelini tanımlar.

---

## 1. 4 Katmanlı Hafıza Mimarisi (4-Tier Memory Hierarchy)

Bütün konuşma geçmişini körü körüne her promptta LLM'e göndermek **fahiş token maliyeti, yüksek yanıt gecikmesi ve bağlam kirliliği** yaratır. Sistem 4 izole hafıza katmanı kullanır:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        KATMAN 1: SESSION MEMORY                        │
│  - Kapsam: Yalnızca aktif oturumdaki son 6-8 diyalog turu.             │
│  - Saklama: İstemci belleği ve geçici Lambda session context'i.        │
│  - Görev: "Orası kaçta kapanıyor?" gibi zamirleri çözme.              │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         KATMAN 2: TRIP MEMORY                          │
│  - Kapsam: Belirli bir seyahate ait veriler (Örn: "Tokyo 2027").        │
│  - Saklama: DynamoDB (PK: `TRIP#<id>`, SK: `METADATA` & `DAYS`).       │
│  - Görev: Seçilen otel, eklenen duraklar, seyahat manifestosu (.md).   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                KATMAN 3: USER PREFERENCE MEMORY                        │
│  - Kapsam: Kullanıcının zaman içinde kalıcılaşan seyahat alışkanlıkları│
│  - Saklama: DynamoDB (PK: `USER#<sub>`, SK: `AI#PREFERENCES`).         │
│  - Görev: Her konuşmada "Vegan mısın?", "Yürümeyi sever misin?"         │
│           diye tekrar tekrar sormayı engeller.                         │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     KATMAN 4: PLATFORM KNOWLEDGE                       │
│  - Kapsam: Doğrulanmış şehir rehberleri, güvenlik ve acil hatlar.      │
│  - Saklama: AWS Bedrock Knowledge Base (S3 Vektör Vektör Veritabanı).  │
│  - Görev: Halüsinasyonsuz, resmi seyahat gerçekleri sağlama.           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Gelişen Kullanıcı Seyahat Profili (Travel Profile)

Kullanıcının her konuşmasından ve etkileşiminden (beğendiği rotalar, eklediği mekanlar, elediği restoranlar) çıkarılan yapılandırılmış profil:

```typescript
export interface UserTravelProfile {
  userId: string;
  updatedAt: string;
  
  // Tercih Edilen Mutfaklar ve Diyet
  preferredCuisines: string[];          // ["italian", "japanese", "local_street_food"]
  dietaryRestrictions: string[];       // ["vegetarian", "no_dairy"]
  
  // Seyahat Tarzı ve Tempo
  preferredTravelPace: "relaxed" | "balanced" | "intensive";
  walkingToleranceMeters: number;      // Varsayılan: 5000 metre/gün
  mobilityPreferences: string[];        // ["metro", "walking"]
  
  // İlgi Alanları ve Ağırlıkları (0 - 100)
  interests: {
    coffeeScore: number;                // 95 (Specialty kahve aşığı)
    artMuseumScore: number;             // 80 (Modern sanat)
    nightlifeScore: number;             // 20 (Sakin akşamlar)
    natureOutdoorScore: number;         // 60
    shoppingScore: number;              // 10
  };

  // Kaçınılan Aktiviteler ve Mekanlar
  dislikedActivityTypes: string[];      // ["crowded_tourist_traps", "shopping_malls"]
  
  // Bütçe Eğilimi
  preferredBudgetLevel: "budget" | "standard" | "premium" | "luxury";
  
  // Sık Gidilen / Favori Şehirler
  favoritePlaces: string[];
}
```

---

## 3. Şeffaf ve Kullanıcı Kontrolündeki Tercihler (User-Controlled AI Preferences)

Gizli veya kullanıcının haberi olmadan arkada çalışan "kara kutu" profilleme **etik ve KVKK/GDPR ilkelerine aykırıdır**.

### Kullanıcı Arayüzü Yetenekleri (`/profile/edit`):
1. **"Yapay Zekânın Öğrendiği Tercihlerim" Paneli:** Kullanıcı sistemin kendisi hakkında öğrendiği etiketleri (Örn: *"Üçüncü nesil kahve seviyor"*, *"Günde en fazla 4 saat gezmek istiyor"*) açık bir liste olarak görür.
2. **Düzenleme & Silme:** Kullanıcı yanlış öğrenilmiş bir tercihi tek tıkla silebilir veya manuel olarak değiştirebilir.
3. **Kişiselleştirmeyi Kapatma (Opt-Out):** İsteyen kullanıcı tek bir butonla kişiselleştirilmiş hafızayı devre dışı bırakabilir; bu durumda asistan anonim genel modda çalışır.
4. **Unutma Hakkı (Right to be Forgotten):** "Tüm AI Tercihlerimi Sıfırla" butonu kullanıcının profil kayıtlarını DynamoDB'den anında siler.

---

## 4. Seçici Ön-Çağırma ile Token Tasarrufu (Selective Memory Retrieval)

Modeli çağırmadan önce:
1. Kullanıcı mesajı analiz edilir (`IntentRouter`).
2. Soru kahve veya yemekle ilgiliyse yalnızca `food_preferences` ve `coffeeScore` hafızadan çekilir.
3. Alakasız alanlar (Örn: `shoppingScore`, `flightPreferences`) prompta **dahil edilmez**.
4. Bu filtreleme sayesinde her API çağrısında **%40–%60 token tasarrufu** ve **< 800 ms yanıt hızı** sağlanır.
