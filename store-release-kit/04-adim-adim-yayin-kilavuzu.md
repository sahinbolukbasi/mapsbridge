# 04 — Adım Adım Yayın Kılavuzu (EAS Build, İmzalama, TestFlight & Google Play)

Bu kılavuz, **Maps Bridge** (`v1.1.0`, Build/VersionCode `19+`) mobil uygulamasını **EAS Build** ile derleyip **Apple App Store Connect** ve **Google Play Console** panellerine **ilk seferde onay alacak şekilde** göndermek için gereken uçtan uca komutları ve panel adımlarını içerir.

---

## BÖLÜM 1: Derleme (Build) Öncesi Son Kontroller ve Demo Hesap Hazırlığı

### 1.1 Otomatik Tip ve Mağaza Uyumluluk Testlerini Çalıştırın
Proje kök dizininde tüm kalite kapılarının yeşil olduğundan emin olun:
```bash
npm run typecheck:all
npm run mobile:typecheck
node --test apps/web/tests/mobile-design-system.test.cjs apps/web/tests/design-system-guard.test.cjs apps/web/tests/mobile-parity.test.cjs apps/web/tests/api-client.test.cjs apps/web/tests/mobile-ai-api.test.cjs apps/web/tests/billing.test.cjs apps/web/tests/pricing.test.cjs
```

### 1.2 İnceleme Ekibi İçin Demo Hesabı (`review@mapsbridge.com`) Doğrulayın
Apple ve Google inceleme ekiplerinin doğrudan giriş yapabilmesi için AWS Cognito (`eu-central-1_3s9k1ef6H`) üzerinde demo hesabının aktif olduğundan emin olun:
```bash
aws cognito-idp admin-create-user \
  --region eu-central-1 \
  --user-pool-id eu-central-1_3s9k1ef6H \
  --username "review@mapsbridge.com" \
  --user-attributes Name=email,Value=review@mapsbridge.com Name=email_verified,Value=true Name=name,Value="App Reviewer" \
  --message-action SUPPRESS || true

aws cognito-idp admin-set-user-password \
  --region eu-central-1 \
  --user-pool-id eu-central-1_3s9k1ef6H \
  --username "review@mapsbridge.com" \
  --password "MapsBridge!2026" \
  --permanent
```

---

## BÖLÜM 2: EAS Build ile Production Derlemesi Alma (iOS IPA & Android AAB)

`apps/mobile/eas.json` dosyası `appVersionSource: "remote"` ve `autoIncrement: true` olarak yapılandırılmıştır. Production ortam değişkenleri (`EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_COGNITO_USER_POOL_ID`, `EXPO_PUBLIC_COGNITO_CLIENT_ID`, `EXPO_PUBLIC_COGNITO_DOMAIN`) `eas.json` içinde tanımlıdır.

### 2.1 EAS CLI Oturumu ve Ortam Değişkenleri Kontrolü
```bash
cd apps/mobile
npx eas-cli whoami
npx eas-cli env:list --environment production
```
> **Önemli:** `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, `EXPO_PUBLIC_RC_IOS_API_KEY` ve `EXPO_PUBLIC_RC_ANDROID_API_KEY` değerlerinin EAS Secrets / Environment Variables altında `production` ortamı için tanımlı olduğunu doğrulayın. Eksikse:
> ```bash
> npx eas-cli env:create --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value "AIza..." --environment production --visibility plaintext
> npx eas-cli env:create --name EXPO_PUBLIC_RC_IOS_API_KEY --value "appl_..." --environment production --visibility plaintext
> npx eas-cli env:create --name EXPO_PUBLIC_RC_ANDROID_API_KEY --value "goog_..." --environment production --visibility plaintext
> ```

### 2.2 iOS Production Build (App Store Connect / TestFlight IPA)
```bash
cd apps/mobile
npx eas-cli build --platform ios --profile production
```
- EAS, Apple Distribution sertifikasını ve `com.mapsbridge.mobile` App Store Provisioning Profile'ını otomatik imzalar ve `buildNumber` değerini uzak sayaçtan artırır.

### 2.3 Android Production Build (Google Play `.aab` App Bundle)
```bash
cd apps/mobile
npx eas-cli build --platform android --profile production
```
- EAS, Android Keystore ile imzalanmış `.aab` (Android App Bundle) paketini üretir ve `versionCode` değerini otomatik artırır.

### 2.4 Mağazalara Otomatik Gönderim (`eas submit`)
Derlemeler tamamlandığında doğrudan mağaza panellerine yüklemek için:
```bash
cd apps/mobile
npx eas-cli submit --platform ios --latest
npx eas-cli submit --platform android --latest
```

---

## BÖLÜM 3: Apple App Store Connect Adım Adım Yayın Kontrol Listesi

1. **App Store Connect > My Apps > Maps Bridge** sayfasına gidin.
2. **TestFlight Sekmesi (Export Compliance / Şifreleme Onayı):**
   - `Info.plist` içinde `ITSAppUsesNonExemptEncryption: false` tanımlı olduğu için derleme otomatik olarak **"Ready to Submit / Test"** durumuna geçer.
   - Internal Testing grubuna ekleyip gerçek bir iPhone üzerinde:
     - Google / E-posta ile giriş,
     - AI Asistan ile rota oluşturma,
     - Haritada 6 haneli konum kodu + QR oluşturma ve Profil'den okutma,
     - Paywall (`Planlar ve Kredi`) ve `Satın Alımları Geri Yükle`,
     - `Hesabımı Kalıcı Olarak Sil` onay diyaloğu
     adımlarını son kez doğrulayın.
3. **Sol Menü > General > App Information:**
   - Primary Category: `Travel`, Secondary Category: `Navigation` seçin.
   - Content Rights: `No, it does not contain, show, or access third-party content` seçip kaydedin.
   - Age Rating: Tüm soruları `None / No` olarak işaretleyin (`4+` veya UGC nedeniyle `12+`).
4. **Sol Menü > General > App Privacy:**
   - Privacy Policy URL: `https://mapsbridge.com/privacy/` girin.
   - `store-release-kit/01-apple-app-store-listing.md` Bölüm 5'teki tabloya göre veri tiplerini işaretleyin ve **Save / Publish** butonuna basın.
5. **Sol Menü > Monetization > Subscriptions / In-App Purchases:**
   - Gezgin (`explorer`), Pro (`pro`), Tur Lideri (`agency`) aboneliklerini ve kredi paketlerini (`boost`, `pack_100`, `pack_300`, `pack_1000`) sürümle ilişkilendirin (veya Polar web yönlendirmesi aktifse Review Notes açıklamasını koruyun).
6. **Sol Menü > iOS App > `1.1.0 Prepare for Submission`:**
   - **Screenshots:** `03-screenshot-ve-gorsel-rehberi.md` rehberine göre **6.9" iPhone** ve **13" iPad** ekran görüntülerini yükleyin.
   - **Promotional Text, Description, Keywords:** `01-apple-app-store-listing.md` içindeki metinleri yapıştırın.
   - **What's New in This Version (Release Notes):** Aşağıdaki Bölüm 5'teki sürüm notunu yapıştırın.
   - **Support URL:** `https://mapsbridge.com/support/`
   - **Marketing URL:** `https://mapsbridge.com/`
   - **Build:** TestFlight'a yüklenen son derlemeyi (`1.1.0 (20+)`) seçin.
   - **App Review Information:** `Sign-in required` işaretleyin; `review@mapsbridge.com` / `MapsBridge!2026` bilgilerini ve Review Notes metnini yapıştırın.
7. Sağ üstten **Add for Review** → **Submit to App Review** butonuna tıklayın.

---

## BÖLÜM 4: Google Play Console Adım Adım Yayın Kontrol Listesi

1. **Google Play Console > Maps Bridge (`com.mapsbridge.mobile`)** uygulamasını açın.
2. **Sol Menü > Politika ve Programlar > Uygulama İçeriği (App Content):**
   - `02-google-play-store-listing.md` Bölüm 2, 3 ve 4'teki cevap anahtarına göre şu bölümlerin tamamını **"Tamamlandı"** durumuna getirin:
     - Gizlilik Politikası (`https://mapsbridge.com/privacy/`)
     - Reklamlar (`No ads`)
     - Uygulama Erişimi (`review@mapsbridge.com` / `MapsBridge!2026`)
     - İçerik Derecelendirmesi (IARC)
     - Hedef Kitle ve İçerik (`18+`)
     - Veri Güvenliği (Data Safety + Hesap Silme URL'si: `https://mapsbridge.com/profile/edit/?tab=tehlike`)
     - Devlet Uygulamaları (`Hayır`)
     - Finansal Özellikler (`Uygulamam herhangi bir finansal özellik sağlamıyor`)
     - Sağlık Uygulamaları (`Uygulamam herhangi bir sağlık özelliği sağlamıyor`)
3. **Sol Menü > Büyüme > Mağaza Varlığı > Ana Mağaza Girişi (Main Store Listing):**
   - Uygulama adı, kısa açıklama ve tam açıklamayı `02-google-play-store-listing.md` dosyasından yapıştırın.
   - `512x512` İkon, `1024x500` Özellik Grafiği ve Telefon / 7" Tablet / 10" Tablet ekran görüntülerini yükleyin.
4. **App Links (`assetlinks.json`) Doğrulaması:**
   - **Sol Menü > Sürüm > Kurulum > Uygulama İmzalama (App Integrity / App Signing)** sayfasından **Uygulama imzalama anahtarı sertifikası SHA-256 parmak izini** kopyalayın.
   - `apps/web/public/.well-known/assetlinks.json` içindeki `REPLACE_WITH_GOOGLE_PLAY_APP_SIGNING_SHA256_FINGERPRINT` değerini bu SHA-256 değeriyle değiştirip web sitesini deploy edin.
5. **Sol Menü > Sürüm > Dahili Test (Internal Testing) ve Üretim (Production):**
   - Önce **Dahili Test (Internal Testing)** kanalında yeni sürüm oluşturup `.aab` dosyasını yükleyin ve test cihazında doğrulayın.
   - Ardından **Üretim (Production) > Yeni Sürüm Oluştur** adımından `.aab` paketini seçin, aşağıdaki Sürüm Notlarını (Release Notes) yapıştırın ve **İncelemeye Gönder (Send for review)** butonuna basın.

---

## BÖLÜM 5: Sürüm Notları (Release Notes / What's New — v1.1.0)

### Türkçe (`tr-TR`)
```text
Maps Bridge 1.1.0 ile seyahat planlama ve konum paylaşımı deneyimi baştan sona yenilendi:

• Gelişmiş Yapay Zeka Seyahat Asistanı: Çok katmanlı yeni AI rota motoru ile duraklarınız coğrafi kümeleme (K-Means) ile günlere ve saat dilimlerine çok daha gerçekçi şekilde dağıtılır.
• 6 Haneli Konum Kodu ve QR Paylaşımı: Haritada seçtiğiniz konumu 6 haneli kod veya QR kod olarak paylaşın; Profil sekmesinden kodu girerek ya da kamerayla QR okutarak doğrudan paylaşılan konuma gidin.
• Kişisel Durak Notları ve Mekan Ayrıntıları Ayrımı: Rota bilgi sayfasında yalnızca kişisel notlarınızı görün; harita pini üzerindeki "Ayrıntı" butonuyla çalışma saatleri, web sitesi ve fotoğraflara ulaşın.
• Sallayarak Acil Yardım (112 SOS): Geri sayım biter bitmez doğrudan yerel acil yardım hattını arayan yenilenmiş güvenlik akışı.
• Performans ve Kararlılık: Yenilenen ağ katmanı, çevrimdışı önbellekleme ve hesap yönetimi iyileştirmeleri.
```

### İngilizce (`en-US`)
```text
Maps Bridge 1.1.0 brings major upgrades to AI route planning, location sharing, and travel safety:

• Upgraded Multi-Agent AI Route Planner: Geographically clustered day-by-day itineraries with realistic walking and driving estimates.
• 6-Digit Location Code & QR Scanner: Share any map pin with a 6-digit code and QR code, or scan a code from your Profile tab to open shared locations instantly.
• Separated Stop Notes & Live Place Details: Keep personal notes clean in your stop sheet while viewing live opening hours, websites, and photos via the map pin Details card.
• Direct Shake-to-SOS Emergency Call: Optional shake detection that dials local emergency services automatically when the countdown completes.
• Performance, offline caching, and account management improvements.
```

