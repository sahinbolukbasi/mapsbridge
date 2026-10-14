# Güvenlik, Kimlik Doğrulama ve Gizlilik İlkeleri

Bu belge, MapsBridge altyapısındaki güvenlik, veri koruma, KVKK/GDPR ve kimlik yönetimi standartlarını belirler.

---

## 1. Temel Güvenlik İlkeleri (Security by Design)

1. **Açık Rıza ve Sıfır Gizli Takip:** Sistem arka planda izinsiz konum verisi toplamaz. Konum paylaşımı yalnızca kullanıcının açık rızasıyla ve seçtiği durak bazında süreli olarak yapılır.
2. **Doğrulanmış Kimlik İlkesi:** İstemci tarafından gönderilen kullanıcı kimlikleri (`userId`, `email`) asla güvenilir kabul edilmez. Tüm korumalı uç noktalarda kimlik, Amazon Cognito User Pool public key'leri ile kriptografik olarak doğrulanmış JWT token'ının `sub` alanından türetilir.
3. **Alıcı Veri Maskeleme:** Süreli konum linkini (`/k/?kod=...`) açan alıcıya paylaşanın e-posta adresi, telefon numarası veya profil detayları gösterilmez; yalnızca izin verilen harita pinleri sunulur.
4. **Süreli TTL ve Kalıcı İmha:** Süresi dolan tüm geçici paylaşımlar DynamoDB Time-To-Live (TTL) mekanizması ile sunucudan otomatik olarak silinir. Kullanıcı dilediği an `revoke` işlemiyle veriyi anında erişilmez kılabilir.

---

## 2. API ve Ağ Güvenliği

1. **Stripe Webhook İmza Doğrulaması:** Tüm Stripe webhook çağrıları `stripe.webhooks.constructEvent` ile resmi imza doğrulaması (`stripe-signature`) yapılmadan kabul edilmez. İmzası doğrulanmamış hiçbir istek bakiye veya kredi tanımlayamaz.
2. **CORS ve Origin Koruması:** Üretim ortamında CORS yalnızca `https://mapsbridge.com` veya yapılandırılmış frontend domaini ile sınırlandırılır.
3. **Throttling ve Rate Limiting:** API Gateway seviyesinde istek kota ve limitleri aktiftir. AI uç noktalarında kullanıcı bazlı günlük istek limiti (`AI_DAILY_REQUEST_LIMIT`) uygulanır.
4. **Girdi Temizleme (Sanitization):** XSS ve enjeksiyon saldırılarını önlemek için tüm kullanıcı girdileri ve AI yanıtları temizlenir (`sanitizePreferences`).

---

## 3. Secret ve Ortam Değişkeni Yönetimi

- Repoya hiçbir `.env`, AWS erişim anahtarı, Stripe secret key veya veritabanı şifresi commit edilemez.
- Hassas anahtarlar AWS SSM Parameter Store veya AWS Secrets Manager üzerinden şifrelenmiş (KMS) olarak okunur.
- `.gitignore` dosyası tüm yerel ortam dosyalarını (`.env.local`, `.env.production`) dışlayacak şekilde yapılandırılmıştır.
