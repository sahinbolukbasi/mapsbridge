# Mevcut Kod Tabanı Kalite Analizi ve Teknik Borç Raporu

> **Tarih:** 26 Eylül 2026  
> **Kapsam:** `apps/web`, `infra/lambda`, `apps/web/server`, `apps/web/app/lib`, `packages/`, `infra/terraform`  
> **Amaç:** Kod kalitesi, SOLID, Clean Code, Clean Architecture, DDD uyumu, isimlendirme standartları ve teknik borçların tespiti.

---

## 1. Yönetici Özeti (Executive Summary)

Mevcut sistem; çalışan zengin özelliklere, AWS Bedrock AI entegrasyonuna, Stripe ödeme akışına ve 110 adet geçen backend/güvenlik testine sahip çalışan bir platformdur. Ancak hızlı geliştirme sürecinin bir sonucu olarak aşağıdaki kritik mimari ve kalite problemleri tespit edilmiştir:

1. **Devasa Boyutlu "God Component" ve Dosyalar:** Frontend tarafında 3.346 satırlık (`app/topluluk/page.tsx`), 2.727 satırlık (`app/panel/page.tsx`) ve 1.946 satırlık (`app/mesajlar/page.tsx`) bileşenler bulunmaktadır.
2. **Katman ve Bağımlılık Yönü İhlalleri:** Frontend uygulaması (`apps/web/server/ai-handler.ts`) backend Lambda handler'ı olarak derlenmekte, `infra/lambda/src/ai/index.ts` frontend'e ters import atmaktadır.
3. **Controller İçi Ağır İş Mantığı:** Lambda handler'larında (`routes/index.ts`, `admin/index.ts`) transport katmanı olması gereken controller fonksiyonları içinde doğrudan DynamoDB sorguları, OSRM HTTP istekleri ve yetki kontrolleri iç içe geçmiştir.
4. **Türkçe-İngilizce Karışık İsimlendirme:** Frontend route'ları ve bazı değişkenler Türkçe iken (`kullanici`, `odeme`, `rota`, `bakiye`, `nasil-calisir`, `sifre-sifirla`), backend servisleri İngilizce terimler kullanmaktadır.
5. **Magic String ve Magic Number Kullanımı:** Kredi bedelleri (`5`, `1`, `0`), HTTP durum kodları, DynamoDB PK/SK önekleri (`USER#`, `SHARE#`) ve rol isimleri (`admin`, `moderator`) kod içine dağınık şekilde serpiştirilmiştir.

---

## 2. En Büyük 15 Dosya ve Karmaşıklık Analizi

| Dosya Yolu | Satır Sayısı | Rol / Sorumluluk | Tespit Edilen Kalite Problemi |
|---|---|---|---|
| `apps/web/app/topluluk/page.tsx` | **3.346** | Topluluk vitrini | God Component; UI, arama, filtreleme, state, modal tek dosyada |
| `apps/web/app/panel/page.tsx` | **2.727** | Harita masası | Aşırı uzun methodlar, Leaflet olayları ve state iç içe |
| `apps/web/app/mesajlar/page.tsx` | **1.946** | Canlı mesajlaşma | WebSocket dinleyicileri, UI render ve thread yönetimi karışık |
| `apps/web/app/profil/duzenle/page.tsx` | **1.938** | Profil düzenleme | Form doğrulama, avatar yükleme ve görsel ayarlar ayrılmamış |
| `apps/web/app/components/trip/travel-planner-sidebar.tsx` | **1.801** | Gezi kenar çubuğu | Sürükle-bırak, durak sıralama ve OSRM optimizasyonu monolitik |
| `apps/web/app/[username]/public-profile-client.tsx` | **1.456** | Kamusal profil | Profil detayları ve harita rotaları ayrıştırılmamış |
| `apps/web/app/profil/page.tsx` | **1.177** | Kullanıcı profili | İstatistikler, rotalar ve rozetler tek dosyada |
| `apps/web/app/home-client.tsx` | **1.025** | Karşılama sayfası | Hero, küre animasyonu, arama ve vitrin kartları tek dosyada |
| `apps/web/app/lib/trip/use-travel-planner.ts` | **1.021** | Seyahat state hook | Aşırı fazla sorumluluk; gezi CRUD, OSRM, pin havuzu |
| `apps/web/app/ai/ai-promo-landing.tsx` | **744** | AI tanıtım | UI ve animasyon state'i |
| `apps/web/app/kayit/page.tsx` | **743** | Kayıt formu | Şifre gücü, Cognito çağrısı ve form state birleşik |
| `apps/web/app/u/admin/page.tsx` | **735** | Admin UI | FinOps grafikleri, tablo ve aksiyon butonları |
| `apps/web/app/components/header-nav.tsx` | **716** | Üst gezinme | Giriş durumu, bildirimler, tema ve dil seçimi |
| `infra/lambda/src/admin/index.ts` | **651** | Admin API | God Controller; metrikler, finans, kullanıcı askıya alma |
| `apps/web/app/giris/page.tsx` | **651** | Giriş formu | OAuth popup, form doğrulama ve yönlendirme |

---

## 3. Kod Kalitesi Problemleri (Detailed Code Smells)

### 3.1 Dairesel Bağımlılık ve Yanlış Bağımlılık Yönü (Dependency Inversion İhlali)
- **Problem:** `infra/lambda/src/ai/index.ts` dosyası:
  ```typescript
  export { handler } from '../../../../apps/web/server/ai-handler';
  ```
  `apps/web/server/ai-handler.ts` dosyası ise:
  ```typescript
  import { getVerifiedUser } from '../../../infra/lambda/src/shared/auth';
  import { BillingError, ... } from '../../../infra/lambda/src/billing/store';
  ```
  şeklinde backend ve frontend klasörlerini birbirine bağlamaktadır.
- **Etki:** Frontend projesi tek başına izole derlenememekte; Lambda esbuild derlemesi frontend klasörüne girmek zorunda kalmaktadır.

### 3.2 God Controller ve Sorumluluk Yığılması (Single Responsibility İhlali)
- **Problem:** `infra/lambda/src/routes/index.ts` ve `admin/index.ts` doğrudan HTTP transport katmanı olması gerekirken:
  - Token çözme ve doğrulama mantığı
  - DynamoDB `DynamoDBClient` oluşturma ve sorgulama
  - Bakım modu kontrolleri (`SYSTEM#CONFIG`)
  - OSRM dış servis çağrısı
  - JSON response biçimlendirmesi
  aynı dosya içinde yürütülmektedir.
- **Çözüm:** Use-Case (Application) ve Repository (Infrastructure) katmanları ayrılmalıdır.

### 3.3 İsimlendirme Tutarsızlığı (Mixed Naming Conventions)
- **Problem:**
  - Route yolları: `/giris`, `/kayit`, `/dogrula`, `/sifre-sifirla`, `/odeme`, `/mesajlar`, `/topluluk` (Türkçe).
  - API yolları: `/auth/reset-password`, `/routes`, `/chat/threads`, `/stripe/checkout` (İngilizce).
  - Bazı değişkenler ve methodlar Türkçe yorum satırları veya terimler içermektedir.
- **Çözüm:** Kaynak kod, methodlar, değişkenler, tipler ve DTO'lar %100 İngilizce standardına kavuşturulmalı; kullanıcıya gösterilen metinler localization üzerinden sunulmalıdır.

### 3.4 Magic Strings ve Magic Numbers
- **Problem:**
  - Kredi değerleri: `5` (rota), `1` (chat), `0` (clarify) sayılarda hardcoded geçmektedir.
  - TTL süreleri: `900`, `86400`, `1209600` sabit sayılarla ifade edilmektedir.
  - Rol tanımları: `"admin"`, `"moderator"`, `"support"` string literalleri ile kontrol edilmektedir.
- **Çözüm:** `packages/contracts` ve `Domain` katmanında `UserRole`, `BillingCost`, `TtlDuration` enum/constant tanımları kullanılmalıdır.

### 3.5 Anemic Domain Model
- **Problem:** DynamoDB kayıtları ve iş nesneleri sadece düz JavaScript nesnesi (POJO) olarak gezmektedir. Davranışlar (Behavior) nesnelerin içinde değil, dışarıdaki handler'larda dağınık `if-else` bloklarıyla kontrol edilmektedir.
- **Çözüm:** `Trip`, `Wallet`, `RouteStop` gibi iş varlıkları kendi doğrulama ve durum geçiş mantıklarını (invariants) içeren zengin domain modellerine dönüştürülmelidir.

---

## 4. Kalite Metrikleri ve Hedefler

| Kalite Metriği | Mevcut Durum | Refactoring Sonrası Hedef |
|---|---|---|
| **TypeScript Derleme Hatası** | **0** | **0** (Strict Mode korunacak) |
| **Birim ve Güvenlik Testleri** | **110/110 Geçen** | **110+ Geçen** (Sıfır kırılma) |
| **AI Diyalog Değerlendirmesi** | **12/12 Geçen** | **12/12 Geçen** |
| **En Uzun Dosya Satırı** | **3.346 satır** | **< 600 satır** (Bileşenlere bölünecek) |
| **Dairesel / Çapraz Bağımlılık** | **Var (`ai-handler` ⇄ `infra`)** | **0** (Katmanlar izole edilecek) |
| **İngilizce Kod Standardı** | **Kısmi (%70)** | **%100** (Kod, tipler, değişkenler) |
