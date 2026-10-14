# MapsBridge — Enterprise Monitoring & Observability Hub

Bu dizin, MapsBridge platformunun tüm bileşenlerini (Frontend, Backend, Mikroservisler, Altyapı, FinOps ve Güvenlik) 7/24 izleyen kurumsal **Gözlemlenebilirlik (Observability)** merkezidir.

---

## 🏛️ Dizin Yapısı ve Modüller

```
monitoring/
├── backend/                       # Backend, Lambda, DynamoDB, API Gateway ve Cognito metrikleri
├── frontend/                      # Web & Mobile Core Web Vitals, Client Error Tracking ve CDN metrikleri
├── services/                      # 6 Mikroservis için özel SLI/SLO sağlık eşikleri ve operasyonel metrikler
├── dashboards/                    # CloudWatch Dashboard şablonları (Executive, Services, FinOps)
├── alarms/                        # P1 (Kritik) ve P2 (Uyarı) CloudWatch alarm tanımları
├── synthetics/                    # Canlı API uç noktalarını düzenli denetleyen sentetik canary scriptleri
└── tracing/                       # Dağıtık izleme (Distributed Tracing, X-Ray ve Correlation ID)
```

---

## 1. Backend İzleme (`monitoring/backend/`)
- **API Gateway:** HTTP API v2 ve WebSocket API için 4xx/5xx hata oranları, entegrasyon gecikmeleri ve aktif WebSocket bağlantı sayıları.
- **AI Assistant:** `monitoring/alarms/ai-assistant.json`, `MapsBridge/TravelAI` EMF metrikleri için hata oranı, p95 latency ve provider/research timeout alarm eşiklerini tanımlar. Bu dosya alarm dağıtım şablonudur; SNS hedefi ortamın on-call politikasına göre eklenmelidir.
- **AWS Lambda:** Soğuk başlatma (Cold Start) süreleri, yürütme süreleri (P50, P90, P99), eşzamanlı çalışma (Concurrency) ve bellek tüketimi.
- **DynamoDB:** Single-Table ve izole servis tabloları için harcanan RCU/WCU, okuma/yazma gecikmeleri ve `ProvisionedThroughputExceeded` (Throttling) alarmları.
- **Cognito:** Kimlik doğrulama başarı/hata oranları, geçersiz token girişimleri ve oturum açma gecikmesi.

---

## 2. Frontend & İstemci İzleme (`monitoring/frontend/`)
- **Core Web Vitals:** Next.js SPA için Google standartlarında LCP (Largest Contentful Paint), FID (First Input Delay), CLS (Cumulative Layout Shift) ve INP (Interaction to Next Paint) ölçümleri.
- **Client Error Tracker:** İstemcide meydana gelen yakalanmamış JavaScript hataları (`window.onerror`), reddedilen Promise'lar (`unhandledrejection`) ve ağ zaman aşımları.
- **CloudFront CDN:** Önbellek isabet oranı (Cache Hit Ratio), origin gecikmesi ve 4xx/5xx oranı.

---

## 3. Servis Seviyesi İzleme (`monitoring/services/`)
Her mikroservis kendi SLA/SLO taahhütlerine göre izlenir:
1. **`ai-assistant`:** Bedrock Nova Micro / Claude Haiku API gecikmesi, harcanan token maliyeti, RAG vektör arama başarısı, günlük kullanıcı/servis kotası.
2. **`identity-billing`:** Stripe Webhook teslimat gecikmesi, idempotent kredi ekleme/çıkarma makbuzları, ödeme dönüşüm oranları.
3. **`map-trip`:** Rota optimizasyon süresi, `/k/:code` süreli paylaşım TTL doğrulama ve harita karo (tile) yükleme performansı.
4. **`messaging`:** WebSocket mesaj iletim süresi (P95 < 150ms), istemci düşme/yeniden bağlanma oranları.
5. **`community`:** Herkese açık rehber okuma hızı, arama filtre performansı.
6. **`admin-service`:** Audit log yazma başarısı, bakım modu geçiş denetimleri.

---

## 4. Sentetik Testler (Canary Synthetics)
Her 5 dakikada bir otomatik çalışan canary testi (`npm run monitor:synthetics`):
- `/system/status` (Genel sistem sağlığı)
- `/marketplace/blogs` (Herkese açık içerik akışı)
- `/admin/session` (401 Auth gate denetimi)
- `/chat/ws` (WebSocket handshake denetimi)

---

## 5. Dağıtık İzleme (Distributed Tracing: `x-correlation-id`)
İstemciden başlayan her işlem benzersiz bir `x-correlation-id` alır:
`Client ➔ CloudFront ➔ API Gateway ➔ Lambda ➔ DynamoDB / Bedrock ➔ EventBridge`
Tüm loglar ve AWS X-Ray subsegmentleri bu kimlikle indekslenir.
