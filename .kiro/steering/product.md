---
inclusion: always
---

# MapsBridge — Ürün Bağlamı

MapsBridge, AWS serverless üzerine kurulu, yapay zeka destekli **seyahat planlama ve konum paylaşımı** platformudur. Canlı: mapsbridge.com

## Ne Yapar

- **Çok günlü gezi planlayıcı**: Kullanıcılar gün gün duraklar (pin) ekler, OSRM ile rota optimize edilir.
- **AI seyahat asistanı**: AWS Bedrock (Claude, Nova) üzerinden çok modelli orkestrasyon ile rota oluşturma, düzenleme ve sohbet.
- **Topluluk**: Gezginlerin rota paylaşması, rehberler, marketplace.
- **Güvenli konum paylaşımı**: Süreli, onaya dayalı bağlantılar (`/k/?code=...`).
- **Gerçek zamanlı mesajlaşma**: WebSocket tabanlı sohbet.
- **Kredi tabanlı faturalandırma**: Stripe (web) + RevenueCat (mobil) entegrasyonu.
- **İki dilli UI**: Türkçe / İngilizce, otomatik dil algılama.

## Kredi Modeli (AI Kullanımı)

Krediler **yalnızca sunucuda** düşülür; istemci asla doğrudan kredi harcamaz. Maliyet tablosu:

| İşlem                                             | Kredi    |
| ------------------------------------------------- | -------- |
| Tercih netleştirme                                | Ücretsiz |
| AI sohbet (`ai_chat`)                             | 1        |
| Rota optimizasyonu (`route_optimize`)             | 1        |
| Konaklama & gastronomi analizi (`ai_stay_dining`) | 2        |
| Derin çok günlü rota (`ai_deep_trip`)             | 5        |

Abonelik kademeleri: `free` (Gezgin, 100 hoş geldin kredisi; sunucu `initializeTrial` ile hizalı) · `explorer` (Kaşif, aylık 100) · `pro` (Pro Kaşif, aylık 500) · `agency` (Tur Lideri, aylık 2500).

## Dil

Kullanıcıya dönük tüm metinler ve çoğu kod yorumu **Türkçe**. Değişken/fonksiyon adları İngilizce olabilir ama UI stringleri Türkçe yazılır.

## Uyumluluk

KVKK/GDPR uyumlu. Konum ve kişisel veri işlenirken onay ve maskeleme kurallarına dikkat edilir.
