---
inclusion: always
---

# Kritik Alanlar — "Dokunursan Patlar"

Aşağıdaki kod yollarına dokunan her değişiklik yüksek risklidir. Bu alanlarda: önce ilgili kodu tam oku, değişikliği açıkla, ve mümkünse Spec session ile ilerle. Değişiklikten sonra **o danger-zone'un referanslı test dosyasını** mutlaka çalıştır.

> Doğrulama (2026-10-28): bu dosya diske karşı doğrulandı. Her danger-zone'a onu koruyan test dosyası eklendi — ajan dokununca hangi testi koşacağını bilsin. Drift-guard (PLAN FAZ1/adım 2) bu dosyadaki her path + test referansının gerçekten var olduğunu CI'da kontrol eder.

## 1. Kredi atomikliği — `infra/lambda/src/billing/store.ts` (`reserveAI()`)

DynamoDB `TransactWriteItems` ile kredi rezervasyonu. Tüm ödeme ve AI kullanım akışının kalbi. `ConditionExpression` koşulları veya hata yönetimi bozulursa: çift harcama (double-spend), negatif kredi, veya ücretsiz sınırsız AI kullanımı oluşur.

**Kural**: DynamoDB transaction semantiğini ve mevcut `ConditionExpression` koşullarını tam anlamadan dokunma. Krediler yalnızca sunucuda düşülür — istemciye kredi düşme mantığı ekleme.
**Koruyan test**: `infra/lambda/tests/billing.test.cjs` (derin: concurrency tek-rezervasyon, double-spend retry, atomik refund, global limit, DB outage). Dokununca `npm run test:backend` + bu dosyayı çalıştır.

## 2. Auth + hesap birleştirme — `infra/lambda/src/shared/auth.ts` (satır ~94-181)

E-posta/şifre, Google OAuth ve Apple Sign-In'in birleştiği tek nokta (`getVerifiedUser()`). Yanlış değişiklik: aynı e-postanın farklı hesaplara bölünmesi, JWKS cache/refresh bozulursa tüm OAuth girişlerinin çökmesi, account linking veri tutarsızlığı.

**Kural**: Her değişiklikte e-posta+şifre, Google ve Apple ile uçtan uca giriş senaryolarını test et.
**Koruyan test**: `infra/lambda/tests/auth.test.cjs`. `npm run test:backend` çalıştır.

## 3. Stripe webhook — `infra/lambda/src/stripe/index.ts` (satır ~187)

`constructEvent()` ile imza doğrulama + idempotency. Bozulursa: çift abonelik yazımı veya ödeme yapıldığı halde erişim verilmemesi.

**Kural**: `STRIPE_WEBHOOK_SECRET` production'da asla değiştirilmez. İmza doğrulaması olmadan asla kredi/abonelik yazma. İdempotency kaydını (`BILLING#CHECKOUT#{id}/RECEIPT`) koru.
**Koruyan test**: `infra/lambda/tests/stripe-webhook.test.cjs` (forged/modified/stale imza reddi, unpaid checkout kredi vermez).

## 4. Auth middleware zinciri — `infra/lambda/src/routes/index.ts` (satır ~52-85)

Handler'ın başında auth → tier kontrolü → kota doğrulaması sırayla çalışır. Sıra değişir veya adım atlanırsa: yetkisiz erişim, free tier'ın paid özelliklere ulaşması, kota bypass.

**Kural**: Middleware sıralamasını değiştirme. Yeni kontrol zincirin sonuna eklenir ve her tier için test yazılır.
**Koruyan test**: `infra/lambda/tests/routes.test.cjs` (write-auth akışı) + `infra/lambda/tests/admin.test.cjs` (RBAC, 1171 satır).

## 5. Chat GSI1 — `infra/lambda/src/chat/index.ts` (GSI1PK/GSI1SK)

`GET /chat/threads` GSI1 üzerinden sorgu yapar. **DÜZELTME (2026-10-28): GSI1 Terraform'da TANIMLIDIR** (`infra/terraform/hosting.tf:289-291`, hash_key `GSI1PK` / range_key `GSI1SK`) ve chat kodu bu anahtarları yazar. Endpoint **çalışıyor** — eski "index yok, endpoint kırık olabilir" uyarısı geçersizdi.

**Kural**: GSI1 çalışır durumda; yine de GSI tanımını (projection, anahtar) değiştirirken dikkat: (1) değişiklik öncesi mevcut item sayısını kontrol et, (2) staging'de uygula, (3) anahtar şeması değişirse backfill gerekebilir. `BillingMode` PAY_PER_REQUEST.
**Koruyan test**: `infra/lambda/tests/chat.test.cjs`.

## Genel Güvenlik Kuralları

- Secret'ları (API token, webhook secret, private key) asla kod/Terraform/commit içine düz metin yazma.
- Konum ve kişisel veri (KVKK/GDPR): onay kontrolü ve maskeleme kurallarına uy.
- `localStorage`'daki token'lar XSS'e açık — istemci tarafında yeni token saklama deseni eklerken dikkat.
- Yıkıcı DynamoDB/altyapı operasyonlarını (tablo silme/yeniden oluşturma, production apply) kullanıcı onayı olmadan yapma.
