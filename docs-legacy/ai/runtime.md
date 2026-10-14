# Seyahat AI çalışma akışı

Mevcut sohbet arayüzü `POST /ai/route-planner` ve `GET /stripe/wallet` kullanır. Kişisel hafıza kontrolleri Profil → Güvenlik → Hatırladıklarım bölümündedir. Üretim servisi `infra/admin-runtime` Terraform state'i tarafından yönetilen `adreskopru-prod-ai` Lambda'sıdır.

- Cognito erişim tokenı doğrulanır; hesap anahtarı sunucunun doğruladığı `sub` değerinden türetilir.
- Bedrock Converse, `eu.anthropic.claude-haiku-4-5-20251001-v1:0` profili üzerinden çağrılır. Bölgesel profil ve hedef model IAM izinleri birlikte tanımlanır. [AWS inference profile belgesi](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-use.html).
- Rota yanıtlarında extended thinking, `BEDROCK_THINKING_ENABLED=true` ve sınırlı `BEDROCK_THINKING_BUDGET_TOKENS` ile etkinleşir. Ham `reasoningContent` hiçbir zaman istemciye, sohbet geçmişine, loglara veya eğitim outbox'ına yazılmaz; modelden yalnızca en fazla üç maddelik kullanıcı-güvenli `decisionSummary` alınır.
- Yer araştırması güvenilmeyen kanıt olarak işlenir. Evidence validator; Amazon Location sağlayıcısını, gelecekte olmayan `checkedAt` zaman damgasını, geçerli koordinatları, sınırlandırılmış yer alanlarını, benzersiz yer kimliklerini ve durum/sonuç sayısı tutarlılığını zorunlu kılar. Eksik veya geçersiz araştırma, tahmini rotaya dönüştürülmeden reddedilir.
- Yanıtlar ayrıca `sourceCoverage` metadata alanı taşır. Bu alan yalnızca modelin istediği kaynak ID'lerinin retrieval sonuçlarıyla eşleşme oranını ölçer; modelin her cümlesinin doğrulandığı anlamına gelmez.
- İstemciden en fazla altı, sunucu sohbetinden en fazla on iki mesaj; kayıtlı seyahat tercihleri ve o geziye ait doğrulanmış bağlam modele iletilir. Toplam dinamik mesaj bütçesi ve kişisel özet sınırları [hafıza rehberindedir](memory.md). Kullanıcının açık mesajı seçimlerden önceliklidir.
- Model yalnızca desteklenen tempo, bütçe, seyahat stili ve ilgi alanları için tercih güncellemesi üretebilir. Sunucu serbest metin ve kimlik bilgilerini tercih kaydına almaz. Tercihler `USER#<sub> / AI_PREFERENCES` kaydında saklanır.
- Sonuç, işlem makbuzu ve tercih güncellemesi tek DynamoDB transaction ile tamamlanır. Ağ hatasından sonra aynı `requestId` ve içerikle yapılan istek, kayıtlı sonucu yeniden model çağırmadan ve yeniden ücretlendirmeden döndürür.
- Geçersiz model yanıtında rezervasyon iade edilir. Günlük deneme sayacı korunur. Başarılı sonuçtan sonraki bakiye okuma hatası sonucu başarısız olarak göstermez.
- `Tercihlerimi unut` veya `Seyahat tercihlerimi sil` mesajı ücretsiz olarak tercih kaydını temizler. API istemcileri aynı işlemi `{ "action": "forgetPreferences" }` ile yapabilir. Bu işlem sohbet arşivini veya geçmiş işlem makbuzlarını silmez.

## Doğrulama

```sh
npm test
npm run test:backend
npm run typecheck
node infra/scripts/verify-ai-model.cjs
node infra/scripts/verify-ai-api.cjs
```

Son iki komut gerçek AWS bağlantısı ve küçük Bedrock kullanım maliyeti gerektirir. API testi e-posta göndermeden geçici bir Cognito hesabı açar, bu hesabın deneme kredileriyle işlem yapar ve sonunda hesabı ve ona ait DynamoDB kayıtlarını kaldırır. Global günlük kullanım sayacı gerçek model isteklerini saymaya devam eder.

## Yalnız AI dağıtımı

```sh
node infra/scripts/prepare-ai-deployment.cjs
terraform -chdir=infra/admin-runtime plan -out=ai-deployment.tfplan
terraform -chdir=infra/admin-runtime apply ai-deployment.tfplan
```

Hazırlık komutu diğer servislerin canlı ZIP dosyalarını korur ve yalnız AI kodunu derler. Plan incelenmeden uygulamayın. Yalnız backend değişikliklerinde Web/S3/CloudFront yayını gerekmez; hafıza ayarları gibi UI değişikliklerinde web çıktısı da yayımlanır. Genel `build-admin-runtime.cjs` komutu tüm servisleri yeniden derlediğinden yalnız AI dağıtımı için yukarıdaki komutu kullanın.

Model çıktıları canlı fiyat, açılış saati veya rezervasyon verisi değildir. Rota doğrulaması yapısal ve sayısal kontrolleri kapsar; yer kimliği ve koordinatları Amazon Location araştırmasından alınır.
Thinking özeti bir açıklanabilirlik yardımcısıdır, modelin gizli düşünce zinciri değildir. Karar maddeleri açık kullanıcı isteği, doğrulanmış profil, araştırma sonuçları ve rota kısıtlarıyla sınırlandırılır.

## Mevcut giriş ekranıyla Cognito uyumu

Ekran `USER_PASSWORD_AUTH` kullanır. Canlı app client varsayılan akışlarda kaldığında giriş başlamadan hata verir. `enable-web-password-auth.cjs` mevcut yapılandırmayı okur; `--apply` ile yalnız `ALLOW_USER_PASSWORD_AUTH` ekler, diğer ayarların değişmediğini doğrular ve önceki ayarları `.build` altında saklar. Ana Terraform tanımındaki `aws_cognito_user_pool_client.web` zaten bu akışı içerir. [AWS UpdateUserPoolClient belgesi](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_UpdateUserPoolClient.html).

## Kaynaklı seyahat bilgisi (RAG)

Yeni RAG altyapısı, veri aktarımı, kapsam sınırları ve yayın adımları [docs/ai/travel-rag.md](travel-rag.md) içindedir. `TRAVEL_KNOWLEDGE_BASE_ID` ayarıyla Bedrock Retrieve etkinleşir. Kullanılan kaynaklar yanıta eklenir; kaynak kullanılamadığında model bilgisi olduğu belirtilir. Başlangıç korpusu üç şehir için kısa gastronomi özetidir.

## AgentCore Memory ve Guardrail

Ayrı `infra/ai-memory` state'i, açık onay, transaction outbox, kullanıcı düzenleme/silme API'leri ve fine-tuning hazırlığının kapsamı [docs/ai/memory.md](memory.md) içinde belgelenmiştir. Model eğitimi henüz yapılmadı; mevcut Haiku modeli referans olarak korunur.
