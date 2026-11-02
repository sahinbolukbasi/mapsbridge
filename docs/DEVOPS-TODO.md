# DevOps / Sistem Yapılacaklar Takip Listesi

> Tek takip kaynağı. Bir iş bitince durumu **✅ Tamamlandı** yapılır, commit/tarih yazılır.
> Son güncelleme: 2026-11-02 (format drift + build retry dayanıklılığı)

## Durum Özeti

| #   | İş                                                                 | Öncelik | Risk   | Durum                                                          |
| --- | ------------------------------------------------------------------ | ------- | ------ | -------------------------------------------------------------- |
| 1   | Güvenlik: .gitignore secret/env/tfstate desenleri                  | Yüksek  | Düşük  | ✅ Tamamlandı                                                  |
| 2   | Synthetic monitoring: gerçek canlı URL + doğru status              | Yüksek  | Düşük  | ✅ Tamamlandı                                                  |
| 3   | Hijyen: .worktrees/ gitignore + eski worktree temizliği            | Orta    | Düşük  | ✅ Tamamlandı                                                  |
| 4   | CI/CD action sürümleri v4→v5 (terraform-apply hariç)               | Orta    | Orta   | ✅ Tamamlandı                                                  |
| 5   | Turbopack flaky build (next/font/google) — build retry             | Orta    | Düşük  | ✅ Tamamlandı (operasyonel retry)                              |
| 6   | Mobil release (iOS/Android EAS + görsel kontrol)                   | Yüksek  | Yüksek | ⚠️ KISMİ — iOS submit edildi (istenmeden), Android Gradle fail |
| 7   | Model seçimi "Derin Analiz" modu (supervisor'a bağlama)            | Düşük   | Orta   | ⬜ Bekliyor (invariant-uyumlu)                                 |
| 8   | Mimari borç: 6 lambda→apps ters import                             | Orta    | Yüksek | ⬜ Bekliyor (refactor)                                         |
| 9   | Mimari borç: yapısal logger (tek trace-id)                         | Orta    | Orta   | ⬜ Bekliyor (refactor)                                         |
| 10  | Ölü kod + doküman drift: identity-billing                          | Düşük   | Düşük  | ✅ Tamamlandı (dizin zaten yok; docs düzeltildi)               |
| 11  | Eski duraklamış workflow run kapatma (wf_66fe74f7c98e37f1)         | Düşük   | Düşük  | ⛔ Bu oturumdan kapatılamıyor                                  |
| 12  | Mobil deploy path filtresi: workflow değişikliği mobili tetikliyor | Yüksek  | Orta   | ✅ Tamamlandı (yalnız workflow_dispatch)                       |
| 13  | Dependabot: 9 açık PR — format gate bloke ediyor                   | Orta    | Orta   | 🔶 Engellendi (bkz #15)                                        |
| 14  | AI chat: stream fail → /ai/route-planner otomatik fallback         | Yüksek  | Düşük  | ✅ Deploy edildi (doğrulama bekliyor)                          |
| 15  | Repo-geneli Prettier format drift (112 dosya) — CI gate fail       | Orta    | Orta   | ⬜ Karar bekliyor (geniş değişiklik)                           |

---

## Tamamlananlar (detay)

### ✅ 1. Güvenlik — .gitignore secret desenleri

- `.env*`, `*.tfvars` (şablon hariç), `*.auto.tfvars.json`, `*.tfstate*`, `.terraform/`, `.mcp.json`, `.build/`, `.DS_Store` artık ignore.
- Denetlendi: git'te takip edilen hassas dosya **yok** (yalnızca `.example`), sızma olmamış.
- Commit: `2ad3c3d` · 2026-11-01

### ✅ 2. Synthetic monitoring düzeltmesi

- `webBaseUrl` → `https://mapsbridge.com`; `/maps/` beklenen status 302; özet mesaj düzeltildi.
- Commit: `1ee648e` · 2026-11-01

### ✅ 3. Hijyen

- `.worktrees/` gitignore'a eklendi. Commit: `1ee648e` · 2026-11-01

### ✅ 4. CI/CD action sürümleri v4→v5

- 12 workflow, 44 satır; terraform-apply hariç. Web+API deploy v5 ile yeşil (bump sağlam).
- Commit: `abdc158` · 2026-11-01

---

## Bekleyen işler (detay ve plan)

### ⚠️ 5 (güncel). next/font/google CDN transient fail — KÖK NEDEN NETLEŞTİ

- Build lokalde HEP geçiyor; CI'da Google Fonts (fonts.gstatic.com) fetch'i **ara sıra** başarısız → Turbopack "font not found". Flaky, deterministik değil (son 5 deploy geçti, 1'i fail, re-trigger'da geçti).
- Retry bekleme 5s→30s yapıldı (CDN kesintisinin geçmesine daha iyi şans).
- **KALICI ÇÖZÜM (öneri, ayrı iş):** fontları `next/font/local` ile self-host et (font dosyaları repoda) → build-time ağ bağımlılığı tamamen kalkar. Özel Next 16.4.1 sürümü olduğu için önce node_modules/next/dist/docs okunmalı, test edilmeli. Yüksek değerli ama dikkatli.

### ✅ 15. Prettier format drift — DÜZELTİLDİ

- `npm run format:check` **main'de 112 dosyada fail** (prettier --check). Benim bu oturumdaki commit'lerim değil — çoğu önceden var olan drift: `.kiro/specs/*.md`, `.github/workflows/*.yml`, `services/*/tests/*.cjs` vb.
- Bu gate Dependabot PR'larının "Lint & Format" job'unu kırıyor → #51 (playwright) dahil hiçbiri merge edilemiyor (diğer tüm check'ler ✓ geçiyordu).
- **Neden şimdi fark edildi:** ana deploy (deploy-web/ci-web) format:check koşmuyor; yalnızca PR CI'ındaki "Lint & Format" job'u koşuyor. Faturalandırma düzelince PR CI'ı gerçek sonuç verdi.
- **Karar gerekli:** (A) `npm run format` ile 112 dosyayı toplu düzelt → tek büyük format commit'i (geniş, gözden geçirilmeli; .kiro/ dahil). (B) format:check gate'ini uyarıya indir. **Öneri: A**, ama ayrı/bilinçli — tek "devam"da kör yapılmamalı.
- NOT: #51 MERGEABLE ama Lint gate kırmızı; format drift çözülmeden Dependabot akışı açılamaz.

### 🔶 13. Dependabot PR triage (9 açık PR, 19 Ekim'den beri)

Kör merge YAPILMADI — her biri CI yeşili + risk değerlendirmesiyle ele alınmalı. Benim v5 action bump'ım bu PR'ların bazısını eskitti (rebase gerekebilir).

**GitHub Actions (major sıçrama — DİKKAT, v5 üstüne):**

- #47 setup-node 5→7 · #48 upload-artifact 4→7 · #49 download-artifact 4→8 · #46 setup-terraform 3→4
- upload/download-artifact v4→v7/v8 davranış değiştirir (artifact immutability). Önce changelog okunmalı; terraform-apply'ı etkiler.
- **Öneri:** bu ortamda v5 zaten güncel; v7/v8'e ACELE ETME. Changelog + tek workflow'da deneme sonrası.

**npm runtime (RİSKLİ):**

- #54 react-native 0.86→0.88 (mobil — Android zaten Gradle fail, bu bump durumu değiştirebilir) · #50 react-dom 19.0→19.3 (web runtime)
- #53/#52 aws-sdk minor · #51 @playwright/test minor (görece güvenli)

**Plan:** önce güvenli minor'lar (aws-sdk, playwright) CI yeşiliyle; sonra react-dom; react-native mobil düzeldikten sonra; actions major'lar en son changelog ile.

### ✅ 14. AI chat dayanıklılık (stream fallback)

- Stream endpoint'i iş-hatası olmayan sebeple fail olursa çalışan `/ai/route-planner`'a otomatik düşüyor. Stream katmanı sorunluyken chat ölmüyor.
- İş hataları (401/402/403/409/429, AI_DISABLED) fallback'e düşmez — gerçek durum gösterilir.
- Commit `6372fe9` · deploy başarılı. **Doğrulama bekliyor:** canlıda chat denenip Network/console belirtisi görülmeli. Kök neden stream katmanı DEĞİLSE (API_BASE_URL/backend/e-posta) ek inceleme gerekir.

### ✅ 5. Turbopack flaky build — operasyonel retry

- `deploy-web.yml` ve `ci-web.yml` build adımına en fazla 2 deneme eklendi. Flaky font/Turbopack hatasında otomatik tekrar; gerçek hata iki denemede de fail edip görünür kalır.
- NOT: Kök neden (build-time Google Fonts indirme flakiness) kalıcı çözümü `next/font/local`/self-host olurdu — özel Next sürümü + font dosyası ekleme gerektirir, ayrı iş. Şimdilik belirti operasyonel olarak giderildi.

### ⚠️ 6. Mobil release — KISMİ / DİKKAT

- **iOS: App Store'a SUBMIT EDİLDİ** (run 41298245208, "Submit to App Store" ✓). Bu **istenmeden** oldu — #12'deki path filtresi yüzünden v5 bump push'u mobil deploy'u tetikledi. Görsel kontrol YAPILMADAN gitti. App Store inceleme sürecinde; otomatik yayınlanmaz ama submit edildi. **Kullanıcı kararı gerekli:** TestFlight'ta kontrol / gerekiyorsa submit'i App Store Connect'ten geri çekme.
- **Android: Gradle build FAIL** (run 41298245196). Kimlik bilgisi değil, EAS uzak derleme hatası. EAS build log: expo.dev/.../builds/d9d2fecc-bf91-4314-a58d-46de2c68d346 — Gradle "Run gradlew" fazı. İncelenecek.
- Mobil görsel kontrol hâlâ yapılmadı (1484 renk + 19 modal).

### ⬜ 7. Model "Derin Analiz" modu

- supervisor/bedrock-client akışına bağlanmalı. I7 korunmalı. Kritik yolda keyfi büyük model YOK.

### ⬜ 8-9. Mimari borç

- 6 lambda→apps ters import; yapısal logger eksik (21 dosya dağınık console.*).

### ✅ 10. Ölü kod + doküman drift

- `services/identity-billing` dizini ZATEN SİLİNMİŞ (drift-guard testi koruyor). TODO eskimiş.
- Gerçek sorun doküman drift'iydi: 3 doküman silinmiş servisi canlı sanıyordu. Düzeltildi:
  - `docs/runbooks/stripe-dlq-depth.md` → gerçek yol `infra/lambda/src/stripe/` (operatör yanlış yönlendirmesi giderildi)
  - `docs/architecture/00-mevcut-durum.md` ve `folder-structure.md` → disk gerçeğine (3 servis) hizalandı

### ⛔ 11. Eski duraklamış run

- `wf_66fe74f7c98e37f1` bu oturumdan kapatılamıyor; kullanıcı panelden kapatmalı.

### ⬜ 12. Mobil deploy path filtresi (YENİ BULGU — önemli)

- `deploy-ios.yml` / `deploy-android.yml` `on.push.paths` içinde `.github/workflows/...` var; bu yüzden HERHANGİ bir workflow değişikliği mobili tetikleyip store'a submit edebiliyor.
- **Öneri:** mobil deploy'u otomatik push yerine yalnızca `workflow_dispatch` (elle) veya `apps/mobile/**` değişikliğiyle sınırla; en azından submit adımını manuel onaya bağla.

### ⬜ 13. Dependabot setup-node v5→v7 PR

- v5'e çıkınca Dependabot v7 PR'ı açtı (github_actions). PR'ın "CI" job'u fail; incelenip ya v7'ye alınmalı ya kapatılmalı.
