# AWS Hesap Migrasyonu — Durum

Eski hesap: `996270854731` (KAPANACAK)
Yeni hesap: `865369794421` (AKTİF — tüm operasyon burada)

## Tamamlanan Adımlar

- [x] Terraform backend S3: `mapsbridge-terraform-state-865369794421`
- [x] GitHub OIDC role: `arn:aws:iam::865369794421:role/...`
- [x] GitHub Secrets: `AWS_DEPLOY_ROLE_ARN` yeni hesabı gösteriyor
- [x] Tüm infra TF dosyaları `mapsbridge` prefix kullanıyor
- [x] Frontend localStorage migration: `adreskopru.*` → `mapsbridge.*` (cognito.ts)
- [x] CI/CD: deploy-web, deploy-api, deploy-ios, deploy-android workflow'ları yeni hesaba deploy ediyor

## Eski Hesapta Kapatılması Gerekenler (996270854731)

> **ÖNEMLİ**: Eski hesaba admin erişimi gerekiyor. Mevcut `bedrock-vscode-continue` kullanıcısının
> sadece Bedrock izni var. Console'dan giriş yapıp aşağıdakileri siliniz.

### Silinecek Kaynaklar

1. **Lambda fonksiyonları**: `adreskopru-prod-*` prefix'li tüm fonksiyonlar
2. **S3 bucket'ları**: `adreskopru-prod-996270854731-web`, `adreskopru-prod-*` bucketlar
3. **API Gateway**: `adreskopru-prod` HTTP API
4. **DynamoDB tabloları**: `adreskopru-prod-data` ve ilgili tablolar
5. **Cognito User Pool**: Eski `adreskopru` pool (kullanıcılar yeni pool'a kaydoldu)
6. **CloudFront distribution**: Eski web distribution (DNS artık yeni hesabı gösteriyor)
7. **CloudWatch log grupları**: `/aws/lambda/adreskopru-*`
8. **IAM rolleri**: `adreskopru-prod-*` rolleri
9. **RDS/Aurora**: Eski cluster varsa
10. **Bedrock guardrail**: Eski guardrail (fbj50603sjh9) — yenisi yeni hesapta oluşturulacak
11. **IAM user**: `bedrock-vscode-continue` — artık gerekli değil

### Console'dan Silme Sırası

1. CloudFront → Distribution disable → delete
2. API Gateway → Delete API
3. Lambda → Delete all `adreskopru-*` functions
4. S3 → Empty + Delete buckets
5. DynamoDB → Delete tables
6. Cognito → Delete user pool
7. RDS → Delete cluster (snapshot al önce)
8. CloudWatch Logs → Delete log groups
9. IAM → Detach policies, delete roles and users

## Yeni Hesap Eksikler (865369794421)

- [ ] Terraform Apply çalıştır (GitHub Actions → Terraform Apply workflow)
- [ ] Bedrock model erişimi iste (Claude, Titan Embed, Nova)
- [ ] Bedrock guardrail oluştur
- [ ] AWS CLI default profile güncelle: `865369794421`
- [ ] Grafana Cloud → CloudWatch data source bağla
