# Dağıtım Mimarisi ve CI/CD Rehberi

Bu belge, MapsBridge platformunun AWS altyapısına dağıtım adımlarını ve CI/CD süreçlerini içerir.

---

## 1. Dağıtım Mimarisi

- **Web İstemcisi:** Next.js 16 SPA statik çıktı (`apps/web/out/`) ➔ AWS S3 Web Bucket ➔ CloudFront Dağıtımı (Global Edge Cache).
- **Backend API:** Node.js 22 ARM64 Lambda fonksiyonları esbuild ile derlenir (`infra/terraform/.build/lambdas/*.zip`) ➔ AWS API Gateway HTTP v2 & WebSocket v2 entegrasyonu.
- **Altyapı Yönetimi:** HashiCorp Terraform (`infra/terraform/`).

---

## 2. Derleme ve Dağıtım Adımları

### 2.1 Lambda Fonksiyonlarını Paketleme
```bash
# Lambda esbuild derlemesi
bash infra/scripts/build-lambdas.sh
```

### 2.2 Web İstemcisini Derleme
```bash
# Next.js statik export
npm --prefix apps/web run build
```

### 2.3 Terraform ile Altyapı Güncelleme
```bash
cd infra/terraform
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

### 2.4 CloudFront Önbelleğini Temizleme (Invalidation)
Web sürümü dağıtıldıktan sonra CloudFront önbelleği temizlenir:
```bash
aws cloudfront create-invalidation --distribution-id <DISTRIBUTION_ID> --paths "/*"
```

---

## 3. CI/CD Süreci (.github/workflows/quality.yml)

Pipeline her pull request ve main dalına push işleminde şu sırayla çalışır:
1. **Checkout & Setup:** Node.js 22 ortamı kurulur.
2. **Restore:** Bağımlılıklar önbellekten yüklenir (`npm ci`).
3. **Typecheck & Lint:** `npm --prefix apps/web run typecheck`.
4. **Birim ve Güvenlik Testleri:** `npm test && npm run test:backend`.
5. **AI Diyalog Değerlendirmesi:** `npm run eval:ai`.
6. **Güvenlik Doğrulaması:** Tüm testler yeşil ise derleme onaylanır.
