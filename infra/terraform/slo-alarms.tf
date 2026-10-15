# SLO Alarms — Availability (99.9%) and Latency (p95 < 500ms)
# Notifications go to the ops-alerts SNS topic (email sub to budget_alert_email).
# All thresholds fire after 3 consecutive evaluation periods (5 min each = 15 min window).

# ─── SNS Topic: Ops Alerts ────────────────────────────────────────────────
resource "aws_sns_topic" "ops_alerts" {
  name = "${local.name}-ops-alerts"
  tags = local.tags
}

resource "aws_sns_topic_subscription" "ops_email" {
  topic_arn = aws_sns_topic.ops_alerts.arn
  protocol  = "email"
  endpoint  = var.budget_alert_email
}

# ─── SLO: Availability — API Gateway 5xx Error Rate > 0.1% ───────────────
resource "aws_cloudwatch_metric_alarm" "api_5xx_rate" {
  alarm_name          = "${local.name}-api-5xx-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  threshold           = 0.1
  alarm_description   = "API 5xx error rate exceeds 0.1% — SLO breach (availability target: 99.9%). See runbook: docs/runbooks/api-5xx-spike.md"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.ops_alerts.arn]
  ok_actions          = [aws_sns_topic.ops_alerts.arn]
  tags                = local.tags

  metric_query {
    id          = "error_rate"
    expression  = "IF(total>0, errors5xx/total*100, 0)"
    label       = "5xx Error Rate %"
    return_data = true
  }
  metric_query {
    id = "errors5xx"
    metric {
      namespace   = "AWS/ApiGateway"
      metric_name = "5XXError"
      period      = 300
      stat        = "Sum"
      dimensions  = { ApiId = module.api.api_gateway_id }
    }
    return_data = false
  }
  metric_query {
    id = "total"
    metric {
      namespace   = "AWS/ApiGateway"
      metric_name = "Count"
      period      = 300
      stat        = "Sum"
      dimensions  = { ApiId = module.api.api_gateway_id }
    }
    return_data = false
  }
}

# ─── SLO: Availability — Lambda Error Rate > 1% (auth, ai, stripe) ───────
locals {
  critical_lambdas = toset(["auth", "ai", "stripe"])
}

resource "aws_cloudwatch_metric_alarm" "lambda_error_rate" {
  for_each = local.critical_lambdas

  alarm_name          = "${local.name}-lambda-${each.key}-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  threshold           = 1
  alarm_description   = "Lambda ${each.key} error rate exceeds 1% — SLO breach. See runbook: docs/runbooks/api-5xx-spike.md"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.ops_alerts.arn]
  ok_actions          = [aws_sns_topic.ops_alerts.arn]
  tags                = local.tags

  metric_query {
    id          = "error_rate"
    expression  = "IF(invocations>0, errors/invocations*100, 0)"
    label       = "Lambda Error Rate %"
    return_data = true
  }
  metric_query {
    id = "errors"
    metric {
      namespace   = "AWS/Lambda"
      metric_name = "Errors"
      period      = 300
      stat        = "Sum"
      dimensions  = { FunctionName = "${local.name}-api-${each.key}" }
    }
    return_data = false
  }
  metric_query {
    id = "invocations"
    metric {
      namespace   = "AWS/Lambda"
      metric_name = "Invocations"
      period      = 300
      stat        = "Sum"
      dimensions  = { FunctionName = "${local.name}-api-${each.key}" }
    }
    return_data = false
  }
}

# ─── SLO: Latency — API Gateway p95 > 500ms ──────────────────────────────
resource "aws_cloudwatch_metric_alarm" "api_latency_p95" {
  alarm_name          = "${local.name}-api-latency-p95"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  threshold           = 500
  alarm_description   = "API Gateway p95 latency exceeds 500ms — SLO breach (latency target: p95 < 500ms)"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.ops_alerts.arn]
  ok_actions          = [aws_sns_topic.ops_alerts.arn]
  tags                = local.tags

  namespace          = "AWS/ApiGateway"
  metric_name        = "Latency"
  dimensions         = { ApiId = module.api.api_gateway_id }
  period             = 300
  extended_statistic = "p95"
}

# ─── SLO: Latency — AI Lambda p95 Duration > 5000ms ─────────────────────
# AI calls invoke Bedrock and are expected to be slower; threshold is 5s not 500ms.
resource "aws_cloudwatch_metric_alarm" "ai_lambda_latency_p95" {
  alarm_name          = "${local.name}-ai-lambda-latency-p95"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  threshold           = 5000
  alarm_description   = "AI Lambda p95 duration exceeds 5000ms — SLO breach. See runbook: docs/runbooks/ai-latency-high.md"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.ops_alerts.arn]
  ok_actions          = [aws_sns_topic.ops_alerts.arn]
  tags                = local.tags

  namespace          = "AWS/Lambda"
  metric_name        = "Duration"
  dimensions         = { FunctionName = "${local.name}-api-ai" }
  period             = 300
  extended_statistic = "p95"
}

# ─── SLO: Reliability — Stripe DLQ Depth > 0 ────────────────────────────
# Any message landing in the DLQ means the handler exhausted all 5 retries.
resource "aws_cloudwatch_metric_alarm" "stripe_dlq_depth" {
  alarm_name          = "${local.name}-stripe-dlq-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 0
  alarm_description   = "Stripe webhook DLQ has unprocessed messages — payment handler failures. See runbook: docs/runbooks/stripe-dlq-depth.md"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.ops_alerts.arn]
  ok_actions          = [aws_sns_topic.ops_alerts.arn]
  tags                = local.tags

  namespace   = "AWS/SQS"
  metric_name = "ApproximateNumberOfMessagesVisible"
  # Queue name follows the naming convention in modules/payments/main.tf:
  # local.substack_name = "${var.name}-payments"  →  "${local.name}-payments-stripe-webhooks-dlq"
  dimensions = { QueueName = "${local.name}-payments-stripe-webhooks-dlq" }
  period     = 300
  statistic  = "Maximum"
}
