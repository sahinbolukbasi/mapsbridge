# Billing Reconciliation — RevenueCat ile DynamoDB entitlement'larını günlük
# karşılaştırır (webhook kaybına güvence). Desen: background-monitor.tf.
resource "aws_cloudwatch_log_group" "billing_reconcile" {
  name              = "/aws/lambda/${var.prefix}-billing-reconcile"
  retention_in_days = 30
}

resource "aws_iam_role" "billing_reconcile" {
  name = "${var.prefix}-billing-reconcile"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

# Least privilege: yalnızca ana tabloya okuma/yazma + RC API secret okuma + log.
resource "aws_iam_role_policy" "billing_reconcile" {
  role = aws_iam_role.billing_reconcile.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.billing_reconcile.arn}:*" },
      { Effect = "Allow", Action = ["dynamodb:Scan", "dynamodb:GetItem", "dynamodb:UpdateItem"], Resource = local.table_arn },
      { Effect = "Allow", Action = ["ssm:GetParameter"], Resource = "arn:aws:ssm:${var.region}:${var.account_id}:parameter/${var.prefix}/revenuecat/*" },
    ]
  })
}

resource "aws_lambda_function" "billing_reconcile" {
  function_name    = "${var.prefix}-billing-reconcile"
  role             = aws_iam_role.billing_reconcile.arn
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  timeout          = 300
  memory_size      = 256
  filename         = "${path.module}/.build/billing-reconcile.zip"
  source_code_hash = filebase64sha256("${path.module}/.build/billing-reconcile.zip")
  environment {
    variables = {
      DYNAMODB_TABLE    = var.dynamodb_table
      RC_SECRET_API_KEY = "secret:/${var.prefix}/revenuecat/api-key"
    }
  }
  depends_on = [aws_iam_role_policy.billing_reconcile, aws_cloudwatch_log_group.billing_reconcile]
  tags       = { Environment = "prod", Project = "mapsbridge", Workload = "billing" }
}


# Günlük schedule
resource "aws_iam_role" "billing_reconcile_scheduler" {
  name = "${var.prefix}-billing-reconcile-scheduler"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "scheduler.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}
resource "aws_iam_role_policy" "billing_reconcile_scheduler" {
  role = aws_iam_role.billing_reconcile_scheduler.id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = "lambda:InvokeFunction", Resource = aws_lambda_function.billing_reconcile.arn }]
  })
}
resource "aws_scheduler_schedule" "billing_reconcile" {
  name       = "${var.prefix}-billing-reconcile"
  group_name = "default"
  flexible_time_window {
    mode                      = "FLEXIBLE"
    maximum_window_in_minutes = 60
  }
  schedule_expression = "rate(24 hours)"
  target {
    arn      = aws_lambda_function.billing_reconcile.arn
    role_arn = aws_iam_role.billing_reconcile_scheduler.arn
  }
}

# ── Alarmlar ────────────────────────────────────────────────────────────────
# Reconcile başarısız kullanıcı sayısı yüksekse (webhook+reconcile ikisi de kaçırıyor)
resource "aws_cloudwatch_metric_alarm" "billing_reconcile_failures" {
  alarm_name          = "${var.prefix}-billing-reconcile-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Failed"
  namespace           = "MapsBridge/Billing"
  period              = 86400
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Billing reconcile 24 saatte 5'ten fazla kullanıcıda başarısız (RC API ya da veri sorunu)."
  treat_missing_data  = "notBreaching"
}
# Reconcile hiç çalışmadı (heartbeat yok) → schedule/Lambda sorunu
resource "aws_cloudwatch_metric_alarm" "billing_reconcile_heartbeat" {
  alarm_name          = "${var.prefix}-billing-reconcile-missing"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Heartbeat"
  namespace           = "MapsBridge/Billing"
  period              = 172800 # 48s içinde en az 1 kez çalışmalı
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Billing reconcile 48 saattir çalışmadı — EventBridge/Lambda sorunu olabilir."
  treat_missing_data  = "breaching"
}

output "billing_reconcile_function" {
  value       = aws_lambda_function.billing_reconcile.function_name
  description = "Billing reconciliation Lambda (günlük, webhook kaybına güvence)."
}
