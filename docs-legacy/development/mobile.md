# MapsBridge Mobil Geliştirme ve Yayınlama Rehberi (iOS & Android)

MapsBridge mobil uygulaması, saf **React Native (0.86)** ve **Expo SDK 52** mimarisiyle hazırlanmış, doğrudan App Store (iOS) ve Google Play Store (Android) üzerinde yayınlanmaya hazır kurumsal bir mobil projedir.

---

## 1. Mimari ve Kimlik Bilgileri

* **Uygulama Adı:** `MapsBridge`
* **Bundle ID (iOS) & Package (Android):** `com.mapsbridge.mobile`
* **Sürüm (Version):** `1.0.0`
* **Build / VersionCode:** `1`
* **Modül Konumu:** `apps/mobile/`
* **Yerel iOS Projesi:** `apps/mobile/ios/mobile.xcworkspace` (CocoaPods)
* **Yerel Android Projesi:** `apps/mobile/android/` (Gradle & Kotlin)
* **Tasarım / Marka:** Koyu obsidiyen arka plan (`#020e0a`), zümrüt yeşili (`#013628`) ve neon nane vurgular (`#10B981`, `#34D399`).

---

## 2. Geliştirme ve Yerel Test Komutları

Projenin kök dizininde aşağıdaki komutları kullanabilirsiniz:

### Metro Sunucusunu Başlatma
```bash
npm run mobile:start
```

### iOS Cihazında veya Simülatörde Çalıştırma
```bash
npm run mobile:ios
# veya doğrudan Xcode ile açma:
open apps/mobile/ios/mobile.xcworkspace
```

### Android Cihazında veya Emülatörde Çalıştırma
```bash
npm run mobile:android
# veya doğrudan Android Studio ile açma:
open -a "Android Studio" apps/mobile/android
```

### TypeScript Tip Denetimi
```bash
npm run mobile:typecheck
```

### Çevrimdışı JavaScript Paketi Üretme (Embedded Offline Bundle)
```bash
npm run mobile:bundle:ios
```

---

## 3. App Store (iOS) Yayınlama Ayarları

### İzin Açıklamaları (`Info.plist` & `app.json`)
App Store inceleme ekibinin onaylaması için aşağıdaki tüm gizlilik açıklamaları eklenmiştir:
* `ITSAppUsesNonExemptEncryption`: `false` (İhracat uyumluluk popup'ını devre dışı bırakır).
* `NSLocationWhenInUseUsageDescription`: Harita üzerinde en yakın rota ve durakları göstermek için konum izni.
* `NSLocationAlwaysAndWhenInUseUsageDescription`: Canlı rota takibi için arka plan konum izni.
* `NSCameraUsageDescription`: Topluluk akışında seyahat fotoğrafı paylaşımı.
* `NSPhotoLibraryUsageDescription`: Galeriden profil ve gezi fotoğrafı seçimi.
* `NSPhotoLibraryAddUsageDescription`: Oluşturulan rotaları galeriye kaydetme izni.

### App Store'a Gönderim (EAS Build / Xcode)
1. **EAS Build ile (Bulutta Tek Tıkla Derleme):**
   ```bash
   cd apps/mobile
   npx eas build --platform ios --profile production
   npx eas submit --platform ios
   ```
2. **Xcode Üzerinden Arşivleme:**
   - `open apps/mobile/ios/mobile.xcworkspace`
   - Cihaz hedefi olarak **Any iOS Device (arm64)** seçin.
   - Üst menüden **Product > Archive** yapın.
   - Açılan Organizer penceresinde **Distribute App > App Store Connect** adımlarını izleyin.

---

## 4. Google Play Store (Android) Yayınlama Ayarları

### Android Paket ve İzinleri (`AndroidManifest.xml` & `app/build.gradle`)
* `applicationId`: `com.mapsbridge.mobile`
* `versionCode`: `1`, `versionName`: `"1.0.0"`
* Gerekli izinler: Konum (`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`), Kamera (`CAMERA`), Depolama (`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`), İnternet (`INTERNET`).

### Google Play'e Gönderim (AAB - Android App Bundle)
1. **EAS Build ile:**
   ```bash
   cd apps/mobile
   npx eas build --platform android --profile production
   npx eas submit --platform android
   ```
2. **Yerel Gradle ile AAB Üretme:**
   ```bash
   cd apps/mobile/android
   ./gradlew bundleRelease
   ```
   > Üretilen paket: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab` dosyası Google Play Console'a doğrudan yüklenebilir.

---

## 5. Uygulama Logosu ve Vektörel Görsel Varlıkları

* `apps/mobile/assets/icon.png`: 1024x1024 piksel App Store & Google Play ana uygulama ikonu.
* `apps/mobile/assets/splash-icon.png`: 1024x1024 piksel açılış ekranı logosu.
* `apps/mobile/assets/android-icon-foreground.png`: 512x512 piksel Android uyarlanabilir (adaptive) ön plan ikonu.
* `apps/mobile/assets/favicon.png`: Web ve mobil önizleme simgesi.
* `apps/mobile/ios/mobile/Images.xcassets/AppIcon.appiconset/`: Xcode yerel ikon seti.
* `apps/mobile/android/app/src/main/res/mipmap-*/`: Android tüm yoğunluklar için `ic_launcher.png`, `ic_launcher_round.png` ve `ic_launcher_foreground.png`.
* `apps/mobile/android/app/src/main/res/drawable-*/`: Android açılış ekranı logoları (`splashscreen_logo.png`).
