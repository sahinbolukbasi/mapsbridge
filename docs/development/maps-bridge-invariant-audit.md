# Maps Bridge — Invariant Denetim Raporu (§2'ye karşı)

> Mevcut kod tabanının 12 invariant'a karşı denetimi. Yöntem: statik kod analizi + canlı
> Bedrock testleri. Sadece durum + ihlaller raporlanır. Tarih: güncel kod tabanı.

## Özet Tablo

| ID                                   | Durum           | Kanıt                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I1** LLM uydurmaz                  | ✅ UYUMLU       | `supervisor.ts:1085` — LLM yalnızca `research.places`'teki `placeId`'yi seçebilir; olmayan yer → hata. İsim/koordinat/adres datastore'dan.                                                                                                                                                                                                                                                                                                                                      |
| **I2** Route deterministik           | ✅ DÜZELTİLDİ   | `buildResearchedRoute` güne-atamayı artık `autoSplitPinsIntoDays` (deterministik k-means) ile yapıyor; LLM'in `stop.day` çıktısı yok sayılıyor. LLM yalnızca POI seçer (I1). 4 test: determinizm + LLM-bağımsızlık + I1 korunumu + her gün dolu.                                                                                                                                                                                                                                |
| **I3** Max 2 soru/tur                | ✅ UYUMLU       | `prompts.ts:99` "En fazla 2 soru".                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **I4** Fetch edileni sorma           | ✅ UYUMLU       | Context servisleri proaktif uyarı olarak.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **I5** Demografiden çıkarım yok      | ✅ DÜZELTİLDİ   | `prompts.ts` INTAKE_PROMPT "DEMOGRAFİ YASAĞI" + canlı test (aile→interests:[]).                                                                                                                                                                                                                                                                                                                                                                                                 |
| **I6** Session profile mutasyonu yok | ✅ UYUMLU       | `ai/index.ts:287` — `preferenceUpdates` yalnızca `personal.settings.enabled` ile ve `sanitizePreferences`'ten geçerek yazılıyor; `prompts.ts:28` "tek gezinin tercihini kalıcı yapma" + "her seyahatimde/genelde" açık kalıcı tercih şartı. Session override profile'a yazılmıyor. NOT: "≥3 session" sayaç mekanizması explicit değil — prompt-seviyesi kural ("açık kalıcı tercih") ile sağlanıyor; sayaç tabanlı promotion Phase 2 güçlendirmesi olabilir.                    |
| **I7** In-trip ≤2s p95               | 🟡 KISMEN       | `local-context.ts` statik veri filtresi (hızlı, LLM yok) VAR. Tam pre-computation pipeline (event calendar, review distillation) Phase 4 kapsamı — henüz ölçülmedi.                                                                                                                                                                                                                                                                                                             |
| **I8** Affiliate ranking etkilemez   | ⚠️ DİKKAT       | Route scoring formülünde affiliate/commission TERİMİ YOK ✓ (ranking temiz). ANCAK affiliate kartları (`supervisor.ts:587` `buildCuratedActivityCards`, flight `affiliateLink`) supervisor akışında üretiliyor — ayrı `affiliateCards` alanında ve yalnızca "pricing" aşamasında (rota stops'una karışmıyor). Spec "ayrı sekme, asla rota akışında değil" diyor; mevcut durum ranking'i etkilemiyor ama üretim akışında. **İzlenmeli — Phase 5'te prep layer'a tam ayrıştırma.** |
| **I9** ≥%20 tampon                   | ✅ DÜZELTİLDİ   | `scheduler.ts` `enforceBuffer()` + canlı kanıt (yoğun gün → %26 tampon).                                                                                                                                                                                                                                                                                                                                                                                                        |
| **I10** Koşullu UI                   | 🟡 DOĞRULANMADI | Kart render koşulları panel/UI tarafında; ayrı UI denetimi gerektirir (web typecheck spec'i sonrası).                                                                                                                                                                                                                                                                                                                                                                           |
| **I11** Dil eşleştirme               | ✅ UYUMLU       | Prompt "Match language" + canlı Türkçe yanıtlar.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **I12** Çevrimdışı kullanım          | 🟡 KISMEN       | `trip-markdown.ts` localStorage manifest + `routing-service.ts:127` offline fallback path + `checklist.ts` offline harita öğesi VAR. Koordinat+yön tam offline cache Phase 4'te doğrulanmalı.                                                                                                                                                                                                                                                                                   |

## Düzeltme Kaydı

### ✅ I9 — %20 tampon ZORLANIYOR

`domain.ts` buffer alanları + `scheduler.ts` `enforceBuffer()` (S4 infeasibility döngüsü). KANIT: 8 durak %0 → 3 durak %26.

### ✅ I5 — Demografi yasağı prompt'ta

`prompts.ts` INTAKE_PROMPT "DEMOGRAFİ YASAĞI (KATI)", PROMPT_VERSION v7→v8. KANIT: aile→interests:[].

## Açık Kalan İşler

| İş                          | Durum          | Plan                                                                                    |
| --------------------------- | -------------- | --------------------------------------------------------------------------------------- |
| I2 deterministik clustering | ✅ TAMAMLANDI  | `i2-deterministic-clustering` spec'i uygulandı; `route-clustering.test.cjs` 4/4 geçiyor |
| I8 affiliate tam ayrıştırma | 🟡 İzlenecek   | Phase 5 prep layer; şu an ranking temiz, sadece üretim akışında                         |
| I7/I10/I12 tam doğrulama    | 🟡 Faz bağımlı | Phase 4 (in-trip) ve UI denetimi kapsamı                                                |

## Doğrulananlar (güçlü yanlar)

- I1 (en kritik) tam korunuyor.
- I3, I4, I5, I6, I9, I11 uyumlu/düzeltildi.
- Route scoring affiliate'ten bağımsız (I8 çekirdeği temiz).
- İki-kademeli maliyet-optimal model (Haiku/Nova Micro).
