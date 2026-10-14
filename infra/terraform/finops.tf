# FinOps & Cost Controls for AWS Bedrock Multi-Agent System
# Conforms to docs/plans/agentcore-architecture.md Section 10 & 13

resource "aws_budgets_budget" "ai_monthly" {
  count = var.enable_bedrock ? 1 : 0

  name              = "${local.name}-ai-monthly-budget"
  budget_type       = "COST"
  limit_amount      = "50"
  limit_unit        = "USD"
  time_period_start = "2026-01-01_00:00"
  time_unit         = "MONTHLY"

  cost_filter {
    name = "TagKeyValue"
    values = [
      "user:mapsbridge:service$travel-ai"
    ]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = ["ops@mapsbridge.internal"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = ["ops@mapsbridge.internal"]
  }

  tags = local.tags
}
