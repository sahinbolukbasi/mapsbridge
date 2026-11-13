# 02 — Google Play Console Listing, Data Safety & IARC Rehberi

Bu doküman, **Maps Bridge** (`com.mapsbridge.mobile`, VersionCode `19`, VersionName `1.1.0`) uygulamasının **Google Play Console** paneline girilecek mağaza metinlerini, **Data Safety (Veri Güvenliği)** formunun birebir cevap anahtarını, **IARC İçerik Derecelendirme** yanıtlarını ve **App Access / Hesap Silme** bağlantılarını içerir.

---

## 1. Mağaza Girişi (Main Store Listing — Türkçe & İngilizce)

### Uygulama Adı (App Name — Max 30 Karakter)
- **TR:** `Maps Bridge: Gezi & Rota Planı` *(30/30 karakter)*
- **EN:** `Maps Bridge: AI Trip Planner` *(28/30 karakter)*

### Kısa Açıklama (Short Description — Max 80 Karakter)
- **TR:**
```text
Yapay zeka ile günlük gezi rotası planla, 6 haneli kod veya QR ile konum paylaş.
```
*(80/80 karakter)*

- **EN:**
```text
Plan daily travel routes with AI and share locations via 6-digit codes or QR.
```
*(77/80 karakter)*

### Tam Açıklama (Full Description — Max 4000 Karakter, Spam & Keyword Stuffing İçermeyen)
```text
Maps Bridge, seyahatlerini tek bir ekrandan planlaman, harita üzerinde optimize edilmiş günlük rotalar oluşturman ve konumlarını 6 haneli kısa kod veya QR kod ile saniyeler içinde paylaşman için geliştirilmiş akıllı seyahat ve rota platformudur.

İster günübirlik bir şehir gezisi ister çok duraklı uzun bir tatil planla; Maps Bridge duraklarını coğrafi yakınlığa göre günlere böler, yürüyüş ve sürüş sürelerini hesaplar ve tüm seyahat belgelerini tek bir yerde toplar.

TEMEL ÖZELLİKLER

1. Yapay Zeka Destekli Rota ve Gezi Planlayıcı
Gitmek istediğin şehri, gün sayısını ve seyahat tarzını yaz; kişisel seyahat asistanın durakları sabah, öğle ve akşam saat dilimlerine ayrılmış gerçekçi bir günlük plan halinde hazırlasın. Oluşturulan planı tek dokunuşla kendi haritana kaydet ve dilediğin gibi düzenle.

2. 6 Haneli Konum Kodu ve QR Kod ile Paylaşım
Harita üzerinde seçtiğin bir konumu veya hazırladığın rotayı 6 haneli özel bir kodla ya da QR kod ile paylaş. Arkadaşların Profil sekmesinden 6 haneli kodu girerek veya kamerayla QR kodu okutarak doğrudan paylaşılan konum sayfasına ulaşabilir.

3. Kişisel Durak Notları ve Canlı Mekan Ayrıntıları
Rota duraklarındaki bilgi sayfasında yalnızca kendi girdiğin notları, fotoğrafları ve saatleri sade bir şekilde gör. Harita üzerindeki mekan pinine dokunduğunda açılan "Ayrıntı" butonuyla mekanın çalışma saatlerini, açık/kapalı bilgisini, web sitesini, puanını ve fotoğraflarını incele.

4. Seyahat Belgeleri, Bütçe ve Çevrimdışı Araçlar
Uçak biletlerini, otel rezervasyonlarını ve vize belgelerini düzenli tut. Gezi bütçeni takip et, canlı döviz çeviriciyi kullan ve internet bağlantın olmasa bile kayıtlı rotalarına, pusulaya ve acil durum rehberine ulaş.

5. Sallayarak Acil Yardım (112 SOS)
Güvenlik araçları içindeki isteğe bağlı Sallayarak Acil Yardım özelliği açıkken, acil bir durumda telefonunu salladığında geri sayım sonunda doğrudan yerel acil yardım numarası (112) aranır.

6. Gezgin Topluluğu
Diğer gezginlerin paylaştığı gezi notlarını ve fotoğrafları incele, beğendiğin gönderileri kaydet ve kendi seyahat deneyimlerini toplulukla paylaş.

İZİNLER VE GİZLİLİK ŞEFFAFLIĞI

• Konum (Yalnızca Uygulama Açıkken): Harita üzerinde konumunu göstermek ve yakınındaki mekanları listelemek için kullanılır. Arka planda konum izni (ACCESS_BACKGROUND_LOCATION) istenmez ve kullanılmaz.
• Kamera: Topluluk gönderilerine fotoğraf eklemek ve 6 haneli konum QR kodlarını okutmak için kullanılır.
• Bildirimler: Yalnızca cihazında zamanlanan yerel rota hatırlatmaları için kullanılır.

Gizlilik Politikası: https://mapsbridge.com/privacy/
Kullanım Koşulları: https://mapsbridge.com/terms/
Web Hesap Silme Sayfası: https://mapsbridge.com/profile/edit/?tab=tehlike
Destek: https://mapsbridge.com/support/
```

---

## 2. Google Play Policy & App Content (Uygulama İçeriği) Kontrolleri

### A. Gizlilik Politikası ve Hesap Silme URL'leri (Zorunlu)
- **Privacy Policy URL:** `https://mapsbridge.com/privacy/`
- **In-App Account Deletion Path:** `Profil > Hesabımı Kalıcı Olarak Sil`
- **Web Account Deletion URL (Google Play Data Deletion Requirement):** `https://mapsbridge.com/profile/edit/?tab=tehlike`
  *(Google Play Console > App content > Account deletion ekranındaki "Delete account URL" alanına bu URL girilir).*

### B. App Access (Uygulama Erişimi — Test Hesabı Talimatları)
- **Seçenek:** *All or some functionality in my app is restricted (Uygulamamdaki tüm veya bazı işlevler kısıtlı).*
- **Talimat Adı:** `Maps Bridge Reviewer Account`
- **Kullanıcı Adı / E-posta:** `review@mapsbridge.com`
- **Şifre:** `MapsBridge!2026`
- **İnceleme Ekibi İçin Açıklama (Instructions):**
  ```text
  1. Launch the app. Map, Discover, Plan, and Tools tabs work immediately in guest mode.
  2. To test authenticated features (AI Route Planner, Cloud Route Sync, Community Posting, Profile & Account Deletion), open the "Profil" (Profile) tab and sign in with:
     Email: review@mapsbridge.com
     Password: MapsBridge!2026
  3. No 2FA or OTP is required for this reviewer account.
  ```

### C. Ads (Reklamlar)
- **Contains ads?** → **No, my app does not contain ads (Hayır, uygulamam reklam içermiyor).**

### D. Target Audience and Content (Hedef Kitle)
- **Target Age Groups:** `18 and over` (veya `13-15`, `16-17`, `18 and over` — "Designed for Families" programına **dahil edilmemelidir**).
- **Appeal to children?** → **No (Hayır).**

---

## 3. Data Safety (Veri Güvenliği) Formu Cevap Anahtarı

Google Play Console > **App content > Data safety** bölümünde sırasıyla verilecek cevaplar:

1. **Does your app collect or share any of the required user data types?** → **Yes (Evet)**
2. **Is all of the user data collected by your app encrypted in transit?** → **Yes (Evet — HTTPS/TLS 1.3 üzerinden AWS API Gateway & Cognito)**
3. **Do you provide a way for users to request that their data is deleted?** → **Yes (Evet)**
   - **Delete account URL:** `https://mapsbridge.com/profile/edit/?tab=tehlike`

### Seçilecek Veri Türleri ve Detayları

| Kategori | Veri Türü | Collected (Toplanıyor mu?) | Shared (3. Tarafla Paylaşılıyor mu?) | Ephemeral (Geçici mi?) | Zorunlu mu / İsteğe Bağlı mı? | Kullanım Amacı |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Location** | Approximate location & Precise location | **Yes** | **No** | **Yes** (Yalnızca anlık "Yakınımda" ve harita sorgusunda işlenir, sunucuda profil geçmişi olarak saklanmaz) | **Optional** (Kullanıcı konum iznini reddetse de uygulamayı kullanabilir) | App functionality |
| **Personal info** | Name, Email address, User IDs | **Yes** | **No** | **No** | **Optional** (Misafir modunda zorunlu değildir; hesap açarken zorunludur) | App functionality, Account management |
| **Financial info** | Purchase history | **Yes** | **No** | **No** | **Optional** | App functionality, Account management |
| **Photos and videos** | Photos | **Yes** | **No** | **No** | **Optional** (Yalnızca kullanıcı profil fotoğrafı veya topluluk/durak fotoğrafı yüklerse) | App functionality |
| **App activity** | Other user-generated content (Rotalar, topluluk gönderileri, durak notları) | **Yes** | **No** | **No** | **Optional** | App functionality |

---

## 4. Content Rating (IARC İçerik Derecelendirme) Anket Cevapları

Google Play Console > **App content > Content rating** anketinde:

- **Category:** `Utility, Productivity, Communication, or Other` (veya `Reference, News, or Educational` / `Social Networking` — topluluk akışı olduğu için sorulursa `Yes: Users can interact/share content` seçilir).
- **Violence (Şiddet):** `No`
- **Sexuality (Cinsellik):** `No`
- **Language (Küfür/Argo):** `No`
- **Controlled Substances (Alkol/Tütün/Uyuşturucu):** `No`
- **User Interaction / Shares Info:**
  - *Does the app natively allow users to interact or exchange content with other users?* → **Yes** (Gezgin topluluğu gönderileri ve yorumları).
  - *Does the app share the user's current physical location with other users?* → **Yes** (Kullanıcı kendi isteğiyle 6 haneli konum kodu veya QR oluşturup paylaştığında).
  - *Does the app allow users to purchase digital goods?* → **Yes** (Abonelik ve kredi paketleri).

