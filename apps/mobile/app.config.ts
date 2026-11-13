// Expo yapılandırmasının KAYNAĞI. app.json bunun statik eşidir (env boş varsayılanla); iki dosya
// apps/web/tests/mobile-design-system.test.cjs ile eşit tutulur. İzin metinleri varsayılan Türkçe
// (I11); iOS yerelleştirmesi `locales/{tr,en}.json` (InfoPlist.strings) dosyalarından gelir.
const PERMISSIONS_TR = {
  location:
    "Maps Bridge, “Yakınımda” ve haritada konumunu göstermek için uygulamayı kullanırken konumuna erişir. Konumun sunucuda saklanmaz.",
  camera:
    "Topluluk paylaşımına fotoğraf çekebilmen ve paylaşılan 6 haneli konum QR kodlarını okutabilmen için kamera erişimi gerekir.",
  photos:
    "Topluluk paylaşımına ve profil fotoğrafına görsel ekleyebilmen için fotoğraflarına erişilir.",
  photosAdd: "Rota ve harita görsellerini galerine kaydedebilmen için izin gerekir.",
  faceId: "Açtığında uygulama kilidini Face ID ile açabilmen için kullanılır.",
  // Hareket (CoreMotion): Maps Bridge hareket verisi TOPLAMAZ. İvmeölçer yalnızca cihaz içinde
  // isteğe bağlı Sallayarak Acil Yardım (112 SOS) algılaması ve expo-location sistem kütüphanesi için kullanılır.
  motion:
    "Maps Bridge hareket verini sunucuda toplamaz; ivmeölçer yalnızca cihaz içinde isteğe bağlı Sallayarak Acil Yardım (112 SOS) algılaması ve konum bileşeninin sistem kütüphanesi için kullanılır.",
};

export const APP_CONFIG = {
  expo: {
    name: "Maps Bridge",
    slug: "mapsbridge",
    scheme: "mapsbridge",
    version: "1.1.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    locales: {
      tr: "./locales/tr.json",
      en: "./locales/en.json",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.mapsbridge.mobile",
      // Evrensel bağlantılar (K4) GEÇİCİ KAPALI: mevcut App Store provisioning profilinde
      // Associated Domains yeteneği yok; etkileşimsiz EAS derlemesi imzada düşüyordu. AASA
      // (/.well-known/apple-app-site-association, Team ID ile; infra-changes.md §4.7) yayınlanıp
      // yetenek Apple Developer'da açılınca birlikte geri eklenecek:
      //   associatedDomains: ["applinks:mapsbridge.com", "applinks:www.mapsbridge.com"],
      // O zamana kadar `mapsbridge://` şema bağlantıları çalışır.
      // buildNumber: eas.json appVersionSource:"remote" + production.autoIncrement:true olduğundan
      // EAS production derlemesinde bu değer YOK SAYILIR (uzak sayaç yönetir). Yine de yerel/prebuild
      // ve tutarlılık için güncel tutulur. ITMS-90683 düzeltmesiyle 2 → 3; auth-fix sürümü 3 → 19.
      buildNumber: "19",
      userInterfaceStyle: "dark",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        CFBundleAllowMixedLocalizations: true,
        CFBundleDevelopmentRegion: "tr",
        NSLocationWhenInUseUsageDescription: PERMISSIONS_TR.location,
        NSCameraUsageDescription: PERMISSIONS_TR.camera,
        NSPhotoLibraryUsageDescription: PERMISSIONS_TR.photos,
        NSPhotoLibraryAddUsageDescription: PERMISSIONS_TR.photosAdd,
        NSFaceIDUsageDescription: PERMISSIONS_TR.faceId,
        // ITMS-90683 düzeltmesi: expo-location CoreMotion'ı statik bağlar (CMMotionActivityManager);
        // Apple uygulama kullanmasa da purpose string ister. Bu anahtar RESOLVED Info.plist'te
        // bulunmalı. expo-location eklentisi motionUsagePermission:false ile bunu yazmaz, bu yüzden
        // burada açıkça tanımlanır (eklenti dokümanı bu durumda elle eklenmesini söyler).
        NSMotionUsageDescription: PERMISSIONS_TR.motion,
      },
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
      },
      // iOS Gizlilik Manifestosu (PrivacyInfo.xcprivacy) — Apple 1 Mayıs 2024'ten beri zorunlu
      // kılıyor. Expo SDK 50+ bunu app config'teki `privacyManifests`ten prebuild'de üretir
      // (@expo/config-plugins). Expo dokümanı: statik CocoaPods bağımlılıklarının kendi
      // PrivacyInfo dosyalarını Apple her zaman doğru çözümlemediği için, paketlerin kullandığı
      // "zorunlu gerekçe" API'lerini uygulama manifestinde toplamak gerekir. Aşağıdaki gerekçeler
      // bundle'daki paketlerin (react-native, async-storage, expo-file-system/application/constants/
      // notifications) ios/PrivacyInfo.xcprivacy dosyalarından toplanmıştır.
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyTrackingDomains: [] as string[],
        NSPrivacyCollectedDataTypes: [
          {
            // Konum: "Yakınımda" ve haritada konum için (yalnız uygulama açıkken). Sunucuda
            // saklanmaz, takip için kullanılmaz, kullanıcıya bağlı değildir.
            NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePreciseLocation",
            NSPrivacyCollectedDataTypeLinked: false,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: [
              "NSPrivacyCollectedDataTypePurposeAppFunctionality",
            ],
          },
          {
            // Fotoğraflar: topluluk paylaşımı ve profil fotoğrafı (kullanıcı içeriği).
            NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhotosorVideos",
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: [
              "NSPrivacyCollectedDataTypePurposeAppFunctionality",
            ],
          },
          {
            // Kullanıcı içeriği: topluluk gönderileri/rota paylaşımı.
            NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeOtherUserContent",
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: [
              "NSPrivacyCollectedDataTypePurposeAppFunctionality",
            ],
          },
        ],
        NSPrivacyAccessedAPITypes: [
          {
            // Dosya zaman damgası: react-native, async-storage, expo-file-system/application.
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
            NSPrivacyAccessedAPITypeReasons: ["C617.1", "0A2A.1", "3B52.1"],
          },
          {
            // Disk alanı: expo-file-system.
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
            NSPrivacyAccessedAPITypeReasons: ["E174.1", "85F4.1"],
          },
          {
            // UserDefaults: react-native, expo-constants, expo-notifications.
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
            NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
          },
        ],
      },
    },
    android: {
      package: "com.mapsbridge.mobile",
      // versionCode: iOS buildNumber ile tutarlı (EAS remote autoIncrement bu değeri yönetir). 2 → 3; auth-fix sürümü 3 → 19.
      versionCode: 19,
      userInterfaceStyle: "dark",
      adaptiveIcon: {
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundColor: "#020e0a",
      },
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
        },
      },
      // Yalnız uygulama açıkken konum (arka plan konumu yok), yerel bildirim, biyometrik kilit.
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "CAMERA",
        "INTERNET",
        "POST_NOTIFICATIONS",
        "USE_BIOMETRIC",
        "VIBRATE",
      ],
      blockedPermissions: ["android.permission.ACCESS_BACKGROUND_LOCATION"],
      // App Links (K4): doğrulama için /.well-known/assetlinks.json (imza SHA-256; infra-changes.md §4.7).
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: ["mapsbridge.com", "www.mapsbridge.com"].flatMap((host) =>
            ["/k/", "/traveler/", "/maps/"].map((pathPrefix) => ({
              scheme: "https",
              host,
              pathPrefix,
            })),
          ),
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
      predictiveBackGestureEnabled: true,
    },
    plugins: [
      "expo-secure-store",
      "expo-font",
      "expo-sharing",
      [
        "expo-location",
        {
          locationWhenInUsePermission: PERMISSIONS_TR.location,
          // Yalnız uygulama açıkken: "Always" izin metinleri Info.plist'e yazılmaz (false → anahtar silinir).
          locationAlwaysAndWhenInUsePermission: false,
          locationAlwaysPermission: false,
          // NSMotionUsageDescription ZORUNLU (ITMS-90683): expo-location CoreMotion'ı statik bağlar.
          // Eklenti motionUsagePermission:false alırsa anahtarı SİLER ve prebuild'de base infoPlist'teki
          // değerimizi de temizler. Bu yüzden eklentiye de dürüst metni veriyoruz (ikisi aynı string).
          motionUsagePermission: PERMISSIONS_TR.motion,
          isIosBackgroundLocationEnabled: false,
          isAndroidBackgroundLocationEnabled: false,
        },
      ],
      // Yalnız yerel bildirim (push yok); TestFlight/App Store imzası için üretim ortamı.
      // Yerel bildirim push yetkisi istemez; `aps-environment` silinir (profilde Push yeteneği yok).
      // expo-notifications'tan ÖNCE listelenir: Expo mod zincirinde sonra eklenen mod önce koşar,
      // yani bu eklentinin silmesi expo-notifications yetkiyi yazdıktan sonra çalışır.
      "./plugins/without-push-entitlement.js",
      ["expo-notifications", { mode: "production" }],
      [
        "expo-local-authentication",
        {
          faceIDPermission: PERMISSIONS_TR.faceId,
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: PERMISSIONS_TR.photos,
          cameraPermission: PERMISSIONS_TR.camera,
          // Video kaydı yok: mikrofon izni (RECORD_AUDIO) istenmez.
          microphonePermission: false,
        },
      ],
    ],
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      // Mobil istemcinin API tabanı (src/services/api.ts aynı env'i derleme anında okur).
      apiBaseUrl:
        process.env.EXPO_PUBLIC_API_BASE_URL ||
        "https://pwi1j8mq0j.execute-api.eu-central-1.amazonaws.com",
      eas: {
        projectId: "1d5b0238-eed2-450a-9777-06eed2a42303",
      },
    },
    owner: "sahinbolukbasi",
  },
};

// Expo, app.json içeriğini `config` olarak verir; kaynak burasıdır (app.json eşit tutulur).
export default ({ config }: { config: Record<string, unknown> }) => ({
  ...config,
  ...APP_CONFIG.expo,
});
