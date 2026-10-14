# Sohbet ve rota davranışı — 19 Eylül 2026

Yerel uygulama, mevcut Bedrock Claude Haiku 4.5 modelini kullanmaya devam eder. Model ağırlıkları yeniden eğitilmedi; fine-tuning işi açılmadı. Bu çalışma konuşma orkestrasyonunu, örneklerle verilen davranış talimatlarını, araştırmayı, kaynak kullanımını ve çıktı doğrulamasını değiştirir.

## Uygulanan akış

1. Son 12 mesaj kullanıcı/asistan rolleriyle Bedrock Converse'a iletilir. Tek mesaj en fazla 2400 karakterdir. Kullanıcıya ait gezi bağlamı ve mevcut rota ayrıca sunucuda korunur.
2. Sürüm kontrollü `travel-dialogue-v2` talimatları; sohbet, karşılaştırma, eksik bilgi toplama, yeni rota ve mevcut rotayı düzenleme ayrımını örnek diyaloglarla açıklar. Netleştirme cümlesini model üretir; gerekli bilgi eksikse ücretli rota üretilmez.
3. Kullanıcının açık kısıtları (örneğin “çok yürümek istemiyorum”) gezi bağlamında tutulur. Modelin kullanıcı metninde bulunmayan kısıtları kabul edilmez. Telefon/e-posta biçimindeki veriler bu alana alınmaz. Kalıcı seyahat profili ayrı kalır.
4. Yer araştırmasına uzun cümle göndermek yerine kısa yer adları ve İngilizce kategoriler kullanılır. Az sonuç/hata durumunda gezi bilgisi korunarak ücretsiz açıklama döner. Mekân adı ve koordinatları yine Amazon Location'dan gelir.
5. Modelin aday rotası doğrulanır. Gün ve durak kimliği hatası veya düzenleme sözleşmesine aykırılık varsa, kalan süre yeterliyse bir kez hata açıklamasıyla düzeltme istenir. Hatalı aday kullanıcıya ve ücretli makbuza yazılmaz.
6. Tek güne durak eklerken eski duraklar ve günleri korunur. Çıkarmada hedef durakların kaybolduğu ve korunan durakların yerinde kaldığı denetlenir. Kullanıcının/modelin durak sırası en yakın komşu algoritmasıyla sessizce değiştirilmez.
7. Başka şehir hakkındaki bilgi sorusu kayıtlı rotayı değiştirmez. Kullanıcı sonra mevcut rotanın ilk gününü sorduğunda asistan gerçek durakları görür. Arayüz de sohbet yanıtında açık rotayı korur.
8. Konaklama/keşif ek çağrıları her rotada otomatik çalışmaz; ilgili açık talebe göre çalışır. Eksik ek bilgiler için panelden sohbet sorusu hazırlanabilir. Böylece istenmeyen çağrılar ana rotayı bekletmez.
9. Başlık, paragraf, liste, kalın vurgu, kod ve HTTPS kaynak bağlantıları güvenli bir Markdown alt kümesiyle gösterilir. Model HTML'i çalıştırılmaz.

## Kaynaklı bilgi

Mevcut üç şehirlik pilot korpus ile `data/travel/reviewed.json` içindeki iki yeni Lima özeti derlemeye dahil edilir. Vektör araması yapılandırılmasa veya çalışmasa da ilgili şehir ve yemek konusu eşleşiyorsa bu küçük incelenmiş kaynak kümesi kullanılabilir. Süresi dolmuş içerik elenir; başka şehrin kaynağı kendiliğinden taşınmaz. Bu, dünya çapında kapsamlı bir bilgi tabanı değildir.

Lima testi sırasında görülen yemek/içki karışıklığı için kısa özgün özetler şu resmî kaynaklardan hazırlandı:

- [Peru Travel — Lima mutfağı](https://www.peru.travel/gastronomy/en/peruvian-cuisine/cuisine-of-lima.html)
- [Peru Travel — Pisco](https://www.peru.travel/gastronomy/en/peruvian-products/pisco.html)

Güncel fiyat, müsaitlik, açılış saati veya trafik doğrulaması eklenmedi. Statik acil durum/konsolosluk referansları bu çalışmada yeniden doğrulanmadı. Modelin kaynak dışı genel bilgisi ve dil kalitesi hâlâ hatalar içerebilir.

## Değerlendirme

`apps/web/evals/travel-dialogues.json` üretim konuşmalarından alınmamış, elle yazılmış test senaryolarıdır; eğitim verisi veya fine-tuning çıktısı değildir. `apps/web/evals/golden-travel-cases.json` ise model/prompt değişiklikleri için 100 örnekli kategori manifestidir ve eğitim verisi değildir. `npm run eval:ai` mevcut 12 dönüşlü regresyonu, `npm run eval:golden` ise 100 golden örneği gerçek Bedrock ve Amazon Location servisleriyle çalıştırır. AWS kullanım maliyeti oluşturur; üretim kullanıcı/kredi kayıtlarını değiştirmez. Manifest ve kalite kapısı `npm run eval:golden:validate` ile, gerçek golden rapor üretildikten sonra rapor karşılaştırması ise `npm run eval:golden:validate -- <golden-rapor-yolu>` ile çalıştırılır. Golden olmayan eski regresyon raporları yanlışlıkla baseline'a karşı başarısız sayılmaz.

- İlk 10 senaryoluk geçiş: **7/10**; uzun yer arama sorguları rota akışını bozdu. İlk rapor korundu.
- Arama düzeltmesi sonrası aynı 10 senaryo: **10/10**. İkinci rapor korundu.
- Kaynak kullanımı, Pisco bilgisi ve durak çıkarma kontrollerini de içeren son küme: **12/12**.
- Son kaynak koduyla **62 web testi + 100 sunucu testi** başarılı. TypeScript kontrolü ve üretim derlemesi başarılı.

Son gerçek testte netleştirme 2,6–3,0 sn, sohbet 5,3–12,5 sn, rota oluşturma/düzenleme 14,0–16,4 sn sürdü. Bunlar bu denemenin ölçümleridir; performans garantisi değildir.

Bu testler niyet, bağlam, kaynak kimliği ve rota yapısını denetler. Her tarihî/mutfak iddiasının doğruluğunu, tüm ifadelerin doğal Türkçe olmasını, mekân erişilebilirliğini veya gerçek yürüyüş güzergâhını kanıtlamaz. Tarayıcı bağlantısı bulunmadığından etkileşimli görsel doğrulama yapılmadı.

Değişiklikler yereldir; canlı Lambda/web dağıtımı veya yeni korpusun uzak vektör deposuna aktarımı yapılmadı. Önceki dağıtım yönergeleri geçerlidir. Konuşma mesajlarını rol bazında iletme yaklaşımı [AWS Converse API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html), kategori sorguları ise [Amazon Location SearchText](https://docs.aws.amazon.com/location/latest/developerguide/how-to-search-category-name.html) sözleşmesine dayanır.
