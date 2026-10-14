# Proje Tanımı, Vizyonu ve Kapsamı

## 1. Ürün Özeti
**MapsBridge (AdresKöprü)**; harita merkezli, yapay zekâ (AWS Bedrock) destekli, gizlilik ve açık rıza odaklı çok günlük seyahat planlama, rota koordinasyonu ve süreli konum paylaşım platformudur.

Uygulama, ticari seyahat tavsiyelerini ve yapay zekâyı tek bir interaktif harita masasında buluştururken; gizli arka plan takibi yapmaz, kullanıcının verilerini rızasız satmaz ve tam hesap izolasyonu sağlar.

---

## 2. Temel Değer Önerileri (Value Propositions)

1. **Açık Rızalı ve Süreli Paylaşım:** Kullanıcılar konumlarını veya duraklarını süreli bağlantılarla (`/k/?kod=...`) paylaşır. Süre dolduğunda veri kendiliğinden imha olur (`DynamoDB TTL`), kullanıcı dilerse tek tıkla anında iptal edebilir (`revoke`).
2. **Akıllı Seyahat Masası (Trip Desk):** Çok günlük seyahatlerin gün bazında duraklara ayrılması, OSRM motoru ile sürüş süresi ve rota optimizasyonu, sürükle-bırak durak yönetimi.
3. **AWS Bedrock Çoklu Ajan Asistanı:** Claude 3 Haiku / Amazon Nova ile çalışan asistan; uydurma veri üretmez, eksik parametreleri netleştirir (`clarify`), AWS Geo Places ve yerel RAG seyahat kanıtları ile gerçek mekanları doğrular.
4. **Gezgin Topluluğu ve Pazar Yeri:** Gezginlerin kendi rotalarını kamusal profillerinde (`/[username]`) sergilemesi, seyahat rehberleri satabilmesi ve topluluk rotalarını tek tıkla kendi masasına kopyalayabilmesi.
5. **Düşük Maliyetli ve Ölçeklenebilir Altyapı:** Next.js statik SPA çıktısı CloudFront + S3 üzerinden sıfır sunucu maliyetine yakın dağıtılırken; backend tamamen AWS Graviton ARM64 Lambda fonksiyonları ve DynamoDB On-Demand ile çalışır.

---

## 3. Kullanıcı Personaları

- **Bireysel Gezgin (Solo Explorer):** Hafta sonu veya tatil için hızlı, güvenilir ve pratik çok günlük rota planlamak isteyen kullanıcı.
- **Grup Lideri (Trip Organizer):** Arkadaş grubu veya ailesiyle seyahat eden, rotaları ve canlı pinleri mesajlaşma odasında koordine eden kullanıcı.
- **Seyahat İçerik Üreticisi (Travel Creator):** Rotalarını, rehberlerini ve deneyimlerini toplulukta paylaşan, kamusal profilini büyüten ve rehber satışından gelir elde eden kullanıcı.
- **Butik Seyahat Acentesi / Danışman (Agency User):** Müşterilerine özel rotalar tasarlayan, yüksek hacimli AI rota kredisi kullanan ve PDF/indirme çıktıları alan profesyonel kullanıcı.

---

## 4. Kapsam ve Yol Haritası Sınırları

### Kapsam Dahilinde (Active Scope)
- Harita masası ve pin yönetimi (Leaflet + OpenStreetMap)
- OSRM rota hesaplama motoru entegrasyonu
- Süreli konum paylaşımı ve maskelenmiş alıcı görünümü
- AWS Bedrock tabanlı çoklu ajan AI seyahat asistanı
- Stripe ile kredi paketi ve abonelik satışı
- Gezgin profili, topluluk rotaları ve mesajlaşma masası
- Yönetici denetim masası (FinOps, metrikler, kullanıcı yönetimi)

### Kapsam Dışında (Out of Scope / Non-Goals)
- Arka planda gizli ve rızasız GPS takibi
- Canlı video veya sesli arama altyapısı
- Dünya çapında kendi harita karo (tile) sunucumuzu barındırma (Cloud tile sağlayıcıları kullanılır)
- Büyük ve maliyetli ilişkisel veritabanı kümeleri (DynamoDB tek tablo yeterlidir)
