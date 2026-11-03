# Conversion Forwarder — RevenueCat satın alma event'lerini reklam platformlarına
# (Google Ads / Meta CAPI / GA4) iletir. SNS fan-out + async DLQ.
# Attribution pipeline'ın backend tarafı (FAZ 2). Hedefler env ile flag'li; API
# key yoksa no-op (güvenli başlangıç).

# RevenueCat webhook secret (constructEvent/Authorization). Değer elle set edilir.
resource "aws_secretsmanager_secret" "rc_webhook_secret" {
  name        = "${var.prefix}/revenuecat/webhook-secret"
  description = "RevenueCat webhook Authorization shared secret. Değeri elle set edilir."
}
resource "aws_secretsmanager_secret_version" "rc_webhook_secret" {
  secret_id     = aws_secretsmanager_secret.rc_webhook_secret.id
  secret_string = "placeholder-set-manually"
  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Conversion event SNS topic (revenuecat webhook publish eder)
resource "aws_sns_topic" "billing_conversions" {
  name = "${var.prefix}-billing-conversions"
}

# Async invoke DLQ (kalıcı başarısızlıklar buraya)
resource "aws_sqs_queue" "conversion_forwarder_dlq" {
  name                      = "${var.prefix}-conversion-forwarder-dlq"
  message_retention_seconds = 1209600 # 14 gün
}

resource "aws_cloudwatch_log_group" "conversion_forwarder" {
  name              = "/aws/lambda/${var.prefix}-conversion-forwarder"
  retention_in_days = 30
}

resource "aws_iam_role" "conversion_forwarder" {
  name = "${var.prefix}-conversion-forwarder"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}
resource "aws_iam_role_policy" "conversion_forwarder" {
  role = aws_iam_role.conversion_forwarder.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.conversion_forwarder.arn}:*" },
      { Effect = "Allow", Action = ["sqs:SendMessage"], Resource = aws_sqs_queue.conversion_forwarder_dlq.arn },
      # Reklam platformu secret'ları (varsa). Resource prefix'le sınırlı.
      { Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:${var.prefix}/ads/*" },
    ]
  })
}

resource "aws_lambda_function" "conversion_forwarder" {
  function_name    = "${var.prefix}-conversion-forwarder"
  role             = aws_iam_role.conversion_forwarder.arn
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  timeout          = 30
  memory_size      = 256
  filename         = "${path.module}/.build/conversion-forwarder.zip"
  source_code_hash = filebase64sha256("${path.module}/.build/conversion-forwarder.zip")
  # Hedef endpoint'leri env ile; boşsa ilgili hedef no-op (FAZ 2 güvenli başlangıç).
  environment {
    variables = {
      GOOGLE_ADS_CONVERSION_URL    = ""
      GOOGLE_ADS_CONVERSION_ACTION = ""
      META_CAPI_URL                = ""
      GA4_MP_URL                   = ""
    }
  }
  dead_letter_config {
    target_arn = aws_sqs_queue.conversion_forwarder_dlq.arn
  }
  depends_on = [aws_iam_role_policy.conversion_forwarder, aws_cloudwatch_log_group.conversion_forwarder]
  tags       = { Environment = "prod", Project = "mapsbridge", Workload = "billing" }
}

# SNS → Lambda subscription
resource "aws_sns_topic_subscription" "conversion_forwarder" {
  topic_arn = aws_sns_topic.billing_conversions.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.conversion_forwarder.arn
}
resource "aws_lambda_permission" "conversion_forwarder_sns" {
  statement_id  = "AllowSNSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.conversion_forwarder.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.billing_conversions.arn
}

# Alarm: DLQ'ya mesaj düşerse (kalıcı conversion başarısızlığı)
resource "aws_cloudwatch_metric_alarm" "conversion_forwarder_dlq" {
  alarm_name          = "${var.prefix}-conversion-forwarder-dlq"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Conversion forwarder DLQ'ya mesaj düştü — bir reklam hedefi kalıcı başarısız."
  dimensions          = { QueueName = aws_sqs_queue.conversion_forwarder_dlq.name }
  treat_missing_data  = "notBreaching"
}

output "billing_conversions_topic_arn" {
  value       = aws_sns_topic.billing_conversions.arn
  description = "RevenueCat webhook'un conversion event yayınladığı SNS topic."
}
