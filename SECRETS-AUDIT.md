# Secret Yönetimi Denetim Raporu

> Oluşturulma: 2026-10-15 | **Hiçbir secret değeri bu dosyaya yazılmamıştır — sadece konum ve tip bildirilmiştir.**

---

## Öncelik Sırası — Rotate Edilmesi Gerekenler

| Öncelik | Secret | Konum | Neden Acil |
|---------|--------|-------|-----------|
| **1 — ACİL** | RevenueCat iOS/Android Public Key | `apps/mobile/.env.example` (3 commit'te git'te) | Git history'de herkese açık |
| **2 — ACİL** | Google Maps Platform API Key | `.agents/mcp_config.json` (initial commit'ten beri git'te) | Git history'de herkese açık |
| **3 — ORTA** | Aurora DB Password | `infra/terraform/terraform.tfvars` (gitignored) | Test değeri görünümlü ama production'a apply edildiyse rotate et |
| **4 — DÜŞÜK** | Google Places API Key | Terraform variable (henüz boş görünüyor) | Atandığında `secret:/` pattern kullan |

---

## Bulgular

### BULGU 1 — RevenueCat API Key — Git History'de

**Konum:** `apps/mobile/.env.example` satır 1-2  
**Git-tracked:** EVET — 3 ayrı commit'te mevcut  
**Secret tipi:** RevenueCat SDK Public Key (`sk_` önekli)  
**Geçerli olma ihtimali:** Yüksek  
**Rotate edilmeli mi?** EVET  
**Doğru saklanma yeri:** `.env.example` sadece placeholder içermeli; gerçek değer EAS Secrets veya CI env var olarak yönetilmeli

**Migration adımı:**
1. RevenueCat Dashboard → Project Settings → API Keys → eski key'i revoke et, yeni üret
2. `apps/mobile/.env` ve `apps/mobile/.env.example` güncelle (placeholder)
3. EAS Secret olarak ekle: `eas secret:create EXPO_PUBLIC_RC_API_KEY_IOS=<new_key>`

> **Not:** `apps/mobile/.env.example`'daki placeholder düzeltmesi AUDIT.md Adım 1'de uygulandı (commit bd4d64b). Ancak git history'de eski değer hâlâ duruyor — rotate zorunlu.

---

### BULGU 2 — Google Maps API Key — Git History'de

**Konum:** `.agents/mcp_config.json` (initial commit'ten beri git'te)  
**Git-tracked:** EVET  
**Secret tipi:** Google Maps Platform API Key (`AIzaSy` önekli)  
**Geçerli olma ihtimali:** Yüksek  
**Rotate edilmeli mi?** EVET  
**Doğru saklanma yeri:** `.agents/` gitignore'a eklenmiş (AUDIT.md Adım 1'de yapıldı), MCP key shell env var'ına taşınmalı

**Migration adımı:**
1. Google Cloud Console → Credentials → bu key'i HTTP referrer kısıtlamasıyla kısıtla (geçici koruma)
2. Yeni key üret, eskisini sil
3. `.agents/mcp_config.json`'da değeri `$GOOGLE_MAPS_API_KEY` ortam değişkenine bırak
4. `GOOGLE_MAPS_API_KEY`'i shell profiline ekle (~/.zshrc)

---

### BULGU 3 — Aurora DB Password — Zayıf Değer (Gitignored)

**Konum:** `infra/terraform/terraform.tfvars` satır 6  
**Git-tracked:** HAYIR (gitignored)  
**Secret tipi:** Aurora Serverless master password  
**Geçerli olma ihtimali:** `TestPassword123!` formatı — production'da bu değerle apply yapıldıysa gerçek şifre  
**Rotate edilmeli mi?** Şüpheli — production cluster'ın aktif şifresini kontrol et

**Not:** `db_password` Terraform'da `sensitive = true` işaretli — doğru. Ancak bu değer Terraform state'e plaintext olarak yazılır; state S3 bucket erişimi kısıtlanmalı.

---

### BULGU 4 — Google Places / Foursquare API Key — Lambda Env'de Plaintext

**Konum:** `infra/terraform/modules/api/main.tf` satır 58-59  
**Git-tracked:** EVET (değer değil, variable referansı)  
**Secret tipi:** Google Places API Key ve Foursquare API Key  
**Geçerli olma ihtimali:** Henüz değer atanmamış görünüyor  
**Rotate edilmeli mi?** Hayır (şimdilik)  
**Problem:** Atandığında diğer secretlar gibi `secret:/mapsbridge/prod/...` pattern'i kullanılmalı, doğrudan Lambda env var'ına yazılmamalı

---

### BULGU 5 — PII Loglama — CloudWatch

**Konum:** `infra/lambda/src/auth/cognito-custom-message.ts` satır 38-40  
**Tip:** PII Loglama (gizlilik)  
**Problem:** `event.userName` (genellikle email adresi) CloudWatch'a yazılıyor  
**Düzeltme:** Log'u `triggerSource` ile sınırla, `userName`'i kaldır

---

### BULGU 6 — Gitleaks Bypass — CI/CD

**Konum:** `.github/workflows/ci.yml` satır 33  
**Tip:** CI/CD kontrolü açığı  
**Durum:** DÜZELTILDI — AUDIT.md Adım 1'de `continue-on-error: true` kaldırıldı (commit bd4d64b)

---

## Mevcut Doğru Yapılanlar

- Slack token, GitHub token, Stripe key: `secret:/mapsbridge/...` prefix'i ile Secrets Manager'dan çekiliyor ✅
- Terraform `db_password` ve `stripe_secret_key`: `sensitive = true` ✅
- S3 remote state: `encrypt = true` ✅
- `shared/log-mask.ts` maskeleme utility'si mevcut ✅
- GitHub Actions: tüm secretlar `${{ secrets.XXX }}` syntax'ıyla kullanılıyor ✅
- `.env` ve `.env.local` gitignore'da ✅
