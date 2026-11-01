# DevOps / Sistem Yapılacaklar Takip Listesi

> Tek takip kaynağı. Bir iş bitince durumu **✅ Tamamlandı** yapılır, commit/tarih yazılır.
> Son güncelleme: 2026-11-01

## Durum Özeti

| # | İş | Öncelik | Risk | Durum |
|---|-----|---------|------|-------|
| 1 | Güvenlik: .gitignore secret/env/tfstate desenleri | Yüksek | Düşük | ✅ Tamamlandı |
| 2 | Synthetic monitoring: gerçek canlı URL + doğru status | Yüksek | Düşük | ✅ Tamamlandı |
| 3 | Hijyen: .worktrees/ gitignore + eski worktree temizliği | Orta | Düşük | ✅ Tamamlandı |
| 4 | CI/CD action sürümleri v4→v5 (terraform-apply hariç) | Orta | Orta | ✅ Tamamlandı |
| 5 | Turbopack flaky build (next/font/google) kök neden | Orta | Orta | ⬜ Bekliyor |
| 6 | Mobil release (iOS/Android EAS + görsel kontrol) | Yüksek | Yüksek | ⛔ Karar/dış bağımlılık bekliyor |
| 7 | Model seçimi "Derin Analiz" modu (supervisor'a bağlama) | Düşük | Orta | ⬜ Bekliyor (invariant-uyumlu) |
| 8 | Mimari borç: 6 lambda→apps ters import | Orta | Yüksek | ⬜ Bekliyor (refactor) |
| 9 | Mimari borç: yapısal logger (tek trace-id) | Orta | Orta | ⬜ Bekliyor (refactor) |
| 10 | Ölü kod: services/identity-billing sil | Düşük | Düşük | ⬜ Bekliyor (kullanıcı onayı) |
| 11 | Eski duraklamış workflow run kapatma (wf_66fe74f7c98e37f1) | Düşük | Düşük | ⛔ Bu oturumdan kapatılamıyor |

---

## Tamamlananlar (detay)

### ✅ 1. Güvenlik — .gitignore secret desenleri
- `.env*`, `*.tfvars` (şablon hariç), `*.auto.tfvars.json`, `*.tfstate*`, `.terraform/`, `.mcp.json`, `.build/`, `.DS_Store` artık ignore.
- Denetlendi: git'te takip edilen hassas dosya **yok** (yalnızca `.example`), sızma olmamış.
- Commit: `2ad3c3d` · 2026-11-01

### ✅ 2. Synthetic monitoring düzeltmesi
- `webBaseUrl` → `https://mapsbridge.com` (placeholder CloudFront yerine).
- `/maps/` beklenen status 302 (canlı giriş yönlendirmesi).
- Özet mesaj doğru raporluyor (geçen/DNS-fail ayrımı). Web kontrolleri geçiyor.
- Commit: `1ee648e` · 2026-11-01

### ✅ 3. Hijyen
- `.worktrees/` gitignore'a eklendi. Merge olmuş `ui-design-system` worktree'si zaten kaldırılmıştı.
- Commit: `1ee648e` · 2026-11-01

### ✅ 4. CI/CD action sürümleri v4→v5
- `actions/checkout`, `setup-node`, `upload/download-artifact`, `aws-actions/configure-aws-credentials` → v5 (Node 24; Node 20 deprecation uyarısı giderildi).
- 12 workflow dosyası, 44 satır. **terraform-apply.yml dokunulmadı** (production infra, ayrı ele alınacak).
- Doğrulama: push sonrası CI workflow'ları v5 ile çalıştı.
- Commit: `<pending>` · 2026-11-01

---

## Bekleyen işler (detay ve plan)

### ⬜ 5. Turbopack flaky build
- `next/font/google` ara sıra CI build'de patlıyor (retry'da geçiyor).
- Font importunu sabitlemek / resolver davranışını araştırmak gerekli.

### ⛔ 6. Mobil release
- iOS preview build: EAS ad-hoc kimlik bilgisi (cihaz + provisioning) eksik, non-interactive kurulamıyor.
- Android preview build de fail (sebep incelenmedi).
- Mobil görsel kontrol yapılmadı (1484 renk + 19 modal değişti).
- **Gerekli:** kullanıcı kararı + EAS'te interaktif kimlik kurulumu.

### ⬜ 7. Model "Derin Analiz" modu
- model-router'a `deepAnalysis` eklenebilir ama canlı akış onu çağırmıyor; supervisor/bedrock-client akışına doğru bağlanmalı. I7 (≤2s p95) korunmalı. Kritik yolda keyfi büyük model YOK (spec).

### ⬜ 8-9. Mimari borç
- 6 lambda→apps ters import (ESLint warn). Strangler-fig ile kademeli.
- Yapısal logger: 21 dosyada dağınık console.*; tek trace-id/korelasyon yok.

### ⬜ 10. Ölü kod
- `services/identity-billing` (grep=0) silinecek — kullanıcı onayı ile.

### ⛔ 11. Eski duraklamış run
- `wf_66fe74f7c98e37f1` bu oturumdan kontrol edilemiyor; kullanıcı kendi oturumundan/panelden kapatmalı.
