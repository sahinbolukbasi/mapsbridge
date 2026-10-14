variable "name" {
  type        = string
  description = "Base name prefix for all resources"
}

variable "project" {
  type        = string
  description = "Project identifier tag"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/prod)"
}

variable "aws_region" {
  type        = string
  description = "AWS region for VPC endpoints"
}

variable "vpc_cidr" {
  type        = string
  default     = "10.0.0.0/20"
  description = "VPC CIDR block (default /20 = 4096 IPs)"
}

variable "enable_bedrock" {
  type        = bool
  default     = true
  description = "Create VPC Endpoint for Bedrock Runtime"
}