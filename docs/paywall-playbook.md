# Paywall Playbook (FAZ 2 — ONAY BEKLİYOR)

> Bu doküman **tasarım/öneridir**. Prompt gereği placement listesi ve tetikleme
> koşulları onaylanmadan kod yazılmaz. Mevcut `UpgradeModal` + `open_upgrade_modal`
> event altyapısının (apps/web/app/components/upgrade-modal.tsx) üstüne oturur.

## Ürün bağlamı (gerçek koda dayalı)

- Model: kredi + abonelik birlikte. Entitlement `pro` (pro+agency), kademeler korunur.
- Mevcut tetikleyici kodları: `ROUTE_LIMIT_REACHED`, `INSUFFICIENT_CREDITS`,
  `USER_DAILY_LIMIT`, `SERVICE_DAILY_LIMIT` (backend) + `openUpgradeModal()` (web).
- Her paket store/Paddle'dan localized fiyat; kodda hardcoded fiyat YOK.

## Paywall placement listesi (ÖNERİ — onayınızı istiyorum)

Her placement RevenueCat'e **ayrı `placement` adıyla** gider (dönüşüm ölçümü için).

| #   | Placement adı         | Tetikleme koşulu (mevcut koda bağlanma)                                | Tür  | Kapatılabilir?          |
| --- | --------------------- | ---------------------------------------------------------------------- | ---- | ----------------------- |
| P1  | `route_limit`         | Free tier 3 rota limiti doldu (`ROUTE_LIMIT_REACHED`, routes/index.ts) | Hard | Hayır (işlem bloke)     |
| P2  | `ai_credits_depleted` | AI işlemi için kredi yetersiz (`INSUFFICIENT_CREDITS` / 402)           | Hard | Hayır                   |
| P3  | `ai_daily_quota`      | Günlük AI mesaj kotası doldu (`USER_DAILY_LIMIT`)                      | Soft | Evet (yarın sıfırlanır) |
| P4  | `premium_feature`     | Premium özellik denendi: offline erişim, gelişmiş kişiselleştirme      | Hard | Hayır                   |
| P5  | `onboarding`          | Onboarding sonunda bir kez, soft paywall                               | Soft | Evet                    |

**Sorularım (kesinleştirmeden önce):**

1. P4 "premium özellik" — hangi özellikler pro'ya kilitlenecek? (offline harita cache,
   gelişmiş AI kişiselleştirme, sınırsız rota?) Mevcutta bu kilit yok; eklenecek mi?
2. P5 onboarding paywall'ı — mobilde mi, web'de mi, ikisinde mi?
3. P3 soft paywall "yarın sıfırlanır" mesajı mı, yoksa hemen yükselt CTA mı?

## Paywall yüzeyleri (tasarım)

**Mobil (Expo RN):** RevenueCat Paywalls (remote-configured) — uygulamaya hardcode YOK.
`Offerings`'ten `monthly`/`annual`, yıllık tasarruf **hesaplanarak** gösterilir.
Fiyat = `product.localizedPriceString`. Zorunlu: trial + sonrası ücret, Restore,
Gizlilik/Koşullar linkleri, kapatma (X). Satın alma sonrası
`customerInfo.entitlements.active['pro']` + backend `hasEntitlement` doğrulaması.

**Web (Next.js):** Paddle embedded via RevenueCat Web SDK (`purchases-js`), yeni sekme YOK.
Mobil ile aynı paket/kopya; web fiyatı ayrı konfigüre edilebilir. Satın alma sonrası
`POST /billing/sync` ile optimistic tazeleme (webhook geldiğinde reconcile edilir).
**FAZ 2 kapsamında `BILLING_WEB_ENABLED` flag arkasında kapalı başlar.**

## A/B test edilecek değişkenler (öneri)

- Annual vs monthly default vurgusu
- Trial süresi gösterimi (7 gün vurgusu)
- P5 onboarding paywall'ın gösterilip gösterilmemesi
- CTA metni ("Pro'ya geç" vs "Sınırsız planla")

---

# Attribution — Sequence Diyagramı (FAZ 2 — ONAY BEKLİYOR)

> Prompt: "attribution akışının sequence diyagramını çıkar, onaylanmadan kod yazma."
> conversion-forwarder Lambda + SNS + DLQ; dedup `event.id` ile.

## Akış 1 — Landing'de parametre yakalama

```
Kullanıcı (reklam tıklaması: gclid/gbraid/wbraid/fbclid/utm_*)
        │
        ▼
mapsbridge.com landing  ──►  first-party cookie'ye yaz
        │                    + (login varsa) kullanıcı kaydına yaz (DynamoDB)
        ▼
Kayıt/login anında attribution verisi kullanıcıya bağlanır (userId ↔ gclid/utm)
```

## Akış 2 — Satın alma → conversion fan-out (dedup'lı)

```
Satın alma (iOS/Android/web)
        │
        ▼
RevenueCat ──webhook──► /revenuecat/webhook (Lambda)
        │                       │
        │                       ├─ INITIAL_PURCHASE / RENEWAL ise:
        │                       │     SNS topic "billing-conversions" publish
        │                       │     (payload: event.id, userId, store, product, değer)
        ▼                       ▼
   (entitlement yaz)     conversion-forwarder Lambda (SNS subscriber)
                                │   fan-out, her hedef AYRI retry + DLQ:
                                ├─► Google Ads API (offline click conv, gclid eşleşme)
                                ├─► Meta Conversions API (server-side)
                                └─► GA4 Measurement Protocol
                                │
                                └─ Dedup: her conversion'a event_id = RC event.id
                                   (tarayıcı pixel'i de aynı event.id → çift sayılmaz)
        │
        ▼
Bir hedef 500 dönerse → o mesaj o hedefin DLQ'suna; diğer hedefler etkilenmez
```

## Attribution SDK (mobil — tasarım)

- `enableAdServicesAttributionTokenCollection()` (Apple Search Ads)
- `setFirebaseAppInstanceID(...)` (GA4 eşleşme)
- `setAttributes({ utm_source, utm_medium, utm_campaign, gclid })`
- ATT prompt: onboarding'de **değer gösterildikten sonra** (ilk açılışta değil).
  Reddedilirse akış bozulmaz; Apple Search Ads attribution yine toplanır.

## Dedup kuralı (kritik kabul kriteri)

- Tek `event.id` (RevenueCat) hem server-side (forwarder) hem tarayıcı pixel'inde
  conversion `event_id` olarak kullanılır → aynı satın alma çift sayılmaz.

---

## Onay gereken noktalar (bunlar olmadan koda başlanmaz)

1. Placement listesi (P1–P5) ve özellikle P4 premium özellik seti, P5 onboarding kapsamı
2. Attribution sequence akışı (SNS fan-out + DLQ + dedup) doğru mu
3. `STEERING_ENABLED=false` (app→web yönlendirme kapalı) ve `BILLING_WEB_ENABLED=false`
   (Paddle kapalı) başlangıç varsayılanları onaylı mı

```

```
