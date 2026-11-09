# Veri Hattı: EventBridge Scheduler + Step Functions + S3
# Conforms to docs/plans/agentcore-architecture.md Section 8.1 & 13

resource "aws_s3_bucket" "kb_raw_data" {
  count         = var.enable_bedrock ? 1 : 0
  bucket        = "${local.name}-kb-raw-data"
  force_destroy = false
  tags          = local.tags
}

resource "aws_s3_bucket_versioning" "kb_raw_data" {
  count  = var.enable_bedrock ? 1 : 0
  bucket = aws_s3_bucket.kb_raw_data[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "kb_raw_data" {
  count  = var.enable_bedrock ? 1 : 0
  bucket = aws_s3_bucket.kb_raw_data[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# EventBridge Scheduler for Weekly Knowledge Ingestion & Refresh
resource "aws_scheduler_schedule" "weekly_kb_refresh" {
  count = var.enable_bedrock ? 1 : 0

  name       = "${local.name}-weekly-kb-refresh"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = "cron(0 3 ? * SUN *)"

  target {
    arn      = aws_sfn_state_machine.kb_pipeline[0].arn
    role_arn = aws_iam_role.scheduler_role[0].arn
  }
}

# kb-ingest Lambda — reads DynamoDB training data + uploads to S3 published/ prefix
resource "aws_cloudwatch_log_group" "kb_ingest" {
  count             = var.enable_bedrock ? 1 : 0
  name              = "/aws/lambda/${local.name}-kb-ingest"
  retention_in_days = 30
  tags              = local.tags
}

resource "aws_iam_role" "kb_ingest" {
  count = var.enable_bedrock ? 1 : 0
  name  = "${local.name}-kb-ingest"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "kb_ingest" {
  count = var.enable_bedrock ? 1 : 0
  role  = aws_iam_role.kb_ingest[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.kb_ingest[0].arn}:*" },
      { Effect = "Allow", Action = ["dynamodb:Query", "dynamodb:Scan"], Resource = aws_dynamodb_table.data.arn },
      { Effect = "Allow", Action = ["s3:PutObject", "s3:ListBucket"], Resource = [aws_s3_bucket.kb_raw_data[0].arn, "${aws_s3_bucket.kb_raw_data[0].arn}/*"] },
      { Effect = "Allow", Action = ["bedrock:StartIngestionJob", "bedrock:GetIngestionJob"], Resource = "*" },
    ]
  })
}

resource "aws_lambda_function" "kb_ingest" {
  count            = var.enable_bedrock ? 1 : 0
  function_name    = "${local.name}-kb-ingest"
  role             = aws_iam_role.kb_ingest[0].arn
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  timeout          = 300
  memory_size      = 512
  filename         = "${path.module}/.build/lambdas/kb-ingest.zip"
  source_code_hash = filebase64sha256("${path.module}/.build/lambdas/kb-ingest.zip")
  environment {
    variables = {
      DYNAMODB_TABLE           = aws_dynamodb_table.data.name
      KB_RAW_BUCKET            = aws_s3_bucket.kb_raw_data[0].bucket
      TRAVEL_KNOWLEDGE_BASE_ID = var.travel_knowledge_base_id
      BEDROCK_REGION           = "eu-central-1"
    }
  }
  depends_on = [aws_iam_role_policy.kb_ingest, aws_cloudwatch_log_group.kb_ingest]
  tags       = local.tags
}

# Step Functions State Machine for Data Normalization & Bedrock Ingestion
resource "aws_sfn_state_machine" "kb_pipeline" {
  count = var.enable_bedrock ? 1 : 0

  name     = "${local.name}-kb-pipeline"
  role_arn = aws_iam_role.sfn_role[0].arn

  definition = jsonencode({
    Comment = "MapsBridge Knowledge Base Data Pipeline Orchestrator"
    StartAt = "CollectAndNormalizeData"
    States = {
      CollectAndNormalizeData = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.kb_ingest[0].arn
          Payload = {
            "action" = "collect"
          }
        }
        ResultPath = "$.collectResult"
        Retry = [{
          ErrorEquals     = ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException"]
          IntervalSeconds = 30
          MaxAttempts     = 2
          BackoffRate     = 2
        }]
        Next = "TriggerBedrockIngestion"
      }
      TriggerBedrockIngestion = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.kb_ingest[0].arn
          Payload = {
            "action" = "ingest"
          }
        }
        ResultPath = "$.ingestResult"
        Retry = [{
          ErrorEquals     = ["Lambda.ServiceException", "Lambda.AWSLambdaException"]
          IntervalSeconds = 60
          MaxAttempts     = 2
          BackoffRate     = 2
        }]
        End = true
      }
    }
  })

  tags = local.tags
}

resource "aws_iam_role" "scheduler_role" {
  count = var.enable_bedrock ? 1 : 0

  name = "${local.name}-scheduler-sfn-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.tags
}

resource "aws_iam_role" "sfn_role" {
  count = var.enable_bedrock ? 1 : 0

  name = "${local.name}-sfn-execution-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "states.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "sfn_invoke_lambda" {
  count = var.enable_bedrock ? 1 : 0
  name  = "invoke-kb-ingest"
  role  = aws_iam_role.sfn_role[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["lambda:InvokeFunction"]
      Resource = aws_lambda_function.kb_ingest[0].arn
    }]
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# KB TTL Freshness Worker (spec: bu-projede-olan-ai-chat, Faz 2 / görev 8+30)
# Bayat (expiresAt geçmiş) KB entity'lerini zamanlı olarak temizler ve tazelik
# metriklerini (MapsBridge/AI: KBScanned/KBPruned/KBOldestAgeSeconds/Heartbeat) yayar.
# Kaynak: infra/lambda/src/ai/kb-freshness-worker.ts (self-contained; apps/web importu yok).
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "kb_freshness" {
  count             = var.enable_bedrock ? 1 : 0
  name              = "/aws/lambda/${local.name}-kb-freshness"
  retention_in_days = 30
  tags              = local.tags
}

resource "aws_iam_role" "kb_freshness" {
  count = var.enable_bedrock ? 1 : 0
  name  = "${local.name}-kb-freshness"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "kb_freshness" {
  count = var.enable_bedrock ? 1 : 0
  role  = aws_iam_role.kb_freshness[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.kb_freshness[0].arn}:*" },
      # Scan (SK=META, kind=entity süzgeci) + kaskad silme (Query + DeleteItem). PutItem GEREKMEZ.
      { Effect = "Allow", Action = ["dynamodb:Scan", "dynamodb:Query", "dynamodb:DeleteItem"], Resource = aws_dynamodb_table.data.arn },
    ]
  })
}

resource "aws_lambda_function" "kb_freshness" {
  count            = var.enable_bedrock ? 1 : 0
  function_name    = "${local.name}-kb-freshness"
  role             = aws_iam_role.kb_freshness[0].arn
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  timeout          = 300
  memory_size      = 256
  filename         = "${path.module}/.build/lambdas/kb-freshness.zip"
  source_code_hash = filebase64sha256("${path.module}/.build/lambdas/kb-freshness.zip")
  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.data.name
    }
  }
  depends_on = [aws_iam_role_policy.kb_freshness, aws_cloudwatch_log_group.kb_freshness]
  tags       = local.tags
}

# Scheduler → Lambda invoke rolü (kb_ingest'in sfn rolünden ayrı; bu doğrudan lambda hedefler)
resource "aws_iam_role" "scheduler_kb_freshness" {
  count = var.enable_bedrock ? 1 : 0
  name  = "${local.name}-scheduler-kb-freshness"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "scheduler.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "scheduler_kb_freshness" {
  count = var.enable_bedrock ? 1 : 0
  name  = "invoke-kb-freshness"
  role  = aws_iam_role.scheduler_kb_freshness[0].id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = ["lambda:InvokeFunction"], Resource = aws_lambda_function.kb_freshness[0].arn }]
  })
}

# Günlük TTL temizliği — weekly_kb_refresh'ten (Pazar 03:00) bir saat sonra, her gün.
# Worker bounded batch (100/çağrı, hasMore); büyük tablolar birkaç güne yayılarak temizlenir.
resource "aws_scheduler_schedule" "daily_kb_freshness" {
  count      = var.enable_bedrock ? 1 : 0
  name       = "${local.name}-daily-kb-freshness"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = "cron(0 4 * * ? *)"

  target {
    arn      = aws_lambda_function.kb_freshness[0].arn
    role_arn = aws_iam_role.scheduler_kb_freshness[0].arn
  }
}
