# Mimari Karar Kayıtları (Architecture Decision Records - ADR)

Bu belge, MapsBridge projesinde alınan kritik mimari ve mühendislik kararlarını belgeler.

---

### ADR-001: Veritabanı Olarak Amazon DynamoDB Tek Tablo Tasarımı
- **Tarih:** 2026-09-10
- **Bağlam:** Sistem, yüksek eşzamanlılık, düşük gecikme, süreli veri imhası (TTL) ve minimum operasyonel maliyet gerektirmektedir.
- **Karar:** Birincil veri depolama katmanı olarak Amazon DynamoDB Tek Tablo Tasarımı (`adreskopru-{env}-data`) seçildi.
- **Nedenler:**
  - On-Demand faturalandırma ile sıfır taban maliyet.
  - Dahili TTL ile konum linklerinin otomatik imhası.
  - `TransactWriteItems` ile atomik kredi ve ödeme mutabakatı.
- **Reddedilen Alternatifler:** Aurora PostgreSQL (Yüksek taban maliyet ve VPC/bağlantı karmaşıklığı).

---

### ADR-002: Frontend İçin Next.js 16 Statik SPA Export ve S3/CloudFront
- **Tarih:** 2026-09-11
- **Bağlam:** Harita masası ve rota planlayıcı istemci tarafında zengin etkileşim (Leaflet) gerektirir. Sürekli sunucu çalıştırma maliyeti azaltılmalıdır.
- **Karar:** Next.js `output: "export"` ile tamamen statik SPA olarak derlenip AWS S3 + CloudFront üzerinden servis edildi.
- **Nedenler:**
  - Sunucusuz, küresel CDN önbelleği ile ultra hızlı açılış.
  - Node.js sunucu yönetimi veya container çalıştırma zorunluluğunu ortadan kaldırma.
- **Sonuçlar:** Tüm dinamik işlemler API Gateway ve Lambda üzerinden REST/WebSocket ile yürütülür.

---

### ADR-003: AWS Bedrock ve Çoklu Ajan Mimarisi
- **Tarih:** 2026-09-15
- **Bağlam:** Seyahat planlaması uydurma veri (hallucination) kabul etmez; gerçek mekanlar ve ulaşım olasılıkları doğrulanmalıdır.
- **Karar:** AWS Bedrock üzerinde Claude 3 Haiku / Amazon Nova ve Supervisor-Subagent mimarisi uygulandı. AWS Geo Places API ve RAG seyahat kanıtları ile desteklendi.
- **Nedenler:**
  - Güvenilir JSON çıktı şemaları ve düşük maliyetli token fiyatlandırması.
  - AWS ekosistemi içinde kapalı devre, veri gizliliği garantisi.

---

### ADR-004: Tasarımda Saf Vanilla CSS Kullanımı
- **Tarih:** 2026-09-18
- **Bağlam:** Sayfa açılış hızı, bağımsız stil yönetimi ve modern estetik (glassmorphism, animasyonlar, mobil uyum) gereksinimi.
- **Karar:** Harici CSS kütüphaneleri (Tailwind vb.) yerine saf Vanilla CSS tercih edildi.
- **Nedenler:**
  - Derleme süresi bağımsızlığı, sıfır runtime overhead.
  - Tam kontrol ve esnek tema değişkenleri (`var(--...)`).
