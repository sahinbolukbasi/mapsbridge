terraform {
  required_version = ">= 1.9"
  required_providers { aws = { source = "hashicorp/aws", version = "~> 6.0" } }
}
provider "aws" {
  region              = var.region
  allowed_account_ids = [var.account_id]
  default_tags {
    tags = {
      Project     = "mapsbridge"
      Environment = "prod"
      ManagedBy   = "terraform"
      Stack       = "ai-memory"
    }
  }
}
variable "region" {
  type    = string
  default = "eu-central-1"
}
variable "account_id" { type = string }
variable "prefix" { type = string }
variable "api_id" { type = string }
variable "application_table" { type = string }
variable "ai_role_name" { type = string }
variable "cognito_pool_id" { type = string }
variable "cognito_client_id" { type = string }
locals {
  app_table_arn = "arn:aws:dynamodb:${var.region}:${var.account_id}:table/${var.application_table}"
  functions     = toset(["control", "worker"])
  environment = {
    AI_MEMORY_TABLE      = aws_dynamodb_table.memory.name
    AGENTCORE_MEMORY_ID  = aws_bedrockagentcore_memory.travel.id
    DYNAMODB_TABLE       = var.application_table
    COGNITO_USER_POOL_ID = var.cognito_pool_id
    COGNITO_CLIENT_ID    = var.cognito_client_id
    MEMORY_READ_ENABLED  = "true"
    MEMORY_WRITE_ENABLED = "true"
  }
}
resource "aws_bedrockagentcore_memory" "travel" {
  name                  = replace("${var.prefix}_travel_memory", "-", "_")
  description           = "Consented travel preferences and bounded trip summaries"
  event_expiry_duration = 30
  lifecycle { prevent_destroy = true }
}
resource "aws_bedrockagentcore_memory_strategy" "preferences" {
  name                = "TravelPreferences"
  memory_id           = aws_bedrockagentcore_memory.travel.id
  type                = "USER_PREFERENCE"
  namespace_templates = ["/users/{actorId}/preferences/"]
}
resource "aws_bedrockagentcore_memory_strategy" "summaries" {
  name                = "TripSummaries"
  memory_id           = aws_bedrockagentcore_memory.travel.id
  type                = "SUMMARIZATION"
  namespace_templates = ["/users/{actorId}/summaries/{sessionId}/"]
}
resource "aws_dynamodb_table" "memory" {
  name                        = "${var.prefix}-ai-memory"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "PK"
  range_key                   = "SK"
  stream_enabled              = true
  stream_view_type            = "NEW_IMAGE"
  deletion_protection_enabled = true
  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
  server_side_encryption { enabled = true }
  point_in_time_recovery { enabled = true }
  lifecycle { prevent_destroy = true }
}
resource "aws_sqs_queue" "failures" {
  name                      = "${var.prefix}-ai-memory-failures"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
}
resource "aws_cloudwatch_log_group" "memory" {
  for_each          = local.functions
  name              = "/aws/lambda/${var.prefix}-ai-memory-${each.key}"
  retention_in_days = 30
}
resource "aws_iam_role" "memory" {
  for_each           = local.functions
  name               = "${var.prefix}-ai-memory-${each.key}"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy" "memory" {
  for_each = local.functions
  role     = aws_iam_role.memory[each.key].id
  policy = jsonencode({ Version = "2012-10-17", Statement = concat([
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.memory[each.key].arn}:*" },
    { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:TransactWriteItems"], Resource = [aws_dynamodb_table.memory.arn, local.app_table_arn] },
    { Effect = "Allow", Action = each.key == "control" ? ["bedrock-agentcore:RetrieveMemoryRecords"] : ["bedrock-agentcore:CreateEvent", "bedrock-agentcore:ListSessions", "bedrock-agentcore:ListEvents", "bedrock-agentcore:DeleteEvent", "bedrock-agentcore:ListMemoryRecords", "bedrock-agentcore:DeleteMemoryRecord"], Resource = aws_bedrockagentcore_memory.travel.arn }
    ], each.key == "worker" ? [
    { Effect = "Allow", Action = ["dynamodb:Scan"], Resource = aws_dynamodb_table.memory.arn },
    { Effect = "Allow", Action = ["dynamodb:DescribeStream", "dynamodb:GetRecords", "dynamodb:GetShardIterator", "dynamodb:ListStreams"], Resource = aws_dynamodb_table.memory.stream_arn },
    { Effect = "Allow", Action = ["sqs:SendMessage"], Resource = aws_sqs_queue.failures.arn }
  ] : []) })
}
resource "aws_iam_role_policy" "existing_ai" {
  name = "travel-memory-access"
  role = var.ai_role_name
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:ConditionCheckItem", "dynamodb:TransactWriteItems"], Resource = aws_dynamodb_table.memory.arn },
    { Effect = "Allow", Action = ["bedrock-agentcore:RetrieveMemoryRecords"], Resource = aws_bedrockagentcore_memory.travel.arn }
  ] })
}
resource "aws_lambda_function" "memory" {
  for_each         = local.functions
  function_name    = "${var.prefix}-ai-memory-${each.key}"
  role             = aws_iam_role.memory[each.key].arn
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  filename         = "${path.module}/.build/${each.key}.zip"
  source_code_hash = filebase64sha256("${path.module}/.build/${each.key}.zip")
  timeout          = each.key == "worker" ? 120 : 15
  memory_size      = 256
  # Account quota currently leaves no capacity for reserved concurrency.
  # Stable event tokens and generation checks make concurrent deliveries safe.
  reserved_concurrent_executions = -1
  environment { variables = local.environment }
  depends_on = [aws_iam_role_policy.memory, aws_cloudwatch_log_group.memory]
}
resource "aws_lambda_event_source_mapping" "outbox" {
  event_source_arn               = aws_dynamodb_table.memory.stream_arn
  function_name                  = aws_lambda_function.memory["worker"].arn
  starting_position              = "TRIM_HORIZON"
  batch_size                     = 5
  maximum_retry_attempts         = 3
  maximum_record_age_in_seconds  = 86400
  bisect_batch_on_function_error = true
  function_response_types        = ["ReportBatchItemFailures"]
  destination_config {
    on_failure { destination_arn = aws_sqs_queue.failures.arn }
  }
  filter_criteria {
    filter { pattern = jsonencode({ eventName = ["INSERT"], dynamodb = { NewImage = { status = { S = ["pending"] } } } }) }
  }
  depends_on = [aws_iam_role_policy.memory]
}
resource "aws_cloudwatch_event_rule" "sweep" {
  name                = "${var.prefix}-memory-reconcile"
  schedule_expression = "rate(1 hour)"
}
resource "aws_cloudwatch_event_target" "sweep" {
  rule = aws_cloudwatch_event_rule.sweep.name
  arn  = aws_lambda_function.memory["worker"].arn
}
resource "aws_lambda_permission" "sweep" {
  statement_id  = "MemoryReconcile"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.memory["worker"].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.sweep.arn
}
resource "aws_apigatewayv2_integration" "memory" {
  api_id                 = var.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.memory["control"].invoke_arn
  payload_format_version = "2.0"
}
resource "aws_apigatewayv2_route" "memory" {
  for_each  = toset(["GET /ai/memory", "PATCH /ai/memory", "DELETE /ai/memory", "GET /ai/memory/deletion-status", "PATCH /ai/memory/{id}", "DELETE /ai/memory/{id}"])
  api_id    = var.api_id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.memory.id}"
}
resource "aws_lambda_permission" "api" {
  statement_id  = "MemoryAPI"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.memory["control"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.region}:${var.account_id}:${var.api_id}/*/*/ai/memory*"
}
resource "aws_cloudwatch_metric_alarm" "failures" {
  alarm_name          = "${var.prefix}-memory-dlq"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  dimensions          = { QueueName = aws_sqs_queue.failures.name }
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  period              = 300
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
}
resource "aws_cloudwatch_dashboard" "memory" {
  dashboard_name = "${var.prefix}-ai-memory"
  dashboard_body = jsonencode({ widgets = [{ type = "metric", width = 12, height = 6, properties = {
    title = "Memory worker errors and backlog", region = var.region, metrics = [
      ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.memory["worker"].function_name],
      ["AWS/Lambda", "IteratorAge", "FunctionName", aws_lambda_function.memory["worker"].function_name],
      ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.failures.name]
    ], period = 300, stat = "Maximum"
  } }] })
}
output "ai_environment" { value = local.environment }

resource "aws_resourcegroups_group" "stack" {
  name = "${var.prefix}-ai-memory"
  resource_query {
    query = jsonencode({
      ResourceTypeFilters = ["AWS::AllSupported"]
      TagFilters          = [{ Key = "Stack", Values = ["ai-memory"] }]
    })
  }
}
