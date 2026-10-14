variable "name" {
  type        = string
  description = "Resource name prefix (project-environment)"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"
}

variable "tags" {
  type        = map(string)
  description = "Common resource tags"
}

variable "api_gateway_stage_arn" {
  type        = string
  description = "ARN of the API Gateway stage to associate with the WAF WebACL"
}

variable "waf_rate_limit" {
  type        = number
  default     = 2000
  description = "Maximum requests per 5 minutes per IP before rate limiting"
}

variable "enable_waf" {
  type        = bool
  default     = true
  description = "Enable AWS WAF WebACL for API Gateway protection"
}
