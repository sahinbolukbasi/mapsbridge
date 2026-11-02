# AWS Hesap Durumu — Deploy Hedefi

> **Tek doğruluk kaynağı.** Tüm deploy'lar `865369794421` hesabına yapılır.
> `996270854731` hesabına **hiçbir şey deploy edilmez** (geliştirici CLI'ı bu
> hesapta olabilir, ama deploy GitHub Actions OIDC rolü ile `865`'e gider).

| Hesap          | Durum                                                       |
| -------------- | ----------------------------------------------------------- |
| `865369794421` | **AKTİF / DEPLOY HEDEFİ** — tüm production altyapısı burada |
| `996270854731` | Kullanılmıyor — asla deploy edilmez                         |

## Canlıya Alma — Önerilen Yol (GitHub Actions)

Deploy için **local AWS CLI erişimine gerek yoktur**. GitHub Actions, OIDC rolü
(`AWS_DEPLOY_ROLE_ARN` secret) ile `865` hesabına deploy eder.

### 1. Altyapı (Terraform)

`Actions → Terraform Apply` workflow'unu `workflow_dispatch` ile tetikle.

- `stack` seçimi: ilk kurulumda `all` (bağımlılık sırasını workflow yönetir:
  `main → admin-runtime → agentcore-gateway → ai-memory → ai-finops → ai-training → travel-rag`).
- Önce `plan_only: true` ile planı incele, sonra `plan_only: false` ile uygula.
- `ACCOUNT_ID` workflow'da `865369794421`'e sabitlidir.

### 2. Lambda kodu (API)

`infra/lambda/**` main'e merge edilince `Deploy API (Lambda)` workflow'u otomatik
çalışır. Artık deploy öncesi **typecheck + unit test** geçmeden deploy olmaz.
Manuel tetiklemek için: `Actions → Deploy API (Lambda) → Run workflow`.

### 3. Web (Next.js)

`Deploy Web` workflow'u — static export → S3 + CloudFront invalidation.

## Gerekli GitHub Secrets (865 hesabı)

Terraform Apply ve Deploy API workflow'ları bu secret'ları kullanır:

| Secret                                        | Açıklama                                                   |
| --------------------------------------------- | ---------------------------------------------------------- |
| `AWS_DEPLOY_ROLE_ARN`                         | `865` hesabındaki OIDC deploy rolü ARN'si                  |
| `API_GATEWAY_ID`                              | Çekirdek stack çıktısı (HTTP API ID)                       |
| `DYNAMODB_TABLE`                              | `mapsbridge-prod-data`                                     |
| `COGNITO_USER_POOL_ID`                        | Çekirdek stack çıktısı                                     |
| `COGNITO_CLIENT_ID`                           | Çekirdek stack çıktısı                                     |
| `ADMIN_SUB`                                   | Birincil admin Cognito sub (rolü panelden değişmez)        |
| `ACM_CERT_ARN`                                | us-east-1 `*.mapsbridge.com` sertifika ARN'si (CloudFront) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`  | Stripe (production'da asla değiştirilmez)                  |
| `ADMIN_ALLOWED_CIDRS`, `SLACK_ADMIN_USER_IDS` | Opsiyonel erişim/operasyon ayarları                        |

> Çekirdek stack ilk kez apply edildiğinde `terraform output` ile `API_GATEWAY_ID`,
> `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` değerlerini al ve GitHub Secrets'a yaz.
> admin-runtime ve ai-memory stack'leri bu secret'ları `TF_VAR_*` olarak kullanır.

## Manuel Deploy (yedek yol — local CLI gerekir)

`865` hesabına CLI erişimin varsa:

```bash
# Profili doğrula (865 olmalı):
aws sts get-caller-identity --profile mapsbridge-865

# Çekirdek stack — hesap guard'ı yanlış hesabı engeller:
./infra/scripts/deploy-to-account.sh \
  --profile mapsbridge-865 \
  --tfvars infra/terraform/terraform.tfvars \
  --expected-account 865369794421 \
  --plan-only       # önce plan; onayladıktan sonra --plan-only'siz çalıştır
```

> Not: `deploy-to-account.sh` yalnızca çekirdek `infra/terraform` stack'ini kurar.
> admin-runtime ve diğer stack'ler için GitHub Actions `Terraform Apply` workflow'u
> kullanılır (bağımlılık sırasını yönetir).

## İlk Kurulum Ön Koşulları (865 hesabı)

- [ ] OIDC deploy rolü (`AWS_DEPLOY_ROLE_ARN`) oluştur ve GitHub Secrets'a yaz
- [ ] Terraform state: `mapsbridge-terraform-state-865369794421` bucket +
      `mapsbridge-terraform-locks` DynamoDB tablosu (deploy script idempotent oluşturur)
- [ ] Bedrock model erişimi iste (Claude Haiku, Titan Embed, Nova)
- [ ] us-east-1'de `*.mapsbridge.com` ACM sertifikası oluştur → `ACM_CERT_ARN`
- [ ] Çekirdek stack apply → çıktıları GitHub Secrets'a yaz (yukarıdaki tablo)
