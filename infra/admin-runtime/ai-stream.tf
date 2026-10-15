# AI Streaming Lambda — Lambda Function URL with InvokeMode=RESPONSE_STREAM
# Same code as the ai Lambda; separate function so the handler can be index.streamHandler.

resource "aws_lambda_function" "ai_stream" {
  function_name    = "${var.prefix}-ai-stream"
  role             = aws_iam_role.domain["ai"].arn
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  handler          = "index.streamHandler"
  timeout          = 30
  memory_size      = 256
  filename         = "${path.module}/.build/ai.zip"
  source_code_hash = filebase64sha256("${path.module}/.build/ai.zip")
  tags             = { Environment = "prod", Project = "mapsbridge", Workload = "travel-ai" }
  environment {
    variables = merge(
      { ENVIRONMENT = "prod", DYNAMODB_TABLE = var.dynamodb_table, COGNITO_USER_POOL_ID = var.cognito_user_pool_id, COGNITO_CLIENT_ID = var.cognito_client_id },
      { BEDROCK_MODEL_ID = "eu.anthropic.claude-haiku-4-5-20251001-v1:0", AI_DAILY_REQUEST_LIMIT = "200", TRAVEL_KNOWLEDGE_BASE_ID = var.travel_knowledge_base_id, PLACE_RESEARCH_ENABLED = "true" },
      var.ai_memory_environment,
      var.ai_gateway_environment,
      { AI_TRAINING_COLLECTION_ENABLED = tostring(var.ai_training_collection_enabled) },
      var.ai_finops_environment,
    )
  }
  depends_on = [aws_iam_role_policy.data["ai"], aws_iam_role_policy_attachment.logs["ai"]]
}

resource "aws_lambda_function_url" "ai_stream" {
  function_name      = aws_lambda_function.ai_stream.function_name
  authorization_type = "AWS_IAM"
  invoke_mode        = "RESPONSE_STREAM"
  cors {
    allow_credentials = true
    allow_origins     = [var.frontend_origin, "http://localhost:3000"]
    allow_methods     = ["POST"]
    allow_headers     = ["content-type", "authorization", "x-amz-date", "x-amz-security-token"]
    max_age           = 300
  }
}

output "ai_stream_function_url" {
  value       = aws_lambda_function_url.ai_stream.function_url
  description = "Lambda Function URL for SSE-streaming AI responses. Set as NEXT_PUBLIC_AI_STREAM_URL at web build time."
}
