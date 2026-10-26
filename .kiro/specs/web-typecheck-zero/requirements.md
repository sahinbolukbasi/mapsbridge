# Requirements Document

## Introduction

`apps/web` tarafında `npm run typecheck` şu an **93 TypeScript hatası** veriyor ve bu nedenle `npm run build` ("Failed to type check") başarısız oluyor — yani web uygulaması şu an deploy edilebilir durumda değil. Bu hatalar `strict` TypeScript altında `unknown`/`{}`/union tiplerinin düzgün daraltılmamasından kaynaklanıyor ve `core-architecture-hardening` spec'inden önce de mevcuttu (orada admin paneli 94 hata düzeltildi, geri kalan 93 bu spec'in konusu).

Amaç: davranışı değiştirmeden tüm web typecheck hatalarını sıfıra indirmek ve `npm run build`'in tekrar geçmesini sağlamak. Hiçbir runtime mantığı değişmeyecek; yalnızca tip anotasyonları, tip daraltma (type narrowing), global tip bildirimleri ve gerekli yerlerde belgeli tip dönüşümleri eklenecek.

**Kapsam dışı:** Yeni özellik; runtime davranış değişikliği; backend (`infra/lambda`) — orası ayrı test suite'iyle zaten temiz; `strict` modun gevşetilmesi (`any`'ye toptan kaçış veya `ignoreBuildErrors` açmak yasak).

## Glossary

- **Type narrowing:** Bir `unknown`/union değerini, kontrol (typeof, in, Array.isArray) veya type guard ile daha dar bir tipe indirgemek.
- **Global type declaration:** `declare global` veya `.d.ts` ile tarayıcı/3. taraf global'lerinin (ör. `SpeechRecognition`, `window.google`) tiplenmesi.
- **Belgeli tip dönüşümü:** Kaçınılmaz olduğunda, neden güvenli olduğu yorumla açıklanan `as` cast'i (tercihen `unknown` üzerinden).
- **TripProfile / TripContext:** `app/lib/ai/planning.ts` içinde AI planlama akışının domain tipleri.

## Requirements

### Requirement 1: AI Planlama Tiplerinin Daraltılması

**User Story:** Bir geliştirici olarak, AI planlama modülünün (`planning.ts`, `supervisor.ts`, `route-edit.ts`, `bedrock-client.ts`) tip-güvenli olmasını istiyorum; böylece AI akışında tip hatası kalmaz.

#### Acceptance Criteria

1. WHEN `app/lib/ai/planning.ts` derlendiğinde THEN `unknown`/`object` değerler üzerindeki alan erişimleri (duration_days, days, food, pace, dates, party, budget vb.) uygun type guard veya tip anotasyonuyla daraltılmalı AND 0 hata vermelidir.
2. WHEN `app/lib/ai/supervisor.ts` derlendiğinde THEN `AnswerData` union'ı ve `output.data` null kontrolü doğru daraltılmalı AND 0 hata vermelidir.
3. WHEN `app/lib/ai/route-edit.ts` ve `app/lib/ai/bedrock-client.ts` derlendiğinde THEN 0 hata vermelidir.
4. WHILE bu düzeltmeler yapılırken hiçbir AI runtime davranışı (prompt üretimi, route dönüşümü, tool çağrısı) değişmemelidir.

### Requirement 2: Google Kimlik Doğrulama Global Tipleri

**User Story:** Bir geliştirici olarak, Google Identity Services global tiplerinin (`window.google`) tutarlı tanımlanmasını istiyorum; böylece login/register/auth bileşenlerinde çakışan bildirim hatası olmaz.

#### Acceptance Criteria

1. WHEN `window.google` tipi birden fazla dosyada bildirildiğinde THEN tek bir paylaşılan global bildirim kullanılmalı AND "Subsequent property declarations must have the same type" hatası ortadan kalkmalıdır.
2. WHEN `google-auth-button.tsx`, `google-one-tap.tsx`, `login/page.tsx`, `register/page.tsx` derlendiğinde THEN `renderButton`, `oauth2` gibi erişimler tiplenmiş olmalı AND 0 hata vermelidir.
3. WHILE global tip birleştirilirken runtime Google OAuth akışı değişmemelidir.

### Requirement 3: Tarayıcı Global Tipleri (SpeechRecognition)

**User Story:** Bir geliştirici olarak, `app/ai/page.tsx` içindeki sesli giriş (SpeechRecognition) API'sinin tiplenmesini istiyorum.

#### Acceptance Criteria

1. WHEN `app/ai/page.tsx` derlendiğinde THEN `SpeechRecognition` ve `SpeechRecognitionEvent` global tipleri tanımlı olmalı AND bu dosyadaki ilgili hatalar sıfırlanmalıdır.
2. IF tip çakışması `Trip` dönüşümünde oluşuyorsa THEN güvenli, belgeli bir daraltma/dönüşüm uygulanmalıdır.

### Requirement 4: Leaflet Harita Tipleri

**User Story:** Bir geliştirici olarak, Leaflet kullanan sayfaların (`desk/page.tsx`, `k/page.tsx`) harita API tiplerinin doğru olmasını istiyorum.

#### Acceptance Criteria

1. WHEN `desk/page.tsx` ve `k/page.tsx` derlendiğinde THEN `setView`, `addTo`, LatLng tuple tipleri doğru tiplenmeli AND 0 hata vermelidir.
2. WHEN koordinat dizileri kullanıldığında THEN `number[][]` yerine `[number, number][]` beklenen yerlerde uygun tip/daraltma sağlanmalıdır.

### Requirement 5: Kalan Dosyaların Daraltılması

**User Story:** Bir geliştirici olarak, geri kalan dosyalardaki (`profile/page.tsx`, `community/page.tsx`, `analytics/tracker.ts`, `google-place-info.tsx`, `use-travel-planner.ts`) tip hatalarının giderilmesini istiyorum.

#### Acceptance Criteria

1. WHEN bu dosyalar derlendiğinde THEN `unknown`/`{}` erişimleri uygun şekilde tiplenmeli AND 0 hata vermelidir.
2. WHILE düzeltmeler yapılırken ilgili runtime davranışı korunmalıdır.

### Requirement 6: Build ve Test Bütünlüğü

**User Story:** Bir ürün sahibi olarak, tüm düzeltmelerden sonra web'in hatasız derlenmesini ve testlerin geçmesini istiyorum; böylece web tekrar deploy edilebilir olur.

#### Acceptance Criteria

1. WHEN `npm run typecheck` çalıştırıldığında THEN 0 hata vermelidir.
2. WHEN `npm run build` çalıştırıldığında THEN "Failed to type check" olmadan, statik export başarıyla tamamlanmalıdır.
3. WHEN `npm run test:web` çalıştırıldığında THEN tüm testler 0 başarısızlıkla geçmelidir.
4. WHEN `npm run lint` çalıştırıldığında THEN eklenen kod 0 yeni hata üretmelidir (zorunlu `any` kullanımları `eslint-disable` ile gerekçelendirilmelidir).
