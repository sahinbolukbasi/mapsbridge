# AWS Scalability, SQS Queue & DevOps Monitoring for Deal & Ticket Tracker Bot
# Supports 10,000 Concurrent Users via Asynchronous Event-Driven Queueing

# 1. Dead Letter Queue (DLQ) for failed tracker jobs
resource "aws_sqs_queue" "tracker_jobs_dlq" {
  name                      = "${local.name}-tracker-jobs-dlq"
  message_retention_seconds = 1209600 # 14 days
  tags                      = local.tags
}

# 2. Main Distributed Job Queue for 10k concurrent price & deal tracking requests
resource "aws_sqs_queue" "tracker_jobs_queue" {
  name                       = "${local.name}-tracker-jobs-queue"
  visibility_timeout_seconds = 300
  message_retention_seconds  = 86400 # 24 hours
  receive_wait_time_seconds  = 20    # Long polling to reduce API calls & cost

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.tracker_jobs_dlq.arn
    maxReceiveCount     = 3
  })

  tags = local.tags
}

# 3. DevOps CloudWatch Alarm: SQS Queue Depth (Surge Alert for 10k users)
resource "aws_cloudwatch_metric_alarm" "tracker_queue_depth_alarm" {
  alarm_name          = "${local.name}-tracker-queue-depth-surge"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 500
  alarm_description   = "DevOps Alert: Bekleyen takip işi sayısı 500'ü aştı. Lambda worker concurrency kontrol edilmeli."

  dimensions = {
    QueueName = aws_sqs_queue.tracker_jobs_queue.name
  }

  tags = local.tags
}

# 4. DevOps CloudWatch Alarm: DLQ Messages (Poison Pill / Failed Bots)
resource "aws_cloudwatch_metric_alarm" "tracker_dlq_alarm" {
  alarm_name          = "${local.name}-tracker-dlq-failed-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "DevOps Alert: Tracker DLQ kuyruğuna başarısız mesaj düştü. Sağlayıcı blokajı veya veri hatası denetlenmeli."

  dimensions = {
    QueueName = aws_sqs_queue.tracker_jobs_dlq.name
  }

  tags = local.tags
}
