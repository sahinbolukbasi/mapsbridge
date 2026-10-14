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

variable "cors_origins" {
  type        = list(string)
  description = "Allowed CORS origins for private guide bucket"
  default     = []
}

variable "cloudfront_distribution_arn" {
  type        = string
  description = "CloudFront distribution ARN for media bucket policy"
}