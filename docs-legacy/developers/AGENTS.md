# AI Agent Geliştirme ve Çalışma Sözleşmesi

Bu belge, bu repository üzerinde geliştirme, refactoring, hata ayıklama veya operasyonel görev yürüten tüm AI Agent'lar (ve geliştiriciler) için **ana anayasa ve çalışma sözleşmesidir**.

---

## 1. İlk Kural: Bağlam ve Başlangıç Protokolü

Herhangi bir göreve başlamadan önce, agent'ın tüm depoyu belleğe yüklemesi **kesinlikle yasaktır** (Token ve bağlam optimizasyonu).

Agent, göreve başlamadan önce **yalnızca** şu sırayı takip eder:
1. `docs/product/overview.md` — Sistemin ne yaptığını ve kullanıcı vaadini anla.
2. `docs/architecture/system.md` — Katmanları ve modül sınırlarını anla.
3. `docs/architecture/domain.md` — İlgili bounded context sınırlarını belirle.
4. `docs/development/coding-standards.md` — Kodlama ve tasarım kurallarını kontrol et.
5. **Göreve Özel Dokümana Git:**
   - Veritabanı / Veri Modelleme görevi ise ➔ `docs/architecture/database.md`
   - API / Uç nokta değişikliği ise ➔ `docs/architecture/api.md`
   - Güvenlik / Yetkilendirme görevi ise ➔ `docs/operations/security.md`
   - Dağıtım / Altyapı görevi ise ➔ `docs/operations/deployment.md`
   - Test ekleme / hata ayıklama ise ➔ `docs/development/testing.md`
   - Gözlemlenebilirlik / Metrik / Log ise ➔ `docs/operations/observability.md`
   - Mimari karar gerektiriyorsa ➔ `docs/architecture/decisions.md`

---

## 2. Temel İlkeler ve Katı Sınırlar (Non-Negotiables)

1. **Çalışan Kodu Asla Bozma:** Mevcut iş mantığı, kullanıcı deneyimi veya çalışan API sözleşmeleri sebepsiz değiştirilemez.
2. **Test Yeşil Kalmak Zorunda:** Her adımdan sonra `npm test && npm run test:backend` çalıştırılmalı ve **230/230 test yeşil** kalmalıdır (120 birim/AI testi + 110 backend entegrasyon testi).
3. **Big-Bang Rewrite Yasak:** Kapsamlı ve ani yeniden yazımlar yerine daima **Strangler Fig / Incremental Refactoring** yaklaşımı uygulanır.
4. **Secret'lar Asla Kodda Olmaz:** `.env`, AWS erişim anahtarları, Stripe secret'ları, Cognito şifreleri repoya eklenemez. SSM Parameter Store ve environment değişkenleri kullanılır.
5. **Framework / Teknoloji Değiştirme Yasağı:** Projede TailwindCSS, yeni bir CSS kütüphanesi veya ORM eklenemez. Vanilla CSS ve mevcut AWS SDK'lar korunmalıdır.
6. **İki Yönlü Bağımlılık Yasağı (Clean Architecture):**
   - Domain katmanı dış dünyayı (HTTP, AWS, Stripe, DynamoDB) bilmez.
   - Frontend, backend dosyalarını doğrudan import edemez.
   - Backend handler'ları, frontend UI kodlarını import edemez.

---

## 3. Görev Yönlendirme (Task Routing) ve Agent Rolleri

Tüm roller `agents/` klasöründe tanımlanmıştır:
- `agents/architect.md` — Mimari bütünlük, Clean Architecture, katman sınırları.
- `agents/planner.md` — Görev analizleri, etki alanı haritalama, adım adım planlama.
- `agents/backend.md` — Domain, Application, Lambda handler'ları, API entegrasyonu.
- `agents/frontend.md` — Next.js SPA, Leaflet harita katmanı, Vanilla CSS, Feature UI.
- `agents/database.md` — DynamoDB tek tablo tasarımı, PK/SK şemaları, TTL, indeksler.
- `agents/devops.md` — Terraform altyapısı, esbuild derlemeleri, S3/CloudFront.
- `agents/security.md` — Cognito doğrulaması, Stripe imza denetimi, yetki izolasyonu.
- `agents/test.md` — Birim, entegrasyon ve kabul testleri.
- `agents/sre.md` — FinOps maliyet takibi, token ölçümü, CloudWatch loglama.

### Görev Akış Matrisi
- **UI Geliştirme:** Planner ➔ Frontend ➔ Test
- **Veritabanı Değişikliği:** Planner ➔ Architect ➔ Database ➔ Backend ➔ Test
- **API Ekleme/Değiştirme:** Planner ➔ Backend ➔ Security ➔ Test
- **Altyapı / Terraform:** Planner ➔ DevOps ➔ Security ➔ Test

---

## 4. Değişiklik Tamamlama Kriteri (Definition of Done)

Bir görev tamamlandı sayılabilmesi için:
1. İlgili kod değişiklikleri yapılmış olmalı.
2. Mevcut 230 test ve yeni eklenen testler geçmiş olmalı (`npm test && npm run test:backend`).
3. Kodda gereksiz console.log veya debug kalıntısı olmamalı.
4. İlgili dokümantasyon (`docs/development/tasks.md`, `docs/architecture/system.md` vb.) güncellenmiş olmalı.
5. Kullanıcıya yapılan işlem adım adım raporlanmış olmalıdır.
