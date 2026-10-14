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

variable "analytics_bucket_id" {
  type        = string
  description = "S3 bucket ID for analytics data"
}

variable "analytics_bucket_arn" {
  type        = string
  description = "S3 bucket ARN for analytics data"
}

variable "athena_bucket_id" {
  type        = string
  description = "S3 bucket ID for Athena query results"
}

variable "glue_database_name" {
  type        = string
  default     = "mapsbridge_analytics"
  description = "Glue database name for Athena tables"
}

variable "lambda_role_arn" {
  type        = string
  default     = ""
  description = "Lambda role ARN (for Firehose PutRecord permission)"
}

variable "lambda_role_name" {
  type        = string
  default     = ""
  description = "Lambda role name (for Firehose PutRecord policy attachment)"
}