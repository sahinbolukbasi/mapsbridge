# Sohbetten araştırılmış rotaya — 18 Eylül 2026

Bu belge, önceki `docs/ai/runtime.md` ve `docs/ai/travel-rag.md` içindeki model ve mesaj başına ücret bilgilerini günceller.

## Kullanıcı akışı

1. Yeni sohbet boş bir rota paneliyle başlar; panel varsayılan olarak kapalıdır.
2. Asistan hedefi, gün sayısını ve ilgi alanlarını toplar. Eksik bilgi varsa rota üretmez; en fazla iki soru sorar.
3. Bilgiler tamamlandığında Amazon Location Geocode ve SearchText ile o bölgedeki yerleri araştırır. İlgi alanlarına uygun en fazla üç sorgu çalışır.
4. Model yalnız araştırılan yer kimliklerinden durak seçer. Yer adı, adres ve koordinat modelden değil sağlayıcı sonucundan alınır. İsteğe bağlı RAG rehber bilgisi ayrıca kullanılır.
5. Başarılı rota sağ panelde görünür. “İkinci güne kahve ekle” gibi mesajlarla düzenlenir. Şehir, süre, ilgi alanları ve mevcut rota sunucudaki sohbet bağlamında korunur.
6. Hatalı istekte rota paneli temizlenir. Önceki başarılı rota yalnız kendi mesajındaki “Rotayı göster” düğmesiyle yeniden açılır. Sohbet yanıtlarına otomatik eski rota kartı eklenmez.

Panel açılıp kapanabilir ve masaüstünde iki genişlik arasında değiştirilebilir. Mobilde sohbet/rota sekmeleri vardır. Sesli giriş, destekleyen tarayıcının mikrofon özelliğiyle metne dönüştürülür. Plan metin olarak indirilebilir; PDF etiketi kaldırıldı. Harita aktarımı mevcut `mapsbridge.travelPlanner.v5` biçimini kullanır ve aynı sohbetin güncellenmiş rotasını günceller.

Eski demo/taslakların yeni ekrana taşınmaması için sohbet ekranı `mapsbridge.ai.sessions.v5` anahtarını kullanır. Önceki v4 kayıtları silinmez; yeni ekrana otomatik aktarılmaz.

## Kredi ve günlük kullanım

| İşlem | Kredi |
|---|---:|
| Eksik tercihleri netleştirme | 0 |
| Güncel fiyat/açık durum doğrulamasının desteklenmediğini açıklama | 0 |
| Genel seyahat sohbeti | 1 |
| Başarıyla tamamlanan rota veya rota düzenlemesi | 5 |
| Başarısız istek | 0 |
| Aynı başarılı requestId ile tekrar | 0 ek kredi |

Başlangıç denemesi 10 kredi. Kullanıcı başına 20, servis genelinde 200 model isteği denemesi/gün sınırları korunur. Ücretsiz netleştirmeler ve başarısız model denemeleri günlük deneme sayısına dahildir. Sayaç UTC gece yarısı, Türkiye saatiyle 03:00'te yenilenir. `GET /stripe/wallet` kredinin yanında günlük kullanım, yenilenme zamanı ve ücret tarifesini döndürür. Kredi yetersizliği, kullanıcı günlük limiti, servis limiti ve dondurulmuş hesap için farklı hata kodları vardır.

Rezervasyon sıfır krediyle günlük kapasiteyi atomik ayırır. Gerçek ücret, tamamlanan yanıt türüne göre yalnız sunucuda belirlenir. Yanıt makbuzu, ücret, kalıcı tercih ve sohbet sürümü tek DynamoDB transaction ile tamamlanır. Bakiye yetersizliği veya eşzamanlı sohbet sürümü çakışması varsa sonuç ve ücret birlikte reddedilir. İstemci `cost`, `tier`, `action` göndererek bedeli düşüremez.

## Sunucu bağlamı ve model

Sohbetler doğrulanmış Cognito kullanıcısının `USER#<sub> / AI_CHAT#<conversationId>` kaydında tutulur. İstemciden gelen hesap veya rota verisi bu kayda yetki vermez. Son altı mesaj, yapılandırılmış gezi tercihleri ve mevcut rota saklanır. Yeni hedef ve süre, modelin kullanıcı mesajından verdiği birebir alıntıyla kontrol edilir; belirtilmeyen hedefin model tarafından seçilmesi engellenir. Kalıcı tercihler yalnız açıkça “her seyahatimde”, “genelde”, “tercihim” gibi ifade edilen isteklerden alınır. Gezi bağlamı ve kalıcı profil ayrı kayıtlardır.

Model `eu.anthropic.claude-haiku-4-5-20251001-v1:0` üzerinden AWS Bedrock'tadır. İki çağrı yapılır: bağlam/niyet çıkarımı ve gerekiyorsa araştırmaya dayalı yanıt. Converse tool şeması yapılandırılmış çıktı sağlar; serbest JSON üretimine bağımlılık azaltılır. Çıkarım ve yer araştırmasının zaman bütçesi sınırlandırılır. Rota günleri, sayısal koordinatlar, tekrarlı/araştırılmamış duraklar ayrıca sunucuda denetlenir.

## Sınırlar

Amazon Location yer araması yeni eklendi; canlı fiyat, rezervasyon, işletme puanı, açık/kapalı durumu veya trafik entegrasyonu değildir. Bu ayrıntıları isteyen sorulara doğrulanmamış sayılar verilmez. Rehber RAG korpusu hâlâ üç şehir için küçük pilot içeriktir; tarih rotalarına gastronomi kaynakları taşınmaması için konu ve şehir denetimi vardır. Mekân bilgileri veya model açıklamaları hatasız kabul edilemez. Rota mesafesi/yürüyüş süresi UI tarafından uydurulmaz; ulaşım hesabı harita motorunun işidir.

HTTP yanıtı tamamlanınca gösterilir; token akışı yoktur. Browser bağlantısı bulunmadığı için görsel etkileşim testi bu ortamda yapılmadı. Yerel testler, üretim derlemesi, canlı API ve statik sayfa/varlık kontrolleri kullanılır.

## Kontroller

- `npm test`, `npm run test:backend`, `npm run typecheck`, `npm run build`
- `node infra/scripts/verify-conversation-flow.cjs`: gerçek AWS araştırmasıyla netleştirme → Roma rotası → aynı şehirde kahve ekleme.
- `node infra/scripts/verify-ai-api.cjs`: geçici hesapla ücretsiz sorular, kalıcı tercih, ücret, tekrar isteği, bağlam ve düzenleme.
- `node infra/scripts/audit-live-chat.cjs`: yemek, belirsiz hedef, bağlam, güncel veri sınırı ve kapsanmayan şehir. Sabit senaryolar genel kalite garantisi değildir.

Canlı testler AWS kullanım maliyeti oluşturur; geçici hesaplar ve kayıtları sonunda temizlenir.
