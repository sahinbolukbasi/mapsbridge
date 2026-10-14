# Admin paneli — geliştirme ve doğrulama notları

## Kullanım ve erişim

Canlı panel: https://dzofhz77g8a7j.cloudfront.net/admin/

`/admin/` ve `/u/admin/` aynı paneldir. Mevcut yeşil tasarım korunmuştur. `sahinbolukbasii@gmail.com` hesabının `mapsbridge-admin` üyeliği 16 Eylül 2026 tarihinde Cognito üzerinden yeniden doğrulandı. Birincil yönetici hesabının panelden rolünü kaldırma/askıya alma engellenir.

Yetkiler sunucuda Cognito grup üyeliğinden okunur: admin tüm bölümleri, moderator içerik ve destek işlemlerini, support kullanıcı ve destek işlemlerini kullanır. İstemci rolü veya e-posta listesi yetki sağlamaz. Destek rolü kredi/rol/ödeme/sistem değişikliği yapamaz.

## Yönetim özellikleri

- **Kullanıcılar:** Cognito ve uygulama kayıtlarını birleştiren liste; ad/telefon/iç not düzenleme; kullanıcı ayrıntıları, hesap durumu, doğrulanmış e-posta, grup üyelikleri, rota ve cüzdan görünümü; askıya alma/kaldırma; oturum iptali; admin/moderator/support/user rolü atama.
- **Kredi/cüzdan:** gerekçeli kredi ekleme/çıkarma, negatif bakiye koruması, tekrar gönderilen işlemlerde mükerrer kredi engeli, cüzdan dondurma/açma. Bakiye ve işlem makbuzu tek veritabanı işlemiyle kaydedilir.
- **Rotalar:** gerçek sahip kaydı üzerinde moderasyon ve ad/açıklama düzenleme. Askıdaki rota tekrar yayımlanamaz/paylaşılamaz. Onaylama özel rotayı kendiliğinden herkese açmaz.
- **Paylaşım ve profiller:** konum/rota paylaşımını iptal etme, profil yayını askıya alma/onaylama. Liste paylaşım tokenı veya koordinatları açığa çıkarmaz. Askıdaki profil API üzerinden yeniden yayımlanamaz.
- **İçerik:** blog taslağı oluşturma, blog/rehber düzenleme, yayınlama ve arşivleme. Yayınlanan bloglar `/articles/` sayfasında görünür; taslaklar herkese açık API'den okunamaz.
- **Destek:** `/support/` üzerinden giriş yapan kullanıcı talep açar ve kendi taleplerine yanıt verir. Yönetici öncelik/durum, kendine atama, iç not ve yanıt yönetir. İç notlar kullanıcıya dönmez. Bu akış uygulama içidir; e-posta/SMS göndermez.
- **Duyurular:** taslak/yayın/arşiv, başlangıç-bitiş zamanı; etkin duyurular site genelinde görünür.
- **Finans:** ödeme/abonelik listeleri, makbuzlar, aylık TRY özeti; sağlayıcı yapılandırılmışsa iade ve dönem sonu iptal/iptalden vazgeçme. Canlıda Stripe bağlı değildir; ilgili düğmeler açıklamayla kapalıdır.
- **Sistem:** bakım mesajı ve bakım modu; rota oluşturma ve paylaşım özellik anahtarları. Bakım rota, profil ve konum paylaşımı yazma işlemlerini engeller; okuma, giriş, destek ve admin işlemleri devam eder.
- **Operasyon:** şikâyet kararları, işlem geçmişi, kayıtlı AI kullanım durumu/kredi maliyeti, ölçülen servis sağlığı; arama, durum/tarih filtreleri, sayfalama, CSV dışa aktarma ve ana listelerde toplu moderasyon. CSV hücrelerinde formül enjeksiyonu önlenir.

Yeni düzenleme akışları gerekçe ister ve denetim kaydı üretir. Versiyon denetimi eski ekranın yeni kaydı ezmesini engeller; kullanıcı/rota gibi ortak kayıtlar yalnız değiştirilen alanları günceller. Cognito ve Stripe ile DynamoDB arasında dağıtık atomiklik yoktur; harici işlemler için başlangıç/sonuç kayıtları tutulur. Toplu işlemler kısmi başarısızlıkları bildirir.

## Doğrulama — 16 Eylül 2026

- Backend: **93 test** geçti; tüm Lambda TypeScript kaynaklarında `tsc --noEmit` başarılı.
- Web: **23 test**, tip kontrolü ve üretim derlemesi başarılı; 37 statik sayfa üretildi.
- Eski Python API: **16 test** geçti. Toplam **132 test**.
- Testler sunucu yetkilerini, korunan hesabı, idempotent kredileri, eşzamanlı değişiklik korumasını, destek sahipliği/iç not gizliliğini, yayın sınırlarını ve bakım denetimlerini kapsar.
- Aktif runtime Terraform doğrulandı. İncelenen plan **39 ekleme, 3 güncelleme, 0 silme** ile uygulandı. Üç Node Lambda, üç personel grubu ve 58 API yolu bu state'te yönetilir.
- Mevcut Python API kodu önce erişimi kısıtlı yerel yedek alınarak güncellendi. Yalnız kod değiştirildi.
- Web varlıkları önce, tüm statik sayfalar sonra yüklendi; CloudFront genel invalidation tamamlandı. Canlı `/admin/`, `/u/admin/`, `/support/`, `/articles/` HTTP 200 döndü; HTML dosyaları yerel derlemeyle birebir eşleşti ve tüm JavaScript referansları HTTP 200 ile doğrulandı. Python API güncellemesi `Successful / Active` durumunda.
- Canlı `/system/status` ve `/marketplace/blogs` HTTP 200; oturumsuz `/support/tickets` ve `/admin/session` HTTP 401; hatalı token HTTP 401; destek CORS ön kontrolü HTTP 200 ve doğru site origin'i döndü.
- Bağlı tarayıcı bulunmadığı için giriş sonrası görsel ve etkileşimli uçtan uca test yapılmadı. Gerçek kullanıcı/kredi/ödeme verileri test için değiştirilmedi; gerçek destek mesajı gönderilmedi.

## Sınırlar ve yeniden dağıtım

- Stripe anahtarları mevcut değildir. Gerçek finansal işlemler sağlayıcı bağlantısı tamamlanmadan kullanılamaz.
- AI kullanım ekranı mevcut kayıtları gösterir; henüz dağıtılmamış bir AI/ödeme sağlayıcısı kurmaz ve token tüketimi uydurmaz.
- Kullanıcı daveti ve parola sıfırlama gönderimi bu panel kapsamına eklenmedi; mevcut giriş/kayıt/parola sıfırlama akışları kullanılır.
- Listeleme DynamoDB taramalarıyla çalışır. Büyük veri için indeksli sorgular, API sayfalaması ve önceden hesaplanan özetler gerekir; mevcut sayfalama istemci tarafındadır.
- Canlı dağıtım ve state sahipliği için `infra/admin-runtime/README.md` dosyasını izleyin. `infra/terraform` daha geniş gelecek mimarisidir; kaynak taşıma/import planı olmadan mevcut canlı state yerine uygulanmamalıdır.
