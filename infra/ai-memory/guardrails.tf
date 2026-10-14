resource "aws_bedrock_guardrail" "travel" {
  name                      = "${var.prefix}-travel-assistant"
  blocked_input_messaging   = "Bu isteği işleyemiyorum. Seyahat planınla ilgili yardımcı olabilirim."
  blocked_outputs_messaging = "Bu yanıt doğrulanamadı. İsteğini farklı şekilde ifade edebilirsin."
  content_policy_config {
    filters_config {
      type            = "PROMPT_ATTACK"
      input_strength  = "HIGH"
      output_strength = "NONE"
    }
  }
  sensitive_information_policy_config {
    pii_entities_config {
      type   = "CREDIT_DEBIT_CARD_NUMBER"
      action = "BLOCK"
    }
  }
}
resource "aws_bedrock_guardrail_version" "travel" {
  guardrail_arn = aws_bedrock_guardrail.travel.guardrail_arn
  description   = "Travel assistant input and payment-data protection v1"
  lifecycle { replace_triggered_by = [aws_bedrock_guardrail.travel] }
}
output "guardrail_environment" {
  value = { BEDROCK_GUARDRAIL_ID = aws_bedrock_guardrail.travel.guardrail_id, BEDROCK_GUARDRAIL_VERSION = aws_bedrock_guardrail_version.travel.version }
}
