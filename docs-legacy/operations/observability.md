# Gözlemlenebilirlik, Loglama ve FinOps İzleme

Bu belge, sistemin loglama, metrik toplama, hata izleme ve maliyet takip standartlarını açıklar.

---

## 1. Yapılandırılmış Loglama (Structured Logging)

Tüm Lambda fonksiyonlarında ve sunucu işlemlerinde JSON formatında yapılandırılmış loglar kullanılır:

```json
{
  "timestamp": "2026-09-26T18:00:00.000Z",
  "level": "INFO",
  "domain": "AI",
  "action": "route_generated",
  "userId": "eu-central-1:xxxx-xxxx",
  "requestId": "req_8f7b2c9a1d",
  "durationMs": 1420,
  "cost": 5,
  "model": "anthropic.claude-3-haiku-20240307-v1:0"
}
```

- Hassas veriler (kart numarası, tam adres, şifre) loglara **kesinlikle yazılmaz**.
- Her istekte benzersiz bir `requestId` veya `correlationId` loglanır.

---

## 2. AI ve FinOps Metrikleri

AWS Bedrock çağrılarında şu metrikler kaydedilir:
1. **Giriş ve Çıkış Token Sayısı:** Model maliyetinin tam olarak izlenmesi.
2. **Yanıt Süresi (Latency):** Model gecikmesinin kullanıcı deneyimine etkisi.
3. **Kredi Düşüm Durumu:** Atomik rezervasyon ve sonuç eşleşmesi.
4. **Günlük Harcama:** CloudWatch dashboard ve `aws_budgets_budget.monthly` alarmları.

---

## 3. Sistem Sağlığı ve Alarm Eşikleri

- **Hata Oranı (5xx):** %1'i aştığında CloudWatch Alarm tetiklenir.
- **WebSocket Bağlantı Sayısı:** Aktif oturum limitleri izlenir.
- **DLQ Mesaj Sayısı:** `stripe-webhooks-dlq` kuyruğuna düşen başarısız ödeme mesajları için anında uyarı verilir.
