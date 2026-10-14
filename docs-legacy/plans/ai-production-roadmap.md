# Kişiselleştirilmiş Seyahat AI Sistemi — Üretim Yol Haritası

> Amaç: Tek geliştiricili ekip, aylık 0–500 USD AWS hedefi ve ilk 0–1.000 kullanıcı için hızlı, güvenli, ölçülebilir ve kişiselleştirilmiş seyahat asistanı çıkarmak.

## 1. Karar özeti

İlk üretim sürümünde mevcut hibrit mimari korunur:

```text
CloudFront/API Gateway
  → Cognito JWT
  → AI Orchestrator Lambda
      → DynamoDB kullanıcı ve konuşma bağlamı
      → AgentCore Memory
      → Bedrock Converse + Guardrails
      → AgentCore Gateway → Amazon Location araştırması
      → Rota doğrulama
      → Güvenli decisionSummary
```

Bu aşamada tüm sistemi AgentCore Runtime’a taşımak, EKS kullanmak, multi-region kurmak, OpenSearch Serverless açmak veya otomatik fine-tuning başlatmak ertelenir. AgentCore Runtime; uzun ömürlü oturumlar, üçüncü taraf OAuth, Cedar policy veya 3+ gerçek uzman agent ihtiyacı oluştuğunda kademeli olarak eklenir.

## 2.1 Uygulama protokolü: sistemi bozmadan ilerleme

Bu yol haritası tek seferde canlıya uygulanmaz. Her faz şu sıralamayla ilerler:

1. Mevcut davranış ve test sözleşmesi kaydedilir.
2. Değişiklik yalnızca ilgili adapter/helper katmanına yapılır; mevcut API alanları korunur.
3. Önce regresyon testi, sonra tip kontrolü ve AI bundle build çalıştırılır.
4. Terraform değişiklikleri yalnızca `fmt`, `validate` ve plan incelemesinden sonra uygulanır.
5. Gerçek AWS smoke testleri yerel doğrulamadan ayrı tutulur; kimlik veya model erişimi yoksa kod değişikliği başarısız gösterilmez.
6. Her fazın sonunda roadmap checkbox'ları yalnızca doğrulanmış maddeler için güncellenir.

### Mevcut durum özeti (2026-10-07)

- **Zaten mevcut:** Cognito `sub` tabanlı kimlik, AgentCore Memory generation izolasyonu, metadata-only AI operasyon kayıtları, Bedrock Guardrail entegrasyon noktası, request idempotency, günlük kredi/request sayaçları, model çağrısı ve output token sınırları, bounded thinking ve safe `decisionSummary`.
- **Tamamlandı:** Araştırma kanıtı validator'ı; provider, timestamp, koordinat, alan uzunluğu, durum/sonuç sayısı ve duplicate place ID kontrolleri.
- **Sıradaki düşük riskli dilim:** golden evaluation kayıtlarının düzenli çalıştırılması ve gerçek AWS smoke testleri.
- **Canlı hesap gerektirir:** AWS Budget eşiklerinin canlı notification testi, AgentCore Gateway/Memory isolation ve Guardrail block/allow smoke testleri.
- **Ertelendi:** AgentCore Runtime'a tam geçiş, EKS, multi-region, Provisioned Throughput ve fine-tuning.

## 11. AI Control Plane / admin öğrenme yönetimi

İlk kontrol düzlemi mevcut admin Lambda ve AI Operasyon Merkezi içinde modüler bir servis sınırı olarak uygulanır. Ayrı, sürekli çalışan bir mikroservis kümesi kurulmaz; bu, 0–1.000 kullanıcı ve tek geliştirici aşamasında gereksiz operasyon maliyeti oluşturur.

- **LLM yönetimi:** Mevcut model allowlist'i, varsayılan model seçimi, kapatma/açma ve optimistic concurrency korunur.
- **Agent görünürlüğü:** Agent kataloğu ve supervisor bağlantısı panelden izlenir; panelden keyfi tool/prompt çalıştırılmaz.
- **Veri yönetimi:** `AI#TRAINING_PENDING` kuyruğu yalnızca açık rızalı, PII maskelenmiş mevcut tur kayıtlarını taşır. Admin paneli maskeli önizleme, kaynak, model ve prompt sürümünü gösterir.
- **İnsan onayı:** Onay, red ve beklet kararları admin yetkisi, gerekçe ve audit kaydı ile uygulanır. Onay otomatik fine-tuning başlatmaz; yalnızca güvenli dışa aktarım kuyruğuna izin verir.
- **Güvenlik:** Ham chain-of-thought, token, kullanıcı kimliği ve gizli sağlayıcı verisi admin yüzeyine çıkarılmaz. Kayıtlar yedi günlük saklama politikası ile sınırlıdır.
- **Kalite kapısı:** Onaylanan kayıtlar golden/evaluation setlerine ayrılmadan ve kalite eşikleri geçilmeden üretim prompt/model ayarı değişmez.

Yeni uç noktalar:

- `GET /admin/ai-training`
- `POST /admin/ai-training/{id}/review`

Release ve kalite yönetimi uç noktaları:

- `GET /admin/ai-release`
- `POST /admin/ai-release/propose`
- `POST /admin/ai-release/publish`
- `POST /admin/ai-release/rollback`

Release adayı; şema geçerliliği `>=99%`, rota geçerliliği `>=95%`, kaynak kapsamı `>=95%`, güvenli karar özeti `>=99%` ve p95 gecikme `<=10 saniye` eşiklerini geçmeden yayınlanamaz. Yayın ve rollback audit kaydı ile optimistic concurrency kullanır. Bu ilk dilimde release kaydı runtime modelini otomatik değiştirmez; LLM yönetimindeki model değişimi ayrı ve bilinçli bir işlemdir.

Bu fazın sonraki adımı gerçek golden evaluation çalıştırma kaydını release adayına bağlamak ve başarılı adayın LLM yönetimindeki kontrollü model değişimine bağlanmasıdır; canlı fine-tuning hâlâ bilinçli olarak kapalıdır.
- **Yerel evaluation durumu:** Mevcut dialogue suite 12 dönüşlü regresyonu koruyor; 100 örnekli golden set ve baseline kalite kapısı eklendi. Gerçek model koşusu AWS erişimi ve kullanım maliyeti gerektirir.
- **Sohbet dayanıklılığı:** Intake/model yanıtı geçersiz olduğunda orchestrator artık exception ile isteği düşürmez; rota veya doğrulanmamış öneri üretmeden güvenli bir tekrar deneme yanıtı ve `fallback` agent durumu döndürür.
- **Terraform doğrulama notu:** Guardrail kaynak tipi provider ile uyumlu hale getirildi; Lambda modülündeki geçersiz iç içe provisioned-concurrency bloğu kaldırıldı. Provisioned concurrency, alias/version tasarımı netleştirilene kadar uygulanmıyor.

## 2. Başarı hedefleri

| Alan | MVP hedefi |
|---|---:|
| Başarılı istek | > %98 |
| 5xx oranı | < %2 |
| p95 cevap süresi | < 15 saniye |
| Uydurma koordinat | 0 |
| Araştırılmamış rota durağı | 0 |
| Cross-user memory leakage | 0 |
| Guardrail bypass | 0 |
| Kullanıcı retry oranı | < %10 |
| Aylık AWS altyapı maliyeti | 0–500 USD |
| Ortalama rota kalite skoru | > 0.85 |

## 3. Fazlar ve öncelik sırası

### Faz 0 — AWS ve çalışma zemini

**Amaç:** Maliyet ve erişim sürprizlerini daha kod yazmadan engellemek.

- [x] AWS CLI, kimlik doğrulama ve aktif bölgeyi doğrula.
- [x] `aws sts get-caller-identity` ile hesap erişimini doğrula.
- [x] AWS Budget mevcutluğunu ve sağlık durumunu doğrula:
  - aylık 250 USD uyarısı,
  - aylık 400 USD uyarısı,
  - aylık 500 USD kritik uyarısı.
- [ ] Activate kredisi bitiş tarihini takvime ekle.
- [x] `eu-central-1` içinde Bedrock model görünürlüğü ve inference profile durumunu doğrula.
- [ ] Dev ve prod ortamlarının kaynak isimlerini ve Terraform state ayrımını doğrula. *(Canlı AWS planı gerekir.)*
- [ ] Tüm Lambda/S3/DynamoDB/CloudWatch kaynaklarına `Environment`, `Service`, `Owner`, `CostCenter` tag’leri ekle. *(Altyapı standardizasyonu; canlı plan öncesi.)*

**Kabul kriteri:** Model çağrısı, Terraform planı ve bütçe alarmı gerçek AWS hesabında doğrulanmış olmalı.

### Faz 1 — Üretim güvenliği

**Amaç:** Kullanıcı verisi ve araç erişimini güvenli hale getirmek.

- [x] Kullanıcı kimliğini yalnızca doğrulanmış Cognito `sub` üzerinden türet.
- [x] İstemciden gelen `userId`, e-posta ve profil alanlarını kimlik kaynağı olarak kullanma.
- [x] AgentCore Memory actor değerini kullanıcı ve memory generation ile izole et.
- [x] Memory kapatma, silme veya düzeltme işlemlerinde generation rotation uygula.
- [x] Prompt, JWT, ham reasoning, e-posta ve hassas koordinatları loglama.
- [x] Memory yazmadan önce yalnızca açıkça doğrulanmış tercihleri kabul et.
- [x] Araştırma sonuçlarını `UNTRUSTED_DATA` olarak modele aktar.
- [x] Gateway tool parametrelerini şehir, ülke, koordinat ve sonuç sayısı açısından sınırla.
- [x] Tool çağrılarını serbest URL veya kullanıcı tarafından verilen kod çalıştırma biçimine dönüştürme.
- [ ] Bedrock Guardrails giriş ve çıkış kapsamını test et. *(Canlı inference smoke testi gerekir.)*

**Kabul kriteri:** Prompt injection, sahte kullanıcı kimliği, cross-user memory ve aşırı tool parametresi testleri başarısız olmalı; yani saldırılar engellenmeli.

### Faz 2 — İki hızlı çalışma modu

**Amaç:** Her isteği pahalı ve uzun multi-agent zincirine göndermemek.

#### Chat modu

- Basit sorularda tek model çağrısı.
- Araştırma yalnızca güncel veya konum bazlı bilgi gerekiyorsa.
- Extended thinking kapalı.
- Hedef süre: 2–5 saniye.

#### Research-route modu

- Query planner ile araştırma ihtiyacını belirle.
- AgentCore Gateway üzerinden `research_places` çağır.
- Yalnızca araştırılmış duraklardan rota üret.
- Route validator ile yapı ve kaynak doğrulaması yap.
- Extended thinking sınırlı bütçeyle kullanılabilir.
- Hedef süre: 8–20 saniye.

- [x] Intake sonucuna göre chat/research-route ayrımı uygula.
- [x] Maksimum research tool call sayısını 3–5 ile sınırla.
- [x] Agent fan-out sayısını en fazla 2 specialist agent ile sınırla.
- [x] Toplam istek timeout’unu 25–30 saniye ile sınırla.

**Kabul kriteri:** Basit sorular tek çağrıyla tamamlanmalı; rota soruları araştırılmamış durak döndürmemeli.

### Faz 3 — Kişisel hafıza ve kullanıcı deneyimi

**Amaç:** Sistem kullanıcıyı tanısın ancak yanlış veya izinsiz öğrenmesin.

Üç veri katmanı korunur:

1. **Kalıcı tercihler:** Kullanıcının açıkça söylediği veya onayladığı tempo, bütçe, ilgi ve seyahat stili.
2. **Geçici trip context:** Destinasyon, gün sayısı, aktif seyahat ve geçici kısıtlar.
3. **Model varsayımı:** Kalıcı hafızaya yazılmaz; kullanıcıdan onay istenir.

- [ ] Yanıtta hangi tercihlerin kullanıldığını gerektiğinde belirt.
- [ ] Profil → Güvenlik → Hatırladıklarım alanından hafıza listeleme, düzeltme, kapatma ve silme sun.
- [ ] “Bunu gelecekte hatırlamamı ister misin?” onayı ekle.
- [x] Memory erişimi başarısızsa yanıtı durdurma; kullanıcıya sınırlı bağlamla devam edildiğini bildir.
- [x] Kullanıcıya “Düşünüyorum…” durumu göster; ham reasoning gösterme.
- [x] Güvenli `decisionSummary` alanını en fazla üç maddede göster.

**Kabul kriteri:** Kullanıcı aynı tercihi sonraki sohbette görebilmeli, silebilmeli ve silme sonrası sistem bu tercihi kullanmamalı.

### Faz 4 — Araştırma ve rota doğrulama

**Amaç:** Güzel görünen ama doğrulanmamış seyahat bilgilerini engellemek.

Her araştırma sonucu en az şu alanları içermeli:

```json
{
  "placeId": "location-id",
  "name": "Yer adı",
  "address": "Adres",
  "lat": 0,
  "lng": 0,
  "source": "amazon-location",
  "checkedAt": "2026-10-07T18:00:00Z",
  "confidence": "high"
}
```

- [x] `evidence-validator` katmanı oluştur.
- [x] Her rota durağı için araştırma kaydı zorunlu olsun.
- [x] Araştırılmamış koordinatları reddet.
- [x] Aynı yeri farklı adlarla iki kez eklemeyi önle.
- [x] Gün sayısı, durak sayısı ve rota sırası için üst sınırlar uygula.
- [x] Fiyat, açıklık, trafik, hava durumu ve müsaitliği doğrulanmadıkça kesin ifade kullanma.
- [x] Research timeout durumunda uydurma rota üretme.
- [x] Kaynak kapsamını ölç: istenen source ID → çözülen source ID eşleşmesi.

**Kabul kriteri:** Her rota durağı doğrulanabilir bir araştırma kaydına bağlanmalı; kaynak yoksa sonuç reddedilmeli veya kısmi cevap verilmelidir.

### Faz 5 — Model ve maliyet yönlendirmesi

**Amaç:** Kaliteyi koruyarak token maliyetini 0–500 USD/ay sınırında tutmak.

| İstek | Önerilen model davranışı | Thinking |
|---|---|---|
| Kapsam/güvenlik kontrolü | Nova Micro/Lite | Kapalı |
| Basit sohbet | Nova Lite veya Haiku | Kapalı |
| Tercih çıkarımı | Nova Lite | Kapalı |
| Araştırılmış rota | Haiku 4.5 | Düşük bütçe |
| Karmaşık rota | Haiku veya ölçümlenmiş güçlü model | Sınırlı |
| Offline evaluation | Batch inference | Gerektiğinde |

İlk sınırlar:

```text
max input tokens: 8.000–12.000
max output tokens: 1.200–2.500
max research calls: 3–5
max specialist agents: 2
simple thinking budget: 256–512
route thinking budget: 768–1.024
```

- [x] Feature, model, kullanıcı ve request bazında token ölç.
- [x] Günlük kullanıcı request/kredi limitleri uygula; token bütçesi model çağrısı ve request meter ile sınırlandırılır.
- [x] Model router kararlarını logla ancak kullanıcı içeriğini loglama.
- [ ] Bedrock Batch API’yi offline evaluation ve gece işlerinde kullan.
- [ ] Provisioned Throughput satın alma.
- [ ] 10x trafik maliyet simülasyonu yap.

**Kabul kriteri:** Her AI isteği tahmini maliyet ve token kullanımıyla ölçülmeli; limit aşımında kontrollü hata dönmeli.

### Faz 6 — Hata yönetimi ve güvenilirlik

**Amaç:** Tek bir alt sistem arızasında tüm sohbetin bozulmasını önlemek.

Önerilen zaman bütçesi:

```text
JWT doğrulama:              300 ms
DynamoDB context:           500 ms
Memory retrieval:           800 ms
Intake model:             2.500 ms
Location research:        5.000 ms
Final answer:            10.000 ms
```

- [x] Her dış çağrıya açık timeout ve abort signal ekle.
- [x] Memory arızasında sınırlı bağlamla devam et.
- [x] Araştırma arızasında uydurma rota verme.
- [x] Final model arızasında kredi iadesi ve idempotency koruması uygula.
- [x] Agent sonuçlarını `completed`, `partial`, `failed`, `timeout` olarak sınıflandır.
- [x] Kritik agent başarısızsa sonucu durdur; yardımcı agent başarısızsa kısmi cevap ver.
- [x] Retry politikasını sınırlı tut; Bedrock/Amazon Location çağrıları `maxAttempts=1` ve açık abort deadline kullanır.
- [x] Aynı `requestId` için çift ücretlendirmeyi engelle.

**Kabul kriteri:** Her hata kullanıcıya anlaşılır bir mesaj ve tekrar deneme davranışı üretmeli; sessiz başarı fallback’i olmamalı.

### Faz 7 — Kalite, evaluation ve öğrenme

**Amaç:** Sistemin gerçekten iyileştiğini ölçmek.

En az 100 örnekli golden set oluştur:

- 25 basit sohbet,
- 25 rota planı,
- 15 belirsiz istek,
- 10 prompt injection,
- 10 güvenlik/acil durum,
- 10 memory correction,
- 5 tool timeout/error.

Her sonuç için ölç:

```json
{
  "answerQuality": 0,
  "routeValidity": 0,
  "sourceCoverage": 0,
  "personalizationScore": 0,
  "safetyScore": 0,
  "latencyMs": 0,
  "estimatedCostUsd": 0
}
```

- [x] Prompt/model değişikliklerinde golden set manifestini ve baseline kalite kapısını çalıştır.
- [x] Route validity, source coverage, güvenli decision summary ve latency metriklerini normalize edip sakla.
- [x] Kullanıcı açık feedback’ini consent kapsamına göre training outbox’a yaz.
- [x] PII maskeleme, duplicate kontrolü ve insan incelemesi olmadan fine-tuning başlatma.
- [x] En az 10.000 kaliteli ve etiketli örnek oluşmadan fine-tuning kararı verme.
- [x] `decisionSummary` ham reasoning içermediğini test et.

**Kabul kriteri:** Her model veya prompt değişikliği önceki baseline’a göre kalite, maliyet ve latency ile karşılaştırılmalı.

### Faz 8 — Gözlemlenebilirlik

Başlangıçta CloudWatch yeterlidir.

- [x] Structured JSON logging uygula.
- [x] CloudWatch log retention:
  - dev: 7 gün,
  - prod: 30 gün.
- [x] Embedded Metric Format ile metrik üret.
- [x] Tek dashboard oluştur:
  - request count,
  - success/error,
  - p95 latency,
  - input/output token,
  - estimated cost,
  - research failure,
  - memory failure,
  - guardrail block.
- [x] Üç AI alarmı için CloudWatch alarm şablonu oluştur:
  1. Error rate > %2,
  2. p95 latency > 15 saniye,
  3. Bedrock/research timeout > %5.
- [x] Her alarm için kısa runbook yaz.
- [ ] X-Ray’i 3+ servisli cross-service debugging ihtiyacı oluşana kadar ertele.

**Kabul kriteri:** Üretimdeki bir hata, kullanıcı içeriğini açığa çıkarmadan CloudWatch üzerinden 30 dakikada teşhis edilebilmeli.

## 4. AgentCore Runtime geçiş kriterleri

Aşağıdaki koşullardan en az üçü gerçekleşmeden tam Runtime geçişi yapılmaz:

- [ ] En az 3 agent aynı session state’i paylaşmaya başladı.
- [ ] Agent oturumları 30 saniyeden uzun sürüyor.
- [ ] Üçüncü taraf OAuth entegrasyonları gerekiyor.
- [ ] Tenant veya kullanıcı bazlı Cedar policy gerekiyor.
- [ ] Lambda orchestrator operasyonel olarak yönetilemeyecek kadar büyüdü.
- [ ] Uzun ömürlü kullanıcı agent session’ı ürün gereksinimi oldu.

Geçiş sırası:

```text
1. Mevcut Lambda orchestrator
2. Gateway tool policy ve gözlemlenebilirlik
3. Yalnızca rota agentını AgentCore Runtime'a taşıma
4. Runtime session ve Memory entegrasyonu
5. Diğer specialist agentları kademeli taşıma
```

## 5. 30 günlük hızlı uygulama planı

### Gün 1–5

- AWS Budget ve model entitlement.
- IAM/Cognito doğrulaması.
- Memory isolation testleri.
- Tool parametre sınırları.
- CloudWatch retention.

### Gün 6–10

- Nova Lite/Haiku kalite karşılaştırması.
- Thinking yalnızca rota modunda.
- Token ve günlük kullanıcı limitleri.
- Feature/model bazlı maliyet metrikleri.

### Gün 11–15

- Evidence validator.
- Kaynak ve `checkedAt` zorunluluğu.
- Research timeout ve kısmi cevap.
- Duplicate place kontrolü.

### Gün 16–20

- 100 örnekli golden set.
- Prompt injection testleri.
- Memory correction/forget testleri.
- Latency ve retry ölçümü.

### Gün 21–25

- Kullanıcıya araştırma durumu.
- Kısmi başarı mesajları.
- Decision summary arayüzü.
- Hatırlanan tercihleri yönetme ekranı.

### Gün 26–30

- %5 test kullanıcı rollout’u.
- %25 kontrollü rollout.
- %100 canlıya geçiş.
- Her aşamada rollback noktası.

## 6. Ertelenen işler

Şimdilik yapılmayacaklar:

- EKS,
- multi-region active-active,
- sürekli çalışan AgentCore Runtime,
- OpenSearch Serverless,
- Provisioned Throughput,
- otomatik fine-tuning,
- 8–10 specialist agent,
- Datadog/New Relic,
- Event Sourcing,
- davranıştan otomatik kalıcı profil çıkarma.

Bu bileşenler ancak kullanıcı sayısı, gelir, SLA, veri hacmi veya operasyonel ihtiyaç tetiklediğinde yeniden değerlendirilir.

## 6.1 Agent Control Plane dilimi

2026-10-10 itibarıyla AI Operations Center agent envanteri DynamoDB-backed hale getirildi:

- `SYSTEM#AI_AGENTS / META` kaydı agent tanımlarını, etkinlik durumunu ve sürümü taşır.
- Agent etkinleştirme/kapatma optimistic concurrency ile yapılır ve admin audit kaydı üretir.
- Supervisor’a bağlı agent'lar tüm kimliği doğrulanmış AI kullanıcılarına açık olarak gösterilir.
- Henüz supervisor akışına bağlı olmayan agent'lar panelde görünür, ancak yanlışlıkla etkinleştirilemez.
- Sürekli worker ve otomatik model eğitimi açıkça kapalı politika olarak gösterilir; bu kayıt gelecekteki RAG ingestion ve EventBridge worker dilimleri için kontrol noktasıdır.

## 7. Günlük operasyon kontrol listesi

- [ ] Hata oranı bütçe ve alarm sınırları içinde mi?
- [ ] p95 latency hedef altında mı?
- [ ] Token/request maliyeti artıyor mu?
- [ ] Research başarısızlık oranı artıyor mu?
- [ ] Memory deletion job’ları tamamlanıyor mu?
- [ ] Guardrail block oranında anomali var mı?
- [ ] Kullanıcı retry oranı artıyor mu?
- [ ] Training outbox yalnızca consent’li kayıt içeriyor mu?
- [ ] Son deploy rollback gerektiriyor mu?

### Doğrulama kanıtı (2026-10-07)

- Uygulama regression ve backend testleri başarılı.
- AI reliability, memory, AgentCore Gateway ve FinOps odaklı testler başarılı.
- TypeScript ve monitoring typecheck başarılı.
- Monitoring/evaluation JSON şemaları parse edilebilir.
- `terraform fmt -check` AI alarm değişiklikleri için başarılı.
- `terraform validate` başarılı.
- AWS CLI kimliği `996270854731`, aktif bölge `eu-central-1` olarak doğrulandı.
- Claude Haiku 4.5 foundation model durumu `ACTIVE`; EU inference profile durumu `ACTIVE` olarak doğrulandı.
- Mevcut AWS bütçeleri sağlıklı; canlı notification tetikleme testi yapılmadı.
- Golden evaluation manifesti 100 örnek ve kategori dağılımı açısından doğrulanabiliyor.
- Golden baseline karşılaştırması pass rate, p95 latency, source coverage, route validity ve güvenli decision summary oranını kapsıyor.
- Yerel AI operasyonel sağlık kontrolü 9/9 katmanda başarılı; hoisted TypeScript bağımlılığı için health-check fallback'i düzeltildi.
- Golden evaluator'ın injection, safety, memory correction ve tool-failure beklentileri mock sözleşme testiyle 4/4 doğrulandı.
- Canlı smoke testleri için güvenli preflight komutu eklendi; eksik AgentCore/Guardrail değerlerini gizli değerleri yazdırmadan raporluyor.
- Preflight, AgentCore Gateway, Memory/Guardrail ve Travel RAG Terraform state output adlarını da değerleri açığa çıkarmadan doğruluyor.
- Mevcut Terraform output'undan alınan değerlerle read-only AgentCore Gateway smoke testi başarılı: 22 doğrulanmış yer, 2108 ms.
- Bedrock Guardrail Terraform output'u ile durum `READY`, sürüm `1` olarak doğrulandı.
- Yerel roadmap maddeleri kod ve test sözleşmeleriyle senkronize edildi; canlı AWS gerektiren maddeler açıkça işaretlendi.
- `decisionSummary` üretim çıkışında reasoning sızıntısı için kod seviyesinde filtre ve regresyon testi eklendi.
- 2026-10-09 yerel Terraform biçimlendirme ve doğrulama yeniden çalıştırıldı; `fmt -check` ve `validate` başarılı.
- Onaylı canlı pencerede Gateway read-only smoke tekrar başarılı oldu: 22 doğrulanmış yer, yaklaşık 2.1 saniye.
- Memory canlı smoke testinde geçici kullanıcı oluşturma, varsayılan opt-out ve cross-user isolation başarılı; ilk ücretli AI çağrısı kontrollü `503 AI_RESULT_UNCONFIRMED` verdi ve temizlik tamamlandı. Kalan purge/idempotency kontrolleri başarılı kabul edilmedi.
- Kişiselleştirilmiş rota dilimi eklendi: sakin/klasik/keşif modları yalnızca mevcut isteği etkiliyor; route mode Bedrock bağlamına taşınıyor ve kalıcı tercihlere yazılmıyor. Kalıcı hafıza arayüzü bu ayrımı kullanıcıya açıkça belirtiyor.
- 2026-10-09 Control Plane canlı dağıtımı tamamlandı: admin/AI Lambda paketleri ve AI eğitim/release API route'ları `eu-central-1` production hesabına yayımlandı; Terraform uygulaması sonrasında reconciliation planı `No changes` verdi.
- 2026-10-09 web export production S3 bucket'ına yüklendi ve CloudFront invalidation başlatıldı (`INS96E1GKB4VQYOM2RO29V10D`); public web `200`, admin API kimliksiz erişim `401`, admin CORS preflight `200` döndü.
- Canlı admin panelinin yetkili kullanıcı akışı henüz doğrulanmadı; bunun için Cognito `mapsbridge-admin` üyesiyle tarayıcı smoke testi gerekiyor. AgentCore/Guardrail preflight'ı gerekli canlı environment değerleri eksik olduğu için ayrıca gated durumda.

## 8. Nihai karar

Bu proje için doğru üretim stratejisi:

> **Önce mevcut Lambda + Bedrock + AgentCore Memory/Gateway hibritini ölçülebilir ve güvenli hale getir; sonra gerçek ihtiyaç oluştuğunda AgentCore Runtime’a küçük bir pilotla geç.**

Bu yaklaşım, tek geliştiricinin operasyon yükünü düşük tutar, AWS kredilerini kontrollü kullanır, 10x trafik artışında yeniden yazım ihtiyacını azaltır ve kullanıcıya hızlı, kişisel ve doğrulanabilir cevap verir.
