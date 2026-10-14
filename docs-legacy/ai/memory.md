# Kişisel seyahat hafızası — uygulama ve işletim

27 Eylül 2026. [Tasarım planının](../plans/ai-memory-fine-tuning.md) uygulama kaydı. Canlı kontrol sonuçları `verification/ai-memory-live.json` dosyasına yazılır. Eğitim yapılmış bir model veya AgentCore Runtime/Gateway dağıtımı bu teslimata dahil değildir.

## Uygulanan akış

Cognito `GetUser` doğrulaması başarısız olduğunda AI uç noktaları 401 döner. Düz e-posta, çözümlenmiş fakat doğrulanmamış JWT ve rastgele token kabul edilmez. Kullanıcının gönderdiği `profileContext` yetkili profil kaynağı değildir. Konum ve manifesto dahil etkili girdiler işlem fingerprint'ine dahildir.

AI Lambda, onay durumunu tutarlı okuyup aynı sürümün işlem sonunda hâlâ geçerli olduğunu DynamoDB transaction içinde kontrol eder. Kredi, yanıt, sohbet, açık tercih ve hafıza outbox kaydı aynı transaction'da tamamlanır. Worker yalnız başarılı işlemleri AgentCore'a aktarır; hata veya tekrar kredi/yeni event üretmez. `actorId` doğrulanmış `sub` ve hafıza neslinin SHA-256 özetinden, `sessionId` sohbet kimliğinin özetinden türetilir. Ortak servis rolü kaynak seviyesinde yetkilidir; kullanıcı izolasyonunu sunucu ve nesil kontrolü sağlar.

Hafıza varsayılan olarak kapalıdır. Açık kullanıcı tercihleri DynamoDB'de kesin kayıt olarak kalır. AgentCore'a ham sohbet, e-posta veya koordinat gönderilmez; sınırlı tercihler ve seyahat hedefi/gün sayısı gönderilir. Model öncesinde en fazla beş özet alınır; 800 ms bütçe ve hata halinde hafızasız devam uygulanır. Kişisel özet metni 1.500 UTF-8 baytla sınırlanır. Dinamik model mesajları toplam 32.000 UTF-8 baytı aşarsa eski mesajlar çıkarılır; tek güncel istek sınırı aşarsa model çağrısı reddedilir. Bu sınırlar model tokenizer'ı ile ölçülmüş 8.000 token garantisi değildir.

Namespace'ler `/users/{actorId}/preferences/` ve `/users/{actorId}/summaries/{sessionId}/`. Tercih stratejisi etkin; uygulama kanonik tercihi DynamoDB'den, geçmiş özetleri AgentCore'dan okur. Çıkarım asenkrondur; hemen sonraki yanıtta özet bulunacağı garanti edilmez. Hafıza, RAG ve araç çıktıları sistem talimatı olarak kullanılmaz. RAG şehir filtresi Roma/Rome ve şehir-ülke yazımını kanonik şehir adına dönüştürür. Yönetilen Bedrock Guardrail, prompt saldırıları ve ödeme kartı verisi için ek kontrol sağlar.

## Kullanıcı kontrolü ve silme

Profil → Güvenlik → **Hatırladıklarım** bölümünde açma/kapatma, dört desteklenen tercihi düzenleme/silme, özet önizlemesi ve tüm AI hafızasını silme vardır. Tercih düzeltmesi tüm eski çıkarılmış özetleri de geçersiz kılar. Serbest metinli özet düzenleme veya bütün kayıtları sayfalayarak görüntüleme henüz yoktur; API beş sonuçluk önizleme sunar.

| Uç nokta | İşlem |
|---|---|
| `GET /ai/memory` | Onay, açık tercihler, özet önizlemesi ve silme durumu |
| `PATCH /ai/memory` | `{ "enabled": true/false }` |
| `PATCH /ai/memory/{key}` | `{ "value": ... }`; pace, budget, travelStyle, interests |
| `DELETE /ai/memory/{key}` | Tek açık tercihi kaldır |
| `DELETE /ai/memory` | `{ "scope": "preferences" veya "all" }`; 202 |
| `GET /ai/memory/deletion-status` | Arka plan silme durumu |

Kapatma/silme/düzeltme eski actor neslini hemen kullanım dışına çıkarır. Eski event ve iki namespace altındaki kayıtlar worker ile silinir. `scope:all` ayrıca eski AI_CHAT kayıtlarını ve mali makbuzların yanıt içeriğini siler; finansal hesap hareketlerini korur. Silme öncesi makbuzlar tekrar oynatılamaz. Gecikmiş çıkarımlar için emekli actor 31 gün boyunca saatlik taranır; bu sürede durum `pending` kalır. Yeni sohbetler zaman koşullarıyla korunur. Yeni sohbet kayıtları ve ham AgentCore event'leri 30 gün; özetler saatlik temizlikle 180 gün tutulur. DynamoDB TTL asenkron işler. Finansal makbuzdaki yanıtın 30 günlük otomatik TTL'si yoktur; tam silme talebinde temizlenir. Yedeklerin saklama yaşam döngüsü ayrı işler.

## Dağıtım ve kontrol

`infra/ai-memory` ayrı Terraform state ve AWS provider 6 kullanır. Memory, stratejiler, ayrı DynamoDB tablosu, Streams worker, hata kuyruğu, saatlik uzlaştırma, kontrol API'si, Guardrail ve dashboard bu state'e aittir. Mevcut AI Lambda `infra/admin-runtime` state'inde kalır. Hesabın ayrılmış Lambda kapasitesi yetersiz olduğundan fonksiyonlar ortak kapasite kullanır. Büyük kullanıcı hacminde tarama süresi ve concurrency kotası yeniden değerlendirilmelidir; worker MVP için saatlik tablo taraması yapar.

```sh
node infra/scripts/build-ai-memory.cjs
terraform -chdir=infra/ai-memory init
terraform -chdir=infra/ai-memory plan -var-file=terraform.tfvars.example -out=memory.tfplan
terraform -chdir=infra/ai-memory apply memory.tfplan
node infra/scripts/prepare-ai-deployment.cjs
terraform -chdir=infra/admin-runtime plan -out=memory-ai.tfplan
terraform -chdir=infra/admin-runtime apply memory-ai.tfplan
node infra/scripts/configure-production-cors.cjs
```

Memory çıktılarını `infra/admin-runtime/memory.auto.tfvars.json` içindeki `ai_memory_environment` haritasına aktarın. Yalnız AI_MEMORY_TABLE, AGENTCORE_MEMORY_ID, MEMORY_READ_ENABLED, MEMORY_WRITE_ENABLED ve Guardrail alanlarını alın; Cognito/table ortak ayarlarını kopyalamayın. Her planı inceleyin. CORS betiği mevcut ayarları koruyarak PATCH ekler. UI için `npm run build` sonrasında statik çıktıyı mevcut web bucket'ına yayınlayıp CloudFront invalidation yapın.

```sh
npm test
npm run test:backend
npm run typecheck
apps/web/node_modules/.bin/tsc --project apps/web/tsconfig.server.json
python3 -m unittest discover -s training/travel -p 'test_*.py'
Önce canlı smoke test önkoşullarını doğrulayın:

```bash
npm run smoke:preflight
```

Komut, `ai-memory` state output'larının ve Guardrail output sözleşmesinin mevcut olup olmadığını da kontrol eder. Gerekli değerler gözden geçirilmiş Terraform çıktılarından shell ortamına aktarılmalıdır; değerler repoya yazılmamalıdır.

```bash
AGENTCORE_MEMORY_ID=<memory-id> node infra/scripts/verify-ai-memory.cjs
```
```

Son komut gerçek AWS testidir: iki e-postasız geçici Cognito hesabı, model çağrısı, kredi tekrar güvenliği, kullanıcı izolasyonu, gerçek event yazımı, unutma bariyeri ve CORS kontrolü. Sonunda hesaplar ve uygulama kayıtları silinir; silme denetim kayıtları kendi yaşam döngüsünü tamamlar. Tek event testi uzun dönem çıkarım kalitesini veya 31 günlük silme süresinin tamamlandığını kanıtlamaz.

Geri dönüşte önce MEMORY_READ_ENABLED/MEMORY_WRITE_ENABLED değerlerini false yapın; purge worker'ını açık tutun. `infra/admin-runtime/.build/pre-memory/ai.zip` eski AI paketinin yerel yedeğidir; kimlik doğrulama açığını geri getireceğinden eski kodu körlemesine yayınlamayın. Memory kaynağı `prevent_destroy`, tablo silme koruması ve PITR ile korunur. CloudWatch dashboard, Lambda Errors/IteratorAge ve DLQ alarmını takip edin; alarm henüz bir bildirim kanalına bağlanmamıştır.

## Koşullu kalan aşamalar

- **Fine-tuning:** [training/travel](../../training/travel/README.md) gözden geçirilmiş veriyi doğrular, grup bazlı train/validation/test ayırır, Nova JSONL ve checksum manifest üretir. Eğitim gönderimi varsayılan olarak dry-run'dır. En az 2.000 hakları/onayı doğrulanmış örnek ve bağımsız değerlendirme seti yok; eğitim başlatılmadı. CUSTOM_MODEL_ENABLED=false. Bölge/Converse uyumluluğu ve kalite/maliyet eşikleri sağlanmadan canlı modele geçilmez.
- **Runtime/Gateway:** Mevcut Lambda akışının süre/araç gereksinimleri değişmedi; plandaki karar kapısı gereği taşınmadı.
- **Bilgi ve araç kapsamı:** Mevcut gastronomi RAG ve Amazon Location korundu. Yeni şehir korpusu, gerçek otel/uçuş fiyatı, müsaitlik ve toplu taşıma API'si bu teslimatta eklenmedi.
- **Kabul ölçümleri:** Kullanıcı izolasyonu ve işlem güvenliği testleri var. Geniş çok turlu kalite testi, p95 üretim gecikmesi, çıkarım doğruluğu ve eğitim karşılaştırması ayrıca veri/ölçüm gerektirir.

## 27 Eylül 2026 doğrulama sonucu

- Frankfurt'ta AgentCore Memory ve her iki strateji ACTIVE; kontrol API'si, Streams worker, Guardrail ve ana AI Lambda yayımlandı. Son Memory Terraform planı değişiklik göstermiyor.
- 120 web testi, 110 backend testi ve 3 eğitim hazırlama testi geçti. Web/server TypeScript kontrolleri ve Next.js üretim derlemesi başarılı.
- [Canlı test](../verification/ai-memory-live.json): varsayılan kapalı onay, kullanıcı izolasyonu, aynı istekte ikinci ücret olmaması, gerçek AgentCore event yazımı, anlık unutma bariyeri, silinmiş makbuzun oynatılmaması, ilk fiziksel event silme turu, geçersiz tokenın reddi ve PATCH CORS geçti.
- [Yayın kontrolü](../verification/ai-memory-web.json): `/profile/edit/` ve `/ai/` HTTP 200; CDN HTML içeriği yerel derlemeyle birebir aynı. Bağlı tarayıcı olmadığından etkileşimli/görsel UI kontrolü yapılamadı.
- [Lambda paket doğrulaması](../verification/ai-memory-deployment.json) ve [başarılı silme uzlaştırması](../verification/ai-memory-reconcile.json) kaydedildi. İlk canlı testte boş actor/namespace için ResourceNotFound yanıtı tespit edilip düzeltildi; ilgili test eklendi. Hata kuyruğundaki test mesajları ancak silme işlerinin daha yeni başarılı kontrol zamanı doğrulandıktan sonra tek tek onaylandı.
- Mevcut admin-runtime planında görev dışı sekiz tracker/telemetry route'u ve operations/routes paket farkları vardı; uygulanmadı. Yalnız AI fonksiyonu ve Guardrail izni hedeflenerek yayımlandı. Yerel deploy state/plan/backup dosyaları erişimi sınırlı tutulmalıdır.
