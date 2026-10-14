# İzinli eğitim verisi kuyruğu

Web ve mobil aynı `POST /ai/route-planner` sözleşmesini kullanır. `trainingConsent: true` sadece o mesaj ve yanıtı için geçerlidir; varsayılan false. `AI_TRAINING_COLLECTION_ENABLED=true` sunucu anahtarı da gerekir. Hafıza izni eğitim izni değildir.

Yanıt, kredi hesabı, sohbet ve `AI#TRAINING_PENDING` kaydı tek DynamoDB transaction'ında tamamlanır. Aynı requestId ile tekrar farklı kayıt veya ücret üretmez; izin değiştirilirse fingerprint uyuşmazlığı reddedilir. Guardrail retleri ve başarısız yanıtlar toplanmaz. Geçmiş mesajlar, manifesto, kişisel hafıza, koordinatlar ve kullanıcı kimliği aktarılmaz. E-posta/telefon/kimlik/kart maskelemesi uygulanır; isim ve serbest metin için anonimlik garantisi vermez. Bu yüzden kayıtlar `reviewed:false`, `containsPersonalData:true` olarak karantinaya gider.

EventBridge beş dakikada bir Lambda'yı çağırır. En eski 25 kayıt işlenir. Önce deterministik S3 anahtarına yazılır, ardından kuyruktan silinir. Yazma başarısızsa kayıt kalır; silme başarısızsa aynı nesne anahtarı yeniden kullanılır. Süresi dolan kayıtlar dışarı aktarılmaz. Sürekli bozuk kayıtlar backlog alarmıyla ele alınmalıdır; kuyruk hacmi 25 kayıt/5 dakika kapasitesini aşarsa işçi sıklığı/batch boyutu artırılmalıdır.

Kuyruk TTL'si 7 gün (`expiresAt` mevcut tabloda etkin olmalıdır). Karantina nesneleri 22 gün, eski sürümler 1 gün saklanır; toplam politika 30 gün. AWS TTL/lifecycle fiziksel silmeyi asenkron yapar. Karantina onaylı eğitim deposu değildir; mevcut `training/travel/prepare.py` canlı konuşmaları bilerek kabul etmez. Eğitim veri kümesine yükseltme, kişisel veri/izin/hak incelemesi ve ayrı fine-tuning değerlendirmesi gerektirir. Bu işçi model eğitimi başlatmaz.

## Kurulum

```sh
node infra/scripts/build-ai-training.cjs
terraform -chdir=infra/ai-training init
terraform -chdir=infra/ai-training plan -var=account_id=ACCOUNT -var=prefix=PREFIX -var=table_name=TABLE -out=training.tfplan
terraform -chdir=infra/ai-training apply training.tfplan
```

İşçi kurulduktan sonra mevcut `infra/admin-runtime` yayınında `ai_training_collection_enabled=true` kullanın ve AI paketini yeniden derleyin. İşçi rolü sadece kuyruk bölümünü okuyup silebilir ve kendi kovasının `quarantine/` önekine yazabilir. AI Lambda'nın mevcut tablo yazma yetkisi kullanılır; S3 okuma/eğitim yetkisi eklenmez.

CloudWatch `MapsBridge/Training`: Exported, Failed, Heartbeat, OldestPendingAgeSeconds. Terraform işçi Errors, bir saat backlog ve 15 dakika heartbeat yokluğu alarmları ile dashboard kurar. `alarm_topic_arn` boşsa alarm yalnız konsoldadır; bildirim göndermez. Üretim için ekibinizin mevcut SNS topic'ini verin.

Geri dönüş: önce `ai_training_collection_enabled=false`; ardından zamanlayıcıyı durdurun. Bekleyen kayıtları saklama politikasına göre silin/işleyin. S3 kovası `prevent_destroy` ile korunur; otomatik yıkım çalıştırmayın.
