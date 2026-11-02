---
inclusion: always
---

# Maps Bridge — Master Spec (Otorite Kaynak)

> Bu, ürünün tek doğruluk kaynağıdır. Kod ve spec çelişirse spec kazanır veya spec
> güncellenir — asla sessiz sapma (silent drift) olmaz.

## Ürün tezi

Maps Bridge bir booking engine değil, **seyahatin kendisi için** bir yol arkadaşıdır.
Rakipler (Layla, Wanderlog, Mindtrip) satın alma anını optimize eder; biz seyahati
optimize ederiz. "Layla: biletini aldım, şuraya git. Maps Bridge: yanındayım."

**Konumlandırma koruması:** Bağımsızız. Envanter sahibi değiliz. Önerilerimiz ASLA
komisyona göre sıralanmaz. OTA'lara karşı tek kalıcı avantajımız budur; kısa vadeli
gelir için asla feda edilmez.

## INVARIANT'LAR — ASLA İHLAL EDİLMEZ

Bir değişiklik bunlardan birini bozuyorsa, başka metriği ne kadar iyileştirirse
iyileştirsin REDDEDİLİR.

| ID      | Invariant                                                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I1**  | LLM asla yer, fiyat, açılış saati, adres veya koordinat uydurmaz. Tüm olgusal veri datastore veya API'den gelir. LLM'in tek işi niyet çıkarımı ve anlatımdır. |
| **I2**  | Rota geometrisi ve zamanlama deterministik koddur, LLM çıktısı değil. Clustering, TSP ve temporal fitting algoritmalardır.                                    |
| **I3**  | Konuşma turu başına en fazla 2 soru. Her biri rotayı maddi olarak değiştirmeli. Her biri 2-4 dokunulabilir seçenek sunmalı.                                   |
| **I4**  | Fetch edilebilecek (hava, vize, etkinlik, açılış saati) veya davranıştan çıkarılabilecek şey asla sorulmaz.                                                   |
| **I5**  | İlgi alanları demografiden (yaş, cinsiyet, milliyet, aile durumu, grup tipi) ASLA çıkarılmaz. Yalnızca kullanıcının söylediği/yaptığından.                    |
| **I6**  | Session verisi profile verisini geçersiz kılar ama ASLA mutasyona uğratmaz. Profil yalnızca bir davranış ≥3 session tekrarlayınca değişir.                    |
| **I7**  | Seyahat-içi yanıtlar ≤2s p95. Bu bütçeyi karşılayamayan iş talep anında değil, önceden hesaplanır.                                                            |
| **I8**  | Affiliate linkler sıralamayı asla etkilemez. Para kazanma yüzeyleri ayrı bir sekmede yaşar, asla rota önerileri içinde değil.                                 |
| **I9**  | Rotadaki her gün ≥%20 programsız tampon zaman ayırır.                                                                                                         |
| **I10** | Koşullu UI: bu geziye uygulanmayan kart render edilmez. Vizesiz destinasyona vize kartı yok, metro-şehrine araç kiralama yok.                                 |
| **I11** | Kullanıcının dili tüm insan-okunur çıktıda eşleştirilir. Varsayılan Türkçe, kullanıcıyı takip et.                                                             |
| **I12** | Rota çevrimdışı kullanılabilir olmalı: rota, duraklar, koordinatlar ve temel yön tarifleri cihazda cache'lenir.                                               |

## Stage mimarisi ve model yönlendirme

- **S0 Intent** → Haiku (yüksek frekans, yapısal çıktı, ucuz)
- **S1 Candidate generation** → LLM YOK (halüsinasyonun gireceği yer burası; DB'den aday havuzu)
- **S2-S4 Route algo** → deterministik (scoring, k-means/DBSCAN clustering, 2-opt TSP, constraint solver temporal fitting)
- **S5 Narration** → Haiku (kısıtlı, reasoning gerektirmez)
- **S6 In-trip** → Haiku, önceden filtrelenmiş ≤8 aday üzerinde sıralama
- **Batch review distillation** → Sonnet (çevrimdışı, kalite > maliyet)
- **Kullanıcının kritik yolunda ASLA büyük model çağrılmaz.**

## Build fazları (sırayla)

1. **Core loop:** S0 → S1 → S2-4 → S5 → harita. Sadece session memory. (3 turda rota)
2. **Memory split:** Profile + session store, I6 override semantiği. Implicit sinyal yakalama.
3. **Context services:** Vize, hava, etkinlik, mevsimsellik. Proaktif uyarı olarak, asla soru değil.
4. **In-trip mode:** Pre-computation pipeline, "around me", canlı rota mutasyonu. ASIL farklılaştırıcı.
5. **Prep layer:** Uçuş, konaklama, araç, eSIM, sigorta, belgeler. Affiliate. Ayrı sekme.
6. **Review distillation agents:** Gece yapılan yapısal çıkarım. En pahalı, en son.

## Konuşma koreografisi

- Tur 1 (serbest metin) → sor: tarih/süre + gezi karakteri
- Tur 2 (tarih biliniyor) → arka planda context servisleri ateşle; sor: tempo + ilgi alanları
- Tur 3 → TASLAK ROTA + context uyarıları göster. Soru sormayı bırak.
- Tur 4+ → rota üzerinde iyileştir, asla form üzerinde değil.

## Route algoritması (S1-S4)

- **S1:** şehir + ilgi ağırlıkları → POI havuzu (200-500); filtre: açık/mevsim/erişilebilirlik/bütçe/diyet
- **S2 Scoring:** interest match + quality + discovery + season + event − repetition penalty
- **S3 Clustering:** k-means (k=gün) veya DBSCAN; intra-cluster TSP (2-opt); gün-içi seyahat ≤%25 aktif saat
- **S4 Temporal fitting:** açılış saati/meal window/timed-entry; enerji bütçesi; ZORUNLU ≥%20 tampon; infeasible'da en düşük skorlu POI'yi düşür, yeniden çöz

## Memory modeli

- **Profile (kalıcı):** passport, home, diller, öğrenilmiş ilgi ağırlıkları, gözlenen tempo, yürüme toleransı, dislikes (düşürülen duraklardan — yüksek değer)
- **Session (gezi başı):** purpose, companions, dates, budget, cities, sessionOverrides, route, favourites, completed/dropped stops, live state
- **Promotion kuralı (I6):** bir override/davranış profile yalnızca ≥3 farklı session'da tekrarlayınca yazılır.

## Non-goals (kapsam dışı)

- İnsan seyahat danışmanları (unit economics çalışmaz)
- Envanter sahipliği (sadece affiliate)
- Genel chatbot (konu dışı istekler geziye yönlendirilir)
- Komisyon-ağırlıklı sıralama (I8 — geri alınamaz tek şey)

## Feature request işleme kuralı

Yeni özellik eklerken: (1) 12 invariant'ı kendin doğrula, ihlal varsa DURUP escalate et;
(2) LLM'i kritik yola koyuyorsa önce pre-computation öner; (3) konuşmaya soru ekliyorsa
I3/I4'e karşı kontrol et — varsayılan "fetch et veya çıkar", "sor" değil; (4) sıralama +
para kazanma varsa I8'i katı uygula; (5) §5/§7 prompt'larını sessizce genişletme — prompt
değişikliği spec değişikliğidir.
