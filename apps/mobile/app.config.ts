export default {
  expo: {
    name: "Maps Bridge",
    displayName: "Maps Bridge",
    slug: "mapsbridge",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#020e0a",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.mapsbridge.mobile",
      buildNumber: "1",
      userInterfaceStyle: "dark",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription:
          "MapsBridge, size en yakın rotaları ve durakları harita üzerinde gösterebilmek için konum izninize ihtiyaç duyar.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "Canlı saha rotanızda gezinirken konumunuzu takip edebilmek ve durak bildirimleri sunabilmek için konum iznine ihtiyaç duyulur.",
        NSLocationAlwaysUsageDescription:
          "Canlı saha rotanızda gezinirken arka planda konumunuzu takip edebilmek ve durak bildirimleri sunabilmek için konum iznine ihtiyaç duyulur.",
        NSCameraUsageDescription:
          "Seyahat fotoğraflarınızı topluluk akışında paylaşabilmeniz için kamera erişim izni gereklidir.",
        NSPhotoLibraryUsageDescription:
          "Profil fotoğrafı ve rota keşif görsellerinizi toplulukla paylaşabilmek için fotoğraf galerinize erişim izni gereklidir.",
        NSPhotoLibraryAddUsageDescription:
          "Oluşturduğunuz gezi rotası ve harita görsellerini galerinize kaydedebilmeniz için izin gereklidir.",
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
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "INTERNET",
      ],
      predictiveBackGestureEnabled: false,
    },
    plugins: [
      "expo-secure-store",
    ],
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      eas: {
        projectId: "1d5b0238-eed2-450a-9777-06eed2a42303",
      },
    },
    owner: "sahinbolukbasi",
  },
};
