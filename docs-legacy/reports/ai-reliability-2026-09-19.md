# AI sohbet güvenilirliği — 19 Eylül 2026

Bu çalışma yerel kaynak kodunu ve derleme çıktısını günceller; canlı ortama dağıtım yapmaz.

- Rota isteğinde gün sayısı eksikse ücretsiz netleştirme yapılır. İki günlük ücretli rota varsayımı kaldırılmıştır. Yedi günden uzun istekler bölümlere ayırma sorusuyla karşılanır.
- Modelin rota gün sayısını değiştirmesi, gün aralığı dışında durak üretmesi veya boş/geçersiz durak döndürmesi reddedilir. Fazladan duraklar sessizce atılmaz.
- Ek konaklama ve yerel keşif çıktılarının iç alanları doğrulanır. Hata durumunda hazır mekân/fiyat listeleri üretilmez; ana rota geçerliyse kullanılabilir. Ek çağrılar kalan yanıt süresiyle sınırlandırılır.
- Rota mesajı kendi ek bilgilerini taşır. Geçmiş rotayı açmak başka rotanın bilgilerini göstermez. Eksik veri için süresiz yükleniyor mesajı kaldırılmıştır. Duraklar arası mesafenin kuş uçuşu olduğu belirtilir.
- Belirsiz ağ, zaman aşımı ve sunucu hatalarında aynı işlem kimliği korunur. Bekleyen istek sohbet kaydıyla cihazda saklanır ve yenilemeden sonra kontrol edilebilir. O sohbet içinde sonuç netleşmeden yeni bir istek gönderilmez.
- Oturum yenileme sonrası ağ kesintisi, ilk isteğin 401 hatası gibi raporlanmaz. Böylece sonucunun bilinmediği bir ücretli işlem yanlışlıkla yeni kimlikle tekrarlanmaz.
- Konum girdileri sayısal sınırlarla doğrulanır. Güvenlik bilgisi için şehir seçimi mesajdaki eski şehirlerden değil hedef şehirden yapılır.

Doğrulama: web ve sunucu testleri, TypeScript kontrolü ve üretim derlemesi. Bu oturumda Browser bağlantısı bulunmadığından görsel/etkileşimli kontrol ve canlı AWS çağrısı yapılmadı. Model önerilerinin olgusal doğruluğu ve statik konsolosluk/acil durum referanslarının güncelliği bu kontrollerin kapsamı dışındadır.
