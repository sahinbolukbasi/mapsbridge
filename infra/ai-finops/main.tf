terraform {
  required_version = ">= 1.9"
  required_providers { aws = { source = "hashicorp/aws", version = "~> 6.0" } }
}
provider "aws" {
  region              = var.region
  allowed_account_ids = [var.account_id]
  default_tags { tags = { Project = var.project, Environment = var.environment, Workload = "travel-ai" } }
}
variable "account_id" { type = string }
variable "prefix" { type = string }
variable "ai_role_name" { type = string }
variable "source_inference_profile_arn" { type = string }
variable "region" {
  type    = string
  default = "eu-central-1"
}
variable "project" {
  type    = string
  default = "adreskopru"
}
variable "environment" {
  type    = string
  default = "prod"
}
variable "monthly_ai_budget_usd" {
  type        = number
  default     = null
  description = "Optional incremental AI budget. Existing account/project budgets are preserved."
  validation {
    condition     = var.monthly_ai_budget_usd == null ? true : var.monthly_ai_budget_usd > 0
    error_message = "Budget must be positive when configured."
  }
}
variable "budget_alert_emails" {
  type    = list(string)
  default = []
}
variable "alarm_topic_arn" {
  type    = string
  default = ""
}
variable "plan_model_cost_target_usd" {
  type        = number
  default     = 0.15
  description = "Operational model-only estimate threshold, not a promised cost or invoice total."
}
resource "aws_bedrock_inference_profile" "role" {
  for_each    = toset(["intake", "answer"])
  name        = "${var.prefix}-ai-${each.key}"
  description = "Travel AI ${each.key} cost attribution"
  model_source { copy_from = var.source_inference_profile_arn }
  tags = { AgentRole = each.key }
}
resource "aws_iam_role_policy" "profiles" {
  name = "travel-ai-application-profiles"
  role = var.ai_role_name
  policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect   = "Allow", Action = ["bedrock:InvokeModel"],
    Resource = [for profile in aws_bedrock_inference_profile.role : profile.arn]
  }] })
}
# Workload already exists in the account's discovered cost allocation tag catalog.
resource "aws_ce_cost_allocation_tag" "workload" {
  tag_key = "Workload"
  status  = "Active"
}
resource "aws_budgets_budget" "ai" {
  count        = var.monthly_ai_budget_usd == null ? 0 : 1
  name         = "${var.prefix}-travel-ai"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_ai_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  cost_filter {
    name   = "TagKeyValue"
    values = ["user:Workload$travel-ai"]
  }
  dynamic "notification" {
    for_each = length(var.budget_alert_emails) > 0 ? { ACTUAL = 80, FORECASTED = 100 } : {}
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = notification.key
      subscriber_email_addresses = var.budget_alert_emails
    }
  }
  lifecycle {
    precondition {
      condition     = length(var.budget_alert_emails) > 0
      error_message = "Configure a real notification recipient before enabling the optional AI budget."
    }
  }
  depends_on = [aws_ce_cost_allocation_tag.workload]
}
resource "aws_ce_anomaly_monitor" "ai" {
  name                  = "${var.prefix}-travel-ai"
  monitor_type          = "CUSTOM"
  monitor_specification = jsonencode({ Tags = { Key = "Workload", Values = ["travel-ai"] } })
  depends_on            = [aws_ce_cost_allocation_tag.workload]
}
resource "aws_ce_anomaly_subscription" "ai" {
  count            = length(var.budget_alert_emails) == 0 ? 0 : 1
  name             = "${var.prefix}-travel-ai-anomalies"
  frequency        = "DAILY"
  monitor_arn_list = [aws_ce_anomaly_monitor.ai.arn]
  dynamic "subscriber" {
    for_each = toset(var.budget_alert_emails)
    content {
      type    = "EMAIL"
      address = subscriber.value
    }
  }
  threshold_expression {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
      match_options = ["GREATER_THAN_OR_EQUAL"]
      values        = ["5"]
    }
  }
}
resource "aws_cloudwatch_metric_alarm" "plan_cost" {
  alarm_name          = "${var.prefix}-ai-plan-model-cost"
  namespace           = "MapsBridge/TravelAI"
  metric_name         = "PlanCostUsd"
  dimensions          = { Environment = var.environment }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.plan_model_cost_target_usd
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_topic_arn == "" ? [] : [var.alarm_topic_arn]
}
resource "aws_cloudwatch_metric_alarm" "unknown_cost" {
  alarm_name          = "${var.prefix}-ai-unpriced-requests"
  namespace           = "MapsBridge/TravelAI"
  metric_name         = "UnpricedRequests"
  dimensions          = { Environment = var.environment }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_topic_arn == "" ? [] : [var.alarm_topic_arn]
}
locals {
  dimension = ["Environment", var.environment]
}
resource "aws_cloudwatch_dashboard" "ai" {
  dashboard_name = "${var.prefix}-ai-finops-live"
  dashboard_body = jsonencode({ widgets = [
    { type = "metric", x = 0, y = 0, width = 12, height = 6, properties = {
      title   = "Completed-plan MODEL cost only (priced requests)", region = var.region, period = 300,
      metrics = [concat(["MapsBridge/TravelAI", "PlanCostUsd"], local.dimension, [{ stat = "Average" }])]
    } },
    { type = "metric", x = 12, y = 0, width = 12, height = 6, properties = {
      title   = "Pricing coverage and completed plans", region = var.region, period = 300, stat = "Sum",
      metrics = [for name in ["Requests", "CompletedPlans", "UnpricedRequests", "RequestFailures"] : concat(["MapsBridge/TravelAI", name], local.dimension)]
    } },
    { type = "metric", x = 0, y = 6, width = 12, height = 6, properties = {
      title   = "Tokens by role (cache separate)", region = var.region, period = 300, stat = "Sum",
      metrics = flatten([for role in ["intake", "answer"] : [for metric in ["InputTokens", "OutputTokens", "CacheReadTokens", "CacheWriteTokens"] : { row = concat(["MapsBridge/TravelAI", metric], local.dimension, ["Role", role]) }]])[*].row
    } },
    { type = "metric", x = 12, y = 6, width = 12, height = 6, properties = {
      title   = "Request latency", region = var.region, period = 300,
      metrics = [for stat in ["p50", "p95"] : concat(["MapsBridge/TravelAI", "RequestLatencyMs"], local.dimension, [{ stat = stat }])]
    } },
    { type = "text", x = 0, y = 12, width = 24, height = 3, properties = {
      markdown = "Model estimates exclude Memory, Gateway, Location, Guardrails, storage and compute. Reconcile with Cost Explorer/CUR. Missing prices or provider usage create UnpricedRequests, not zero-cost plans. Budget alarms are delayed notifications, not hard spend caps."
    } }
  ] })
}
output "ai_finops_environment" {
  value = {
    AI_FINOPS_METRICS_ENABLED       = "true"
    AI_MAX_MODEL_CALLS_PER_REQUEST  = "6"
    AI_MAX_OUTPUT_TOKENS            = "4200"
    AI_MAX_REQUEST_OUTPUT_TOKENS    = "14000"
    AI_MAX_INPUT_BYTES              = "65536"
    AI_MAX_INPUT_TOKENS             = "12000"
    BEDROCK_APPLICATION_PROFILE_ARN = aws_bedrock_inference_profile.role["answer"].arn
    BEDROCK_INTAKE_PROFILE_ARN      = aws_bedrock_inference_profile.role["intake"].arn
  }
}
