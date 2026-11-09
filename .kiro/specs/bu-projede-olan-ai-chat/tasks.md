# Görevler — Kapsamlı Seyahat AI Sohbet Asistanı

Her görev küçük, bağımsız ve geri-alınabilir (strangler-fig). Her kod değişikliğinden sonra doğrulama sırası: `npm run typecheck` → ilgili `npm run test:backend` / `test:services` → `npm run eval:ai`. Danger-zone'a dokunan görevde o zone'un koruyan testi zorunlu. Bellek kritikken ağır build/test erteleme kuralı geçerli.

---

## Faz 0 — Temel ölçüm ve güvenlik ağı

- [ ] 1. Mevcut AI hattının karakterizasyon testlerini yaz
  - `retrieval.ts`, `mergeEvidence`, `bundled-evidence.ts`, `training-worker.ts` için bugünkü davranışı dondur
  - Yeni test yok sayılan davranışı değiştirmez; yalnızca mevcut çıktıyı sabitler
  - _Gereksinimler: 1, 3, 4, 8.2_

- [ ] 2. AI operasyon/metrik şemasını genişlet (ölçüm hazırlığı)
  - `shared/ai-operations.ts` `recordAIOperation`'a `retrievalStatus` ve `evidenceCounts` alanlarını ekle (opsiyonel, geriye uyumlu)
  - `MapsBridge/AI` metriğine gecikme + retrievalStatus dağılımı yay
  - _Gereksinimler: 8.1, 8.4_

## Faz 1 — RAG grounding derinleştirme

- [ ] 3. Şehir-alias'ı tek kaynağa taşı
  - `apps/web/app/lib/ai/city-aliases.ts` oluştur; `retrieval.ts` `canonicalCity` ve `bundled-evidence.ts` alias tablosu buradan import etsin
  - Sessiz drift'i önle; birim testle iki tüketicinin aynı tabloyu kullandığını doğrula
  - _Gereksinimler: 1.1, 3.1_

- [ ] 4. Kanıt birleştirmeyi ölçülebilir yap
  - `TravelEvidence`'a `counts?: {remote, local, merged}` ekle; `mergeEvidence` doldursun
  - `supervisor.ts` bu sayıları `recordAIOperation`'a `evidenceCounts` olarak geçsin
  - _Gereksinimler: 1.2, 3.4, 8.1_

- [ ] 5. RAG timeout → yerel kanıt degradasyonunu test et ve sabitle
  - `AbortSignal.timeout(3000)` aşımında `status:"unavailable"` + `bundledEvidence` devreye girdiğini doğrulayan test
  - Gecikme bütçesi (I7) ihlal edilmiyor
  - _Gereksinimler: 3.3, 5.4_

- [ ] 6. Grounding doğrulama testlerini güçlendir
  - Kaynaksız olgusal iddia üretilmediğini (I1), doğrulanmamış fiyatın reddedildiğini (fiyat regex + verifiedPrices), yetersiz durakta `clarify` dönüldüğünü doğrula
  - _Gereksinimler: 1.1, 1.3, 1.4_

## Faz 2 — KB entity + araştırma kuyruğu dayanıklılaştırma

- [ ] 7. KB kalıcılık katmanı (`kb-repo.ts`)
  - `knowledge-base/kb-repo.ts`: `KB_PATTERNS` ile DynamoDB DocumentClient (ORM yok, single-table) üzerinden entity/source/conflict oku-yaz
  - `kb-store.ts` saf domain mantığı kalır; repo yalnızca kalıcılık (DIP)
  - _Gereksinimler: 3.2_

- [ ] 8. TTL tazelik worker'ı
  - `memory-worker.ts` desenine benzer zamanlanmış görevde `pruneStaleEntities` çalıştır; pruned sayısı + en eski entity yaşını metrik yap
  - _Gereksinimler: 3.2, 3.4_

- [ ] 9. Çelişki çözümü (reliability sırası)
  - Çoklu kaynak aynı alanda ayrışırsa `official > institutional > major_publication > ugc` ile otomatik seç; çözülemezse `addConflict` işaretle
  - Birim testle sıralama ve işaretlemeyi doğrula
  - _Gereksinimler: 3.2_

- [ ] 10. Araştırma kuyruğu entegrasyonu (önceden hesaplama)
  - Eksik şehir/entity için supervisor `shouldEnqueue` + `enqueueJob(high)` tetiklesin; tekrar engelleme çalışsın
  - In-trip yolunda ağır araştırma talep anında değil kuyrukta (I7)
  - _Gereksinimler: 2.1, 5.4_

## Faz 3 — Sub-agent kapsamı ve koşullu tetik

- [ ] 11. Koşullu tetik kuralını sıkılaştır (I10)
  - `dispatcher.ts`: vizesiz destinasyonda `visa-agent`, transit şehrinde `car-rental-agent` çağrılmasın; karar `destination-context.ts` olgularından (demografiden değil — I5)
  - _Gereksinimler: 2.3, 2.5_

- [ ] 12. Sub-agent degradasyon + raporlama
  - Her sub-agent `try/catch`; başarısızsa `agentsInvolved` `status:"failed"`, yanıt o alan olmadan tamamlanır
  - `readEnabledAIAgents` ile yalnızca etkin agent'ların tetiklendiğini test et
  - _Gereksinimler: 2.1, 2.2, 2.4_

- [ ] 13. Deterministik sınır tip güvencesi (I2)
  - Sub-agent payload tipi skor/kümeleme/zamanlama alanlarını içermesin; tip düzeyinde sub-agent'ın rota geometrisini yazamayacağını garanti et
  - _Gereksinimler: 2.5_

## Faz 4 — Korpus büyütme / "LLM eğitimi" döngüsü

- [ ] 14. Consent ve karantina akışını doğrula
  - `trainingConsent !== true` → hiçbir iş oluşmadığını; iş oluşunca `privacyReview="pending"` + `reviewed:false` + `consent.scope="current_turn"` olduğunu test et
  - _Gereksinimler: 4.1, 4.2_

- [ ] 15. K3 + maskeleme filtresini sabitle
  - `isGoogleDerived` kayıtların korpustan silindiğini, `maskPII`'nin kimliği çıkardığını, demografi türetilmediğini (I5) doğrula
  - _Gereksinimler: 4.3, 4.4_

- [ ] 16. Onaylı → korpus promotion kanalı
  - `privacyReview="approved"` kayıtları RAG korpusuna (KB entity, tarihli/kaynaklı) ve few-shot havuzuna (`prompts.ts`, yalnız üslup) yazan ince promotion adımı
  - Fine-tune YOK; olgu RAG'da, üslup few-shot'ta
  - _Gereksinimler: 4.2, 4.5_

- [ ] 17. Eğitim tazelik/hacim metrikleri
  - `training-worker.ts`: `OldestPendingAgeSeconds`, `Exported`, `SkippedThirdPartyContent` metriklerini doğrula/genişlet
  - _Gereksinimler: 3.4, 8.4_

## Faz 5 — Konuşma-önce deneyim

- [ ] 18. Netleştirme disiplini (I3/I4)
  - Tur başına ≤2 soru + 2–4 `quickOptions`; `answeredSlots` aynı slotu iki kez sormayı engellesin — test et
  - _Gereksinimler: 5.2, 5.3_

- [ ] 19. Streaming yolu sağlamlaştırma
  - `index.ts` `streamHandler` SSE token akışı + chat modunda `invokeBedrockChatStream`; ilk-token gecikmesini ölç
  - _Gereksinimler: 5.1_

- [ ] 20. `CONTEXT_TOO_LARGE` kurtarma yolu
  - Bağlam aşımında 1 kez agresif budama (`keepTurns=2`) → yine aşarsa net `CONTEXT_TOO_LARGE` + kurtarma mesajı (belirsiz 503 yok) — test
  - _Gereksinimler: 5.5_

- [ ] 21. Dil eşleme (I11)
  - Çıktının kullanıcı diliyle eşleştiğini, varsayılanın Türkçe olduğunu doğrula
  - _Gereksinimler: 5.6_

## Faz 6 — Hafıza isabeti

- [ ] 22. I6 promotion kuralı testi
  - Oturum override'ının profili mutasyona uğratmadığını; profile yalnızca ≥3 farklı oturum tekrarında yazıldığını doğrula
  - _Gereksinimler: 6.1_

- [ ] 23. Demografi yasağı + unutma akışı
  - İlginin yalnızca söylenen/yapılandan çıkarıldığını (I5); "tercihlerimi unut" → reset + `generation` artışı + eski requestId 409 davranışını test et
  - _Gereksinimler: 6.2, 6.3, 6.4_

## Faz 7 — Güvenlik, kredi, kalite kapısı

- [ ] 24. Kredi atomikliği regresyon testi (danger-zone #1)
  - `reserveAI` atomik rezervasyon, doğrulama hatasında `finishAI(false)` iade, idempotency replay — `npm run test:backend` + `infra/lambda/tests/billing.test.cjs`
  - _Gereksinimler: 7.2, 7.3_

- [ ] 25. Kapsam/injection reddi kredi harcamadan
  - `validateTopicSafety`/`validateTravelScope` reddinde kredi harcanmadığını doğrula
  - _Gereksinimler: 7.1_

- [ ] 26. Affiliate ayrımı (I8)
  - Affiliate kartlarının rota sıralamasını etkilemediğini, yalnızca ilgili olanların ayrı yüzeyde gösterildiğini test et
  - _Gereksinimler: 7.5_

- [ ] 27. Model yönlendirme sınırı
  - Kritik yolda büyük model çağrılmadığını (intake/anlatım Haiku), batch distilasyonun çevrimdışı Sonnet olduğunu doğrula
  - _Gereksinimler: 7.4_

- [ ] 28. Değerlendirme kapısını CI'a bağla
  - `npm run eval:ai` referans senaryolarda gerilerse değişiklik/promotion bloke; grounding, netleştirme disiplini, fiyat doğrulama senaryoları dahil
  - _Gereksinimler: 4.5, 8.2, 8.3_

## Faz 8 — Doğrulama ve kapanış

- [ ] 29. Tam doğrulama turu
  - `npm run typecheck` + `npm run test:backend` + `npm run test:services` + `npm run eval:ai` yeşil (bellek uygunken)
  - Danger-zone testleri (billing, auth, routes, chat) geçti
  - _Gereksinimler: 8.2, 8.3_

- [ ] 30. Steering/dokümantasyon güncellemesi
  - RAG/korpus/metrik değişikliklerini `architecture-truth.md` ve ilgili steering'e yansıt (sessiz drift yok)
  - _Gereksinimler: 8.4_
