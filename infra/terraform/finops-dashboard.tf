# CloudWatch FinOps & Multi-Agent Operational Dashboard
# Conforms to docs/plans/agentcore-architecture.md Section 10, 11 & 13

resource "aws_cloudwatch_dashboard" "ai_multi_agent_finops" {
  count = var.enable_bedrock ? 1 : 0

  dashboard_name = "${local.name}-bedrock-agentcore-finops"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["MapsBridge/TravelAI", "PlanCostUsd", { stat = "Average", label = "Avg Plan Cost ($)" }],
            ["MapsBridge/TravelAI", "PlanCostUsd", { stat = "Maximum", label = "Max Plan Cost ($)" }],
            [{ expression = "0.15", label = "FinOps Target ($0.15)", id = "e1", color = "#ff7f0e" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Cost Per Completed Plan (Target <= $0.15)"
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
          metrics = [
            ["MapsBridge/TravelAI", "TokenCount", "AgentRole", "concierge", { stat = "Sum" }],
            ["MapsBridge/TravelAI", "TokenCount", "AgentRole", "planner", { stat = "Sum" }],
            ["MapsBridge/TravelAI", "TokenCount", "AgentRole", "food", { stat = "Sum" }],
            ["MapsBridge/TravelAI", "TokenCount", "AgentRole", "lodging", { stat = "Sum" }],
            ["MapsBridge/TravelAI", "TokenCount", "AgentRole", "sports", { stat = "Sum" }],
            ["MapsBridge/TravelAI", "TokenCount", "AgentRole", "transit", { stat = "Sum" }],
            ["MapsBridge/TravelAI", "TokenCount", "AgentRole", "emergency", { stat = "Sum" }]
          ]
          view    = "timeSeries"
          stacked = true
          region  = var.aws_region
          title   = "Token Consumption by Sub-Agent"
          period  = 300
        }

      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["MapsBridge/TravelAI", "AgentLatencyMs", "AgentRole", "concierge", { stat = "p50" }],
            ["MapsBridge/TravelAI", "AgentLatencyMs", "AgentRole", "concierge", { stat = "p95" }],
            ["MapsBridge/TravelAI", "AgentLatencyMs", "AgentRole", "planner", { stat = "p50" }],
            ["MapsBridge/TravelAI", "AgentLatencyMs", "AgentRole", "planner", { stat = "p95" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Sub-Agent Latency (p50 / p95)"
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
            ["MapsBridge/TravelAI", "AgentInvocations", { stat = "Sum", label = "Total Invocations" }],
            ["MapsBridge/TravelAI", "AgentFailures", { stat = "Sum", label = "Failures / Fallbacks" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Agent Success vs Failure Rate"
          period  = 300
        }
      }
    ]
  })
}
