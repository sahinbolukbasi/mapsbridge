# Gereksinimler — Kapsamlı Seyahat AI Sohbet Asistanı

## Giriş

MapsBridge'in canlı AI seyahat asistanını, **seyahat hakkında en derin ve doğru bilgiyi veren, konuşma deneyimini en üste koyan** bir yol arkadaşına dönüştürmek. Bu spec yeni bir sistem kurmaz; bugün çalışan çok-ajanlı mimariyi (`apps/web/app/lib/ai/supervisor.ts` + 20+ sub-agent, `infra/lambda/src/ai/index.ts` handler, Bedrock üzerinden RAG `retrieval.ts`, `knowledge-base/` entity store, `training/` + `training-worker.ts` eğitim hattı, `memory-service.ts` profil/oturum ayrımı) **üç eksende güçlendirir**:

1. **Daha derin seyahat bilgisi** — RAG korpusu + sub-agent kapsamı genişler; her cevap kaynaklı, güncel ve şehre özgü olur.
2. **RAG + vektör DB olgunluğu** — Bedrock Knowledge Base / OpenSearch Serverless vektör store'u tazelik, kapsama ve geri-çağrım kalitesi açısından ölçülebilir hale gelir; onaylı diyaloglardan beslenen bir korpus büyütme (LLM "eğitimi") döngüsü kurulur.
3. **Konuşma-önce deneyim** — akış, gecikme, netleştirme disiplini (en çok 2 soru) ve token streaming kullanıcı deneyimini belirler.

Tüm değişiklikler Master Spec'teki 12 invariant'a (özellikle I1 halüsinasyon yasağı, I2 deterministik rota, I3 soru disiplini, I5 demografi yasağı, I7 ≤2s p95, I8 affiliate ayrımı) uymak zorundadır. Bir gereksinim bir invariant'ı bozuyorsa reddedilir.

Kullanıcıya dönük tüm metinler **Türkçe**'dir.

## Terimler

- **Supervisor**: Intake → araştırma/RAG → deterministik rota → anlatım akışını yöneten orkestratör (`supervisor.ts`).
- **Sub-agent**: Supervisor'ın tetiklediği alan uzmanı (yemek, konaklama, vize, etkinlik, acil durum vb.).
- **Evidence / kanıt**: RAG'dan (`retrieveTravelEvidence`) veya `bundledEvidence`'tan gelen, kaynak URL + kontrol tarihi taşıyan pasaj.
- **KB entity**: Knowledge Base'teki tekil, tarihli, güven-skorlu yer/olgu kaydı (`knowledge-base/types.ts`).
- **Korpus büyütme (LLM eğitimi)**: Onaylı diyalog ve doğrulanmış yerlerden RAG korpusu + few-shot örnekleri üretme döngüsü (temel model fine-tune edilmez — I1).

## Gereksinimler

### Gereksinim 1 — Kaynaklı, derin seyahat yanıtları (RAG grounding)

**Kullanıcı Hikâyesi:** Bir gezgin olarak, asistanın verdiği her olgusal bilginin (yer, açılış saati, semt, mesafe) gerçek ve güncel bir kaynağa dayanmasını istiyorum ki uydurma bilgiyle yanlış yere gitmeyeyim.

#### Kabul Kriterleri

1. WHEN bir yanıt olgusal bir yer/olgu iddiası içeriyor THEN sistem bu iddiayı ya RAG kanıtına (`retrievalStatus = "available"`, kaynak URL + `checkedAt`) ya da doğrulanmış yer araştırmasına (`researchPlaces`) dayandıracak; dayanak yoksa iddiayı üretmeyecektir (I1).
2. WHEN RAG kanıtı mevcutsa THEN yanıt, kullanılan kaynakları `sources` alanında (id, başlık, URL, kontrol tarihi) döndürecek ve UI bunları kullanıcıya gösterecektir.
3. WHEN model doğrulanmamış bir fiyat/para birimi üretirse THEN mevcut doğrulama (`validate()` fiyat regex'i) bunu reddedecek ve yalnızca `flightData`'dan gelen doğrulanmış fiyatlara izin verecektir (I1, I8).
4. IF bir rota için yeterli gerçek durak bulunamazsa (`research.places.length < days`) THEN sistem uydurma rota yerine netleştirme (`responseMode: "clarify"`) dönecek ve mevcut planı değiştirmeyecektir.
5. WHEN KB entity'si bayatsa (`isEntityStale` / `valid_until` geçmiş) THEN bu entity retrieval filtresinden (`valid_until > now`) elenecek ve yanıta girmeyecektir.

### Gereksinim 2 — Genişletilmiş alan kapsamı ve sub-agent derinliği

**Kullanıcı Hikâyesi:** Bir gezgin olarak, uçuş/konaklama/yemek/vize/etkinlik/ulaşım/acil durum gibi tüm seyahat boyutlarında tek sohbetten derinlemesine cevap almak istiyorum.

#### Kabul Kriterleri

1. WHEN kullanıcının isteği bir uzmanlık alanını ima ediyorsa THEN supervisor yalnızca ilgili sub-agent'ları (`dispatchSubAgents`) ve yalnızca `readEnabledAIAgents` ile etkin olanları tetikleyecektir.
2. WHEN bir sub-agent harici veri (uçuş fiyatı, danışma seviyesi) çağırırsa THEN sonuç doğrulanmış kaynaktan (`callFlightSearchTool`, `callAdvisoryTool`) gelecek, başarısız olursa yanıt o alan olmadan tamamlanacaktır (graceful degradation).
3. WHEN bir alan bu geziye uygulanmıyorsa (vizesiz destinasyon, metro şehri) THEN o alanın kartı/sub-agent'ı render edilmeyecektir (I10 koşullu UI).
4. WHEN sub-agent çıktısı yanıta dahil edilir THEN `agentsInvolved` listesinde agent id, durum ve süre raporlanacaktır (gözlemlenebilirlik).
5. WHEN yeni bir sub-agent eklenir THEN deterministik alanlarına (skor, kümeleme, zamanlama) dokunmayacak, yalnızca kanıt/anlatım sağlayacaktır (I2).

### Gereksinim 3 — RAG / vektör veritabanı olgunluğu

**Kullanıcı Hikâyesi:** Bir ürün sahibi olarak, RAG korpusunun kapsamını, tazeliğini ve geri-çağrım kalitesini ölçmek ve iyileştirmek istiyorum ki asistan zamanla daha isabetli olsun.

#### Kabul Kriterleri

1. WHEN retrieval çalışır THEN yalnızca `visibility=public`, `approved=true` ve `valid_until > now` filtrelerini geçen pasajlar dönecek; kişisel/profil verisi sorguya veya korpusa asla girmeyecektir (maskeleme `maskPII`).
2. WHEN bir KB entity'si yazılır THEN tarih (`updatedAt`/`expiresAt`), güven skoru (`confidence`), şehir ve kaynak metadata'sı taşıyacak; çelişki tespitinde (`addConflict`) kayıt tutulacaktır.
3. WHEN retrieval gecikmesi 3 sn'yi aşarsa THEN istek iptal edilecek (`AbortSignal.timeout(3000)`) ve yanıt `bundledEvidence` ile tamamlanacaktır (I7 bütçesi korunur).
4. WHEN korpus tazeliği ölçülür THEN sistem bekleyen en eski kaydın yaşı, export sayısı gibi metrikleri CloudWatch'a yayacaktır (`trainingMetric` deseni).
5. WHEN RAG yapılandırılmamışsa (`TRAVEL_KNOWLEDGE_BASE_ID` yok) THEN sistem `status: "disabled"` ile çalışmaya devam edecek, çökmeyecektir (geriye dönük uyumluluk).

### Gereksinim 4 — Onaylı diyaloglardan korpus büyütme ("LLM eğitimi")

**Kullanıcı Hikâyesi:** Bir ürün sahibi olarak, kullanıcıların izniyle onaylanmış kaliteli diyalogları RAG korpusuna ve few-shot örneklerine dönüştürerek asistanı zamanla geliştirmek istiyorum — temel modeli halüsinasyona açmadan.

#### Kabul Kriterleri

1. WHEN kullanıcı eğitim iznini (`trainingConsent`) açıkça vermemişse THEN hiçbir diyalog eğitim/korpus hattına girmeyecektir (varsayılan opt-out, KVKK/GDPR).
2. WHEN bir eğitim işi oluşturulur THEN kayıt `privacyReview: "required"` (canlı kod değeri; insan onayı bekler) olarak başlayacak ve `privacyReview: "approved"` olana kadar yalnızca karantinada (`quarantine/*.jsonl`) tutulacak, canlı korpusa geçmeyecektir (`training-outbox.ts` / `training-worker.ts`).
3. WHEN kayıt üçüncü taraf içeriği içeriyorsa (Google Places türevi, `isGoogleDerived`) THEN eğitim korpusundan hariç tutulacaktır (K3 lisans kuralı).
4. WHEN eğitim işi işlenir THEN kişisel veri maskelenecek (`maskPII`), kimlik asla korpusa yazılmayacaktır (I5, gizlilik).
5. WHEN korpus büyümesi değerlendirilir THEN `npm run eval:ai` diyalog değerlendirmesi referans senaryolarda gerilememeyi (regression yok) doğrulayacaktır; gerileme varsa değişiklik reddedilir.

### Gereksinim 5 — Konuşma-önce deneyim: akış, netlik, gecikme

**Kullanıcı Hikâyesi:** Bir gezgin olarak, asistanla doğal, akıcı ve hızlı konuşmak istiyorum — formla değil, sohbetle; beni gereksiz sorularla yormadan.

#### Kabul Kriterleri

1. WHEN sohbet modunda yanıt üretilir THEN token'lar canlı akışla (SSE `invokeBedrockChatStream`, `writeSse` "token") kullanıcıya iletilecektir.
2. WHEN sistem netleştirme sorusu sorar THEN tur başına en fazla 2 soru olacak, her biri rotayı maddi değiştirecek ve 2–4 dokunulabilir seçenek (`quickOptions`/chips) sunacaktır (I3).
3. WHEN bir bilgi fetch edilebilir veya davranıştan çıkarılabilir (hava, vize, açılış saati, daha önce sorulmuş slot) THEN sistem bunu sormayacaktır (I4, `answeredSlots` tekrarı engeller).
4. WHEN seyahat-içi (in-trip) bir istek gelirse THEN p95 yanıt ≤2 sn olacak; bu bütçeyi aşan iş önceden hesaplanacaktır (I7).
5. WHEN konuşma modelin bağlam sınırını aşarsa THEN belirsiz 503 yerine net `CONTEXT_TOO_LARGE` kodu ve kurtarma yolu (özetle/yeni seyahat) dönecektir.
6. WHEN kullanıcının dili belirlenir THEN tüm insan-okunur çıktı o dille eşleşecek, varsayılan Türkçe olacaktır (I11).

### Gereksinim 6 — Hafıza: profil / oturum ayrımı ve isabet

**Kullanıcı Hikâyesi:** Bir gezgin olarak, asistanın beni hatırlamasını ama tek seferlik bir tercihi kalıcı sanmamasını istiyorum.

#### Kabul Kriterleri

1. WHEN oturum verisi profili geçersiz kılar THEN profili mutasyona uğratmayacak; bir davranış yalnızca ≥3 farklı oturumda tekrarlayınca profile yazılacaktır (I6 promotion kuralı).
2. WHEN ilgi alanları çıkarılır THEN yalnızca kullanıcının söylediği/yaptığından çıkarılacak; yaş, cinsiyet, milliyet, grup tipi gibi demografiden ASLA çıkarılmayacaktır (I5).
3. WHEN kullanıcı "tercihlerimi unut" derse THEN hafıza sıfırlanacak (`changeMemory reset` / `forgetAIPreferences`) ve sonraki istekler yeni nesil (`generation`) ile çalışacaktır.
4. WHEN hafıza devre dışıysa (`settings.enabled = false`) THEN tercih güncellemesi yazılmayacak, yalnızca oturum içi kullanılacaktır.

### Gereksinim 7 — Güvenlik, kapsam ve maliyet kontrolü

**Kullanıcı Hikâyesi:** Bir operatör olarak, asistanın yalnızca seyahat konuşmasını, kötüye kullanıma kapalı olmasını ve maliyetin kontrol altında kalmasını istiyorum.

#### Kabul Kriterleri

1. WHEN istek seyahat dışıysa veya prompt injection içeriyorsa THEN `validateTopicSafety` / `validateTravelScope` reddedecek, kredi harcamayacaktır (I kapsam dışı yönlendirme).
2. WHEN ücretli üretim başlar THEN kredi önce atomik olarak rezerve edilecek (`reserveAI`), üretim doğrulanamazsa iade edilecektir (`finishAI(false)`); krediler yalnızca sunucuda düşülür.
3. WHEN aynı `requestId` tekrar gelirse THEN idempotency korunacak (replay) ve çift harcama olmayacaktır.
4. WHEN model seçimi yapılır THEN kullanıcının kritik yolunda büyük model çağrılmayacak (intent → Haiku; batch distilasyon → Sonnet, çevrimdışı) (Master Spec stage mimarisi).
5. WHEN affiliate kartları üretilir THEN yalnızca ilgili olanlar, rota sıralamasını etkilemeden, ayrı yüzeyde gösterilecektir (I8).

### Gereksinim 8 — Gözlemlenebilirlik ve kalite kapıları

**Kullanıcı Hikâyesi:** Bir operatör olarak, her AI isteğinin maliyetini, gecikmesini ve sonucunu görmek; kalite gerilemelerini yayından önce yakalamak istiyorum.

#### Kabul Kriterleri

1. WHEN bir AI isteği tamamlanır/başarısız olur THEN `recordAIOperation` model, responseMode, maliyet, süre ve agent sonuçlarını kaydedecektir.
2. WHEN kod değişikliği AI alanına dokunur THEN `npm run typecheck`, ilgili `npm run test:backend`/`test:services` ve `npm run eval:ai` geçmeden iş tamamlanmış sayılmayacaktır (steering doğrulama kuralı).
3. WHEN danger-zone'a (billing `reserveAI`, auth, routes middleware) dokunulursa THEN o zone'un koruyan testi (`infra/lambda/tests/*.test.cjs`) çalıştırılacaktır.
4. WHEN retrieval/eğitim hattı çalışır THEN tazelik ve hacim metrikleri CloudWatch'a yayılacaktır.

## Kapsam dışı (Non-goals)

- Temel modeli fine-tune etmek (I1 riski; korpus büyütme + few-shot tercih edilir).
- Komisyon-ağırlıklı sıralama veya affiliate'in rota önerisine karışması (I8 — geri alınamaz).
- Genel amaçlı chatbot; seyahat dışı istekler geziye yönlendirilir.
- Deterministik rota algoritmasını (kümeleme/TSP/temporal fitting) LLM'e devretmek (I2).
- Yeni harici vektör DB (pgvector/Pinecone) eklemek — mevcut Bedrock KB derinleştirilir (karar: `.spec-state`).
