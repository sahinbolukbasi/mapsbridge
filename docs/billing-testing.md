# MapsBridge Billing — Sandbox Test Senaryoları

> FAZ 1 kapsamı. Otomatik testler: `infra/lambda/tests/revenuecat.test.cjs` (17),
> `infra/lambda/tests/billing.test.cjs`, `infra/lambda/tests/promo.test.cjs`.
> Bu doküman ek olarak **elle sandbox** doğrulamalarını listeler.

## Otomatik test kapsamı (kabul kriterleri)

| Kabul kriteri                             | Test                                                             |
| ----------------------------------------- | ---------------------------------------------------------------- |
| Aynı webhook event'i 3x → DB'de tek kayıt | `revenuecat.test.cjs` "idempotency: aynı event 3 kez"            |
| Eski timestamp'li event state'i bozmaz    | `syncSubscription` eventTime koşulu + mevcut testler             |
| Yanlış secret → 401, log'da secret yok    | "rejects webhook with wrong auth secret" + "constant-time"       |
| iOS'ta satın alan web'de pro görür        | "hasEntitlement: pro/agency true…"                               |
| Reconcile webhook kaybını telafi eder     | "reconcile: needsReconcile işaretli kullanıcıyı RC'den doğrular" |

Çalıştır: `npm run test:backend` veya `node --test infra/lambda/tests/revenuecat.test.cjs`

## Elle sandbox senaryoları (RevenueCat + store sandbox)

### S1 — Satın alma (INITIAL_PURCHASE)

1. iOS sandbox hesabıyla `monthly` satın al.
2. RC webhook → `/revenuecat/webhook` → DynamoDB: `USER#{sub}/SUBSCRIPTION` tier=pro,
   `USER#{sub}/CREDITS` krediler eklendi.
3. `hasEntitlement(sub,'pro')` → true. Uygulamada pro erişimi açılır.

### S2 — Yenileme (RENEWAL)

1. Sandbox'ta aboneliğin yenilenmesini bekle (iOS sandbox hızlandırılmış).
2. Krediler tekrar eklenir (transaction_id farklı → idempotent değil, kasıtlı).
3. `currentPeriodEnd` ileri taşınır.

### S3 — İptal (CANCELLATION)

1. Sandbox'ta aboneliği iptal et.
2. **Erişim KESİLMEZ:** status `cancelled`, tier/pro `currentPeriodEnd`'e kadar sürer.
   `will_renew=false`.

### S4 — Süre dolumu (EXPIRATION)

1. `currentPeriodEnd` geçince RC EXPIRATION gönderir.
2. tier=free, `hasEntitlement` → false (expiry okuma anında da kontrol edilir).

### S5 — Geri yükleme (restore / cross-platform)

1. iOS'ta satın al → Android'de aynı `appUserID` ile login → pro görünür.
2. Web'de login → pro görünür (tek entitlement kaynağı DynamoDB).

### S6 — İdempotency (çift teslimat)

1. RC webhook'u elle 3x POST et (aynı `event.id`).
2. DB'de tek `BILLING#RC_EVENT#{id}` kaydı; kredi/abonelik bir kez işlenir. 2. ve 3. yanıt `200 {duplicate:true}`.

### S7 — Out-of-order

1. Eski `event_timestamp_ms` taşıyan bir event gönder.
2. `SUBSCRIPTION.eventTime` koşulu nedeniyle state değişmez.

### S8 — Yanlış secret

1. Yanlış/eksik Authorization ile POST → 401. CloudWatch log'da secret görünmez.

### S9 — Reconciliation

1. Webhook'u kasıtlı düşür (RC'de abone, DB'de değil).
2. Günlük reconcile Lambda çalışınca (ya da elle invoke) RC'den doğrular, DB düzelir,
   `MapsBridge/Billing DriftCorrected` metriği artar.

### S10 — TRANSFER

1. Sandbox'ta satın almayı başka hesaba taşı.
2. Etkilenen kullanıcılarda `needsReconcile=true`; sonraki reconcile gerçek durumu uygular.

## FAZ 2 (kapalı — BILLING_WEB_ENABLED=false)

- Paddle web checkout senaryoları buraya eklenecek. Flag kapalıyken Paddle kodu hiç
  çağrılmaz; yukarıdaki S1–S10 Faz 1'de tam çalışır.
