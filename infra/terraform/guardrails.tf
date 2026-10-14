# Bedrock Guardrails with Grounding and PII Filters
# Conforms to docs/plans/agentcore-architecture.md Section 11 & Faz 2

resource "aws_bedrock_guardrail" "travel_guardrail" {
  count = var.enable_bedrock ? 1 : 0

  name        = "${local.name}-travel-guardrail"
  description = "MapsBridge travel assistant PII masking, grounding filter and topic safety"

  blocked_input_messaging   = "İsteğiniz güvenlik politikalarını ihlal ettiği için işlenemedi."
  blocked_outputs_messaging = "Oluşturulan yanıt güvenlik ve doğrulama denetiminden geçemedi."

  content_policy_config {
    filters_config {
      input_strength  = "HIGH"
      output_strength = "HIGH"
      type            = "HATE"
    }
    filters_config {
      input_strength  = "HIGH"
      output_strength = "HIGH"
      type            = "VIOLENCE"
    }
    filters_config {
      input_strength  = "HIGH"
      output_strength = "HIGH"
      type            = "INSULTS"
    }
    filters_config {
      input_strength  = "HIGH"
      output_strength = "HIGH"
      type            = "PROMPT_ATTACK"
    }
  }

  sensitive_information_policy_config {
    pii_entities_config {
      action = "ANONYMIZE"
      type   = "EMAIL"
    }
    pii_entities_config {
      action = "ANONYMIZE"
      type   = "PHONE"
    }
    pii_entities_config {
      action = "ANONYMIZE"
      type   = "CREDIT_DEBIT_CARD_NUMBER"
    }
    pii_entities_config {
      action = "BLOCK"
      type   = "US_SOCIAL_SECURITY_NUMBER"
    }
  }

  contextual_grounding_policy_config {
    filters_config {
      threshold = 0.70
      type      = "GROUNDING"
    }
    filters_config {
      threshold = 0.65
      type      = "RELEVANCE"
    }
  }

  tags = local.tags
}
