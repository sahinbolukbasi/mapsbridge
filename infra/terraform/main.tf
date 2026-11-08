locals {
  name = "${var.project}-${var.environment}"
  tags = {}
  # Lambda package paths — auth, chat, marketplace only.
  # admin/ai/routes/stripe are managed by infra/admin-runtime (mapsbridge-prod-{domain}).
  lambda_packages = {
    auth = {
      zip_path = "${path.module}/.build/lambdas/auth.zip"
      env_vars = { DYNAMODB_TABLE = aws_dynamodb_table.data.name }
    }
    chat = {
      zip_path = "${path.module}/.build/lambdas/chat.zip"
      env_vars = { DYNAMODB_TABLE = aws_dynamodb_table.data.name }
    }
    marketplace = {
      zip_path = "${path.module}/.build/lambdas/marketplace.zip"
      env_vars = { PRESIGN_URL_TTL_SECONDS = "900", DYNAMODB_TABLE = aws_dynamodb_table.data.name }
    }
  }

  # Route ownership:
  # auth, chat, marketplace → this stack (mapsbridge-prod-api-*)
  # admin, ai, routes, stripe, operations → infra/admin-runtime (mapsbridge-prod-*)
  domain_routes = {
    auth = [
      "POST /auth/reset-password",
      "POST /auth/change-password",
      "POST /auth/refresh",
      "POST /profile/publish",
      "POST /profile/unpublish",
      "GET /profiles/{username}",
    ]
    marketplace = [
      "GET /marketplace/guides",
      "GET /marketplace/guides/{id}",
      "POST /marketplace/guides",
      "POST /marketplace/guides/{id}/purchase",
      "GET /marketplace/guides/{id}/download",
      "POST /marketplace/blogs",
    ]
    chat = [
      "GET /chat/threads",
      "GET /chat/threads/{id}/messages",
      "POST /chat/threads/{id}/messages",
      "POST /chat/threads",
      "POST /chat/threads/{id}/request",
    ]
  }

  cors_origins = var.cors_origins != null ? var.cors_origins : (var.frontend_domain != "" ? ["https://${var.frontend_domain}"] : ["*"])
}

data "aws_caller_identity" "current" {}

# ─── KMS Key (encryption at rest for Aurora, Redis, S3 SSE-KMS) ───────────
resource "aws_kms_key" "main" {
  description             = "MapsBridge master key — S3 SSE-KMS, CloudTrail"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  tags                    = local.tags
  # Key policy: hesap kök admin erişimi + CloudTrail servisinin şifreleme izni
  # (InsufficientEncryptionPolicyException'ı giderir).
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnableRootAccount"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "AllowCloudTrailEncrypt"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = ["kms:GenerateDataKey*", "kms:DescribeKey"]
        Resource  = "*"
        Condition = {
          StringLike = {
            "kms:EncryptionContext:aws:cloudtrail:arn" = "arn:aws:cloudtrail:*:${data.aws_caller_identity.current.account_id}:trail/*"
          }
        }
      }
    ]
  })
}

resource "aws_kms_alias" "main" {
  name          = "alias/${local.name}-main"
  target_key_id = aws_kms_key.main.id
}

# ─── Resource Group + Budget ──────────────────────────────────────────────
resource "aws_resourcegroups_group" "project" {
  name = local.name
  resource_query {
    query = jsonencode({
      ResourceTypeFilters = ["AWS::AllSupported"]
      TagFilters = [
        { Key = "Project", Values = [var.project] },
        { Key = "Environment", Values = [var.environment] }
      ]
    })
  }
  tags = local.tags
}

resource "aws_budgets_budget" "monthly" {
  name              = "${local.name}-monthly-guardrail"
  budget_type       = "COST"
  limit_amount      = var.monthly_budget_usd
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = "2026-09-01_00:00"
  cost_filter {
    name   = "TagKeyValue"
    values = [format("user:Project$%s", var.project)]
  }
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_alert_email]
  }
}

# ─── Cost Anomaly Detection — Tüm hesap ─────────────────────────────────
# AWS hesabında yalnızca 1 DIMENSIONAL SERVICE monitörü olabilir.
# Varsayılan "Default-Services-Monitor" import ediliyor.
import {
  to = aws_ce_anomaly_monitor.account
  id = "arn:aws:ce::865369794421:anomalymonitor/0879bc9e-6c08-4d95-987a-63e159efb8d8"
}

resource "aws_ce_anomaly_monitor" "account" {
  name              = "Default-Services-Monitor"
  monitor_type      = "DIMENSIONAL"
  monitor_dimension = "SERVICE"
}

resource "aws_ce_anomaly_subscription" "account" {
  name      = "${local.name}-account-anomaly"
  frequency = "DAILY"

  monitor_arn_list = [aws_ce_anomaly_monitor.account.arn]

  subscriber {
    type    = "EMAIL"
    address = var.budget_alert_email
  }

  threshold_expression {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
      values        = ["20"]
      match_options = ["GREATER_THAN_OR_EQUAL"]
    }
  }
}

# ─── CloudWatch Log Groups ────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/apigateway/${local.name}-http"
  retention_in_days = var.environment == "prod" ? 30 : 7
  tags              = local.tags
}

resource "aws_cloudwatch_log_group" "lambda" {
  for_each          = local.lambda_packages
  name              = "/aws/lambda/${local.name}-api-${each.key}"
  retention_in_days = var.environment == "prod" ? 30 : 7
  tags              = local.tags
}

# ─── Storage Module (S3: media / guides / analytics / athena) ─────────────
module "storage" {
  source = "./modules/storage"

  name                        = local.name
  environment                 = var.environment
  tags                        = local.tags
  cors_origins                = local.cors_origins
  cloudfront_distribution_arn = aws_cloudfront_distribution.web.arn
}

# ─── Analytics Module (Firehose → S3 → Athena) ────────────────────────────
module "analytics" {
  source = "./modules/analytics"

  name                 = local.name
  environment          = var.environment
  tags                 = local.tags
  analytics_bucket_id  = module.storage.analytics_bucket_id
  analytics_bucket_arn = module.storage.analytics_bucket_arn
  athena_bucket_id     = module.storage.athena_bucket_id
  glue_database_name   = "mapsbridge_${var.environment}"
}

# ─── Payments Module (Stripe SQS queue + invoke role, self-contained) ─────
module "payments" {
  source = "./modules/payments"

  name                  = local.name
  environment           = var.environment
  tags                  = local.tags
  aws_region            = var.aws_region
  stripe_secret_key     = var.stripe_secret_key
  stripe_webhook_secret = var.stripe_webhook_secret
}

# ─── API Module (API Gateway HTTP + Domain Lambda) ────────────────────────
module "api" {
  source            = "./modules/api"
  billing_table_arn = aws_dynamodb_table.data.arn

  name           = local.name
  environment    = var.environment
  tags           = local.tags
  aws_region     = var.aws_region
  lambda_runtime = "nodejs20.x"
  lambda_timeout = var.lambda_timeout
  lambda_memory  = var.lambda_memory
  lambda_domains = local.lambda_packages
  domain_routes  = local.domain_routes
  cors_origins   = local.cors_origins

  cognito_user_pool_arn = aws_cognito_user_pool.users.arn
  cognito_user_pool_id  = aws_cognito_user_pool.users.id
  cognito_client_id     = aws_cognito_user_pool_client.web.id


  guides_bucket_id    = module.storage.guides_bucket_id
  guides_bucket_arn   = module.storage.guides_bucket_arn
  media_bucket_id     = module.storage.media_bucket_id
  media_bucket_arn    = module.storage.media_bucket_arn
  analytics_bucket_id = module.storage.analytics_bucket_id
  athena_bucket_arn   = module.storage.athena_bucket_arn

  stripe_secret_ssm         = "/mapsbridge/${var.environment}/stripe/secret-key"
  stripe_webhook_secret_ssm = "/mapsbridge/${var.environment}/stripe/webhook-secret"
  stripe_queue_url          = module.payments.stripe_queue_url
  stripe_queue_arn          = module.payments.stripe_queue_arn

  bedrock_model_id = var.bedrock_model_id
  kms_key_arn      = aws_kms_key.main.arn

  gateway_burst_limit = var.gateway_burst_limit
  gateway_rate_limit  = var.gateway_rate_limit
  log_group_arn       = aws_cloudwatch_log_group.api.arn
  shared_layer_zip    = "${path.module}/.build/layer/shared.zip"

  athena_workgroup = module.analytics.athena_workgroup
}

# ─── Messaging Module (WebSocket API for 1:1 chat) ────────────────────────
module "messaging" {
  source = "./modules/messaging"

  cognito_user_pool_id = aws_cognito_user_pool.users.id
  cognito_client_id    = aws_cognito_user_pool_client.web.id

  name                = local.name
  tags                = local.tags
  aws_region          = var.aws_region
  messages_table_name = aws_dynamodb_table.data.name
  messages_table_arn  = aws_dynamodb_table.data.arn
  onconnect_zip       = "${path.module}/.build/lambdas/ws-onconnect.zip"
  onmessage_zip       = "${path.module}/.build/lambdas/ws-onmessage.zip"
  ondisconnect_zip    = "${path.module}/.build/lambdas/ws-ondisconnect.zip"
}

# Stripe webhook is managed by infra/admin-runtime via routes.json ("POST /stripe/webhook": "stripe")

# ─── Security Module (WAF for API Gateway) ──────────────────────────────
# WAFv2 WebACL Association does not support HTTP API Gateway v2 ($default
# stage ARN is rejected).  Rate limiting is handled by API Gateway's own
# throttle settings.  Re-enable when/if the API is fronted by CloudFront
# or migrated to REST API.
module "security" {
  source = "./modules/security"

  name                  = local.name
  environment           = var.environment
  tags                  = local.tags
  api_gateway_stage_arn = module.api.http_stage_arn
  enable_waf            = false
  waf_rate_limit        = var.waf_rate_limit
}
