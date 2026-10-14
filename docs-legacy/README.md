# MapsBridge — Dokümantasyon Merkezi

MapsBridge seyahat, harita planlama, yapay zekâ destekli gezi asistanlığı ve topluluk platformunun güncel teknik dokümantasyon merkezidir.

Bu dizin ve kök dizindeki mimari sözleşmeler; projenin mimarisini, kullanıcı iş akışlarını, bulut altyapısını, güvenlik modellerini ve yapay zekâ çalışma ilkelerini eksiksiz sunar.

---

## 🏛️ Kök Mimari ve Tasarım Sözleşmeleri

Sistemdeki temel kurallar ve mimari sınırlar kök dizindeki ana belgelerde tanımlıdır:

| Belge | Kapsam |
|---|---|
| 📋 [docs/product/overview.md](product/overview.md) | Projenin amacı, iş modeli, kullanıcı değeri ve temel yetenekleri. |
| 🏛️ [docs/architecture/system.md](architecture/system.md) | Katmanlı Clean Architecture mimarisi, modül sınırları, frontend/backend ayrımı. |
| 🌐 [docs/architecture/microservices-architecture.md](architecture/microservices-architecture.md) | 6 Mikroservisli dağıtık mimari, EventBridge haberleşme, database-per-service ve mobile-ready altyapı planı. |
| 🎯 [docs/architecture/domain.md](architecture/domain.md) | Bounded context'ler, aggregate'ler, value object'ler ve domain event kuralları. |
| 💼 [docs/product/business-model.md](product/business-model.md) | Freemium, kredi modeli, Stripe entegrasyonu ve gelir akışları. |
| 🗄️ [docs/architecture/database.md](architecture/database.md) | DynamoDB Single-Table Design şemaları (PK/SK, GSI'lar, TTL, versiyonlama). |
| 🔌 [docs/architecture/api.md](architecture/api.md) | HTTP API v2 ve WebSocket uç noktaları, request/response sözleşmeleri, hata kodları. |
| 🛡️ [docs/operations/security.md](operations/security.md) | Cognito JWT doğrulaması, Stripe webhook imzası, rol tabanlı erişim kontrolü (RBAC). |
| 🚀 [docs/operations/deployment.md](operations/deployment.md) | Next.js Static Export, S3/CloudFront dağıtımı, Lambda esbuild paketleme, Terraform. |
| 🧪 [docs/development/testing.md](development/testing.md) | Birim testleri, regresyon testleri ve Playwright test stratejisi (227/227 test yeşil). |
| 📊 [docs/operations/observability.md](operations/observability.md) | CloudWatch logları, metrikler, alarmlar ve FinOps maliyet takibi. |
| ⚖️ [docs/architecture/decisions.md](architecture/decisions.md) | Mimari Karar Kayıtları (ADR): Clean Architecture, Vanilla CSS, Static Export vb. |
| 🤖 [AGENTS.md](../AGENTS.md) | AI Agent geliştirme protokolü, katı kurallar ve rol tanımları. |
| 📝 [docs/development/tasks.md](development/tasks.md) | Aktif ve tamamlanan geliştirme görevleri listesi. |

---

## 📚 Dokümantasyon İndeksi (`docs/`)

Bu dizindeki tüm belgeler gözden geçirilmiş, eski/çelişkili kayıtlar temizlenmiş ve güncel mimariyle tutarlı hale getirilmiştir:

### 1. Yönetim ve Entegrasyon
- **[docs/product/admin-panel.md](product/admin-panel.md)**: Yönetim paneli (`/admin/` ve `/u/admin/`), Cognito gruplarına dayalı RBAC (admin, moderator, support), bakiye/kredi yönetimi, içerik yayınlama (`/articles/`), destek talepleri (`/support/`) ve sistem bakım modu.
- **[docs/integrations/google-maps-mcp.md](integrations/google-maps-mcp.md)**: Model Context Protocol (MCP) üzerinden Google Cloud Platform ve Google Maps entegrasyonu, yerel ve uzak sunucu yapılandırması.

### 2. Yapay Zekâ & AWS Bedrock Asistanı
- **[docs/plans/agentcore-architecture.md](plans/agentcore-architecture.md)**: AWS Bedrock tabanlı seyahat asistanı mimarisi; Concierge, Planner ve uzman alt ajanlar, Converse API, AgentCore Memory & Gateway tasarımı.
- **[docs/ai/model-selection-and-guardrails.md](ai/model-selection-and-guardrails.md)**: Çok katmanlı LLM model seçimi (Nova Micro, Claude Haiku, Claude Sonnet), güvenlik ve seyahat dışı konu kalkanı, otonom alt ajan tetikleme ve JSONL fine-tuning veri toplama boru hattı.
- **[docs/ai/runtime.md](ai/runtime.md)**: AI çalışma akışı, Converse API entegrasyonu, Amazon Nova Micro / Claude Haiku modelleri, tek DynamoDB transaction ile sonuç ve kredi kaydı, kota/günlük limit yönetimi.
- **[docs/ai/travel-rag.md](ai/travel-rag.md)**: Bedrock Retrieve & Knowledge Base altyapısı, Titan Text Embeddings V2, S3 vektör deposu ve onaylı seyahat veri sözleşmesi.
- **[docs/ai/context-flow.md](ai/context-flow.md)**: Sohbet bağlam akışı, Amazon Location arama entegrasyonu, kredi tarifesi (0 kredi netleştirme, 1 kredi sohbet, 5 kredi tamamlanan rota).
- **[docs/ai/dialogue-development.md](ai/dialogue-development.md)**: Diyalog orkestrasyonu, davranış talimatları, rota düzeltme ve değerlendirme senaryoları.
- **[docs/reports/ai-reliability-2026-09-19.md](reports/ai-reliability-2026-09-19.md)**: AI sohbet güvenilirliği, gün sayısı doğrulama, sayısal koordinat sınırları ve hata yönetimi.
- **[docs/reports/ai-architecture-operations.md](reports/ai-architecture-operations.md)**: AI altyapı envanteri, CloudWatch alarmları, SLO/SLA sağlık eşikleri ve operasyonel teşhis rehberi.
- **[docs/plans/ai-memory-fine-tuning.md](plans/ai-memory-fine-tuning.md)**: Kişisel hafıza (AgentCore Memory) mimarisi ve küçük model fine-tuning aşamalı geçiş planı.
- **[docs/ai/memory.md](ai/memory.md)**: Kişisel seyahat hafızası uygulama ve işletim rehberi, AgentCore Memory outbox akışı, unutma ve silme hakları.

### 3. Sistem Modernizasyonu
- **[docs/operations/modernization-documentation.md](operations/modernization-documentation.md)**: Sistem modernizasyonu için kapsamlı kurumsal dokümantasyon
- **[docs/operations/modernization-summary.md](operations/modernization-summary.md)**: Modernizasyon değişikliklerinin özetini içerir
- **[docs/operations/modernization-roadmap.md](operations/modernization-roadmap.md)**: Modernizasyon sürecinin zaman çizelgesi ve yolu
- **[docs/operations/modernization-changelog.md](operations/modernization-changelog.md)**: Yapılan değişikliklerin detaylı kaydı

### 3. Doğrulama ve Test Raporları
- **[verification/LIVE_CHAT_REVIEW.md](verification/live-chat-review.md)**: Canlı sohbet ve rota üretim kalite denetimi ve değerlendirme metrikleri.

### 4. Gözlemlenebilirlik ve Sentetik Canary İzleme
- **[monitoring/README.md](../monitoring/README.md)**: Backend (Lambda, DynamoDB, API Gateway, Cognito), frontend (Web Vitals), 6 mikroservis SLO panoları, CloudWatch P1/P2 alarmları, AWS X-Ray dağıtık izleme ve canlı canary sağlık denetleyicisi.

### 5. UI Tasarım Sistemi ve Ekran Şablonları
- **`packages/ui` (`@mapsbridge/ui`)**: Çoklu platform tasarım belirteçleri (renkler, tipografi, aralıklar, gölgeler) ve SVG ikon kütüphanesi.
- **`docs/designs/stitch-mockups/`**: Stitch MCP üzerinden üretilen yüksek kaliteli kullanıcı arayüzü ekran şablonları ve görselleri.

### 6. 🚀 AI-First Seyahat Asistanı Master Planı (13 Mimari Şartname)
- **[CURRENT_ARCHITECTURE.md](ai-master-plan/CURRENT_ARCHITECTURE.md)**: Mevcut sistem analizi, bileşenler ve Gap analizi.
- **[DOMAIN_MAP.md](ai-master-plan/DOMAIN_MAP.md)**: 18 Bounded Context, aggregate'ler ve domain değişmezleri.
- **[AI_ARCHITECTURE.md](ai-master-plan/AI_ARCHITECTURE.md)**: Conversation-first diyalog motoru, akıllı soru motoru ve structured JSON.
- **[AGENTS.md](ai-master-plan/AGENTS.md)**: 25 uzman alt ajan, niyet yönlendirme ve paralel çalıştırma modeli.
- **[TOOLS.md](ai-master-plan/TOOLS.md)**: 18 standart tool şeması, provider soyutlaması ve fallback stratejisi.
- **[DATA_SOURCES.md](ai-master-plan/DATA_SOURCES.md)**: 7 katmanlı veri önceliği, entity modelleri ve TTL politikaları.
- **[MEMORY.md](ai-master-plan/MEMORY.md)**: 4 katmanlı hafıza (Session, Trip, User Profile, Knowledge) ve şeffaf tercihler.
- **[RAG.md](ai-master-plan/RAG.md)**: Hibrit Arama (Vektör + Keyword + Geo), restoran ve mekan puanlama formülleri.
- **[MODEL_ROUTING.md](ai-master-plan/MODEL_ROUTING.md)**: Dinamik Model Router (Nova Micro, Claude Haiku, Claude Sonnet).
- **[COST_OPTIMIZATION.md](ai-master-plan/COST_OPTIMIZATION.md)**: FinOps telemetrisi, 6 hedef önbelleği ve Semantik Cache.
- **[OBSERVABILITY.md](ai-master-plan/OBSERVABILITY.md)**: Dağıtık izleme (`x-correlation-id`), SLO yanıt hedefleri ve kalite motoru.
- **[SECURITY.md](ai-master-plan/SECURITY.md)**: Seyahat kapsam kalkanı, Jailbreak savunması, PII maskeleme ve KVKK/GDPR.
- **[ROADMAP.md](ai-master-plan/ROADMAP.md)**: 14 Aşamalı Yol Haritası ve P0/P1/P2/P3 önceliklendirme matrisi.

---

## 🌐 Sayfa ve URL Yapısı (100% İngilizce)

Codebase'deki tüm sayfa dosya yolları ve tarayıcı URL rotaları standartlaştırılmış ve tamamen İngilizceye dönüştürülmüştür:

| URL Yolu | Açıklama |
|---|---|
| `/` | Ana sayfa (Landing page & keşif) |
| `/desk/` | Harita Masası (Harita, pinleme, rota yönetimi) |
| `/login/` | Kullanıcı girişi |
| `/register/` | Yeni üyelik kaydı |
| `/verify/` | E-posta doğrulama |
| `/reset-password/` | Parola sıfırlama |
| `/profile/` | Kullanıcı profili |
| `/profile/edit/` | Profil ve hesap ayarları |
| `/profile/photo/` | Profil fotoğrafı yükleme/düzenleme |
| `/messages/` | Birebir mesajlaşma (WebSocket & HTTP) |
| `/community/` | Gezgin topluluğu ve rehberler |
| `/checkout/` | Kredi satın alma ve abonelik işlemleri |
| `/support/` | Yardım ve destek talepleri |
| `/articles/` | Yayınlanan gezi yazıları ve bloglar |
| `/how-it-works/` | Nasıl çalışır bilgilendirme sayfası |
| `/cookies/` | Çerez ve depolama tercihleri |
| `/privacy/` | Gizlilik politikası |
| `/terms/` | Kullanım koşulları |
| `/admin/` | Yönetim paneli |
| `/ai/` | Yapay zekâ seyahat planlayıcısı |

---

## 🚀 Hızlı Başlangıç & Yerel Geliştirme

```bash
# Bağımlılıkları yükleme
npm install

# Yerel geliştirme sunucusunu başlatma (Port 3000)
npm run dev

# TypeScript tip kontrolü
npm run typecheck

# Birim testlerini çalıştırma (117 frontend testi)
npm test

# Backend güvenlik ve yetki regresyon testleri (110 backend testi)
npm run test:backend

# Toplam 227/227 test çalıştırılır ve yeşil kalmalıdır
npm test && npm run test:backend

# Üretim için statik derleme (Static Export - 38 sayfa)
npm run build
```

---

## 🛡️ Temel İlkeler ve Katı Sınırlar

1. **Çalışan Kodu Asla Bozma:** Mevcut iş mantığı ve API sözleşmeleri korunur.
2. **227/227 Test Yeşil Kalmak Zorunda:** Tüm birim ve backend yetkilendirme testleri her adımda doğrulanır.
3. **Vanilla CSS:** Harici Tailwind kütüphanesi kullanılmaz; sistem CSS değişkenleri (`--mb-*`) kullanılır.
4. **Static Export:** Next.js `output: "export"` kuralına uyulur; tüm dinamik işlemler AWS Lambda uç noktaları üzerinden yürütülür.
5. **Kriptografik Kimlik Doğrulama:** Token varlığı değil, Cognito anahtarlarıyla imza doğrulaması esastır.
