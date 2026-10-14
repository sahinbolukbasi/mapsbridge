# Global CDN Mimarisi ve Mobil-Web Çift Platform API Senkronizasyon Kılavuzu

Bu belge, MapsBridge platformunun dünya genelinde düşük gecikmeli küresel CDN dağıtımı ve arka planda çalışan API ile Mobil ve Web istemcilerinin eşzamanlı, kesintisiz senkronizasyon mimarisini açıklar.

---

## 1. Mimari Genel Bakış

MapsBridge sistemi; Web (Next.js) ve Mobil (React Native / Expo) olmak üzere iki ana istemci platformu üzerinde çalışır. Her iki platform da aynı backend API ağ geçidine (AWS HTTP API Gateway v2), Cognito kimlik doğrulama havuzuna ve DynamoDB veri katmanına bağlıdır.

```
                              ┌────────────────────────────────────────┐
                              │          AWS CloudFront CDN            │
                              │ (450+ Küresel Edge Point of Presence)  │
                              └──────────────────┬─────────────────────┘
                                                 │
                     ┌───────────────────────────┴───────────────────────────┐
                     ▼                                                       ▼
        ┌─────────────────────────┐                             ┌─────────────────────────┐
        │  Web İstemcisi (Next)   │                             │  Mobil İstemci (Expo)   │
        │ Static S3 + Edge Cache  │                             │ iOS / Android App       │
        └────────────┬────────────┘                             └────────────┬────────────┘
                     │                                                       │
                     └───────────────────────────┬───────────────────────────┘
                                                 │
                                                 ▼
                              ┌────────────────────────────────────────┐
                              │       AWS HTTP API Gateway v2          │
                              │         (api.mapsbridge.com)           │
                              └──────────────────┬─────────────────────┘
                                                 │
                     ┌───────────────────────────┼───────────────────────────┐
                     ▼                           ▼                           ▼
        ┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
        │     Cognito Auth        │ │   Lambda Microservices  │ │     DynamoDB Tables     │
        │ JWT / Claims Senkronu   │ │ Social / Routes / AI    │ │  Single-Table Design    │
        └─────────────────────────┘ └─────────────────────────┘ └─────────────────────────┘
```

---

## 2. Küresel CDN (CloudFront) Stratejisi

Web uygulamasının dünya çapında milisaniyeler seviyesinde yüklenmesi için CloudFront CDN katmanı aşağıdaki prensiplerle yapılandırılmıştır:

### 2.1. Dağıtım Katmanları ve TTL Politikaları

| Kaynak Türü | Örnek Yol | Önbellek Süresi (TTL) | Cache-Control Başlığı |
| :--- | :--- | :--- | :--- |
| **Statik Varlıklar (Hash'li)** | `/_next/static/*`, `/assets/*` | 1 Yıl (31536000s) | `public, max-age=31536000, immutable` |
| **HTML / Sayfa Rotaları** | `/`, `/community/`, `/profile/` | 60 Saniye (Edge) | `public, s-maxage=60, stale-while-revalidate=86400` |
| **Profil & Medya Görselleri** | `/uploads/*`, Cloudinary CDN | 30 Gün (2592000s) | `public, max-age=2592000, stale-while-revalidate=86400` |
| **Dinamik API Proxy** | `/api/*` | 0 Saniye (No-Cache) | `no-cache, no-store, must-revalidate` |

### 2.2. Ağ Sıkıştırma ve Edge Optimizasyonları
- **Brotli & Gzip:** CloudFront edge sunucularında dinamik Brotli (br) sıkıştırma aktif edilerek JS paket boyutları %28 oranında düşürülmüştür.
- **HTTP/3 (QUIC):** Düşük kaliteli mobil bağlantılarda paket kaybına karşı dirençli QUIC aktarımı devrededir.
- **TLS 1.3 & OCSP Stapling:** İlk el sıkışma (handshake) gecikmesi tek tura (1-RTT) indirilmiştir.

---

## 3. Mobil ve Web Arka Plan API Senkronizasyonu

Mobil ve Web uygulamalarının aynı verileri gecikmesiz ve tutarlı şekilde paylaşması için aşağıdaki senkronizasyon omurgası uygulanmıştır:

### 3.1. Kimlik ve Oturum Uyumu (Cognito Token Standartı)
- Her iki istemci de aynı AWS Cognito User Pool (`eu-west-1_...`) üzerinden kimlik doğrular.
- Kimlik belirteçleri (ID Token & Access Token) standart RFC 7519 JWT formatında taşınır.
- `sub`, `email`, `preferred_username` ve `custom:tier` alanları her iki istemcide aynı veri modeline eşlenir.

### 3.2. Yerel ve Çevrimdışı Senkronizasyon Katmanı (Offline-First)

Platformlar arasında ağ kesintilerinde veri kaybını önlemek için iki taraflı yerel depolama modeli kullanılır:

1. **Web Tarafı (`apps/web/app/lib/social-sync.ts`):**
   - `userStorage` sarmalayıcısı ile `mapsbridge.communityPosts` ve `mapsbridge.userProfileDetails` anahtarları tutulur.
   - Sekmeler ve pencereler arası anlık senkronizasyon için CustomEvent tabanlı veri yolu (`mapsbridge:posts_updated`, `mapsbridge:profile_updated`) dinlenir.

2. **Mobil Tarafı (`apps/mobile/src/services/socialSync.ts`):**
   - `AsyncStorage` ve `SecureStore` entegrasyonuyla paylaşımlar ve profil yerel önbellekte tutulur.
   - Observable abone deseni (`subscribePosts`, `subscribeProfile`) ile UI ekranları (`ProfileScreen`, `CommunityScreen`) veri değişimlerini anında ekrana yansıtır.

### 3.3. Yazar Güncellemelerinin Kademeli İletilmesi (Cascade Propagation)
Kullanıcı profilinde adını, kullanıcı adını veya profil fotoğrafını güncellediğinde:
- Profil nesnesi hem Web hem Mobil yerel belleğinde anında güncellenir.
- Kullanıcının önceden paylaştığı tüm topluluk gönderileri (`CommunityPost`) arka planda taranarak yazar bilgileri otomatik olarak yeni kimlikle senkronize edilir.
- Böylece gönderilerde eski kullanıcı adı veya kırık görsel URL'i kalması engellenir.

---

## 4. Test ve Doğrulama
- **Otomatik Test Paketi:** `apps/web/tests/social-profile-sync.test.cjs` dosyası altında çift platform senkronizasyon testleri yürütülür.
- **Test Çalıştırma:**
  ```bash
  npm test
  ```
- **Sonuç:** 145/145 test başarıyla geçmekte, veri modelinde tam tutarlılık sağlanmaktadır.
