# 03 — App Store & Google Play Ekran Görüntüsü (Screenshot) ve Görsel Rehberi

Bu rehber, **Maps Bridge** uygulamasının Apple App Store Connect ve Google Play Console incelemelerinden görsel reddi (Guideline 2.3.3 — Accurate Metadata) almadan geçmesi ve en yüksek mağaza dönüşüm oranını (CRO) yakalaması için gereken **ölçüleri**, **ekran-ekran çekim planını** ve **görsel kurallarını** içerir.

---

## 1. Zorunlu Ekran Görüntüsü ve Görsel Boyutları

### A. Apple App Store Connect Ölçüleri
Apple artık **tek bir iPhone (6.9" veya 6.5")** ve **tek bir iPad (13")** setini kabul edip diğer ekran boyutlarına otomatik ölçeklemektedir:

| Cihaz Sınıfı | Zorunluluk | Çözünürlük (Dikey / Portrait) | Format | Adet |
| :--- | :--- | :--- | :--- | :--- |
| **iPhone 6.9" Display** (iPhone 16 Pro Max / 15 Pro Max) | **Zorunlu** | `1320 x 2868 px` (veya `1290 x 2796 px`) | PNG / JPEG (Alfa kanalsız, RGB) | **6 Adet** (Min 3, Max 10) |
| **iPhone 6.5" Display** (iPhone 14 Plus / 11 Pro Max) | Yedek / Opsiyonel | `1284 x 2778 px` (veya `1242 x 2688 px`) | PNG / JPEG (Alfa kanalsız) | **6 Adet** |
| **iPad 13" Display** (`supportsTablet: true` olduğu için) | **Zorunlu** | `2064 x 2752 px` (veya `2048 x 2732 px`) | PNG / JPEG (Alfa kanalsız) | **6 Adet** |
| **App Store Icon** | **Zorunlu** | `1024 x 1024 px` (`apps/mobile/assets/icon.png`) | PNG (Şeffaflık/Alfa **OLMAMALI**) | **1 Adet** |

### B. Google Play Console Ölçüleri

| Görsel Türü | Zorunluluk | Çözünürlük | Format | Adet |
| :--- | :--- | :--- | :--- | :--- |
| **Uygulama İkonu (Hi-res icon)** | **Zorunlu** | `512 x 512 px` | 32-bit PNG | **1 Adet** |
| **Özellik Grafiği (Feature Graphic)** | **Zorunlu** | `1024 x 500 px` | PNG veya JPEG (Kenarlardan 60px güvenli alan bırakın) | **1 Adet** |
| **Telefon Ekran Görüntüleri (Phone)** | **Zorunlu** | `1080 x 1920 px` veya `1290 x 2796 px` (9:16) | PNG / JPEG | **6 Adet** (Min 2, Max 8) |
| **7 inç Tablet Ekran Görüntüleri** | **Zorunlu** | `1200 x 1920 px` (veya `1600 x 2560 px`) | PNG / JPEG | **4–6 Adet** |
| **10 inç Tablet Ekran Görüntüleri** | **Zorunlu** | `1600 x 2560 px` (veya `2048 x 2732 px`) | PNG / JPEG | **4–6 Adet** |

---

## 2. 6 Ekranlık Hikaye Akışı (Screen 1 — Screen 6)

Her ekran görüntüsü, uygulamanın **gerçek koyu zümrüt (`#020e0a` / `#071a14`) arayüzünden** alınmalı ve üst kısmında temiz, okunaklı başlık + alt başlık yer almalıdır.

### Screen 1: Harita, Çok Günlü Rota Çizgisi ve Mekan Ayrıntı Kartı (Hero Shot)
- **Hangi Ekrandan Alınacak:** **Harita (`MapScreen`)** sekmesi. İstanbul veya Roma üzerinde 1. Gün ve 2. Gün duraklarının numaralı pinlerle ve rota çizgisiyle göründüğü, altta seçili bir mekanın **"Ayrıntı"** kartının (açık/kapalı durumu, puan, çalışma saatleri ve fotoğraflar) açık olduğu ekran.
- **TR Üst Başlık:** `Rotanı Haritada Canlı Planla`
- **TR Alt Başlık:** `Günlük duraklarını sırala, yürüyüş ve sürüş sürelerini anında gör.`
- **EN Headline:** `Plan Your Route Live on the Map`
- **EN Subheadline:** `Organize daily stops and view real-time walking & driving estimates.`

### Screen 2: Yapay Zeka Seyahat Asistanı (`AIScreen`)
- **Hangi Ekrandan Alınacak:** **Planla / AI Asistan (`AIScreen`)** ekranı. Kullanıcının *"3 günlük Kapadokya kültür ve gastronomi rotası hazırla"* mesajı ve altında AI asistanın sabah/öğle/akşam saat dilimlerine ayrılmış, **"Rotayı Haritama Kaydet"** butonlu zengin yanıt kartı.
- **TR Üst Başlık:** `Kişisel AI Seyahat Asistanın`
- **TR Alt Başlık:** `Saniyeler içinde ilgi alanlarına özel, saat saat optimize edilmiş gezi planı.`
- **EN Headline:** `Your Personal AI Travel Assistant`
- **EN Subheadline:** `Generate geographically clustered day-by-day itineraries in seconds.`

### Screen 3: 6 Haneli Konum Kodu ve QR Paylaşımı (`PinShareModal`)
- **Hangi Ekrandan Alınacak:** Harita üzerinde bir konum seçildiğinde açılan **Konum Kodu Paylaş (`PinShareModal` — `mode="share"`)** ekranı; büyük 6 haneli kod (`482910`) ve ortadaki yüksek kontrastlı **QR Kod** görünür durumda.
- **TR Üst Başlık:** `6 Haneli Kod ve QR ile Konum Paylaş`
- **TR Alt Başlık:** `Karmaşık adres tarifine son: kodu gir veya QR okut, doğrudan konuma git.`
- **EN Headline:** `Share Locations via 6-Digit Code & QR`
- **EN Subheadline:** `Scan the QR code or enter 6 digits to open any shared pin instantly.`

### Screen 4: Günlük Plan, Kişisel Durak Notları ve Seyahat Belgeleri (`PlanScreen` & `DocumentManagerModal`)
- **Hangi Ekrandan Alınacak:** **Plan (`PlanScreen`)** sekmesinde günlere bölünmüş durak listesi, kişisel durak bilgi kartı (kullanıcının kendi notları ve fotoğrafları) ve Seyahat Belgelerim (uçuş/otel/vize) özeti.
- **TR Üst Başlık:** `Gezi Notların ve Belgelerin Tek Yerde`
- **TR Alt Başlık:** `Kişisel durak notlarını, biletlerini ve rezervasyonlarını çevrimdışı sakla.`
- **EN Headline:** `Keep Notes & Travel Docs Together`
- **EN Subheadline:** `Store personal stop notes, flight tickets, and hotel bookings offline.`

### Screen 5: Gezgin Topluluğu ve Kaydedilen Rotalar (`CommunityScreen`)
- **Hangi Ekrandan Alınacak:** **Topluluk (`CommunityScreen`)** sekmesi; gerçek gezgin fotoğrafları, rota rozetleri ve sağ altta `"Gönderi kaydedildi."` bildirimi görünür halde.
- **TR Üst Başlık:** `Gezgin Topluluğundan İlham Al`
- **TR Alt Başlık:** `Deneyimleri keşfet, beğendiğin gönderileri ve rotaları koleksiyonuna kaydet.`
- **EN Headline:** `Get Inspired by Fellow Travelers`
- **EN Subheadline:** `Explore real travel stories and bookmark routes for your next adventure.`

### Screen 6: Çevrimdışı Seyahat Araçları, Bütçe ve 112 SOS (`ToolsScreen` & `EmergencyModal`)
- **Hangi Ekrandan Alınacak:** **Araçlar (`ToolsScreen`)** sekmesi; Pusula, Döviz Çevirici, Gezi Bütçesi ve **Sallayarak Acil Yardım (112 SOS)** kartı.
- **TR Üst Başlık:** `Her Koşulda Güvenle Seyahat Et`
- **TR Alt Başlık:** `Bütçe takibi, döviz çevirici, pusula ve sallayarak 112 acil yardım aracı.`
- **EN Headline:** `Travel Safely Wherever You Go`
- **EN Subheadline:** `Budget tracker, currency converter, compass, and Shake-to-SOS helper.`

---

## 3. Feature Graphic (Google Play 1024x500 px) Tasarım Şablonu

- **Arka Plan:** `#020e0a` → `#0b291e` koyu zümrüt gradyan ve ince topografik harita çizgileri.
- **Sol Taraf (Metin Bloğu):**
  - Logo + **"Maps Bridge"**
  - Başlık: **"Akıllı Gezi & Rota Planlayıcı"**
  - Alt Etiketler: `AI Rota Asistanı` • `6 Haneli Konum Kodu & QR` • `Seyahat Araçları`
- **Sağ Taraf:** Screen 1 (Harita) ve Screen 3 (QR Konum Kodu) ekranlarını gösteren 2 adet hafif eğimli telefon maketi.

---

## 4. Mağaza Görsel Kuralları (Kesinlikle Dikkat Edilecekler — Red Sebepleri)

1. **Sahte Puan / Ödül Yasağı:** Görsellerin üzerine *"5 Yıldız"*, *"#1 Seyahat Uygulaması"*, *"En Popüler"* veya *"Editörün Seçimi"* gibi doğrulanamaz ibareler **kesinlikle yazmayın** (Google Play Metadata Policy & Apple 2.3.3).
2. **Fiyat / Ücretsiz İbaresi Yasağı:** Ekran görüntülerinin başlıklarında *"Ücretsiz"*, *"İndirimli"* veya sabit fiyat (`₺149`) kullanmayın; fiyatlar ülkeye göre değiştiği için Apple incelemesinde reddedilir.
3. **Durum Çubuğu (Status Bar) Temizliği:** Ekran görüntülerini alırken telefon saatini `09:41`, pil seviyesini `%100` ve Wi-Fi/hücresel sinyali tam dolu (`xcrun simctl status_bar booted override --time "09:41" --batteryState charged --batteryLevel 100`) olarak sabitleyin.
4. **iPad Ekran Görüntüleri:** iPad (13") görselleri **kesinlikle iPhone ekran görüntüsünün büyütülmüş (stretched) hali olmamalıdır**. iPad Pro (13-inch) simülatöründe gerçek tablet görünümüyle alınmalıdır; aksi halde Apple Guideline 2.3.3'ten red verir.
5. **Alfa Kanalı (Şeffaflık) Kontrolü:** App Store Connect'e yüklenecek tüm PNG dosyalarında alfa kanalı (transparency) kapalı olmalıdır (`sips -s format jpeg` veya `pngquant` / Xcode export).

