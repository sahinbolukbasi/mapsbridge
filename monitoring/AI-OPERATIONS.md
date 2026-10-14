# AI Operasyon Merkezi

Erişim: `/u/admin/` → **AI Operasyon Merkezi**. API uçları `system` yetkisi gerektirir; destek ve moderatör rolleri erişemez.

- `GET /admin/ai-operations`: çalışma ortamı kaydı, kontrol ayarları ve son 24 saatin en yeni 200 operasyon kaydı. Limit dolduğunda sayaçların örnekleme ait olduğu arayüzde belirtilir.
- `POST /admin/ai-control`: `enabled`, `defaultModel`, `disabledModels`, `version`, `reason`. Ayarlar ve denetim kaydı tek transaction ile yazılır; eski sürüm 409 döndürür.
- AI runtime, ortamındaki asıl model kimliklerini ve servis yapılandırmasını `SYSTEM#AI_RUNTIME / META` kaydına yazar. İlk uygun AI isteğinden önce veya kayıt 24 saatten eskiyken model yönetimi kapalıdır. Devre dışı asistan için gelen doğrulanmış istek de bu kaydı yeniler.
- Kontrol `SYSTEM#AI_CONTROL / META` kaydında tutulur. Her model çağrısı tutarlı okumayla ayarları kontrol eder. Kontrol deposuna erişilemezse model çalıştırılmaz. Değişiklik devam eden sağlayıcı çağrılarını iptal etmez.
- `AI#OPERATIONS` bölümünde istek ve model çağrıları ayrı kayıtlardır. Model token sayısı, süre, kontrollü hata kodu ve tamamlanmış isteğin agent kimlikleri bulunur. Kullanıcı kimliği, prompt, yanıt ve ham sağlayıcı hata mesajı kaydedilmez. Telemetri yazma hatası kullanıcı yanıtını bozmaz.
- Kayıtlarda 7 günlük `expiresAt` bulunur; fiziksel temizleme için hedef tablonun bu alanla DynamoDB TTL kullanması gerekir. Panel yalnızca son 24 saati sorgular.

## Verinin anlamı

Tanımlı agent bileşenleri, supervisor'a bağlı bileşenler ve gözlenen agent türleri ayrı gösterilir. İşlenen istek sayısı son iki dakika içinde `running` durumunda gözlenen kayıtlardır; küresel eşzamanlılık metriği değildir. Daha eski tamamlanmamış kayıtlar belirsiz olarak gösterilir. Servis yapılandırması anlık sağlık göstergesi değildir.

Fiyat modülleri canlı tarayıcı olarak gösterilmez. Fiyat botlarının heartbeat/scheduler bağlantısı ve eğitim işlerinin servis telemetrisi mevcut değildir. Eğitim açıklaması `training/travel/README.md` ve hazırlama kodunu esas alır; tamamlanmış veri seti veya eğitim iddiası içermez.

## Doğrulama ve yayın

- Web testleri: 120 başarılı.
- Backend testleri: 117 başarılı; yetki, geçersiz model, sürüm çatışması, varsayılan model koruması, eski runtime, asistanı kapatma ve kişisel veri içermeyen hata kaydı senaryoları dahil.
- `npm run typecheck`, `npm run build`, `node infra/scripts/build-admin-runtime.cjs`: başarılı.
- Mevcut üretim dizini `infra/admin-runtime`: Terraform doğrulaması ve statik politika kontrolü başarılı.
- Yerel tarayıcı testi, fixture API yanıtlarıyla masaüstü/mobil görünümünü, sekmeleri, model seçimi ve kaydetmeyi, hata filtresini doğruladı. Gerçek sağlayıcı çağrısı yapılmadı.

Canlıya dağıtım yapılmadı. Mevcut üretim paketleri ve `infra/admin-runtime/routes.json` yeni uçları içerir. Yayın için `infra/admin-runtime/README.md` içindeki mevcut üretim süreci kullanılmalıdır.

Gelecek mimari dizini `infra/terraform` doğrulamasında önceden mevcut hatalar: `guardrails.tf` içindeki desteklenmeyen `aws_bedrockagent_guardrail`, `modules/api/main.tf` içindeki desteklenmeyen `provisioned_concurrency_config`. Statik politika kontrolü ayrıca `ai.tf`, `hosting.tf` ve `modules/analytics/main.tf` dosyalarındaki mevcut wildcard IAM izinlerini bildirir. Bu dashboard çalışmasında bu kaynaklar değiştirilmedi.
