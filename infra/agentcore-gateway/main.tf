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
      Stack       = "agentcore-gateway"
    }
  }
}
variable "region" {
  type    = string
  default = "eu-central-1"
}
variable "account_id" { type = string }
variable "prefix" { type = string }
variable "ai_role_name" { type = string }
variable "alarm_topic_arn" {
  type        = string
  default     = ""
  description = "Existing SNS topic for operational alerts."
}
resource "aws_cloudwatch_log_group" "tools" {
  name              = "/aws/lambda/${var.prefix}-agentcore-places"
  retention_in_days = 30
}
resource "aws_iam_role" "tools" {
  name               = "${var.prefix}-agentcore-places"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy" "tools" {
  role = aws_iam_role.tools.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.tools.arn}:*" },
    { Effect = "Allow", Action = ["geo-places:Geocode", "geo-places:SearchText"], Resource = "arn:aws:geo-places:${var.region}::provider/default" }
  ] })
}
resource "aws_lambda_function" "tools" {
  function_name    = "${var.prefix}-agentcore-places"
  role             = aws_iam_role.tools.arn
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  timeout          = 8
  memory_size      = 256
  filename         = "${path.module}/.build/tools.zip"
  source_code_hash = filebase64sha256("${path.module}/.build/tools.zip")
  environment { variables = { PLACE_RESEARCH_ENABLED = "true" } }
  depends_on = [aws_iam_role_policy.tools, aws_cloudwatch_log_group.tools]
}

# ─── Data Tools Lambda (flights + advisory) ───────────────────────────────────
resource "aws_cloudwatch_log_group" "data_tools" {
  name              = "/aws/lambda/${var.prefix}-agentcore-data"
  retention_in_days = 30
}
resource "aws_iam_role" "data_tools" {
  name               = "${var.prefix}-agentcore-data"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy" "data_tools" {
  role = aws_iam_role.data_tools.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.data_tools.arn}:*" },
    { Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:${var.prefix}/travelpayouts*" }
  ] })
}
resource "aws_lambda_function" "data_tools" {
  function_name    = "${var.prefix}-agentcore-data"
  role             = aws_iam_role.data_tools.arn
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  timeout          = 10
  memory_size      = 256
  filename         = "${path.module}/.build/data-tools.zip"
  source_code_hash = filebase64sha256("${path.module}/.build/data-tools.zip")
  environment {
    variables = {
      TRAVELPAYOUTS_TOKEN  = var.travelpayouts_token
      TRAVELPAYOUTS_MARKER = var.travelpayouts_marker
    }
  }
  depends_on = [aws_iam_role_policy.data_tools, aws_cloudwatch_log_group.data_tools]
}

variable "travelpayouts_token" {
  type        = string
  default     = ""
  description = "Travelpayouts API token — set in terraform.tfvars, never hardcode."
  sensitive   = true
}
variable "travelpayouts_marker" {
  type    = string
  default = ""
  description = "Travelpayouts affiliate marker for deep links."
}
resource "aws_iam_role" "gateway" {
  name = "${var.prefix}-agentcore-gateway"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect    = "Allow", Principal = { Service = "bedrock-agentcore.amazonaws.com" }, Action = "sts:AssumeRole",
    Condition = { StringEquals = { "aws:SourceAccount" = var.account_id }, ArnLike = { "aws:SourceArn" = "arn:aws:bedrock-agentcore:${var.region}:${var.account_id}:gateway/*" } }
  }] })
}
resource "aws_iam_role_policy" "gateway" {
  role   = aws_iam_role.gateway.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["lambda:InvokeFunction"], Resource = aws_lambda_function.tools.arn },
    { Effect = "Allow", Action = ["lambda:InvokeFunction"], Resource = aws_lambda_function.data_tools.arn }
  ] })
}
resource "aws_bedrockagentcore_gateway" "travel" {
  name            = "${var.prefix}-travel-tools"
  role_arn        = aws_iam_role.gateway.arn
  authorizer_type = "AWS_IAM"
  protocol_type   = "MCP"
  protocol_configuration {
    mcp { supported_versions = ["2025-03-26", "2025-06-18", "2025-11-25"] }
  }
  depends_on = [aws_iam_role_policy.gateway]
}
resource "aws_bedrockagentcore_gateway_target" "travel" {
  name               = "travel"
  gateway_identifier = aws_bedrockagentcore_gateway.travel.gateway_id
  credential_provider_configuration {
    gateway_iam_role {}
  }
  target_configuration {
    mcp {
      lambda {
        lambda_arn = aws_lambda_function.tools.arn
        tool_schema {
          inline_payload {
            name        = "research_places"
            description = "Research actual points of interest by city. Up to three searches and thirty results. No live prices or opening hours."
            input_schema {
              type = "object"
              property {
                name     = "destination"
                type     = "string"
                required = true
              }
              property {
                name     = "queries"
                type     = "array"
                required = true
                items { type = "string" }
              }
            }
          }
        }
      }
    }
  }
}
resource "aws_bedrockagentcore_gateway_target" "flights" {
  name               = "flights"
  gateway_identifier = aws_bedrockagentcore_gateway.travel.gateway_id
  credential_provider_configuration {
    gateway_iam_role {}
  }
  target_configuration {
    mcp {
      lambda {
        lambda_arn = aws_lambda_function.data_tools.arn
        tool_schema {
          inline_payload {
            name        = "search_flights"
            description = "Travelpayouts önbelleğindeki ucuz uçuş fiyatlarını döndürür. Sonuçlar 2-7 gün bayat olabilir; expires_at alanına uy, süresi geçmiş fiyatları gösterme. Kesin fiyat değil yönlendirme amaçlıdır."
            input_schema {
              type = "object"
              property {
                name     = "destination"
                type     = "string"
                required = true
              }
              property {
                name     = "origin"
                type     = "string"
                required = false
              }
              property {
                name     = "currency"
                type     = "string"
                required = false
              }
            }
          }
        }
      }
    }
  }
}
resource "aws_bedrockagentcore_gateway_target" "advisory" {
  name               = "advisory"
  gateway_identifier = aws_bedrockagentcore_gateway.travel.gateway_id
  credential_provider_configuration {
    gateway_iam_role {}
  }
  target_configuration {
    mcp {
      lambda {
        lambda_arn = aws_lambda_function.data_tools.arn
        tool_schema {
          inline_payload {
            name        = "get_advisory"
            description = "FCDO UK seyahat tavsiyesini çeker (bedava, değiştirilemez kayıt). Tavsiye düzeyi, özet ve change_history içerir. Planlama amaçlıdır; koşulsuz 'gidebilirsin' çıktısı verme."
            input_schema {
              type = "object"
              property {
                name     = "destination"
                type     = "string"
                required = true
              }
              property {
                name     = "country_slug"
                type     = "string"
                required = false
              }
            }
          }
        }
      }
    }
  }
}

resource "aws_iam_role_policy" "caller" {
  name   = "travel-agentcore-gateway"
  role   = var.ai_role_name
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["bedrock-agentcore:InvokeGateway"], Resource = aws_bedrockagentcore_gateway.travel.gateway_arn }] })
}
resource "aws_cloudwatch_metric_alarm" "tool_errors" {
  alarm_name          = "${var.prefix}-agentcore-tool-errors"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = aws_lambda_function.tools.function_name }
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_topic_arn == "" ? [] : [var.alarm_topic_arn]
}
resource "aws_cloudwatch_metric_alarm" "data_tool_errors" {
  alarm_name          = "${var.prefix}-agentcore-data-errors"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = aws_lambda_function.data_tools.function_name }
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_topic_arn == "" ? [] : [var.alarm_topic_arn]
}

output "ai_gateway_environment" {
  value = {
    AGENTCORE_GATEWAY_URL       = aws_bedrockagentcore_gateway.travel.gateway_url
    AGENTCORE_PLACES_TOOL       = "travel___research_places"
    AGENTCORE_FLIGHT_TOOL       = "flights___search_flights"
    AGENTCORE_ADVISORY_TOOL     = "advisory___get_advisory"
  }
  depends_on = [aws_bedrockagentcore_gateway_target.travel, aws_bedrockagentcore_gateway_target.flights, aws_bedrockagentcore_gateway_target.advisory, aws_iam_role_policy.caller]
}

resource "aws_resourcegroups_group" "stack" {
  name = "${var.prefix}-agentcore-gateway"
  resource_query {
    query = jsonencode({
      ResourceTypeFilters = ["AWS::AllSupported"]
      TagFilters          = [{ Key = "Stack", Values = ["agentcore-gateway"] }]
    })
  }
}
