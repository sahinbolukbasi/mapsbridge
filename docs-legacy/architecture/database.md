# Veritabanı Mimarisi ve DynamoDB Şeması

Bu belge, MapsBridge sistemindeki birincil veri kaynağı olan Amazon DynamoDB Tek Tablo Tasarımını (Single-Table Design) modeller.

---

## 1. Genel Yapı

- **Tablo Adı:** `adreskopru-{environment}-data`
- **Fatura Modeli:** Pay-Per-Request (On-Demand / Kullandıkça Öde)
- **Bölümleme Anahtarı (Partition Key - PK):** `PK` (String)
- **Sıralama Anahtarı (Sort Key - SK):** `SK` (String)
- **TTL Özelliği:** `expiresAt` (Epoch saniye — Süresi dolan kayıtlar DynamoDB tarafından otomatik silinir)
- **Şifreleme:** Server-Side Encryption (KMS)

---

## 2. Varlık ve Erişim Kalıpları (Access Patterns)

| Varlık Türü | PK Biçimi | SK Biçimi | Nitelikler / Açıklama |
|---|---|---|---|
| **Kullanıcı Cüzdanı & Kredi** | `USER#<sub>` | `WALLET` | `credits`, `welcomeClaimed`, `updatedAt` |
| **Kullanıcı Aboneliği** | `USER#<sub>` | `STRIPE_CUSTOMER` | `customerId`, `subscriptionId`, `tier`, `status` |
| **Kullanıcı Seyahat Rotası** | `USER#<sub>` | `ROUTE#<routeId>` | `name`, `stops`, `days`, `isPublic`, `updatedAt` |
| **Kullanıcı AI Tercihleri** | `USER#<sub>` | `AI_PREFERENCES` | `travelPace`, `dietary`, `interests`, `updatedAt` |
| **AI İşlem Rezervasyonu** | `USER#<sub>` | `AI#<requestId>` | `state` ('reserved'/'succeeded'/'failed'), `fingerprint`, `cost` |
| **Süreli Konum Paylaşımı** | `SHARE#<code>` | `METADATA` | `code`, `ownerSub`, `lat`, `lng`, `address`, `expiresAt` (TTL) |
| **Paylaşım İndeksi** | `LINK#<token>` | `METADATA` | `code`, `expiresAt` (TTL) |
| **Kamusal Gezgin Profili** | `PROFILE#<username>` | `PUBLIC` | `ownerSub`, `fullName`, `bio`, `avatarUrl`, `publishedAt` |
| **Profil Sahipliği** | `OWNER#<sub>` | `PUBLIC_PROFILE` | `username`, `createdAt` |
| **Sohbet Odası (Thread)** | `THREAD#<threadId>` | `META` | `title`, `tripId`, `participants` (Array), `createdAt` |
| **Sohbet Mesajı** | `THREAD#<threadId>` | `MSG#<timestamp>` | `senderSub`, `senderName`, `text`, `routeEmbed`, `locationPin` |
| **Ödeme Makbuzu** | `BILLING#CHECKOUT#<id>`| `RECEIPT` | `userId`, `amount`, `credits`, `status`, `createdAt` |
| **Sistem Ayarları** | `SYSTEM#CONFIG` | `META` | `maintenanceMode`, `maintenanceMessage` |

---

## 3. WebSocket Bağlantı Tablosu (`connections`)

- **Tablo Adı:** `adreskopru-{environment}-connections`
- **PK:** `connectionId` (String)
- **TTL:** `expiresAt` (Doğrulanmış JWT süresini aşamaz)
- **Nitelikler:** `userId (Cognito Sub)`, `authVersion` (1), `connectedAt`.

---

## 4. Veritabanı Kuralları ve Güvenlik

1. **Doğrudan SQL Bağlantısı Yok:** Sistem transactional ve ölçeklenebilir DynamoDB tek tablosu üzerinde çalışır.
2. **Atomik Kredi İşlemleri:** Kredi düşümleri ve yüklemeleri `UpdateItem` veya `TransactWriteItems` ile atomik şart kontrolleri (`condition: credits >= :cost`) altında yapılır.
3. **Destructive Migration Yasağı:** Üretim veritabanında kolon silme veya tablo sıfırlama işlemi otomatik yapılamaz.
