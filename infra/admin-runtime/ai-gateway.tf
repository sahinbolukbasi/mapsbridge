# Populate only after infra/agentcore-gateway is deployed and smoke-tested.
variable "ai_gateway_environment" {
  type        = map(string)
  default     = {}
  description = "AgentCore Gateway endpoint and all three deployed tool names. No credentials."
  validation {
    condition = length(var.ai_gateway_environment) == 0 || (
      length(var.ai_gateway_environment) == 4 &&
      can(regex("^https://[a-z0-9-]+\\.gateway\\.bedrock-agentcore\\.eu-central-1\\.amazonaws\\.com/mcp$", lookup(var.ai_gateway_environment, "AGENTCORE_GATEWAY_URL", ""))) &&
      lookup(var.ai_gateway_environment, "AGENTCORE_PLACES_TOOL", "") == "travel___research_places" &&
      lookup(var.ai_gateway_environment, "AGENTCORE_FLIGHT_TOOL", "") == "flights___search_flights" &&
      lookup(var.ai_gateway_environment, "AGENTCORE_ADVISORY_TOOL", "") == "advisory___get_advisory"
    )
    error_message = "Provide the eu-central-1 Gateway URL plus all three tool names (travel___research_places, flights___search_flights, advisory___get_advisory), or an empty map."
  }
}
