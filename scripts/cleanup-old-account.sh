#!/usr/bin/env bash
# Cleanup all adreskopru/mapsbridge resources from old AWS account (996270854731)
#
# Usage:
#   export AWS_PROFILE=<old-account-profile>
#   bash scripts/cleanup-old-account.sh [--dry-run]
#
# The script will pause before destructive actions. Pass --dry-run to preview only.

set -euo pipefail

REGION="eu-central-1"
DRY_RUN=false
PREFIXES=("adreskopru" "mapsbridge")

for arg in "$@"; do
  [[ "$arg" == "--dry-run" ]] && DRY_RUN=true
done

$DRY_RUN && echo "=== DRY RUN MODE — nothing will be deleted ===" && echo ""

run() {
  local label="$1"
  local cmd="$2"
  echo "  → $label"
  if ! $DRY_RUN; then
    eval "$cmd" 2>&1 | sed 's/^/    /' || echo "    ⚠ Failed (continuing)"
  fi
}

matches_prefix() {
  local name="$1"
  for prefix in "${PREFIXES[@]}"; do
    [[ "$name" == "$prefix"* ]] || [[ "$name" == *"$prefix"* ]] && return 0
  done
  return 1
}

echo "==========================================================="
echo " Cleaning old account — prefixes: ${PREFIXES[*]}"
echo " Region: $REGION  |  Dry-run: $DRY_RUN"
echo "==========================================================="
echo ""

# ── 1. Lambda Functions ──────────────────────────────────────────────────────
echo "── Lambda Functions ──────────────────────────────────"
FUNCS=$(aws lambda list-functions --region "$REGION" \
  --query "Functions[].FunctionName" --output text 2>/dev/null | tr '\t' '\n' || true)
for fn in $FUNCS; do
  if matches_prefix "$fn"; then
    run "Delete Lambda: $fn" \
      "aws lambda delete-function --function-name '$fn' --region $REGION"
  fi
done

# ── 2. API Gateway (HTTP v2) ──────────────────────────────────────────────────
echo ""
echo "── API Gateway (HTTP) ────────────────────────────────"
APIS=$(aws apigatewayv2 get-apis --region "$REGION" \
  --query "Items[].[ApiId,Name]" --output text 2>/dev/null | tr '\t' ' ' || true)
while IFS=' ' read -r api_id name; do
  [[ -z "$api_id" ]] && continue
  if matches_prefix "$name"; then
    run "Delete API Gateway: $name ($api_id)" \
      "aws apigatewayv2 delete-api --api-id '$api_id' --region $REGION"
  fi
done <<< "$APIS"

# ── 3. API Gateway (REST v1) ──────────────────────────────────────────────────
echo ""
echo "── API Gateway (REST) ────────────────────────────────"
REST_APIS=$(aws apigateway get-rest-apis --region "$REGION" \
  --query "items[].[id,name]" --output text 2>/dev/null | tr '\t' ' ' || true)
while IFS=' ' read -r api_id name; do
  [[ -z "$api_id" ]] && continue
  if matches_prefix "$name"; then
    run "Delete REST API: $name ($api_id)" \
      "aws apigateway delete-rest-api --rest-api-id '$api_id' --region $REGION"
  fi
done <<< "$REST_APIS"

# ── 4. DynamoDB Tables ────────────────────────────────────────────────────────
echo ""
echo "── DynamoDB Tables ───────────────────────────────────"
TABLES=$(aws dynamodb list-tables --region "$REGION" \
  --query "TableNames[]" --output text 2>/dev/null | tr '\t' '\n' || true)
for table in $TABLES; do
  if matches_prefix "$table"; then
    run "Remove deletion protection: $table" \
      "aws dynamodb update-table --table-name '$table' --region $REGION --deletion-protection-enabled false 2>/dev/null || true"
    run "Delete DynamoDB: $table" \
      "aws dynamodb delete-table --table-name '$table' --region $REGION"
  fi
done

# ── 5. S3 Buckets ─────────────────────────────────────────────────────────────
echo ""
echo "── S3 Buckets ────────────────────────────────────────"
BUCKETS=$(aws s3api list-buckets \
  --query "Buckets[].Name" --output text 2>/dev/null | tr '\t' '\n' || true)
for bucket in $BUCKETS; do
  if matches_prefix "$bucket"; then
    run "Empty S3 (objects): $bucket" \
      "aws s3 rm 's3://$bucket' --recursive --region $REGION"
    run "Empty S3 (versions): $bucket" \
      "aws s3api list-object-versions --bucket '$bucket' --region $REGION \
        --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' \
        --output json 2>/dev/null | \
        python3 -c \"import sys,json; d=json.load(sys.stdin); \
        [print(o['Key'], o['VersionId']) for o in (d.get('Objects') or [])]\" | \
        while read k v; do aws s3api delete-object --bucket '$bucket' --key \"\$k\" --version-id \"\$v\" --region $REGION; done || true"
    run "Empty S3 (delete markers): $bucket" \
      "aws s3api list-object-versions --bucket '$bucket' --region $REGION \
        --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' \
        --output json 2>/dev/null | \
        python3 -c \"import sys,json; d=json.load(sys.stdin); \
        [print(o['Key'], o['VersionId']) for o in (d.get('Objects') or [])]\" | \
        while read k v; do aws s3api delete-object --bucket '$bucket' --key \"\$k\" --version-id \"\$v\" --region $REGION; done || true"
    run "Delete S3 bucket: $bucket" \
      "aws s3api delete-bucket --bucket '$bucket' --region $REGION"
  fi
done

# ── 6. Cognito User Pools ─────────────────────────────────────────────────────
echo ""
echo "── Cognito User Pools ────────────────────────────────"
POOLS=$(aws cognito-idp list-user-pools --max-results 60 --region "$REGION" \
  --query "UserPools[].[Id,Name]" --output text 2>/dev/null | tr '\t' ' ' || true)
while IFS=' ' read -r pool_id name; do
  [[ -z "$pool_id" ]] && continue
  if matches_prefix "$name"; then
    run "Delete Cognito Pool: $name ($pool_id)" \
      "aws cognito-idp delete-user-pool --user-pool-id '$pool_id' --region $REGION"
  fi
done <<< "$POOLS"

# ── 7. SQS Queues ────────────────────────────────────────────────────────────
echo ""
echo "── SQS Queues ────────────────────────────────────────"
QUEUES=$(aws sqs list-queues --region "$REGION" \
  --query "QueueUrls[]" --output text 2>/dev/null | tr '\t' '\n' || true)
for url in $QUEUES; do
  name=$(basename "$url")
  if matches_prefix "$name"; then
    run "Delete SQS: $name" \
      "aws sqs delete-queue --queue-url '$url' --region $REGION"
  fi
done

# ── 8. SNS Topics ─────────────────────────────────────────────────────────────
echo ""
echo "── SNS Topics ────────────────────────────────────────"
TOPICS=$(aws sns list-topics --region "$REGION" \
  --query "Topics[].TopicArn" --output text 2>/dev/null | tr '\t' '\n' || true)
for arn in $TOPICS; do
  name=$(echo "$arn" | awk -F: '{print $NF}')
  if matches_prefix "$name"; then
    run "Delete SNS: $name" \
      "aws sns delete-topic --topic-arn '$arn' --region $REGION"
  fi
done

# ── 9. Secrets Manager ────────────────────────────────────────────────────────
echo ""
echo "── Secrets Manager ───────────────────────────────────"
SECRETS=$(aws secretsmanager list-secrets --region "$REGION" \
  --query "SecretList[].Name" --output text 2>/dev/null | tr '\t' '\n' || true)
for secret in $SECRETS; do
  if matches_prefix "$secret"; then
    run "Delete Secret: $secret" \
      "aws secretsmanager delete-secret --secret-id '$secret' --region $REGION --force-delete-without-recovery"
  fi
done

# ── 10. SSM Parameters ────────────────────────────────────────────────────────
echo ""
echo "── SSM Parameters ────────────────────────────────────"
for prefix in "${PREFIXES[@]}"; do
  PARAMS=$(aws ssm get-parameters-by-path --path "/$prefix" --recursive --region "$REGION" \
    --query "Parameters[].Name" --output text 2>/dev/null | tr '\t' '\n' || true)
  for param in $PARAMS; do
    run "Delete SSM: $param" \
      "aws ssm delete-parameter --name '$param' --region $REGION"
  done
done

# ── 11. CloudWatch Log Groups ─────────────────────────────────────────────────
echo ""
echo "── CloudWatch Log Groups ─────────────────────────────"
for log_prefix in "/aws/lambda" "/aws/apigateway" "/aws/bedrock"; do
  for prefix in "${PREFIXES[@]}"; do
    LOG_GROUPS=$(aws logs describe-log-groups --region "$REGION" \
      --log-group-name-prefix "${log_prefix}/${prefix}" \
      --query "logGroups[].logGroupName" --output text 2>/dev/null | tr '\t' '\n' || true)
    for lg in $LOG_GROUPS; do
      run "Delete Log Group: $lg" \
        "aws logs delete-log-group --log-group-name '$lg' --region $REGION"
    done
  done
done

# ── 12. CloudWatch Alarms ─────────────────────────────────────────────────────
echo ""
echo "── CloudWatch Alarms ─────────────────────────────────"
ALARMS=$(aws cloudwatch describe-alarms --region "$REGION" \
  --query "MetricAlarms[].AlarmName" --output text 2>/dev/null | tr '\t' '\n' || true)
for alarm in $ALARMS; do
  if matches_prefix "$alarm"; then
    run "Delete Alarm: $alarm" \
      "aws cloudwatch delete-alarms --alarm-names '$alarm' --region $REGION"
  fi
done

# ── 13. CloudWatch Dashboards ─────────────────────────────────────────────────
echo ""
echo "── CloudWatch Dashboards ─────────────────────────────"
DASHBOARDS=$(aws cloudwatch list-dashboards --region "$REGION" \
  --query "DashboardEntries[].DashboardName" --output text 2>/dev/null | tr '\t' '\n' || true)
for dash in $DASHBOARDS; do
  if matches_prefix "$dash"; then
    run "Delete Dashboard: $dash" \
      "aws cloudwatch delete-dashboards --dashboard-names '$dash' --region $REGION"
  fi
done

# ── 14. EventBridge Rules ─────────────────────────────────────────────────────
echo ""
echo "── EventBridge Rules ─────────────────────────────────"
RULES=$(aws events list-rules --region "$REGION" \
  --query "Rules[].Name" --output text 2>/dev/null | tr '\t' '\n' || true)
for rule in $RULES; do
  if matches_prefix "$rule"; then
    TARGETS=$(aws events list-targets-by-rule --rule "$rule" --region "$REGION" \
      --query "Targets[].Id" --output text 2>/dev/null | tr '\t' '\n' || true)
    if [[ -n "$TARGETS" ]]; then
      TARGET_IDS=$(echo "$TARGETS" | tr '\n' ' ')
      run "Remove targets from rule: $rule" \
        "aws events remove-targets --rule '$rule' --ids $TARGET_IDS --region $REGION"
    fi
    run "Delete EventBridge rule: $rule" \
      "aws events delete-rule --name '$rule' --region $REGION"
  fi
done

# ── 15. KMS Keys (schedule deletion — cannot immediately delete) ──────────────
echo ""
echo "── KMS Keys ──────────────────────────────────────────"
KEYS=$(aws kms list-aliases --region "$REGION" \
  --query "Aliases[?starts_with(AliasName,'alias/mapsbridge') || starts_with(AliasName,'alias/adreskopru')].[TargetKeyId,AliasName]" \
  --output text 2>/dev/null | tr '\t' ' ' || true)
while IFS=' ' read -r key_id alias_name; do
  [[ -z "$key_id" ]] && continue
  run "Schedule KMS deletion (30 days): $alias_name ($key_id)" \
    "aws kms schedule-key-deletion --key-id '$key_id' --pending-window-in-days 30 --region $REGION"
done <<< "$KEYS"

# ── 16. CloudFront Distributions ─────────────────────────────────────────────
echo ""
echo "── CloudFront Distributions ──────────────────────────"
DISTS=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[].[Id,DomainName,Origins.Items[0].DomainName,Status,Enabled]" \
  --output text 2>/dev/null | tr '\t' '|' || true)
while IFS='|' read -r dist_id domain origin status enabled; do
  [[ -z "$dist_id" ]] && continue
  if matches_prefix "$origin" || matches_prefix "$domain"; then
    if [[ "$enabled" == "True" ]]; then
      echo "  ⚠ CloudFront $dist_id ($domain) must be disabled before deletion."
      echo "    Run manually:"
      echo "      ETAG=\$(aws cloudfront get-distribution --id $dist_id --query 'ETag' --output text)"
      echo "      aws cloudfront get-distribution-config --id $dist_id | python3 -c \"import sys,json; d=json.load(sys.stdin)['DistributionConfig']; d['Enabled']=False; print(json.dumps(d))\" > /tmp/cf-disabled.json"
      echo "      aws cloudfront update-distribution --id $dist_id --if-match \$ETAG --distribution-config file:///tmp/cf-disabled.json"
      echo "      # Wait ~15 min for Deployed status, then:"
      echo "      aws cloudfront delete-distribution --id $dist_id --if-match \$(aws cloudfront get-distribution --id $dist_id --query ETag --output text)"
    else
      run "Delete CloudFront (already disabled): $dist_id" \
        "ETAG=\$(aws cloudfront get-distribution --id '$dist_id' --query 'ETag' --output text) && aws cloudfront delete-distribution --id '$dist_id' --if-match \$ETAG"
    fi
  fi
done <<< "$DISTS"

# ── 17. ACM Certificates ─────────────────────────────────────────────────────
echo ""
echo "── ACM Certificates ──────────────────────────────────"
for cert_region in "$REGION" "us-east-1"; do
  CERTS=$(aws acm list-certificates --region "$cert_region" \
    --query "CertificateSummaryList[].[CertificateArn,DomainName]" \
    --output text 2>/dev/null | tr '\t' ' ' || true)
  while IFS=' ' read -r cert_arn domain; do
    [[ -z "$cert_arn" ]] && continue
    if matches_prefix "$domain"; then
      run "Delete ACM cert ($cert_region): $domain" \
        "aws acm delete-certificate --certificate-arn '$cert_arn' --region '$cert_region'"
    fi
  done <<< "$CERTS"
done

# ── 18. IAM Roles ─────────────────────────────────────────────────────────────
echo ""
echo "── IAM Roles ─────────────────────────────────────────"
ROLES=$(aws iam list-roles \
  --query "Roles[].RoleName" --output text 2>/dev/null | tr '\t' '\n' || true)
for role in $ROLES; do
  if matches_prefix "$role"; then
    ATTACHED=$(aws iam list-attached-role-policies --role-name "$role" \
      --query "AttachedPolicies[].PolicyArn" --output text 2>/dev/null | tr '\t' '\n' || true)
    for arn in $ATTACHED; do
      run "Detach policy from $role" \
        "aws iam detach-role-policy --role-name '$role' --policy-arn '$arn'"
    done
    INLINE=$(aws iam list-role-policies --role-name "$role" \
      --query "PolicyNames[]" --output text 2>/dev/null | tr '\t' '\n' || true)
    for p in $INLINE; do
      run "Delete inline policy $p from $role" \
        "aws iam delete-role-policy --role-name '$role' --policy-name '$p'"
    done
    PROFILES=$(aws iam list-instance-profiles-for-role --role-name "$role" \
      --query "InstanceProfiles[].InstanceProfileName" --output text 2>/dev/null | tr '\t' '\n' || true)
    for profile in $PROFILES; do
      run "Remove role $role from instance profile $profile" \
        "aws iam remove-role-from-instance-profile --instance-profile-name '$profile' --role-name '$role'"
    done
    run "Delete IAM Role: $role" \
      "aws iam delete-role --role-name '$role'"
  fi
done

# ── 19. IAM Policies (customer-managed) ──────────────────────────────────────
echo ""
echo "── IAM Policies (customer-managed) ──────────────────"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "unknown")
POLICIES=$(aws iam list-policies --scope Local \
  --query "Policies[].PolicyName" --output text 2>/dev/null | tr '\t' '\n' || true)
for policy in $POLICIES; do
  if matches_prefix "$policy"; then
    ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${policy}"
    VERSIONS=$(aws iam list-policy-versions --policy-arn "$ARN" \
      --query "Versions[?!IsDefaultVersion].VersionId" --output text 2>/dev/null | tr '\t' '\n' || true)
    for ver in $VERSIONS; do
      run "Delete policy version $ver: $policy" \
        "aws iam delete-policy-version --policy-arn '$ARN' --version-id '$ver'"
    done
    run "Delete IAM Policy: $policy" \
      "aws iam delete-policy --policy-arn '$ARN'"
  fi
done

# ── 20. OIDC Providers (GitHub Actions) ──────────────────────────────────────
echo ""
echo "── IAM OIDC Providers ────────────────────────────────"
OIDCS=$(aws iam list-open-id-connect-providers \
  --query "OpenIDConnectProviderList[].Arn" --output text 2>/dev/null | tr '\t' '\n' || true)
for arn in $OIDCS; do
  if [[ "$arn" == *"token.actions.githubusercontent.com"* ]]; then
    echo "  ⚠ GitHub Actions OIDC provider: $arn"
    echo "    Run manually if you want to remove: aws iam delete-open-id-connect-provider --open-id-connect-provider-arn '$arn'"
  fi
done

# ── 21. VPC Resources ─────────────────────────────────────────────────────────
echo ""
echo "── VPC Resources ─────────────────────────────────────"
VPCS=$(aws ec2 describe-vpcs --region "$REGION" \
  --filters "Name=tag:Project,Values=adreskopru,mapsbridge" \
  --query "Vpcs[].[VpcId,Tags[?Key=='Name']|[0].Value]" \
  --output text 2>/dev/null | tr '\t' ' ' || true)
while IFS=' ' read -r vpc_id name; do
  [[ -z "$vpc_id" ]] && continue
  echo "  VPC: $vpc_id ($name)"

  # Delete NAT Gateways first
  NAT_GWS=$(aws ec2 describe-nat-gateways --region "$REGION" \
    --filter "Name=vpc-id,Values=$vpc_id" \
    --query "NatGateways[?State!='deleted'].NatGatewayId" \
    --output text 2>/dev/null | tr '\t' '\n' || true)
  for nat in $NAT_GWS; do
    run "Delete NAT Gateway: $nat" \
      "aws ec2 delete-nat-gateway --nat-gateway-id '$nat' --region $REGION"
  done
  [[ -n "$NAT_GWS" ]] && echo "  ⏳ Waiting 30s for NAT gateway deletion..." && $DRY_RUN || sleep 30

  # Release Elastic IPs
  EIPS=$(aws ec2 describe-addresses --region "$REGION" \
    --filters "Name=domain,Values=vpc" \
    --query "Addresses[].AllocationId" --output text 2>/dev/null | tr '\t' '\n' || true)
  for eip in $EIPS; do
    run "Release EIP: $eip" \
      "aws ec2 release-address --allocation-id '$eip' --region $REGION"
  done

  # Delete subnets
  SUBNETS=$(aws ec2 describe-subnets --region "$REGION" \
    --filters "Name=vpc-id,Values=$vpc_id" \
    --query "Subnets[].SubnetId" --output text 2>/dev/null | tr '\t' '\n' || true)
  for subnet in $SUBNETS; do
    run "Delete Subnet: $subnet" \
      "aws ec2 delete-subnet --subnet-id '$subnet' --region $REGION"
  done

  # Detach and delete Internet Gateways
  IGWS=$(aws ec2 describe-internet-gateways --region "$REGION" \
    --filters "Name=attachment.vpc-id,Values=$vpc_id" \
    --query "InternetGateways[].InternetGatewayId" --output text 2>/dev/null | tr '\t' '\n' || true)
  for igw in $IGWS; do
    run "Detach IGW: $igw" \
      "aws ec2 detach-internet-gateway --internet-gateway-id '$igw' --vpc-id '$vpc_id' --region $REGION"
    run "Delete IGW: $igw" \
      "aws ec2 delete-internet-gateway --internet-gateway-id '$igw' --region $REGION"
  done

  # Delete security groups (skip default)
  SGS=$(aws ec2 describe-security-groups --region "$REGION" \
    --filters "Name=vpc-id,Values=$vpc_id" \
    --query "SecurityGroups[?GroupName!='default'].GroupId" \
    --output text 2>/dev/null | tr '\t' '\n' || true)
  for sg in $SGS; do
    run "Delete Security Group: $sg" \
      "aws ec2 delete-security-group --group-id '$sg' --region $REGION"
  done

  # Delete route tables (skip main)
  RTS=$(aws ec2 describe-route-tables --region "$REGION" \
    --filters "Name=vpc-id,Values=$vpc_id" \
    --query "RouteTables[?Associations[?Main!=\`true\`]].RouteTableId" \
    --output text 2>/dev/null | tr '\t' '\n' || true)
  for rt in $RTS; do
    run "Delete Route Table: $rt" \
      "aws ec2 delete-route-table --route-table-id '$rt' --region $REGION"
  done

  # Delete VPC Endpoints
  ENDPOINTS=$(aws ec2 describe-vpc-endpoints --region "$REGION" \
    --filters "Name=vpc-id,Values=$vpc_id" \
    --query "VpcEndpoints[?State!='deleted'].VpcEndpointId" \
    --output text 2>/dev/null | tr '\t' '\n' || true)
  for ep in $ENDPOINTS; do
    run "Delete VPC Endpoint: $ep" \
      "aws ec2 delete-vpc-endpoints --vpc-endpoint-ids '$ep' --region $REGION"
  done

  run "Delete VPC: $vpc_id" \
    "aws ec2 delete-vpc --vpc-id '$vpc_id' --region $REGION"
done

echo ""
echo "==========================================================="
echo " Cleanup complete!"
echo " Review any ⚠ items above that require manual steps."
if $DRY_RUN; then
  echo " This was a DRY RUN — run without --dry-run to apply."
fi
echo "==========================================================="
