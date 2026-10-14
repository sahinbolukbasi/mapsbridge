# İş Modeli, Kredi Muhasebesi ve FinOps

## 1. Ürün ve Değer Yaratımı

MapsBridge, seyahat planlaması ve konum paylaşımını güvenli ve akıllı hale getirerek kullanıcıların saatlerce harita ve blog tarama külfetini ortadan kaldırır.

### Müşteri Segmentleri
1. **Bireysel Gezginler (B2C Free/Pro):** Tatilini veya hafta sonu gezisini planlayan, AI ile hızlı rota üreten ve sevdikleriyle konum paylaşan kullanıcılar.
2. **Seyahat İçerik Üreticileri (Creators):** Hazırladıkları rotaları vitrinde sergileyip rehber satışı yapan gezginler.
3. **Butik Acenteler & Danışmanlar (B2B Agency):** Müşterilerine özel rotalar tasarlayan, yüksek hacimli rota üretimi ve dışa aktarım (PDF/GPX) yapan profesyoneller.

---

## 2. Gelir Akışları (Revenue Streams)

### 2.1 Kredi Paketleri (Tek Seferlik Satış)
Kullanıcı ihtiyacına göre tek seferlik kredi yüklemesi yapabilir:
- **Başlangıç:** 50 Kredi — 89 TL
- **Popüler:** 300 Kredi — 299 TL
- **Gezgin Usta:** 1.000 Kredi — 749 TL
- **Pro Kaşif:** 3.000 Kredi — 1.899 TL

### 2.2 Abonelikler (Tekrarlayan Aylık Gelir - MRR)
Her ay otomatik yenilenen kredi ve ayrıcalık paketleri:
- **Explorer:** 199 TL / ay — 100 Kredi/ay + Standart AI Modeli
- **Pro:** 499 TL / ay — 500 Kredi/ay + Hızlı AI Modeli + Rota Dışa Aktarma + Özel Rozet
- **Agency:** 1.499 TL / ay — 2.500 Kredi/ay + Öncelikli İşlem Sırası + Toplu Rota Yönetimi

### 2.3 Pazar Yeri Komisyonu (Marketplace Commission)
Gezginlerin platform üzerinde sattığı rota rehberleri ve blog içeriklerinden **%15 ile %20** arasında platform komisyonu alınır.

---

## 3. Kredi Muhasebesi ve Tüketim Kuralları

Her yeni doğrulanmış kullanıcıya sisteme alışması için **+5 Hoş Geldin Kredisi** tek seferlik olarak tanımlanır.

### Tüketim Tablosu
| İşlem Türü | Kredi Maliyeti | Açıklama |
|---|---|---|
| **AI Netleştirme (Clarify)** | **0 Kredi (Ücretsiz)** | Kullanıcı eksik bilgi verdiğinde asistanın soru sorması kullanıcıyı cezalandırmaz. |
| **AI Seyahat Sohbeti (Chat)** | **1 Kredi** | Genel gezi tavsiyesi, semt önerisi veya seyahat sohbeti. |
| **AI Rota Üretimi (Route)** | **5 Kredi** | Çok günlük durakları, harita koordinatlarını ve zaman çizelgesini içeren tam rota planı. |
| **OSRM Rota Optimizasyonu** | **0 Kredi (Ücretsiz)** | Kendi oluşturduğu durakların harita masasında sıralanması ücretsizdir. |
| **Süreli Konum Paylaşımı** | **0 Kredi (Ücretsiz)** | 6 haneli kodla konum paylaşımı ve iptali ücretsizdir. |

### İki Aşamalı Atomik Tüketim Protokolü
1. **Rezervasyon (`reserveAI`):** İstek başladığında DynamoDB `USER#<sub>` cüzdanından kredi bloke edilir ve `AI#<requestId>` kaydı açılır (`state: 'reserved'`).
2. **Yetkilendirme (`authorizeAI`):** Model yanıt tipine göre (0, 1 veya 5 kredi) harcama limiti doğrulanır.
3. **Tamamlama (`finishAI`):**
   - Başarılı ise: Kredi bakiyeden kalıcı olarak düşülür, `BILLING#TRANSACTION` kaydı oluşturulur (`state: 'succeeded'`).
   - Hata/Timeout ise: Bloke edilen kredi kullanıcıya eksiksiz ve anında **iade edilir** (`state: 'failed' / refunded`).

---

## 4. FinOps ve Birim İktisadı (Unit Economics)

Sistem mimarisi, yüksek brüt marj sağlayacak şekilde tasarlanmıştır:

```text
Bir 5 Günlük AI Rota Satışı Geliri (5 Kredi): ~4,50 TL
 ────────────────────────────────────────────────────────
 - AWS Bedrock Token Maliyeti (Claude 3 Haiku):    0,12 TL
 - AWS Geo Places API Arama Maliyeti:              0,18 TL
 - DynamoDB & Lambda İşlem Maliyeti:               0,01 TL
 - Stripe Ödeme Komisyonu:                         0,38 TL
 ────────────────────────────────────────────────────────
 Toplam Birim Değişken Maliyet:                    0,69 TL

 Net Brüt Kâr:                                     3,81 TL (%84,6 Brüt Marj)
```

### Maliyet Kontrol Koruyucuları (Guardrails)
1. **Günlük AI İstek Sınırı:** Kullanıcı başına günlük maksimum istek sayısı sınırlandırılmıştır (`AI_DAILY_REQUEST_LIMIT`).
2. **Karakter ve Token Sınırları:** Prompt uzunluğu en fazla 2000 karakter, konuşma geçmişi en fazla 6 mesaj ile sınırlandırılarak gereksiz token tüketimi engellenir.
3. **AWS Bütçe Alarmları:** Terraform üzerinde tanımlı `aws_budgets_budget.monthly` ile aylık eşik aşıldığında operasyon ekibine anında alarm iletilir.
