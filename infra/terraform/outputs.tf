output "api_url" {
  value = module.api.api_gateway_url
}

output "api_gateway_id" {
  value = module.api.api_gateway_id
}

output "websocket_url" {
  value = module.messaging.websocket_url
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.users.id
}

output "cognito_web_client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "lambda_function_names" {
  value = module.api.lambda_function_names
}

output "aurora_endpoint" {
  value     = module.database.aurora_endpoint
  sensitive = true
}

output "redis_endpoint" {
  value     = module.database.redis_endpoint
  sensitive = true
}

output "firehose_stream_name" {
  value = module.analytics.firehose_stream_name
}

output "resource_group_name" {
  value = aws_resourcegroups_group.project.name
}

output "website_url" {
  value = "https://${aws_cloudfront_distribution.web.domain_name}"
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.web.id
}

output "monitoring_dashboard_url" {
  value = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards/dashboard/${local.name}-overview"
}

output "alarms_sns_topic_arn" {
  value = aws_sns_topic.alarms.arn
}
