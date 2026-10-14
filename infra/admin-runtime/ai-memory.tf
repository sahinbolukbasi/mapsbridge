variable "ai_memory_environment" {
  type        = map(string)
  default     = {}
  description = "AI_MEMORY_TABLE and AGENTCORE_MEMORY_ID outputs from infra/ai-memory; no secrets."
  validation {
    condition     = alltrue([for key in keys(var.ai_memory_environment) : contains(["AI_MEMORY_TABLE", "AGENTCORE_MEMORY_ID", "MEMORY_READ_ENABLED", "MEMORY_WRITE_ENABLED", "BEDROCK_GUARDRAIL_ID", "BEDROCK_GUARDRAIL_VERSION", "CUSTOM_MODEL_ENABLED", "BEDROCK_INTAKE_MODEL_ID", "BEDROCK_THINKING_ENABLED", "BEDROCK_THINKING_BUDGET_TOKENS"], key)])
    error_message = "Only supported AI capability settings are allowed."
  }
}
variable "ai_additional_model_arns" {
  type    = list(string)
  default = []
}
resource "aws_iam_role_policy" "ai_additional_models" {
  count  = length(var.ai_additional_model_arns) > 0 ? 1 : 0
  role   = aws_iam_role.domain["ai"].id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["bedrock:InvokeModel"], Resource = var.ai_additional_model_arns }] })
}
resource "aws_iam_role_policy" "ai_guardrail" {
  count  = lookup(var.ai_memory_environment, "BEDROCK_GUARDRAIL_ID", "") != "" ? 1 : 0
  role   = aws_iam_role.domain["ai"].id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["bedrock:ApplyGuardrail"], Resource = "arn:aws:bedrock:${var.region}:${var.account_id}:guardrail/${var.ai_memory_environment["BEDROCK_GUARDRAIL_ID"]}" }] })
}
