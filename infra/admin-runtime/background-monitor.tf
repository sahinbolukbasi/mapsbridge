# Background Monitor — checks FCDO advisory changes for active user trips every 6 hours.

resource "aws_cloudwatch_log_group" "monitor" {
  name              = "/aws/lambda/${var.prefix}-background-monitor"
  retention_in_days = 14
}

resource "aws_iam_role" "monitor" {
  name = "${var.prefix}-background-monitor"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy" "monitor" {
  role = aws_iam_role.monitor.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.monitor.arn}:*" },
      { Effect = "Allow", Action = ["dynamodb:Scan", "dynamodb:GetItem", "dynamodb:PutItem"], Resource = local.table_arn },
    ]
  })
}

resource "aws_lambda_function" "monitor" {
  function_name    = "${var.prefix}-background-monitor"
  role             = aws_iam_role.monitor.arn
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  timeout          = 120
  memory_size      = 256
  filename         = "${path.module}/.build/background-monitor.zip"
  source_code_hash = filebase64sha256("${path.module}/.build/background-monitor.zip")
  environment {
    variables = { DYNAMODB_TABLE = var.dynamodb_table }
  }
  depends_on = [aws_iam_role_policy.monitor, aws_cloudwatch_log_group.monitor]
  tags = { Environment = "prod", Project = "mapsbridge", Workload = "core-backend" }
}

resource "aws_iam_role" "monitor_scheduler" {
  name = "${var.prefix}-monitor-scheduler"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "scheduler.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy" "monitor_scheduler" {
  role = aws_iam_role.monitor_scheduler.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = "lambda:InvokeFunction", Resource = aws_lambda_function.monitor.arn }]
  })
}

resource "aws_scheduler_schedule" "monitor" {
  name       = "${var.prefix}-background-monitor"
  group_name = "default"
  flexible_time_window {
    mode                      = "FLEXIBLE"
    maximum_window_in_minutes = 30
  }
  schedule_expression = "rate(6 hours)"
  target {
    arn      = aws_lambda_function.monitor.arn
    role_arn = aws_iam_role.monitor_scheduler.arn
  }
}
