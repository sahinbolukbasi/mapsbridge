# Sohbet, AgentCore ve eğitim verisi — 2026-10-03

Web ve AI backend mevcut AWS üretim ortamına yayımlandı. Mobil kaynak kodu güncellendi, iOS ve Android Hermes paketleri başarıyla oluşturuldu. Mobil değişikliklerin cihazlara ulaşması için uygulama sürümü dağıtılmalıdır; App Store/Play Store yayını yapılmadı.

## Değişiklikler

- Mobil AIScreen her mesajı web ile aynı Cognito doğrulamalı `/ai/route-planner` uç noktasına gönderir. Sabit yemek/hava/etkinlik yanıtları, API hatasını sahte İstanbul rotası olarak gösteren fallback ve uydurma koordinat/puan/yürüme süreleri kaldırıldı.
- Konuşma kimliği ve geçmiş sunucuda korunur. Eksik temel bilgi için tek soru ve hızlı yanıt seçenekleri kullanılır. Yazım hatalarını yorumlama talimatları sürümlendi (`travel-dialogue-v3`). Aynı mobil isteğin tekrarında requestId ve izin aynı kalır.
- Rota duraklarının gün/süre bilgisi mobilde korunur; geçersiz koordinat reddedilir, sıfır koordinat geçerlidir. Sonuç yer sağlayıcısından doğrulanmış duraklarla haritaya aktarılır.
- RAG yemek anahtar sözcükleriyle sınırlandırılmaz; kültür ve ulaşım sorguları da bilgi tabanına gider. Şehir, public/approved ve son geçerlilik filtreleri korunur. Sorgularda yaygın PII maskelenir. Mevcut hesapta `IDOTP4GQGO` Knowledge Base durumu ACTIVE, depolama türü S3_VECTORS olarak doğrulandı. Korpus kapsamı mevcut onaylı dokümanlarla sınırlıdır; sorgu kapsamının genişlemesi yeni içerik ürettiği anlamına gelmez.
- Gerçek IAM doğrulamalı AgentCore Gateway mevcut Lambda supervisor'a bağlandı. AgentCore Memory entegrasyonu korunur; supervisor AgentCore Runtime'a taşınmadı.
- Web/mobilde varsayılanı kapalı, tek mesaj/yanıt için eğitim inceleme izni eklendi. Başarılı cevap ve eğitim outbox kaydı aynı kredi/sohbet transaction'ında tamamlanır. Geçmiş, kişisel hafıza, manifesto ve konum aktarılmaz. Kayıtlar maskelenmiş fakat kişisel veri incelemesi yapılmamış olarak işaretlenir.
- EventBridge her beş dakikada bir `adreskopru-prod-training-worker` Lambda'sını çalıştırır; DynamoDB kuyruğunu özel şifreli S3 karantinasına aktarır. İnceleme yapılmadan fine-tuning yoktur. Ayrıntılar: [işçi işletim rehberi](../../infra/ai-training/README.md).
- Web derlemesini engelleyen `social-sync.ts` içindeki nesne metodunda geçersiz `private` ve CommunityPost alan uyumsuzluğu düzeltildi.

## AWS dağıtımı

- Hesap: `996270854731`, bölge: `eu-central-1`.
- AI Lambda: `adreskopru-prod-ai`, mevcut Node.js 22 / 30 saniye çalışma ortamı korunur.
- Gateway: `adreskopru-prod-travel-tools-vvs07mfyeh`; read-only Places aracı `travel___research_places`.
- Eğitim kovası: `adreskopru-prod-training-996270854731`; public erişim kapalı, SSE-S3, TLS politikası, sürümleme ve saklama kuralları.
- Dashboard: `adreskopru-prod-training-worker`. Errors, backlog ve heartbeat alarmları canlı kontrolde **OK**.
- Alarmlarda SNS action yok; konsol izleme aktiftir, dış bildirim bağlı değildir.
- Başlangıçta worker için reserved concurrency=1 hesap kotasına takıldı. Yalnızca yeni/başarısız işçi kaynağı yeniden oluşturulup paylaşımlı kapasite kullanıldı. İşçi tekrarları aynı S3 anahtarıyla güvenlidir.
- Backend önceki kod/ortam yedeği: `infra/admin-runtime/.build/ai-rollback-20261003/`. Terraform ortam ayarları `ai-capabilities.auto.tfvars.json` ile kayıtlıdır.
- Web: mevcut `adreskopru-prod-996270854731-web` kovası ve `E2F7S1E4UIOGJH` CloudFront dağıtımı. Eski varlıklar silinmedi.

## Doğrulama

- Web: **145 test geçti**; backend: **133 test geçti**. Toplam 278.
- Web TypeScript ve production build başarılı. Mobil TypeScript, iOS ve Android Expo export başarılı.
- Yeni training-worker TypeScript denetimi başarılı. Tüm Lambda ağacının ayrı typecheck komutu, değiştirilmeyen admin/ai-operations.ts tip çıkarımı ve email-notifier.ts eksik SES bağımlılığı nedeniyle başarısız; bunlar yeni işçi derlemesini ve mevcut testleri engellemiyor.
- Terraform validate ve yeni stack/Gateway statik IAM güvenlik politikası kontrolleri geçti.
- Gateway canlı lookup: 21 doğrulanmış mekân, yaklaşık 2,2 saniye. İmzasız istek HTTP 401 ile reddedildi.
- Gerçek Bedrock sohbeti: eksik hedef sorusu → iki günlük Roma rotası → ikinci güne kahve ekleyip eski durakları koruma başarılı. Bazı isteğe bağlı konaklama/keşif alt çağrıları zaman aşımına uğradı; ana rota başarılı kaldı. Bunların başarı/gecikmesi ayrıca iyileştirilmeye açık.
- Yayımlanan authenticated API: tek soru, iki günlük doğrulanmış rota, izin verilmediğinde eğitim toplamama, requestId tekrarında aynı rota ve çift ücret almama başarılı.
- İzinli sentetik API mesajı → transaction outbox → gerçek işçi → SSE-S3 karantina aktarımı başarılı. Test kullanıcıları, kendi test kayıtları ve test S3 nesne sürümleri temizlendi.
- RAG canlı testi gerçek vektör retrieval ve Tokyo turizm kaynağına bağlı monjayaki yanıtını doğruladı.

Tekrarlanabilir canlı kontroller: `infra/scripts/verify-conversational-api.cjs`, `verify-training-pipeline.cjs`, `verify-agentcore-gateway.cjs`, `verify-travel-rag.cjs`. Bu komutlar AWS çağrıları yapar; API testleri geçici hesap oluşturup temizler.

AWS davranışı için başvurulan resmi dokümanlar: [Knowledge Base Retrieve](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-how-retrieval.html), [AgentCore Observability](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/observability.html). Bu sürüm CloudWatch/uygulama telemetrisi kullanır; tam OpenTelemetry izleme kurulduğu iddia edilmez.
