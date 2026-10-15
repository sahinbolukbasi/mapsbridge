output "stripe_queue_url" {
  value = aws_sqs_queue.stripe_webhooks.url
}

output "stripe_queue_arn" {
  value = aws_sqs_queue.stripe_webhooks.arn
}

output "stripe_dlq_arn" {
  value = aws_sqs_queue.stripe_dlq.arn
}

output "rc_secret_api_key_ssm" {
  value = aws_ssm_parameter.rc_secret_api_key.name
}

output "rc_webhook_auth_secret_ssm" {
  value = aws_ssm_parameter.rc_webhook_auth_secret.name
}

