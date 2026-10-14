# MapsBridge (AdresKöprü)

> Harita merkezli, yapay zekâ destekli, kurumsal mikroservis mimarisine sahip, güvenli ve açık rızaya dayalı seyahat planlama ve konum paylaşım platformu.

Kullanıcılar harita masasında çok günlük seyahat rotaları oluşturabilir, OSRM motoruyla duraklarını optimize edebilir, AWS Bedrock destekli çok katmanlı AI seyahat asistanından (Nova Micro, Claude Haiku, Claude Sonnet) kişiselleştirilmiş gezi planları alabilir, gezgin profilleri ve topluluk rotalarını keşfedebilir ve süreli/tahmin edilemez bağlantılar (`/k/?kod=...`) ile konumlarını güvenle paylaşabilir.

Uygulama **gizli takip**, arka planda izinsiz veri toplama veya başkasının konumunu rızasız paylaşma amacıyla **kesinlikle kullanılmaz**.

---

## 🏛️ Monorepo ve Sistem Mimarisi

Codebase; Clean Architecture, Domain-Driven Design (DDD) ve bağımsız mikroservis ilkelerine göre yapılandırılmıştır:

```text
/
├── apps/
│   └── web/                   # Next.js 16 SPA Frontend (38 Statik Sayfa, Vanilla CSS)
├── services/                  # 6 Bağımsız Kurumsal Mikroservis
│   ├── ai-assistant/          # AWS Bedrock, Nova Micro, Alt Ajanlar & JSONL Boru Hattı
│   ├── identity-billing/      # Cognito JWT, Kredi Cüzdanı, Stripe Checkout/Webhooks
│   ├── map-trip/              # Rota Motoru, OSRM Entegrasyonu, Süreli Konum Paylaşımı
│   ├── messaging/             # Gerçek Zamanlı WebSocket Sohbet & Thread Yönetimi
│   ├── community/             # Gezgin Rotaları, Makaleler & Pazaryeri
│   └── admin-service/         # Rol Tabanlı Denetim (RBAC), Sistem Bakım Modu & Loglama
├── packages/                  # Paylaşılan Paketler
│   ├── contracts/             # Domain Tipleri, DTO'lar, Değer Nesneleri & Arayüzler
│   ├── shared/                # Ortak Validatörler & Hata Sınıfları
│   └── ui/                    # Çoklu Platform Tasarım Sistemi (Web + Mobile Tokens, SVG İkonlar)
├── monitoring/                # Kapsamlı İzleme, Sentetik Canary & Dağıtık Telemetri
│   ├── backend/               # Lambda, DynamoDB, API Gateway & Cognito Metrikleri
│   ├── frontend/              # Core Web Vitals & İstemci Hata Takibi
│   ├── services/              # 6 Mikroservis İçin Servis Seviyesi Tanımları
│   ├── dashboards/            # CloudWatch Operasyonel Pano Şablonu
│   ├── alarms/                # P1 (Kritik) ve P2 (Uyarı) CloudWatch Alarmları
│   ├── synthetics/            # Canlı Uç Nokta Canary Sağlık Denetleyicisi
│   └── tracing/               # AWS X-Ray Dağıtık İzleme ve Korelasyon Bağlamı
├── infra/                     # AWS Altyapı Kodları (Terraform, Lambda Handlers, Evals)
├── docs/                      # Güncel ve Konsolide Teknik Dokümantasyon
└── archive/                   # Arşivlenmiş Eski Kodlar ve Prototip Kalıntıları
```

---

## 📚 Mimari ve Geliştirici Dokümantasyonu

| Doküman | Amacı |
|---|---|
| 🤖 [AGENTS.md](AGENTS.md) | AI Agent çalışma sözleşmesi, anayasa ve katı kurallar |
| 📋 [docs/README.md](docs/README.md) | Merkezi dokümantasyon indeksi |
| 📄 [docs/operations/modernization-documentation.md](docs/operations/modernization-documentation.md) | Sistem modernizasyonu için kapsamlı kurumsal dokümantasyon |
| 📊 [docs/operations/modernization-summary.md](docs/operations/modernization-summary.md) | Modernizasyon değişikliklerinin özetini içerir |
| 🗺️ [docs/operations/modernization-roadmap.md](docs/operations/modernization-roadmap.md) | Modernizasyon sürecinin zaman çizelgesi ve yolu |
| 🔍 [docs/operations/modernization-changelog.md](docs/operations/modernization-changelog.md) | Yapılan değişikliklerin detaylı kaydı |
| 🎯 [docs/product/overview.md](docs/product/overview.md) | Ürün vizyonu, temel değer önerileri ve kapsam |
| 🏛️ [docs/architecture/system.md](docs/architecture/system.md) | Sistem mimarisi, katmanlar ve veri akışları |
| 🌐 [docs/architecture/microservices-architecture.md](docs/architecture/microservices-architecture.md) | 6 Mikroservisli dağıtık mimari ve EventBridge haberleşmesi |
| 🚀 [docs/ai-master-plan/ROADMAP.md](docs/ai-master-plan/ROADMAP.md) | 14 Aşamalı AI-First Seyahat Asistanı Master Planı (13 Şartname) |
| 🤖 [docs/ai/model-selection-and-guardrails.md](docs/ai/model-selection-and-guardrails.md) | Çok katmanlı LLM seçimi, güvenlik kalkanları ve alt ajan orkestrasyonu |
| 💰 [docs/product/business-model.md](docs/product/business-model.md) | İş modeli, kredi muhasebesi ve FinOps birim iktisadı |
| 🧩 [docs/architecture/domain.md](docs/architecture/domain.md) | Bounded context sınırları ve domain kuralları |
| 🗄️ [docs/architecture/database.md](docs/architecture/database.md) | Amazon DynamoDB Tek Tablo Tasarımı şeması ve erişim kalıpları |
| 🔌 [docs/architecture/api.md](docs/architecture/api.md) | REST (HTTP v2) ve WebSocket v2 API sözleşmeleri |
| 🛡️ [docs/operations/security.md](docs/operations/security.md) | Kimlik doğrulama, Stripe imza kontrolü ve KVKK/GDPR ilkeleri |
| 🧪 [docs/development/testing.md](docs/development/testing.md) | Test piramidi, test komutları ve kabul kriterleri (230/230 Test Yeşil) |
| 🚀 [docs/operations/deployment.md](docs/operations/deployment.md) | AWS Terraform dağıtımı ve CI/CD rehberi |
| 📊 [monitoring/README.md](monitoring/README.md) | Gözlemlenebilirlik, CloudWatch alarmları ve sentetik canary rehberi |
| 📜 [docs/development/coding-standards.md](docs/development/coding-standards.md) | Kodlama standartları ve mühendislik kuralları |
| 📋 [docs/development/tasks.md](docs/development/tasks.md) | Görev ve geliştirme takip listesi |

---

## ⚡ Hızlı Başlangıç

### Gereksinimler
- Node.js 22+
- npm 10+
- AWS CLI & Terraform (Dağıtım için)

### Testleri ve Doğrulamaları Çalıştırma
```bash
# 1. TypeScript tip denetimi
npm run typecheck

# 2. Tüm birim, AI değerlendirme ve backend entegrasyon testleri (230 Test)
npm test && npm run test:backend

# 3. Canlı bulut sentetik canary izleme (CloudFront + API Gateway)
npm run monitor:synthetics

# 4. Next.js statik export derlemesi (38 sayfa)
npm run build
```

### Yerel Geliştirme Sunucusu
```bash
# Web SPA uygulamasını yerelde başlatma
npm run dev
```

---

## ⚖️ Lisans ve Hukuki Uyarı

Tüm hakları saklıdır. KVKK/GDPR prensiplerine tam uyumludur.
