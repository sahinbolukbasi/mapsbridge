# ADR-003: Affiliate Monetizasyon Mimarisi (Faz C)

**Tarih:** 2026-10-13  
**Durum:** Kabul Edildi  
**Yazar:** @sahin

---

## Bağlam

Faz C hedefi: Travelpayouts (uçuş, otel, araç, sigorta) ve GetYourGuide (aktivite) affiliate linklerini plan yanıtlarına entegre etmek. Temel gereksinimler:

1. Affiliate linkleri atfedilmiş (attribution metni zorunlu)
2. Tıklama ölçülüyor
3. Expired fiyat render edilmiyor (otomatik test)
4. Komisyon ranking'i etkilemiyor (otomatik test)

## Karar

**Link-first yaklaşım:** Her affiliate kartı bir deep link'tir — gerçek zamanlı fiyat lookup yapılmıyor. Fiyat göstermek için `AffiliateCard.price.expires_at` TTL alanı zorunlu; UI `isExpired()` geçmeden fiyat render etmez.

**Kart üretimi supervisor'da, senkron:** URL oluşturma I/O gerektirmediğinden `buildTripAffiliateBundle()` + `buildCuratedActivityCards()` main response latency'sini artırmadan ekleniyor.

**Sıralama sabitleme:** `buildTripAffiliateBundle()` her zaman `[flight, hotel, car, insurance]` döner. Sıralama komisyon oranına değil kart tipine göre belirlenir. Otomatik test bunu korur.

## Dosyalar

- `apps/web/app/lib/affiliate/types.ts` — `AffiliateCard`, `isExpired()`, `AffiliateClickEvent`
- `apps/web/app/lib/affiliate/travelpayouts.ts` — Aviasales/HotelLook/RentalCars/insurance link builder
- `apps/web/app/lib/affiliate/getyourguide.ts` — GYG aktivite deep link builder
- `apps/web/app/lib/ai/types.ts` — `MultiAgentResponse.affiliateCards` eklendi
- `apps/web/app/lib/ai/supervisor.ts` — affiliate card generation wired in
- `apps/web/tests/affiliate.test.cjs` — 16 test (isExpired, attribution, ranking, links)

## Env Vars

- `NEXT_PUBLIC_TP_MARKER` — Travelpayouts tracking marker (kamuya açık)
- `NEXT_PUBLIC_GYG_PARTNER_ID` — GetYourGuide partner ID (GYG panelinden alınır)

## Kapsam Dışı (Faz C'de)

- eSIM: doğrulanmış sağlayıcı belirsiz, kapsam dışı bırakıldı
- Gerçek zamanlı fiyat API: link-first yaklaşım yeterli; canlı fiyat lookup Faz D sonrası değerlendirilebilir

## İlgili

- ADR-001: Trip domain modeli
- ADR-002: Danışman system prompt mimarisi
