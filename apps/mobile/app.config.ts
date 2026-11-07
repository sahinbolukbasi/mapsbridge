// Expo yapılandırmasının KAYNAĞI. app.json bunun statik eşidir (env boş varsayılanla); iki dosya
// apps/web/tests/mobile-design-system.test.cjs ile eşit tutulur. İzin metinleri varsayılan Türkçe
// (I11); iOS yerelleştirmesi `locales/{tr,en}.json` (InfoPlist.strings) dosyalarından gelir.
const PERMISSIONS_TR = {
  location:
    'Maps Bridge, "Yakınımda" ve haritada konumunu göstermek için uygulamayı kullanırken konumuna erişir. Konumun sunucuda saklanmaz.',
  camera: "Topluluk paylaşımına fotoğraf çekebilmen için kamera erişimi gerekir.",
  photos:
    "Topluluk paylaşımına ve profil fotoğrafına görsel ekleyebilmen için fotoğraflarına erişilir.",
  photosAdd: "Rota ve harita görsellerini galerine kaydedebilmen için izin gerekir.",
  faceId: "Açtığında uygulama kilidini Face ID ile açabilmen için kullanılır.",
};

export const APP_CONFIG = {
  expo: {
    name: "Maps Bridge",
    slug: "mapsbridge",
    scheme: "mapsbridge",
    version: "1.0.1",
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
      buildNumber: "1",
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
      },
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
      },
    },
    android: {
      package: "com.mapsbridge.mobile",
      versionCode: 1,
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
          isIosBackgroundLocationEnabled: false,
          isAndroidBackgroundLocationEnabled: false,
        },
      ],
      "expo-notifications",
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
