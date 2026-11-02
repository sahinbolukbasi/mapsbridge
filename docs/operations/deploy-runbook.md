# Deploy Runbook — Hızlı ve Güvenli Canlıya Alma

> **Altın kural:** Altyapı (yavaş, nadir değişir) ≠ uygulama kodu (hızlı, sık değişir).
> Kod değişikliğinde **ASLA** `Terraform Apply` tetikleme. Terraform kod yönetmez
> (`ignore_changes = [source_code_hash]`); kod `aws lambda update-function-code` ile gider.

## Karar tablosu — ne değişti → ne tetiklenir

| Değişen                                                                                     | Workflow                        | Süre    | Nasıl                                                 |
| ------------------------------------------------------------------------------------------- | ------------------------------- | ------- | ----------------------------------------------------- |
| **Lambda/backend kodu** (`infra/lambda/**`, `apps/web/server/**`, `apps/web/app/lib/ai/**`) | `Deploy API (Lambda)`           | ~1-2 dk | `main`'e push → otomatik. Veya Actions → Run workflow |
| **Web (Next.js)** (`apps/web/**`)                                                           | `Deploy Web`                    | ~2-3 dk | `main`'e push → otomatik                              |
| **Mobil**                                                                                   | `Deploy iOS` / `Deploy Android` | —       | `main`'e push → otomatik                              |
| **Altyapı** (yeni AWS kaynağı, Terraform `.tf`)                                             | `Terraform Apply`               | yavaş   | Actions → Run workflow → **tek stack seç**            |

**%90 durumda sadece kod değişir → `Deploy API` / `Deploy Web` yeter. Terraform'a dokunma.**

## Terraform Apply — ne zaman ve nasıl

Yalnızca gerçekten altyapı değiştiyse (yeni Lambda, yeni tablo, IAM, CloudFront ayarı):

1. Actions → `Terraform Apply` → Run workflow
2. **`stack`**: değişen tek stack'i seç (`main`, `admin-runtime`, ...). **`all` sadece ilk kurulumda.**
3. İlk kez emin değilsen **`plan_only: true`** ile başla, planı incele, sonra apply.
4. İptal edilmiş bir run'dan kalan kilit olursa: **`force_unlock: true`** ile tetikle.

### Stack bağımlılık sırası (`all` seçilirse workflow otomatik yönetir)

```
main → admin-runtime → agentcore-gateway → ai-memory → ai-finops → ai-training → travel-rag
```

Tek stack apply'da: `admin-runtime`/`ai-*` çekirdek (`main`) çıktılarına bağlıdır;
çekirdek ilk kez kurulmadan bunları apply etme.

## Neden "önceden yavaştı" — çözülen kök nedenler

| Sorun                                                                | Çözüm                                                      |
| -------------------------------------------------------------------- | ---------------------------------------------------------- |
| Her değişiklikte `all` apply → CloudFront/Aurora'ya gereksiz dokunma | Kod için Terraform'a hiç dokunma; altyapı için tek stack   |
| VPC-bağlı admin Lambda → her apply'da 45dk ENI detach                | VPC bloğu kaldırıldı — Lambda'lar artık VPC'de değil       |
| `terraform init -upgrade` × 14 → her seferinde provider arama        | `-input=false` + lock'tan sabit sürüm                      |
| İki apply çakışması → stale state lock                               | `concurrency: terraform-apply` (tek apply)                 |
| IAM AccessDenied (deploy rolü izinleri)                              | in-job bootstrap + 150s propagation; `s3vectors:*` eklendi |
| Hatalı tipli kod sessizce deploy                                     | CI + deploy öncesi zorunlu `typecheck:backend`             |

## Yerel doğrulama (push öncesi)

```bash
npm run typecheck:all      # web + backend tip kontrolü
npm run test:all           # tüm testler
```

Bunlar geçmeden push etme — CI zaten zorunlu kılıyor ama yerelde yakalamak daha hızlı.

## Deploy sonrası sağlık kontrolü

`Deploy API` kendi health check'ini çalıştırır (`/health`). Manuel:

```bash
curl -s -o /dev/null -w "%{http_code}" https://<api-base-url>/health
```
