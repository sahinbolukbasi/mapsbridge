# RAG Fill Agent — scheduled Lambda
# Generates travel briefings via Claude Haiku, uploads to S3, triggers KB ingestion.
# Runs daily at 03:00 UTC; force-refresh available via manual Lambda invoke.
#
# NOT: Bu fonksiyon gerçek derlenmiş kod gerektirir. CI bu stack'i placeholder
# zip'lerle derlediği için, rag-fill'i placeholder ile OLUŞTURMAK bozuk bir cron
# Lambda'sı yaratır. Bu yüzden oluşturulması `enable_rag_fill` ile kapatıldı
# (varsayılan: false). Route onarımı apply'ı yalnızca API Gateway'i tamir eder;
# rag-fill gerçek kod hazır olduğunda ayrı ve bilinçli bir adımla açılır.

variable "enable_rag_fill" {
  type        = bool
  default     = false
  description = "RAG-fill scheduled Lambda'sını oluştur. Gerçek derlenmiş kod hazır olduğunda true yap."
}

resource "aws_lambda_function" "rag_fill" {
  count            = var.enable_rag_fill ? 1 : 0
  function_name    = "${var.prefix}-rag-fill"
  role             = aws_iam_role.rag_fill[0].arn
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  timeout          = 300
  memory_size      = 256
  filename         = "${path.module}/.build/rag-fill.zip"
  source_code_hash = filebase64sha256("${path.module}/.build/rag-fill.zip")
  tags             = { Workload = "travel-ai", Component = "knowledge" }
  environment {
    variables = {
      ENVIRONMENT       = "prod"
      SOURCE_BUCKET     = var.kb_source_bucket
      KNOWLEDGE_BASE_ID = var.travel_knowledge_base_id
      DATA_SOURCE_ID    = var.kb_data_source_id
      BEDROCK_REGION    = var.region
      FILL_MODEL_ID     = "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
      DRY_RUN           = "false"
    }
  }
  depends_on = [aws_iam_role_policy.rag_fill, aws_iam_role_policy_attachment.rag_fill_logs]
}

resource "aws_iam_role" "rag_fill" {
  count = var.enable_rag_fill ? 1 : 0
  name  = "${var.prefix}-rag-fill-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rag_fill_logs" {
  count      = var.enable_rag_fill ? 1 : 0
  role       = aws_iam_role.rag_fill[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "rag_fill" {
  count = var.enable_rag_fill ? 1 : 0
  name  = "rag-fill-permissions"
  role  = aws_iam_role.rag_fill[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
        ]
        Resource = [
          "arn:aws:bedrock:${var.region}:${var.account_id}:inference-profile/eu.anthropic.claude-haiku-4-5-20251001-v1:0",
          "arn:aws:bedrock:${var.region}::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
          "arn:aws:bedrock:eu-west-1::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
          "arn:aws:bedrock:eu-west-3::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
          "arn:aws:bedrock:eu-north-1::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
        ]
      },
      {
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:GetObject", "s3:HeadObject", "s3:ListBucket"]
        Resource = [
          "arn:aws:s3:::${var.kb_source_bucket}",
          "arn:aws:s3:::${var.kb_source_bucket}/published/*",
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["bedrock:StartIngestionJob", "bedrock:GetIngestionJob"]
        Resource = "arn:aws:bedrock:${var.region}:${var.account_id}:knowledge-base/${var.travel_knowledge_base_id}"
      },
    ]
  })
}

# Daily schedule at 03:00 UTC
resource "aws_cloudwatch_event_rule" "rag_fill_daily" {
  count               = var.enable_rag_fill ? 1 : 0
  name                = "${var.prefix}-rag-fill-daily"
  description         = "Daily RAG KB refresh"
  schedule_expression = "cron(0 3 * * ? *)"
}

resource "aws_cloudwatch_event_target" "rag_fill_daily" {
  count     = var.enable_rag_fill ? 1 : 0
  rule      = aws_cloudwatch_event_rule.rag_fill_daily[0].name
  target_id = "rag-fill"
  arn       = aws_lambda_function.rag_fill[0].arn
  input     = jsonencode({ force = false })
}

resource "aws_lambda_permission" "rag_fill_events" {
  count         = var.enable_rag_fill ? 1 : 0
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.rag_fill[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.rag_fill_daily[0].arn
}

output "rag_fill_lambda_name" {
  value       = var.enable_rag_fill ? aws_lambda_function.rag_fill[0].function_name : ""
  description = "Invoke manually: aws lambda invoke --function-name <name> --payload '{\"force\":true}' /tmp/out.json"
}
