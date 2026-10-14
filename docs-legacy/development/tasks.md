# Görev ve Geliştirme Takip Listesi

Bu belge, projedeki devam eden ve planlanan görevlerin anlık durumunu gösterir.

---

## 1. Mimari Düzenleme ve Refactoring Görevleri

- [x] **Aşama 1: Kapsamlı Sistem Analizi ve Planlama**
  - [x] Mevcut mimari, kaynak kodu, testler ve veritabanı incelendi.
  - [x] `docs/plans/refactoring.md` oluşturuldu.
  - [x] Çekirdek dokümantasyon sözleşmeleri (`AGENTS.md`, `docs/product/overview.md`, `docs/architecture/system.md`, `docs/product/business-model.md`, `docs/architecture/domain.md`, `docs/development/coding-standards.md`, `docs/development/workflow.md`, `docs/architecture/database.md`, `docs/architecture/api.md`, `docs/operations/security.md`, `docs/development/testing.md`, `docs/operations/deployment.md`, `docs/operations/observability.md`, `docs/architecture/decisions.md`) hazırlandı.
  - [x] 110 test çalıştırıldı ve yeşil olduğu doğrulandı.

- [x] **Aşama 2: AI Agent Rollerinin Tanımlanması (`agents/`)**
  - [x] `agents/architect.md`
  - [x] `agents/planner.md`
  - [x] `agents/backend.md`
  - [x] `agents/frontend.md`
  - [x] `agents/database.md`
  - [x] `agents/devops.md`
  - [x] `agents/security.md`
  - [x] `agents/test.md`
  - [x] `agents/sre.md`

- [x] **Aşama 3: Ortak Sözleşmeler ve Tipler Paketi (`packages/contracts` & `packages/shared`)**
  - [x] Trip, AI, Billing, Auth, Messaging için ortak TypeScript sözleşmeleri `packages/contracts` altında merkezileştirildi.
  - [x] `packages/shared` altında `isValidCoordinate`, `AppError` ve `createApiResponse` yardımcıları oluşturuldu.
  - [x] Monorepo `workspaces` yapısına `packages/*` dahil edildi.

- [x] **Aşama 4: İngilizce Rota, Dosya İsimleri ve URL Standardizasyonu (English-Only Codebase)**
  - [x] Tüm Türkçe sayfa klasörleri (`giris`, `kayit`, `panel`, `odeme`, `topluluk`, `mesajlar`, `profil`, `destek`, `cerezler`, `gizlilik`, `kosullar`, `nasil`, `nasil-calisir`, `yazilar`, `sifre-sifirla`, `dogrula`, `u/abonelik`) tamamen kaldırıldı.
  - [x] Tüm URL'ler, bağlantılar, `Link` bileşenleri, yönlendirmeler ve Playwright testleri kanonik İngilizce rotalara (`/login/`, `/register/`, `/desk/`, `/checkout/`, `/community/`, `/messages/`, `/profile/`, `/support/`, `/cookies/`, `/privacy/`, `/terms/`, `/how-it-works/`, `/articles/`, `/reset-password/`, `/verify/`) taşındı.
  - [x] Sıfır artık Türkçe URL veya klasör bırakıldı.

- [x] **Aşama 5: `docs/` Dokümantasyonunun Konsolidasyonu ve Temizliği**
  - [x] Eski/çelişkili legacy belgeler (`DEGISIKLIK_GUNLUGU.md`, `FAZ_UYGULAMA_KAYDI.md`, `GELISTIRME_PLANI.md`, `IS_AKISLARI_VE_DENEYIM.md`, `MALIYET_VE_ALTYAPI.md`, `MIMARI.md`, `PROFESYONEL_URUN_VE_AWS_MASTER_PLANI.md`, `YOL_HARITASI.md`) silindi.
  - [x] `docs/product/admin-panel.md` içindeki Türkçe URL'ler ve rotalar İngilizceye çevrildi.
  - [x] `docs/README.md` baştan sona güncellenerek tüm kök sözleşmeleri ve `docs/` belgelerini bağlayan tek merkezi rehber haline getirildi.

- [x] **Aşama 6: Kurumsal Mikroservis Mimarisi ve Tasarım Sistemi (Enterprise Microservices & UI Package)**
  - [x] Mimari master plan hazırlandı: [docs/architecture/microservices-architecture.md](../architecture/microservices-architecture.md)
  - [x] 6 bağımsız mikroservis yapısı (`services/`) oluşturuldu ve tip kontrolleri doğrulandı:
    - `services/ai-assistant`: Bedrock, Nova Micro, RAG, AgentCore Memory
    - `services/identity-billing`: Cognito User Identity, Credit Wallet, Stripe Payments
    - `services/map-trip`: Harita masası, rotalar, duraklar, süreli TTL pin paylaşımı
    - `services/messaging`: WebSocket gateway, gerçek zamanlı sohbet, thread yönetimi
    - `services/community`: Herkese açık rehberler, seyahat yazıları, pazaryeri
    - `services/admin-service`: Moderasyon, RBAC, sistem bakım modu, audit denetimi
  - [x] Ortak Tasarım Sistemi (`packages/ui` - `@mapsbridge/ui`) kuruldu:
    - Renk paleti (`colors.ts`), tipografi (`typography.ts`), aralıklar (`spacing.ts`), gölgeler/cam efekti (`shadows.ts`)
    - Web ve Mobil (React Native / iOS & Android) ile uyumlu çoklu platform SVG ikon tanımları (`icons/index.ts`)
    - CSS Custom Properties (`styles/tokens.css`)
  - [x] `workspaces` monorepo yapılandırmasına `services/*` eklendi.

- [x] **Aşama 7: Kapsamlı İzleme ve Gözlemlenebilirlik Altyapısı (`monitoring/`)**
  - [x] `monitoring/backend/`: Lambda, DynamoDB, API Gateway ve Cognito CloudWatch metrik tanımları.
  - [x] `monitoring/frontend/`: Core Web Vitals (LCP, FID, CLS, TTFB, INP) ve İstemci Hata İzleyicisi.
  - [x] `monitoring/services/`: 6 bağımsız mikroservis SLO/SLA sağlık şemaları.
  - [x] `monitoring/dashboards/`: CloudWatch Panosu (`production-overview.json`).
  - [x] `monitoring/alarms/`: P1 kritik ve P2 uyarı alarm eşikleri.
  - [x] `monitoring/synthetics/`: Canlı CloudFront ve API Gateway canary koşucusu (`canary-runner.cjs`).
  - [x] `monitoring/tracing/`: AWS X-Ray dağıtık izleme ve correlation ID bağlamı.

- [x] **Aşama 8: AI Asistan Hızlandırma, Otonom Alt Ajanlar & Güvenlik Kalkanları**
  - [x] Çok Katmanlı Model Stratejisi dokümante edildi: [docs/ai/model-selection-and-guardrails.md](../ai/model-selection-and-guardrails.md)
  - [x] Niyet Tabanlı Otonom Alt Ajan Yönlendirici: `AgentDispatcher` (`emergencyAgent`, `transitStayAgent`, `discoveryAgent`, cüzdan ve konum paylaşım araçları).
  - [x] Seyahat Dışı Kapsam Kalkanı (`validateTravelScope`): Kodlama, kripto para, yatırım ve alakasız sorguları 0 krediyle reddetme.
  - [x] Prompt Injection & DAN Modu Savunması (`validateTopicSafety`).
  - [x] PII Maskeleme (`maskPII`): TC Kimlik, Kredi Kartı, Telefon, E-posta ve SSN maskeleme.
  - [x] LLM İnce Ayar (Fine-Tuning) Veri Toplama Boru Hattı (`TrainingDataCollector`): PII'sız AWS Bedrock / Nova uyumlu JSONL üretimi.
  - [x] Toplam 230/230 test yeşil, 5/5 sentetik canary başarılı ve 38/38 Next.js statik sayfa derlemesi doğrulandı.

- [ ] **Aşama 9: Frontend Feature Modülerleştirmesi**
  - [ ] `apps/web/app/` içindeki büyük sayfa bileşenlerinin `features/` altına taşınması.
  - [ ] API çağrılarının merkezi servisler üzerinden yürütülmesi.

## AI kişisel hafıza — 27 Eylül 2026

- [x] Doğrulanmış kimlik, bağlam sınırı ve etkili girdilerin fingerprint kontrolü.
- [x] AgentCore Memory, transaction outbox, nesil bazlı unutma ve kullanıcı ayarları.
- [x] Bedrock Guardrail ve ayrı Terraform state; test/dağıtım araçları.
- [x] İncelenmiş veriye bağlı fine-tuning hazırlama ve dry-run gönderim hattı.
- [ ] İncelenmiş eğitim/eval veri seti, gerçek eğitim ve karşılaştırmalı kalite ölçümü.
- [ ] İhtiyaç oluşursa Runtime/Gateway karar kapısı.

Ayrıntılar ve sınırlar: [docs/ai/memory.md](../ai/memory.md).

## Saf Native Mobil Uygulama (React Native / Expo) — 28 Eylül 2026

- [x] Web tabanlı Capacitor sarmalayıcısı (`apps/web/ios`, `apps/web/android`, `@capacitor/*`) tamamen kaldırıldı.
- [x] Tüm mobil istemci mantığı bağımsız saf native modüle (`apps/mobile/`) taşındı.
- [x] React Native 0.86 & Expo ile yazılan ekranlar doğrulandı:
  - `MapScreen.tsx` (Leaflet WebView & native pinleme kontrolleri)
  - `AIScreen.tsx` (AWS Bedrock asistan sohbeti)
  - `PlanScreen.tsx` (Çok günlük durak masası)
  - `CommunityScreen.tsx` (Topluluk ve pazar yeri rotaları)
  - `ChatScreen.tsx` (Katılımcı mesajlaşması)
  - `ProfileScreen.tsx` (Kullanıcı profili ve cüzdan)
- [x] `apps/mobile` TypeScript tip kontrolü 0 hata ile doğrulandı (`npx tsc --noEmit`).
- [x] iPhone 16 simülatöründe Expo Go üzerinden native çalıştırma doğrulandı.
- [x] Kök `package.json` mobil komutları (`mobile:start`, `mobile:ios`, `mobile:android`) doğrudan Expo'ya bağlandı.
- [x] 230/230 test yeşil, web ve backend derlemesi temiz.

## Topluluk X-Tarzı Akış (X Feed), Rota Paylaşımı & Takipleşme — 28 Eylül 2026

- [x] **Web Modülerleştirme (`apps/web/app/features/community/`):**
  - Dev `page.tsx` bileşeni modüler alt bileşenlere ayrıştırıldı:
    - [DiscoverTab.tsx](file:///Users/sahinbolukbasi/Development/location/apps/web/app/features/community/components/DiscoverTab.tsx): X (Twitter) tarzı canlı seyahat akışı; "Sana Özel", "Takip Edilenler", "📍 Konuma Göre", "🔥 Trendler" sekmeleri.
    - Konuma, hashtag'lere ve takipçi sayısına göre sıralama & filtreleme.
    - Hızlı tweet besteleyici: Anlık yazı, görsel/fotoğraf bağlantısı, haritadan interaktif rota iliştirme, konum etiketi ve hashtag seçimi.
    - Tweet içine gömülü interaktif rota kartı (durak sayısı, mesafe, süre ve tek tıkla rotayı haritaya klonlama).
    - Kullanıcı bazlı Takip Et / Takipten Çık mantığı ve Takip Edilenler akışı.
    - Gönderi içi inline yorum sistemi, yorum açma/kapama ve anlık yorum ekleme.
    - [RoutesTab.tsx](file:///Users/sahinbolukbasi/Development/location/apps/web/app/features/community/components/RoutesTab.tsx), [TripsTab.tsx](file:///Users/sahinbolukbasi/Development/location/apps/web/app/features/community/components/TripsTab.tsx), [BuddyTab.tsx](file:///Users/sahinbolukbasi/Development/location/apps/web/app/features/community/components/BuddyTab.tsx), [CommunitySidebar.tsx](file:///Users/sahinbolukbasi/Development/location/apps/web/app/features/community/components/CommunitySidebar.tsx), [CommunityFooter.tsx](file:///Users/sahinbolukbasi/Development/location/apps/web/app/features/community/components/CommunityFooter.tsx) ve tüm modal bileşenleri ayrıştırıldı.
- [x] **Backend & Domain Sözleşmeleri:**
  - `packages/contracts/src/domain/community.ts` altında `TravelGuideModel` ve `TravelArticleModel` aggregate modelleri ve doğrulamaları oluşturuldu.
  - `services/community` mikroservisi içinde AI destekli yol arkadaşı eşleştirme algoritması (`matchTravelBuddies`) ve birim testleri (3/3) eklendi.
- [x] **Saf Native Mobil Entegrasyonu (`apps/mobile/src/screens/CommunityScreen.tsx`):**
  - Kaşifleri Takip Et / Takip Ediliyor durumu.
  - Tweet/Rota kartlarında Beğeni, Yorum (modal ve anlık yanıt listesi) ve Rota Haritama Al butonları.
  - Canlı filtreleme ve yeni rota/gönderi paylaşım modalı.
- [x] **Test & Doğrulama:**
  - `npm run typecheck && npm test && npm run test:backend` ile 230/230 test yeşil.
  - Mobil TypeScript derlemesi (`npx tsc --noEmit`) 0 hata.
