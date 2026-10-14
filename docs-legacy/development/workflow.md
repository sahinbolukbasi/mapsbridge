# Geliştirme İş Akışı ve Görev Yönlendirme (Task Routing)

Bu belge, repoda bir özellik (feature), hata düzeltme (bugfix) veya refactoring gerçekleştirilirken izlenecek standart akışı açıklar.

---

## 1. Görev Yönlendirme Matrisi (Task Routing)

Her görev bütün aşamalardan veya tüm rollerden geçmek zorunda değildir. Token maliyetini ve geliştirme süresini optimize etmek için görev türüne göre rota seçilir:

```text
1. UI / Tasarım Görevi:
   Planner ──► Frontend ──► Test ──► Kabul

2. Backend API Görevi:
   Planner ──► Backend ──► Security ──► Test ──► Kabul

3. Veritabanı / Şema Görevi:
   Planner ──► Architect ──► Database ──► Backend ──► Test ──► Kabul

4. Altyapı / DevOps Görevi:
   Planner ──► DevOps ──► Security ──► Test ──► Kabul

5. Tam Kapsamlı (End-to-End) Özellik:
   Planner ──► Architect ──► Backend & Database ──► Frontend ──► Security ──► Test ──► SRE
```

---

## 2. Aşamalı Geliştirme Adımları

### Adım 1: Analiz ve Etki Alanı Tespiti (Impact Analysis)
- `docs/product/overview.md`, `docs/architecture/domain.md` ve ilgili alan dokümanlarını oku.
- Değişikliğin mevcut hangi testleri ve sözleşmeleri etkileyeceğini listele.
- Eğer mevcut iş mantığı veya veri yapısı değişecekse önce `docs/plans/refactoring.md` veya `docs/architecture/decisions.md` üzerinden kayıt aç.

### Adım 2: Küçük Parçalarla Uygulama (Incremental Implementation)
- Kodu tek seferde devasa bloklar halinde değiştirme.
- İlgili domain veya servis seviyesinde refactor yap.
- Geriye dönük uyumluluğu (backward compatibility) koru.

### Adım 3: Test ve Doğrulama (Verification)
- `npm test` ve `npm run test:backend` çalıştır.
- 110 testin tamamının yeşil kaldığını doğrula.
- Yeni eklenen iş mantığı için mutlaka birim veya entegrasyon testi ekle.

### Adım 4: Dokümantasyon Güncellemesi
- İlgili `.md` dosyasını güncelle (`docs/development/tasks.md`, `docs/architecture/system.md` vb.).
- Değişikliği kullanıcıya özetle.
