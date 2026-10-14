# ADR-002: Danışman System Prompt Mimarisi

**Tarih:** 2026-10-13  
**Durum:** Kabul Edildi  
**Yazar:** @sahin

---

## Bağlam

v4 system prompt soyut kural listelerinden oluşuyordu. "Somut konuş", "kısa tut" gibi direktifler modelin davranışını gözlemlenebilir biçimde değiştirmiyordu. Ayrıca her şehir için aynı sistem prompt kullanılıyordu — destinasyon bilgisi yoktu.

## Karar

**System prompt bir kod dosyasıdır:** versiyonlanır, repo'da tutulur, değişimde eval çalıştırılır, ton kuralları örneklerle gösterilir.

Üç katman:

1. **Base prompt** (`ANSWER_PROMPT` / `CHAT_STREAM_PROMPT`) — ton kuralları örnekli, soru bütçesi, vize yasağı, proaktif uyarı talimatı
2. **Destinasyon brifingi** (`destination-context.ts`) — `DestinationBrief`'ten token-verimli özet; kapalı günler, acemi hataları, abartılanlar
3. **Durum başlığı** (`advisor-prompt-builder.ts`) — mevcut faz, soru bütçesi kalanı, görünür varsayımlar, tercih özeti

Bu üç katman `buildAdvisorSystemPrompt()` ile tek çağrıda birleştirilir ve supervisor'a geçilir.

## Neden

- Soyut kural → örnekli kural: modele "kötü cevap vs iyi cevap" göstermek soyut adjektiften daha etkili
- Destinasyon bilgisi brifinge alındı → model "Pazartesi bu müze kapalı" gibi doğrulanmış bir uyarıyı prompt'ta görüyor, model bilgisinden üretmiyor
- `promptVersion` izlenir → hangi versiyon hangi yanıtı ürettiği audit log'da görünür

## Alternatiflere Bakış

**Tek monolitik prompt:** Değişiklikte tüm promptu test etmek gerekir, destinasyon spesifik ekleme zor. Reddedildi.  
**Dinamik fine-tuning:** Fazla maliyet, fazla gecikme, Faz A kapsamı dışı.

## Sonuçlar

- `PROMPT_VERSION` `travel-dialogue-v5` oldu — her eval suite bunu kontrol eder
- Destinasyon ID `context.destination` lowercase'den türetilir (`"barcelona"`)
- Bilgi olmayan şehirler için `buildDestinationContext` boş string döner — prompt sessizce kısalır
- Faz B eval: aynı şehir, farklı profil → iki plan arası fark metriği ölçülür

## İlgili Dosyalar

- `apps/web/app/lib/ai/advisor-prompt-builder.ts` — ana builder
- `apps/web/app/lib/ai/destination-context.ts` — brief → prompt text
- `apps/web/app/lib/ai/proactive-rules.ts` — deterministik kural motoru
- `apps/web/app/lib/ai/prompts.ts` — `ANSWER_PROMPT` + `CHAT_STREAM_PROMPT` v5
- `apps/web/app/lib/ai/supervisor.ts` — builder entegrasyonu
