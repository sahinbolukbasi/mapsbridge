# MapsBridge Payments Module — Stripe Webhook → SQS → Lambda
# SELF-CONTAINED: creates SQS queue, DLQ, and the IAM role API Gateway uses
# to enqueue. The consuming Lambda (domain "stripe") lives in the API module
# and receives an SQS event-source mapping.
# Well-Architected: Reliability — SQS decouples webhook from processing, DLQ
# captures failures, 5x retry with backoff. Idempotent via Stripe event.id.

locals {
  substack_name = "${var.name}-payments"
}

# ─── SQS Queue (Stripe Webhook events) ────────────────────────────────────
resource "aws_sqs_queue" "stripe_webhooks" {
  name                       = "${local.substack_name}-stripe-webhooks"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 86400 # 1 day
  visibility_timeout_seconds = 300   # 5 min
  receive_wait_time_seconds  = 20    # Long polling — cost efficient
  sqs_managed_sse_enabled    = true  # Free SSE — no KMS cost

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.stripe_dlq.arn
    maxReceiveCount     = 5
  })

  tags = var.tags
}

resource "aws_sqs_queue" "stripe_dlq" {
  name                      = "${local.substack_name}-stripe-webhooks-dlq"
  message_retention_seconds = 1209600 # 14 days
  sqs_managed_sse_enabled   = true
  tags                      = var.tags
}

# Queue policy — allow API Gateway (any MapBridge API in this account/region)
# to enqueue. Scoped to the webhook route via SourceArn wildcard to avoid
# circular Terraform dependency between api and payments modules.
resource "aws_sqs_queue_policy" "stripe_webhooks" {
  queue_url = aws_sqs_queue.stripe_webhooks.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "apigateway.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.stripe_webhooks.arn
      Condition = {
        ArnLike = {
          "aws:SourceArn" = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*/*/POST/stripe/webhook"
        }
      }
    }]
  })
}

# ─── API Gateway → SQS IAM Role ───────────────────────────────────────────
resource "aws_iam_role" "api_gateway_sqs" {
  name = "${local.substack_name}-apigw-sqs"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "apigateway.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = var.tags
}

resource "aws_iam_role_policy" "api_gateway_sqs" {
  name = "sqs-send"
  role = aws_iam_role.api_gateway_sqs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "sqs:SendMessage"
      Resource = aws_sqs_queue.stripe_webhooks.arn
    }]
  })
}

# ─── SSM Parameters (secrets consumed by Lambda env via "secret:" prefix) ─
resource "aws_ssm_parameter" "stripe_secret" {
  name  = "/mapsbridge/${var.environment}/stripe/secret-key"
  type  = "SecureString"
  value = var.stripe_secret_key != "" ? var.stripe_secret_key : "placeholder-set-via-console"
  tags  = var.tags

  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "stripe_webhook_secret" {
  name  = "/mapsbridge/${var.environment}/stripe/webhook-secret"
  type  = "SecureString"
  value = var.stripe_webhook_secret != "" ? var.stripe_webhook_secret : "placeholder-set-via-console"

  lifecycle { ignore_changes = [value] }
  tags  = var.tags
}

data "aws_caller_identity" "current" {}