variable "aws_region" {
  type        = string
  description = "AWS deployment region"
  default     = "eu-central-1"
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "project" {
  type    = string
  default = "mapsbridge"
}

variable "frontend_domain" {
  type        = string
  default     = ""
  description = "Frontend domain for CORS (e.g., mapsbridge.com). Empty = allow all (*)"
}

variable "cors_origins" {
  type        = list(string)
  default     = null
  description = "Override CORS origins (list of strings). If null, uses frontend_domain or *"
}

variable "monthly_budget_usd" {
  type        = string
  default     = "50"
  description = "Monthly AWS budget guardrail (USD). Alerts at 80% and 100%."
}

variable "budget_alert_email" {
  type        = string
  default     = "admin@mapsbridge.com"
  description = "Email for AWS budget alerts"
}

variable "vpc_cidr" {
  type        = string
  default     = "10.0.0.0/20"
  description = "VPC CIDR block (default /20 = 4096 IPs)"
}

variable "enable_bedrock" {
  type        = bool
  default     = true
  description = "Enable Bedrock VPC endpoint + Knowledge Base resources"
}

variable "bedrock_model_id" {
  type        = string
  default     = "anthropic.claude-3-5-sonnet-20241022-v2:0"
  description = "Bedrock foundation model ID for AI route planning (Claude 3.5 Sonnet)"
}

variable "opensearch_collection_arn" {
  type        = string
  default     = ""
  description = "OpenSearch Serverless collection ARN for Bedrock Knowledge Base vector store"
}

variable "db_username" {
  type        = string
  default     = "mapsbridge_admin"
  description = "Aurora Serverless master username"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "Aurora Serverless master password (sensitive, use Secrets Manager or TF var)"
}

variable "aurora_instance_class" {
  type        = string
  default     = "db.serverless"
  description = "Aurora Serverless v2 instance class"
}

variable "redis_max_data_storage_gb" {
  type        = number
  default     = 10
  description = "ElastiCache Serverless max data storage (GB)"
}

variable "redis_max_ecpu_per_second" {
  type        = number
  default     = 10000
  description = "ElastiCache Serverless max ECPU per second"
}

variable "lambda_timeout" {
  type        = number
  default     = 28
  description = "Lambda timeout in seconds"
}

variable "lambda_memory" {
  type        = number
  default     = 256
  description = "Lambda memory in MB (ARM64/Graviton) - Optimized for cost (was 512MB)"
}

variable "gateway_burst_limit" {
  type        = number
  default     = 50
  description = "API Gateway throttle burst limit"
}

variable "gateway_rate_limit" {
  type        = number
  default     = 25
  description = "API Gateway throttle rate limit"
}

variable "stripe_secret_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Stripe secret key (sensitive, stored in SSM Parameter Store)"
}

variable "stripe_webhook_secret" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Stripe webhook signing secret (sensitive, stored in SSM Parameter Store)"
}

variable "stripe_price_ids" {
  type        = map(string)
  default     = {}
  description = "Stripe catalog environment variables: STRIPE_EXPLORER_PRICE_ID, STRIPE_PRO_PRICE_ID, STRIPE_AGENCY_PRICE_ID and STRIPE_PACK_*_PRICE_ID"
  validation {
    condition     = alltrue([for k, v in var.stripe_price_ids : contains(["STRIPE_EXPLORER_PRICE_ID", "STRIPE_PRO_PRICE_ID", "STRIPE_AGENCY_PRICE_ID", "STRIPE_PACK_STARTER_PRICE_ID", "STRIPE_PACK_POPULAR_PRICE_ID", "STRIPE_PACK_MASTER_PRICE_ID", "STRIPE_PACK_PRO_PRICE_ID"], k) && startswith(v, "price_")])
    error_message = "Only catalog price ID environment variables are allowed."
  }
}
variable "acm_certificate_arn" {
  type        = string
  default     = ""
  description = "ACM certificate ARN for CloudFront custom domain (must be in us-east-1). Empty = use default CloudFront domain."
}

variable "hosted_zone_id" {
  type        = string
  default     = ""
  description = "Route53 hosted zone ID for DNS records. Empty = skip DNS record creation."
}

variable "ai_daily_request_limit" {
  type    = number
  default = 200
  validation {
    condition     = var.ai_daily_request_limit >= 0 && floor(var.ai_daily_request_limit) == var.ai_daily_request_limit
    error_message = "Daily AI request limit must be a nonnegative integer; zero disables new jobs."
  }
}

variable "waf_rate_limit" {
  type        = number
  default     = 2000
  description = "Maximum requests per 5-minute window per IP before WAF rate limiting kicks in"
}

variable "custom_domain" {
  type        = string
  default     = ""
  description = "Custom domain name for CloudFront (e.g., app.mapsbridge.com). Empty = skip custom domain setup."
}

variable "travel_knowledge_base_id" {
  type        = string
  default     = ""
  description = "Bedrock Knowledge Base ID for travel content. Required to enable KB sync in the kb-ingest Lambda."
}
