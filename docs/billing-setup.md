# MapsBridge Abonelik / Billing Kurulumu (RevenueCat)

> Durum: FAZ 1 devam ediyor. Bu doküman, dashboard'larda **elle** yapılacak adımları
> sırayla listeler. Kod tarafı `infra/lambda/src/revenuecat/` + `infra/lambda/src/billing/`.

## Mimari özet

- **Model:** Kredi + abonelik birlikte. Abonelik (`pro`/kademe) satın alımı hem tier
  hem kredi verir (`billing/catalog.ts`). Kredi modeli korunur.
- **Tek entitlement kaynağı:** Yetki kararları YALNIZCA kendi DynamoDB kaydımızdan
  (`USER#{id}/SUBSCRIPTION` + `USER#{id}/CREDITS`) okunur. İstemciden gelen
  entitlement bilgisine asla güvenilmez.
- **Kanallar:** iOS (StoreKit), Android (Play Billing) → RevenueCat.
  Web (Paddle) → Faz 2, `BILLING_WEB_ENABLED` flag arkasında.
- **Pipeline:** RevenueCat webhook → API Gateway → Lambda (`revenuecat/index.ts`)
  → DynamoDB. Idempotency (`event.id`), out-of-order koruması (`eventTime`),
  constant-time secret.

## Kimlik eşlemesi (uygulama tarafı)

- RevenueCat `appUserID` = bizim stabil Cognito `sub`'umuz. Anonim ID + alias YOK.
- Auth sonrası `Purchases.logIn(cognitoSub)`, logout'ta `Purchases.logOut()`.
- **RevenueCat dashboard → Project settings → "Transfer purchases on new app user ID"
  = `KEEP_WITH_ORIGINAL`.** Neden: bir satın alma yanlışlıkla ikinci bir hesaba
  taşınmasın; aynı mağaza hesabı farklı kullanıcıya geçtiğinde orijinal sahipte kalır,
  entitlement çakışması ve çift hak tanımlanması önlenir.

## Elle kurulum adımları (sırayla)

### 1. App Store Connect (iOS)

- [ ] Uygulama + bundle id kaydı
- [ ] Abonelik grubu oluştur; `monthly` ve `annual` (annual'da 7 gün trial) ürünleri
- [ ] App-Specific Shared Secret üret → RevenueCat'e gir
- [ ] Sandbox test kullanıcısı oluştur

### 2. Google Play Console (Android)

- [ ] Uygulama + package kaydı
- [ ] `monthly` / `annual` abonelik ürünleri (annual 7 gün trial)
- [ ] Service account + Play Developer API erişimi → RevenueCat'e JSON key
- [ ] Lisans test hesabı

### 3. RevenueCat dashboard

- [ ] Project oluştur, iOS + Android app'lerini bağla
- [ ] Entitlement: `pro`
- [ ] Offering: `default` → packages `monthly`, `annual`; store ürünlerine map et
- [ ] Transfer behavior = `KEEP_WITH_ORIGINAL` (yukarı bkz.)
- [ ] Webhook: URL = API Gateway `/revenuecat/webhook`, Authorization header =
      shared secret (Secrets Manager'daki `RC_WEBHOOK_AUTH_SECRET` ile aynı)
- [ ] REST API v2 key (reconciliation job için, salt-okuma)

### 4. AWS (kod + altyapı)

- [ ] `RC_WEBHOOK_AUTH_SECRET` → Secrets Manager'a elle set (Terraform placeholder)
- [ ] Webhook Lambda deploy (`revenuecat/index.ts`)
- [ ] (FAZ 2) Reconciliation Lambda + EventBridge günlük schedule
- [ ] CloudWatch alarmları: webhook 5xx, Lambda error

### 5. Paddle (FAZ 2 — şimdilik kapalı)

- [ ] `BILLING_WEB_ENABLED=false` iken Paddle kodu hiç çağrılmaz
- [ ] Paddle config olmadan sistem Faz 1'de tam çalışır

## Webhook garantileri (kod — FAZ 1)

- **Secret:** `timingSafeEqual` ile constant-time; uzunluk farkında erken ret. Log'da
  secret görünmez.
- **Idempotency:** `BILLING#RC_EVENT#{event.id}` conditional put. Aynı event 3x gelse
  kredi/abonelik bir kez işlenir; tekrar → `200 {duplicate:true}`.
- **Out-of-order:** `SUBSCRIPTION.eventTime < yeniEvent` koşulu; eski timestamp state'i
  bozmaz.
- **CANCELLATION:** erişimi kesmez; status `cancelled`, `currentPeriodEnd`'e kadar tier
  korunur.
- **Bilinmeyen event:** 200 döner (RC retry'a girmez).
- **İşlenen eventler:** INITIAL_PURCHASE, RENEWAL, CANCELLATION, UNCANCELLATION,
  EXPIRATION, BILLING_ISSUE, PRODUCT_CHANGE, REFUND. (TRANSFER → FAZ 1 kalan iş.)

## Test

Bkz. `docs/billing-testing.md` (FAZ 1 ilerledikçe doldurulur) ve
`infra/lambda/tests/revenuecat.test.cjs` (14 test: idempotency, constant-time, event tipleri).
