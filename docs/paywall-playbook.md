# Paywall Playbook (FAZ 2 — ONAYLANDI 2026-11-03)

> Kararlar sabitlendi; implementasyon bu dokümana göre yapılır. Mevcut
> `UpgradeModal` + `open_upgrade_modal` event altyapısının
> (apps/web/app/components/upgrade-modal.tsx) ve mobil `PaywallModal.tsx` +
> `services/revenuecat.ts`'in üstüne oturur.

## Ürün bağlamı (gerçek koda dayalı)

- Model: kredi + abonelik birlikte. Entitlement `pro` (pro+agency), kademeler korunur.
- Mevcut tetikleyici kodları: `ROUTE_LIMIT_REACHED`, `INSUFFICIENT_CREDITS`,
  `USER_DAILY_LIMIT`, `SERVICE_DAILY_LIMIT` (backend) + `openUpgradeModal()` (web).
- Her paket store/Paddle'dan localized fiyat; kodda hardcoded fiyat YOK.

## Paywall placement listesi (ONAYLANDI)

Her placement RevenueCat'e **ayrı `placement` adıyla** gider (dönüşüm ölçümü için).

| #   | Placement adı         | Tetikleme koşulu (mevcut koda bağlanma)                                | Tür  | Kapatılabilir?          |
| --- | --------------------- | ---------------------------------------------------------------------- | ---- | ----------------------- |
| P1  | `route_limit`         | Free tier 3 rota limiti doldu (`ROUTE_LIMIT_REACHED`, routes/index.ts) | Hard | Hayır (işlem bloke)     |
| P2  | `ai_credits_depleted` | AI işlemi için kredi yetersiz (`INSUFFICIENT_CREDITS` / 402)           | Hard | Hayır                   |
| P3  | `ai_daily_quota`      | Günlük AI mesaj kotası doldu (`USER_DAILY_LIMIT`)                      | Soft | Evet (yarın sıfırlanır) |
| P4  | `premium_feature`     | Premium özellik denendi: offline harita cache, sınırsız rota           | Hard | Hayır                   |
| P5  | `onboarding`          | Onboarding sonunda bir kez (SADECE MOBİL)                              | Soft | Evet                    |

## KARARLAR (2026-11-03, sabitlendi)

1. **P4 premium özellik seti:** Pro'ya kilitlenen = **offline harita cache** (spec I12
   offline erişim Pro değeri) + **sınırsız rota** (free 3 rota limitinin üstü).
   **Gelişmiş AI kişiselleştirme HARİÇ** — ayrı/riskli iş, bu fazda yok.
2. **P5 onboarding paywall:** SADECE **mobil** (web'de onboarding akışı yok).
3. **P3 günlük kota:** Soft — "yarın sıfırlanır" mesajı + "Pro'ya geç" CTA **birlikte**
   gösterilir. İşlem bloke edilmez.
4. **Başlangıç flag'leri:** `BILLING_WEB_ENABLED=false` (Paddle web satın alma kapalı),
   `STEERING_ENABLED=false` (app→web yönlendirme kapalı). Güvenli başlangıç; UI kodu
   flag arkasında merge edilir, açılış ayrı karar.

## Paywall yüzeyleri (tasarım)

**Mobil (Expo RN):** RevenueCat Paywalls (remote-configured) — uygulamaya hardcode YOK.
`Offerings`'ten `monthly`/`annual`, yıllık tasarruf **hesaplanarak** gösterilir.
Fiyat = `product.localizedPriceString`. Zorunlu: trial + sonrası ücret, Restore,
Gizlilik/Koşullar linkleri, kapatma (X). Satın alma sonrası
`customerInfo.entitlements.active['pro']` + backend `hasEntitlement` doğrulaması.

**Web (Next.js):** Paddle embedded via RevenueCat Web SDK (`purchases-js`), yeni sekme YOK.
Mobil ile aynı paket/kopya; web fiyatı ayrı konfigüre edilebilir. Satın alma sonrası
`POST /billing/sync` ile optimistic tazeleme (webhook geldiğinde reconcile edilir).
**`BILLING_WEB_ENABLED` flag arkasında kapalı başlar.**

## A/B test edilecek değişkenler (öneri)

- Annual vs monthly default vurgusu
- Trial süresi gösterimi (7 gün vurgusu)
- P5 onboarding paywall'ın gösterilip gösterilmemesi
- CTA metni ("Pro'ya geç" vs "Sınırsız planla")

---

# Attribution — Sequence Diyagramı (ONAYLANDI 2026-11-03)

> conversion-forwarder Lambda + SNS + DLQ; dedup `event.id` ile. Backend altyapısı
> canlıda; bu faz forwarder'a gerçek hedef entegrasyonlarını (Google/Meta/GA4) ekler.

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
```

## Dedup kuralı (kritik kabul kriteri)

- Tek `event.id` (RevenueCat) hem server-side (forwarder) hem tarayıcı pixel'inde
  conversion `event_id` olarak kullanılır → aynı satın alma çift sayılmaz.
