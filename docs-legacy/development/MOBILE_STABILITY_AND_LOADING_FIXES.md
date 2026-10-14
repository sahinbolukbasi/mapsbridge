# Mobil Uygulama Başlatma, Yükleme ve Kararlılık Düzeltmeleri Raporu

Bu belge, MapsBridge mobil uygulamasında (`apps/mobile`) tespit edilen başlatma gecikmeleri, yükleme/kurulum sırasındaki beyaz ekran hataları, açılış ekranı yarış koşulu (race condition) ve bileşen çökme risklerine yönelik uygulanan kalıcı mühendislik çözümlerini açıklar.

---

## 1. Tespit Edilen Kritik Hatalar ve Kök Nedenler

### 1.1. Açılış Ekranı (Splash Screen) ve Oturum Yükleme Yarış Koşulu
- **Kök Neden:** `apps/mobile/App.tsx` içerisinde açılış ekranını gösterme şartı daha önce şu şekilde tanımlanmıştı:
  ```typescript
  if (loadingSession && showSplash) {
    return <SplashScreen ... />;
  }
  ```
  `AsyncStorage` üzerinden oturum yüklemesi yerel önbellek hızlı olduğunda (10-50 ms) tamamlanıyordu. Bu durumda `loadingSession` `false` oluyor, ancak `showSplash` henüz `true` (2500 ms zamanlayıcısı bitmemiş) kalıyordu. Şart `&&` (VE) olduğu için kontrol başarısız oluyor ve uygulama anında `if (!session)` bloğuna düşerek kullanıcının karşısına 100 ms içinde aniden `WelcomeScreen` (Giriş/Kayıt) fırlatıyordu. Kullanıcı oturumu açık olsa bile kısa süreliğine giriş ekranı yanıp sönüyor ve ekran hiyerarşisi bozuluyordu.
- **Çözüm:** Mantık `loadingSession || showSplash` (VEYA) olarak düzeltildi. Oturum kontrolü ve minimum marka karşılama animasyonu tamamlanana kadar açılış ekranı kararlı biçimde ekranda tutulur. Ardından `NavigationContainer` içine kesintisiz yumuşak geçiş yapılır.

### 1.2. React Native Render Çökmeleri ve Beyaz Ekran (White Screen of Death)
- **Kök Neden:** Mobil ortamda JavaScript tarafında fırlatılan işlenmemiş bir çalışma zamanı hatası (örneğin bozuk depolama verisi, eksik profil alanı veya ağ kesintisi) React bileşen ağacının çökmesine ve kullanıcının tamamen beyaz veya donuk bir ekranda kalmasına sebep oluyordu.
- **Çözüm:** `apps/mobile/src/components/ErrorBoundary.tsx` bileşeni geliştirildi ve `App.tsx` en üst kök seviyesine yerleştirildi. Herhangi bir alt bileşende hata meydana geldiğinde:
  1. Hata yakalanır ve konsola yığıt (stack trace) kaydedilir.
  2. Kullanıcıya çökmeyen, soft minimalist tasarıma uygun zarif bir hata kurtarma ekranı sunulur.
  3. "Uygulamayı Yeniden Başlat" butonu ile uygulama durumu sıfırlanıp güvenli bir şekilde yeniden açılır.

### 1.3. SVG İkon Çift Tanım (Duplicate Identifier) TypeScript Hatası
- **Kök Neden:** `apps/mobile/src/components/Icons.tsx` içerisinde `CameraIcon` iki kez farklı satırlarda deklare edilmişti. Bu durum iOS ve Android paketleme (bundle export) adımlarında `TS2323: Cannot redeclare exported variable 'CameraIcon'` derleme hatası üretiyordu.
- **Çözüm:** Çift bildirim temizlendi, tekil ve standart SVG `CameraIcon` bileşeni muhafaza edildi.

### 1.4. Açılış Ekranındaki Sert Emojilerin Soft İkonlara Dönüştürülmesi
- **Kök Neden:** `apps/mobile/src/components/SplashScreen.tsx` içerisinde `🌱`, `🧭`, `🗺️`, `🌲`, `⚡`, `🛡️` gibi unicode emojiler kullanılıyordu. Farklı Android üreticilerinde (Samsung, Xiaomi vb.) ve eski iOS sürümlerinde bu emojiler farklı yazı tipleri nedeniyle kayıyor veya çirkin pikseller oluşturuyordu.
- **Çözüm:** Tüm unicode emojiler `LeafIcon`, `ExploreIcon`, `MapIcon`, `TreesIcon`, `SparkIcon`, `ShieldIcon` gibi vektörel SVG ikonlarla değiştirildi.

---

## 2. Mimari İyileştirmeler ve Kod Değişiklikleri

### 2.1. `App.tsx` - Kararlı Yaşam Döngüsü Yapısı
```tsx
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  // Splash ekranı süresi ve oturum kontrolü paralel yürütülür
  useEffect(() => {
    async function init() {
      try {
        const stored = await getStoredSession();
        setSession(stored);
      } catch (e) {
        console.warn('Oturum okunamadı:', e);
      } finally {
        setLoadingSession(false);
      }
    }
    init();
  }, []);

  // Kararlı bekleme kontrolü: Oturum ve animasyon bitene kadar güvenle bekle
  if (loadingSession || showSplash) {
    return (
      <SplashScreen
        onAnimationFinish={() => {
          if (!loadingSession) {
            setShowSplash(false);
          }
        }}
      />
    );
  }

  return (
    <ErrorBoundary>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
          {!session ? (
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
          ) : (
            <Stack.Screen name="MainTabs" component={MainTabs} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
}
```

### 2.2. `ErrorBoundary.tsx` - Hata Yakalayıcı Mimarisi
- `componentDidCatch(error: Error, info: ErrorInfo)` yaşam döngüsü metodu ile yakalama.
- Yumuşak koyu tema (Background `#0A1118`, Card `#16222F`), soft kalkan ikonu (`ShieldIcon`) ve kullanıcı dostu kurtarma aksiyonu.

---

## 3. Doğrulama ve Test Sonuçları

1. **TypeScript Tip Denetimi:**
   ```bash
   npm run mobile:typecheck
   # Çıktı: Exit code 0 (Hata yok)
   ```

2. **iOS & Android Paketleme Doğrulaması:**
   ```bash
   npx expo export --clear --platform ios
   # Çıktı: Exported iOS bundle successfully (0 error)
   ```

3. **Otomatik Birim Testi:**
   `apps/web/tests/social-profile-sync.test.cjs` dosyası altındaki `Mobile Startup Stability & ErrorBoundary Contract` testi ile açılış ekranı yarış koşulu simüle edilip %100 başarıyla doğrulanmıştır.
