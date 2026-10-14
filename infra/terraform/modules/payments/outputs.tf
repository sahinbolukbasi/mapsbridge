output "stripe_queue_url" {
  value = aws_sqs_queue.stripe_webhooks.url
}

output "stripe_queue_arn" {
  value = aws_sqs_queue.stripe_webhooks.arn
}

output "stripe_dlq_arn" {
  value = aws_sqs_queue.stripe_dlq.arn
}

