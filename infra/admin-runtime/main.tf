terraform {
  required_version = ">= 1.9.0"
  required_providers { aws = { source = "hashicorp/aws", version = "~> 5.76" } }
}
provider "aws" {
  region              = var.region
  allowed_account_ids = [var.account_id]

  default_tags {
    tags = {
      Project     = "mapsbridge"
      Environment = "prod"
      ManagedBy   = "terraform"
      Stack       = "admin-runtime"
    }
  }
}

variable "region" {
  type    = string
  default = "eu-central-1"
}
variable "account_id" { type = string }
variable "prefix" { type = string }
variable "api_id" {
  type        = string
  description = "Existing API Gateway HTTP API ID"
}
variable "dynamodb_table" {
  type        = string
  description = "Main application DynamoDB table name"
}
variable "cognito_user_pool_id" {
  type        = string
  description = "Cognito User Pool ID"
}
variable "cognito_client_id" {
  type        = string
  description = "Cognito User Pool Client ID"
}
variable "frontend_origin" {
  type        = string
  default     = "https://mapsbridge.com"
  description = "Frontend origin for CORS and Stripe redirects"
}
variable "protected_admin_sub" {
  type        = string
  default     = ""
  description = "Cognito sub of the protected admin user (cannot be demoted)"
}
variable "slack_admin_user_ids" {
  type        = string
  default     = ""
  description = "Comma-separated Slack user IDs allowed to run deploy/rollback (empty = all authorized users)"
}
variable "deploy_targets" {
  type        = string
  default     = "{}"
  description = "JSON map of Slack bot deploy targets, e.g. {\"api\":{\"type\":\"lambda\",\"name\":\"mapsbridge-prod-routes\"}}"
}

locals {
  group     = "mapsbridge-admin"
  table_arn = "arn:aws:dynamodb:${var.region}:${var.account_id}:table/${var.dynamodb_table}"
  pool_arn  = "arn:aws:cognito-idp:${var.region}:${var.account_id}:userpool/${var.cognito_user_pool_id}"
  domains   = toset(["admin", "routes", "operations", "ai", "stripe"])
  routes    = jsondecode(file("${path.module}/routes.json"))
}
resource "aws_cognito_user_group" "admins" {
  name         = local.group
  user_pool_id = var.cognito_user_pool_id
  description  = "MapsBridge administration; membership is managed by operators."
}
resource "aws_iam_role" "domain" {
  for_each           = local.domains
  name               = "${var.prefix}-${each.key}-runtime"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy_attachment" "logs" {
  for_each   = local.domains
  role       = aws_iam_role.domain[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
resource "aws_iam_role_policy" "data" {
  for_each = local.domains
  name     = "application-data"
  role     = aws_iam_role.domain[each.key].id
  policy = jsonencode({ Version = "2012-10-17", Statement = concat([
    { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query"], Resource = [local.table_arn] }
    ], each.key == "admin" ? [
    { Effect = "Allow", Action = ["dynamodb:Scan", "dynamodb:DescribeTable"], Resource = [local.table_arn] },
    { Effect = "Allow", Action = ["cognito-idp:AdminListGroupsForUser", "cognito-idp:ListUsers", "cognito-idp:AdminDisableUser", "cognito-idp:AdminEnableUser", "cognito-idp:AdminGetUser", "cognito-idp:AdminAddUserToGroup", "cognito-idp:AdminRemoveUserFromGroup", "cognito-idp:AdminUpdateUserAttributes", "cognito-idp:AdminDeleteUserAttributes", "cognito-idp:AdminUserGlobalSignOut"], Resource = [local.pool_arn] },
    { Effect = "Allow", Action = ["s3:ListBucket"], Resource = ["arn:aws:s3:::${var.prefix}-training-${var.account_id}"] },
    { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject"], Resource = ["arn:aws:s3:::${var.prefix}-training-${var.account_id}/*"] },
    { Effect = "Allow", Action = ["bedrock:CreateModelCustomizationJob", "bedrock:ListModelCustomizationJobs", "bedrock:GetModelCustomizationJob"], Resource = ["*"] }
    ] : [], contains(["admin", "operations", "ai", "stripe"], each.key) ? [
    { Effect = "Allow", Action = ["dynamodb:Scan", "dynamodb:TransactWriteItems"], Resource = [local.table_arn] }
    ] : [], each.key == "routes" ? [
    { Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = ["arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:mapsbridge/*"] },
    { Effect = "Allow", Action = ["ecs:UpdateService", "ecs:DescribeServices"], Resource = ["*"] },
    { Effect = "Allow", Action = ["logs:FilterLogEvents", "logs:GetLogEvents", "logs:DescribeLogGroups", "logs:DescribeLogStreams"], Resource = ["*"] },
    { Effect = "Allow", Action = ["lambda:PublishVersion", "lambda:GetFunctionConfiguration", "lambda:ListAliases", "lambda:UpdateAlias"], Resource = ["arn:aws:lambda:${var.region}:${var.account_id}:function:${var.prefix}-*"] }
    ] : [], each.key == "stripe" ? [{ Effect = "Allow", Action = ["ssm:GetParameter"], Resource = ["arn:aws:ssm:${var.region}:${var.account_id}:parameter/mapsbridge/prod/stripe/*"] }] : [], each.key == "ai" ? [
    { Effect = "Allow", Action = ["bedrock:InvokeModel"], Resource = ["arn:aws:bedrock:${var.region}:${var.account_id}:inference-profile/eu.anthropic.claude-haiku-4-5-20251001-v1:0", "arn:aws:bedrock:${var.region}::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0", "arn:aws:bedrock:eu-west-1::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0", "arn:aws:bedrock:eu-west-3::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0", "arn:aws:bedrock:eu-north-1::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0", "arn:aws:bedrock:eu-south-1::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0", "arn:aws:bedrock:eu-south-2::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0"] }
  ] : []) })
}
resource "aws_lambda_function" "domain" {
  for_each         = local.domains
  function_name    = "${var.prefix}-${each.key}"
  role             = aws_iam_role.domain[each.key].arn
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  timeout          = 30
  memory_size      = 256
  filename         = "${path.module}/.build/${each.key}.zip"
  source_code_hash = filebase64sha256("${path.module}/.build/${each.key}.zip")
  tags             = { Workload = each.key == "ai" ? "travel-ai" : "core-backend" }
  environment {
    variables = merge({ ENVIRONMENT = "prod", DYNAMODB_TABLE = var.dynamodb_table, COGNITO_USER_POOL_ID = var.cognito_user_pool_id, COGNITO_CLIENT_ID = var.cognito_client_id }, each.key == "admin" ? { ADMIN_GROUP_NAME = local.group, COGNITO_USER_MANAGEMENT = "true", MODERATOR_GROUP_NAME = "mapsbridge-moderator", SUPPORT_GROUP_NAME = "mapsbridge-support", PROTECTED_ADMIN_SUB = var.protected_admin_sub, AI_TRAINING_BUCKET = "${var.prefix}-training-${var.account_id}", BEDROCK_TRAINING_REGION = "us-east-1", BEDROCK_TRAINING_ROLE_ARN = "arn:aws:iam::${var.account_id}:role/${var.prefix}-bedrock-finetune" } : {}, each.key == "routes" ? { SLACK_SIGNING_SECRET = "secret://mapsbridge/slack/signing-secret", SLACK_BOT_TOKEN = "secret://mapsbridge/slack/bot-token", GH_TOKEN = "secret://mapsbridge/github/token", ALLOWED_USERS = "", ALLOWED_CHANNELS = "", SLACK_ADMIN_USER_IDS = var.slack_admin_user_ids, DEPLOY_TARGETS = var.deploy_targets, OSRM_BASE_URL = "https://router.project-osrm.org", MEDIA_BUCKET = "${var.prefix}-storage-media-${var.account_id}" } : {}, each.key == "ai" ? { BEDROCK_MODEL_ID = "eu.anthropic.claude-haiku-4-5-20251001-v1:0", AI_DAILY_REQUEST_LIMIT = "200", TRAVEL_KNOWLEDGE_BASE_ID = var.travel_knowledge_base_id, PLACE_RESEARCH_ENABLED = "true" } : {}, each.key == "ai" ? var.ai_memory_environment : {}, each.key == "ai" ? var.ai_gateway_environment : {}, each.key == "ai" ? { AI_TRAINING_COLLECTION_ENABLED = tostring(var.ai_training_collection_enabled) } : {}, each.key == "ai" ? var.ai_finops_environment : {}, each.key == "stripe" ? merge({ APP_ORIGIN = var.frontend_origin, BILLING_ENABLED = "false" }, var.billing_environment) : {})
  }
  depends_on = [aws_iam_role_policy.data, aws_iam_role_policy_attachment.logs]
}
resource "aws_apigatewayv2_integration" "domain" {
  for_each               = local.domains
  api_id                 = var.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.domain[each.key].invoke_arn
  payload_format_version = "2.0"
}
resource "aws_apigatewayv2_route" "domain" {
  for_each  = local.routes
  api_id    = var.api_id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.domain[each.value].id}"
}
resource "aws_lambda_permission" "gateway" {
  for_each      = local.domains
  statement_id  = "AllowExistingApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.domain[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.region}:${var.account_id}:${var.api_id}/*/*"
}
output "admin_url" {
  value       = "${var.frontend_origin}/admin/"
  description = "Admin panel URL"
}

resource "aws_cognito_user_group" "staff" {
  for_each     = toset(["moderator", "support"])
  name         = "mapsbridge-${each.key}"
  user_pool_id = var.cognito_user_pool_id
  description  = "MapsBridge ${each.key} staff; server-enforced permissions."
}

variable "billing_environment" {
  type        = map(string)
  default     = {}
  description = "Stripe price IDs and secret: SSM references only; no plaintext credentials."
}

variable "kb_source_bucket" {
  type        = string
  description = "S3 bucket for Bedrock KB source documents (travel-rag output)"
  default     = "mapsbridge-prod-travel-sources-865369794421"
}

variable "kb_data_source_id" {
  type        = string
  description = "Bedrock KB data source ID"
  default     = "HGCTUZJ1YQ"
}

resource "aws_resourcegroups_group" "stack" {
  name = "${var.prefix}-admin-runtime"
  resource_query {
    query = jsonencode({
      ResourceTypeFilters = ["AWS::AllSupported"]
      TagFilters          = [{ Key = "Stack", Values = ["admin-runtime"] }]
    })
  }
}
