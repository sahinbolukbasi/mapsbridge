# REST ve WebSocket API Sözleşmeleri

Bu belge, MapsBridge API Gateway (HTTP v2 & WebSocket v2) uç noktalarını ve sözleşmelerini tanımlar.

---

## 1. HTTP API v2 Uç Noktaları

Tüm isteklerde `Authorization: Bearer <token>` başlığı (anonim açık noktalar hariç) gereklidir. Başarılı yanıtlar `200` veya `201` ile `application/json` formatında döner.

### 1.1 AI Asistanı (`/ai`)
- `GET /ai/route-planner` — Kullanıcı cüzdanını, kalan hakları ve AI tercihlerini döndürür.
- `POST /ai/route-planner` — Bedrock multi-agent seyahat planı veya sohbet yanıtı üretir.
  - **Body:** `{ prompt, conversationHistory?, conversationId?, requestId, tripManifestoMarkdown?, userLocation? }`
  - **Dönüş:** `{ success: true, responseMode: 'route'|'chat'|'clarify', orchestratorSummary, route?, clarification?, cost }`

### 1.2 Rotalar ve Seyahat Masası (`/routes`)
- `GET /routes` — Kullanıcının kayıtlı seyahat rotalarını listeler.
- `POST /routes` — Yeni rota kaydeder.
- `GET /routes/{id}` — Rota detaylarını getirir.
- `PUT /routes/{id}` — Rotayı günceller.
- `DELETE /routes/{id}` — Rotayı siler.
- `POST /routes/{id}/share` — Süreli paylaşım kodu üretir.
- `GET /routes/{id}/osrm/{profile}` — OSRM yönlendirme ve mesafe optimizasyonunu döndürür.

### 1.3 Süreli Paylaşım (`/shares`)
- `GET /shares/{code}` — Alıcı için maskelenmiş konum ve durak detaylarını döndürür (Kimlik doğrulama gerektirmez).
- `POST /shares/{code}/revoke` — Paylaşım sahibi tarafından anında yayından kaldırılır.

### 1.4 Kimlik ve Profil (`/auth`, `/profile`, `/profiles`)
- `POST /auth/reset-password` — Şifre sıfırlama kodu gönderir.
- `POST /profile/publish` — Gezgin profilini kamusal olarak yayınlar.
- `POST /profile/unpublish` — Profili gizliye çeker.
- `GET /profiles/{username}` — Kamusal gezgin profil detaylarını getirir (Açık uç nokta).

### 1.5 Ödeme ve Stripe (`/stripe`)
- `GET /stripe/plans` — Aktif kredi paketleri ve abonelik fiyatlarını listeler.
- `GET /stripe/wallet` — Cüzdan bakiyesini getirir.
- `GET /stripe/subscription` — Aktif abonelik detaylarını getirir.
- `POST /stripe/checkout` — Stripe Checkout oturumu oluşturur (Yönlendirme URL'i döner).
- `POST /stripe/portal` — Stripe Müşteri Portalı oturumu oluşturur.
- `POST /stripe/webhook` — Stripe ödeme olaylarını dinler (Stripe imza doğrulamalı).

### 1.6 Mesajlaşma (`/chat`)
- `GET /chat/threads` — Kullanıcının dahil olduğu sohbet odalarını listeler.
- `POST /chat/threads` — Yeni gezi sohbet odası açar.
- `GET /chat/threads/{id}/messages` — Oda mesaj geçmişini getirir.
- `POST /chat/threads/{id}/messages` — Odaya HTTP üzerinden mesaj yazar.

### 1.7 Pazar Yeri (`/marketplace`)
- `GET /marketplace/guides` — Kamusal rehberleri listeler.
- `GET /marketplace/guides/{id}` — Rehber detayını getirir.
- `POST /marketplace/guides` — Yeni rehber yayınlar.
- `POST /marketplace/guides/{id}/purchase` — Rehberi satın alır.

### 1.8 Yönetim Masası (`/admin`)
- `GET /admin/metrics` — Sistem genel metriklerini döner.
- `GET /admin/token-usage` — FinOps Bedrock token tüketimini döner.
- `POST /admin/users/{id}/suspend` — Kötüye kullanım yapan hesabı askıya alır.

---

## 2. WebSocket API v2 Sözleşmesi

- **Bağlantı URL:** `wss://api.mapsbridge.com?token=<Cognito_JWT_Token>`
- **Bağlantı Yaşam Döngüsü:**
  - `$connect`: Token doğrulanır, `connections` tablosuna `userId` ve `expiresAt` ile yazılır.
  - `$disconnect`: Bağlantı kaydı silinir.
- **Eylemler (Client ➔ Server):**
  - `send_message`: `{ action: "send_message", threadId, text, routeEmbed?, locationPin? }`
  - `typing`: `{ action: "typing", threadId }`
  - `mark_read`: `{ action: "mark_read", threadId, messageId }`
