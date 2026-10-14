# AWS Bedrock AgentCore Seyahat Asistanı: Mimari, Öğeler Envanteri ve Operasyonel Sağlık Rehberi

> 27 Eylül 2026: Bu belge hedef mimari ve eski envanter içerir. Canlı akış Lambda + Bedrock Converse + AgentCore Memory + S3 Vectors kullanır. Runtime/Gateway ve OpenSearch dağıtılmış kabul edilmemelidir. Güncel işletim kaydı: [docs/ai/memory.md](../ai/memory.md).

Bu doküman, MapsBridge seyahat platformu altında çalışan yapay zekâ asistanının AWS bulut mimarisini, sistem içinde yer alan tüm bileşenlerin (ajanlar, araçlar, şemalar, altyapı kaynakları) ayrıntılı envanterini ve sistemin sağlıklı çalışıp çalışmadığını denetleme/işletme yöntemlerini eksiksiz açıklar.

---

## 1. AWS Bulut Altyapı Mimarisi

Sistem, **AWS Bedrock AgentCore** desenine uygun, sunucusuz (serverless), olay güdümlü ve FinOps odaklı bir mimari üzerinde koşar.

```
                              ┌──────────────────────────────────────────────┐
                              │           Kullanıcı Arayüzü (Web SPA)         │
                              │     Next.js 16 (Static Export, Vanilla CSS)   │
                              └──────────────────────┬───────────────────────┘
                                                     │ HTTPS / WSS
                                                     ▼
                              ┌──────────────────────────────────────────────┐
                              │            Amazon API Gateway (v2)           │
                              │           HTTP API + JWT Yetkilendirme        │
                              └──────────────────────┬───────────────────────┘
                                                     │
                                                     ▼
                              ┌──────────────────────────────────────────────┐
                              │          AWS Lambda (Node.js 22, ARM64)      │
                              │       Chat / Planning / Routes Controller    │
                              └───────┬──────────────────────────────┬───────┘
                                      │                              │
             ┌────────────────────────┴────────┐                     │
             ▼                                 ▼                     ▼
┌───────────────────────────┐    ┌─────────────────────────┐  ┌─────────────────────────┐
│     Amazon DynamoDB       │    │     AWS Bedrock LLMs    │  │ AWS Bedrock Knowledge   │
│  Tek Tablo (Single-Table) │    │ Claude 3.5 Haiku (Hızlı)│  │ Base (RAG)              │
│ - Oturum & Kısa Bellek    │    │ Claude 3.5 Sonnet (Plan)│  │ - OpenSearch Serverless │
│ - TripProfile Durumu      │    │ Titan Embeddings v2     │  │ - Vektör Arama & HNSW   │
│ - Günlük Kota (AI_DAY#)   │    └─────────────┬───────────┘  │ - S3 & SQS Pipeline     │
└───────────────────────────┘                  │              └─────────────────────────┘
                                               ▼
                              ┌──────────────────────────────────────────────┐
                              │    Bedrock Guardrails & Güvenlik Katmanı     │
                              │ - PII Maskeleme (TCKN, SSN, Kart, Tel, E-p) │
                              │ - Prompt Injection & Zararlı Konu Engeli     │
                              │ - Hallucination (Grounding) Denetimi        │
                              └──────────────────────┬───────────────────────┘
                                                     │
                                                     ▼
                              ┌──────────────────────────────────────────────┐
                              │       Amazon CloudWatch & AWS Budgets        │
                              │ - Multi-Agent FinOps Dashboard               │
                              │ - $0.15 / Plan Maliyet Eşik Alarmı           │
                              │ - p50 / p95 Gecikme & Hata Takibi           │
                              └──────────────────────────────────────────────┘
```

### 1.1. Bulut Katmanları ve Görevleri

| Bulut Hizmeti | Rolü ve Yapılandırması | İlgili Terraform / Kod Dosyası |
|---|---|---|
| **Amazon Bedrock (Converse API)** | **Temel Zeka:** `eu.anthropic.claude-haiku-4-5-20251001-v1:0` (Concierge ve alt ajanlar) ve `eu.anthropic.claude-sonnet-4-5` (Nihai gün gün rota sentezi). | [infra/terraform/ai.tf](../../infra/terraform/ai.tf) |
| **Amazon Bedrock Knowledge Base** | **Şehir Bilgi Bankası (RAG):** Titan Embeddings Text v2 (`amazon.titan-embed-text-v2:0`) ile 1024 boyutlu vektörleştirme. | [infra/terraform/ai.tf](../../infra/terraform/ai.tf) |
| **OpenSearch Serverless (AOSS)** | **Vektör Veri Tabanı:** Düşük gecikmeli HNSW vektör indeksi (`travel-index`), şehir ve kategori filtreleme. | `var.opensearch_collection_arn` |
| **Amazon S3 & SQS Pipeline** | **Veri Hattı:** S3 bucket (`travel-kb-source`), SQS kuyruğu ve Lambda normalizasyonu ile sadece değişen (hash atlama) dosyalar indekslenir. | [infra/terraform/pipeline.tf](../../infra/terraform/pipeline.tf) |
| **Amazon DynamoDB** | **Oturum, Hafıza ve Kota:** Tek tablo mimarisi. Kullanıcı profili, seyahat bağlamı (`TRIP#<id>`) ve günlük limitler (`AI_DAY#<date>`) atomik transact ile tutulur. | [infra/terraform/main.tf](../../infra/terraform/main.tf) |
| **Amazon Bedrock Guardrails** | **Güvenlik Kalkanı:** Hassas kişisel verileri (TCKN, SSN, Kredi Kartı vb.) maskeler, prompt injection saldırılarını bloklar, dayanaksız iddiaları yakalar. | [infra/terraform/guardrails.tf](../../infra/terraform/guardrails.tf) |
| **CloudWatch & Budgets** | **FinOps ve Gözlemlenebilirlik:** Plan başına maliyet ($0.15 hedefi), alt ajan gecikmeleri (p50/p95), token tüketimi ve bütçe aşım alarmları (%80, %100). | [infra/terraform/finops.tf](../../infra/terraform/finops.tf), [finops-dashboard.tf](../../infra/terraform/finops-dashboard.tf) |

---

## 2. Sistem İçindeki Tüm Öğelerin Envanteri

Sistem, katı sorumluluk ayrımı (Separation of Concerns) ilkesiyle çalışan modüllerden oluşur:

### 2.1. Ajanlar (Agents)

1. **Concierge Ajanı ([planning.ts](../../apps/web/app/lib/ai/planning.ts)):**
   - Kullanıcıyı seyahat sorgusuyla karşılar.
   - Form doldurtmaz; tek seferde en fazla tek, samimi bir soru sorar.
   - Hızlı yanıt için 2-4 adet tek dokunuşluk hazır buton önerisi üretir.
   - `calculateTripCompleteness` ile profil tamlığını (0.00 - 1.00) puanlar; puan >= 0.70 olunca planlamayı başlatır.
2. **Yemek Ajanı ([food-agent.ts](../../apps/web/app/lib/ai/sub-agents/food-agent.ts)):**
   - 3. dalga kahveciler, yerel imza lezzetler ve bütçeye uygun mekanları seçer.
3. **Konaklama Ajanı ([lodging-agent.ts](../../apps/web/app/lib/ai/sub-agents/lodging-agent.ts)):**
   - Güvenli, metroya yakın, bütçeye uygun mahalle ve otel/daire tavsiyeleri sunar.
4. **Spor & Park Ajanı ([sports-agent.ts](../../apps/web/app/lib/ai/sub-agents/sports-agent.ts)):**
   - Şehir içi koşu rotaları (Central Park Reservoir vb.), bisiklet hatları, açık hava spor alanları üretir.
5. **Uçuş Ajanı ([flight-agent.ts](../../apps/web/app/lib/ai/sub-agents/flight-agent.ts)):**
   - Hedef şehre direkt/aktarmalı uçuş opsiyonlarını ve havalimanı transferlerini analiz eder.
6. **Araç Kiralama Ajanı ([car-rental-agent.ts](../../apps/web/app/lib/ai/sub-agents/car-rental-agent.ts)):**
   - Şehirde araba gerekip gerekmediğini denetler (ör. Manhattan'da park ve trafik nedeniyle metro önerir).
7. **Şehir İçi Ulaşım Ajanı ([city-transit-agent.ts](../../apps/web/app/lib/ai/sub-agents/city-transit-agent.ts)):**
   - Metro hatları, temassız kartlar (OMNY vb.), taksi ve yürüyüş mantığını kurgular.
8. **Şehir İstihbarat & Kültür Ajanı ([city-intel-agent.ts](../../apps/web/app/lib/ai/sub-agents/city-intel-agent.ts)):**
   - Müze rezervasyon günleri, bahşiş kuralları (ABD %18-22), priz tipleri ve SIM kart rehberliğini sağlar.
9. **Acil Durum Ajanı ([emergency-agent.ts](../../apps/web/app/lib/ai/sub-agents/emergency-agent.ts)):**
   - **Deterministik İlk Satır:** Yanıtın ilk satırında yerel acil numarayı (ABD 911, TR/AB 112) verir.
   - Türkevi New York Başkonsolosluğu (825 3rd Ave, +1 646 560 2100) ve 7/24 nöbetçi konsolosluk hattını sunar.
   - Çalıntı/kayıp pasaport durumunda NYPD tutanağı ve Seyahat Belgesi adımlarını tarif eder.
   - Tıbbi/hukuki tanı koymaz; en yakın Urgent Care ve resmi baro listelerine yönlendirir.
10. **Planlayıcı ve Süpervizör ([supervisor.ts](../../apps/web/app/lib/ai/supervisor.ts)):**
    - Tüm uzman ajan çıktısını toplayıp gün gün saatli plana (`schemas/trip-plan.json`) dönüştürür.

---

### 2.2. Doğrulama ve Yönetim Motorları

- **Fizibilite Motoru ([feasibility.ts](../../apps/web/app/lib/ai/feasibility.ts)):**
  - Zaman çakışmalarını denetler.
  - Bloklar arası transit sürelerini kontrol eder.
  - Günlük toplam sürenin 8.5 saati aşması durumunda aşırı yük uyarısı verir.
  - Açık hava aktivitelerinde yağmur alternatifi zorunluluğunu inceler.
  - Tahmini maliyetin kullanıcı bütçesini aşıp aşmadığını hesaplar.
- **Akıllı Router ([agent-router.ts](../../apps/web/app/lib/ai/agent-router.ts)):**
  - Kullanıcının ilgi duymadığı alt ajanları tetiklemez (FinOps token koruması). Örneğin kahve/gurme ilgisi yoksa yemek ajanını atlayarak doğrudan temel rota çıkarır.
- **Çok Kademeli Önbellek ([cache-layer.ts](../../apps/web/app/lib/ai/cache-layer.ts)):**
  - Hava Durumu: 15 dakika TTL
  - Fiyatlar: 5 dakika TTL
  - Mekan Bilgileri: 24 saat TTL
  - Taban Rota Şablonları: 7 gün TTL
- **Yol Modu Motoru ([trip-mode.ts](../../apps/web/app/lib/ai/trip-mode.ts)):**
  - Gezi sırasında kullanıcının bulunduğu saate göre aktif bloğu ve sonraki durağı takip eder, canlı hava uyarılarında rotayı dinamik günceller.
- **Öğrenme Döngüsü & PII-Free Geri Bildirim ([learning-feedback.ts](../../apps/web/app/lib/ai/learning-feedback.ts)):**
  - Model fine-tuning kesinlikle yapılmaz. Kullanıcıların beğenip planında tuttuğu mekanlar PII'dan arındırılarak tuzlanmış hash kimlikleriyle anonim toplanır.
  - [weekly-learning-batch.cjs](../../infra/scripts/weekly-learning-batch.cjs) haftalık batch işiyle bu sinyalleri derleyip Knowledge Base'e ekler.
- **FinOps Hesaplayıcı & Dashboard ([finops-dashboard.ts](../../apps/web/app/lib/ai/finops-dashboard.ts)):**
  - Her planın toplam girdi/çıktı tokenlarını ve alt ajan maliyet kırılımını hesaplar. Plan başına $0.15 hedef bütçesini doğrular.

---

### 2.3. Veri Sözleşmeleri ve Şemalar (JSON Schemas)

1. [schemas/trip-profile.json](../../schemas/trip-profile.json): Kullanıcı seyahat profili, ilgi alanları, bütçe ve kısıtlar şeması.
2. [schemas/trip-plan.json](../../schemas/trip-plan.json): Gün gün zaman blokları, mekan ID'leri, transit ve bütçe dökümünü içeren nihai plan şeması.
3. [schemas/kb-metadata.json](../../schemas/kb-metadata.json): Knowledge Base belgelerinin şehir, kategori, mahalle, kaynak ve son doğrulama tarihi meta veri standardı.
4. [schemas/learning-signal.json](../../schemas/learning-signal.json): PII içermeyen, hafta kodlu (`YYYY-Www`) kullanıcı geri bildirim sinyali şeması.

---

## 3. Sistemin Sağlıklı Çalışıp Çalışmadığının Doğrulanması

Sistemin üretimde veya yerel ortamda sağlıklı çalıştığını teyit etmek için üç aşamalı bir denetim süreci uygulanır:

### 3.1. Operasyonel Eşik Değerleri (SLO / SLA)

| Metrik | İdeal Değer | Uyarı Eşiği | Kritik Arıza Eşiği |
|---|---|---|---|
| **Concierge Yanıt Süresi (p50)** | < 600 ms | > 1500 ms | > 3000 ms |
| **Nihai Plan Sentez Süresi (p95)** | < 2500 ms | > 4000 ms | > 7000 ms |
| **Ajan Hata Oranı** | %0.0 | > %1.0 | > %5.0 |
| **Plan Başına Maliyet** | $0.02 - $0.05 | > $0.10 | > $0.15 |
| **Profil Tamlık Barajı** | >= 0.70 | < 0.70 | Eksik hedef/süre ile plan başlatma |
| **Acil Durum Determinizmi** | İlk satırda 911/112 | Numara metin ortasında | Acil numaranın yer almaması |
| **PII Sızıntısı** | %0 (Tam koruma) | Herhangi bir maskelenmemiş veri | Hassas verinin LLM'e gitmesi |

---

### 3.2. Sağlık Doğrulama Yöntemleri

#### Yöntem 1: Tek Komutla Bütünleşik Sistem Sağlık Taraması
Proje bünyesinde bulunan otomatik sağlık teşhis komutu çalıştırılır:
```bash
node infra/scripts/verify-ai-health.cjs
```
Bu komut sırasıyla şu katmanları saniyeler içinde dener:
1. Şema bütünlüğü (TripProfile, TripPlan, KB-Metadata, LearningSignal)
2. Concierge ve Completeness hesaplayıcı
3. 8 Uzman alt ajanın sözleşmeleri ve yanıt yapıları
4. Router'ın FinOps token tasarruf kuralı
5. Cache mekanizmasının TTL aşım davranışı
6. Feasibility motorunun zaman çakışması ve bütçe tespiti
7. Acil durum ajanının 911 determinizmi ve konsolosluk rehberi
8. Guardrails PII maskeleme ve prompt injection savunması
9. FinOps plan başına maliyet hesaplayıcısı ($0.15 hedef kontrolü)

#### Yöntem 2: Bütünleşik Test Takımı (96 Test)
```bash
cd apps/web && npm test
```
*Beklenen Sonuç:* `tests 96, pass 96, fail 0` olmalıdır.

#### Yöntem 3: TypeScript Tip Bütünlüğü
```bash
cd apps/web && npm run typecheck
```
*Beklenen Sonuç:* Sıfır hata ile derleme tamamlanmalıdır.

#### Yöntem 4: Canlı AWS Bedrock ve RAG Testi
Gerçek AWS ortamı yapılandırıldığında:
```bash
node infra/scripts/verify-travel-rag.cjs
```
veya doğrudan model kontrolü:
```bash
node infra/scripts/verify-ai-model.cjs
```

---

### 3.3. Arıza Teşhis ve Çözüm Matrisi (Troubleshooting)

| Belirti / Hata | Olası Kök Neden | Çözüm Adımı |
|---|---|---|
| **Kullanıcı tek soru yerine anketle karşılaşıyor** | `generateConciergeQuestion` fonksiyonu birden fazla eksik alanı tek seferde sormaya çalışıyor. | `planning.ts` içindeki tek soru kuralını denetleyin. Sadece ilk eksik kritik alan sorulmalıdır. |
| **Plan onaylanmıyor (Invalid Plan)** | Zaman çakışması veya 8.5 saati aşan aşırı yük. | `feasibility.ts` loglarını inceleyin; blok başlangıç ve bitiş saatleri ile transit sürelerini kontrol edin. |
| **Beklenmedik yüksek token maliyeti** | Akıllı Router devre dışı kalmış veya tüm alt ajanları her seferinde çağırıyor. | `agent-router.ts`'nin `routeSubAgents` fonksiyonunu inceleyin. İlgi alanı dışı ajanların filtrelendiğini doğrulayın. |
| **Acil durumda 911 yerine tavsiye metni çıkıyor** | Acil durum agent'ı LLM serbest metnine bırakılmış. | `emergency-agent.ts` içindeki `getDeterministicEmergencyLine` kuralını kontrol edin. İlk satır deterministik olmalıdır. |
| **Vektör RAG boş sonuç dönüyor** | OpenSearch Serverless koleksiyonu erişim yetkisi veya metadata filtresi hatalı. | `infra/terraform/ai.tf` IAM rolü `aoss:APIAccessAll` iznini ve `data/travel/new-york.json` meta veri alanlarını doğrulayın. |
| **Haftalık öğrenme verisi KB'ye gitmiyor** | Sinyal dosyası bulunamıyor veya PII maskeleme reddedildi. | `infra/scripts/weekly-learning-batch.cjs` betiğini çalıştırın; girdi JSON dosyasının geçerli olduğunu teyit edin. |
