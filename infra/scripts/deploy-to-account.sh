#!/bin/bash
# deploy-to-account.sh — Deploy MapsBridge to a new (or existing) AWS account
#
# Usage:
#   ./infra/scripts/deploy-to-account.sh \
#     --profile my-aws-profile \
#     --tfvars infra/terraform/accounts/my-account.tfvars \
#     [--region eu-central-1] \
#     [--skip-build] \
#     [--plan-only]
#
# Prerequisites (first time only):
#   1. Create an IAM user/role in the target account with AdministratorAccess
#   2. Add AWS credentials to ~/.aws/credentials under a named profile
#   3. Bootstrap remote state (see infra/terraform/backend.tf.example)
#   4. Copy infra/terraform/accounts/new-account.tfvars.example → your tfvars

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TERRAFORM_DIR="$PROJECT_ROOT/infra/terraform"

# ─── Defaults ─────────────────────────────────────────────────────────────
AWS_PROFILE=""
TFVARS_FILE=""
AWS_REGION="eu-central-1"
SKIP_BUILD=false
PLAN_ONLY=false
EXPECTED_ACCOUNT=""

# ─── Parse args ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)   AWS_PROFILE="$2"; shift 2 ;;
    --tfvars)    TFVARS_FILE="$2"; shift 2 ;;
    --region)    AWS_REGION="$2"; shift 2 ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    --plan-only) PLAN_ONLY=true; shift ;;
    --expected-account) EXPECTED_ACCOUNT="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$AWS_PROFILE" || -z "$TFVARS_FILE" ]]; then
  echo "Usage: $0 --profile <aws-profile> --tfvars <path-to.tfvars>"
  exit 1
fi

if [[ ! -f "$PROJECT_ROOT/$TFVARS_FILE" ]]; then
  echo "ERROR: tfvars file not found: $PROJECT_ROOT/$TFVARS_FILE"
  exit 1
fi

export AWS_PROFILE="$AWS_PROFILE"
export AWS_DEFAULT_REGION="$AWS_REGION"

echo ""
echo "=== MapsBridge Deploy to AWS Account ==="
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Account ID : $ACCOUNT_ID"
# Güvenlik: yanlış hesaba deploy'u engelle. --expected-account verilirse birebir eşleşmeli.
if [[ -n "$EXPECTED_ACCOUNT" && "$ACCOUNT_ID" != "$EXPECTED_ACCOUNT" ]]; then
  echo ""
  echo "✗ HESAP UYUŞMAZLIĞI: beklenen $EXPECTED_ACCOUNT, bağlı olunan $ACCOUNT_ID"
  echo "  Yanlış profil. Deploy iptal edildi (hiçbir kaynağa dokunulmadı)."
  exit 1
fi
echo "Profile    : $AWS_PROFILE"
echo "Region     : $AWS_REGION"
echo "tfvars     : $TFVARS_FILE"
echo ""

# ─── Step 1: Build lambdas & web ──────────────────────────────────────────
if [[ "$SKIP_BUILD" == false ]]; then
  echo "── Step 1: Building Lambda packages ──"
  bash "$SCRIPT_DIR/build-lambdas.sh"

  echo ""
  echo "── Step 1b: Building Next.js web app ──"
  cd "$PROJECT_ROOT/apps/web"
  npm run build
  cd "$PROJECT_ROOT"
  echo "  ✓ Web build complete"
fi

# ─── Step 2: Bootstrap remote state bucket (idempotent) ───────────────────
# State isimleri backend.tf ile BİREBİR aynı olmalı; aksi halde terraform init
# mevcut state yerine ikinci bir bucket oluşturur ve state ikiye bölünür.
STATE_BUCKET="mapsbridge-terraform-state-${ACCOUNT_ID}"
LOCK_TABLE="mapsbridge-terraform-locks"

echo ""
echo "── Step 2: Bootstrapping remote state ──"
if aws s3 ls "s3://$STATE_BUCKET" 2>/dev/null; then
  echo "  ✓ State bucket already exists: $STATE_BUCKET"
else
  echo "  Creating state bucket: $STATE_BUCKET"
  aws s3 mb "s3://$STATE_BUCKET" --region "$AWS_REGION"
  aws s3api put-bucket-versioning \
    --bucket "$STATE_BUCKET" \
    --versioning-configuration Status=Enabled
  aws s3api put-bucket-encryption \
    --bucket "$STATE_BUCKET" \
    --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
  echo "  ✓ Created $STATE_BUCKET"
fi

if aws dynamodb describe-table --table-name "$LOCK_TABLE" 2>/dev/null; then
  echo "  ✓ Lock table already exists: $LOCK_TABLE"
else
  echo "  Creating DynamoDB lock table: $LOCK_TABLE"
  aws dynamodb create-table \
    --table-name "$LOCK_TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$AWS_REGION"
  aws dynamodb wait table-exists --table-name "$LOCK_TABLE"
  echo "  ✓ Created $LOCK_TABLE"
fi

# ─── Step 3: terraform init with backend ──────────────────────────────────
ENV=$(grep 'environment' "$PROJECT_ROOT/$TFVARS_FILE" | head -1 | awk -F'"' '{print $2}')
ENV="${ENV:-prod}"

echo ""
echo "── Step 3: terraform init (backend: s3/$STATE_BUCKET/$ENV) ──"
cd "$TERRAFORM_DIR"
terraform init -reconfigure \
  -backend-config="bucket=$STATE_BUCKET" \
  -backend-config="key=$ENV/terraform.tfstate" \
  -backend-config="region=$AWS_REGION" \
  -backend-config="dynamodb_table=$LOCK_TABLE" \
  -backend-config="encrypt=true"
echo "  ✓ Terraform initialized"

# ─── Step 4: terraform plan ───────────────────────────────────────────────
echo ""
echo "── Step 4: terraform plan ──"
terraform plan \
  -var-file="$PROJECT_ROOT/$TFVARS_FILE" \
  -out="tfplan-${ACCOUNT_ID}-${ENV}"
echo "  ✓ Plan written: tfplan-${ACCOUNT_ID}-${ENV}"

if [[ "$PLAN_ONLY" == true ]]; then
  echo ""
  echo "=== Plan-only mode. Review above and re-run without --plan-only to apply ==="
  exit 0
fi

# ─── Step 5: terraform apply ──────────────────────────────────────────────
echo ""
echo "── Step 5: terraform apply ──"
terraform apply "tfplan-${ACCOUNT_ID}-${ENV}"
echo "  ✓ Infrastructure applied"

# ─── Step 6: Upload web build to S3 ──────────────────────────────────────
WEB_BUCKET=$(terraform output -raw website_url 2>/dev/null | sed 's|https://||' || echo "")
CF_DIST_ID=$(terraform output -raw cloudfront_distribution_id 2>/dev/null || echo "")

echo ""
echo "── Step 6: Upload web build ──"
if [[ -d "$PROJECT_ROOT/apps/web/out" ]]; then
  aws s3 sync "$PROJECT_ROOT/apps/web/out" "s3://${ACCOUNT_ID}-${ENV}-web" \
    --delete --cache-control "public,max-age=31536000,immutable" \
    --exclude "*.html" --exclude "*.json"
  aws s3 sync "$PROJECT_ROOT/apps/web/out" "s3://${ACCOUNT_ID}-${ENV}-web" \
    --delete --cache-control "no-cache" \
    --include "*.html" --include "*.json"
  echo "  ✓ Web files uploaded"

  if [[ -n "$CF_DIST_ID" ]]; then
    aws cloudfront create-invalidation \
      --distribution-id "$CF_DIST_ID" \
      --paths "/*"
    echo "  ✓ CloudFront cache invalidated"
  fi
else
  echo "  ⚠ apps/web/out not found — run 'npm run build' first or remove --skip-build"
fi

# ─── Done ────────────────────────────────────────────────────────────────
echo ""
echo "=== Deployment complete ==="
terraform output
