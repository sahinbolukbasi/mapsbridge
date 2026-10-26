---
inclusion: always
---

# Kritik Alanlar — "Dokunursan Patlar"

Aşağıdaki kod yollarına dokunan her değişiklik yüksek risklidir. Bu alanlarda: önce ilgili kodu tam oku, değişikliği açıkla, ve mümkünse Spec session ile ilerle. Değişiklikten sonra ilgili testleri mutlaka çalıştır.

## 1. Kredi atomikliği — `infra/lambda/src/billing/store.ts` (`reserveAI()`)

DynamoDB `TransactWriteItems` ile kredi rezervasyonu. Tüm ödeme ve AI kullanım akışının kalbi. `ConditionExpression` koşulları veya hata yönetimi bozulursa: çift harcama (double-spend), negatif kredi, veya ücretsiz sınırsız AI kullanımı oluşur.

**Kural**: DynamoDB transaction semantiğini ve mevcut `ConditionExpression` koşullarını tam anlamadan dokunma. Krediler yalnızca sunucuda düşülür — istemciye kredi düşme mantığı ekleme.

## 2. Auth + hesap birleştirme — `infra/lambda/src/shared/auth.ts` (satır ~94-181)

E-posta/şifre, Google OAuth ve Apple Sign-In'in birleştiği tek nokta (`getVerifiedUser()`). Yanlış değişiklik: aynı e-postanın farklı hesaplara bölünmesi, JWKS cache/refresh bozulursa tüm OAuth girişlerinin çökmesi, account linking veri tutarsızlığı.

**Kural**: Her değişiklikte e-posta+şifre, Google ve Apple ile uçtan uca giriş senaryolarını test et. `npm run test:backend` çalıştır.

## 3. Stripe webhook — `infra/lambda/src/stripe/index.ts` (satır ~187)

`constructEvent()` ile imza doğrulama + idempotency. Bozulursa: çift abonelik yazımı veya ödeme yapıldığı halde erişim verilmemesi.

**Kural**: `STRIPE_WEBHOOK_SECRET` production'da asla değiştirilmez. İmza doğrulaması olmadan asla kredi/abonelik yazma. İdempotency kaydını (`BILLING#CHECKOUT#{id}/RECEIPT`) koru.

## 4. Auth middleware zinciri — `infra/lambda/src/routes/index.ts` (satır ~52-85)

Handler'ın başında auth → tier kontrolü → kota doğrulaması sırayla çalışır. Sıra değişir veya adım atlanırsa: yetkisiz erişim, free tier'ın paid özelliklere ulaşması, kota bypass.

**Kural**: Middleware sıralamasını değiştirme. Yeni kontrol zincirin sonuna eklenir ve her tier için test yazılır.

## 5. DynamoDB GSI1 eksikliği — `infra/lambda/src/chat/index.ts` (satır ~75-87)

`GET /chat/threads` GSI1 üzerinden sorgu yapıyor ama index Terraform tanımında yok — endpoint kırık olabilir.

**Kural**: GSI eklemeden önce: (1) tablonun mevcut item sayısını kontrol et, (2) staging'de uygula, (3) backfill tamamlanana kadar chat endpoint'ini canlıya alma. `BillingMode` PAY_PER_REQUEST değilse provisioning dikkat ister.

## Genel Güvenlik Kuralları

- Secret'ları (API token, webhook secret, private key) asla kod/Terraform/commit içine düz metin yazma.
- Konum ve kişisel veri (KVKK/GDPR): onay kontrolü ve maskeleme kurallarına uy.
- `localStorage`'daki token'lar XSS'e açık — istemci tarafında yeni token saklama deseni eklerken dikkat.
- Yıkıcı DynamoDB/altyapı operasyonlarını (tablo silme/yeniden oluşturma, production apply) kullanıcı onayı olmadan yapma.
