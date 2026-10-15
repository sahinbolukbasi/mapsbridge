# ── CloudWatch Alarms & Dashboard for all services ──────────────────────────

locals {
  # Main-stack functions use "api-" prefix. admin/routes/ai/stripe are in admin-runtime.
  lambda_functions = [
    "api-auth", "api-chat", "api-marketplace",
    "ws-onconnect", "ws-onmessage", "ws-ondisconnect"
  ]
  alarm_prefix = "${local.name}-alarm"
}

# ── SNS Topic for alarm notifications ───────────────────────────────────────
resource "aws_sns_topic" "alarms" {
  name = "${local.name}-alarms"
}

resource "aws_sns_topic_subscription" "alarm_email" {
  count     = var.budget_alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.budget_alert_email
}

# ── Lambda Error alarms (one per function) ──────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = toset(local.lambda_functions)

  alarm_name          = "${local.alarm_prefix}-lambda-${each.key}-errors"
  alarm_description   = "Lambda ${each.key} error rate > 5 in 5 minutes"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 5
  evaluation_periods  = 1
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = "${local.name}-${each.key}" }
  period              = 300
  statistic           = "Sum"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
}

# ── Lambda Duration alarms (cold start / timeout detection) ─────────────────
resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  for_each = toset(local.lambda_functions)

  alarm_name          = "${local.alarm_prefix}-lambda-${each.key}-duration"
  alarm_description   = "Lambda ${each.key} p95 duration > 10s"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 10000
  evaluation_periods  = 2
  namespace           = "AWS/Lambda"
  metric_name         = "Duration"
  dimensions          = { FunctionName = "${local.name}-${each.key}" }
  period              = 300
  extended_statistic  = "p95"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
}

# ── API Gateway 5xx alarm ───────────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "${local.alarm_prefix}-api-5xx"
  alarm_description   = "API Gateway 5xx errors > 10 in 5 minutes"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 10
  evaluation_periods  = 1
  namespace           = "AWS/ApiGateway"
  metric_name         = "5xx"
  dimensions          = { ApiId = module.api.api_gateway_id }
  period              = 300
  statistic           = "Sum"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
}

# ── API Gateway Latency alarm ───────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "${local.alarm_prefix}-api-latency"
  alarm_description   = "API Gateway p95 latency > 5s"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 5000
  evaluation_periods  = 2
  namespace           = "AWS/ApiGateway"
  metric_name         = "Latency"
  dimensions          = { ApiId = module.api.api_gateway_id }
  period              = 300
  extended_statistic  = "p95"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
}

# ── DynamoDB Throttle alarm ─────────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "dynamo_throttle" {
  alarm_name          = "${local.alarm_prefix}-dynamo-throttle"
  alarm_description   = "DynamoDB throttled requests > 10 in 5 minutes"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 10
  evaluation_periods  = 1
  namespace           = "AWS/DynamoDB"
  metric_name         = "ThrottledRequests"
  dimensions          = { TableName = "${local.name}-data" }
  period              = 300
  statistic           = "Sum"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
}

# ── CloudFront Error Rate alarm ─────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "cloudfront_errors" {
  alarm_name          = "${local.alarm_prefix}-cloudfront-5xx"
  alarm_description   = "CloudFront 5xx error rate > 5%"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 5
  evaluation_periods  = 2
  namespace           = "AWS/CloudFront"
  metric_name         = "5xxErrorRate"
  dimensions = {
    DistributionId = aws_cloudfront_distribution.web.id
    Region         = "Global"
  }
  period             = 300
  statistic          = "Average"
  treat_missing_data = "notBreaching"
  alarm_actions      = [aws_sns_topic.alarms.arn]
}

# ── Unified CloudWatch Dashboard ────────────────────────────────────────────
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.name}-overview"

  dashboard_body = jsonencode({
    widgets = concat(
      # Row 1: Lambda Invocations + Errors
      [{
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [for fn in local.lambda_functions :
            ["AWS/Lambda", "Invocations", "FunctionName", "${local.name}-${fn}", { stat = "Sum", label = fn }]
          ]
          view    = "timeSeries"
          stacked = true
          region  = var.aws_region
          title   = "Lambda Invocations"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [for fn in local.lambda_functions :
            ["AWS/Lambda", "Errors", "FunctionName", "${local.name}-${fn}", { stat = "Sum", label = fn }]
          ]
          view    = "timeSeries"
          stacked = true
          region  = var.aws_region
          title   = "Lambda Errors"
          period  = 300
        }
      }],
      # Row 2: API Gateway
      [{
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiId", module.api.api_gateway_id, { stat = "Sum", label = "Requests" }],
            ["AWS/ApiGateway", "4xx", "ApiId", module.api.api_gateway_id, { stat = "Sum", label = "4xx" }],
            ["AWS/ApiGateway", "5xx", "ApiId", module.api.api_gateway_id, { stat = "Sum", label = "5xx" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "API Gateway Traffic"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Latency", "ApiId", module.api.api_gateway_id, { stat = "p50", label = "p50" }],
            ["AWS/ApiGateway", "Latency", "ApiId", module.api.api_gateway_id, { stat = "p95", label = "p95" }],
            ["AWS/ApiGateway", "Latency", "ApiId", module.api.api_gateway_id, { stat = "p99", label = "p99" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "API Gateway Latency"
          period  = 300
        }
      }],
      # Row 3: DynamoDB + CloudFront
      [{
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", "${local.name}-data", { stat = "Sum", label = "Read CU" }],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", "${local.name}-data", { stat = "Sum", label = "Write CU" }],
            ["AWS/DynamoDB", "ThrottledRequests", "TableName", "${local.name}-data", { stat = "Sum", label = "Throttled" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "DynamoDB Usage"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 12
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/CloudFront", "Requests", "DistributionId", aws_cloudfront_distribution.web.id, "Region", "Global", { stat = "Sum", label = "Requests" }],
            ["AWS/CloudFront", "4xxErrorRate", "DistributionId", aws_cloudfront_distribution.web.id, "Region", "Global", { stat = "Average", label = "4xx Rate %" }],
            ["AWS/CloudFront", "5xxErrorRate", "DistributionId", aws_cloudfront_distribution.web.id, "Region", "Global", { stat = "Average", label = "5xx Rate %" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "CloudFront"
          period  = 300
        }
      }],
      # Row 4: Lambda Duration p95
      [{
        type   = "metric"
        x      = 0
        y      = 18
        width  = 24
        height = 6
        properties = {
          metrics = [for fn in local.lambda_functions :
            ["AWS/Lambda", "Duration", "FunctionName", "${local.name}-${fn}", { stat = "p95", label = "${fn} p95" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Lambda Duration (p95)"
          period  = 300
        }
      }]
    )
  })
}
