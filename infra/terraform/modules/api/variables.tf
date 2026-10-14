variable "name" {
  type        = string
  description = "Base name prefix"
}

variable "environment" {
  type        = string
  description = "Deployment environment"
}

variable "tags" {
  type        = map(string)
  description = "Common resource tags"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for Lambda VPC config"
}

variable "lambda_security_group_id" {
  type        = string
  description = "Security group ID for Lambda functions"
}

variable "lambda_runtime" {
  type        = string
  default     = "nodejs22.x"
  description = "Lambda runtime"
}

variable "lambda_timeout" {
  type        = number
  default     = 28
  description = "Lambda timeout in seconds"
}

variable "lambda_memory" {
  type        = number
  default     = 512
  description = "Lambda memory in MB (ARM64)"
}

variable "lambda_domains" {
  type = map(object({
    zip_path = string
    env_vars = optional(map(string), {})
  }))
  description = "Map of domain name → { zip_path, env_vars }"
}

variable "domain_routes" {
  type        = map(list(string))
  description = "Map of domain name → list of API Gateway route keys"
}

variable "cors_origins" {
  type        = list(string)
  description = "Allowed CORS origins"
}

variable "cognito_user_pool_arn" {
  type        = string
  description = "Cognito User Pool ARN"
}

variable "cognito_user_pool_id" {
  type        = string
  description = "Cognito User Pool ID"
}

variable "cognito_client_id" {
  type        = string
  description = "Cognito App Client ID"
}

variable "aurora_cluster_arn" {
  type        = string
  description = "Aurora cluster ARN"
}

variable "aurora_writer_ssm" {
  type        = string
  description = "SSM parameter path for Aurora writer endpoint"
}

variable "redis_endpoint_ssm" {
  type        = string
  description = "SSM parameter path for Redis endpoint"
}

variable "guides_bucket_id" {
  type        = string
  description = "S3 bucket for private PDF guides"
}

variable "guides_bucket_arn" {
  type        = string
  description = "S3 bucket ARN for private PDF guides"
}

variable "media_bucket_id" {
  type        = string
  description = "S3 bucket for public media"
}

variable "media_bucket_arn" {
  type        = string
  description = "S3 bucket ARN for public media"
}

variable "analytics_bucket_id" {
  type        = string
  description = "S3 bucket for analytics data"
}

variable "athena_bucket_arn" {
  type        = string
  description = "S3 bucket ARN for Athena query results"
}

variable "stripe_secret_ssm" {
  type        = string
  description = "SSM parameter path for Stripe secret key"
}

variable "stripe_webhook_secret_ssm" {
  type        = string
  description = "SSM parameter path for Stripe webhook secret"
}

variable "stripe_queue_url" {
  type        = string
  description = "SQS queue URL for Stripe webhooks"
}

variable "stripe_queue_arn" {
  type        = string
  description = "SQS queue ARN for Stripe webhooks"
}

variable "bedrock_model_id" {
  type        = string
  default     = "anthropic.claude-3-haiku-20240307-v1:0"
  description = "Bedrock model ID for AI domain"
}

variable "kms_key_arn" {
  type        = string
  description = "KMS key ARN for encryption"
  default     = null
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

variable "log_group_arn" {
  type        = string
  description = "CloudWatch Log Group ARN for API Gateway access logs"
}

variable "shared_layer_zip" {
  type        = string
  description = "Path to Lambda layer zip file with shared node_modules"
}

variable "athena_workgroup" {
  type        = string
  default     = "primary"
  description = "Athena workgroup name for admin queries"
}
variable "billing_table_arn" {
  type        = string
  description = "Canonical billing and route DynamoDB table ARN"
}

variable "google_places_api_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Google Places API (New) key for place intelligence pipeline"
}

variable "foursquare_api_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Foursquare Places API v3 key for place intelligence pipeline"
}
