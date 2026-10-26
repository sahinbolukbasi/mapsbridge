# Kiro ile MapsBridge Geliştirme Rehberi

Bu doküman, MapsBridge monorepo'sunu Kiro IDE içinde en verimli şekilde geliştirmek için kurulan yapıyı ve önerilen çalışma düzenini açıklar.

## Kurulan Yapı

### 1. Steering Dosyaları (`.kiro/steering/`)

Her Kiro konuşmasına **otomatik** dahil olur. Projeyi her seferinde yeniden keşfetme ihtiyacını ortadan kaldırır.

| Dosya | İçerik |
| --- | --- |
| `product.md` | Ürün tanımı, kredi modeli, abonelik kademeleri, dil kuralı |
| `structure.md` | Monorepo ağacı, hangi klasör ne işe yarar, katman kuralları |
| `tech.md` | Stack, kod standartları, komutlar, doğrulama kuralı, Next.js uyarısı |
| `danger-zones.md` | Billing/auth/webhook gibi "dokunursan patlar" alanları |

Güncelleme: Bu dosyalar kaynak gerçeğin (`README.md`, `ARCHITECTURE.md`, `agents/*.md`) damıtılmış halidir. Mimari değiştiğinde steering'i de güncelle.

### 2. Agent Hook'ları (`.kiro/hooks/`)

| Hook | Tetikleyici | İşlev |
| --- | --- | --- |
| `lint-on-save` | `.ts`/`.tsx` kaydetme | Kaydedilen dosyada `eslint --fix` çalıştırır |

Yeni hook önerileri (ihtiyaç halinde eklenebilir):
- Backend dosyası kaydetmede `npm run test:backend`
- Commit öncesi `npm run typecheck`

### 3. MCP Serverları (`.mcp.json`)

| Server | Amaç |
| --- | --- |
| `cloudflare` | Cloudflare kaynak yönetimi. Token `${CLOUDFLARE_API_TOKEN}` env değişkeninden okunur. |
| `aws-docs` | AWS güncel dokümantasyonu (Bedrock, Lambda, DynamoDB, maliyet optimizasyonu). `uvx` gerektirir. |

**Gerekli env değişkeni** (`~/.zshrc` veya shell profiline ekle):
```bash
export CLOUDFLARE_API_TOKEN="<cloudflare-token>"
```
`.mcp.json` zaten `.gitignore`'da; token commit edilmez.

## Önerilen Çalışma Düzeni

### Vibe mi, Spec mi?

- **Vibe (sohbet)**: Küçük/orta, geri alınabilir işler — UI düzeltmeleri, yeni bileşen, bağımsız bir admin paneli sekmesi, stil değişikliği.
- **Spec (requirements → design → tasks)**: Riskli veya büyük işler:
  - Billing / kredi akışına dokunan her şey (`danger-zones.md` #1)
  - Auth / account-linking (`danger-zones.md` #2)
  - Stripe webhook (`danger-zones.md` #3)
  - Yeni mikroservis veya yeni API route grubu
  - DynamoDB GSI / şema migrasyonları (`danger-zones.md` #5)

### Context Verme

Monorepo büyük; Kiro'nun tüm ağacı taramasını önlemek için:
- `#Folder` ile ilgili klasörü ver: ör. `#apps/web/app/panel/`
- `#File` ile tek dosya ver
- İlgili dosyayı editörde açık tut (Kiro aktif dosyayı görür)
- `#Problems` (hatalar), `#Terminal` (çıktı), `#Git Diff` (değişiklikler)

### Doğrulama

Kod değişikliğinden sonra değişen alana göre çalıştır:
- Web → `npm run typecheck` + `npm run test:web`
- Backend (Lambda) → `npm run test:backend`
- Servisler → `npm run test:services`
- Hepsi → `npm run test:all`

`npm run dev` terminali bloklar — arka planda çalıştır.

## Güvenlik Hatırlatması

- `.mcp.json`, `.agents/`, `.env*` zaten `.gitignore`'da.
- Secret'lar (API token, webhook secret, PEM) asla koda/commit'e düz metin yazılmaz.
- Cloudflare token'ı düz metinden env değişkenine taşındı; eski token sızma riskine karşı rotate edilmeli.
