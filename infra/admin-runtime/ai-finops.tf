variable "ai_finops_environment" {
  type = map(string)
  default = {
    AI_FINOPS_METRICS_ENABLED      = "true"
    AI_MAX_MODEL_CALLS_PER_REQUEST = "6"
    AI_MAX_OUTPUT_TOKENS           = "4200"
    AI_MAX_REQUEST_OUTPUT_TOKENS   = "14000"
    AI_MAX_INPUT_BYTES             = "65536"
    AI_MAX_INPUT_TOKENS            = "12000"
  }
  description = "Bounded model work and metadata-only metrics; rate cards require verified model/region prices."
  validation {
    condition = alltrue([for key in keys(var.ai_finops_environment) : contains([
      "AI_FINOPS_METRICS_ENABLED", "AI_MAX_MODEL_CALLS_PER_REQUEST", "AI_MAX_OUTPUT_TOKENS", "AI_MAX_REQUEST_OUTPUT_TOKENS", "AI_MAX_INPUT_BYTES", "AI_MAX_INPUT_TOKENS", "AI_MODEL_RATES_JSON", "BEDROCK_APPLICATION_PROFILE_ARN", "BEDROCK_INTAKE_PROFILE_ARN"
    ], key)])
    error_message = "Only supported FinOps environment settings are allowed."
  }
}
