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

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for Aurora and Redis"
}

variable "aurora_security_group_id" {
  type        = string
  description = "Security group ID for Aurora"
}

variable "redis_security_group_id" {
  type        = string
  description = "Security group ID for Redis"
}

variable "db_username" {
  type        = string
  description = "Aurora master username"
  default     = "mapsbridge_admin"
}

variable "aurora_instance_class" {
  type        = string
  default     = "db.serverless"
  description = "Aurora Serverless v2 instance class"
}

variable "kms_key_arn" {
  type        = string
  description = "KMS key ARN for encryption at rest"
  default     = null
}