# Kodlama Standartları ve Mühendislik Kuralları

Bu belge, repodaki tüm kod geliştirme süreçlerinde uyulması zorunlu olan standartları listeler.

---

## 1. Dil ve Çatılar

1. **TypeScript:** Tüm kodlar (frontend ve backend) TypeScript ile yazılmalıdır. `any` türü mecbur kalmadıkça kullanılmamalı, `tsconfig.json` ayarlarındaki `strict` kurallarına tam uyulmalıdır.
2. **Next.js 16 & React 19:**
   - Statik SPA çıktısı (`output: "export"`) kuralı korunmalıdır. Sunucu tarafı render (SSR) özelliklerine bağımlı kod yazılamaz.
   - İstemci bileşenlerinde gerektiğinde `"use client"` direktifi kullanılmalıdır.
3. **CSS ve Tasarım:**
   - **Yalnızca Vanilla CSS** kullanılacaktır. TailwindCSS veya CSS-in-JS kütüphaneleri eklenemez.
   - Tasarımlar şık, modern, duyarlı (responsive) ve mobil öncelikli olmalıdır.
   - Renkler HSL ve CSS değişkenleri (`var(--...)`) ile merkezi olarak yönetilmelidir.
4. **Node.js 22 Runtime:** AWS Lambda fonksiyonları Node.js 22 ve esbuild ile paketlenecek şekilde yazılmalıdır.

---

## 2. Clean Code ve SOLID Prensipleri

1. **Tek Sorumluluk İlkesi (SRP):** Bir dosya veya sınıf tek bir işten sorumlu olmalıdır. Örneğin bir Lambda handler'ı hem HTTP yönlendirmesi, hem veritabanı sorgusu, hem de Stripe entegrasyonunu aynı fonksiyonda yapamaz.
2. **Bağımlılıkların Tersine Çevrilmesi (DIP):** Üst katmanlar alt katmanlara doğrudan bağımlı olmamalı; arayüzler (Interfaces) üzerinden haberleşmelidir.
3. **Erken Dönüş (Early Return):** İç içe geçmiş derin `if-else` blokları yerine koruma cümlecikleri (guard clauses) kullanılmalıdır.
4. **Hata Yönetimi (Error Handling):**
   - Hatalar sessizce yutulamaz (`catch {}` ile boş bırakılamaz).
   - Kullanıcıya asla ham veritabanı veya stack trace hatası gösterilmez; standartlaştırılmış `BillingError`, `AuthError` gibi alan hataları fırlatılır.

---

## 3. Güvenlik ve Veri Bütünlüğü Kuralları

1. **Giriş Doğrulama (Input Validation):** İstemciden gelen tüm veriler (koordinat, seyahat adı, istek kimliği) regex ve şema kontrollerinden geçirilmelidir.
2. **Doğrulanmış Kimlik:** `sub` (Kullanıcı kimliği) istemciden gelen body parametresinden değil, daima doğrulanmış JWT token'ından (`getVerifiedUser`) okunmalıdır.
3. **İdempotency:** Ödeme, kredi yükleme ve AI isteklerinde `requestId` veya `idempotency-key` zorunludur. Aynı istek iki kez çalıştırıldığında mükerrer harcama veya işlem yapılamaz.
4. **Gizli Bilgilerin Korunması:** Hiçbir `.env` dosyası, AWS secret'ı, Stripe gizli anahtarı veya JWT secret'ı kaynak koda yazılamaz.

---

## 4. Git ve Versiyon Kontrol Kuralları

1. **Commit Mesajları:** Conventional Commits standardı uygulanır:
   - `feat(trip): add stop reordering logic`
   - `fix(billing): prevent negative balance race condition`
   - `refactor(ai): extract supervisor prompt schema`
   - `docs(adr): document DynamoDB single table decision`
2. **Büyük Değişikliklerin Ayrılması:** Refactoring ile yeni özellik geliştirme aynı commit içinde karıştırılamaz.
