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

variable "stripe_secret_key" {
  type        = string
  description = "Stripe secret key (sensitive) — stored in SSM Parameter Store"
  sensitive   = true
}

variable "stripe_webhook_secret" {
  type        = string
  description = "Stripe webhook signing secret (sensitive) — stored in SSM Parameter Store"
  sensitive   = true
  default     = ""
}