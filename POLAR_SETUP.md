# Polar (polar.sh) Ödeme ve Abonelik Kurulum Kılavuzu

MapsBridge projesinde önceki ödeme yöntemleri (RevenueCat ve Stripe) kaldırılarak yerine doğrudan **Polar (`polar.sh`)** entegrasyonu tamamlanmıştır.

Tüm mimari (Next.js App Router, Lambda backend, DynamoDB cüzdan/kredi sistemi ve Mobil Paywall) Polar Hosted Checkout ve Webhook standartlarına uygun şekilde hazırlandı.

---

## 1. Gerekli Ortam Değişkenleri (Environment Variables)

Polar dashboard'dan (`https://polar.sh` veya test için `https://sandbox.polar.sh`) key'lerinizi aldığınızda aşağıdaki değişkenleri tanımlamanız yeterlidir:

### API ve Güvenlik (AWS Secrets Manager & Environment)
```bash
# Polar API Access Token (AWS Secrets Manager: mapsbridge/polar veya env)
POLAR_ACCESS_TOKEN=polar_oat_...

# Polar Webhook Secret
POLAR_WEBHOOK_SECRET=whsec_...

# Ortam seçimi ("sandbox" veya "production")
POLAR_ENVIRONMENT=production
POLAR_ORGANIZATION_ID=d0269f4e-2292-44d5-bbd8-f9b5afcf4f2f
```

### Canlı Ürün Kimlikleri (Polar Üzerinde Oluşturulan Paketler)
```bash
# Abonelikler (Monthly Subscriptions)
POLAR_PRODUCT_EXPLORER=a3443dcc-7050-4705-82c3-f986b0ef94ea   # Kaşif ($6.99 / 199 TL)
POLAR_PRODUCT_PRO=bc53edf5-476c-4f5f-805a-3b2c1e8e8739        # Pro Kaşif ($14.99 / 499 TL)
POLAR_PRODUCT_AGENCY=62d9b9e3-9ddb-49db-b1d6-67d50f76c2b6     # Tur Lideri ($49.99 / 1499 TL)

# Kredi Paketleri (One-Time Credit Packs)
POLAR_PRODUCT_PACK_30=cd802b74-05b9-4234-b08b-21a1152ec8d6    # 30 Kredi ($2.99 / 99 TL)
POLAR_PRODUCT_PACK_100=31f3e0d0-8d81-4a3b-83f1-56bcbb5cde40   # 100 Kredi ($7.99 / 249 TL)
POLAR_PRODUCT_PACK_300=86fadb96-c068-4b69-b23a-0ed871d57718   # 300 Kredi ($18.99 / 599 TL)
POLAR_PRODUCT_PACK_PRO=adcadbdf-662d-4e3b-b53e-d3ae586225e8   # 3000 Kredi ($59.99 / 1899 TL)
```

---

## 2. Polar CLI & Otomasyon Komutları

Geliştirdiğimiz otomasyon aracı ile paketleri yönetmek için tek komut yeterlidir:

```bash
# Polar'daki tüm ürünleri listeler:
npm run polar:list

# Paketleri oluşturur ve .env dosyalarını otomatik günceller:
npm run polar:sync
```

---

## 3. AWS Secrets Manager'a Yükleme

AWS SSO oturumunuzu açtıktan sonra (`aws sso login`) aşağıdaki komutla tüm anahtarları tek seferde AWS Secrets Manager'a yükleyebilirsiniz:

```bash
aws secretsmanager create-secret \
  --name "mapsbridge/polar" \
  --description "Polar payment credentials and product IDs" \
  --secret-string file://infra/secrets/polar.json \
  --region eu-central-1
```

Mevcut bir secret'ı güncellemek için:
```bash
aws secretsmanager put-secret-value \
  --secret-id "mapsbridge/polar" \
  --secret-string file://infra/secrets/polar.json \
  --region eu-central-1
```

---

## 2. Polar Dashboard Kurulum Adımları

1. **Hesap Açma ve Organizasyon:**
   - [polar.sh](https://polar.sh) veya [sandbox.polar.sh](https://sandbox.polar.sh) adresine gidin.
   - Organizasyonunuzu oluşturun.

2. **Ürünleri Tanımlama:**
   - **Products** sekmesine gelin.
   - **Abonelikler:**
     - *Kaşif (Explorer)*: Recurring / Monthly, Fiyat: 199 TL (veya döviz)
     - *Pro Kaşif (Pro)*: Recurring / Monthly, Fiyat: 499 TL
     - *Tur Lideri (Agency)*: Recurring / Monthly, Fiyat: 1499 TL
   - **Kredi Paketleri:**
     - *Başlangıç Paketi (30 Kredi)*: One-time, Fiyat: 99 TL
     - *Gezgin Paketi (100 Kredi)*: One-time, Fiyat: 249 TL
     - *Usta Kaşif (300 Kredi)*: One-time, Fiyat: 599 TL
     - *Stratejik Kaşif (3000 Kredi)*: One-time, Fiyat: 1899 TL

3. **Webhook Uç Noktasını Ekleme:**
   - **Settings -> Developers -> Webhooks** bölümüne gidin.
   - **Add Endpoint** butonuna tıklayın:
     - **URL:** `https://<siteniz>/polar/webhook` (veya `https://<siteniz>/api/webhook/polar`)
     - **Format:** Standard Webhooks
     - **Abone olunacak olaylar (Events):**
       - `order.created`
       - `order.paid`
       - `subscription.created`
       - `subscription.active`
       - `subscription.updated`
       - `subscription.canceled`
       - `subscription.revoked`
   - Oluşturulan **Signing Secret** değerini kopyalayıp `POLAR_WEBHOOK_SECRET` değişkenine verin.

---

## 3. Sistem Mimarisi ve Akış

- **Web Checkout (`/checkout`):**
  - Kullanıcı bir paket seçtiğinde `billingService.processCheckout()` çalışır.
  - Polar API üzerinden anlık checkout session üretilir ve kullanıcı Polar'ın güvenli ödeme sayfasına yönlendirilir.
  - Ödeme bitince kullanıcı `https://<siteniz>/checkout?success=true&checkout_id=...` adresine döner.

- **Mobil Paywall (`PaywallModal.tsx`):**
  - Mobil uygulamada kullanıcı "Satın Al" butonuna bastığında Polar ödeme sayfası güvenli tarayıcı sekmesinde (`WebBrowser.openBrowserAsync`) açılır.
  - Kullanıcı ödemeyi tamamlayıp uygulamaya döndüğünde bakiye ve üyelik otomatik yenilenir.

- **Otomatik Kredi ve Üyelik Yükleme (Webhook):**
  - Polar sunucusu ödeme yapıldığında `POST /polar/webhook` veya `/api/webhook/polar` uç noktasına kriptografik imzalı bildirim yollar.
  - Kredi paketlerinde DynamoDB'deki kullanıcı bakiyesine krediler eklenir (`ADD credits`).
  - Aboneliklerde kullanıcı kademesi `explorer`, `pro` veya `agency` olarak güncellenir ve aylık kredisi yüklenir.
  - İdempotency koruması sayesinde aynı webhook birden fazla kez gelse bile kredi asla çift yüklenmez.

- **Müşteri Portalı (Customer Portal):**
  - Kullanıcılar aktif aboneliklerini yönetmek, kart bilgilerini güncellemek veya iptal etmek için Polar Müşteri Portalı'nı kullanabilir (`/polar/portal`).

