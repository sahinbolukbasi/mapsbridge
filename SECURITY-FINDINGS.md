# Güvenlik Denetim Raporu — MapsBridge Monorepo

> Oluşturulma: 2026-10-15 | **P0'lar en üstte. Hiçbir secret değeri bu dosyaya yazılmamıştır.**

---

## P0 — Kritik (Hemen Müdahale)

### P0-1: RevenueCat Secret Key — Mobil Binary'ye Gömülüyor

**Dosya:satır:** `apps/mobile/.env:2-3`  
**Bulgu tipi:** Hardcoded Secret in EXPO_PUBLIC variable  
**Exploit:** `EXPO_PUBLIC_RC_API_KEY_IOS/ANDROID` değişkenleri `sk_` önekli **gizli** anahtar içeriyor. `EXPO_PUBLIC_` prefix ile tüm key app bundle'ına gömülür. Herhangi biri apk/ipa'yı unzip edip key'i çıkarabilir → RevenueCat API'sine tam erişim (abonelik atama/iptal, kullanıcı verisi).  
**Düzeltme:** RevenueCat panosundan anahtarı derhal iptal et. Public SDK anahtarı kullan (platform-specific public key, `sk_` değil).

### P0-2: Next.js Kritik RCE Güvenlik Açığı

**Dosya:satır:** `apps/web/package.json` (next versiyon)  
**Bulgu tipi:** CVE — GHSA-vcvr-r3jv-pc5j  
**Exploit:** `next/og ImageResponse`'ta uzaktan kod yürütme. Mevcut versiyonda aktif.  
**Düzeltme:** `npm update next` → `>= 16.3.6`

### P0-3: `GET /routes/{id}/osrm/{profile}` — Kimlik Doğrulamasız

**Dosya:satır:** `infra/lambda/src/routes/index.ts:339-399`  
**Bulgu tipi:** Missing AuthN — Unauthenticated Open Proxy  
**Exploit:** GET metodunda auth kontrolü yok. Anonim herkes OSRM endpoint'ini proxy olarak kullanabilir. `OSRM_BASE_URL` manipüle edilebilirse SSRF riski.  
**Düzeltme:** `handleOsrmRoute` fonksiyonuna `verifiedUserId` ile auth kontrolü ekle.

---

## P1 — Yüksek (Bu Sprint)

### P1-1: Client-Side Admin Bypass — localStorage + NEXT_PUBLIC_SUPER_ADMINS

**Dosya:satır:** `apps/web/app/u/admin/page.tsx:368-378`, `apps/web/.env.local:19`  
**Bulgu tipi:** AuthZ Bypass  
**Exploit:** `NEXT_PUBLIC_SUPER_ADMINS` client bundle'a gömülüyor (admin email'leri herkese görünür). Admin kontrolü `localStorage.email` ile yapılıyor — DevTools'dan manipüle edilebilir.  
**Durum:** AUDIT.md Adım 1'de client-side bypass kaldırıldı (commit bd4d64b). Env var hâlâ `.env.local`'da — kaldırılmalı.

### P1-2: JWT Token'ları localStorage'da

**Dosya:satır:** `apps/web/app/lib/cognito.ts:139-145`  
**Bulgu tipi:** Insecure Token Storage  
**Exploit:** `localStorage`'daki token'lar herhangi bir XSS ile çalınabilir. Refresh token çalınması → kalıcı hesap ele geçirme.  
**Düzeltme:** `HttpOnly; Secure; SameSite=Strict` cookie'ye taşı.

### P1-3: `places` Handler'ında Admin Kontrolü DynamoDB'den

**Dosya:satır:** `infra/lambda/src/places/index.ts:54-59`  
**Bulgu tipi:** AuthZ Flaw — Privilege Escalation  
**Exploit:** Admin kontrolü DynamoDB `PROFILE.role` alanına bakıyor. Kendi profilini güncelleyebilen bir kullanıcı `role: "admin"` yazarak admin endpoint'lerine erişebilir.  
**Düzeltme:** `getVerifiedUser().isAdmin` ile Cognito group kontrolü kullan.

### P1-4: `auth.ts`'de `isAdmin` Mantık Hatası

**Dosya:satır:** `infra/lambda/src/shared/auth.ts:155,241`  
**Bulgu tipi:** Logic Bug  
**Exploit:** `!process.env.ADMIN_GROUP_NAME && role === "admin"` — `ADMIN_GROUP_NAME` set edildiğinde `isAdmin` her zaman `false`. Veya set edilmediğinde herhangi bir kullanıcı Cognito attribute'unu manipüle edebilirse admin olur.  
**Düzeltme:** `ADMIN_GROUP_NAME` set edilmişse Cognito group kontrolü, set edilmemişse `role === "admin"` — `||` ile birleştir.

### P1-5: Google Maps API Key Plaintext

**Dosya:satır:** `apps/web/.env.local:15`, `.agents/mcp_config.json` (git'te!)  
**Bulgu tipi:** API Key Exposure  
**Exploit:** `.agents/mcp_config.json` initial commit'ten beri git'te — Google Maps key herkese açık. HTTP referrer kısıtlaması yoksa 3. taraflar ücretsiz kullanır; maliyet sahibine yansır.  
**Düzeltme:** Google Cloud Console'da key'i `mapsbridge.com` referrer'ıyla kısıtla + yeni key üret. `.agents/` gitignore'a eklendi (Adım 1, commit bd4d64b).

### P1-6: Bilinen Kritik Bağımlılık Açıkları

**Dosya:satır:** `apps/web/package.json`  
**Bulgu tipi:** CVE

- `sharp < 0.35.5`: CVE-2026-96889 — use-after-free
- `source-map-js < 1.2.2`: GHSA-68fv-2mgg-jv7q — event-loop DoS (CVSS 7.5)  
  **Düzeltme:** `npm update sharp source-map-js`

---

## P2 — Orta (Teknik Borç)

### P2-1: RevenueCat Key Root `.env`'de Plaintext

**Dosya:satır:** `/.env:2`  
**Düzeltme:** Anahtarı iptal et. AWS SSM/Secrets Manager'a taşı.

### P2-2: Admin Email Listesi Client Bundle'da

**Dosya:satır:** `apps/web/.env.local:19`  
**Düzeltme:** Env var'ı kaldır, admin kontrolü tamamen sunucu tarafına taşı.

### P2-3: GitHub OIDC Rol Tüm Branch'lara Açık

**Dosya:satır:** `infra/terraform/github-oidc.tf:19`  
**Exploit:** Herhangi bir PR dalından kötü niyetli workflow ile production deploy tetiklenebilir.  
**Düzeltme:** `ref:refs/heads/main` ile kısıtla.

### P2-4: CloudFront IAM İzni `Resource: *`

**Dosya:satır:** `infra/terraform/github-oidc.tf:45-48`  
**Düzeltme:** Belirli distribution ARN'larına kısıtla.

### P2-5: Kritik Lambda'lar VPC Dışında

**Dosya:satır:** `infra/terraform/modules/api/main.tf:186-190`  
**Exploit:** Lambda'ya sızıldığında ağ izolasyonu yok. `stripe`, `ai`, `admin` VPC dışında.  
**Düzeltme:** Bu Lambda'ları VPC içine taşı.

### P2-6: Cookie `Secure` Bayrağı Eksik

**Dosya:satır:** `apps/web/app/lib/auto-locale.ts:14`, `apps/web/app/desk/page.tsx:553`  
**Düzeltme:** `SameSite=Strict; Secure` kullan.

### P2-7: DB Password Test Değeri

**Dosya:satır:** `infra/terraform/terraform.tfvars:6`  
**Düzeltme:** `TestPassword123!` → Aurora'da rotate et.

### P2-8: WAF Dev'de Kapalı

**Dosya:satır:** `infra/terraform/main.tf:395`  
**Düzeltme:** Tüm ortamlarda WAF aktif, rate-limit değerleri ortama göre ayarlanır.

### P2-9: `discoverCity` SSRF Riski

**Dosya:satır:** `infra/lambda/src/places/index.ts:80-134`  
**Düzeltme:** Dış URL oluşturmada `city`/`country` parametrelerinin URL encode'landığını doğrula; allowlist kullan.

---

## Durum Özeti

| Adım 1'de Düzeltilen                  | Kalan P0/P1                       |
| ------------------------------------- | --------------------------------- |
| Client-side admin bypass kaldırıldı   | P0-1: RevenueCat key rotate et    |
| .agents/ gitignore'a eklendi          | P0-2: Next.js yükselt             |
| .env.example placeholder'a çevrildi   | P0-3: OSRM auth ekle              |
| Gitleaks CI'da zorunlu hale getirildi | P1-2: Token'ları cookie'ye taşı   |
|                                       | P1-3: places admin check düzelt   |
|                                       | P1-4: isAdmin mantık hatası       |
|                                       | P1-5: Google Maps key rotate et   |
|                                       | P1-6: npm bağımlılıkları güncelle |
