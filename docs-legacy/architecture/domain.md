# Bounded Context ve Domain Sınırları

Bu belge, MapsBridge sistemindeki iş mantığı sınırlarını (Bounded Contexts) ve domainler arası iletişim sözleşmelerini tanımlar.

---

## 1. Bounded Context Haritası

```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     Identity    │◄──────┤      Trip       ├──────►│   Marketplace   │
│   (Auth/User)   │       │ (Desk/Routes)   │       │  (Guides/Blogs) │
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │                         │                         │
         │                         ▼                         │
         │                ┌─────────────────┐                │
         └───────────────►│       AI        │◄───────────────┘
                          │(Multi-Agent RAG)│
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │     Billing     │
                          │(Wallet/Credits) │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │    Messaging    │
                          │(Live WebSocket) │
                          └─────────────────┘
```

---

## 2. Domain Detayları ve Sorumlulukları

### 2.1 Identity (Kimlik ve Profil Domaini)
- **Sorumluluk:** Kullanıcı kaydı, doğrulanmış e-posta denetimi, şifre sıfırlama, kamusal profil yayınlama (`/profiles/{username}`), kullanıcı askıya alma durumları.
- **Ana Varlıklar (Entities/Value Objects):** `User`, `UserId (Cognito Sub)`, `Email`, `UserProfile`, `AccountStatus`.
- **Kural:** Diğer domainler kullanıcının e-posta adresini doğrudan anahtar olarak kullanamaz; yalnızca doğrulanmış `sub` (UserId) referansı alınır.

### 2.2 Trip (Seyahat ve Rota Domaini)
- **Sorumluluk:** Harita masası üzerindeki durak yönetimi, çok günlük seyahat planları, OSRM optimizasyonu, süreli konum ve rota paylaşımları (`/shares/{code}`).
- **Ana Varlıklar:** `Trip`, `TripDay`, `Stop`, `Coordinate (Lat, Lng)`, `ShareLink (Code, TTL)`.
- **Kural:** Her durak geçerli bir enlem/boylam taşımalıdır (`0` geçerli bir koordinattır; eksik koordinat rastgele şehirle doldurulamaz). Paylaşılan linklerde alıcıya sahibin kişisel verileri maskelenir.

### 2.3 AI (Yapay Zekâ ve Asistan Domaini)
- **Sorumluluk:** Çoklu ajan seyahat asistanı orkestrasyonu (Supervisor, Discovery, Transit/Stay, Emergency), AWS Geo Places ile durak doğrulama, RAG bilgi tabanı eşleştirmesi, kişisel tercih hafızası.
- **Ana Varlıklar:** `ConversationState`, `TripManifesto`, `PlaceEvidence`, `AIAgentExecution`, `PreferenceMemory`.
- **Kural:** AI asistanı doğrulanmamış fiyat üretemez. Eksik parametre olduğunda rota çizmek yerine kullanıcıya `clarify` sorusu yöneltir.

### 2.4 Billing (Ödeme ve Kredi Domaini)
- **Sorumluluk:** Kredi paketleri, abonelikler, cüzdan bakiyesi, Stripe Checkout ve Müşteri Portalı entegrasyonu, webhook imzası doğrulama, atomik kredi rezervasyonu ve iade.
- **Ana Varlıklar:** `Wallet`, `CreditBalance`, `StripeCustomer`, `Receipt`, `SubscriptionTier`, `IdempotencyKey`.
- **Kural:** Cüzdan bakiyesi asla negatife düşemez. Webhook'lar `stripe-signature` kontrolü olmadan hiçbir hak tanımlayamaz.

### 2.5 Messaging (Gerçek Zamanlı İletişim Domaini)
- **Sorumluluk:** Gezginlerin seyahat grubu içinde koordinasyonu, WebSocket üzerinden anlık mesajlaşma, canlı durak ve rota kartı paylaşımı, yazıyor ve okundu bildirimleri.
- **Ana Varlıklar:** `Thread`, `ChatMessage`, `ConnectionSession`, `Participant`.
- **Kural:** Bir kullanıcı yalnızca üyesi olduğu `Thread` içindeki mesajları görebilir; bağlantılar Cognito token süresini aşamaz (`authVersion: 1`).

### 2.6 Marketplace (Topluluk ve Pazar Yeri Domaini)
- **Sorumluluk:** Seyahat rehberleri ve blog yazılarının vitrinde yayınlanması, satın alma ve indirme izinleri, seyahat yazıları.
- **Ana Varlıklar:** `Guide`, `BlogPost`, `PurchaseOrder`.

### 2.7 Admin & FinOps (Yönetim Domaini)
- **Sorumluluk:** Sistem metrikleri, aktif oturumlar, kullanıcı askıya alma/açma, token tüketim analitiği, bakım modu ve acil durum anahtarları.
- **Ana Varlıklar:** `SystemMetrics`, `AuditLog`, `SystemConfig`.
