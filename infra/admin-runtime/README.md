# Mevcut üretim API'si için yönetim servisleri

Bu bağımsız Terraform state'i `adreskopru-prod-admin`, `adreskopru-prod-routes` ve `adreskopru-prod-operations` Lambda servislerini, bunların IAM izinlerini, Cognito admin/moderator/support gruplarını ve mevcut HTTP API üzerindeki 58 yolu yönetir.

Mevcut CloudFront, S3, Cognito havuzu, veritabanı ve eski Python API bu state tarafından yönetilmez. Mevcut API CORS ayarı operasyon sırasında PUT/OPTIONS içerecek şekilde güncellendi; origin yalnızca mevcut CloudFront adresidir. Bu API ayarı eski altyapı sahipliğinde kalır. Kaynak kimlikleri `main.tf` içinde açıkça sabitlenmiştir. Başka hesaba uygulamak için önce hedefleri gözden geçirin.

`../terraform` kapsamlı gelecek mimarisidir; mevcut üretim state'iyle kaynak taşıma/import planı hazırlanmadan bu dizinin yerine uygulanmamalıdır.

## Tekrarlanabilir dağıtım

Proje kökünde:

```sh
node infra/scripts/build-admin-runtime.cjs
terraform -chdir=infra/admin-runtime init
terraform -chdir=infra/admin-runtime plan -out=deployment.tfplan
terraform -chdir=infra/admin-runtime apply deployment.tfplan
npm run build
```

Derleme `.build/` altında tüm admin-runtime paketlerini (local.domains + background-monitor, billing-reconcile, conversion-forwarder, rag-fill) sabit zaman damgalı üretir. `routes.json` elle yönetilir; betik onu yeniden yazmaz. Eski Python API (`legacy-api.zip`) artık bu betikle üretilmez (`infra/lambda/handler.py` depoda yok).

Web yayını: önce `apps/web/out/_next/` dosyalarını mevcut web kovasına immutable cache ile, ardından `apps/web/out/` içeriğini `_next/*` hariç `no-cache` ile yükleyin. Eski varlıkları silmeyin. Ortak layout değiştiğinden yalnız admin klasörlerini yüklemek yeterli değildir. Ardından CloudFront `/*` yollarını invalidate edin.

`.tfstate` yerel dosyası dağıtılan kaynakların sahipliğini tutar: silmeyin, başka operatörle eşzamanlı çalıştırmayın ve kontrollü bir yedeğini saklayın. State ve plan dosyalarını Git'e eklemeyin.

## Yönetici erişimi

Uygulama `ADMIN_GROUP_NAME=mapsbridge-admin` ayarıyla Cognito'nun doğruladığı kullanıcıyı ve sunucu tarafında okunan grup üyeliğini kontrol eder. İstemcideki e-posta veya yerel rol erişim vermez. Hesap seçimi kullanıcı tarafından doğrulandıktan sonra:

```sh
aws cognito-idp admin-add-user-to-group --region eu-central-1 --user-pool-id eu-central-1_TKABiLn5f --group-name mapsbridge-admin --username KULLANICI_KIMLIGI
```

Bu dağıtımda Stripe anahtarı yoktur. Ödeme/iade işlemleri için ayrıca gerçek sağlayıcı yapılandırması ve ilgili SSM okuma izni gerekir. Bakım tercihi rota, konum paylaşımı ve profil yazma işlemlerini durdurur. Okuma, giriş, destek ve admin işlemleri açık kalır. `PROTECTED_ADMIN_SUB` birincil yöneticinin rolünün panelden kaldırılmasını engeller.
