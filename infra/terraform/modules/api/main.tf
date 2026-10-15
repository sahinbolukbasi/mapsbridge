# MapsBridge Serverless Compute Module — API Gateway HTTP + Lambda (Domain-Driven)
# Domains: auth, routes, chat, marketplace, stripe, admin
# Well-Architected: Performance — separate Lambda per domain (smaller cold start,
# independent scaling), Node.js 22 ARM64 (graviton) for 34% cheaper + faster cold starts

locals {
  substack_name = "${var.name}-api"
  # Normalize route keys
  route_keys = flatten([
    for domain, paths in var.domain_routes : [
      for path in paths : {
        domain = domain
        path   = path
        key    = path
      }
    ]
  ])

  # Shared env vars used by all domains (auth, dynamo, runtime)
  _base = {
    ENVIRONMENT          = var.environment
    COGNITO_USER_POOL_ID = var.cognito_user_pool_id
    COGNITO_CLIENT_ID    = var.cognito_client_id
  }

  # Per-domain environment variables — each Lambda only receives what it needs
  domain_env = {
    auth = merge(local._base, {})

    routes = merge(local._base, {
      MEDIA_BUCKET = var.media_bucket_id
    })

    chat = merge(local._base, {})

    marketplace = merge(local._base, {
      GUIDES_BUCKET = var.guides_bucket_id
    })

    ai = merge(local._base, {
      BEDROCK_MODEL_ID = var.bedrock_model_id
    })

    stripe = merge(local._base, {
      STRIPE_SECRET_KEY      = "secret:${var.stripe_secret_ssm}"
      STRIPE_WEBHOOK_SECRET  = "secret:${var.stripe_webhook_secret_ssm}"
      STRIPE_QUEUE_URL       = var.stripe_queue_url
    })

    admin = merge(local._base, {
      STRIPE_SECRET_KEY  = "secret:${var.stripe_secret_ssm}"
      BEDROCK_MODEL_ID   = var.bedrock_model_id
      ANALYTICS_BUCKET   = var.analytics_bucket_id
      ATHENA_WORKGROUP   = var.athena_workgroup
    })

    places = merge(local._base, {
      GOOGLE_PLACES_API_KEY = var.google_places_api_key
      FOURSQUARE_API_KEY    = var.foursquare_api_key
    })

    revenuecat = merge(local._base, {
      RC_SECRET_API_KEY     = "secret:${var.rc_secret_api_key_ssm}"
      RC_WEBHOOK_AUTH_SECRET = "secret:${var.rc_webhook_auth_secret_ssm}"
      RC_BILLING_CHECKOUT_URL = var.rc_billing_checkout_url
      BILLING_ENABLED       = var.billing_enabled
      APP_ORIGIN            = var.app_origin
    })
  }
}

# ─── Lambda IAM Roles (one per domain) ────────────────────────────────────
resource "aws_iam_role" "lambda" {
  for_each = var.lambda_domains
  name     = "${local.substack_name}-${each.key}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  for_each   = var.lambda_domains
  role       = aws_iam_role.lambda[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  for_each   = var.lambda_domains
  role       = aws_iam_role.lambda[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Shared policy: SSM (connection strings), CloudWatch, SQS, S3 (guides), Bedrock (ai domain)
resource "aws_iam_role_policy" "lambda_shared" {
  for_each = var.lambda_domains
  name     = "${each.key}-shared"
  role     = aws_iam_role.lambda[each.key].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = [
          "${var.guides_bucket_arn}/*",
          "${var.media_bucket_arn}/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"]
        Resource = var.kms_key_arn
      }
    ]
  })
}

# Domain-specific policies
resource "aws_iam_role_policy" "auth_cognito" {
  count = contains(keys(var.lambda_domains), "auth") ? 1 : 0
  name  = "cognito-full"
  role  = aws_iam_role.lambda["auth"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "cognito-idp:AdminGetUser", "cognito-idp:AdminInitiateAuth",
        "cognito-idp:AdminUpdateUserAttributes", "cognito-idp:AdminSetUserPassword",
        "cognito-idp:AdminCreateUser"
      ]
      Resource = var.cognito_user_pool_arn
    }]
  })
}

resource "aws_iam_role_policy" "admin_athena" {
  count = contains(keys(var.lambda_domains), "admin") ? 1 : 0
  name  = "athena-query"
  role  = aws_iam_role.lambda["admin"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["athena:StartQueryExecution", "athena:GetQueryExecution", "athena:GetQueryResults"]
        Resource = "arn:aws:athena:${var.aws_region}:*:workgroup/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = ["${var.athena_bucket_arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = var.athena_bucket_arn
      }
    ]
  })
}

# ─── Lambda Functions ─────────────────────────────────────────────────────
resource "aws_lambda_function" "domain" {
  for_each = var.lambda_domains

  function_name = "${local.substack_name}-${each.key}"
  role          = aws_iam_role.lambda[each.key].arn
  handler       = "index.handler"
  runtime       = var.lambda_runtime
  architectures = ["arm64"] # Graviton — 34% cheaper, faster cold start

  filename         = each.value.zip_path
  source_code_hash = filebase64sha256(each.value.zip_path)

  timeout = var.lambda_timeout
  # Domain-specific memory optimization (Cost: 256MB default, 512MB for AI/Bedrock)
  memory_size = each.key == "ai" ? 512 : var.lambda_memory

  dynamic "vpc_config" {
    for_each = contains(["stripe", "ai", "routes", "admin"], each.key) ? [] : [1]
    content {
      subnet_ids         = var.private_subnet_ids
      security_group_ids = [var.lambda_security_group_id]
    }
  }
  reserved_concurrent_executions = -1

  environment {
    variables = merge(local.domain_env[each.key], each.value.env_vars)
  }

  # SnapStart for Java (not applicable for Node.js, but keeping for reference)
  # snap_start {
  #   apply_on = "PublishedVersions"
  # }

  tracing_config {
    mode = "Active" # X-Ray — operational excellence
  }

  lifecycle {
    ignore_changes = [source_code_hash] # Managed by CI/CD pipeline
  }

  tags = merge(var.tags, {
    "CostOptimization" = "Memory:${each.key == "ai" ? "512MB" : "256MB"}"
    "CriticalTier"     = contains(["routes", "auth", "chat"], each.key) ? "P1" : "P2"
  })
}

# Allow API Gateway to invoke each function
resource "aws_lambda_permission" "gateway_invoke" {
  for_each      = var.lambda_domains
  statement_id  = "AllowApiGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.domain[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*/*"
}

# ─── API Gateway HTTP API ─────────────────────────────────────────────────
resource "aws_apigatewayv2_api" "http" {
  name          = local.substack_name
  protocol_type = "HTTP"
  description   = "MapsBridge HTTP API — domain-driven Lambda integrations"

  cors_configuration {
    allow_origins = var.cors_origins
    allow_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_headers = ["authorization", "content-type", "idempotency-key", "x-api-key"]
    max_age       = 3600
  }

  tags = var.tags
}

# Domain → Lambda integration for each domain
resource "aws_apigatewayv2_integration" "domain" {
  for_each = var.lambda_domains

  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.domain[each.key].invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = min(var.lambda_timeout * 1000, 29000)
}

# Routes: from var.domain_routes map, fan out per domain
resource "aws_apigatewayv2_route" "domain" {
  for_each = { for rk in local.route_keys : "${rk.domain}|${rk.key}" => rk }

  api_id    = aws_apigatewayv2_api.http.id
  route_key = each.value.key
  target    = "integrations/${aws_apigatewayv2_integration.domain[each.value.domain].id}"
}

resource "aws_apigatewayv2_stage" "http" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = var.gateway_burst_limit
    throttling_rate_limit  = var.gateway_rate_limit
  }

  access_log_settings {
    destination_arn = var.log_group_arn
    format = jsonencode({
      requestId        = "$context.requestId"
      ip               = "$context.identity.sourceIp"
      routeKey         = "$context.routeKey"
      status           = "$context.status"
      responseLength   = "$context.responseLength"
      integrationError = "$context.integrationErrorMessage"
    })
  }

  tags = var.tags
}

# ─── Layer: shared Node modules (aws-sdk, pg, redis) ──────────────────────
resource "aws_lambda_layer_version" "shared" {
  layer_name               = "${local.substack_name}-shared-deps"
  description              = "Shared dependencies: @aws-sdk/client-s3, pg, ioredis, stripe"
  compatible_runtimes      = [var.lambda_runtime]
  compatible_architectures = ["arm64"]
  filename                 = var.shared_layer_zip
  source_code_hash         = filebase64sha256(var.shared_layer_zip)
}

# ─── Stripe domain: SQS event source mapping (Webhook → SQS → Lambda) ────
resource "aws_lambda_event_source_mapping" "stripe_sqs" {
  count = contains(keys(var.lambda_domains), "stripe") ? 1 : 0

  event_source_arn                   = var.stripe_queue_arn
  function_name                      = aws_lambda_function.domain["stripe"].function_name
  batch_size                         = 1 # Process one at a time for idempotency
  function_response_types            = ["ReportBatchItemFailures"]
  maximum_batching_window_in_seconds = 0
}

resource "aws_lambda_permission" "stripe_sqs" {
  count = contains(keys(var.lambda_domains), "stripe") ? 1 : 0

  statement_id  = "AllowSQSInvokeStripe"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.domain["stripe"].function_name
  principal     = "sqs.amazonaws.com"
  source_arn    = var.stripe_queue_arn
}
resource "aws_iam_role_policy" "billing_data" {
  for_each = toset([for name in ["stripe", "revenuecat", "ai", "routes", "admin"] : name if contains(keys(var.lambda_domains), name)])
  name     = "billing-data"
  role     = aws_iam_role.lambda[each.key].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query"]
      Resource = [var.billing_table_arn]
    }]
  })
}

resource "aws_iam_role_policy" "stripe_secrets" {
  name = "stripe-secrets-and-legacy-queue"
  role = aws_iam_role.lambda["stripe"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["ssm:GetParameter"], Resource = ["arn:aws:ssm:${var.aws_region}:*:parameter${var.stripe_secret_ssm}", "arn:aws:ssm:${var.aws_region}:*:parameter${var.stripe_webhook_secret_ssm}"] },
      { Effect = "Allow", Action = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"], Resource = var.stripe_queue_arn }
    ]
  })
}
resource "aws_iam_role_policy" "rc_secrets" {
  count = contains(keys(var.lambda_domains), "revenuecat") ? 1 : 0
  name  = "revenuecat-secrets"
  role  = aws_iam_role.lambda["revenuecat"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameter"]
      Resource = [
        "arn:aws:ssm:${var.aws_region}:*:parameter${var.rc_secret_api_key_ssm}",
        "arn:aws:ssm:${var.aws_region}:*:parameter${var.rc_webhook_auth_secret_ssm}",
      ]
    }]
  })
}

resource "aws_iam_role_policy" "ai_model" {
  name = "canonical-ai-model"
  role = aws_iam_role.lambda["ai"].id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = ["bedrock:InvokeModel"], Resource = "arn:aws:bedrock:${var.aws_region}::foundation-model/${var.bedrock_model_id}" }]
  })
}

resource "aws_iam_role_policy" "admin_stripe_secret" {
  name   = "admin-refund-secret"
  role   = aws_iam_role.lambda["admin"].id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["ssm:GetParameter"], Resource = "arn:aws:ssm:${var.aws_region}:*:parameter${var.stripe_secret_ssm}" }] })
}

# Admin lists and health probes are limited to the application's data table.
resource "aws_iam_role_policy" "admin_data_read" {
  count = contains(keys(var.lambda_domains), "admin") ? 1 : 0
  name  = "admin-data-read"
  role  = aws_iam_role.lambda["admin"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:Scan", "dynamodb:DescribeTable"]
      Resource = [var.billing_table_arn]
    }]
  })
}

resource "aws_iam_role_policy" "account_status_read" {
  for_each = var.lambda_domains
  name     = "account-status-read"
  role     = aws_iam_role.lambda[each.key].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem"]
      Resource = [var.billing_table_arn]
    }]
  })
}
