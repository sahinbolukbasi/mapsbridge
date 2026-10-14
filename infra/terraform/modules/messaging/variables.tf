variable "name" {
  type        = string
  description = "Base name prefix"
}

variable "tags" {
  type        = map(string)
  description = "Common resource tags"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
}

variable "cognito_user_pool_id" {
  type        = string
  description = "User pool accepted by WebSocket connection authentication"
}

variable "cognito_client_id" {
  type        = string
  description = "App client accepted by WebSocket connection authentication"
}

variable "messages_table_name" {
  type        = string
  description = "Name of the messages table in DynamoDB"
}

variable "messages_table_arn" {
  type        = string
  description = "ARN of the messages table in DynamoDB"
}

variable "onconnect_zip" {
  type        = string
  description = "Path to onconnect Lambda zip"
}

variable "onmessage_zip" {
  type        = string
  description = "Path to onmessage Lambda zip"
}

variable "ondisconnect_zip" {
  type        = string
  description = "Path to ondisconnect Lambda zip"
}
