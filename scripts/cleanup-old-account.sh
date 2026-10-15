#!/usr/bin/env bash
# Cleanup script for old AWS account (996270854731)
# Run this with admin credentials for the old account
#
# Usage:
#   export AWS_PROFILE=old-account-admin
#   bash scripts/cleanup-old-account.sh [--dry-run]

set -euo pipefail

REGION="eu-central-1"
DRY_RUN="${1:-}"
PREFIX="adreskopru"

if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "=== DRY RUN MODE — no resources will be deleted ==="
  echo ""
fi

run() {
  echo "→ $1"
  if [ "$DRY_RUN" != "--dry-run" ]; then
    eval "$2" || echo "  ⚠️  Failed: $1"
  else
    echo "  [skip: dry-run]"
  fi
}

echo "=== Cleaning old account resources (prefix: $PREFIX) ==="
echo ""

# 1. Lambda functions
echo "── Lambda Functions ──"
FUNCS=$(aws lambda list-functions --region $REGION \
  --query "Functions[?starts_with(FunctionName,'${PREFIX}-')].FunctionName" \
  --output text 2>/dev/null || echo "")
if [ -n "$FUNCS" ]; then
  for fn in $FUNCS; do
    run "Delete Lambda: $fn" "aws lambda delete-function --function-name $fn --region $REGION"
  done
else
  echo "  No Lambda functions found"
fi
echo ""

# 2. API Gateway
echo "── API Gateway ──"
APIS=$(aws apigatewayv2 get-apis --region $REGION \
  --query "Items[?starts_with(Name,'${PREFIX}')].ApiId" \
  --output text 2>/dev/null || echo "")
if [ -n "$APIS" ]; then
  for api in $APIS; do
    run "Delete API: $api" "aws apigatewayv2 delete-api --api-id $api --region $REGION"
  done
else
  echo "  No API Gateways found"
fi
echo ""

# 3. DynamoDB tables
echo "── DynamoDB Tables ──"
TABLES=$(aws dynamodb list-tables --region $REGION \
  --query "TableNames[?starts_with(@,'${PREFIX}-')]" \
  --output text 2>/dev/null || echo "")
if [ -n "$TABLES" ]; then
  for table in $TABLES; do
    run "Delete DynamoDB: $table" "aws dynamodb delete-table --table-name $table --region $REGION"
  done
else
  echo "  No DynamoDB tables found"
fi
echo ""

# 4. S3 buckets
echo "── S3 Buckets ──"
BUCKETS=$(aws s3api list-buckets \
  --query "Buckets[?starts_with(Name,'${PREFIX}')].Name" \
  --output text 2>/dev/null || echo "")
if [ -n "$BUCKETS" ]; then
  for bucket in $BUCKETS; do
    run "Empty + Delete S3: $bucket" \
      "aws s3 rm s3://$bucket --recursive && aws s3api delete-bucket --bucket $bucket --region $REGION"
  done
else
  echo "  No S3 buckets found"
fi
echo ""

# 5. Cognito User Pools
echo "── Cognito User Pools ──"
POOLS=$(aws cognito-idp list-user-pools --max-results 20 --region $REGION \
  --query "UserPools[?starts_with(Name,'${PREFIX}')].Id" \
  --output text 2>/dev/null || echo "")
if [ -n "$POOLS" ]; then
  for pool in $POOLS; do
    run "Delete Cognito Pool: $pool" \
      "aws cognito-idp delete-user-pool --user-pool-id $pool --region $REGION"
  done
else
  echo "  No Cognito pools found"
fi
echo ""

# 6. CloudWatch Log Groups
echo "── CloudWatch Log Groups ──"
LOGS=$(aws logs describe-log-groups --region $REGION \
  --log-group-name-prefix "/aws/lambda/${PREFIX}" \
  --query "logGroups[].logGroupName" \
  --output text 2>/dev/null || echo "")
if [ -n "$LOGS" ]; then
  for lg in $LOGS; do
    run "Delete Log Group: $lg" "aws logs delete-log-group --log-group-name $lg --region $REGION"
  done
else
  echo "  No log groups found"
fi
echo ""

# 7. CloudFront distributions (manual — need to disable first)
echo "── CloudFront Distributions ──"
echo "  ⚠️  CloudFront distributions must be disabled before deletion."
echo "  Check manually: aws cloudfront list-distributions"
echo ""

# 8. IAM roles
echo "── IAM Roles ──"
ROLES=$(aws iam list-roles \
  --query "Roles[?starts_with(RoleName,'${PREFIX}')].RoleName" \
  --output text 2>/dev/null || echo "")
if [ -n "$ROLES" ]; then
  for role in $ROLES; do
    # Detach policies first
    POLICIES=$(aws iam list-attached-role-policies --role-name "$role" \
      --query "AttachedPolicies[].PolicyArn" --output text 2>/dev/null || echo "")
    for p in $POLICIES; do
      run "Detach policy from $role" "aws iam detach-role-policy --role-name $role --policy-arn $p"
    done
    INLINE=$(aws iam list-role-policies --role-name "$role" \
      --query "PolicyNames[]" --output text 2>/dev/null || echo "")
    for p in $INLINE; do
      run "Delete inline policy $p from $role" "aws iam delete-role-policy --role-name $role --policy-name $p"
    done
    run "Delete IAM Role: $role" "aws iam delete-role --role-name $role"
  done
else
  echo "  No IAM roles found"
fi
echo ""

echo "=== Cleanup complete ==="
