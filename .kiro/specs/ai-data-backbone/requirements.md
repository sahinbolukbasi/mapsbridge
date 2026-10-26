# Requirements Document

## Introduction

MapsBridge AI asistanının "doğru yanıt vermesi" için güvenilir bir veri omurgası gerekir. Canlı doğrulama (Bedrock + supervisor smoke test) gösterdi ki:
- AI çekirdeği çalışıyor (rota üretimi, hafıza, netleştirme — hepsi kanıtlandı)
- ANCAK yanıtlar doğrulanmış veriye değil, modelin kendi eğitim bilgisine dayanıyor (`citedSourceIds: []` — grounding devreye girmiyor)
- Doğrulanmış corpus çok küçük (5 kayıt: Tokyo/İstanbul/Roma/Lima) ve çoğu şehir için veri yok
- Maliyet config'i suboptimal (pahalı Sonnet default, inference profile tutarsız)

Bu spec, AI'nın en düşük maliyetle en doğru yanıtı vermesi için veri omurgasını kurar: grounding'i güçlendirir, corpus'u genişletir, maliyet-optimal model kademeleri ayarlar, RAG bağlantısını doğrular ve agent/eğitim pipeline'larının çalıştığını kanıtlar.

**Kapsam dışı:** Canlı backend deploy'u (farklı AWS hesabı `865369794421`, erişim yok); yeni AWS kaynağı provisioning (RAG S3 Vectors gerçek deploy'u — kod hazır, doğrulanır). Bu spec kodu+config+corpus'u "deploy edilince doğru+ucuz çalışır" durumuna getirir ve local/Bedrock ile kanıtlar.

## Glossary

- **Grounding:** AI yanıtının doğrulanmış kaynak verisine (corpus/RAG) dayandırılması; uydurmayı (halüsinasyon) azaltır.
- **Corpus:** `data/travel/*.json` içindeki insan-doğrulanmış seyahat bilgisi kayıtları.
- **RAG (Retrieval-Augmented Generation):** Bedrock Knowledge Base (S3 Vectors) üzerinden ilgili belgeleri çekip modele bağlam olarak verme.
- **Inference profile:** Bedrock modelini bölge-uyumlu çağırmak için gereken ARN (`eu.amazon.nova-micro-v1:0` gibi).
- **Model kademesi:** Ucuz model (Nova Micro) basit işler için, kaliteli model (Claude Haiku) rota üretimi için.
- **AgentCore memory:** Kullanıcı tercihlerini/özetlerini turlar arası saklayan Bedrock hafıza servisi.

## Requirements

### Requirement 1: Maliyet-Optimal Model Kademeleri

**User Story:** Bir ürün sahibi olarak, AI'nın en düşük maliyetle çalışmasını istiyorum; böylece bir AI chat ürünü olarak sürdürülebilir birim maliyetimiz olur.

#### Acceptance Criteria

1. WHEN basit bir işlem yapılırsa (intake/clarify/tercih çıkarımı) THEN en ucuz model (Nova Micro inference profile) kullanılmalıdır.
2. WHEN kaliteli üretim gerekirse (rota planlama) THEN Claude Haiku kademesi kullanılmalıdır.
3. WHEN model ID yapılandırıldığında THEN düz model ID değil, bölge-uyumlu inference profile (`eu.*`) kullanılmalıdır.
4. WHEN model config değiştirildiğinde THEN canlı Bedrock çağrısıyla her kademenin gerçekten çalıştığı doğrulanmalıdır.

### Requirement 2: Grounding ve Kaynak Doğrulama

**User Story:** Bir kullanıcı olarak, AI'nın bana uydurma değil doğrulanmış bilgi vermesini istiyorum; böylece seyahat kararlarıma güvenebilirim.

#### Acceptance Criteria

1. WHEN corpus'ta ilgili veri VARSA THEN yanıt o kaynağa dayandırılmalı AND `citedSourceIds` dolu olmalıdır.
2. WHEN corpus'ta veri YOKSA THEN yanıt, doğrulanmamış bilgi için uygun bir uyarı içermeli (fiyat/saat doğrulaması gerektiğini belirtmeli).
3. WHEN kritik bilgi (vize, güvenlik) sorulursa THEN yalnızca doğrulanmış kaynaklardan (entry-rules, emergency) yanıt verilmelidir.
4. WHEN grounding doğrulaması yapıldığında THEN `grounding-validator`/`evidence-validator` yanıtı kaynaklara karşı kontrol etmelidir.

### Requirement 3: Corpus Genişletme

**User Story:** Bir ürün sahibi olarak, daha fazla şehir için doğrulanmış veri olmasını istiyorum; böylece AI daha geniş kapsamda doğru yanıt verir.

#### Acceptance Criteria

1. WHEN corpus genişletildiğinde THEN pilot şehirler (en az İstanbul, Roma, Tokyo, Lima, New York) için yemek/ulaşım/genel kategorilerinde doğrulanmış kayıtlar olmalıdır.
2. WHEN yeni corpus kaydı eklendiğinde THEN her kayıt şema-uyumlu olmalı (id, city, country, text, checked_at, valid_until, approved, rights).
3. WHEN corpus kaydı telif açısından değerlendirildiğinde THEN kaynak metni birebir kopyalanmamalı, özgün özet olmalıdır (rights alanı bunu belgeler).
4. WHEN corpus yüklendiğinde THEN `bundledEvidence` bu kayıtları doğru şehir/kategori için getirebilmelidir.

### Requirement 4: RAG Bağlantı Doğrulaması

**User Story:** Bir operatör olarak, RAG (Bedrock Knowledge Base) altyapısının doğru yapılandırıldığını bilmek istiyorum; böylece corpus büyüdüğünde vector retrieval devreye girer.

#### Acceptance Criteria

1. WHEN RAG kodu incelendiğinde THEN retrieval fonksiyonu vector DB'den sonuç alıp `TravelEvidence` formatına dönüştürebilmelidir.
2. WHEN vector retrieval kullanılamazsa THEN sistem `bundledEvidence` fallback'ine düşmeli AND yanıt üretmeye devam etmelidir.
3. WHEN RAG config doğrulandığında THEN `verify-travel-rag` scripti çalışmalı ve KB durumunu raporlamalıdır.
4. WHILE RAG doğrulanırken canlı AWS altyapısı değiştirilmemelidir (yalnızca kod/config doğrulama).

### Requirement 5: Agent ve Hafıza Sistemi Doğrulaması

**User Story:** Bir kullanıcı olarak, AI'nın beni tanımasını ve konuşma boyunca tercihleri hatırlamasını istiyorum; böylece kişiselleştirilmiş seyahat deneyimi alırım.

#### Acceptance Criteria

1. WHEN çok turlu konuşma yapıldığında THEN önceki tercihler (ilgi alanları, tempo, bütçe) sonraki turlarda hatırlanmalıdır.
2. WHEN admin panelinden bir agent (context/transit/discovery/emergency) kapatıldığında THEN o agent çalışmamalı, diğerleri çalışmaya devam etmelidir.
3. WHEN AI control (model/agent ayarları) okunduğunda THEN DynamoDB'den gelen ayarlar doğru uygulanmalıdır.
4. WHEN hafıza/agent doğrulandığında THEN canlı bir çok-turlu senaryoyla kanıtlanmalıdır.

### Requirement 6: Uçtan Uca Doğrulama ve Maliyet Raporu

**User Story:** Bir ürün sahibi olarak, tüm AI sisteminin çalıştığını ve birim maliyetini görmek istiyorum.

#### Acceptance Criteria

1. WHEN tüm değişiklikler bittiğinde THEN `verify-ai-model` + grounding testi canlı Bedrock ile geçmelidir.
2. WHEN bir rota üretildiğinde THEN token kullanımı ve tahmini maliyet raporlanmalıdır.
3. WHEN `npm run test:services` çalıştırıldığında THEN AI servis testleri 0 başarısızlıkla geçmelidir.
4. WHEN sistem doğrulandığında THEN sonuçlar `docs/development/audit-status.md`'ye kaydedilmelidir.
