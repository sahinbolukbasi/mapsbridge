# Deployment Guide

This guide covers the deployment procedures for the MapsBridge frontend, Lambda functions, and infrastructure. All deployments target AWS.

---

## Frontend Deployment (S3 + CloudFront)

The Next.js frontend is statically exported and deployed to S3, served through CloudFront.

### Build

```bash
cd apps/web
npm run build
```

This produces a static export in the `out/` directory.

### Deploy

The deployment uses a 2-phase S3 sync strategy to optimize cache behavior:

#### Phase 1: Static assets (immutable cache)

Content-hashed assets (`_next/static/`, images, fonts) never change for a given filename. They receive a long-lived immutable cache header so browsers and CloudFront cache them indefinitely.

```bash
aws s3 sync out/ s3://$BUCKET \
  --exclude "*.html" --exclude "*.json" \
  --cache-control "public,max-age=31536000,immutable" \
  --profile default
```

#### Phase 2: HTML and JSON (must-revalidate)

Page files and data files change on every build. They receive a `must-revalidate` directive so CloudFront and browsers always check for a fresh version.

```bash
aws s3 sync out/ s3://$BUCKET \
  --include "*.html" --include "*.json" \
  --cache-control "public,max-age=0,must-revalidate" \
  --profile default
```

#### Phase 3: CloudFront invalidation

After uploading, invalidate the CloudFront cache to ensure edge locations pick up the new HTML and JSON files immediately.

```bash
aws cloudfront create-invalidation \
  --distribution-id $CF_DIST_ID \
  --paths "/*" --profile default
```

### Automated deployment

The full pipeline is wrapped in a single script:

```bash
./scripts/deploy-production.sh
```

This script runs all three phases in sequence and reports the invalidation ID for tracking.

---

## Lambda Deployment

Lambda functions are bundled with esbuild and deployed through Terraform.

### Build

```bash
./infra/scripts/build-lambdas.sh
```

This script:
1. Compiles each Lambda handler from TypeScript to JavaScript using esbuild.
2. Targets `node22` with `arm64` (Graviton) as the platform.
3. Bundles all dependencies into a single file per function.
4. Creates `.zip` archives in the expected output directory for Terraform.

### Deploy

```bash
cd infra/terraform
terraform plan -out=tfplan
terraform apply tfplan
```

Terraform detects changes in the `.zip` artifacts (via source code hash) and updates only the Lambda functions that changed.

### Verifying deployment

After applying, verify the deployment:

```bash
# Check function configuration
aws lambda get-function-configuration \
  --function-name mapsbridge-<env>-<domain> \
  --query '{Runtime:Runtime,MemorySize:MemorySize,LastModified:LastModified}'

# Invoke a health check (if the function supports it)
aws lambda invoke \
  --function-name mapsbridge-<env>-<domain> \
  --payload '{"path":"/health","httpMethod":"GET"}' \
  response.json
```

---

## Environment Configuration

### Variables

| Variable | Source | Description |
|----------|--------|-------------|
| `$BUCKET` | `terraform.tfvars` | S3 bucket name: `{project}-{env}-{account}-web` |
| `$CF_DIST_ID` | Terraform output | CloudFront distribution ID (environment-specific) |
| AWS Profile | `~/.aws/config` | AWS CLI profile with deployment permissions |

### Terraform variables

Production configuration lives in `infra/terraform/terraform.tfvars`. Key settings include:

- `environment` -- Deployment target (`dev`, `staging`, `production`)
- `project_name` -- Used as a prefix for all resource names
- `domain_name` -- Custom domain for API Gateway and CloudFront

### Retrieving outputs

```bash
cd infra/terraform

# Get CloudFront distribution ID
terraform output cloudfront_distribution_id

# Get S3 bucket name
terraform output web_bucket_name

# Get API endpoint
terraform output api_endpoint
```

---

## Rollback Procedures

### Frontend rollback

The frontend is a static export, so rollback means re-deploying a previous build.

```bash
# Check out the previous known-good commit
git checkout <commit-sha>

# Rebuild and deploy
cd apps/web && npm run build
./scripts/deploy-production.sh

# Return to the working branch
git checkout -
```

Alternatively, if you have the previous `out/` directory cached in CI, re-run the S3 sync and CloudFront invalidation steps without rebuilding.

### Lambda rollback

Terraform state tracks the previous Lambda deployment artifacts. To rollback:

```bash
# Option 1: Revert to a previous commit and redeploy
git checkout <commit-sha> -- infra/lambda/
./infra/scripts/build-lambdas.sh
cd infra/terraform
terraform plan -out=tfplan
terraform apply tfplan

# Option 2: Use Terraform state
# Terraform automatically rolls back if you revert the .zip artifacts
# to their previous versions and re-apply
```

### Database rollback

| Service | Recovery Method |
|---------|----------------|
| **DynamoDB** | Point-in-time recovery (PITR) enabled in production. Restore to any point within the last 35 days. |
| **Aurora** | Automated backups with configurable retention. Restore to a new cluster from a snapshot or point-in-time. |
| **Redis** | No persistent rollback. Cache is rebuilt on next access. |

```bash
# DynamoDB point-in-time restore (production)
aws dynamodb restore-table-to-point-in-time \
  --source-table-name mapsbridge-prod-main \
  --target-table-name mapsbridge-prod-main-restored \
  --restore-date-time "2026-10-12T00:00:00Z"
```

---

## Deployment Checklist

Use this checklist before deploying to production:

- [ ] All TypeScript checks pass (`npm run typecheck`)
- [ ] Lambda build completes without errors (`./infra/scripts/build-lambdas.sh`)
- [ ] Frontend build completes without errors (`cd apps/web && npm run build`)
- [ ] `terraform plan` shows only expected changes
- [ ] Environment variables are set correctly in `terraform.tfvars`
- [ ] No secrets are committed to the repository
- [ ] CloudFront invalidation completes after frontend deploy
- [ ] Smoke test key API endpoints after Lambda deploy
- [ ] Monitor CloudWatch alarms for 15 minutes post-deploy
