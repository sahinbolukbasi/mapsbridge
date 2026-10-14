# ADR-001: Trip Domain Modeli ve Sohbet Mimarisi

**Tarih:** 2026-10-13  
**Durum:** Kabul Edildi  
**Yazar:** @sahin

---

## Bağlam

Mevcut sistemde AI chat yanıtı serbest metin üretiyor ve UI bunu parseliyor. Plan öğeleri JSON bloğu olarak chat mesajının içine gömülü. Sonuç:

- Plan düzenlenemiyor (metin editi gerekiyor)
- Mobil ve web farklı parse edebiliyor → tutarsızlık
- Modelin ürettiği mekan adları/saatler tool sonucuna bağlı değil → hallucination riski
- Plan kalıcı bir nesne olarak tutulmuyor → paylaşım, fiyatlama, analitik imkânsız

## Karar

**Sohbet düz metin gezi planı üretmez. Tipli bir `Trip` nesnesini mutasyona uğratır; UI onu render eder.**

Model konuşurken tool çağrılarıyla `Trip` üzerinde şu mutation'ları yapar:
`addStop`, `removeStop`, `moveStop`, `replaceStop`, `setDates`, `attachBooking`, `setTempo`, `setTheme`, `advancePhase`

Model prozası yalnızca **açıklama, gerekçe ve yargı** üretir. Veri üretmez.

**Kural:** Modelin ürettiği hiçbir mekan, fiyat, saat veya kural, bir tool sonucuna bağlı değilse plana giremez. `isValidPlaceRef()` bunu zorunlu kılar — source prefix olmadan ekleme başarısız olur.

## Neden

1. **Düzenlenebilirlik:** `TripMutation` pure reducer'ı ile her değişiklik atomik ve izlenebilir.
2. **Paylaşılabilirlik:** `Trip` nesnesi JSON olarak kalıcı, mobil/web aynı nesneyi render eder.
3. **Güven:** `PlaceRef.id` prefix'i (`overture:`, `fsq:`, `google:`, `manual:`) kaynaksız öğeyi schema seviyesinde engeller.
4. **Fiyatlama:** `TripBooking` affiliate link ve expiry ile birlikte gelir; expired fiyat render edilemez.

## Alternatiflere Bakış

**Serbest metin + parse:** Hızlı başlangıç ama kaynaksız veri sorununu çözmez. Ölçeklenmez.  
**Full structured output tek turda:** Model hallucination'ı json formatında gelir, daha tehlikeli. Tool çağrısı her adımı kesimlere böler ve doğrulama yapar.

## Sonuçlar

- Faz A'da `Trip` domain modeli mevcut `UnifiedRoutePlan` sisteminin yanında feature flag (`NEXT_PUBLIC_NEW_TRIP_ENGINE`) arkasında çalışır.
- Migration kademeli: yeni plan oluşturma `Trip` üretiyor, mevcut planlar `UnifiedRoutePlan` formatında kalmaya devam ediyor.
- `countSourcelessStops(trip)` metriği her plan üretiminde loglanır. Sıfır olması Faz A kabul kriteri.

## İlgili Dosyalar

- `apps/web/app/lib/trip/domain.ts` — tipler
- `apps/web/app/lib/trip/mutations.ts` — pure reducer
- `apps/web/app/lib/trip/state-machine.ts` — faz geçişleri
- `apps/web/app/lib/trip/scheduler.ts` — deterministik sıralama
