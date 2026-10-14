# Canlı sohbet doğrulaması — 17 Eylül 2026

Karar: AWS servisleri çalışıyor, ancak asistanın güvenilir ve dünya çapında güncel bir seyahat sohbeti sunduğu doğrulanamadı. İçerik kalitesi kabul kontrolü başarısız. Bu çalışma inceleme ve test kapsamındadır; üretim kodu, model ve altyapı değiştirilmedi.

## Gerçek test kapsamı

Üç geçici Cognito hesabıyla altı gerçek `/ai/route-planner` isteği yapıldı. Deneme kredileri kullanıldı; gerçek kullanıcı bakiyeleri değiştirilmedi. Geçici hesaplar ve DynamoDB kayıtları kaldırıldı. Başarılı istekler aynı `requestId` ile tekrarlandı; ikinci ücret alınmadı. Her hesabın başlangıç tercihleri boştu; tercih kaydetme ve silme kontrol edildi.

Altı isteğin beşi HTTP 200, biri HTTP 503 döndü. Başarılı yanıt süreleri 1,699–4,337 saniye, ortalama 3,267 saniye. Bu küçük örneklem yük testi veya gecikme garantisi değildir. Beş senaryoya özel içerik kabul kontrolünden yalnızca canlı veri sınırının açıklanması geçti. HTTP 200 doğru veya yeterli içerik anlamına gelmedi.

## Kritik bulgular

| Öncelik | Canlı kanıt | Kullanıcı etkisi |
|---|---|---|
| Yüksek | “Aynı şehirde kalalım” mesajında önceki Roma rotası İstanbul rotasına dönüştü. | Konuşma bağlamı güvenilir şekilde korunmuyor. |
| Yüksek | “Bana güzel bir gezi planla” isteğinde hedef sorulmadan İstanbul seçildi. | Kullanıcının belirtmediği hedef varsayılıyor. |
| Yüksek | Tokyo/Tsukishima yemek sorusu HTTP 503 verdi. CloudWatch: `Rota doğrulanamadı.` İstekte açıkça rota istenmemişti. | Normal sohbet, opsiyonel rota çıktısı yüzünden başarısız olabiliyor. Hatalı istek için kredi iadesi çalıştı. |
| Yüksek | Lima yemek sorusuna yalnız “Lima, Peru için yerel yemek önerisi ve doğrulama durumu” başlığı döndü. | Yanıt biçimsel olarak geçerli olduğundan gerçek öneri içermeden 5 kredi alındı. |
| Yüksek | Tarih/kültür rotasına Roma gastronomi özeti kaynak gösterildi; takipte İstanbul rotasına aynı Roma kaynağı eklendi. | Geçerli kaynak kimliği kontrolü, iddianın kaynakla desteklendiğini kanıtlamıyor. |

İlk rota üretimi, koordinat sınırları ve günlerin dolu olması yapısal kontrolleri geçti. Mekânların gerçek konumu, açık olması ve rota uygulanabilirliği canlı sağlayıcıyla doğrulanmadı. Bu nedenle rota kalitesine genel onay verilmedi.

## Çalışan kontroller

- Lambda `Active`, son güncelleme `Successful`.
- Kimliksiz sohbet isteği HTTP 401 ile reddedildi.
- Gerçek Bedrock/RAG entegrasyonu yanıt verdi ve kaynak metadata alanları API'ye ulaştı.
- İki günlük rota şeması üretildi; Roma için tarih/kültür tercihi kaydedildi.
- Başarılı yanıtın tekrarında ikinci ücret alınmadı.
- Hatalı Tokyo isteğinde bakiye 5 kaldı; başarısız çağrı ücretlendirilmedi.
- Kullanıcı tercihleri ücretsiz silinebildi.
- Karaköy'de “şu an açık” restoran ve güncel fiyat sorusunda canlı kontrol yapamadığı açıklandı; fiyat uydurulmadı.
- 32 web testi, 96 backend testi ve TypeScript kontrolü yeniden geçti. Bunlar yukarıdaki anlamsal kalite problemlerini yakalamıyordu; canlı audit scriptine senaryo bazlı kabul kontrolleri eklendi.

## Gerçek zaman ve ekran sınırları

Sohbet POST/JSON ile yanıtı tamamlandıktan sonra tek parça gösteriyor; token akışı/SSE yok. Canlı restoran, menü fiyatı, açılış saati veya trafik sağlayıcısı yok. Bilgi tabanı İstanbul, Roma ve Tokyo için üç kısa gastronomi özetinden oluşuyor; içerik otomatik güncellenmiyor. Bunlar “tüm dünya için gerçek zamanlı en iyi rota” iddiasını desteklemez.

Canlı `/ai/` sayfası erişilebilir. HTML, JavaScript varlıkları ve CORS kontrolü `live-chat-web.json` içinde kayıtlıdır. Browser bağlantısı yoktu (`browsers.list() = []`); gerçek tarayıcıda giriş, mesaj gönderme, mobil görünüm, kaynak bağlantısına tıklama ve rotayı harita masasına aktarma bu turda doğrulanmadı. Kaynak kodunda UI'nın `orchestratorSummary`, `route`, `billing` sözleşmesini kullandığı görüldü; bu, tarayıcı testi yerine geçmez.

## Düzeltme ve yeniden kabul sırası

1. Sohbet hedefini açık yapılandırılmış bağlam olarak taşıyıp takip mesajında şehir değişimini denetlemek; hedef yoksa netleştirme istemek.
2. Genel sohbet ile rota üretimini ayırmak; rota istenmeyen yanıttaki geçersiz rota alanının normal konuşmayı bozmamasını sağlamak.
3. Kaynakları hedef ve konuya göre daraltmak; kaynak atıflarını ilgili iddialarla eşleştirmek.
4. Yalnız başlık/işlem özeti veren yanıta kalite kontrolü eklemek; mevcut model ve alternatifleri bu senaryolarla karşılaştırmak.
5. Güncel POI/restoran/ulaşım sağlayıcıları ve içerik yenileme sürecini eklemek; ardından canlı veri ve rota doğrulaması yapmak.
6. Tarayıcı erişimiyle gerçek kullanıcı akışını ve gerekiyorsa token akışını test etmek.

## Tekrarlama ve kanıt

`node infra/scripts/audit-live-chat.cjs` altı gerçek model isteği yapar; küçük AWS maliyeti ve deneme kredileri kullanır. İstekler gerçek günlük sayaca dahildir. Semantik kabul kontrolleri başarısızsa çıkış kodu 1 olur. Otomatik kontroller bu sabit senaryolar içindir; insan değerlendirmesinin yerini almaz.

- [Ham istek/yanıt ve kalite sonuçları](live-chat-audit.json)
- [Canlı web ve CORS sonuçları](live-chat-web.json)
- [RAG mimarisi ve önceki yayın kaydı](../ai/travel-rag.md)
