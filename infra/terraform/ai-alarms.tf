resource "aws_cloudwatch_metric_alarm" "ai_request_failure_rate" {
  count               = var.enable_bedrock ? 1 : 0
  alarm_name          = "${local.name}-ai-request-failure-rate"
  alarm_description   = "AI request failures exceed 2 percent for three consecutive five-minute periods."
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0.02
  evaluation_periods  = 3
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "failure_rate"
    expression  = "IF(reqs>0, failures/reqs, 0)"
    label       = "AI request failure rate"
    return_data = true
  }
  metric_query {
    id = "failures"
    metric {
      namespace   = "MapsBridge/TravelAI"
      metric_name = "RequestFailures"
      period      = 300
      stat        = "Sum"
      dimensions  = { Environment = var.environment }
    }
    return_data = false
  }
  metric_query {
    id = "reqs"
    metric {
      namespace   = "MapsBridge/TravelAI"
      metric_name = "Requests"
      period      = 300
      stat        = "Sum"
      dimensions  = { Environment = var.environment }
    }
    return_data = false
  }
}

resource "aws_cloudwatch_metric_alarm" "ai_request_latency_p95" {
  count               = var.enable_bedrock ? 1 : 0
  alarm_name          = "${local.name}-ai-request-latency-p95"
  alarm_description   = "AI request p95 latency exceeds 15 seconds for three consecutive five-minute periods."
  comparison_operator = "GreaterThanThreshold"
  threshold           = 15000
  evaluation_periods  = 3
  treat_missing_data  = "notBreaching"
  namespace           = "MapsBridge/TravelAI"
  metric_name         = "RequestLatencyMs"
  dimensions          = { Environment = var.environment }
  period              = 300
  extended_statistic  = "p95"
}

resource "aws_cloudwatch_metric_alarm" "ai_timeout_rate" {
  count               = var.enable_bedrock ? 1 : 0
  alarm_name          = "${local.name}-ai-timeout-rate"
  alarm_description   = "AI provider or research timeout rate exceeds 5 percent for three consecutive five-minute periods."
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0.05
  evaluation_periods  = 3
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "timeout_rate"
    expression  = "IF(calls>0, timeouts/calls, 0)"
    label       = "AI timeout rate"
    return_data = true
  }
  metric_query {
    id = "timeouts"
    metric {
      namespace   = "MapsBridge/TravelAI"
      metric_name = "Timeouts"
      period      = 300
      stat        = "Sum"
      dimensions  = { Environment = var.environment }
    }
    return_data = false
  }
  metric_query {
    id = "calls"
    metric {
      namespace   = "MapsBridge/TravelAI"
      metric_name = "ModelCalls"
      period      = 300
      stat        = "Sum"
      dimensions  = { Environment = var.environment }
    }
    return_data = false
  }
}
