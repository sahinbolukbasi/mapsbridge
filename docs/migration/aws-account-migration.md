# AWS Hesap Migrasyonu — Tüm Stack

Mevcut hesap: `996270854731` (eu-central-1)
Yeni hesap: `<NEW_ACCOUNT_ID>` (eu-central-1)

## Ön Koşullar (Yeni Hesapta Manuel)

1. **AWS CLI profili ayarla**
   ```bash
   aws configure --profile mapsbridge-new
   # Access Key, Secret Key, Region: eu-central-1
   ```

2. **Bedrock model erişimi iste** (Console → Bedrock → Model access)
   - `anthropic.claude-haiku-4-5-20251001-v1:0`
   - `amazon.titan-embed-text-v2:0`
   - `amazon.nova-2-lite-v1:0`
   - Cross-region inference profile: `eu.anthropic.claude-haiku-4-5-20251001-v1:0`

3. **Terraform state backend** (opsiyonel ama önerilir)
   ```bash
   aws s3 mb s3://adreskopru-prod-tfstate-<NEW_ACCOUNT_ID> --region eu-central-1 --profile mapsbridge-new
   ```

4. **Domain DNS**: mapsbridge.com Route53 hosted zone'u yeni hesaba taşı veya NS kayıtlarını güncelle

---

## Deploy Sırası

### Adım 1: Ana Stack (`infra/terraform/`)

```bash
cd infra/terraform

# Mevcut state'i temizle (yeni hesap, sıfır state)
rm -f terraform.tfstate terraform.tfstate.backup

# tfvars güncelle
cat > terraform.tfvars <<EOF
aws_region  = "eu-central-1"
environment = "prod"
project     = "adreskopru"

# Yeni hesap için aşağıdakileri doldur:
# frontend_domain      = "mapsbridge.com"
# acm_certificate_arn  = "<us-east-1'de oluşturulan ACM ARN>"
# hosted_zone_id       = "<Route53 zone ID>"
# budget_alert_email   = "admin@mapsbridge.com"
# db_password          = "<yeni güçlü şifre>"
EOF

# Lambda paketlerini build et
cd ../../
bash scripts/build-lambdas.sh
cd infra/terraform

# Plan & Apply
terraform init
terraform plan -out=migration.tfplan
terraform apply migration.tfplan
```

**Çıktıları kaydet** — sonraki adımlarda lazım:
```bash
terraform output -json > /tmp/tf-main-outputs.json
```

### Adım 2: Admin Runtime (`infra/admin-runtime/`)

```bash
cd ../admin-runtime

# State temizle
rm -f terraform.tfstate terraform.tfstate.backup

# terraform.tfvars'ı Adım 1 çıktılarıyla doldur:
# account_id           = "<NEW_ACCOUNT_ID>"
# api_id               = "<terraform output api_gateway_id>"
# dynamodb_table       = "adreskopru-prod-data"
# cognito_user_pool_id = "<terraform output cognito_user_pool_id>"
# cognito_client_id    = "<terraform output cognito_web_client_id>"

# Build & deploy
bash ../../scripts/build-admin-runtime.sh   # veya mevcut build script
terraform init
terraform plan -out=migration.tfplan
terraform apply migration.tfplan
```

### Adım 3: AgentCore Gateway (`infra/agentcore-gateway/`)

```bash
cd ../agentcore-gateway

rm -f terraform.tfstate terraform.tfstate.backup

# tfvars güncelle
cat > terraform.tfvars <<EOF
account_id           = "<NEW_ACCOUNT_ID>"
prefix               = "adreskopru-prod"
ai_role_name         = "adreskopru-prod-ai-runtime"
region               = "eu-central-1"
travelpayouts_token  = "4c3efecda5b163ce6f5e25f18a1db1f9"
travelpayouts_marker = "585085"
EOF

terraform init
terraform plan -out=migration.tfplan
terraform apply migration.tfplan

# Gateway çıktısını kaydet
terraform output -json > /tmp/tf-gateway-outputs.json
```

### Adım 4: AI Memory (`infra/ai-memory/`)

```bash
cd ../ai-memory

rm -f terraform.tfstate terraform.tfstate.backup

# tfvars oluştur (mevcut yoksa)
cat > terraform.tfvars <<EOF
account_id        = "<NEW_ACCOUNT_ID>"
prefix            = "adreskopru-prod"
api_id            = "<Adım 1 api_gateway_id>"
application_table = "adreskopru-prod-data"
ai_role_name      = "adreskopru-prod-ai-runtime"
cognito_pool_id   = "<Adım 1 cognito_user_pool_id>"
cognito_client_id = "<Adım 1 cognito_web_client_id>"
region            = "eu-central-1"
EOF

terraform init
terraform plan -out=migration.tfplan
terraform apply migration.tfplan
```

### Adım 5: Admin Runtime Auto-tfvars Güncelle

Adım 3 ve 4'ün çıktılarıyla:

```bash
cd ../admin-runtime

# ai-capabilities.auto.tfvars.json — gateway URL'i güncelle
# memory.auto.tfvars.json — memory ID ve table güncelle
# Sonra:
terraform plan -out=update.tfplan
terraform apply update.tfplan
```

---

## Deploy Sonrası Manuel Adımlar

### Stripe
- Stripe Dashboard → Webhooks → yeni endpoint ekle: `https://<yeni API URL>/stripe/webhook`
- SSM Parameter Store'a ekle:
  ```bash
  aws ssm put-parameter --name /mapsbridge/prod/stripe/secret-key --value "<sk_live_...>" --type SecureString --profile mapsbridge-new
  aws ssm put-parameter --name /mapsbridge/prod/stripe/webhook-secret --value "<whsec_...>" --type SecureString --profile mapsbridge-new
  ```

### Domain & SSL
- ACM certificate oluştur (us-east-1): `*.mapsbridge.com` + `mapsbridge.com`
- DNS validation tamamla
- CloudFront distribution'a certificate ekle (terraform.tfvars → `acm_certificate_arn`)
- Route53 A record → yeni CloudFront distribution

### Cognito Admin Kullanıcı
```bash
# Admin kullanıcı oluştur
aws cognito-idp admin-create-user \
  --user-pool-id <NEW_POOL_ID> \
  --username admin@mapsbridge.com \
  --user-attributes Name=email,Value=admin@mapsbridge.com Name=name,Value=Admin \
  --profile mapsbridge-new

# Admin grubuna ekle
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <NEW_POOL_ID> \
  --username admin@mapsbridge.com \
  --group-name mapsbridge-admin \
  --profile mapsbridge-new
```

### Frontend `.env` Güncelle
```env
NEXT_PUBLIC_API_URL=https://<yeni API Gateway URL>
NEXT_PUBLIC_WS_URL=wss://<yeni WebSocket URL>
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<yeni pool ID>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<yeni client ID>
NEXT_PUBLIC_AI_STREAM_URL=<yeni Lambda Function URL>
NEXT_PUBLIC_CLOUDFRONT_URL=https://<yeni CloudFront domain>
```

### Bedrock Guardrail
Mevcut guardrail (fbj50603sjh9) yeni hesapta yeniden oluşturulmalı. Console → Bedrock → Guardrails.

---

## Doğrulama Checklist

- [ ] Frontend yüklenip açılıyor
- [ ] Kayıt/giriş çalışıyor (Cognito)
- [ ] AI chat route modu çalışıyor (Bedrock)
- [ ] AgentCore Gateway tool çağrıları (flights, advisory, places)
- [ ] Stripe checkout çalışıyor
- [ ] WebSocket chat bağlantısı
- [ ] Admin panel erişimi
- [ ] Background monitor çalışıyor (CloudWatch Events)
- [ ] AI Memory opt-in/opt-out
