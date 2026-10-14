terraform {
  required_version = ">= 1.9"
  required_providers { aws = { source = "hashicorp/aws", version = "~> 6.0" } }
}
variable "region" { default = "eu-central-1" }
variable "account_id" { type = string }
variable "prefix" { type = string }
variable "table_name" { type = string }
variable "alarm_topic_arn" { default = "" }
provider "aws" {
  region              = var.region
  allowed_account_ids = [var.account_id]
  default_tags { tags = { Project = "adreskopru", Component = "ai-training" } }
}
locals {
  name      = "${var.prefix}-training-worker"
  table_arn = "arn:aws:dynamodb:${var.region}:${var.account_id}:table/${var.table_name}"
}
resource "aws_s3_bucket" "quarantine" {
  bucket = "${var.prefix}-training-${var.account_id}"
  lifecycle { prevent_destroy = true }
}
resource "aws_s3_bucket_public_access_block" "quarantine" {
  bucket                  = aws_s3_bucket.quarantine.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_versioning" "quarantine" {
  bucket = aws_s3_bucket.quarantine.id
  versioning_configuration { status = "Enabled" }
}
resource "aws_s3_bucket_server_side_encryption_configuration" "quarantine" {
  bucket = aws_s3_bucket.quarantine.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}
resource "aws_s3_bucket_policy" "tls" {
  bucket = aws_s3_bucket.quarantine.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect    = "Deny", Principal = "*", Action = "s3:*",
    Resource  = [aws_s3_bucket.quarantine.arn, "${aws_s3_bucket.quarantine.arn}/*"],
    Condition = { Bool = { "aws:SecureTransport" = "false" } }
  }] })
}
resource "aws_s3_bucket_lifecycle_configuration" "quarantine" {
  bucket = aws_s3_bucket.quarantine.id
  # Up to seven days in the queue + 22 days current + one day noncurrent.
  rule {
    id     = "review-retention"
    status = "Enabled"
    filter { prefix = "quarantine/" }
    expiration { days = 22 }
    noncurrent_version_expiration { noncurrent_days = 1 }
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
  }
  depends_on = [aws_s3_bucket_versioning.quarantine]
}
resource "aws_cloudwatch_log_group" "worker" {
  name              = "/aws/lambda/${local.name}"
  retention_in_days = 30
}
resource "aws_iam_role" "worker" {
  name               = local.name
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy" "worker" {
  role = aws_iam_role.worker.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["dynamodb:Query", "dynamodb:DeleteItem"], Resource = local.table_arn,
    Condition = { "ForAllValues:StringEquals" = { "dynamodb:LeadingKeys" = ["AI#TRAINING_PENDING"] } } },
    { Effect = "Allow", Action = ["s3:PutObject"], Resource = "${aws_s3_bucket.quarantine.arn}/quarantine/*" },
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.worker.arn}:*" }
  ] })
}
resource "aws_lambda_function" "worker" {
  function_name    = local.name
  role             = aws_iam_role.worker.arn
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  timeout          = 60
  memory_size      = 256
  filename         = "${path.module}/.build/worker.zip"
  source_code_hash = filebase64sha256("${path.module}/.build/worker.zip")
  environment { variables = { DYNAMODB_TABLE = var.table_name, AI_TRAINING_BUCKET = aws_s3_bucket.quarantine.id } }
  depends_on = [aws_iam_role_policy.worker, aws_cloudwatch_log_group.worker]
}
resource "aws_cloudwatch_event_rule" "worker" {
  name                = local.name
  schedule_expression = "rate(5 minutes)"
}
resource "aws_cloudwatch_event_target" "worker" {
  rule = aws_cloudwatch_event_rule.worker.name
  arn  = aws_lambda_function.worker.arn
}
resource "aws_lambda_permission" "schedule" {
  statement_id  = "AllowTrainingSchedule"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.worker.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.worker.arn
}
resource "aws_cloudwatch_metric_alarm" "failure" {
  alarm_name          = "${local.name}-errors"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = local.name }
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_topic_arn == "" ? [] : [var.alarm_topic_arn]
}
resource "aws_cloudwatch_metric_alarm" "backlog" {
  alarm_name          = "${local.name}-backlog"
  namespace           = "MapsBridge/Training"
  metric_name         = "OldestPendingAgeSeconds"
  dimensions          = { Service = "training-worker" }
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  period              = 300
  statistic           = "Maximum"
  threshold           = 3600
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_topic_arn == "" ? [] : [var.alarm_topic_arn]
}
resource "aws_cloudwatch_metric_alarm" "heartbeat" {
  alarm_name          = "${local.name}-heartbeat"
  namespace           = "MapsBridge/Training"
  metric_name         = "Heartbeat"
  dimensions          = { Service = "training-worker" }
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "breaching"
  alarm_actions       = var.alarm_topic_arn == "" ? [] : [var.alarm_topic_arn]
}
resource "aws_cloudwatch_dashboard" "training" {
  dashboard_name = local.name
  dashboard_body = jsonencode({ widgets = [{ type = "metric", width = 24, height = 6, properties = {
    title   = "Training quarantine exports", region = var.region, period = 300, stat = "Sum",
    metrics = [["MapsBridge/Training", "Exported", "Service", "training-worker"], [".", "Failed", ".", "."], [".", "Heartbeat", ".", "."]]
    } }, { type = "metric", width = 24, height = 6, properties = {
    title   = "Oldest pending age (seconds)", region = var.region, period = 300, stat = "Maximum",
    metrics = [["MapsBridge/Training", "OldestPendingAgeSeconds", "Service", "training-worker"]]
  } }] })
}
output "training_bucket" { value = aws_s3_bucket.quarantine.id }
output "worker_name" { value = aws_lambda_function.worker.function_name }
